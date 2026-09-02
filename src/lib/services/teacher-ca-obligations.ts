import prisma from "@/src/lib/prisma";
import type {
  TeacherAccountabilityAuditAction,
  TeacherObligationPriority,
  TeacherObligationStatus,
} from "@/src/generated/prisma";
import { getTeacherAccountabilitySettings } from "@/src/lib/services/teacher-accountability-settings";

type CAObligationSnapshot = {
  activityId: number;
  obligationId: string;
  status: TeacherObligationStatus;
  expectedAt: Date;
  completedAt: Date | null;
  studentCount: number;
  scoreCount: number;
};

type CAActivityForObligation = Awaited<ReturnType<typeof getCAActivityForObligation>>;

function startOfDay(date: Date) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

function addSchoolDays(date: Date, days: number) {
  const value = startOfDay(date);
  let remaining = days;

  while (remaining > 0) {
    value.setDate(value.getDate() + 1);
    const day = value.getDay();
    if (day !== 0 && day !== 6) remaining -= 1;
  }

  return value;
}

function applyTime(date: Date, time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  const value = new Date(date);
  value.setHours(hours || 0, minutes || 0, 0, 0);
  return value;
}

function priorityForStatus(status: TeacherObligationStatus): TeacherObligationPriority {
  if (status === "MISSED" || status === "ESCALATED") return "HIGH";
  return "NORMAL";
}

function auditActionForStatus(
  status: TeacherObligationStatus,
): TeacherAccountabilityAuditAction | null {
  if (status === "COMPLETED") return "OBLIGATION_COMPLETED";
  if (status === "COMPLETED_LATE") return "OBLIGATION_COMPLETED_LATE";
  if (status === "MISSED") return "OBLIGATION_MISSED";
  if (status === "ESCALATED") return "OBLIGATION_ESCALATED";
  if (status === "CANCELLED") return "OBLIGATION_CANCELLED";
  return null;
}

function caActivitySourceKey(activityId: number) {
  return `ca-score-publishing:activity:${activityId}`;
}

async function getCAActivityForObligation(schoolId: string, activityId: number) {
  return prisma.cAActivity.findFirst({
    where: { id: activityId, schoolId },
    include: {
      bucket: { select: { name: true, term: true, academicYear: true } },
      class: {
        select: {
          id: true,
          name: true,
          _count: { select: { students: true } },
        },
      },
      subject: { select: { id: true, name: true } },
      teacher: { select: { id: true, name: true, surname: true } },
      scores: { select: { id: true, updatedAt: true } },
    },
  });
}

function buildCAObligationState({
  activity,
  closeoutTime,
  publishWindowDays,
  reminderAfterDays,
  escalateAfterDays,
  now,
}: {
  activity: NonNullable<CAActivityForObligation>;
  closeoutTime: string;
  publishWindowDays: number;
  reminderAfterDays: number;
  escalateAfterDays: number;
  now: Date;
}) {
  const studentCount = activity.class._count.students;
  const scoreCount = activity.scores.length;
  const latestScoreAt = activity.scores.reduce<Date | null>(
    (latest, score) => (!latest || score.updatedAt > latest ? score.updatedAt : latest),
    null,
  );
  const expectedAt = applyTime(
    addSchoolDays(activity.activityDate, publishWindowDays),
    closeoutTime,
  );
  const reminderAt = applyTime(
    addSchoolDays(activity.activityDate, reminderAfterDays),
    closeoutTime,
  );
  const missedAt = applyTime(
    addSchoolDays(activity.activityDate, escalateAfterDays),
    closeoutTime,
  );
  const completed = studentCount > 0 && scoreCount >= studentCount && Boolean(latestScoreAt);
  const status: TeacherObligationStatus = completed
    ? latestScoreAt! > expectedAt
      ? "COMPLETED_LATE"
      : "COMPLETED"
    : now > missedAt
      ? "MISSED"
      : "PENDING";

  return {
    status,
    priority: priorityForStatus(status),
    expectedAt,
    reminderAt,
    missedAt,
    completedAt: completed ? latestScoreAt : null,
    studentCount,
    scoreCount,
  };
}

