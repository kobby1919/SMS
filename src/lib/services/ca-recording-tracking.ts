import "server-only";
import type { Prisma } from "@/src/generated/prisma";
import type { getAcademicReadinessRules } from "@/src/lib/services/academic-readiness-rules";
import { activityEligibility, caRecordingDeadline } from "@/src/lib/academic-readiness-rules";
import { buildSubjectCAProgress } from "@/src/lib/services/ca-activity";
import { assessmentPosition } from "@/src/lib/assessment-position";
import { evaluateTeacherCAEntryWindowStatus } from "@/src/lib/services/teacher-ca-entry-window";
import { isOutstandingDuty, teacherFollowUpName } from "@/src/lib/queries/admin-teacher-follow-up";

type Rules = Awaited<ReturnType<typeof getAcademicReadinessRules>>;
type ActivityState = "COMPLETE" | "REMAINING" | "OVERDUE" | "PLANNED" | "PLACEMENT_REVIEW" | "NO_ELIGIBLE_STUDENTS" | "NEEDS_REVIEW" | "DEADLINE_UNAVAILABLE";
type ActivityTracking = {
  activityId: number; classId: number; subjectId: number; teacherId: string;
  title: string; teacherName: string; activityDate: string; hasTakenPlace: boolean; deadline: string | null;
  eligibleStudents: number; scoresRecorded: number; scoresRemaining: number;
  placementUnknownStudents: number; invalidScores: number;
  state: ActivityState; label: string;
  recordingPermittedNow: boolean | null; recordingBlockReason: string | null;
  followUpClosed: boolean;
};
type SubjectTracking = {
  classId: number; subjectId: number; activityCount: number;
  state: "NO_ACTIVITIES" | "INCOMPLETE" | "COMPLETE" | "NEEDS_REVIEW" | "NOT_REQUIRED";
  label: string; ignoredActivities: number;
  allocation: { requiredMarks: number; configuredMarks: number | null; bucketsFulfilled: boolean; activitiesFulfilled: boolean };
  completeStudentCAEntries: number; expectedStudentCAEntries: number;
  termCAComplete: boolean; placementReviewEntries: number;
  pendingScoreCorrections: number;
};

