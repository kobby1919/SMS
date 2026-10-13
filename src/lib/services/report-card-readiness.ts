import "server-only";
import type { Prisma, Term } from "@/src/generated/prisma";
import prisma from "@/src/lib/prisma";
import { buildSubjectCAProgress } from "@/src/lib/services/ca-activity";
import { getGradeBand } from "@/src/lib/caGrades";
import { assessmentPosition } from "@/src/lib/assessment-position";
import { activityEligibility, validAssessmentWeights } from "@/src/lib/academic-readiness-rules";

export type ReportReadinessBlocker = { studentId: string; studentName: string; admissionNumber: string | null; subjectId: number; subjectName: string; reason: "MISSING_CA" | "MISSING_EXAM" | "INVALID_SCORE" | "STALE_TOTAL" | "FUTURE_ACTIVITY" | "PLACEMENT_REVIEW"; detail: string };
export type ClassReportReadiness = {
  classId: number; studentCount: number; subjectCount: number; expectedEntryCount: number; readyEntryCount: number; caStartedEntryCount: number;
  missingCount: number; missingCACount: number; missingExamCount: number; isReady: boolean; blockers: ReportReadinessBlocker[];
  issues: string[]; currentPeriod: boolean; readyStudentCount: number;
  studentPositions: { studentId: string; ready: number; caStarted: number }[];
  examRequired: boolean;
  readyEntries: { studentId: string; subjectId: number }[];
};

// Caller snapshots must still match the record version used for certification.
export async function getCanonicalReadyRecordIds(schoolId: string, records: { id: number; studentId: string; classId: number; academicYear: string; term: Term; subjectId: number; updatedAt: Date }[], now = new Date(), options: { requireCompleteStudent?: boolean } = {}) {
  const groups = new Map<string, typeof records>();
  for (const record of records) {
    const key = JSON.stringify([record.classId, record.academicYear, record.term]);
    groups.set(key, [...(groups.get(key) ?? []), record]);
  }
  const readyIds = new Set<number>();
  for (const group of groups.values()) await prisma.$transaction(async (tx) => {
    const first = group[0];
    const input = { schoolId, classId: first.classId, academicYear: first.academicYear, term: first.term };
    const readiness = await getClassReportReadiness(input, tx, now);
    if (readiness.issues.length || readiness.subjectCount === 0 || readiness.studentCount === 0) return;
    const live = await tx.continuousAssessment.findMany({ where: { schoolId, classId: first.classId, studentId: { in: [...new Set(group.map((r) => r.studentId))] }, academicYear: first.academicYear, term: first.term, id: { in: group.map((r) => r.id) } }, select: { id: true, subjectId: true, updatedAt: true } });
    for (const record of group) if ((!options.requireCompleteStudent || readiness.studentPositions.some((s) => s.studentId === record.studentId && s.ready === readiness.subjectCount)) && live.some((r) => r.id === record.id && r.updatedAt.getTime() === record.updatedAt.getTime()) && readiness.readyEntries.some((entry) => entry.studentId === record.studentId && entry.subjectId === record.subjectId)) readyIds.add(record.id);
  }, { isolationLevel: "RepeatableRead", timeout: 30000 });
  return readyIds;
}

