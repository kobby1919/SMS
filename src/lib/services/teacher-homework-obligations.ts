import prisma from "@/src/lib/prisma";
import type {
  TeacherAccountabilityAuditAction,
  TeacherObligationPriority,
  TeacherObligationStatus,
} from "@/src/generated/prisma";
import { getTeacherAccountabilitySettings } from "@/src/lib/services/teacher-accountability-settings";

type HomeworkObligationSnapshot = {
  assignmentId: number;
  obligationId: string;
  status: TeacherObligationStatus;
  expectedAt: Date;
  completedAt: Date | null;
  studentCount: number;
  checkedCount: number;
  pendingCount: number;
};

type AssignmentForHomeworkObligation = NonNullable<
  Awaited<ReturnType<typeof getAssignmentForHomeworkObligation>>
>;

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
  if (status === "CANCELLED") return "LOW";
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

function homeworkSourceKey(assignmentId: number) {
  return `homework-checking:assignment:${assignmentId}`;
}

async function getAssignmentForHomeworkObligation(schoolId: string, assignmentId: number) {
  return prisma.assignment.findFirst({
    where: { id: assignmentId, schoolId },
    include: {
      lesson: {
        select: {
          teacherId: true,
          subject: { select: { id: true, name: true } },
          class: {
            select: {
              id: true,
              name: true,
              students: { select: { id: true } },
              _count: { select: { students: true } },
            },
          },
          teacher: { select: { name: true, surname: true } },
        },
      },
      homeworkSubmissions: {
        select: {
          id: true,
          studentId: true,
          status: true,
          checkedAt: true,
          updatedAt: true,
        },
      },
    },
  });
}

function buildHomeworkObligationState({
  assignment,
  checkWindowDays,
  escalateAfterDays,
  closeoutTime,
  now,
}: {
  assignment: AssignmentForHomeworkObligation;
  checkWindowDays: number;
  escalateAfterDays: number;
  closeoutTime: string;
  now: Date;
}) {
  const classStudentIds = new Set(assignment.lesson.class.students.map((student) => student.id));
  const validSubmissions = assignment.homeworkSubmissions.filter((submission) =>
    classStudentIds.has(submission.studentId),
  );
  const studentCount = assignment.lesson.class._count.students;
  const checkedRows = validSubmissions.filter((submission) => submission.status !== "PENDING" && submission.checkedAt);
  const pendingCount = Math.max(studentCount - checkedRows.length, 0);
  const latestCheckedAt = checkedRows.reduce<Date | null>(
    (latest, submission) =>
      submission.checkedAt && (!latest || submission.checkedAt > latest)
        ? submission.checkedAt
        : latest,
    null,
  );
  const dueAt = endOfDay(assignment.dueDate);
  const expectedAt = applyTime(addSchoolDays(dueAt, checkWindowDays), closeoutTime);
  const missedAt = applyTime(addSchoolDays(dueAt, escalateAfterDays), closeoutTime);
  const completed = studentCount > 0 && pendingCount === 0 && Boolean(latestCheckedAt);
  const status: TeacherObligationStatus =
    studentCount === 0
      ? "CANCELLED"
      : completed
        ? latestCheckedAt! > expectedAt
          ? "COMPLETED_LATE"
          : "COMPLETED"
        : now > missedAt
          ? "MISSED"
          : "PENDING";

  return {
    dueAt,
    reminderAt: dueAt,
    expectedAt,
    missedAt,
    completedAt: completed ? latestCheckedAt : null,
    status,
    priority: priorityForStatus(status),
    studentCount,
    checkedCount: checkedRows.length,
    pendingCount,
  };
}

