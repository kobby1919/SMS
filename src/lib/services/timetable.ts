import prisma from "@/src/lib/prisma";
import { Day } from "@/src/generated/prisma";
import { revalidateDashboard, revalidateReferenceData } from "@/src/lib/cacheTags";
import {
  dateTimeToTimeString,
  formatSchoolDayRange,
  getSchoolOperatingWindowStatus,
  isTimeRangeWithinWindow,
} from "@/src/lib/services/school-operating-hours";

export class TimetableServiceError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 404 | 409,
  ) {
    super(message);
    this.name = "TimetableServiceError";
  }
}
export type TimetableLessonInput = {
  name?: string;
  day: Day;
  startTime: string;
  endTime: string;
  subjectId: number;
  classId: number;
  teacherId: string;
  periodTemplateId?: string | null;
};

const lessonInclude = {
  subject: { select: { id: true, name: true } },
  class: { select: { id: true, name: true } },
  teacher: { select: { id: true, name: true, surname: true } },
  periodTemplate: { select: { id: true, name: true, type: true, startTime: true, endTime: true, order: true } },
} as const;

export function listTimetableLessons(schoolId: string, classId?: number) {
  return prisma.lesson.findMany({
    where: { schoolId, ...(classId ? { classId } : {}) },
    include: lessonInclude,
    orderBy: [{ day: "asc" }, { startTime: "asc" }],
  });
}

export async function listClassSubjectsFromTimetable(
  schoolId: string,
  classIds: number[],
  options: { teacherId?: string } = {},
) {
  if (classIds.length === 0) return new Map<number, Map<number, string>>();

  const lessons = await prisma.lesson.findMany({
    where: {
      schoolId,
      classId: { in: classIds },
      ...(options.teacherId ? { teacherId: options.teacherId } : {}),
    },
    select: {
      classId: true,
      subject: { select: { id: true, name: true } },
    },
    orderBy: { subject: { name: "asc" } },
  });

  const subjectsByClass = new Map<number, Map<number, string>>();
  for (const lesson of lessons) {
    const subjects = subjectsByClass.get(lesson.classId) ?? new Map<number, string>();
    subjects.set(lesson.subject.id, lesson.subject.name);
    subjectsByClass.set(lesson.classId, subjects);
  }

  return subjectsByClass;
}