export async function syncCAActivityScorePublishingObligation({
  schoolId,
  activityId,
  now = new Date(),
}: {
  schoolId: string;
  activityId: number;
  now?: Date;
}): Promise<CAObligationSnapshot | null> {
  const [settings, activity] = await Promise.all([
    getTeacherAccountabilitySettings(schoolId),
    getCAActivityForObligation(schoolId, activityId),
  ]);
  if (!activity) return null;

  const state = buildCAObligationState({
    activity,
    closeoutTime: settings.teacherCloseoutTime,
    publishWindowDays: settings.caScorePublishWindowSchoolDays,
    reminderAfterDays: settings.caReminderAfterSchoolDays,
    escalateAfterDays: settings.caEscalateAfterSchoolDays,
    now,
  });
  const sourceKey = caActivitySourceKey(activity.id);
  const teacherName = `${activity.teacher.name} ${activity.teacher.surname}`.trim();
  const title = `Publish ${activity.subject.name} scores for ${activity.title}`;
  const description = `${activity.class.name} ${activity.subject.name} scores are expected by ${state.expectedAt.toLocaleDateString("en-GH", { day: "numeric", month: "short" })}.`;
  const metadata = {
    activityId: activity.id,
    activityTitle: activity.title,
    classId: activity.classId,
    className: activity.class.name,
    subjectId: activity.subjectId,
    subjectName: activity.subject.name,
    teacherName,
    bucketName: activity.bucket.name,
    term: activity.bucket.term,
    academicYear: activity.bucket.academicYear,
    activityDate: activity.activityDate.toISOString(),
    reminderAt: state.reminderAt.toISOString(),
    deadlineAt: state.expectedAt.toISOString(),
    missedAt: state.missedAt.toISOString(),
    studentCount: state.studentCount,
    scoreCount: state.scoreCount,
  };

  const existing = await prisma.teacherObligation.findUnique({
    where: {
      schoolId_teacherId_sourceKey: {
        schoolId,
        teacherId: activity.teacherId,
        sourceKey,
      },
    },
    select: {
      id: true,
      status: true,
      priority: true,
      completedAt: true,
      expectedAt: true,
    },
  });

  if (!existing) {
    const obligation = await prisma.teacherObligation.create({
      data: {
        schoolId,
        teacherId: activity.teacherId,
        type: "CA_SCORE_PUBLISHING",
        status: state.status,
        priority: state.priority,
        sourceModel: "CAActivity",
        sourceId: String(activity.id),
        sourceKey,
        title,
        description,
        expectedAt: state.expectedAt,
        completedAt: state.completedAt,
        metadata,
      },
      select: { id: true },
    });

    await prisma.teacherAccountabilityAuditLog.create({
      data: {
        schoolId,
        teacherId: activity.teacherId,
        action: "OBLIGATION_CREATED",
        actorRole: "SYSTEM",
        sourceModel: "TeacherObligation",
        sourceId: obligation.id,
        after: {
          status: state.status,
          priority: state.priority,
          sourceModel: "CAActivity",
          sourceId: String(activity.id),
        },
        message: `${title} accountability obligation created.`,
      },
    });

    return {
      activityId: activity.id,
      obligationId: obligation.id,
      status: state.status,
      expectedAt: state.expectedAt,
      completedAt: state.completedAt,
      studentCount: state.studentCount,
      scoreCount: state.scoreCount,
    };
  }

  const nextStatus =
    existing.status === "ESCALATED" &&
    state.status !== "COMPLETED" &&
    state.status !== "COMPLETED_LATE"
      ? "ESCALATED"
      : state.status;
  const nextPriority = priorityForStatus(nextStatus);
  const statusChanged = existing.status !== nextStatus;

  await prisma.$transaction([
    prisma.teacherObligation.update({
      where: { id: existing.id },
      data: {
        status: nextStatus,
        priority: nextPriority,
        title,
        description,
        expectedAt: state.expectedAt,
        completedAt: state.completedAt,
        metadata,
      },
    }),
    ...(nextStatus === "PENDING"
      ? []
      : [
          prisma.teacherReminder.updateMany({
            where: {
              schoolId,
              obligationId: existing.id,
              status: "PENDING",
            },
            data: {
              status: "SKIPPED",
              errorMessage: `Superseded by obligation status ${nextStatus}.`,
            },
          }),
        ]),
    ...(statusChanged && auditActionForStatus(nextStatus)
      ? [
          prisma.teacherAccountabilityAuditLog.create({
            data: {
              schoolId,
              teacherId: activity.teacherId,
              action: auditActionForStatus(nextStatus)!,
              actorRole: "SYSTEM",
              sourceModel: "TeacherObligation",
              sourceId: existing.id,
              before: {
                status: existing.status,
                priority: existing.priority,
              },
              after: {
                status: nextStatus,
                priority: nextPriority,
                completedAt: state.completedAt?.toISOString() ?? null,
              },
              message: `${title} changed from ${existing.status} to ${nextStatus}.`,
            },
          }),
        ]
      : []),
  ]);

  return {
    activityId: activity.id,
    obligationId: existing.id,
    status: nextStatus,
    expectedAt: state.expectedAt,
    completedAt: state.completedAt,
    studentCount: state.studentCount,
    scoreCount: state.scoreCount,
  };
}

export async function syncCAActivityScorePublishingObligationsForSchool({
  schoolId,
  now = new Date(),
  limit = 200,
}: {
  schoolId: string;
  now?: Date;
  limit?: number;
}) {
  const since = new Date(now);
  since.setDate(since.getDate() - 60);

  const activities = await prisma.cAActivity.findMany({
    where: {
      schoolId,
      activityDate: { gte: since, lte: now },
    },
    select: { id: true },
    orderBy: [{ activityDate: "asc" }, { id: "asc" }],
    take: limit,
  });

  let synced = 0;
  for (const activity of activities) {
    const result = await syncCAActivityScorePublishingObligation({
      schoolId,
      activityId: activity.id,
      now,
    });
    if (result) synced += 1;
  }

  return synced;
}