/** Internal snapshot reader. Caller must authenticate and enforce the snapshot workload budgets. */
export async function getCARecordingTracking(input: {
  schoolId: string; rules: Rules; now: Date; db: Prisma.TransactionClient;
  reportPublications: { classId: number; status: string }[];
}) {
  const { schoolId, rules, now, db, reportPublications } = input;
  const unavailable = (state: "SETUP_REQUIRED" | "UNAVAILABLE", issues: string[]) => ({ state, issues, totals: null, activities: [] as ActivityTracking[], subjects: [] as SubjectTracking[], listLimit: 5 });
  if (!schoolId.trim() || !rules.period || !rules.publicationId || rules.invalidAssignmentCount || !rules.scope.length) return unavailable("SETUP_REQUIRED", ["A valid active academic period and published teaching scope are required for CA tracking."]);
  if (!Number.isFinite(now.getTime())) throw new Error("A valid CA evaluation time is required.");
  const period = rules.period;
  const classIds = [...new Set(rules.scope.map((scope) => scope.classId))];
  const pairs = [...new Map(rules.scope.map((scope) => [`${scope.classId}:${scope.subjectId}`, { classId: scope.classId, subjectId: scope.subjectId }])).values()];
  const scopeKeys = new Set(rules.scope.map((scope) => `${scope.classId}:${scope.subjectId}:${scope.teacherId}`));
  const students = await db.student.findMany({ where: { schoolId, status: "ACTIVE", classId: { in: classIds }, class: { schoolId } }, select: { id: true, classId: true, createdAt: true, classJoinedAt: true } });
  const buckets = await db.cABucket.findMany({ where: { schoolId, academicYear: period.academicYear, term: period.term, class: { schoolId }, subject: { schoolId }, OR: pairs }, include: {
    activities: { where: { schoolId }, include: {
      teacher: { select: { id: true, schoolId: true, status: true, name: true, surname: true, sex: true } },
      scores: { where: { schoolId, student: { schoolId, status: "ACTIVE" } }, select: { id: true, studentId: true, rawScore: true, normalizedContribution: true } },
    } },
  } });
  const lessons = await db.publishedTimetableLesson.findMany({ where: { schoolId, publicationId: rules.publicationId, publication: { schoolId, status: "ACTIVE" } }, select: { classId: true, subjectId: true, teacherId: true, day: true, startTime: true, endTime: true, subjectName: true } });
  const obligations = await db.teacherObligation.findMany({ where: { schoolId, type: "CA_SCORE_PUBLISHING", teacher: { schoolId } }, select: { teacherId: true, sourceKey: true, sourceModel: true, sourceId: true, status: true, completedAt: true, escalations: { where: { schoolId }, select: { status: true } } } });
  const pendingCorrections = await db.teacherCorrectionRequest.findMany({ where: { schoolId, status: "PENDING", sourceModel: "CAActivityScore", fieldName: "rawScore", teacher: { schoolId } }, select: { sourceId: true } });
  const pendingBySource = new Map<string, number>();
  for (const request of pendingCorrections) pendingBySource.set(request.sourceId, (pendingBySource.get(request.sourceId) ?? 0) + 1);
  const obligationMap = new Map(obligations.map((row) => [`${row.teacherId}:${row.sourceKey}`, row]));
  const studentsByClass = new Map<number, typeof students>();
  for (const student of students) {
    const roster = studentsByClass.get(student.classId) ?? [];
    roster.push(student);
    studentsByClass.set(student.classId, roster);
  }
  const bucketsByPair = new Map<string, typeof buckets>();
  for (const bucket of buckets) {
    const key = `${bucket.classId}:${bucket.subjectId}`;
    const entries = bucketsByPair.get(key) ?? [];
    entries.push(bucket);
    bucketsByPair.set(key, entries);
  }
  const lessonsByScope = new Map<string, typeof lessons>();
  for (const lesson of lessons) {
    const key = `${lesson.classId}:${lesson.subjectId}:${lesson.teacherId}`;
    const entries = lessonsByScope.get(key) ?? [];
    entries.push(lesson);
    lessonsByScope.set(key, entries);
  }
  const permissionCache = new Map<string, ReturnType<typeof evaluateTeacherCAEntryWindowStatus>>();
  const rows: ActivityTracking[] = [];
  const subjectRows: SubjectTracking[] = [];
  const issues: string[] = [];
  let ignoredActivities = 0;
  let deadlineAvailable = Boolean(rules.caPolicy);
  if (rules.caPolicy) {
    try { caRecordingDeadline(now, rules.caPolicy.caScorePublishWindowSchoolDays, rules.caPolicy.teacherCloseoutTime, rules.operating ?? undefined); }
    catch { deadlineAvailable = false; }
  }
  if (!deadlineAvailable && period.classworkWeight > 0) issues.push("CA recording deadlines are missing or invalid. Remaining scores are visible, but overdue tracking is unavailable.");
  const permissionPolicyValid = Boolean(rules.caPolicy && typeof rules.caPolicy.allowEarlyAttendanceMarking === "boolean" && [rules.caPolicy.attendanceOpenMinutesBeforeLesson, rules.caPolicy.attendanceGraceMinutesAfterLesson, rules.caPolicy.attendanceEscalateMinutesAfterLesson].every((minutes) => Number.isInteger(minutes) && minutes >= 0));
  if (!permissionPolicyValid && period.classworkWeight > 0) issues.push("CA lesson-window settings need review before current recording permission can be evaluated.");

  for (const pair of pairs) {
    const roster = studentsByClass.get(pair.classId) ?? [];
    if (!roster.length) continue;
    const rosterIds = new Set(roster.map((student) => student.id));
    const subjectBuckets = bucketsByPair.get(`${pair.classId}:${pair.subjectId}`) ?? [];
    const allActivities = subjectBuckets.flatMap((bucket) => bucket.activities);
    const misfiledEvidence = allActivities.some((activity) => activity.teacher.schoolId !== schoolId || activity.teacher.id !== activity.teacherId || activity.classId !== pair.classId || activity.subjectId !== pair.subjectId);
    const scoped = allActivities.filter((activity) => activity.teacher.schoolId === schoolId && activity.teacher.id === activity.teacherId && activity.teacher.status === "ACTIVE" && activity.classId === pair.classId && activity.subjectId === pair.subjectId && scopeKeys.has(`${activity.classId}:${activity.subjectId}:${activity.teacherId}`));
    const excluded = allActivities.length - scoped.length;
    ignoredActivities += excluded;
    const scoreIds = new Set(allActivities.flatMap((activity) => activity.scores.filter((score) => rosterIds.has(score.studentId)).map((score) => String(score.id))));
    const pendingScoreCorrections = [...scoreIds].reduce((sum, id) => sum + (pendingBySource.get(id) ?? 0), 0);
    for (const activity of scoped) {
      const eligible = new Set(roster.filter((student) => activityEligibility(student, activity.activityDate) === "ELIGIBLE").map((student) => student.id));
      const unknown = roster.filter((student) => activityEligibility(student, activity.activityDate) === "PLACEMENT_UNKNOWN").length;
      const maximum = Number(activity.rawMaxScore);
      const valid = new Set<string>();
      let invalidScores = 0;
      for (const score of activity.scores) {
        if (!eligible.has(score.studentId)) continue;
        const raw = Number(score.rawScore);
        if (score.rawScore == null || !Number.isFinite(raw) || !Number.isFinite(maximum) || maximum <= 0 || raw < 0 || raw > maximum || valid.has(score.studentId)) invalidScores++;
        else valid.add(score.studentId);
      }
      const scoresRemaining = eligible.size - valid.size;
      const obligation = obligationMap.get(`${activity.teacherId}:ca-score-publishing:activity:${activity.id}`);
      const matchingObligation = obligation?.sourceModel === "CAActivity" && obligation.sourceId === String(activity.id) ? obligation : null;
      const followUpClosed = Boolean(matchingObligation && (matchingObligation.status === "CANCELLED" || matchingObligation.escalations.some((row) => ["RESOLVED", "DISMISSED"].includes(row.status))));
      const deadline = deadlineAvailable ? caRecordingDeadline(activity.activityDate, rules.caPolicy!.caScorePublishWindowSchoolDays, rules.caPolicy!.teacherCloseoutTime, rules.operating ?? undefined) : null;
      const reportLocked = reportPublications.some((row) => row.classId === pair.classId && ["SUBMITTED", "PUBLISHED"].includes(row.status));
      const bucketLocked = subjectBuckets.find((bucket) => bucket.id === activity.bucketId)?.isLocked;
      let recordingPermittedNow: boolean | null = null;
      let recordingBlockReason: string | null = null;
      if (reportLocked || bucketLocked || activity.isLocked) { recordingPermittedNow = false; recordingBlockReason = "Locked records require the correction/review workflow."; }
      else if (activity.activityDate > now) { recordingPermittedNow = false; recordingBlockReason = "The activity has not taken place yet."; }
      else if (period.classworkWeight === 0) { recordingPermittedNow = false; recordingBlockReason = "CA is not required for this academic period."; }
      else if (rules.caPolicy && permissionPolicyValid) {
        const scope = `${pair.classId}:${pair.subjectId}:${activity.teacherId}`;
        const status = permissionCache.get(scope) ?? evaluateTeacherCAEntryWindowStatus({ now, subjectId: pair.subjectId, settings: rules.caPolicy, lessons: (lessonsByScope.get(scope) ?? []).map((lesson) => ({ ...lesson, subject: { name: lesson.subjectName } })) });
        permissionCache.set(scope, status);
        recordingPermittedNow = status.allowed;
        recordingBlockReason = status.allowed ? null : status.reason;
      } else recordingBlockReason = "Recording permission cannot be evaluated without valid school lesson-window settings.";
      let state: ActivityState;
      const prematureScores = activity.activityDate > now && activity.scores.some((score) => rosterIds.has(score.studentId));
      const staleCompletion = matchingObligation?.completedAt || ["COMPLETED", "COMPLETED_LATE"].includes(matchingObligation?.status ?? "");
      if (period.classworkWeight === 0 || !Number.isFinite(maximum) || maximum <= 0 || invalidScores || prematureScores || scoresRemaining > 0 && (activity.isLocked || bucketLocked || reportLocked || staleCompletion)) state = "NEEDS_REVIEW";
      else if (activity.activityDate > now) state = "PLANNED";
      else if (unknown) state = "PLACEMENT_REVIEW";
      else if (!eligible.size) state = "NO_ELIGIBLE_STUDENTS";
      else if (!scoresRemaining) state = "COMPLETE";
      else if (!deadline) state = "DEADLINE_UNAVAILABLE";
      else state = isOutstandingDuty({ deadline, complete: false, status: matchingObligation?.status, completedAt: matchingObligation?.completedAt, exception: followUpClosed }, now) ? "OVERDUE" : "REMAINING";
      const labels: Record<ActivityState, string> = { COMPLETE: "Activity scores complete", REMAINING: "Scores remaining", OVERDUE: "Scores overdue", PLANNED: "Activity has not taken place yet", PLACEMENT_REVIEW: "Student placement needs review", NO_ELIGIBLE_STUDENTS: "No eligible students for this activity", NEEDS_REVIEW: "Activity records need review", DEADLINE_UNAVAILABLE: "Scores remaining · deadline unavailable" };
      rows.push({ activityId: activity.id, classId: pair.classId, subjectId: pair.subjectId, teacherId: activity.teacherId, title: activity.title, teacherName: teacherFollowUpName(activity.teacher), activityDate: activity.activityDate.toISOString(), hasTakenPlace: activity.activityDate <= now, deadline: deadline?.toISOString() ?? null, eligibleStudents: eligible.size, scoresRecorded: valid.size, scoresRemaining, placementUnknownStudents: unknown, invalidScores, state, label: labels[state], recordingPermittedNow, recordingBlockReason, followUpClosed });
    }
    // Allocation uses the canonical calculator, not activity-count percentages.
    const planningProgress = buildSubjectCAProgress(period, subjectBuckets.map((bucket) => ({ ...bucket, activities: bucket.activities.map((activity) => ({ ...activity, scores: [] })) })));
    const planningPosition = assessmentPosition(planningProgress, null, period.examWeight);
    let completeStudentCAEntries = 0, placementReviewEntries = 0;
    let invalidEvidence = planningPosition.status === "Needs review" || misfiledEvidence || pendingScoreCorrections > 0 || rows.some((row) => row.classId === pair.classId && row.subjectId === pair.subjectId && row.state === "NEEDS_REVIEW");
    const scores = new Map(allActivities.flatMap((activity) => activity.scores.map((score) => [`${activity.id}:${score.studentId}`, score] as const)));
    for (const student of roster) {
      const placementReview = allActivities.some((activity) => activity.activityDate <= now && activityEligibility(student, activity.activityDate) !== "ELIGIBLE" && !scores.has(`${activity.id}:${student.id}`));
      if (placementReview) placementReviewEntries++;
      try {
        const progress = buildSubjectCAProgress(period, subjectBuckets.map((bucket) => ({ ...bucket, activities: bucket.activities.filter((activity) => activity.activityDate <= now).map((activity) => ({ ...activity, scores: scores.has(`${activity.id}:${student.id}`) ? [scores.get(`${activity.id}:${student.id}`)!] : [] })) })));
        const position = assessmentPosition(progress, null, period.examWeight);
        if (position.status === "Needs review") invalidEvidence = true;
        if (!misfiledEvidence && !placementReview && position.status !== "Needs review" && position.caComplete && !allActivities.some((activity) => activity.activityDate > now)) completeStudentCAEntries++;
      } catch (error) {
        if (!(error instanceof Error) || !["Raw maximum score must be greater than zero.", "Raw score cannot be negative.", "Raw score cannot exceed the activity maximum score.", "CA allocation must be greater than zero."].includes(error.message)) throw error;
        invalidEvidence = true;
      }
    }
    const termCAComplete = !invalidEvidence && (period.classworkWeight === 0 || roster.length > 0 && completeStudentCAEntries === roster.length);
    const state: SubjectTracking["state"] = invalidEvidence ? "NEEDS_REVIEW" : period.classworkWeight === 0 ? "NOT_REQUIRED" : !allActivities.length ? "NO_ACTIVITIES" : termCAComplete ? "COMPLETE" : "INCOMPLETE";
    const labels = { NEEDS_REVIEW: "CA evidence needs review", NOT_REQUIRED: "CA not required", NO_ACTIVITIES: "No CA activity recorded yet", COMPLETE: "Term CA evidence complete", INCOMPLETE: "Term CA evidence incomplete" };
    subjectRows.push({ ...pair, state, label: labels[state], activityCount: scoped.length, ignoredActivities: excluded, allocation: { requiredMarks: period.classworkWeight, configuredMarks: Number.isFinite(planningProgress.totalAllocatedMarks) ? planningProgress.totalAllocatedMarks : null, bucketsFulfilled: planningPosition.allocationComplete, activitiesFulfilled: planningPosition.activityAllocationComplete }, completeStudentCAEntries, expectedStudentCAEntries: roster.length, termCAComplete, placementReviewEntries, pendingScoreCorrections });
  }
  const totals = {
    activities: rows.length, ignoredActivities, plannedActivities: rows.filter((row) => !row.hasTakenPlace).length,
    completeActivities: rows.filter((row) => row.state === "COMPLETE").length,
    remainingActivities: rows.filter((row) => ["REMAINING", "DEADLINE_UNAVAILABLE"].includes(row.state)).length,
    overdueActivities: period.classworkWeight === 0 ? 0 : deadlineAvailable ? rows.filter((row) => row.state === "OVERDUE").length : null,
    scoresRequired: rows.filter((row) => row.hasTakenPlace).reduce((sum, row) => sum + row.eligibleStudents, 0),
    scoresRecorded: rows.filter((row) => row.hasTakenPlace).reduce((sum, row) => sum + row.scoresRecorded, 0),
    scoresRemaining: rows.filter((row) => row.hasTakenPlace).reduce((sum, row) => sum + row.scoresRemaining, 0),
    activitiesNeedingReview: rows.filter((row) => ["NEEDS_REVIEW", "PLACEMENT_REVIEW"].includes(row.state)).length,
    subjectsWithoutActivities: subjectRows.filter((row) => row.state === "NO_ACTIVITIES").length,
    subjectsWithIncompleteAllocation: subjectRows.filter((row) => !row.allocation.bucketsFulfilled || !row.allocation.activitiesFulfilled).length,
    completeTermCASubjects: subjectRows.filter((row) => row.termCAComplete).length,
    placementReviewEntries: subjectRows.reduce((sum, row) => sum + row.placementReviewEntries, 0),
    pendingScoreCorrections: subjectRows.reduce((sum, row) => sum + row.pendingScoreCorrections, 0),
  };
  const rank: Record<ActivityState, number> = { NEEDS_REVIEW: 0, PLACEMENT_REVIEW: 1, OVERDUE: 2, DEADLINE_UNAVAILABLE: 3, REMAINING: 4, PLANNED: 5, NO_ELIGIBLE_STUDENTS: 6, COMPLETE: 7 };
  return { state: "AVAILABLE" as const, issues, totals, listLimit: 5,
    activities: rows.sort((a, b) => rank[a.state] - rank[b.state] || (a.deadline ?? a.activityDate).localeCompare(b.deadline ?? b.activityDate) || a.activityId - b.activityId).slice(0, 5),
    subjects: subjectRows.sort((a, b) => Number(a.termCAComplete) - Number(b.termCAComplete) || a.classId - b.classId || a.subjectId - b.subjectId).slice(0, 5),
  };
}
