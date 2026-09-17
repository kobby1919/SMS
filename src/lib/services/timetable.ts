import prisma from "@/src/lib/prisma";
import { Day } from "@/src/generated/prisma";
import { revalidateDashboard, revalidateReferenceData } from "@/src/lib/cacheTags";
import {
  dateTimeToTimeString,
  formatSchoolDayRange,
  getSchoolOperatingWindowStatus,
  isTimeRangeWithinWindow,
} from "@/src/lib/services/school-operating-hours";
import { getTimetableHealthSummary } from "@/src/lib/services/timetable-health";

export class TimetableServiceError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 404 | 409,
  ) {
    super(message);
    this.name = "TimetableServiceError";
  }
}

export type TimetablePublicationSummary = {
  id: string;
  version: number;
  status: "ACTIVE" | "ARCHIVED";
  reason: string | null;
  publishedBy: string;
  publishedAt: Date;
  lessonCount: number;
} | null;
export type TimetableLessonInput = {
  name?: string;
  day: Day;
  startTime: string;
  endTime: string;
  subjectId: number;
  classId: number;
  teacherId: string;
  periodTemplateId: string;
};

export type LiveTimetableLesson = {
  id: number;
  name: string;
  day: Day;
  startTime: Date;
  endTime: Date;
  subjectId: number;
  classId: number;
  teacherId: string;
  subject: { id: number; name: string };
  class: { id: number; name: string };
  teacher: { id: string; name: string; surname: string };
  periodTemplate: null | {
    id: string;
    name: string;
    type: string;
    startTime: string;
    endTime: string;
    order: number;
  };
};

const lessonInclude = {
  subject: { select: { id: true, name: true } },
  class: { select: { id: true, name: true } },
  teacher: { select: { id: true, name: true, surname: true } },
  periodTemplate: { select: { id: true, name: true, type: true, startTime: true, endTime: true, order: true } },
} as const;

const publicationSelect = {
  id: true,
  version: true,
  status: true,
  reason: true,
  publishedBy: true,
  publishedAt: true,
  _count: { select: { lessons: true } },
} as const;

export function listTimetableLessons(schoolId: string, classId?: number) {
  return prisma.lesson.findMany({
    where: { schoolId, ...(classId ? { classId } : {}) },
    include: lessonInclude,
    orderBy: [{ day: "asc" }, { startTime: "asc" }],
  });
}

function mapPublishedLessonToLiveLesson(lesson: {
  sourceId: number;
  name: string;
  day: Day;
  startTime: Date;
  endTime: Date;
  subjectId: number;
  subjectName: string;
  classId: number;
  className: string;
  teacherId: string;
  teacherName: string;
  periodTemplateId: string | null;
  periodTemplateName: string | null;
  periodTemplateType: string | null;
  periodStartTime: string | null;
  periodEndTime: string | null;
  periodOrder: number | null;
}): LiveTimetableLesson {
  return {
    id: lesson.sourceId,
    name: lesson.name,
    day: lesson.day,
    startTime: lesson.startTime,
    endTime: lesson.endTime,
    subjectId: lesson.subjectId,
    classId: lesson.classId,
    teacherId: lesson.teacherId,
    subject: { id: lesson.subjectId, name: lesson.subjectName },
    class: { id: lesson.classId, name: lesson.className },
    teacher: { id: lesson.teacherId, name: lesson.teacherName, surname: "" },
    periodTemplate: lesson.periodTemplateId
      ? {
          id: lesson.periodTemplateId,
          name: lesson.periodTemplateName ?? "Published period",
          type: lesson.periodTemplateType ?? "TEACHING",
          startTime: lesson.periodStartTime ?? "",
          endTime: lesson.periodEndTime ?? "",
          order: lesson.periodOrder ?? 0,
        }
      : null,
  };
}

export async function listLiveTimetableLessons(
  schoolId: string,
  filters: { classId?: number; teacherId?: string; day?: Day } = {},
) {
  const rows = await prisma.publishedTimetableLesson.findMany({
    where: {
      schoolId,
      publication: { status: "ACTIVE" },
      ...(filters.classId ? { classId: filters.classId } : {}),
      ...(filters.teacherId ? { teacherId: filters.teacherId } : {}),
      ...(filters.day ? { day: filters.day } : {}),
    },
    orderBy: [
      { day: "asc" },
      { startTime: "asc" },
      { periodOrder: "asc" },
      { sourceId: "asc" },
    ],
  });

  return rows.map(mapPublishedLessonToLiveLesson);
}

