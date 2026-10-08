import prisma from "@/src/lib/prisma";
import type {
  TeacherObligationPriority,
  TeacherObligationStatus,
} from "@/src/generated/prisma";
import { getTeacherAccountabilitySettings } from "@/src/lib/services/teacher-accountability-settings";
import { saveTeacherObligation } from "@/src/lib/services/teacher-obligation-store";
import { getLiveTimetableLessonBySourceId } from "@/src/lib/services/timetable";

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

function homeworkSourceKey(assignmentId: number) {
  return `homework-checking:assignment:${assignmentId}`;
}

export function homeworkCheckingDeadline(dueDate: Date, days: number, closeoutTime: string) {
  return applyTime(addSchoolDays(dueDate, days), closeoutTime);
}

async function getAssignmentForHomeworkObligation(schoolId: string, assignmentId: number) {
  return prisma.assignment.findFirst({
    where: { id: assignmentId, schoolId, lesson: { schoolId, teacher: { schoolId, status: "ACTIVE" }, class: { schoolId }, subject: { schoolId } } },
    include: {
      lesson: {
        select: {
          teacherId: true,
          classId: true,
          subjectId: true,
          subject: { select: { id: true, name: true } },
          class: {
            select: {
              id: true,
              name: true,
              students: { where: { schoolId, status: "ACTIVE" }, select: { id: true, createdAt: true } },
            },
          },
          teacher: { select: { name: true, surname: true } },
        },
      },
      homeworkSubmissions: {
        where: { schoolId, student: { schoolId, status: "ACTIVE" } },
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
  const classStudentIds = new Set(assignment.lesson.class.students.filter((student) => student.createdAt <= endOfDay(assignment.dueDate)).map((student) => student.id));
  const validSubmissions = assignment.homeworkSubmissions.filter((submission) =>
    classStudentIds.has(submission.studentId),
  );
  const studentCount = classStudentIds.size;
  const checkedRows = validSubmissions.filter((submission) => submission.status !== "PENDING" && submission.checkedAt);
  const checkedCount = new Set(checkedRows.map((row) => row.studentId)).size;
  const pendingCount = Math.max(studentCount - checkedCount, 0);
  const latestCheckedAt = checkedRows.reduce<Date | null>(
    (latest, submission) =>
      submission.checkedAt && (!latest || submission.checkedAt > latest)
        ? submission.checkedAt
        : latest,
    null,
  );
  const dueAt = endOfDay(assignment.dueDate);
  const expectedAt = homeworkCheckingDeadline(dueAt, checkWindowDays, closeoutTime);
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
    checkedCount,
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
  const published = await getLiveTimetableLessonBySourceId(schoolId, assignment.lessonId);
  if (!published || published.teacherId !== assignment.lesson.teacherId || published.classId !== assignment.lesson.classId || published.subjectId !== assignment.lesson.subjectId) return null;

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

  const obligation = await saveTeacherObligation({
    schoolId, teacherId: assignment.lesson.teacherId, type: "HOMEWORK_CHECKING",
    status: state.status, priority: state.priority, sourceModel: "Assignment",
    sourceId: String(assignment.id), sourceKey, title, description,
    expectedAt: state.expectedAt, completedAt: state.completedAt, metadata,
  });
  if (!obligation) return null;
  return {
    assignmentId: assignment.id,
    obligationId: obligation.id, status: obligation.status,
    expectedAt: obligation.expectedAt, completedAt: obligation.completedAt,
    studentCount: state.studentCount,
    checkedCount: state.checkedCount, pendingCount: state.pendingCount,
  };
}

export async function syncHomeworkCheckingObligationsForSchool({
  schoolId,
  teacherId,
  now = new Date(),
  limit = 200,
}: {
  schoolId: string;
  teacherId?: string;
  now?: Date;
  limit?: number;
}) {
  const since = new Date(now);
  since.setDate(since.getDate() - 60);
  const finished = await prisma.teacherObligation.findMany({ where: {
    schoolId, sourceModel: "Assignment", ...(teacherId ? { teacherId } : {}),
    OR: [{ status: { in: ["COMPLETED", "COMPLETED_LATE", "CANCELLED"] } }, { completedAt: { not: null } }, { escalations: { some: { schoolId, status: { in: ["RESOLVED", "DISMISSED"] } } } }],
  }, select: { sourceId: true } });
  const finishedIds = finished.map((row) => Number(row.sourceId)).filter((id) => Number.isSafeInteger(id) && id > 0);

  const assignments = await prisma.assignment.findMany({
    where: {
      schoolId,
      dueDate: { gte: since, lte: now },
      id: { notIn: finishedIds },
      lesson: { schoolId, teacher: { schoolId, status: "ACTIVE", ...(teacherId ? { id: teacherId } : {}) } },
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
