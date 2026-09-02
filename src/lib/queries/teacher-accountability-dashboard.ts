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

type TeacherName = {
  id: string;
  name: string;
  surname: string;
};

type ObligationMetadata = {
  className?: string;
  subjectName?: string;
  date?: string;
  openAt?: string;
  deadlineAt?: string;
  missedAt?: string;
  studentCount?: number;
  attendanceCount?: number;
};

export type TeacherAccountabilityOverview = {
  totals: {
    today: number;
    pending: number;
    completed: number;
    completedLate: number;
    missed: number;
    escalated: number;
    openEscalations: number;
    remindersPending: number;
  };
  upcoming: AccountabilityObligationRow[];
  issues: AccountabilityObligationRow[];
  teacherSummaries: TeacherAccountabilitySummaryRow[];
  openEscalations: AccountabilityEscalationRow[];
  recentAuditLogs: AccountabilityAuditRow[];
};

export type AccountabilityObligationRow = {
  id: string;
  teacherName: string;
  title: string;
  status: TeacherObligationStatus;
  priority: TeacherObligationPriority;
  expectedAt: Date;
  completedAt: Date | null;
  className: string | null;
  subjectName: string | null;
  attendanceCount: number | null;
  studentCount: number | null;
  reminderCount: number;
  escalationCount: number;
};

export type TeacherAccountabilitySummaryRow = {
  teacherId: string;
  teacherName: string;
  total: number;
  pending: number;
  completed: number;
  completedLate: number;
  missed: number;
  escalated: number;
  reliabilityScore: number;
};

export type AccountabilityEscalationRow = {
  id: string;
  teacherName: string;
  reason: string;
  status: string;
  escalatedAt: Date;
  obligationTitle: string;
  expectedAt: Date;
  className: string | null;
  subjectName: string | null;
};

export type AccountabilityAuditRow = {
  id: string;
  action: TeacherAccountabilityAuditAction;
  teacherName: string | null;
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

function fullName(teacher: TeacherName | null | undefined) {
  if (!teacher) return "Unknown teacher";
  return `${teacher.name} ${teacher.surname}`.trim();
}

function readMetadata(metadata: unknown): ObligationMetadata {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return {};
  }
  return metadata as ObligationMetadata;
}

function toObligationRow(obligation: {
  id: string;
  title: string;
  status: TeacherObligationStatus;
  priority: TeacherObligationPriority;
  expectedAt: Date;
  completedAt: Date | null;
  metadata: unknown;
  teacher: TeacherName;
  _count: {
    reminders: number;
    escalations: number;
  };
}, now: Date): AccountabilityObligationRow {
  const metadata = readMetadata(obligation.metadata);
  const status = effectiveObligationStatus(obligation, now);
  return {
    id: obligation.id,
    teacherName: fullName(obligation.teacher),
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
    reminderCount: obligation._count.reminders,
    escalationCount: obligation._count.escalations,
  };
}

