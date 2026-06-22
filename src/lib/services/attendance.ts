import prisma from "@/src/lib/prisma";
import type { AttendanceStatus } from "@/src/generated/prisma";

export type AttendanceStatusCounts = Record<AttendanceStatus, number>;

export type AttendanceStatusCountRow = {
  status: AttendanceStatus;
  _count: { _all: number };
};

export type AttendanceFlagStudent = {
  id: string;
  name: string;
  surname: string;
  class: { name: string };
};

export type FlaggedAttendanceStudent = {
  id: string;
  name: string;
  surname: string;
  className: string;
  streak: number;
};

const EMPTY_STATUS_COUNTS: AttendanceStatusCounts = {
  PRESENT: 0,
  ABSENT: 0,
  LATE: 0,
  EXCUSED: 0,
};

export function normalizeAttendanceStatusCounts(
  rows: AttendanceStatusCountRow[],
): AttendanceStatusCounts {
  const counts = { ...EMPTY_STATUS_COUNTS };
  for (const row of rows) {
    counts[row.status] = row._count._all;
  }
  return counts;
}

export async function getAttendanceStatusCounts({
  schoolId,
  start,
  end,
}: {
  schoolId: string;
  start: Date;
  end: Date;
}): Promise<AttendanceStatusCounts> {
  const grouped = await prisma.attendance.groupBy({
    by: ["status"],
    where: { schoolId, date: { gte: start, lte: end } },
    _count: { _all: true },
  });

  return normalizeAttendanceStatusCounts(grouped);
}

export async function getFlaggedAttendanceStudents({
  schoolId,
  students,
  since,
  minStreak = 3,
  maxRecordsPerStudent = 5,
}: {
  schoolId: string;
  students: AttendanceFlagStudent[];
  since: Date;
  minStreak?: number;
  maxRecordsPerStudent?: number;
}): Promise<FlaggedAttendanceStudent[]> {
  const studentIds = students.map((student) => student.id);
  if (studentIds.length === 0) return [];

  const recentRows = await prisma.attendance.findMany({
    where: {
      schoolId,
      studentId: { in: studentIds },
      date: { gte: since },
    },
    orderBy: [{ studentId: "asc" }, { date: "desc" }],
    select: { studentId: true, status: true },
  });

  const recentByStudent = new Map<string, { status: AttendanceStatus }[]>();
  for (const row of recentRows) {
    const recent = recentByStudent.get(row.studentId) ?? [];
    if (recent.length < maxRecordsPerStudent) {
      recent.push({ status: row.status });
      recentByStudent.set(row.studentId, recent);
    }
  }

  const flagged: FlaggedAttendanceStudent[] = [];
  for (const student of students) {
    const recent = recentByStudent.get(student.id) ?? [];
    let streak = 0;
    for (const record of recent) {
      if (record.status === "ABSENT") streak += 1;
      else break;
    }
    if (streak >= minStreak) {
      flagged.push({
        id: student.id,
        name: student.name,
        surname: student.surname,
        className: student.class.name,
        streak,
      });
    }
  }

  return flagged.sort((a, b) => b.streak - a.streak);
}

export async function getAttendanceRecords({
  schoolId,
  lessonId,
  date,
}: {
  schoolId: string;
  lessonId: number;
  date: Date;
}) {
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(date);
  dayEnd.setHours(23, 59, 59, 999);

  return prisma.attendance.findMany({
    where: { schoolId, lessonId, date: { gte: dayStart, lte: dayEnd } },
    include: {
      student: { select: { id: true, name: true, surname: true, img: true } },
    },
  });
}