export async function syncHomeworkCheckingObligation({
  schoolId,
  assignmentId,
  now = new Date(),
}: {
  schoolId: string;
  assignmentId: number;
  now?: Date;
}): Promise<HomeworkObligationSnapshot | null> {
  const [settings, assignment] = await Promise.all([
    getTeacherAccountabilitySettings(schoolId),
    getAssignmentForHomeworkObligation(schoolId, assignmentId),
  ]);
  if (!assignment) return null;

  const state = buildHomeworkObligationState({
    assignment,
    checkWindowDays: settings.homeworkCheckWindowSchoolDays,
    escalateAfterDays: settings.homeworkEscalateAfterSchoolDays,
    closeoutTime: settings.teacherCloseoutTime,
    now,
  });
  const sourceKey = homeworkSourceKey(assignment.id);
  const teacherName = `${assignment.lesson.teacher.name} ${assignment.lesson.teacher.surname}`.trim();
  const title = `Check ${assignment.lesson.subject.name} homework: ${assignment.title}`;
  const description = `${assignment.lesson.class.name} homework should be checked by ${state.expectedAt.toLocaleDateString("en-GH", { day: "numeric", month: "short" })}.`;
  const metadata = {
    assignmentId: assignment.id,
    assignmentTitle: assignment.title,
    classId: assignment.lesson.class.id,
    className: assignment.lesson.class.name,
    subjectId: assignment.lesson.subject.id,
    subjectName: assignment.lesson.subject.name,
    teacherName,
    dueAt: state.dueAt.toISOString(),
    reminderAt: state.reminderAt.toISOString(),
    deadlineAt: state.expectedAt.toISOString(),
    missedAt: state.missedAt.toISOString(),
    studentCount: state.studentCount,
    checkedCount: state.checkedCount,
    pendingCount: state.pendingCount,
  };

  const existing = await prisma.teacherObligation.findUnique({
    where: {
      schoolId_teacherId_sourceKey: {
        schoolId,
        teacherId: assignment.lesson.teacherId,
        sourceKey,
      },
    },
    select: {
      id: true,
      status: true,
      priority: true,
      expectedAt: true,
    },
  });

  if (!existing) {
    const obligation = await prisma.teacherObligation.create({
      data: {
        schoolId,
        teacherId: assignment.lesson.teacherId,
        type: "HOMEWORK_CHECKING",
        status: state.status,
        priority: state.priority,
        sourceModel: "Assignment",
        sourceId: String(assignment.id),
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
        teacherId: assignment.lesson.teacherId,
        action: "OBLIGATION_CREATED",
        actorRole: "SYSTEM",
        sourceModel: "TeacherObligation",
        sourceId: obligation.id,
        after: {
          status: state.status,
          priority: state.priority,
          sourceModel: "Assignment",
          sourceId: String(assignment.id),
        },
        message: `${title} accountability obligation created.`,
      },
    });

    return {
      assignmentId: assignment.id,
      obligationId: obligation.id,
      status: state.status,
      expectedAt: state.expectedAt,
      completedAt: state.completedAt,
      studentCount: state.studentCount,
      checkedCount: state.checkedCount,
      pendingCount: state.pendingCount,
    };
  }

  const nextStatus =
    existing.status === "ESCALATED" &&
    state.status !== "COMPLETED" &&
    state.status !== "COMPLETED_LATE" &&
    state.status !== "CANCELLED"
      ? "ESCALATED"
      : state.status;
  const nextPriority = priorityForStatus(nextStatus);
  const statusChanged = existing.status !== nextStatus;
  const scheduleChanged = existing.expectedAt.getTime() !== state.expectedAt.getTime();
  const shouldSkipPendingReminders = nextStatus !== "PENDING" || scheduleChanged;
  const action = auditActionForStatus(nextStatus);

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
    ...(shouldSkipPendingReminders
      ? [
          prisma.teacherReminder.updateMany({
            where: {
              schoolId,
              obligationId: existing.id,
              status: "PENDING",
            },
            data: {
              status: "SKIPPED",
              errorMessage:
                nextStatus === "PENDING"
                  ? "Superseded by homework schedule update."
                  : `Superseded by obligation status ${nextStatus}.`,
            },
          }),
        ]
      : []),
    ...(statusChanged && action
      ? [
          prisma.teacherAccountabilityAuditLog.create({
            data: {
              schoolId,
              teacherId: assignment.lesson.teacherId,
              action,
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
    assignmentId: assignment.id,
    obligationId: existing.id,
    status: nextStatus,
    expectedAt: state.expectedAt,
    completedAt: state.completedAt,
    studentCount: state.studentCount,
    checkedCount: state.checkedCount,
    pendingCount: state.pendingCount,
  };
}

export async function syncHomeworkCheckingObligationsForSchool({
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

  const assignments = await prisma.assignment.findMany({
    where: {
      schoolId,
      dueDate: { gte: since, lte: now },
    },
    select: { id: true },
    orderBy: [{ dueDate: "asc" }, { id: "asc" }],
    take: limit,
  });

  let synced = 0;
  for (const assignment of assignments) {
    const result = await syncHomeworkCheckingObligation({
      schoolId,
      assignmentId: assignment.id,
      now,
    });
    if (result) synced += 1;
  }

  return synced;
}