export async function getTeacherAccountabilityOverview(
  schoolId: string,
  now = new Date(),
): Promise<TeacherAccountabilityOverview> {
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const weekStart = startOfWeek(now);

  const [
    todayObligations,
    issueObligations,
    weeklyStatusGroups,
    openEscalations,
    remindersPending,
    recentAuditLogs,
  ] = await Promise.all([
    prisma.teacherObligation.findMany({
      where: {
        schoolId,
        type: "ATTENDANCE",
        expectedAt: { gte: todayStart, lte: todayEnd },
      },
      include: {
        teacher: { select: { id: true, name: true, surname: true } },
        _count: { select: { reminders: true, escalations: true } },
      },
      orderBy: [{ expectedAt: "asc" }, { createdAt: "asc" }],
      take: 80,
    }),
    prisma.teacherObligation.findMany({
      where: {
        schoolId,
        type: "ATTENDANCE",
        expectedAt: { gte: weekStart, lte: todayEnd },
      },
      include: {
        teacher: { select: { id: true, name: true, surname: true } },
        _count: { select: { reminders: true, escalations: true } },
      },
      orderBy: [{ priority: "desc" }, { expectedAt: "desc" }],
      take: 200,
    }),
    prisma.teacherObligation.findMany({
      where: {
        schoolId,
        type: "ATTENDANCE",
        expectedAt: { gte: weekStart, lte: todayEnd },
      },
      select: {
        id: true,
        teacherId: true,
        status: true,
        priority: true,
        expectedAt: true,
        completedAt: true,
        metadata: true,
      },
      orderBy: [{ expectedAt: "asc" }],
      take: 2000,
    }),
    prisma.teacherEscalation.findMany({
      where: {
        schoolId,
        status: { in: ["OPEN", "ACKNOWLEDGED"] },
        obligation: {
          expectedAt: { gte: weekStart, lte: todayEnd },
        },
      },
      include: {
        teacher: { select: { id: true, name: true, surname: true } },
        obligation: {
          select: {
            title: true,
            expectedAt: true,
            metadata: true,
          },
        },
      },
      orderBy: [{ escalatedAt: "desc" }],
      take: 20,
    }),
    prisma.teacherReminder.count({
      where: {
        schoolId,
        status: "PENDING",
        obligation: {
          expectedAt: { gte: todayStart, lte: todayEnd },
        },
      },
    }),
    prisma.teacherAccountabilityAuditLog.findMany({
      where: {
        schoolId,
        createdAt: { gte: weekStart, lte: now },
      },
      include: {
        teacher: { select: { id: true, name: true, surname: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 12,
    }),
  ]);

  const teacherIds = [...new Set(weeklyStatusGroups.map((row) => row.teacherId))];
  const teacherRows =
    teacherIds.length > 0
      ? await prisma.teacher.findMany({
          where: { schoolId, id: { in: teacherIds } },
          select: { id: true, name: true, surname: true },
        })
      : [];
  const teacherNameById = new Map(
    teacherRows.map((teacher) => [teacher.id, fullName(teacher)]),
  );
  const summaryByTeacher = new Map<string, TeacherAccountabilitySummaryRow>();

  for (const row of weeklyStatusGroups) {
    const status = effectiveObligationStatus(row, now);
    const summary =
      summaryByTeacher.get(row.teacherId) ??
      {
        teacherId: row.teacherId,
        teacherName: teacherNameById.get(row.teacherId) ?? "Unknown teacher",
        total: 0,
        pending: 0,
        completed: 0,
        completedLate: 0,
        missed: 0,
        escalated: 0,
        reliabilityScore: 0,
      };
    summary.total += 1;

    if (status === "PENDING") summary.pending += 1;
    if (status === "COMPLETED") summary.completed += 1;
    if (status === "COMPLETED_LATE") summary.completedLate += 1;
    if (status === "MISSED") summary.missed += 1;
    if (status === "ESCALATED") summary.escalated += 1;

    summaryByTeacher.set(row.teacherId, summary);
  }

  const teacherSummaries = [...summaryByTeacher.values()]
    .map((summary) => {
      const earned =
        summary.completed + summary.completedLate * 0.7 + summary.pending * 0.4;
      return {
        ...summary,
        reliabilityScore:
          summary.total > 0 ? Math.round((earned / summary.total) * 100) : 0,
      };
    })
    .sort((a, b) => a.reliabilityScore - b.reliabilityScore || b.total - a.total)
    .slice(0, 12);

  const todayRows = todayObligations.map((obligation) =>
    toObligationRow(obligation, now),
  );
  const issueRows = issueObligations
    .map((obligation) => toObligationRow(obligation, now))
    .filter((row) => isAccountabilityIssue(row.status))
    .slice(0, 25);
  const totals = todayRows.reduce(
    (acc, obligation) => {
      acc.today += 1;
      if (obligation.status === "PENDING") acc.pending += 1;
      if (obligation.status === "COMPLETED") acc.completed += 1;
      if (obligation.status === "COMPLETED_LATE") acc.completedLate += 1;
      if (obligation.status === "MISSED") acc.missed += 1;
      if (obligation.status === "ESCALATED") acc.escalated += 1;
      return acc;
    },
    {
      today: 0,
      pending: 0,
      completed: 0,
      completedLate: 0,
      missed: 0,
      escalated: 0,
      openEscalations: openEscalations.length,
      remindersPending,
    },
  );

  return {
    totals,
    upcoming: todayRows.filter((row) => row.status === "PENDING").slice(0, 12),
    issues: issueRows,
    teacherSummaries,
    openEscalations: openEscalations.map((escalation) => {
      const metadata = readMetadata(escalation.obligation.metadata);
      return {
        id: escalation.id,
        teacherName: fullName(escalation.teacher),
        reason: escalation.reason,
        status: escalation.status,
        escalatedAt: escalation.escalatedAt,
        obligationTitle: escalation.obligation.title,
        expectedAt: escalation.obligation.expectedAt,
        className: metadata.className ?? null,
        subjectName: metadata.subjectName ?? null,
      };
    }),
    recentAuditLogs: recentAuditLogs.map((log) => ({
      id: log.id,
      action: log.action,
      teacherName: log.teacher ? fullName(log.teacher) : null,
      message: log.message,
      createdAt: log.createdAt,
    })),
  };
}
