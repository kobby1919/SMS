import "server-only";
import prisma from "@/src/lib/prisma";
import { requireRole } from "@/src/lib/authz";
import { caRecordingDeadline } from "@/src/lib/academic-readiness-rules";
import { getAcademicReadinessRules } from "@/src/lib/services/academic-readiness-rules";
import { getClassReportReadiness } from "@/src/lib/services/report-card-readiness";
import { getAdminTeacherAccountability } from "@/src/lib/services/admin-teacher-accountability";
import { getCARecordingTracking } from "@/src/lib/services/ca-recording-tracking";
import { buildExamWindowTracking } from "@/src/lib/services/exam-window-tracking";
import { getFinalReportPosition, buildFinalReportTracking } from "@/src/lib/services/final-report-readiness";

type SnapshotState = "AVAILABLE" | "SETUP_REQUIRED" | "UNAVAILABLE";
type ReadinessClass = {
  classId: number;
  className: string;
  studentCount: number;
  subjectCount: number;
  expectedEntries: number;
  readyEntries: number;
  completeEvidenceStudents: number;
  caStartedEntries: number;
  examState: string;
  publicationStatus: string;
  readyForReview: boolean;
  evidenceComplete: boolean;
  reportPosition: ReturnType<typeof getFinalReportPosition>;
  reportState: "INCOMPLETE" | "READY_FOR_REVIEW" | "AWAITING_REVIEW" | "PUBLISHED" | "NEEDS_RECONCILIATION";
  issues: string[];
  blockerCounts: Record<string, number>;
  blockingSubjects: { subjectId: number; subjectName: string; affectedEntries: number; reasons: string[] }[];
};

// Refuse oversized synchronous evaluations rather than returning truncated totals.
const budgets = {
  classes: 60, students: 3000, teachers: 500, subjects: 500,
  lessons: 10000, buckets: 5000, activities: 10000, scores: 100000,
  assessments: 100000, obligations: 20000, escalations: 20000, corrections: 10000,
  expectedEntries: 30000, evaluationWork: 2000000,
};

