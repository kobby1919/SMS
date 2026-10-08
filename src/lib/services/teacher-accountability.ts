import prisma from "@/src/lib/prisma";
import type { Prisma, TeacherObligation, TeacherReminder } from "@/src/generated/prisma";
import { accountabilityTransaction } from "@/src/lib/services/teacher-obligation-store";
import { syncAttendanceObligationsForDate } from "@/src/lib/services/teacher-attendance-obligations";
import { getTeacherAccountabilitySettings } from "@/src/lib/services/teacher-accountability-settings";
import { syncCAActivityScorePublishingObligationsForSchool } from "@/src/lib/services/teacher-ca-obligations";
import { syncHomeworkCheckingObligationsForSchool } from "@/src/lib/services/teacher-homework-obligations";

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
  if (obligation.type === "HOMEWORK_CHECKING") {
    return `Homework checks for ${subject} in ${className} are due. Please close pending submissions before this becomes an escalation.`;
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
  if (obligation.type === "HOMEWORK_CHECKING") {
    return `Homework checks for ${subject} in ${className} were not completed before the escalation deadline.`;
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

function startOfDay(date: Date) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

function endOfDay(date: Date) {
  const value = new Date(date);
  value.setHours(23, 59, 59, 999);
  return value;
}

function startOfWeek(date: Date) {
  const value = startOfDay(date);
  const day = value.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  value.setDate(value.getDate() + mondayOffset);
  return value;
}

async function actionableDuty(tx: Prisma.TransactionClient, candidate: TeacherObligation) {
  const duty = await tx.teacherObligation.findFirst({
    where: { id: candidate.id, schoolId: candidate.schoolId, teacherId: candidate.teacherId,
      updatedAt: candidate.updatedAt, completedAt: null, status: { in: ["PENDING", "MISSED"] },
      teacher: { schoolId: candidate.schoolId, status: "ACTIVE" }, escalations: { none: {} } },
  });
  if (!duty) return null;
  const settle = async (status: "CANCELLED" | "COMPLETED" | "COMPLETED_LATE", reason: string, completedAt?: Date) => {
    const claim = await tx.teacherObligation.updateMany({ where: { id: duty.id, schoolId: duty.schoolId, teacherId: duty.teacherId, updatedAt: duty.updatedAt, completedAt: null, status: { in: ["PENDING", "MISSED"] } }, data: { status, priority: status === "CANCELLED" ? "LOW" : "NORMAL", completedAt: completedAt ?? null } });
    if (claim.count) {
      await tx.teacherReminder.updateMany({ where: { schoolId: duty.schoolId, obligationId: duty.id, status: "PENDING" }, data: { status: "SKIPPED", errorMessage: reason } });
      await tx.teacherAccountabilityAuditLog.create({ data: { schoolId: duty.schoolId, teacherId: duty.teacherId, actorRole: "SYSTEM", action: status === "CANCELLED" ? "OBLIGATION_CANCELLED" : status === "COMPLETED" ? "OBLIGATION_COMPLETED" : "OBLIGATION_COMPLETED_LATE", sourceModel: "TeacherObligation", sourceId: duty.id, before: { status: duty.status }, after: { status, completedAt: completedAt?.toISOString() ?? null }, message: reason } });
    }
    return null;
  };
  if (!/^[1-9]\d*$/.test(duty.sourceId)) return settle("CANCELLED", "Duty has an invalid source identifier.");
  const schoolId = duty.schoolId;
  const sourceId = Number(duty.sourceId);
  let classId: number;
  let date: Date;
  let checked: string[] = [];
  let completedAt: Date | null = null;
  const latest = (dates: Date[]) => dates.reduce<Date | null>((value, date) => !value || date > value ? date : value, null);
  if (duty.type === "ATTENDANCE") {
    const meta = readAttendanceMetadata(duty.metadata);
    if (!meta.date || !/^\d{4}-\d{2}-\d{2}$/.test(meta.date)) return settle("CANCELLED", "Attendance duty has no valid school date.");
    date = new Date(meta.date + "T00:00:00.000Z");
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== meta.date) return settle("CANCELLED", "Attendance duty has no valid school date.");
    const lesson = await tx.publishedTimetableLesson.findFirst({ where: { schoolId, sourceId, teacherId: duty.teacherId, publication: { schoolId, status: "ACTIVE" } }, include: { publication: { select: { publishedAt: true } } } });
    const operating = await tx.schoolNotificationSetting.findUnique({ where: { schoolId }, select: { activeDays: true } });
    const day = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"][date.getUTCDay()];
    const activeDays = operating?.activeDays.length ? operating.activeDays : ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"];
    if (!lesson || lesson.day !== day || !activeDays.includes(day)) return settle("CANCELLED", "Attendance duty is outside the current published school-day scope.");
    const start = startOfDay(date); start.setHours(lesson.startTime.getHours(), lesson.startTime.getMinutes(), 0, 0);
    if (lesson.publication.publishedAt > start) return settle("CANCELLED", "Timetable publication followed this lesson date.");
    classId = lesson.classId;
    const rows = await tx.attendance.findMany({ where: { schoolId, lessonId: sourceId, date: { gte: startOfDay(date), lte: endOfDay(date) }, student: { schoolId, classId, status: "ACTIVE", createdAt: { lte: endOfDay(date) } } }, select: { studentId: true, updatedAt: true } });
    checked = rows.map((row) => row.studentId); completedAt = latest(rows.map((row) => row.updatedAt));
  } else if (duty.type === "HOMEWORK_CHECKING") {
    const assignment = await tx.assignment.findFirst({ where: { id: sourceId, schoolId, lesson: { schoolId, teacherId: duty.teacherId, class: { schoolId }, subject: { schoolId } } }, include: { lesson: true, homeworkSubmissions: { where: { schoolId, status: { not: "PENDING" }, checkedAt: { not: null }, student: { schoolId, status: "ACTIVE" } }, select: { studentId: true, checkedAt: true } } } });
    if (!assignment) return settle("CANCELLED", "Homework source is no longer available within this teacher's school scope.");
    const published = await tx.publishedTimetableLesson.findFirst({ where: { schoolId, sourceId: assignment.lessonId, teacherId: duty.teacherId, classId: assignment.lesson.classId, subjectId: assignment.lesson.subjectId, publication: { schoolId, status: "ACTIVE" } }, select: { id: true } });
    if (!published) return settle("CANCELLED", "Homework duty is outside the current published teaching scope.");
    classId = assignment.lesson.classId; date = assignment.dueDate;
    checked = assignment.homeworkSubmissions.map((row) => row.studentId);
    completedAt = latest(assignment.homeworkSubmissions.flatMap((row) => row.checkedAt ? [row.checkedAt] : []));
  } else if (duty.type === "CA_SCORE_PUBLISHING") {
    const config = await tx.cAConfig.findFirst({ where: { schoolId, isActive: true }, orderBy: [{ updatedAt: "desc" }, { id: "desc" }], select: { academicYear: true, currentTerm: true } });
    if (!config) return null;
    const activity = await tx.cAActivity.findFirst({ where: { schoolId, id: sourceId, teacherId: duty.teacherId, class: { schoolId }, subject: { schoolId }, bucket: { schoolId, academicYear: config.academicYear, term: config.currentTerm } }, include: { bucket: true, scores: { where: { schoolId, student: { schoolId, status: "ACTIVE" } }, select: { studentId: true, updatedAt: true } } } });
    if (!activity || activity.bucket.classId !== activity.classId || activity.bucket.subjectId !== activity.subjectId) return settle("CANCELLED", "CA duty is outside the active academic period or has an invalid bucket scope.");
    const published = await tx.publishedTimetableLesson.findFirst({ where: { schoolId, teacherId: duty.teacherId, classId: activity.classId, subjectId: activity.subjectId, publication: { schoolId, status: "ACTIVE" } }, select: { id: true } });
    if (!published) return settle("CANCELLED", "CA duty is outside the current published teaching scope.");
    classId = activity.classId; date = activity.activityDate;
    checked = activity.scores.map((row) => row.studentId);
    completedAt = latest(activity.scores.map((row) => row.updatedAt));
  } else return null;
  const students = await tx.student.findMany({ where: { schoolId, classId, status: "ACTIVE", createdAt: { lte: endOfDay(date) }, class: { schoolId } }, select: { id: true } });
  const checkedIds = new Set(checked);
  if (!students.length) return settle("CANCELLED", "No eligible active students remain for this duty.");
  if (students.every((student) => checkedIds.has(student.id))) {
    return completedAt ? settle(completedAt > duty.expectedAt ? "COMPLETED_LATE" : "COMPLETED", "Source records confirm that this duty is complete.", completedAt) : null;
  }
  return duty;
}

async function queueReminderIfNeeded({ obligation, now }: { obligation: TeacherObligation; now: Date }): Promise<TeacherReminder | null> {
  return accountabilityTransaction(async (tx) => {
    const current = await actionableDuty(tx, obligation);
    if (!current || reminderAtForObligation(current) > now) return null;
    const reminderAt = reminderAtForObligation(current);
    const dedupeKey = `${current.type.toLowerCase()}-reminder:${current.id}:${reminderAt.toISOString().slice(0, 16)}`;
    const result = await tx.teacherReminder.createMany({ data: [{
      schoolId: current.schoolId, teacherId: current.teacherId, obligationId: current.id,
      channel: "IN_APP", dedupeKey, message: reminderMessage(current), scheduledAt: now, status: "PENDING",
    }], skipDuplicates: true });
    if (!result.count) return null;
    const reminder = await tx.teacherReminder.findUniqueOrThrow({ where: { schoolId_dedupeKey: { schoolId: current.schoolId, dedupeKey } } });
    await tx.teacherAccountabilityAuditLog.create({ data: {
      schoolId: current.schoolId, teacherId: current.teacherId, action: "REMINDER_QUEUED", actorRole: "SYSTEM",
      sourceModel: "TeacherObligation", sourceId: current.id,
      after: { reminderId: reminder.id, status: reminder.status }, message: reminder.message,
    } });
    return reminder;
  });
}

async function escalateIfNeeded({ obligation, now }: { obligation: TeacherObligation; now: Date }) {
  if (missedAtForObligation(obligation) >= now) return false;
  return accountabilityTransaction(async (tx) => {
    const current = await actionableDuty(tx, obligation);
    if (!current || missedAtForObligation(current) >= now) return false;
    const claim = await tx.teacherObligation.updateMany({
      where: { id: current.id, schoolId: current.schoolId, teacherId: current.teacherId,
        updatedAt: current.updatedAt, completedAt: null, status: { in: ["PENDING", "MISSED"] } },
      data: { status: "ESCALATED", priority: "HIGH" },
    });
    if (!claim.count) return false;
    await tx.teacherEscalation.create({ data: { schoolId: current.schoolId, teacherId: current.teacherId, obligationId: current.id, reason: escalationReason(current), status: "OPEN" } });
    await tx.teacherReminder.updateMany({ where: { schoolId: current.schoolId, obligationId: current.id, status: "PENDING" }, data: { status: "SKIPPED" } });
    await tx.teacherAccountabilityAuditLog.create({ data: {
      schoolId: current.schoolId, teacherId: current.teacherId, action: "ESCALATION_CREATED", actorRole: "SYSTEM",
      sourceModel: "TeacherObligation", sourceId: current.id,
      before: { status: current.status, priority: current.priority },
      after: { status: "ESCALATED", priority: "HIGH" }, message: escalationReason(current),
    } });
    return true;
  });
}

export async function processTeacherWeekEscalationCatchup({
  schoolId,
  teacherId,
  now = new Date(),
  limit = 200,
}: {
  schoolId: string;
  teacherId: string;
  now?: Date;
  limit?: number;
}) {
  const settings = await getTeacherAccountabilitySettings(schoolId);
  if (!settings.escalationsEnabled) {
    return { checkedObligations: 0, escalationsCreated: 0, skipped: 0 };
  }

  const obligations = await prisma.teacherObligation.findMany({
    where: {
      schoolId,
      teacherId,
      type: { in: ["ATTENDANCE", "CA_SCORE_PUBLISHING", "HOMEWORK_CHECKING"] },
      status: { in: ["PENDING", "MISSED"] },
      completedAt: null,
      teacher: { schoolId, status: "ACTIVE" },
      escalations: { none: {} },
      expectedAt: {
        gte: startOfWeek(now),
        lte: endOfDay(now),
      },
    },
    orderBy: [{ expectedAt: "asc" }, { createdAt: "asc" }],
    take: limit,
  });

  let escalationsCreated = 0;
  let skipped = 0;

  for (const obligation of obligations) {
    if (missedAtForObligation(obligation) > now) {
      skipped += 1;
      continue;
    }

    const escalated = await escalateIfNeeded({ obligation, now });
    if (escalated) {
      escalationsCreated += 1;
    } else {
      skipped += 1;
    }
  }

  return {
    checkedObligations: obligations.length,
    escalationsCreated,
    skipped,
  };
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
  const [
    syncedAttendanceObligations,
    syncedCAObligations,
    syncedHomeworkObligations,
  ] = await Promise.all([
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
    syncHomeworkCheckingObligationsForSchool({
      schoolId,
      now,
      limit,
    }),
  ]);

  const [escalationCandidates, reminderCandidates] = await Promise.all([
    prisma.teacherObligation.findMany({
      where: {
        schoolId,
        type: { in: ["ATTENDANCE", "CA_SCORE_PUBLISHING", "HOMEWORK_CHECKING"] },
        status: { in: ["PENDING", "MISSED"] },
        completedAt: null,
        teacher: { schoolId, status: "ACTIVE" },
        escalations: { none: {} },
        expectedAt: { lte: endOfDay(now) },
      },
      orderBy: [{ expectedAt: "asc" }, { createdAt: "asc" }],
      take: limit,
    }),
    prisma.teacherObligation.findMany({
      where: {
        schoolId,
        type: { in: ["ATTENDANCE", "CA_SCORE_PUBLISHING", "HOMEWORK_CHECKING"] },
        status: { in: ["PENDING", "MISSED"] },
        completedAt: null,
        teacher: { schoolId, status: "ACTIVE" },
        escalations: { none: {} },
      },
      orderBy: [{ expectedAt: "asc" }, { createdAt: "asc" }],
      take: limit,
    }),
  ]);
  const obligations = [
    ...new Map(
      [...escalationCandidates, ...reminderCandidates].map((obligation) => [
        obligation.id,
        obligation,
      ]),
    ).values(),
  ].slice(0, limit);

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
  }

  return {
    schoolId,
    syncedObligations:
      syncedAttendanceObligations.length + syncedCAObligations + syncedHomeworkObligations,
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
