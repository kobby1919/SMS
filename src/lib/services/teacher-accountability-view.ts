import { syncAttendanceObligationsForDate } from "@/src/lib/services/teacher-attendance-obligations";
import { processTeacherWeekEscalationCatchup } from "@/src/lib/services/teacher-accountability";

function startOfDay(date: Date) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

function startOfWeek(date: Date) {
  const value = startOfDay(date);
  const day = value.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  value.setDate(value.getDate() + mondayOffset);
  return value;
}

function datesFromWeekStartToToday(now: Date) {
  const start = startOfWeek(now);
  const today = startOfDay(now);
  const dates: Date[] = [];

  for (const value = new Date(start); value <= today; value.setDate(value.getDate() + 1)) {
    const day = value.getDay();
    if (day !== 0 && day !== 6) {
      dates.push(new Date(value));
    }
  }

  return dates;
}

export async function prepareTeacherAccountabilityForView({
  schoolId,
  teacherId,
  now = new Date(),
}: {
  schoolId: string;
  teacherId: string;
  now?: Date;
}) {
  await Promise.all(
    datesFromWeekStartToToday(now).map((date) =>
      syncAttendanceObligationsForDate({
        schoolId,
        teacherId,
        date,
        now,
      }),
    ),
  );

  await processTeacherWeekEscalationCatchup({
    schoolId,
    teacherId,
    now,
  });
}
