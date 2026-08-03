import prisma from "@/src/lib/prisma";
import type { ParentNotificationType } from "@/src/generated/prisma";
import { rebuildParentDailySummary } from "@/src/lib/services/parent-daily-summary";

type ActivityEventInput = {
  schoolId: string;
  studentIds?: string[];
  classId?: number | null;
  teacherId?: string | null;
  type: ParentNotificationType;
  title: string;
  body: string;
  href?: string;
  sourceModel: string;
  sourceId: string;
  sourceKey: string;
  occurredAt?: Date;
  payload?: Record<string, unknown>;
};

export async function recordParentActivityEvents(input: ActivityEventInput) {
  const students = await prisma.student.findMany({
    where: {
      schoolId: input.schoolId,
      ...(input.studentIds?.length ? { id: { in: input.studentIds } } : {}),
      ...(!input.studentIds?.length && input.classId ? { classId: input.classId } : {}),
    },
    select: {
      id: true,
      parentId: true,
      name: true,
      surname: true,
    },
  });

  const occurredAt = input.occurredAt ?? new Date();
  const events = students
    .filter((student) => Boolean(student.parentId))
    .map((student) => ({
      schoolId: input.schoolId,
      parentId: student.parentId,
      studentId: student.id,
      teacherId: input.teacherId ?? null,
      type: input.type,
      title: input.title,
      body: input.body,
      href: input.href,
      payload: {
        ...(input.payload ?? {}),
        studentName: `${student.name} ${student.surname}`,
      },
      sourceModel: input.sourceModel,
      sourceId: input.sourceId,
      sourceKey: `${input.sourceKey}:${student.id}`,
      occurredAt,
    }));

  if (events.length === 0) return [];

  await Promise.all(
    events.map((event) =>
      prisma.parentActivityEvent.upsert({
        where: {
          schoolId_parentId_sourceKey: {
            schoolId: event.schoolId,
            parentId: event.parentId,
            sourceKey: event.sourceKey,
          },
        },
        create: event,
        update: {
          studentId: event.studentId,
          teacherId: event.teacherId,
          type: event.type,
          title: event.title,
          body: event.body,
          href: event.href,
          payload: event.payload,
          sourceModel: event.sourceModel,
          sourceId: event.sourceId,
          occurredAt: event.occurredAt,
        },
      }),
    ),
  );

  const uniqueParentIds = [...new Set(events.map((event) => event.parentId))];
  await Promise.all(
    uniqueParentIds.map((parentId) =>
      rebuildParentDailySummary({
        schoolId: input.schoolId,
        parentId,
        date: occurredAt,
      }),
    ),
  );

  return events;
}
