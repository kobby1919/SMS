import prisma from "@/src/lib/prisma";
import type {
  Day,
  TeacherObligationPriority,
  TeacherObligationStatus,
} from "@/src/generated/prisma";
import { getTeacherAccountabilitySettings } from "@/src/lib/services/teacher-accountability-settings";

const DAY_BY_INDEX: Record<number, Day | null> = {
  0: null,
  1: "MONDAY",
  2: "TUESDAY",
  3: "WEDNESDAY",
  4: "THURSDAY",
  5: "FRIDAY",
  6: null,
};

type AttendanceObligationSnapshot = {
  lessonId: number;
  obligationId: string;
  status: TeacherObligationStatus;
  openAt: Date;
  deadlineAt: Date;
  missedAt: Date;
  expectedAt: Date;
  completedAt: Date | null;
  studentCount: number;
  attendanceCount: number;
};

type AttendanceWindowEvaluation = {
  allowed: boolean;
  status: "UPCOMING" | "OPEN" | "LATE" | "MISSED";
  openAt: Date;
  deadlineAt: Date;
  missedAt: Date;
  message?: string;
};

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function dayStart(date: Date) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

function dayEnd(date: Date) {
  const value = new Date(date);
  value.setHours(23, 59, 59, 999);
  return value;
}

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60_000);
}

function chunkArray<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function combineDateWithLessonTime(date: Date, lessonTime: Date) {
  const value = dayStart(date);
  value.setHours(lessonTime.getHours(), lessonTime.getMinutes(), 0, 0);
  return value;
}

export async function evaluateAttendanceWindow({
  schoolId,
  lessonId,
  date,
  now = new Date(),
}: {
  schoolId: string;
  lessonId: number;
  date: Date;
  now?: Date;
}): Promise<AttendanceWindowEvaluation> {
  const settings = await getTeacherAccountabilitySettings(schoolId);
  const lesson = await prisma.lesson.findFirst({
    where: { id: lessonId, schoolId },
    select: { startTime: true, endTime: true },
  });
  if (!lesson) throw new Error("Lesson not found.");

  const startAt = combineDateWithLessonTime(date, lesson.startTime);
  const endAt = combineDateWithLessonTime(date, lesson.endTime);
  const openAt = settings.allowEarlyAttendanceMarking
    ? addMinutes(startAt, -settings.attendanceOpenMinutesBeforeLesson)
    : startAt;
  const deadlineAt = addMinutes(endAt, settings.attendanceGraceMinutesAfterLesson);
  const missedAt = addMinutes(endAt, settings.attendanceEscalateMinutesAfterLesson);

  if (now < openAt) {
    return {
      allowed: false,
      status: "UPCOMING",
      openAt,
      deadlineAt,
      missedAt,
      message: `Attendance opens at ${openAt.toLocaleTimeString("en-GH", { hour: "2-digit", minute: "2-digit" })}.`,
    };
  }

  if (now > missedAt) {
    return {
      allowed: false,
      status: "MISSED",
      openAt,
      deadlineAt,
      missedAt,
      message: "This attendance window has closed. Ask an admin to correct or approve late entry.",
    };
  }

  return {
    allowed: true,
    status: now > deadlineAt ? "LATE" : "OPEN",
    openAt,
    deadlineAt,
    missedAt,
  };
}

function statusForAttendanceObligation({
  now,
  deadlineAt,
  missedAt,
  studentCount,
  attendanceCount,
  completedAt,
}: {
  now: Date;
  deadlineAt: Date;
  missedAt: Date;
  studentCount: number;
  attendanceCount: number;
  completedAt: Date | null;
}): TeacherObligationStatus {
  if (studentCount > 0 && attendanceCount >= studentCount && completedAt) {
    return completedAt > deadlineAt ? "COMPLETED_LATE" : "COMPLETED";
  }

  return now > missedAt ? "MISSED" : "PENDING";
}

function priorityForStatus(status: TeacherObligationStatus): TeacherObligationPriority {
  if (status === "MISSED" || status === "ESCALATED") return "HIGH";
  if (status === "COMPLETED_LATE") return "NORMAL";
  return "NORMAL";
}

