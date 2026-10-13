import type { SubjectCAProgress } from "@/src/lib/services/ca-activity";
import { hasRecordedExam, validAssessmentWeights } from "@/src/lib/academic-readiness-rules";

export function assessmentPosition(progress: SubjectCAProgress, examScore: number | null, examMaximum: number, futureActivities = 0, examRecordedAt?: Date | string | null) {
  const activities = progress.buckets.flatMap((bucket) => bucket.activities);
  const scored = activities.filter((activity) => activity.rawScore !== null).length;
  const invalid = !validAssessmentWeights({ classworkWeight: progress.classworkWeight, examWeight: examMaximum }) || !Number.isFinite(progress.totalAllocatedMarks) || progress.totalAllocatedMarks < 0 || (progress.classworkWeight === 0 && progress.totalAllocatedMarks !== 0) || !Number.isFinite(progress.earnedMarks) || progress.earnedMarks < 0 || progress.earnedMarks > progress.classworkWeight ||
    !Number.isFinite(progress.classworkWeight) || progress.classworkWeight < 0 || !Number.isFinite(examMaximum) || examMaximum < 0 ||
    (examScore !== null && (!Number.isFinite(examScore) || examScore < 0 || examScore > examMaximum)) ||
    activities.some((activity) => !Number.isFinite(activity.rawMaxScore) || activity.rawMaxScore <= 0 ||
      (activity.rawScore !== null && (!Number.isFinite(activity.rawScore) || activity.rawScore < 0 || activity.rawScore > activity.rawMaxScore)));
  const allocationComplete = Math.abs(progress.totalAllocatedMarks - progress.classworkWeight) < 0.005;
  const caComplete = progress.classworkWeight === 0 || activities.length > 0 && scored === activities.length && allocationComplete &&
    progress.buckets.every((bucket) => bucket.activityCount > 0 &&
      (bucket.aggregationMode !== "SUM_ACTIVITIES" ||
        Math.abs(bucket.activities.reduce((sum, activity) => sum + (activity.allocationMarks ?? 0), 0) - bucket.allocationMarks) < 0.005));
  const examConfirmed = examMaximum === 0 || (examScore !== null && hasRecordedExam({ examScore, examRecordedAt }) && examScore <= examMaximum);
  const complete = !invalid && caComplete && examConfirmed && futureActivities === 0;
  return { scored, expected: activities.length, caComplete, examConfirmed,
    ca: !invalid && scored > 0 ? progress.earnedMarks : null,
    status: invalid ? "Needs review" : complete ? "Complete" : scored === 0 && !examConfirmed ? "Not started" : "Incomplete",
    total: complete ? Math.round((progress.earnedMarks + (examMaximum > 0 ? examScore ?? 0 : 0)) * 100) / 100 : null };
}
