import { cache } from "react";
import { syncAttendanceObligationsForDate } from "@/src/lib/services/teacher-attendance-obligations";
import { processTeacherWeekEscalationCatchup } from "@/src/lib/services/teacher-accountability";
import { syncCAActivityScorePublishingObligationsForSchool } from "@/src/lib/services/teacher-ca-obligations";
import { syncHomeworkCheckingObligationsForSchool } from "@/src/lib/services/teacher-homework-obligations";
import { isAccountabilityWriteConflict } from "@/src/lib/services/teacher-obligation-store";

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

async function synchronizeTeacherAccountabilityForView({
  schoolId,
  teacherId,
  now = new Date(),
}: {
  schoolId: string;
  teacherId: string;
  now?: Date;
}) {
  try {
    for (const date of datesFromWeekStartToToday(now)) {
      await syncAttendanceObligationsForDate({
        schoolId,
        teacherId,
        date,
        now,
      });
    }

    await syncCAActivityScorePublishingObligationsForSchool({ schoolId, teacherId, now });
    await syncHomeworkCheckingObligationsForSchool({ schoolId, teacherId, now });
    await processTeacherWeekEscalationCatchup({
      schoolId,
      teacherId,
      now,
    });
    return true;
  } catch (error) {
    if (!isAccountabilityWriteConflict(error)) throw error;
    console.warn("TEACHER_ACCOUNTABILITY_SYNC_BUSY", { code: "P2034" });
    return false;
  }
}
// Primitive keys deduplicate navbar/page work only within the current server render.
const prepareForRequest = cache((schoolId: string, teacherId: string) =>
  synchronizeTeacherAccountabilityForView({ schoolId, teacherId }),
);

export async function prepareTeacherAccountabilityForView(input: {
  schoolId: string;
  teacherId: string;
  now?: Date;
}) {
  return input.now
    ? synchronizeTeacherAccountabilityForView(input)
    : prepareForRequest(input.schoolId, input.teacherId);
}
