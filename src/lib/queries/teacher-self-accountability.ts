import prisma from "@/src/lib/prisma";
import type {
  TeacherAccountabilityAuditAction,
  TeacherObligationType,
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
  teacherName?: string;
  bucketName?: string;
  activityTitle?: string;
  assignmentTitle?: string;
  term?: string;
  academicYear?: string;
  attendanceCount?: number;
  scoreCount?: number;
  checkedCount?: number;
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
    weeklyEscalations: number;
    openEscalations: number;
    pendingReminders: number;
    reliabilityScore: number;
  };
  todayDuties: TeacherDutyRow[];
  weeklyIssues: TeacherDutyRow[];
  weeklyDays: TeacherWeeklyDayGroup[];
  reminders: TeacherReminderRow[];
  escalations: TeacherEscalationRow[];
  auditTrail: TeacherAuditRow[];
  historyDays: TeacherHistoryDayGroup[];
};

export type TeacherDutyRow = {
  id: string;
  type: TeacherObligationType;
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
  escalationStatus: string | null;
  escalationReason: string | null;
  escalatedAt: Date | null;
};

export type TeacherWeeklyDayGroup = {
  key: string;
  label: string;
  shortLabel: string;
  isToday: boolean;
  total: number;
  issueCount: number;
  pendingCount: number;
  completedCount: number;
  rows: TeacherDutyRow[];
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
  title: string;
  message: string | null;
  createdAt: Date;
  dutyExpectedAt: Date | null;
  dutyType: TeacherObligationType | null;
  className: string | null;
  subjectName: string | null;
  actionHref: string;
  nextStep: string | null;
};

