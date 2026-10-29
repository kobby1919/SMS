import prisma from "@/src/lib/prisma";
import { eligibleAttendanceStudentIds } from "@/src/lib/attendance-review";
import type {
  Day,
  TeacherObligationPriority,
  TeacherObligationStatus,
} from "@/src/generated/prisma";
import { getTeacherAccountabilitySettings } from "@/src/lib/services/teacher-accountability-settings";
import { getActiveTimetablePublication, getLiveTimetableLessonBySourceId, listLiveTimetableLessons } from "@/src/lib/services/timetable";
import { saveTeacherObligation } from "@/src/lib/services/teacher-obligation-store";
import { getSchoolOperatingWindowStatus } from "@/src/lib/services/school-operating-hours";
import { attendanceWindowForLesson } from "@/src/lib/attendance-window";

const DAY_BY_INDEX: Record<number, Day | null> = {
  0: null,
  1: "MONDAY",
  2: "TUESDAY",
  3: "WEDNESDAY",
  4: "THURSDAY",
  5: "FRIDAY",
  6: null,
};

type AttendanceObligationSnapshot = {
  lessonId: number;
  obligationId: string;
  status: TeacherObligationStatus;
  openAt: Date;
  deadlineAt: Date;
  missedAt: Date;
  expectedAt: Date;
  completedAt: Date | null;
  studentCount: number;
  attendanceCount: number;
};

type AttendanceWindowEvaluation = ReturnType<typeof attendanceWindowForLesson>;

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function dayStart(date: Date) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

function dayEnd(date: Date) {
  const value = new Date(date);
  value.setHours(23, 59, 59, 999);
  return value;
}

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60_000);
}

function combineDateWithLessonTime(date: Date, lessonTime: Date) {
  const value = dayStart(date);
  value.setHours(lessonTime.getHours(), lessonTime.getMinutes(), 0, 0);
  return value;
}

export async function evaluateAttendanceWindow({
  schoolId,
  lessonId,
  date,
  now = new Date(),
}: {
  schoolId: string;
  lessonId: number;
  date: Date;
  now?: Date;
}): Promise<AttendanceWindowEvaluation> {
  const [settings, lesson, publication] = await Promise.all([
    getTeacherAccountabilitySettings(schoolId),
    getLiveTimetableLessonBySourceId(schoolId, lessonId),
    getActiveTimetablePublication(schoolId),
  ]);
  if (!lesson) throw new Error("This lesson is not part of the published timetable.");
  if (!publication) throw new Error("The timetable is no longer published. Refresh before marking attendance.");
  return attendanceWindowForLesson({ date, lesson, settings, now, publishedAt: publication.publishedAt });
}

function statusForAttendanceObligation({
  now,
  deadlineAt,
  missedAt,
  studentCount,
  attendanceCount,
  completedAt,
}: {
  now: Date;
  deadlineAt: Date;
  missedAt: Date;
  studentCount: number;
  attendanceCount: number;
  completedAt: Date | null;
}): TeacherObligationStatus {
  if (studentCount === 0) return "CANCELLED";
  if (studentCount > 0 && attendanceCount >= studentCount && completedAt) {
    return completedAt > deadlineAt ? "COMPLETED_LATE" : "COMPLETED";
  }

  return now > missedAt ? "MISSED" : "PENDING";
}

function priorityForStatus(status: TeacherObligationStatus): TeacherObligationPriority {
  if (status === "MISSED" || status === "ESCALATED") return "HIGH";
  if (status === "COMPLETED_LATE") return "NORMAL";
  return "NORMAL";
}

export function attendanceObligationSourceKey(lessonId: number, date: Date) {
  return `attendance:${dateKey(date)}:lesson:${lessonId}`;
}