/** Authenticated, read-only dashboard evidence. Report release remains a separate action. */
export async function getAdminAcademicReadinessSnapshot() {
  const { schoolId } = await requireRole(["admin"]);
  if (!schoolId?.trim()) throw new Error("An authenticated school scope is required.");
  const base = { evaluatedAt: new Date().toISOString(), period: null as Awaited<ReturnType<typeof getAcademicReadinessRules>>["period"], publicationId: null as string | null };
  const unavailable = (state: SnapshotState, code: string, issues: string[]) => ({
    ...base, state, code, issues, totals: null, classes: [] as ReadinessClass[],
    classListLimit: 5, accountability: null as Awaited<ReturnType<typeof getAdminTeacherAccountability>> | null,
    caRecording: null as Awaited<ReturnType<typeof getCARecordingTracking>> | null,
    examTracking: null as ReturnType<typeof buildExamWindowTracking> | null,
    finalReports: null as ReturnType<typeof buildFinalReportTracking> | null,
    accountabilityState: "UNAVAILABLE" as SnapshotState,
    accountabilityIssues: issues,
  });
  return prisma.$transaction(async (tx) => {
    const now = new Date();
    base.evaluatedAt = now.toISOString();
    // Counts and the subsequent reads share one snapshot, so a concurrent import
    // cannot pass these budgets then enlarge the evidence loaded by this request.
    const counts = {
      classes: await tx.class.count({ where: { schoolId } }),
      students: await tx.student.count({ where: { schoolId, status: "ACTIVE" } }),
      teachers: await tx.teacher.count({ where: { schoolId, status: "ACTIVE" } }),
      subjects: await tx.subject.count({ where: { schoolId } }),
      lessons: await tx.publishedTimetableLesson.count({ where: { schoolId, publication: { schoolId, status: "ACTIVE" } } }),
    };
    if (Object.entries(counts).some(([key, count]) => count > budgets[key as keyof typeof counts])) {
      return unavailable("UNAVAILABLE", "EVALUATION_LIMIT", ["This school's academic evidence exceeds the dashboard evaluation limit. No partial totals are shown."]);
    }
    const rules = await getAcademicReadinessRules(schoolId, tx);
    base.period = rules.period;
    base.publicationId = rules.publicationId;
    if (!rules.period || !rules.publicationId) return unavailable("SETUP_REQUIRED", "MISSING_SCOPE", rules.issues);
    if (rules.invalidAssignmentCount > 0) return unavailable("UNAVAILABLE", "INVALID_SCOPE", rules.issues);
    if (!rules.scope.length) return unavailable("SETUP_REQUIRED", "NO_TEACHING_SCOPE", ["Add eligible teaching assignments to the published timetable."]);
    const context = { schoolId, academicYear: rules.period.academicYear, term: rules.period.term };
    const evidenceCounts = {
      buckets: await tx.cABucket.count({ where: context }),
      activities: await tx.cAActivity.count({ where: { schoolId, bucket: context } }),
      scores: await tx.cAActivityScore.count({ where: { schoolId, activity: { schoolId, bucket: context } } }),
      assessments: await tx.continuousAssessment.count({ where: context }),
      obligations: await tx.teacherObligation.count({ where: { schoolId, type: "CA_SCORE_PUBLISHING" } }),
      escalations: await tx.teacherEscalation.count({ where: { schoolId } }),
      corrections: await tx.teacherCorrectionRequest.count({ where: { schoolId, status: "PENDING" } }),
    };
    if (Object.entries(evidenceCounts).some(([key, count]) => count > budgets[key as keyof typeof evidenceCounts])) return unavailable("UNAVAILABLE", "EVALUATION_LIMIT", ["The academic evidence exceeds the dashboard evaluation limit. No partial totals are shown."]);

    const classes = await tx.class.findMany({ where: { schoolId }, select: { id: true, name: true, _count: { select: { students: { where: { schoolId, status: "ACTIVE" } } } } }, orderBy: { id: "asc" } });
    if (classes.reduce((sum, cls) => sum + cls._count.students, 0) !== counts.students) return unavailable("UNAVAILABLE", "INVALID_STUDENT_PLACEMENT", ["Some active students do not have a valid class in this school. Resolve placement before evaluating school totals."]);
    if (!counts.students) return unavailable("SETUP_REQUIRED", "NO_ELIGIBLE_STUDENTS", ["Add active students to classes before evaluating report readiness."]);
    const scopedClasses = classes.filter((cls) => cls._count.students > 0 && rules.scope.some((scope) => scope.classId === cls.id));
    if (!scopedClasses.length) return unavailable("SETUP_REQUIRED", "NO_ELIGIBLE_TEACHING_SCOPE", ["Publish subject assignments for classes that have active students. Empty classes do not establish student report readiness."]);
    const missingScopeClasses = classes.filter((cls) => cls._count.students > 0 && !scopedClasses.some((scope) => scope.id === cls.id)).length;
    const expectedEntries = scopedClasses.reduce((sum, cls) => sum + cls._count.students * new Set(rules.scope.filter((scope) => scope.classId === cls.id).map((scope) => scope.subjectId)).size, 0);
    if (expectedEntries > budgets.expectedEntries) return unavailable("UNAVAILABLE", "EVALUATION_LIMIT", ["The student/subject evaluation limit was exceeded. No partial readiness totals are shown."]);
    const activityCounts = await tx.cAActivity.groupBy({ by: ["classId"], where: { schoolId, bucket: { schoolId, academicYear: rules.period.academicYear, term: rules.period.term } }, _count: { _all: true } });
    const bucketCounts = await tx.cABucket.groupBy({ by: ["classId"], where: { schoolId, academicYear: rules.period.academicYear, term: rules.period.term }, _count: { _all: true } });
    const evaluationWork = scopedClasses.reduce((sum, cls) => {
      const subjects = new Set(rules.scope.filter((scope) => scope.classId === cls.id).map((scope) => scope.subjectId)).size;
      const evidence = (activityCounts.find((row) => row.classId === cls.id)?._count._all ?? 0) + (bucketCounts.find((row) => row.classId === cls.id)?._count._all ?? 0);
      return sum + cls._count.students * subjects * (evidence + 1);
    }, 0);
    if (evaluationWork > budgets.evaluationWork) return unavailable("UNAVAILABLE", "EVALUATION_LIMIT", ["The assessment history is too dense for this dashboard evaluation. No partial readiness totals are shown."]);
    const publications = await tx.reportCardPublication.findMany({ where: { schoolId, academicYear: rules.period.academicYear, term: rules.period.term, classId: { in: scopedClasses.map((cls) => cls.id) }, class: { schoolId } }, select: { classId: true, status: true, unpublishedAt: true } });
    const evaluated: ReadinessClass[] = [];
    const examClasses: Parameters<typeof buildExamWindowTracking>[3] = [];
    for (const cls of scopedClasses) {
      const subjectIds = [...new Set(rules.scope.filter((scope) => scope.classId === cls.id).map((scope) => scope.subjectId))];
      const readiness = await getClassReportReadiness({ schoolId, classId: cls.id, academicYear: rules.period.academicYear, term: rules.period.term, subjectIds }, tx, now);
      if (!readiness.currentPeriod || readiness.studentCount !== cls._count.students || readiness.subjectCount !== new Set(rules.scope.filter((scope) => scope.classId === cls.id).map((scope) => scope.subjectId)).size) return unavailable("UNAVAILABLE", "INCONSISTENT_SOURCE_SCOPE", ["Report readiness and published teaching scope do not agree. No partial totals are shown."]);
      const publicationStatus = publications.find((publication) => publication.classId === cls.id)?.status ?? "UNPUBLISHED";
      if (readiness.examEvidence.length !== subjectIds.length || readiness.examEvidence.some((row) => !subjectIds.includes(row.subjectId))) return unavailable("UNAVAILABLE", "INCONSISTENT_EXAM_SCOPE", ["Exam evidence and published subjects do not agree. No partial totals are shown."]);
      examClasses.push({ classId: cls.id, className: cls.name, studentCount: readiness.studentCount, subjectCount: readiness.subjectCount,
        windowState: rules.examWindows.find((window) => window.classId === cls.id)?.state ?? "NOT_CONFIGURED", publicationStatus, evidence: readiness.examEvidence });
      const reviewed = publicationStatus === "PUBLISHED" || publicationStatus === "SUBMITTED";
      const reportPosition = getFinalReportPosition({ readiness, publicationStatus,
        unpublishedAt: publications.find((publication) => publication.classId === cls.id)?.unpublishedAt,
        examState: rules.examWindows.find((window) => window.classId === cls.id)?.state ?? "NOT_CONFIGURED" });
      const reportState: ReadinessClass["reportState"] = reviewed
        ? (!reportPosition.releaseReady ? "NEEDS_RECONCILIATION" : publicationStatus === "PUBLISHED" ? "PUBLISHED" : "AWAITING_REVIEW")
        : (reportPosition.canSubmitForReview ? "READY_FOR_REVIEW" : "INCOMPLETE");
      const subjects = new Map<number, ReadinessClass["blockingSubjects"][number]>();
      const blockerCounts: Record<string, number> = {};
      for (const blocker of readiness.blockers) {
        blockerCounts[blocker.reason] = (blockerCounts[blocker.reason] ?? 0) + 1;
        const subject = subjects.get(blocker.subjectId) ?? { subjectId: blocker.subjectId, subjectName: blocker.subjectName, affectedEntries: 0, reasons: [] };
        subject.affectedEntries++;
        if (!subject.reasons.includes(blocker.reason)) subject.reasons.push(blocker.reason);
        subjects.set(subject.subjectId, subject);
      }
      evaluated.push({
        classId: cls.id, className: cls.name, studentCount: readiness.studentCount,
        subjectCount: readiness.subjectCount, expectedEntries: readiness.expectedEntryCount,
        readyEntries: readiness.readyEntryCount, completeEvidenceStudents: readiness.readyStudentCount,
        caStartedEntries: readiness.caStartedEntryCount,
        examState: rules.examWindows.find((window) => window.classId === cls.id)?.state ?? "NOT_CONFIGURED",
        publicationStatus, reportState, reportPosition, evidenceComplete: reportPosition.evidenceComplete,
        readyForReview: reportState === "READY_FOR_REVIEW", issues: readiness.issues,
        blockerCounts, blockingSubjects: [...subjects.values()].sort((a, b) => b.affectedEntries - a.affectedEntries || a.subjectId - b.subjectId).slice(0, 5),
      });
    }
    let accountabilityState: SnapshotState = "AVAILABLE";
    const accountabilityIssues: string[] = [];
    if (!rules.caPolicy) {
      accountabilityState = "SETUP_REQUIRED";
      accountabilityIssues.push("Configure CA recording deadlines before evaluating overdue teacher work.");
    } else {
      try {
        caRecordingDeadline(now, rules.caPolicy.caScorePublishWindowSchoolDays, rules.caPolicy.teacherCloseoutTime, rules.operating ?? undefined);
      } catch {
        accountabilityState = "UNAVAILABLE";
        accountabilityIssues.push("CA deadline or school operating settings are invalid. Overdue duties cannot be evaluated.");
      }
    }
    const accountability = accountabilityState === "AVAILABLE" ? await getAdminTeacherAccountability(schoolId, now, undefined, false, { db: tx, academicOnly: true }) : null;
    const caRecording = await getCARecordingTracking({ schoolId, rules, now, db: tx, reportPublications: publications });
    const examTracking = buildExamWindowTracking(rules.period.examWeight, rules.period.academicYear, rules.period.term, examClasses);
    const finalReports = buildFinalReportTracking(evaluated.map((cls) => ({ classId: cls.classId, className: cls.className, position: cls.reportPosition, blockingSubjects: cls.blockingSubjects })), rules.period.academicYear, rules.period.term);
    const issues = [...rules.issues];
    if (missingScopeClasses) issues.push(`${missingScopeClasses} class(es) with active students have no published subject scope. They are not counted as report-ready.`);
    const totals = {
      classes: classes.length, emptyClasses: classes.filter((cls) => !cls._count.students).length,
      trackedClasses: evaluated.length, classesWithoutTeachingScope: missingScopeClasses,
      studentsWithoutTeachingScope: classes.filter((cls) => cls._count.students > 0 && !scopedClasses.some((scope) => scope.id === cls.id)).reduce((sum, cls) => sum + cls._count.students, 0),
      eligibleStudents: evaluated.reduce((sum, cls) => sum + cls.studentCount, 0),
      expectedEntries: evaluated.reduce((sum, cls) => sum + cls.expectedEntries, 0),
      readyEntries: evaluated.reduce((sum, cls) => sum + cls.readyEntries, 0),
      completeEvidenceStudents: evaluated.reduce((sum, cls) => sum + cls.completeEvidenceStudents, 0),
      caStartedEntries: evaluated.reduce((sum, cls) => sum + cls.caStartedEntries, 0),
      readyForReviewClasses: evaluated.filter((cls) => cls.readyForReview).length,
      classesNeedingReview: finalReports.totals.blockedReviewClasses + missingScopeClasses,
      needsReconciliationClasses: evaluated.filter((cls) => cls.reportState === "NEEDS_RECONCILIATION").length,
      awaitingApprovalClasses: evaluated.filter((cls) => cls.publicationStatus === "SUBMITTED").length,
      publishedClasses: evaluated.filter((cls) => cls.publicationStatus === "PUBLISHED").length,
    };
    return {
      ...base, state: (missingScopeClasses ? "SETUP_REQUIRED" : "AVAILABLE") as SnapshotState,
      code: missingScopeClasses ? "INCOMPLETE_TEACHING_SCOPE" : "EVALUATED", issues, totals,
      classes: evaluated.filter((cls) => cls.reportState !== "PUBLISHED").sort((a, b) => Number(a.evidenceComplete) - Number(b.evidenceComplete) || (b.expectedEntries - b.readyEntries) - (a.expectedEntries - a.readyEntries) || a.classId - b.classId).slice(0, 5),
      classListLimit: 5, accountability, accountabilityState, accountabilityIssues, caRecording, examTracking, finalReports,
    };
  }, { isolationLevel: "RepeatableRead", maxWait: 15000, timeout: 45000 }).catch((error: unknown) => {
    const databaseError = error instanceof Error ? error as Error & { code?: unknown; errorCode?: unknown } : null;
    const code = databaseError?.code ?? databaseError?.errorCode;
    if (typeof code !== "string" || !["P1001", "P1002", "P1017", "P2024", "P2028", "P2034"].includes(code)) throw error;
    console.error("Academic readiness snapshot temporarily unavailable", { code });
    return unavailable("UNAVAILABLE", "DATABASE_UNAVAILABLE", ["Academic readiness could not be evaluated right now. Please try again. No partial totals are shown."]);
  });
}