async function validateLessonInput(
  schoolId: string,
  input: TimetableLessonInput,
  excludeId?: number,
) {
  const start = new Date(input.startTime);
  const end = new Date(input.endTime);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
    throw new TimetableServiceError("End time must be after start time.", 400);
  }

  const operatingRules = await getSchoolOperatingWindowStatus(schoolId);
  if (!operatingRules.activeDays.includes(input.day)) {
    throw new TimetableServiceError(
      `This school operates ${formatSchoolDayRange(operatingRules.activeDays)}. ${input.day.toLowerCase()} is not an active timetable day.`,
      400,
    );
  }

  const lessonStartTime = dateTimeToTimeString(start);
  const lessonEndTime = dateTimeToTimeString(end);
  if (
    !isTimeRangeWithinWindow(
      lessonStartTime,
      lessonEndTime,
      operatingRules.openingTime,
      operatingRules.closingTime,
    )
  ) {
    throw new TimetableServiceError(
      `Lesson time must stay within school hours (${operatingRules.openingTime}-${operatingRules.closingTime}, ${operatingRules.timezone}).`,
      400,
    );
  }

  const baseWhere = {
    schoolId,
    day: input.day,
    NOT: excludeId ? { id: excludeId } : undefined,
    AND: [{ startTime: { lt: end } }, { endTime: { gt: start } }],
  };
  const [classConflict, teacherConflict, subject, cls, teacher, teacherClasses, periodTemplate] =
    await Promise.all([
      prisma.lesson.findFirst({
        where: { ...baseWhere, classId: input.classId },
        select: { subject: { select: { name: true } } },
      }),
      prisma.lesson.findFirst({
        where: { ...baseWhere, teacherId: input.teacherId },
        select: {
          class: { select: { name: true } },
          subject: { select: { name: true } },
        },
      }),
      prisma.subject.findFirst({
        where: { id: input.subjectId, schoolId },
        select: { id: true, name: true },
      }),
      prisma.class.findFirst({
        where: { id: input.classId, schoolId },
        select: { id: true, name: true },
      }),
      prisma.teacher.findFirst({
        where: {
          id: input.teacherId,
          schoolId,
          subjects: { some: { id: input.subjectId, schoolId } },
        },
        select: { id: true, maxClasses: true },
      }),
      prisma.lesson.findMany({
        where: {
          schoolId,
          teacherId: input.teacherId,
          ...(excludeId ? { NOT: { id: excludeId } } : {}),
        },
        select: { classId: true },
        distinct: ["classId"],
      }),
      input.periodTemplateId
        ? prisma.schoolPeriodTemplate.findFirst({
            where: { id: input.periodTemplateId, schoolId },
            select: { id: true, name: true, type: true, isActive: true, startTime: true, endTime: true },
          })
        : Promise.resolve(null),
    ]);

  if (classConflict) {
    throw new TimetableServiceError(
      `Class conflict: This class already has "${classConflict.subject.name}" at that time on ${input.day}.`,
      409,
    );
  }
  if (teacherConflict) {
    throw new TimetableServiceError(
      `Teacher conflict: This teacher already has "${teacherConflict.subject.name}" in ${teacherConflict.class.name} at that time on ${input.day}.`,
      409,
    );
  }
  if (!subject || !cls) {
    throw new TimetableServiceError("Subject or class not found.", 404);
  }
  if (!teacher) {
    throw new TimetableServiceError(
      "Teacher not found or the selected subject is not assigned to this teacher.",
      404,
    );
  }
  if (input.periodTemplateId) {
    if (!periodTemplate) {
      throw new TimetableServiceError("Selected period template was not found.", 404);
    }
    if (!periodTemplate.isActive || periodTemplate.type !== "TEACHING") {
      throw new TimetableServiceError("Only active teaching periods can be used for lessons.", 400);
    }
    if (periodTemplate.startTime !== lessonStartTime || periodTemplate.endTime !== lessonEndTime) {
      throw new TimetableServiceError(
        `Lesson time must match the selected period (${periodTemplate.startTime}-${periodTemplate.endTime}).`,
        400,
      );
    }
  }

  const assignedClassIds = new Set(teacherClasses.map((lesson) => lesson.classId));
  if (!assignedClassIds.has(input.classId) && assignedClassIds.size >= teacher.maxClasses) {
    throw new TimetableServiceError(
      `This teacher is already assigned to ${teacher.maxClasses} classes (maximum reached).`,
      409,
    );
  }

  return { start, end, subject, cls };
}

function invalidateTimetable(schoolId: string) {
  revalidateReferenceData(schoolId, "timetable");
  revalidateDashboard(schoolId);
}

export async function createTimetableLesson(
  schoolId: string,
  input: TimetableLessonInput,
) {
  const { start, end, subject, cls } = await validateLessonInput(schoolId, input);
  const lesson = await prisma.lesson.create({
    data: {
      schoolId,
      name: input.name || `${subject.name} - ${cls.name}`,
      day: input.day,
      startTime: start,
      endTime: end,
      subjectId: input.subjectId,
      classId: input.classId,
      teacherId: input.teacherId,
      periodTemplateId: input.periodTemplateId || null,
    },
    include: lessonInclude,
  });
  invalidateTimetable(schoolId);
  return lesson;
}

export async function updateTimetableLesson(
  schoolId: string,
  id: number,
  input: TimetableLessonInput,
) {
  const existing = await prisma.lesson.findFirst({
    where: { id, schoolId },
    select: { id: true },
  });
  if (!existing) throw new TimetableServiceError("Lesson not found.", 404);

  const { start, end, subject, cls } = await validateLessonInput(schoolId, input, id);
  const lesson = await prisma.lesson.update({
    where: { id },
    data: {
      name: input.name || `${subject.name} - ${cls.name}`,
      day: input.day,
      startTime: start,
      endTime: end,
      subjectId: input.subjectId,
      classId: input.classId,
      teacherId: input.teacherId,
      periodTemplateId: input.periodTemplateId || null,
    },
    include: lessonInclude,
  });
  invalidateTimetable(schoolId);
  return lesson;
}

export async function deleteTimetableLesson(schoolId: string, id: number) {
  const result = await prisma.lesson.deleteMany({ where: { id, schoolId } });
  if (result.count === 0) throw new TimetableServiceError("Lesson not found.", 404);
  invalidateTimetable(schoolId);
}
