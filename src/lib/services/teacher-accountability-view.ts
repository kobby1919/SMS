import { syncAttendanceObligationsForDate } from "@/src/lib/services/teacher-attendance-obligations";

export async function prepareTeacherAccountabilityForView({
  schoolId,
  teacherId,
  now = new Date(),
}: {
  schoolId: string;
  teacherId: string;
  now?: Date;
}) {
  await syncAttendanceObligationsForDate({
    schoolId,
    teacherId,
    date: now,
    now,
  });
}
