import prisma from "@/src/lib/prisma";
import type {
  TeacherObligationPriority,
  TeacherObligationStatus,
} from "@/src/generated/prisma";
import { getTeacherAccountabilitySettings } from "@/src/lib/services/teacher-accountability-settings";
import { saveTeacherObligation } from "@/src/lib/services/teacher-obligation-store";
import { listLiveTimetableLessons } from "@/src/lib/services/timetable";

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

function caActivitySourceKey(activityId: number) {
  return `ca-score-publishing:activity:${activityId}`;
}

export function caPublishingDeadline(activityDate: Date, days: number, closeoutTime: string) {
  return applyTime(addSchoolDays(activityDate, days), closeoutTime);
}

async function getCAActivityForObligation(schoolId: string, activityId: number) {
  return prisma.cAActivity.findFirst({
    where: { id: activityId, schoolId, teacher: { schoolId, status: "ACTIVE" }, class: { schoolId }, subject: { schoolId }, bucket: { schoolId } },
    include: {
      bucket: { select: { name: true, term: true, academicYear: true, classId: true, subjectId: true } },
      class: {
        select: {
          id: true,
          name: true,
          students: { where: { schoolId, status: "ACTIVE" }, select: { id: true, createdAt: true } },
        },
      },
      subject: { select: { id: true, name: true } },
      teacher: { select: { id: true, name: true, surname: true } },
      scores: { where: { schoolId, student: { schoolId, status: "ACTIVE" } }, select: { id: true, studentId: true, updatedAt: true } },
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
  const cutoff = new Date(activity.activityDate); cutoff.setHours(23, 59, 59, 999);
  const classStudentIds = new Set(activity.class.students.filter((student) => student.createdAt <= cutoff).map((student) => student.id));
  const studentCount = classStudentIds.size;
  const validScores = activity.scores.filter((score) => classStudentIds.has(score.studentId));
  const scoreCount = new Set(validScores.map((score) => score.studentId)).size;
  const latestScoreAt = validScores.reduce<Date | null>(
    (latest, score) => (!latest || score.updatedAt > latest ? score.updatedAt : latest),
    null,
  );
  const expectedAt = caPublishingDeadline(activity.activityDate, publishWindowDays, closeoutTime);
  const reminderAt = applyTime(
    addSchoolDays(activity.activityDate, reminderAfterDays),
    closeoutTime,
  );
  const missedAt = applyTime(
    addSchoolDays(activity.activityDate, escalateAfterDays),
    closeoutTime,
  );
  const completed = studentCount > 0 && scoreCount >= studentCount && Boolean(latestScoreAt);
  const status: TeacherObligationStatus = studentCount === 0 ? "CANCELLED" : completed
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
  const [lessons, config] = await Promise.all([
    listLiveTimetableLessons(schoolId, { teacherId: activity.teacherId, classId: activity.classId }),
    prisma.cAConfig.findFirst({ where: { schoolId, isActive: true }, orderBy: [{ updatedAt: "desc" }, { id: "desc" }], select: { academicYear: true, currentTerm: true } }),
  ]);
  if (!lessons.some((lesson) => lesson.subjectId === activity.subjectId) ||
      activity.bucket.classId !== activity.classId || activity.bucket.subjectId !== activity.subjectId ||
      !config || config.academicYear !== activity.bucket.academicYear || config.currentTerm !== activity.bucket.term) return null;

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
    missingScoreCount: Math.max(state.studentCount - state.scoreCount, 0),
  };

  const obligation = await saveTeacherObligation({
    schoolId, teacherId: activity.teacherId, type: "CA_SCORE_PUBLISHING",
    status: state.status, priority: state.priority, sourceModel: "CAActivity",
    sourceId: String(activity.id), sourceKey, title, description,
    expectedAt: state.expectedAt, completedAt: state.completedAt, metadata,
  });
  if (!obligation) return null;
  return {
    activityId: activity.id,
    obligationId: obligation.id, status: obligation.status,
    expectedAt: obligation.expectedAt, completedAt: obligation.completedAt,
    studentCount: state.studentCount,
    scoreCount: state.scoreCount,
  };
}

export async function syncCAActivityScorePublishingObligationsForSchool({
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
    schoolId, sourceModel: "CAActivity", ...(teacherId ? { teacherId } : {}),
    OR: [{ status: { in: ["COMPLETED", "COMPLETED_LATE", "CANCELLED"] } }, { completedAt: { not: null } }, { escalations: { some: { schoolId, status: { in: ["RESOLVED", "DISMISSED"] } } } }],
  }, select: { sourceId: true } });
  const finishedIds = finished.map((row) => Number(row.sourceId)).filter((id) => Number.isSafeInteger(id) && id > 0);

  const activities = await prisma.cAActivity.findMany({
    where: {
      schoolId,
      activityDate: { gte: since, lte: now },
      id: { notIn: finishedIds },
      teacher: { schoolId, status: "ACTIVE", ...(teacherId ? { id: teacherId } : {}) },
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