export async function getClassReportReadiness(input: { schoolId: string; classId: number; term: Term; academicYear: string; subjectIds?: number[]; studentId?: string }, db?: Prisma.TransactionClient, now = new Date()): Promise<ClassReportReadiness> {
  if (!db) return prisma.$transaction((tx) => getClassReportReadiness(input, tx, now), { isolationLevel: "RepeatableRead", timeout: 30000 });
  const { schoolId, classId, term, academicYear } = input;
  const context = { schoolId, classId, term, academicYear };
  const cls = await db.class.findFirst({ where: { id: classId, schoolId }, select: { id: true } });
  if (!cls) throw new Error("This class is not available in your school.");
  const config = await db.cAConfig.findUnique({ where: { schoolId_academicYear: { schoolId, academicYear } } });
  const activeConfigs = await db.cAConfig.findMany({ where: { schoolId, isActive: true }, take: 2, select: { academicYear: true, currentTerm: true } });
  const currentPeriod = activeConfigs.some((active) => active.academicYear === academicYear && active.currentTerm === term);
  const publications = currentPeriod ? await db.timetablePublication.findMany({ where: { schoolId, status: "ACTIVE" }, take: 2, select: { id: true } }) : [];
  const subjects = currentPeriod
    ? (publications.length === 1 ? await db.publishedTimetableLesson.findMany({ where: { schoolId, classId, publicationId: publications[0].id, publication: { schoolId, status: "ACTIVE" } }, select: { subjectId: true, subjectName: true } }) : []).map((s) => ({ id: s.subjectId, name: s.subjectName }))
    : await db.subject.findMany({ where: { schoolId, OR: [{ caBuckets: { some: context } }, { continuousAssessments: { some: context } }] }, select: { id: true, name: true } });
  const scopedSubjects = [...new Map(subjects.filter((s) => input.subjectIds === undefined || input.subjectIds.includes(s.id)).map((s) => [s.id, s])).values()].sort((a, b) => a.name.localeCompare(b.name));
  const students = await db.student.findMany({ where: { schoolId, ...(input.studentId ? { id: input.studentId } : {}), class: { is: { schoolId } }, ...(currentPeriod ? { classId, status: "ACTIVE" } : { OR: [{ continuousAssessments: { some: context } }, { caActivityScores: { some: { schoolId, activity: { schoolId, classId, bucket: context } } } }] }) }, select: { id: true, name: true, surname: true, admissionNumber: true, createdAt: true, classJoinedAt: true }, orderBy: [{ surname: "asc" }, { name: "asc" }, { id: "asc" }] });
  const studentIds = students.map((s) => s.id);
  const subjectIds = scopedSubjects.map((s) => s.id);
  const records = subjectIds.length && studentIds.length ? await db.continuousAssessment.findMany({ where: { ...context, subjectId: { in: subjectIds }, studentId: { in: studentIds }, student: { schoolId }, subject: { schoolId } }, select: { id: true, studentId: true, subjectId: true, classworkScore: true, examScore: true, examRecordedAt: true, totalScore: true, grade: true, gradePoint: true } }) : [];
  // Load class evidence once; the canonical calculator is shared with assessment review.
  const buckets = subjectIds.length ? await db.cABucket.findMany({ where: { ...context, subjectId: { in: subjectIds }, subject: { schoolId } }, include: { activities: { where: { schoolId, classId, subjectId: { in: subjectIds } }, include: { teacher: { select: { name: true, surname: true } }, scores: { where: { schoolId, studentId: { in: studentIds }, student: { schoolId } }, select: { id: true, studentId: true, rawScore: true, normalizedContribution: true } } } } } }) : [];
  const issues: string[] = [];
  if (currentPeriod && activeConfigs.length !== 1) issues.push("Multiple active academic periods need review before reports can be released.");
  if (currentPeriod && publications.length !== 1) issues.push("One active published timetable is required before reports can be released.");
  const scoreIds = buckets.flatMap((bucket) => bucket.activities.flatMap((activity) => activity.scores.map((score) => String(score.id))));
  const recordIds = records.map((record) => String(record.id));
  const pendingCorrections = scoreIds.length || recordIds.length ? await db.teacherCorrectionRequest.count({
    where: { schoolId, status: "PENDING", OR: [
      { sourceModel: "CAActivityScore", fieldName: "rawScore", sourceId: { in: scoreIds } },
      { sourceModel: "ContinuousAssessment", fieldName: "examScore", sourceId: { in: recordIds } },
    ] },
  }) : 0;
  if (pendingCorrections) issues.push(`${pendingCorrections} score correction request${pendingCorrections === 1 ? "" : "s"} await review before release.`);
  if (!validAssessmentWeights(config)) issues.push("A valid assessment configuration is required for this academic year.");
  if (!subjectIds.length) issues.push(currentPeriod ? "No subjects are available from the active published timetable." : "No subject evidence is available for this historical period.");
  if (!students.length) issues.push("No eligible student records are available for this class period.");
  const blockers: ReportReadinessBlocker[] = [];
  let readyEntryCount = 0, caStartedEntryCount = 0;
  const readyEntries: ClassReportReadiness["readyEntries"] = [];
  const readyByStudent = new Map<string, number>();
  const startedByStudent = new Map<string, number>();
  const scores = new Map(buckets.flatMap((bucket) => bucket.activities.flatMap((activity) => activity.scores.map((score) => [`${activity.id}:${score.studentId}`, score] as const))));
  const recordsByStudentSubject = new Map(records.map((record) => [`${record.studentId}:${record.subjectId}`, record]));
  for (const student of students) for (const subject of scopedSubjects) {
    const subjectBuckets = buckets.filter((bucket) => bucket.subjectId === subject.id);
    const future = subjectBuckets.flatMap((bucket) => bucket.activities).filter((activity) => activity.activityDate > now).length;
    const record = recordsByStudentSubject.get(`${student.id}:${subject.id}`);
    const add = (reason: ReportReadinessBlocker["reason"], detail: string) => blockers.push({ studentId: student.id, studentName: `${student.name} ${student.surname}`, admissionNumber: student.admissionNumber, subjectId: subject.id, subjectName: subject.name, reason, detail });
    if (!config || issues.some((issue) => issue.startsWith("A valid"))) { add("MISSING_CA", "Assessment configuration is missing or invalid."); continue; }
    if (subjectBuckets.some((bucket) => bucket.activities.some((activity) => activity.subjectId !== bucket.subjectId))) {
      add("INVALID_SCORE", "Activity subject does not match its assessment bucket. Records need reconciliation.");
      continue;
    }
    try {
      const progress = buildSubjectCAProgress(config, subjectBuckets.map((bucket) => ({ ...bucket, activities: bucket.activities.filter((activity) => activity.activityDate <= now).map((activity) => ({ ...activity, scores: scores.has(`${activity.id}:${student.id}`) ? [scores.get(`${activity.id}:${student.id}`)!] : [] })) })));
      const position = assessmentPosition(progress, record?.examScore ?? null, config.examWeight, future, record?.examRecordedAt);
      if (position.scored > 0) { caStartedEntryCount++; startedByStudent.set(student.id, (startedByStudent.get(student.id) ?? 0) + 1); }
      if (position.status === "Needs review") add("INVALID_SCORE", "Score or allocation data is invalid.");
      else if (future > 0) add("FUTURE_ACTIVITY", `${future} planned CA activit${future === 1 ? "y has" : "ies have"} not taken place yet.`);
      else if (currentPeriod && student.createdAt && subjectBuckets.some((bucket) => bucket.activities.some((activity) => !scores.has(`${activity.id}:${student.id}`) && activityEligibility(student, activity.activityDate) !== "ELIGIBLE"))) add("PLACEMENT_REVIEW", "Earlier CA evidence needs admission/class-placement review. This is not an overdue teacher duty and no marks are awarded automatically.");
      else if (!position.caComplete) add("MISSING_CA", `CA incomplete: ${position.scored}/${position.expected} activity scores; allocation must match the configured CA weight.`);
      else if (!position.examConfirmed) add("MISSING_EXAM", "No confirmed exam score. A legacy zero does not prove an exam was entered.");
      else if (!record || !Number.isFinite(record.classworkScore) || !Number.isFinite(record.totalScore) || Math.abs(record.classworkScore - progress.earnedMarks) > 0.005 || position.total === null || Math.abs(record.totalScore - position.total) > 0.005 || record.grade !== getGradeBand(position.total).grade || record.gradePoint !== getGradeBand(position.total).gradePoint) add("STALE_TOTAL", "Stored report totals or grades do not match the assessment evidence. Teacher records need reconciliation.");
      else { readyEntryCount++; readyEntries.push({ studentId: student.id, subjectId: subject.id }); readyByStudent.set(student.id, (readyByStudent.get(student.id) ?? 0) + 1); }
    } catch (error) {
      if (!(error instanceof Error) || !["Raw maximum score must be greater than zero.", "Raw score cannot be negative.", "Raw score cannot exceed the activity maximum score.", "CA allocation must be greater than zero."].includes(error.message)) throw error;
      add("INVALID_SCORE", "Raw activity score or maximum requires correction.");
    }
  }
  const expectedEntryCount = students.length * subjectIds.length;
  return { readyEntries, classId, currentPeriod, examRequired: (config?.examWeight ?? 0) > 0, issues, studentCount: students.length, subjectCount: subjectIds.length, expectedEntryCount, readyEntryCount, caStartedEntryCount, missingCount: blockers.length, missingCACount: blockers.filter((b) => b.reason !== "MISSING_EXAM").length, missingExamCount: blockers.filter((b) => b.reason === "MISSING_EXAM").length, readyStudentCount: [...readyByStudent.values()].filter((count) => subjectIds.length > 0 && count === subjectIds.length).length, studentPositions: students.map((s) => ({ studentId: s.id, ready: readyByStudent.get(s.id) ?? 0, caStarted: startedByStudent.get(s.id) ?? 0 })), isReady: expectedEntryCount > 0 && issues.length === 0 && blockers.length === 0, blockers };
}