export type TeacherHistoryDayGroup = {
  key: string;
  label: string;
  shortLabel: string;
  isToday: boolean;
  rows: TeacherAuditRow[];
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

function endOfWeek(date: Date) {
  const value = startOfWeek(date);
  value.setDate(value.getDate() + 6);
  value.setHours(23, 59, 59, 999);
  return value;
}

function dayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function formatDayLabel(date: Date) {
  return new Intl.DateTimeFormat("en-GH", {
    weekday: "long",
    day: "numeric",
    month: "short",
  }).format(date);
}

function formatShortDayLabel(date: Date) {
  return new Intl.DateTimeFormat("en-GH", {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(date);
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

function obligationTypeLabel(type: TeacherObligationType | null) {
  if (type === "ATTENDANCE") return "Attendance";
  if (type === "CA_SCORE_PUBLISHING") return "CA scores";
  if (type === "HOMEWORK_CHECKING") return "Homework";
  if (type === "SYLLABUS_PROGRESS") return "Syllabus";
  if (type === "EXAM_ENTRY") return "Exam entry";
  if (type === "CORRECTION_REVIEW") return "Correction review";
  return "Accountability";
}

function auditActionTitle(
  action: TeacherAccountabilityAuditAction,
  obligation: { type: TeacherObligationType; title: string } | null,
) {
  const label = obligationTypeLabel(obligation?.type ?? null);
  if (action === "OBLIGATION_CREATED") return `${label} duty was created`;
  if (action === "OBLIGATION_COMPLETED") return `${label} duty was completed`;
  if (action === "OBLIGATION_COMPLETED_LATE") return `${label} duty was completed late`;
  if (action === "OBLIGATION_MISSED") return `${label} duty was missed`;
  if (action === "OBLIGATION_ESCALATED" || action === "ESCALATION_CREATED") {
    return `${label} duty was escalated`;
  }
  if (action === "OBLIGATION_CANCELLED") return `${label} duty was cancelled`;
  if (action === "REMINDER_QUEUED") return `${label} reminder was queued`;
  if (action === "REMINDER_SENT") return `${label} reminder was sent`;
  if (action === "REMINDER_FAILED") return `${label} reminder failed`;
  if (action === "ESCALATION_ACKNOWLEDGED") return `${label} escalation was acknowledged`;
  if (action === "ESCALATION_RESOLVED") return `${label} escalation was resolved`;
  if (action === "ESCALATION_DISMISSED") return `${label} escalation was dismissed`;
  if (action === "CORRECTION_REQUESTED") return "Correction request was submitted";
  if (action === "CORRECTION_APPROVED") return "Correction request was approved";
  if (action === "CORRECTION_REJECTED") return "Correction request was rejected";
  if (action === "CORRECTION_NEEDS_MORE_INFO") return "Correction request needs more information";
  if (action === "CORRECTION_CANCELLED") return "Correction request was cancelled";
  if (action === "SETTINGS_UPDATED") return "Accountability settings were updated";
  return obligation?.title ?? "Accountability event was recorded";
}

function auditNextStep(
  action: TeacherAccountabilityAuditAction,
  obligation: {
    status: TeacherObligationStatus;
    completedAt: Date | null;
  } | null,
) {
  if (!obligation) return null;
  const status = obligation.status;
  if (status === "PENDING") return "Open this duty and complete it before it becomes late.";
  if (status === "MISSED") return "This duty was missed. Open it, complete what is still possible, and expect management review.";
  if (status === "ESCALATED") return "This item has been escalated. Open it and resolve the outstanding work.";
  if (action === "REMINDER_FAILED") return "The reminder failed to send, but the duty still remains on your accountability record.";
  if (status === "COMPLETED_LATE") return "This was accepted, but it remains marked as completed late.";
  if (status === "COMPLETED") return "No action needed.";
  return null;
}

function toAuditRow(
  log: {
    id: string;
    action: TeacherAccountabilityAuditAction;
    message: string | null;
    createdAt: Date;
    sourceModel: string;
    sourceId: string;
  },
  obligation: {
    id: string;
    type: TeacherObligationType;
    title: string;
    status: TeacherObligationStatus;
    expectedAt: Date;
    completedAt: Date | null;
    sourceModel: string;
    sourceId: string;
    metadata: unknown;
  } | null,
): TeacherAuditRow {
  const metadata = readMetadata(obligation?.metadata);
  return {
    id: log.id,
    action: log.action,
    title: auditActionTitle(log.action, obligation),
    message: log.message ?? obligation?.title ?? null,
    createdAt: log.createdAt,
    dutyExpectedAt: obligation?.expectedAt ?? null,
    dutyType: obligation?.type ?? null,
    className: metadata.className ?? null,
    subjectName: metadata.subjectName ?? null,
    actionHref: obligation
      ? actionHref(obligation.sourceModel, obligation.sourceId)
      : actionHref(log.sourceModel, log.sourceId),
    nextStep: auditNextStep(log.action, obligation),
  };
}

function buildHistoryDays(rows: TeacherAuditRow[], weekStart: Date, now: Date) {
  const rowsByDay = new Map<string, TeacherAuditRow[]>();
  for (const row of rows) {
    const historyDate = row.dutyExpectedAt ?? row.createdAt;
    const key = dayKey(historyDate);
    rowsByDay.set(key, [...(rowsByDay.get(key) ?? []), row]);
  }

  return Array.from({ length: 7 }, (_, index) => {
    const date = startOfDay(weekStart);
    date.setDate(date.getDate() + index);
    const key = dayKey(date);
    return {
      key,
      label: formatDayLabel(date),
      shortLabel: formatShortDayLabel(date),
      isToday: key === dayKey(now),
      rows: rowsByDay.get(key) ?? [],
    };
  });
}

function toDutyRow(obligation: {
  id: string;
  type: TeacherObligationType;
  title: string;
  status: TeacherObligationStatus;
  priority: TeacherObligationPriority;
  expectedAt: Date;
  completedAt: Date | null;
  sourceModel: string;
  sourceId: string;
  metadata: unknown;
  escalations?: {
    reason: string;
    status: string;
    escalatedAt: Date;
  }[];
}, now: Date): TeacherDutyRow {
  const metadata = readMetadata(obligation.metadata);
  const status = effectiveObligationStatus(obligation, now);
  const activeEscalation =
    obligation.escalations?.find((escalation) =>
      escalation.status === "OPEN" || escalation.status === "ACKNOWLEDGED",
    ) ?? null;
  return {
    id: obligation.id,
    type: obligation.type,
    title: obligation.title,
    status,
    priority: effectiveObligationPriority(status, obligation.priority),
    expectedAt: obligation.expectedAt,
    completedAt: obligation.completedAt,
    className: metadata.className ?? null,
    subjectName: metadata.subjectName ?? null,
    attendanceCount:
      typeof metadata.attendanceCount === "number"
        ? metadata.attendanceCount
        : typeof metadata.scoreCount === "number"
          ? metadata.scoreCount
          : typeof metadata.checkedCount === "number"
            ? metadata.checkedCount
            : null,
    studentCount:
      typeof metadata.studentCount === "number" ? metadata.studentCount : null,
    actionHref: actionHref(obligation.sourceModel, obligation.sourceId),
    escalationStatus: activeEscalation?.status ?? null,
    escalationReason: activeEscalation?.reason ?? null,
    escalatedAt: activeEscalation?.escalatedAt ?? null,
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
  const weekEnd = endOfWeek(now);

  const [
    todayDuties,
    weeklyDuties,
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
      include: {
        escalations: {
          where: { status: { in: ["OPEN", "ACKNOWLEDGED"] } },
          select: {
            reason: true,
            status: true,
            escalatedAt: true,
          },
          orderBy: { escalatedAt: "desc" },
          take: 1,
        },
      },
      orderBy: [{ expectedAt: "asc" }, { createdAt: "asc" }],
      take: 40,
    }),
    prisma.teacherObligation.findMany({
      where: {
        schoolId,
        teacherId,
        expectedAt: { gte: weekStart, lte: weekEnd },
      },
      include: {
        escalations: {
          where: { status: { in: ["OPEN", "ACKNOWLEDGED"] } },
          select: {
            reason: true,
            status: true,
            escalatedAt: true,
          },
          orderBy: { escalatedAt: "desc" },
          take: 1,
        },
      },
      orderBy: [{ expectedAt: "asc" }, { createdAt: "asc" }],
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
        action: {
          in: [
            "OBLIGATION_ESCALATED",
            "ESCALATION_CREATED",
            "ESCALATION_ACKNOWLEDGED",
            "ESCALATION_RESOLVED",
            "ESCALATION_DISMISSED",
          ],
        },
      },
      select: {
        id: true,
        action: true,
        message: true,
        createdAt: true,
        sourceModel: true,
        sourceId: true,
      },
      orderBy: [{ createdAt: "desc" }],
      take: 300,
    }),
  ]);
  const auditObligationIds = auditTrail
    .filter((log) => log.sourceModel === "TeacherObligation")
    .map((log) => log.sourceId);
  const auditObligations = auditObligationIds.length > 0
    ? await prisma.teacherObligation.findMany({
        where: {
          schoolId,
          id: { in: auditObligationIds },
        },
        select: {
          id: true,
          expectedAt: true,
          type: true,
          title: true,
          status: true,
          completedAt: true,
          sourceModel: true,
          sourceId: true,
          metadata: true,
        },
      })
    : [];
  const auditObligationById = new Map(
    auditObligations.map((obligation) => [obligation.id, obligation]),
  );

  const totals = {
    today: todayDuties.length,
    pending: 0,
    completed: 0,
    completedLate: 0,
    missed: 0,
    escalated: 0,
    weeklyEscalations: 0,
    openEscalations: openEscalations.length,
    pendingReminders,
    reliabilityScore: 0,
  };

  let weeklyTotal = 0;
  let weeklyEarned = 0;
  const weeklyRows = weeklyDuties.map((obligation) => toDutyRow(obligation, now));

  for (const row of weeklyRows) {
    const status = row.status;
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
    if (status === "ESCALATED" || row.escalationStatus) {
      totals.weeklyEscalations += 1;
    }
  }
  totals.reliabilityScore =
    weeklyTotal > 0 ? Math.round((weeklyEarned / weeklyTotal) * 100) : 100;

  const weeklyIssueRows = weeklyRows
    .filter((row) => isAccountabilityIssue(row.status))
    .slice(0, 20);

  const rowsByDay = new Map<string, TeacherDutyRow[]>();
  for (const row of weeklyRows) {
    const key = dayKey(row.expectedAt);
    rowsByDay.set(key, [...(rowsByDay.get(key) ?? []), row]);
  }
  const weeklyDays = Array.from({ length: 7 }, (_, index) => {
    const date = startOfDay(weekStart);
    date.setDate(date.getDate() + index);
    const key = dayKey(date);
    const rows = rowsByDay.get(key) ?? [];
    return {
      key,
      label: formatDayLabel(date),
      shortLabel: formatShortDayLabel(date),
      isToday: key === dayKey(now),
      total: rows.length,
      issueCount: rows.filter((row) => isAccountabilityIssue(row.status)).length,
      pendingCount: rows.filter((row) => row.status === "PENDING").length,
      completedCount: rows.filter((row) => row.status === "COMPLETED" || row.status === "COMPLETED_LATE").length,
      rows,
    };
  });

  const auditRows = auditTrail.map((log) =>
    toAuditRow(
      log,
      log.sourceModel === "TeacherObligation"
        ? auditObligationById.get(log.sourceId) ?? null
        : null,
    ),
  );

  return {
    totals,
    todayDuties: todayDuties.map((obligation) => toDutyRow(obligation, now)),
    weeklyIssues: weeklyIssueRows,
    weeklyDays,
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
    auditTrail: auditRows,
    historyDays: buildHistoryDays(auditRows, weekStart, now),
  };
}
