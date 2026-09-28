import type { Day } from "@/src/generated/prisma";
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
};

function dayStart(date: Date) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60_000);
}

function combineDateWithLessonTime(date: Date, lessonTime: Date) {
  const value = dayStart(date);
  value.setHours(lessonTime.getHours(), lessonTime.getMinutes(), 0, 0);
  return value;
}

function formatTime(date: Date) {
  return date.toLocaleTimeString("en-GH", { hour: "2-digit", minute: "2-digit" });
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
  const day = DAY_BY_INDEX[dayStart(now).getDay()];
  if (!day) {
    return {
      allowed: false,
      label: "your published lesson period",
      reason: "CA entry opens only on a school day with a published lesson for this class and subject.",
    };
  }

  const [settings, lessons] = await Promise.all([
    getTeacherAccountabilitySettings(schoolId),
    listLiveTimetableLessons(schoolId, { day, teacherId, classId }),
  ]);
  const subjectLessons = lessons
    .filter((lesson) => lesson.subjectId === subjectId)
    .map((lesson) => {
      const startAt = combineDateWithLessonTime(now, lesson.startTime);
      const endAt = combineDateWithLessonTime(now, lesson.endTime);
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

  const openLesson = subjectLessons.find((item) => now >= item.openAt && now <= item.closeAt);
  if (openLesson) {
    return {
      allowed: true,
      label: `${openLesson.lesson.subject.name} lesson period (${formatTime(openLesson.startAt)}-${formatTime(openLesson.endAt)})`,
      reason: now > openLesson.deadlineAt
        ? `This is already after the normal lesson deadline. Entry stays open until ${formatTime(openLesson.closeAt)}.`
        : null,
    };
  }

  const nextLesson = subjectLessons.find((item) => now < item.openAt);
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
