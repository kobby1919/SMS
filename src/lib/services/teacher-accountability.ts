import prisma from "@/src/lib/prisma";
import type { TeacherObligation, TeacherReminder } from "@/src/generated/prisma";
import { syncAttendanceObligationsForDate } from "@/src/lib/services/teacher-attendance-obligations";
import { getTeacherAccountabilitySettings } from "@/src/lib/services/teacher-accountability-settings";
import { syncCAActivityScorePublishingObligationsForSchool } from "@/src/lib/services/teacher-ca-obligations";

type AttendanceMetadata = {
  className?: string;
  subjectName?: string;
  date?: string;
  deadlineAt?: string;
  reminderAt?: string;
  missedAt?: string;
};

export type TeacherAccountabilityWorkerResult = {
  schoolId: string;
  syncedObligations: number;
  checkedObligations: number;
  remindersQueued: number;
  escalationsCreated: number;
  skipped: number;
};

function readAttendanceMetadata(metadata: TeacherObligation["metadata"]): AttendanceMetadata {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return {};
  return metadata as AttendanceMetadata;
}

function parseMetadataDate(value: unknown) {
  if (typeof value !== "string") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function reminderMessage(obligation: TeacherObligation) {
  const metadata = readAttendanceMetadata(obligation.metadata);
  const subject = metadata.subjectName ?? "this lesson";
  const className = metadata.className ?? "your class";
  if (obligation.type === "CA_SCORE_PUBLISHING") {
    return `CA scores for ${subject} in ${className} are due. Please publish the full class scores before this becomes an escalation.`;
  }
  return `Attendance for ${subject} in ${className} is due. Please submit it before it becomes an escalation.`;
}

function escalationReason(obligation: TeacherObligation) {
  const metadata = readAttendanceMetadata(obligation.metadata);
  const subject = metadata.subjectName ?? "this lesson";
  const className = metadata.className ?? "the class";
  if (obligation.type === "CA_SCORE_PUBLISHING") {
    return `CA scores for ${subject} in ${className} were not published before the escalation deadline.`;
  }
  return `Attendance for ${subject} in ${className} was not submitted before the missed deadline.`;
}

function reminderAtForObligation(obligation: TeacherObligation) {
  const metadata = readAttendanceMetadata(obligation.metadata);
  return parseMetadataDate(metadata.reminderAt) ?? obligation.expectedAt;
}

function missedAtForObligation(obligation: TeacherObligation) {
  const metadata = readAttendanceMetadata(obligation.metadata);
  return parseMetadataDate(metadata.missedAt) ?? obligation.expectedAt;
}

async function queueReminderIfNeeded({
  obligation,
  now,
}: {
  obligation: TeacherObligation;
  now: Date;
}): Promise<TeacherReminder | null> {
  const dedupeKey = `${obligation.type.toLowerCase()}-reminder:${obligation.id}`;
  const existing = await prisma.teacherReminder.findUnique({
    where: {
      schoolId_dedupeKey: {
        schoolId: obligation.schoolId,
        dedupeKey,
      },
    },
  });

  if (existing) return null;

  return prisma.teacherReminder.create({
    data: {
      schoolId: obligation.schoolId,
      teacherId: obligation.teacherId,
      obligationId: obligation.id,
      channel: "IN_APP",
      dedupeKey,
      message: reminderMessage(obligation),
      scheduledAt: now,
      status: "PENDING",
    },
  });
}

async function escalateIfNeeded({
  obligation,
  now,
}: {
  obligation: TeacherObligation;
  now: Date;
}) {
  const missedAt = missedAtForObligation(obligation);
  if (missedAt > now) return false;

  const existing = await prisma.teacherEscalation.findUnique({
    where: {
      schoolId_obligationId: {
        schoolId: obligation.schoolId,
        obligationId: obligation.id,
      },
    },
  });
  if (existing) return false;

  await prisma.$transaction([
    prisma.teacherEscalation.create({
      data: {
        schoolId: obligation.schoolId,
        teacherId: obligation.teacherId,
        obligationId: obligation.id,
        reason: escalationReason(obligation),
        status: "OPEN",
      },
    }),
    prisma.teacherObligation.update({
      where: { id: obligation.id },
      data: {
        status: "ESCALATED",
        priority: "HIGH",
      },
    }),
    prisma.teacherReminder.updateMany({
      where: {
        schoolId: obligation.schoolId,
        obligationId: obligation.id,
        status: "PENDING",
      },
      data: { status: "SKIPPED" },
    }),
    prisma.teacherAccountabilityAuditLog.create({
      data: {
        schoolId: obligation.schoolId,
        teacherId: obligation.teacherId,
        action: "ESCALATION_CREATED",
        actorRole: "SYSTEM",
        sourceModel: "TeacherObligation",
        sourceId: obligation.id,
        before: {
          status: obligation.status,
          priority: obligation.priority,
        },
        after: {
          status: "ESCALATED",
          priority: "HIGH",
        },
        message: escalationReason(obligation),
      },
    }),
  ]);

  return true;
}

export async function processAttendanceAccountabilityForSchool({
  schoolId,
  now = new Date(),
  limit = 200,
}: {
  schoolId: string;
  now?: Date;
  limit?: number;
}): Promise<TeacherAccountabilityWorkerResult> {
  const settings = await getTeacherAccountabilitySettings(schoolId);
  const [syncedAttendanceObligations, syncedCAObligations] = await Promise.all([
    syncAttendanceObligationsForDate({
      schoolId,
      date: now,
      now,
    }),
    syncCAActivityScorePublishingObligationsForSchool({
      schoolId,
      now,
      limit,
    }),
  ]);

  const obligations = await prisma.teacherObligation.findMany({
    where: {
      schoolId,
      type: { in: ["ATTENDANCE", "CA_SCORE_PUBLISHING"] },
      status: { in: ["PENDING", "MISSED"] },
    },
    orderBy: [{ expectedAt: "asc" }, { createdAt: "asc" }],
    take: limit,
  });

  let remindersQueued = 0;
  let escalationsCreated = 0;
  let skipped = 0;

  for (const obligation of obligations) {
    if (settings.escalationsEnabled && missedAtForObligation(obligation) <= now) {
      const escalated = await escalateIfNeeded({ obligation, now });
      if (escalated) {
        escalationsCreated += 1;
      } else {
        skipped += 1;
      }
      continue;
    }

    if (!settings.remindersEnabled) {
      skipped += 1;
      continue;
    }

    if (reminderAtForObligation(obligation) > now) {
      skipped += 1;
      continue;
    }

    const reminder = await queueReminderIfNeeded({ obligation, now });
    if (!reminder) {
      skipped += 1;
      continue;
    }

    remindersQueued += 1;
    await prisma.teacherAccountabilityAuditLog.create({
      data: {
        schoolId: obligation.schoolId,
        teacherId: obligation.teacherId,
        action: "REMINDER_QUEUED",
        actorRole: "SYSTEM",
        sourceModel: "TeacherObligation",
        sourceId: obligation.id,
        after: {
          reminderId: reminder.id,
          status: reminder.status,
        },
        message: reminder.message,
      },
    });
  }

  return {
    schoolId,
    syncedObligations: syncedAttendanceObligations.length + syncedCAObligations,
    checkedObligations: obligations.length,
    remindersQueued,
    escalationsCreated,
    skipped,
  };
}

export async function runTeacherAccountabilityWorker({
  schoolId,
  now = new Date(),
  limit = 200,
}: {
  schoolId?: string;
  now?: Date;
  limit?: number;
} = {}) {
  const schools = await prisma.school.findMany({
    where: schoolId ? { id: schoolId } : undefined,
    select: { id: true },
    orderBy: { id: "asc" },
  });

  const results: TeacherAccountabilityWorkerResult[] = [];
  for (const school of schools) {
    results.push(
      await processAttendanceAccountabilityForSchool({
        schoolId: school.id,
        now,
        limit,
      }),
    );
  }

  return {
    processedSchools: results.length,
    results,
  };
}