export async function getLiveTimetableLessonBySourceId(
  schoolId: string,
  lessonId: number,
) {
  const lesson = await prisma.publishedTimetableLesson.findFirst({
    where: {
      schoolId,
      sourceId: lessonId,
      publication: { status: "ACTIVE" },
    },
  });

  return lesson ? mapPublishedLessonToLiveLesson(lesson) : null;
}

export async function getActiveTimetablePublication(
  schoolId: string,
): Promise<TimetablePublicationSummary> {
  const publication = await prisma.timetablePublication.findFirst({
    where: { schoolId, status: "ACTIVE" },
    select: publicationSelect,
    orderBy: { publishedAt: "desc" },
  });

  if (!publication) return null;

  return {
    id: publication.id,
    version: publication.version,
    status: publication.status,
    reason: publication.reason,
    publishedBy: publication.publishedBy,
    publishedAt: publication.publishedAt,
    lessonCount: publication._count.lessons,
  };
}

export async function listClassSubjectsFromTimetable(
  schoolId: string,
  classIds: number[],
  options: { teacherId?: string } = {},
) {
  if (classIds.length === 0) return new Map<number, Map<number, string>>();

  const lessons = await listLiveTimetableLessons(schoolId, options.teacherId ? { teacherId: options.teacherId } : {});

  const subjectsByClass = new Map<number, Map<number, string>>();
  for (const lesson of lessons.filter((item) => classIds.includes(item.classId))) {
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

  if (!input.periodTemplateId) {
    throw new TimetableServiceError(
      "Select a teaching period before saving this lesson.",
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
          status: "ACTIVE",
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
      prisma.schoolPeriodTemplate.findFirst({
        where: { id: input.periodTemplateId, schoolId },
        select: { id: true, name: true, type: true, isActive: true, startTime: true, endTime: true },
      }),
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
      periodTemplateId: input.periodTemplateId,
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
      periodTemplateId: input.periodTemplateId,
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

export async function publishTimetableDraft(
  schoolId: string,
  publishedBy: string,
  reason?: string,
) {
  const [health, lessons, lastPublication] = await Promise.all([
    getTimetableHealthSummary(schoolId),
    prisma.lesson.findMany({
      where: { schoolId },
      include: lessonInclude,
      orderBy: [{ day: "asc" }, { startTime: "asc" }],
    }),
    prisma.timetablePublication.findFirst({
      where: { schoolId },
      select: { version: true },
      orderBy: { version: "desc" },
    }),
  ]);

  if (lessons.length === 0) {
    throw new TimetableServiceError("Add lessons before publishing the timetable.", 400);
  }

  if (health.criticalCount > 0) {
    throw new TimetableServiceError(
      `Resolve ${health.criticalCount} critical timetable issue${health.criticalCount === 1 ? "" : "s"} before publishing.`,
      409,
    );
  }

  const version = (lastPublication?.version ?? 0) + 1;
  const trimmedReason = reason?.trim() || null;

  const publication = await prisma.$transaction(async (tx) => {
    await tx.timetablePublication.updateMany({
      where: { schoolId, status: "ACTIVE" },
      data: { status: "ARCHIVED", archivedAt: new Date() },
    });

    const created = await tx.timetablePublication.create({
      data: {
        schoolId,
        version,
        publishedBy,
        reason: trimmedReason,
        lessons: {
          createMany: {
            data: lessons.map((lesson) => ({
              schoolId,
              sourceId: lesson.id,
              name: lesson.name,
              day: lesson.day,
              startTime: lesson.startTime,
              endTime: lesson.endTime,
              subjectId: lesson.subject.id,
              subjectName: lesson.subject.name,
              classId: lesson.class.id,
              className: lesson.class.name,
              teacherId: lesson.teacher.id,
              teacherName: `${lesson.teacher.name} ${lesson.teacher.surname}`.trim(),
              periodTemplateId: lesson.periodTemplate?.id ?? null,
              periodTemplateName: lesson.periodTemplate?.name ?? null,
              periodTemplateType: lesson.periodTemplate?.type ?? null,
              periodStartTime: lesson.periodTemplate?.startTime ?? null,
              periodEndTime: lesson.periodTemplate?.endTime ?? null,
              periodOrder: lesson.periodTemplate?.order ?? null,
            })),
          },
        },
      },
      select: publicationSelect,
    });

    return created;
  });

  invalidateTimetable(schoolId);

  return {
    id: publication.id,
    version: publication.version,
    status: publication.status,
    reason: publication.reason,
    publishedBy: publication.publishedBy,
    publishedAt: publication.publishedAt,
    lessonCount: publication._count.lessons,
  };
}

