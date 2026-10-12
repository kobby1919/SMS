import type { AdminOwnerDashboardData } from "@/src/lib/queries/admin-owner-dashboard";
import type { getAdminAttendanceReview } from "@/src/lib/queries/admin-attendance-review";

export function applyAttendanceReviewToPulse(pulse: AdminOwnerDashboardData["schoolPulse"], review: Awaited<ReturnType<typeof getAdminAttendanceReview>>) {
  if (review.error) throw new Error("School attendance review is unavailable.");
  const relevant = review.lessons.filter((lesson) => lesson.expected !== null && lesson.expected > 0);
  const groups = new Map<number, AdminOwnerDashboardData["schoolPulse"]["classDutySummary"][number]>();
  const oldDuties = new Map(pulse.classDutySummary.flatMap((group) => group.duties).map((duty) => [duty.lessonId, duty]));
  const unmarked: AdminOwnerDashboardData["schoolPulse"]["unmarkedLessons"] = [];
  for (const lesson of relevant) {
    const previous = oldDuties.get(lesson.sourceId);
    const isComplete = !review.ambiguous && lesson.state === "COMPLETE";
    const duty = { lessonId: lesson.sourceId, subjectName: lesson.subjectName, teacherName: lesson.teacherName, expectedRecords: lesson.expected!, markedRecords: lesson.marked, isComplete, obligationId: previous?.obligationId ?? null, obligationStatus: previous?.obligationStatus ?? null, reviewHref: `/list/attendance?date=${review.date}&classId=${lesson.classId}`, startTime: lesson.startTime, endTime: lesson.endTime };
    const group = groups.get(lesson.classId) ?? { classId: lesson.classId, className: lesson.className, expectedDuties: 0, completedDuties: 0, incompleteDuties: 0, completionRate: 0, duties: [] };
    group.expectedDuties++;
    if (isComplete) group.completedDuties++; else { group.incompleteDuties++; unmarked.push({ ...duty, className: lesson.className }); }
    group.duties.push(duty);
    group.completionRate = Math.round(group.completedDuties / group.expectedDuties * 100);
    groups.set(lesson.classId, group);
  }
  const known = review.totals.PRESENT + review.totals.LATE + review.totals.ABSENT + review.totals.EXCUSED;
  return { ...pulse, todayLabel: review.date, totalStudents: review.rosterCount, present: review.totals.PRESENT, late: review.totals.LATE, absent: review.totals.ABSENT, excused: review.totals.EXCUSED, unknown: review.totals.UNKNOWN, noScheduledLessons: review.totals.NO_LESSONS, timetableAmbiguous: review.ambiguous, closedUnmarkedLessons: relevant.filter((lesson) => lesson.state === "WINDOW_CLOSED").length, attendanceRate: known ? Math.round((review.totals.PRESENT + review.totals.LATE) / known * 100) : 0, attendanceRecordsToday: relevant.reduce((sum, lesson) => sum + lesson.marked, 0), lessonsScheduledToday: relevant.length, lessonsMarkedToday: relevant.length - unmarked.length, unmarkedLessonsToday: unmarked.length, classDutySummary: [...groups.values()].sort((a, b) => a.className.localeCompare(b.className)), unmarkedLessons: unmarked.slice(0, 6) };
}
