import type { Day } from "@/src/generated/prisma";
import prisma from "@/src/lib/prisma";
import { getTeacherAccountabilitySettings } from "@/src/lib/services/teacher-accountability-settings";
import { listLiveTimetableLessons } from "@/src/lib/services/timetable";

const DAY_BY_INDEX: Record<number, Day | null> = {
  0: null,
  1: "MONDAY",
  2: "TUESDAY",
  3: "WEDNESDAY",
  4: "THURSDAY",
  5: "FRIDAY",
  6: null,
};

export type CAEntryWindowStatus = {
  allowed: boolean;
  label: string;
  reason: string | null;
  unavailable?: boolean;
};

type CAWindowPolicy = Pick<Awaited<ReturnType<typeof getTeacherAccountabilitySettings>>, "allowEarlyAttendanceMarking" | "attendanceOpenMinutesBeforeLesson" | "attendanceGraceMinutesAfterLesson" | "attendanceEscalateMinutesAfterLesson">;

export function isValidCAEntryWindowPolicy(settings: CAWindowPolicy | null | undefined) {
  if (!settings || typeof settings.allowEarlyAttendanceMarking !== "boolean" || ![settings.attendanceOpenMinutesBeforeLesson, settings.attendanceGraceMinutesAfterLesson, settings.attendanceEscalateMinutesAfterLesson].every((value) => Number.isInteger(value) && value >= 0)) return false;
  return settings.attendanceOpenMinutesBeforeLesson <= 120 && settings.attendanceGraceMinutesAfterLesson <= 180 && settings.attendanceEscalateMinutesAfterLesson <= 360 && settings.attendanceEscalateMinutesAfterLesson > settings.attendanceGraceMinutesAfterLesson;
}

function schoolClock(date: Date, timezone: string) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(date).filter((part) => part.type !== "literal").map((part) => [part.type, Number(part.value)]));
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second, date.getUTCMilliseconds()));
}

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60_000);
}

function combineDateWithLessonTime(date: Date, lessonTime: Date) {
  const value = new Date(date);
  value.setUTCHours(lessonTime.getUTCHours(), lessonTime.getUTCMinutes(), 0, 0);
  return value;
}

function formatTime(date: Date) {
  return date.toLocaleTimeString("en-GH", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
}

export async function getTeacherCAEntryWindowStatus({
  schoolId,
  teacherId,
  classId,
  subjectId,
  now = new Date(),
}: {
  schoolId: string;
  teacherId: string;
  classId: number;
  subjectId: number;
  now?: Date;
}): Promise<CAEntryWindowStatus> {
  const [settings, operating] = await Promise.all([
    getTeacherAccountabilitySettings(schoolId),
    prisma.schoolNotificationSetting.findUnique({ where: { schoolId }, select: { timezone: true } }),
  ]);
  const timezone = operating?.timezone ?? "Africa/Accra";
  let day: Day | null;
  try { day = DAY_BY_INDEX[schoolClock(now, timezone).getUTCDay()]; }
  catch { return evaluateTeacherCAEntryWindowStatus({ settings, lessons: [], subjectId, now, timezone }); }
  const lessons = day ? await listLiveTimetableLessons(schoolId, { day, teacherId, classId }) : [];
  return evaluateTeacherCAEntryWindowStatus({ settings, lessons, subjectId, now, timezone });
}

// The dashboard supplies already-scoped snapshot evidence; no settings writes or queries.
export function evaluateTeacherCAEntryWindowStatus({ settings, lessons, subjectId, now, timezone = "Africa/Accra" }: {
  settings: CAWindowPolicy;
  lessons: readonly { day: Day; subjectId: number; startTime: Date; endTime: Date; subject: { name: string } }[];
  subjectId: number;
  now: Date;
  timezone?: string;
}): CAEntryWindowStatus {
  const invalid = { allowed: false, unavailable: true, label: "school CA settings", reason: "CA lesson-window settings or timezone need review before recording can be permitted." };
  if (!isValidCAEntryWindowPolicy(settings)) return invalid;
  let clock: Date;
  try { clock = schoolClock(now, timezone); } catch { return invalid; }
  const day = DAY_BY_INDEX[clock.getUTCDay()];
  if (!day) return { allowed: false, label: "your published lesson period", reason: "CA entry opens only on a school day with a published lesson for this class and subject." };
  const subjectLessons = lessons
    .filter((lesson) => lesson.day === day && lesson.subjectId === subjectId)
    .slice().sort((a, b) => (a.startTime.getUTCHours() * 60 + a.startTime.getUTCMinutes()) - (b.startTime.getUTCHours() * 60 + b.startTime.getUTCMinutes()))
    .map((lesson) => {
      const startAt = combineDateWithLessonTime(clock, lesson.startTime);
      const endAt = combineDateWithLessonTime(clock, lesson.endTime);
      const openAt = settings.allowEarlyAttendanceMarking
        ? addMinutes(startAt, -settings.attendanceOpenMinutesBeforeLesson)
        : startAt;
      const deadlineAt = addMinutes(endAt, settings.attendanceGraceMinutesAfterLesson);
      const closeAt = addMinutes(endAt, settings.attendanceEscalateMinutesAfterLesson);

      return { lesson, startAt, endAt, openAt, deadlineAt, closeAt };
    });

  if (subjectLessons.length === 0) {
    return {
      allowed: false,
      label: "your published lesson period",
      reason: "No published lesson is scheduled for you today for this class and subject.",
    };
  }

  if (subjectLessons.some((item) => !Number.isFinite(item.startAt.getTime()) || !Number.isFinite(item.endAt.getTime()) || item.endAt <= item.startAt)) return invalid;
  const openLesson = subjectLessons.find((item) => clock >= item.openAt && clock <= item.closeAt);
  if (openLesson) {
    return {
      allowed: true,
      label: `${openLesson.lesson.subject.name} lesson period (${formatTime(openLesson.startAt)}-${formatTime(openLesson.endAt)})`,
      reason: clock > openLesson.deadlineAt
        ? `This is already after the normal lesson deadline. Entry stays open until ${formatTime(openLesson.closeAt)}.`
        : null,
    };
  }

  const nextLesson = subjectLessons.find((item) => clock < item.openAt);
  if (nextLesson) {
    return {
      allowed: false,
      label: `${nextLesson.lesson.subject.name} lesson period (${formatTime(nextLesson.startAt)}-${formatTime(nextLesson.endAt)})`,
      reason: `CA entry opens at ${formatTime(nextLesson.openAt)} for this lesson.`,
    };
  }

  const lastLesson = subjectLessons[subjectLessons.length - 1];
  return {
    allowed: false,
    label: `${lastLesson.lesson.subject.name} lesson period (${formatTime(lastLesson.startAt)}-${formatTime(lastLesson.endAt)})`,
    reason: "Today's CA entry window for this subject has closed. Use the correction/admin workflow if a saved score needs attention.",
  };
}

export async function assertTeacherCAEntryWindowOpen(input: {
  schoolId: string;
  teacherId: string;
  classId: number;
  subjectId: number;
  actionLabel: string;
}) {
  const status = await getTeacherCAEntryWindowStatus(input);
  if (!status.allowed) {
    throw new Error(`${input.actionLabel} is locked outside the published lesson period. ${status.reason ?? ""}`.trim());
  }
  return status;
}
