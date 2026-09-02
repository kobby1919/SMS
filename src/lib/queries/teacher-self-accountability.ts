import prisma from "@/src/lib/prisma";
import type {
  TeacherAccountabilityAuditAction,
  TeacherObligationPriority,
  TeacherObligationStatus,
} from "@/src/generated/prisma";
import {
  effectiveObligationPriority,
  effectiveObligationStatus,
  isAccountabilityIssue,
} from "@/src/lib/queries/teacher-accountability-status";

type ObligationMetadata = {
  className?: string;
  subjectName?: string;
  attendanceCount?: number;
  studentCount?: number;
};

export type TeacherSelfAccountabilityOverview = {
  totals: {
    today: number;
    pending: number;
    completed: number;
    completedLate: number;
    missed: number;
    escalated: number;
    openEscalations: number;
    pendingReminders: number;
    reliabilityScore: number;
  };
  todayDuties: TeacherDutyRow[];
  weeklyIssues: TeacherDutyRow[];
  reminders: TeacherReminderRow[];
  escalations: TeacherEscalationRow[];
  auditTrail: TeacherAuditRow[];
};

export type TeacherDutyRow = {
  id: string;
  title: string;
  status: TeacherObligationStatus;
  priority: TeacherObligationPriority;
  expectedAt: Date;
  completedAt: Date | null;
  className: string | null;
  subjectName: string | null;
  attendanceCount: number | null;
  studentCount: number | null;
  actionHref: string;
};

export type TeacherReminderRow = {
  id: string;
  message: string;
  status: string;
  scheduledAt: Date | null;
  createdAt: Date;
  obligationTitle: string;
};

export type TeacherEscalationRow = {
  id: string;
  reason: string;
  status: string;
  escalatedAt: Date;
  obligationTitle: string;
};

export type TeacherAuditRow = {
  id: string;
  action: TeacherAccountabilityAuditAction;
  message: string | null;
  createdAt: Date;
};

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

function readMetadata(metadata: unknown): ObligationMetadata {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return {};
  }
  return metadata as ObligationMetadata;
}

function actionHref(sourceModel: string, sourceId: string) {
  if (sourceModel === "Lesson") {
    return `/list/attendance/take?lessonId=${sourceId}`;
  }
  if (sourceModel === "CAActivity") return "/list/ca";
  if (sourceModel === "Assignment") return "/list/assignments";
  if (sourceModel === "Syllabus") return `/list/syllabus/${sourceId}`;
  return "/teacher/accountability";
}

function toDutyRow(obligation: {
  id: string;
  title: string;
  status: TeacherObligationStatus;
  priority: TeacherObligationPriority;
  expectedAt: Date;
  completedAt: Date | null;
  sourceModel: string;
  sourceId: string;
  metadata: unknown;
}, now: Date): TeacherDutyRow {
  const metadata = readMetadata(obligation.metadata);
  const status = effectiveObligationStatus(obligation, now);
  return {
    id: obligation.id,
    title: obligation.title,
    status,
    priority: effectiveObligationPriority(status, obligation.priority),
    expectedAt: obligation.expectedAt,
    completedAt: obligation.completedAt,
    className: metadata.className ?? null,
    subjectName: metadata.subjectName ?? null,
    attendanceCount:
      typeof metadata.attendanceCount === "number" ? metadata.attendanceCount : null,
    studentCount:
      typeof metadata.studentCount === "number" ? metadata.studentCount : null,
    actionHref: actionHref(obligation.sourceModel, obligation.sourceId),
  };
}

