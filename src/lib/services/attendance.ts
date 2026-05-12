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