export async function saveAttendance({
  schoolId,
  lessonId,
  date,
  records,
}: {
  schoolId: string;
  lessonId: number;
  date: Date;
  records: { studentId: string; status: AttendanceStatus; note?: string | null }[];
}) {
  const attendanceDate = new Date(date);
  attendanceDate.setHours(12, 0, 0, 0);
  const studentIds = [...new Set(records.map((record) => record.studentId))];

  if (studentIds.length !== records.length) {
    throw new Error("Each student may appear only once in an attendance submission.");
  }

  const lesson = await prisma.lesson.findFirst({
    where: { id: lessonId, schoolId },
    select: { id: true, classId: true },
  });
  if (!lesson) throw new Error("Lesson not found.");

  const validStudents = await prisma.student.findMany({
    where: { schoolId, classId: lesson.classId, id: { in: studentIds } },
    select: { id: true },
  });
  if (validStudents.length !== studentIds.length) {
    throw new Error("One or more students do not belong to this lesson's class.");
  }

  await prisma.$transaction([
    prisma.attendance.deleteMany({
      where: {
        schoolId,
        lessonId,
        date: attendanceDate,
        studentId: { in: studentIds },
      },
    }),
    prisma.attendance.createMany({
      data: records.map((record) => ({
        schoolId,
        studentId: record.studentId,
        lessonId,
        date: attendanceDate,
        status: record.status,
        present: record.status === "PRESENT",
        note: record.note ?? null,
      })),
    }),
  ]);

  return records.length;
}

export async function deleteAttendanceRecord({
  schoolId,
  id,
}: {
  schoolId: string;
  id: number;
}) {
  return prisma.attendance.deleteMany({ where: { id, schoolId } });
}

export async function getStudentAttendanceStats(schoolId: string, studentId: string) {
  const student = await prisma.student.findFirst({
    where: { id: studentId, schoolId },
    select: { id: true },
  });
  if (!student) return null;

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [grouped, recentHistory] = await Promise.all([
    prisma.attendance.groupBy({
      by: ["status"],
      where: { schoolId, studentId },
      _count: { _all: true },
    }),
    prisma.attendance.findMany({
      where: { schoolId, studentId, date: { gte: thirtyDaysAgo } },
      orderBy: { date: "desc" },
      select: {
        date: true,
        status: true,
        lesson: { select: { subject: { select: { name: true } } } },
      },
    }),
  ]);

  const counts = normalizeAttendanceStatusCounts(grouped);
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
  let consecutiveAbsences = 0;
  for (const record of recentHistory) {
    if (record.status !== "ABSENT") break;
    consecutiveAbsences += 1;
  }

  return {
    total,
    present: counts.PRESENT,
    absent: counts.ABSENT,
    late: counts.LATE,
    excused: counts.EXCUSED,
    attendanceRate: total > 0 ? Math.round((counts.PRESENT / total) * 100) : 0,
    consecutiveAbsences,
    recentHistory: [...recentHistory].reverse(),
  };
}

export async function getClassAttendanceStats(schoolId: string, classId: number) {
  const students = await prisma.student.findMany({
    where: { schoolId, classId },
    select: { id: true, name: true, surname: true, img: true },
  });
  if (students.length === 0) return [];

  const grouped = await prisma.attendance.groupBy({
    by: ["studentId", "status"],
    where: { schoolId, studentId: { in: students.map((student) => student.id) } },
    _count: { _all: true },
  });
  const countsByStudent = new Map<string, Record<string, number>>();
  for (const row of grouped) {
    const counts = countsByStudent.get(row.studentId) ?? {};
    counts[row.status] = row._count._all;
    countsByStudent.set(row.studentId, counts);
  }

  return students.map((student) => {
    const counts = countsByStudent.get(student.id) ?? {};
    const total = Object.values(counts).reduce((sum, value) => sum + value, 0);
    const present = counts.PRESENT ?? 0;
    return {
      ...student,
      total,
      present,
      absent: counts.ABSENT ?? 0,
      rate: total > 0 ? Math.round((present / total) * 100) : 0,
    };
  });
}

export async function getSchoolAttendanceOverview(schoolId: string) {
  const now = new Date();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);
  const since = new Date(today);
  since.setDate(since.getDate() - 30);

  const [counts, students] = await Promise.all([
    getAttendanceStatusCounts({ schoolId, start: today, end: todayEnd }),
    prisma.student.findMany({
      where: { schoolId },
      select: { id: true, name: true, surname: true, class: { select: { name: true } } },
    }),
  ]);
  const flagged = await getFlaggedAttendanceStudents({ schoolId, students, since });

  return {
    todayTotal: Object.values(counts).reduce((sum, count) => sum + count, 0),
    todayPresent: counts.PRESENT,
    todayAbsent: counts.ABSENT,
    todayLate: counts.LATE,
    flagged,
  };
}