export function attendanceObligationSourceKey(lessonId: number, date: Date) {
  return `attendance:${dateKey(date)}:lesson:${lessonId}`;
}

export async function syncAttendanceObligationsForDate({
  schoolId,
  teacherId,
  date,
  now = new Date(),
}: {
  schoolId: string;
  teacherId?: string;
  date: Date;
  now?: Date;
}): Promise<AttendanceObligationSnapshot[]> {
  const day = DAY_BY_INDEX[dayStart(date).getDay()];
  if (!day) return [];

  const settings = await getTeacherAccountabilitySettings(schoolId);
  const lessons = await prisma.lesson.findMany({
    where: {
      schoolId,
      day,
      ...(teacherId ? { teacherId } : {}),
    },
    include: {
      subject: { select: { id: true, name: true } },
      class: { select: { id: true, name: true } },
      teacher: { select: { id: true, name: true, surname: true } },
    },
    orderBy: [{ startTime: "asc" }, { id: "asc" }],
  });

  if (lessons.length === 0) return [];

  const classIds = [...new Set(lessons.map((lesson) => lesson.classId))];
  const lessonIds = lessons.map((lesson) => lesson.id);
  const [studentCounts, attendanceCounts] = await Promise.all([
    prisma.student.groupBy({
      by: ["classId"],
      where: { schoolId, classId: { in: classIds } },
      _count: { _all: true },
    }),
    prisma.attendance.groupBy({
      by: ["lessonId"],
      where: {
        schoolId,
        lessonId: { in: lessonIds },
        date: { gte: dayStart(date), lte: dayEnd(date) },
      },
      _count: { _all: true },
      _max: { updatedAt: true },
    }),
  ]);

  const studentCountByClass = new Map(
    studentCounts.map((row) => [row.classId, row._count._all]),
  );
  const attendanceByLesson = new Map(
    attendanceCounts.map((row) => [
      row.lessonId,
      {
        count: row._count._all,
        completedAt: row._max.updatedAt,
      },
    ]),
  );
  const targetDateKey = dateKey(date);

  const updates = lessons.map((lesson) => {
    const startAt = combineDateWithLessonTime(date, lesson.startTime);
    const endAt = combineDateWithLessonTime(date, lesson.endTime);
    const openAt = settings.allowEarlyAttendanceMarking
      ? addMinutes(startAt, -settings.attendanceOpenMinutesBeforeLesson)
      : startAt;
    const deadlineAt = addMinutes(endAt, settings.attendanceGraceMinutesAfterLesson);
    const missedAt = addMinutes(endAt, settings.attendanceEscalateMinutesAfterLesson);
    const attendance = attendanceByLesson.get(lesson.id) ?? {
      count: 0,
      completedAt: null,
    };
    const studentCount = studentCountByClass.get(lesson.classId) ?? 0;
    const status = statusForAttendanceObligation({
      now,
      deadlineAt,
      missedAt,
      studentCount,
      attendanceCount: attendance.count,
      completedAt: attendance.completedAt,
    });
    const sourceKey = attendanceObligationSourceKey(lesson.id, date);

    return {
      lesson,
      sourceKey,
      openAt,
      deadlineAt,
      missedAt,
      studentCount,
      attendanceCount: attendance.count,
      completedAt: attendance.completedAt,
      status,
      priority: priorityForStatus(status),
      title: `Mark ${lesson.class.name} ${lesson.subject.name} attendance`,
      description: `Attendance for ${lesson.subject.name} in ${lesson.class.name} is expected by ${deadlineAt.toLocaleTimeString("en-GH", { hour: "2-digit", minute: "2-digit" })}.`,
    };
  });
  const existingObligations = await prisma.teacherObligation.findMany({
    where: {
      schoolId,
      type: "ATTENDANCE",
      sourceKey: { in: updates.map((item) => item.sourceKey) },
    },
    select: {
      id: true,
      sourceId: true,
      sourceKey: true,
      status: true,
      priority: true,
      expectedAt: true,
      completedAt: true,
      metadata: true,
    },
  });
  const existingBySourceKey = new Map(
    existingObligations.map((obligation) => [obligation.sourceKey, obligation]),
  );

  const durableUpdates = updates.map((item) => {
    const existingStatus = existingBySourceKey.get(item.sourceKey)?.status;
    const status =
      existingStatus === "ESCALATED" &&
      item.status !== "COMPLETED" &&
      item.status !== "COMPLETED_LATE"
        ? "ESCALATED"
        : item.status;

    return {
      ...item,
      status,
      priority: priorityForStatus(status),
    };
  });

  const createData = durableUpdates
    .filter((item) => !existingBySourceKey.has(item.sourceKey))
    .map((item) => ({
      schoolId,
      teacherId: item.lesson.teacherId,
      type: "ATTENDANCE" as const,
      status: item.status,
      priority: item.priority,
      sourceModel: "Lesson",
      sourceId: String(item.lesson.id),
      sourceKey: item.sourceKey,
      title: item.title,
      description: item.description,
      expectedAt: item.deadlineAt,
      completedAt: item.completedAt,
      metadata: {
        lessonId: item.lesson.id,
        classId: item.lesson.classId,
        className: item.lesson.class.name,
        subjectId: item.lesson.subjectId,
        subjectName: item.lesson.subject.name,
        teacherName: `${item.lesson.teacher.name} ${item.lesson.teacher.surname}`,
        date: targetDateKey,
        openAt: item.openAt.toISOString(),
        deadlineAt: item.deadlineAt.toISOString(),
        missedAt: item.missedAt.toISOString(),
        studentCount: item.studentCount,
        attendanceCount: item.attendanceCount,
      },
    }));

  if (createData.length > 0) {
    await prisma.teacherObligation.createMany({
      data: createData,
      skipDuplicates: true,
    });
  }

  const updateData = durableUpdates.filter((item) => {
    const existing = existingBySourceKey.get(item.sourceKey);
    if (!existing) return false;

    return (
      existing.status !== item.status ||
      existing.priority !== item.priority ||
      existing.expectedAt.getTime() !== item.deadlineAt.getTime() ||
      (existing.completedAt?.getTime() ?? null) !== (item.completedAt?.getTime() ?? null)
    );
  });

  await Promise.all(
    chunkArray(updateData, 4).map((chunk) =>
      Promise.all(
        chunk.map((item) => {
          const existing = existingBySourceKey.get(item.sourceKey);
          if (!existing) return null;

          return prisma.teacherObligation.update({
            where: { id: existing.id },
            data: {
              status: item.status,
              priority: item.priority,
              title: item.title,
              description: item.description,
              expectedAt: item.deadlineAt,
              completedAt: item.completedAt,
              metadata: {
                lessonId: item.lesson.id,
                classId: item.lesson.classId,
                className: item.lesson.class.name,
                subjectId: item.lesson.subjectId,
                subjectName: item.lesson.subject.name,
                teacherName: `${item.lesson.teacher.name} ${item.lesson.teacher.surname}`,
                date: targetDateKey,
                openAt: item.openAt.toISOString(),
                deadlineAt: item.deadlineAt.toISOString(),
                missedAt: item.missedAt.toISOString(),
                studentCount: item.studentCount,
                attendanceCount: item.attendanceCount,
              },
            },
          });
        }),
      ),
    ),
  );

  const obligations = await prisma.teacherObligation.findMany({
    where: {
      schoolId,
      type: "ATTENDANCE",
      sourceKey: { in: durableUpdates.map((item) => item.sourceKey) },
    },
    select: {
      id: true,
      sourceId: true,
      sourceKey: true,
      status: true,
      expectedAt: true,
      completedAt: true,
    },
  });

  return obligations.map((obligation) => {
    const item = durableUpdates.find((update) => update.sourceKey === obligation.sourceKey);
    return {
      lessonId: Number(obligation.sourceId),
      obligationId: obligation.id,
      status: obligation.status,
      openAt: item?.openAt ?? obligation.expectedAt,
      deadlineAt: obligation.expectedAt,
      missedAt: item?.missedAt ?? obligation.expectedAt,
      expectedAt: obligation.expectedAt,
      completedAt: obligation.completedAt,
      studentCount: item?.studentCount ?? 0,
      attendanceCount: item?.attendanceCount ?? 0,
    };
  });
}