export async function getTeacherSelfAccountabilityOverview({
  schoolId,
  teacherId,
  now = new Date(),
}: {
  schoolId: string;
  teacherId: string;
  now?: Date;
}): Promise<TeacherSelfAccountabilityOverview> {
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const weekStart = startOfWeek(now);

  const [
    todayDuties,
    weeklyIssueDuties,
    weeklyStatusGroups,
    openEscalations,
    pendingReminders,
    reminders,
    auditTrail,
  ] = await Promise.all([
    prisma.teacherObligation.findMany({
      where: {
        schoolId,
        teacherId,
        expectedAt: { gte: todayStart, lte: todayEnd },
      },
      orderBy: [{ expectedAt: "asc" }, { createdAt: "asc" }],
      take: 40,
    }),
    prisma.teacherObligation.findMany({
      where: {
        schoolId,
        teacherId,
        expectedAt: { gte: weekStart, lte: todayEnd },
      },
      orderBy: [{ priority: "desc" }, { expectedAt: "desc" }],
      take: 120,
    }),
    prisma.teacherObligation.findMany({
      where: {
        schoolId,
        teacherId,
        expectedAt: { gte: weekStart, lte: todayEnd },
      },
      select: {
        id: true,
        status: true,
        priority: true,
        expectedAt: true,
        completedAt: true,
        metadata: true,
      },
      orderBy: [{ expectedAt: "asc" }],
      take: 500,
    }),
    prisma.teacherEscalation.findMany({
      where: {
        schoolId,
        teacherId,
        status: { in: ["OPEN", "ACKNOWLEDGED"] },
        obligation: {
          expectedAt: { gte: weekStart, lte: todayEnd },
        },
      },
      include: {
        obligation: { select: { title: true } },
      },
      orderBy: [{ escalatedAt: "desc" }],
      take: 10,
    }),
    prisma.teacherReminder.count({
      where: {
        schoolId,
        teacherId,
        status: "PENDING",
        obligation: {
          expectedAt: { gte: todayStart, lte: todayEnd },
        },
      },
    }),
    prisma.teacherReminder.findMany({
      where: {
        schoolId,
        teacherId,
        status: { in: ["PENDING", "FAILED"] },
        obligation: {
          expectedAt: { gte: todayStart, lte: todayEnd },
        },
      },
      include: {
        obligation: { select: { title: true } },
      },
      orderBy: [{ createdAt: "desc" }],
      take: 8,
    }),
    prisma.teacherAccountabilityAuditLog.findMany({
      where: {
        schoolId,
        teacherId,
        createdAt: { gte: weekStart, lte: now },
      },
      orderBy: [{ createdAt: "desc" }],
      take: 10,
    }),
  ]);

  const totals = {
    today: todayDuties.length,
    pending: 0,
    completed: 0,
    completedLate: 0,
    missed: 0,
    escalated: 0,
    openEscalations: openEscalations.length,
    pendingReminders,
    reliabilityScore: 0,
  };

  let weeklyTotal = 0;
  let weeklyEarned = 0;
  for (const row of weeklyStatusGroups) {
    const status = effectiveObligationStatus(row, now);
    weeklyTotal += 1;
    if (status === "PENDING") {
      totals.pending += 1;
      weeklyEarned += 0.4;
    }
    if (status === "COMPLETED") {
      totals.completed += 1;
      weeklyEarned += 1;
    }
    if (status === "COMPLETED_LATE") {
      totals.completedLate += 1;
      weeklyEarned += 0.7;
    }
    if (status === "MISSED") totals.missed += 1;
    if (status === "ESCALATED") totals.escalated += 1;
  }
  totals.reliabilityScore =
    weeklyTotal > 0 ? Math.round((weeklyEarned / weeklyTotal) * 100) : 100;

  const weeklyIssueRows = weeklyIssueDuties
    .map((obligation) => toDutyRow(obligation, now))
    .filter((row) => isAccountabilityIssue(row.status))
    .slice(0, 20);

  return {
    totals,
    todayDuties: todayDuties.map((obligation) => toDutyRow(obligation, now)),
    weeklyIssues: weeklyIssueRows,
    reminders: reminders.map((reminder) => ({
      id: reminder.id,
      message: reminder.message,
      status: reminder.status,
      scheduledAt: reminder.scheduledAt,
      createdAt: reminder.createdAt,
      obligationTitle: reminder.obligation.title,
    })),
    escalations: openEscalations.map((escalation) => ({
      id: escalation.id,
      reason: escalation.reason,
      status: escalation.status,
      escalatedAt: escalation.escalatedAt,
      obligationTitle: escalation.obligation.title,
    })),
    auditTrail: auditTrail.map((log) => ({
      id: log.id,
      action: log.action,
      message: log.message,
      createdAt: log.createdAt,
    })),
  };
}