export async function syncAttendanceObligationsForDate({
  schoolId,
  teacherId,
  date,
  now = new Date(),
}: {
  schoolId: string;
  teacherId?: string;
  date: Date;
  now?: Date;
}): Promise<AttendanceObligationSnapshot[]> {
  const day = DAY_BY_INDEX[dayStart(date).getDay()];
  if (!day) return [];

  const settings = await getTeacherAccountabilitySettings(schoolId);
  const [publication, operating, activeTeachers, liveLessons] = await Promise.all([
    getActiveTimetablePublication(schoolId),
    getSchoolOperatingWindowStatus(schoolId, date),
    prisma.teacher.findMany({ where: { schoolId, status: "ACTIVE", ...(teacherId ? { id: teacherId } : {}) }, select: { id: true } }),
    listLiveTimetableLessons(schoolId, {
    day,
    ...(teacherId ? { teacherId } : {}),
    }),
  ]);
  if (!publication || !operating.activeDays.includes(day)) return [];
  const activeTeacherIds = new Set(activeTeachers.map((teacher) => teacher.id));
  const lessons = liveLessons.filter((lesson) => activeTeacherIds.has(lesson.teacherId) && publication.publishedAt <= combineDateWithLessonTime(date, lesson.startTime));

  if (lessons.length === 0) return [];

  const classIds = [...new Set(lessons.map((lesson) => lesson.classId))];
  const lessonIds = lessons.map((lesson) => lesson.id);
  const [students, attendanceRows] = await Promise.all([
    prisma.student.findMany({
      where: { schoolId, status: "ACTIVE", createdAt: { lte: dayEnd(date) }, classId: { in: classIds }, class: { schoolId } },
      select: { id: true, classId: true, createdAt: true },
    }),
    prisma.attendance.findMany({
      where: {
        schoolId,
        lessonId: { in: lessonIds },
        date: { gte: dayStart(date), lte: dayEnd(date) },
        student: { schoolId, status: "ACTIVE" },
      },
      select: { lessonId: true, studentId: true, updatedAt: true },
    }),
  ]);

  const attendanceByLesson = new Map(lessons.map((lesson) => {
    const rows = attendanceRows.filter((row) => row.lessonId === lesson.id);
    const roster = eligibleAttendanceStudentIds(students.filter((student) => student.classId === lesson.classId), combineDateWithLessonTime(date, lesson.startTime), rows.map((row) => row.studentId));
    const marks = rows.filter((row) => roster.has(row.studentId));
    return [lesson.id, {
      studentCount: roster.size,
      count: new Set(marks.map((row) => row.studentId)).size,
      completedAt: marks.reduce<Date | null>((latest, row) => !latest || row.updatedAt > latest ? row.updatedAt : latest, null),
    }];
  }));
  const targetDateKey = dateKey(date);

  const updates = lessons.map((lesson) => {
    const startAt = combineDateWithLessonTime(date, lesson.startTime);
    const endAt = combineDateWithLessonTime(date, lesson.endTime);
    const openAt = settings.allowEarlyAttendanceMarking
      ? addMinutes(startAt, -settings.attendanceOpenMinutesBeforeLesson)
      : startAt;
    const deadlineAt = addMinutes(endAt, settings.attendanceGraceMinutesAfterLesson);
    const missedAt = addMinutes(endAt, settings.attendanceEscalateMinutesAfterLesson);
    const attendance = attendanceByLesson.get(lesson.id) ?? {
      studentCount: 0,
      count: 0,
      completedAt: null,
    };
    const studentCount = attendance.studentCount;
    const status = statusForAttendanceObligation({
      now,
      deadlineAt,
      missedAt,
      studentCount,
      attendanceCount: attendance.count,
      completedAt: attendance.completedAt,
    });
    const sourceKey = attendanceObligationSourceKey(lesson.id, date);

    return {
      lesson,
      sourceKey,
      openAt,
      deadlineAt,
      missedAt,
      studentCount,
      attendanceCount: attendance.count,
      completedAt: attendance.completedAt,
      status,
      priority: priorityForStatus(status),
      title: `Mark ${lesson.class.name} ${lesson.subject.name} attendance`,
      description: `Attendance for ${lesson.subject.name} in ${lesson.class.name} is expected by ${deadlineAt.toLocaleTimeString("en-GH", { hour: "2-digit", minute: "2-digit" })}.`,
    };
  });
  const snapshots: AttendanceObligationSnapshot[] = [];
  for (const item of updates) {
    const obligation = await saveTeacherObligation({
      schoolId, teacherId: item.lesson.teacherId, type: "ATTENDANCE",
      status: item.status, priority: item.priority, sourceModel: "Lesson",
      sourceId: String(item.lesson.id), sourceKey: item.sourceKey,
      title: item.title, description: item.description, expectedAt: item.deadlineAt,
      completedAt: ["COMPLETED", "COMPLETED_LATE"].includes(item.status) ? item.completedAt : null,
      metadata: {
        lessonId: item.lesson.id, classId: item.lesson.classId, className: item.lesson.class.name,
        subjectId: item.lesson.subjectId, subjectName: item.lesson.subject.name,
        teacherName: `${item.lesson.teacher.name} ${item.lesson.teacher.surname}`.trim(),
        date: targetDateKey, openAt: item.openAt.toISOString(), deadlineAt: item.deadlineAt.toISOString(),
        missedAt: item.missedAt.toISOString(), studentCount: item.studentCount, attendanceCount: item.attendanceCount,
      },
    });
    if (obligation) snapshots.push({
      lessonId: item.lesson.id, obligationId: obligation.id, status: obligation.status,
      openAt: item.openAt, deadlineAt: obligation.expectedAt, missedAt: item.missedAt,
      expectedAt: obligation.expectedAt, completedAt: obligation.completedAt,
      studentCount: item.studentCount, attendanceCount: item.attendanceCount,
    });
  }
  return snapshots;
}
