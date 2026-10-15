import "server-only";
import { getAdminAttendanceReview } from "@/src/lib/queries/admin-attendance-review";
import { applyAttendanceReviewToPulse } from "@/src/lib/admin-attendance-pulse";
import { validAssessmentWeights } from "@/src/lib/academic-readiness-rules";
import { evaluateSchoolOperatingWindow } from "@/src/lib/services/school-operating-hours";
import type { AdminOwnerDashboardData } from "@/src/lib/queries/admin-owner-dashboard";

export async function getAdminSchoolPulse(schoolId: string, now = new Date()) {
  const review = await getAdminAttendanceReview({}, now, { includeHistory: false, dashboard: true, expectedSchoolId: schoolId });
  if (!review.operatingSettings) throw new Error("School operating settings are not configured.");
  const operatingStatus = evaluateSchoolOperatingWindow(review.operatingSettings, now);
  // An explicitly empty school calendar must not become the default working week.
  if (review.operatingSettings.activeDays.length === 0) {
    Object.assign(operatingStatus, { allowed: false, isActiveDay: false, isWithinSchoolHours: false, activeDays: [], label: "No active school days", reason: "School days are not configured." });
  }
  const base: AdminOwnerDashboardData["schoolPulse"] = {
    todayLabel: review.date, operatingStatus, totalStudents: 0, totalClasses: review.classes.length,
    lessonsScheduledToday: 0, lessonsMarkedToday: 0, unmarkedLessonsToday: 0,
    attendanceRecordsToday: 0, present: 0, absent: 0, late: 0, excused: 0, attendanceRate: 0,
    classDutySummary: [], unmarkedLessons: [],
  };
  return {
    activePeriod: review.academicPeriods.length === 1 && validAssessmentWeights(review.academicPeriods[0]) ? review.academicPeriods[0] : null,
    schoolPulse: applyAttendanceReviewToPulse(base, review),
  };
}
