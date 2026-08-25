import prisma from "@/src/lib/prisma";
import {
  getFlaggedAttendanceStudents,
  normalizeAttendanceStatusCounts,
} from "@/src/lib/services/attendance";
import { getActiveAcademicPeriod } from "@/src/lib/services/academic-period";

const DAY_ENUM_MAP: Record<number, string> = {
  1: "MONDAY",
  2: "TUESDAY",
  3: "WEDNESDAY",
  4: "THURSDAY",
  5: "FRIDAY",
};

type CountType = "admin" | "teacher" | "student" | "parent";

export type AdminDashboardData = {
  counts: { type: CountType; count: number }[];
  boys: number;
  girls: number;
  attendanceData: { name: string; present: number; absent: number }[];
  financeData: { name: string; income: number; expense: number }[];
  timetableSnapshot: {
    totalLessons: number;
    totalClasses: number;
    todayLessons: number;
    todayDay: string;
  };
  attendanceSnapshot: {
    todayPresent: number;
    todayAbsent: number;
    todayLate: number;
    todayExcused: number;
    todayRate: number;
    totalStudents: number;
    flaggedCount: number;
    flagged: { name: string; surname: string; className: string; streak: number }[];
  };
  caSnapshot: {
    totalRecords: number;
    schoolAvg: number;
    configExists: boolean;
  };
  syllabusSnapshot: {
    total: number;
    published: number;
    draft: number;
  };
};

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function buildWeekDays(now: Date): { label: string; date: Date }[] {
  const weekDays: { label: string; date: Date }[] = [];
  const d = new Date(now);
  while (weekDays.length < 5) {
    const day = d.getDay();
    if (day !== 0 && day !== 6) {
      weekDays.unshift({
        label: d.toLocaleDateString("en-US", { weekday: "short" }),
        date: new Date(d),
      });
    }
    d.setDate(d.getDate() - 1);
  }
  return weekDays;
}

function aggregateAttendanceByDay(
  records: { date: Date; status: string }[],
  weekDays: { label: string; date: Date }[],
): { name: string; present: number; absent: number }[] {
  const buckets = new Map<string, { present: number; absent: number }>();
  for (const { date } of weekDays) {
    buckets.set(startOfDay(date).toISOString(), { present: 0, absent: 0 });
  }

  for (const r of records) {
    const key = startOfDay(r.date).toISOString();
    const bucket = buckets.get(key);
    if (!bucket) continue;
    if (r.status === "PRESENT") bucket.present += 1;
    if (r.status === "ABSENT") bucket.absent += 1;
  }

  return weekDays.map(({ label, date }) => {
    const bucket = buckets.get(startOfDay(date).toISOString()) ?? {
      present: 0,
      absent: 0,
    };
    return { name: label, present: bucket.present, absent: bucket.absent };
  });
}

function aggregateMonthlyScores(
  rows: {
    score: number;
    exam: { startTime: Date } | null;
    assignment: { dueDate: Date } | null;
  }[],
  monthNames: string[],
): { name: string; income: number; expense: number }[] {
  const buckets = monthNames.map((name) => ({
    name,
    examTotal: 0,
    examCount: 0,
    assignmentTotal: 0,
    assignmentCount: 0,
  }));

  for (const row of rows) {
    if (row.exam) {
      const month = row.exam.startTime.getMonth();
      buckets[month].examTotal += row.score;
      buckets[month].examCount += 1;
    }
    if (row.assignment) {
      const month = row.assignment.dueDate.getMonth();
      buckets[month].assignmentTotal += row.score;
      buckets[month].assignmentCount += 1;
    }
  }

  return buckets.map((bucket) => ({
    name: bucket.name,
    income:
      bucket.examCount > 0
        ? Math.round(bucket.examTotal / bucket.examCount)
        : 0,
    expense:
      bucket.assignmentCount > 0
        ? Math.round(bucket.assignmentTotal / bucket.assignmentCount)
        : 0,
  }));
}

/** Batched dashboard queries for the admin home page (avoids N+1 per student/day). */
export async function getAdminDashboardData(
  schoolId: string,
): Promise<AdminDashboardData> {
  const tenantWhere = { schoolId };
  const currentYear = new Date().getFullYear();
  const now = new Date();
  const weekDays = buildWeekDays(now);
  const monthNames = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  const todayEnum = DAY_ENUM_MAP[now.getDay()] ?? "MONDAY";
  const todayLabel = now.toLocaleDateString("en-US", { weekday: "long" });
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const weekStart = startOfDay(weekDays[0]?.date ?? now);
  const weekEnd = endOfDay(weekDays[weekDays.length - 1]?.date ?? now);
  const yearStart = new Date(currentYear, 0, 1);
  const yearEnd = new Date(currentYear, 11, 31, 23, 59, 59, 999);
  const absenceWindowStart = startOfDay(new Date(now));
  absenceWindowStart.setDate(absenceWindowStart.getDate() - 30);
  const activePeriod = await getActiveAcademicPeriod(schoolId);

  const [
    adminCount,
    teacherCount,
    studentCount,
    parentCount,
    boyCount,
    girlCount,
    totalLessons,
    totalClasses,
    todayLessons,
    todayAttendanceGrouped,
    totalStudents,
    totalCARecords,
    caConfigCount,
    totalSyllabi,
    publishedSyllabi,
    caAvgResult,
    weekAttendanceRecords,
    allStudents,
    yearlyScoreRows,
  ] = await Promise.all([
    prisma.admin.count({ where: tenantWhere }),
    prisma.teacher.count({ where: tenantWhere }),
    prisma.student.count({ where: tenantWhere }),
    prisma.parent.count({ where: tenantWhere }),
    prisma.student.count({ where: { ...tenantWhere, sex: "MALE" } }),
    prisma.student.count({ where: { ...tenantWhere, sex: "FEMALE" } }),
    prisma.lesson.count({ where: tenantWhere }),
    prisma.class.count({ where: tenantWhere }),
    prisma.lesson.count({
      where: { ...tenantWhere, day: todayEnum as "MONDAY" },
    }),
    prisma.attendance.groupBy({
      by: ["status"],
      where: {
        ...tenantWhere,
        date: { gte: todayStart, lte: todayEnd },
      },
      _count: { _all: true },
    }),
    prisma.student.count({ where: tenantWhere }),
    prisma.continuousAssessment.count({
      where: {
        ...tenantWhere,
        term: activePeriod.currentTerm,
        academicYear: activePeriod.academicYear,
      },
    }),
    prisma.cAConfig.count({
      where: {
        ...tenantWhere,
        isActive: true,
        academicYear: activePeriod.academicYear,
        currentTerm: activePeriod.currentTerm,
      },
    }),
    prisma.syllabus.count({ where: tenantWhere }),
    prisma.syllabus.count({ where: { ...tenantWhere, status: "PUBLISHED" } }),
    prisma.continuousAssessment.aggregate({
      _avg: { totalScore: true },
      where: {
        ...tenantWhere,
        term: activePeriod.currentTerm,
        academicYear: activePeriod.academicYear,
      },
    }),
    prisma.attendance.findMany({
      where: {
        ...tenantWhere,
        date: { gte: weekStart, lte: weekEnd },
        status: { in: ["PRESENT", "ABSENT"] },
      },
      select: { date: true, status: true },
    }),
    prisma.student.findMany({
      where: tenantWhere,
      select: {
        id: true,
        name: true,
        surname: true,
        class: { select: { name: true } },
      },
    }),
    prisma.result.findMany({
      where: {
        schoolId,
        OR: [
          { exam: { startTime: { gte: yearStart, lte: yearEnd } } },
          { assignment: { dueDate: { gte: yearStart, lte: yearEnd } } },
        ],
      },
      select: {
        score: true,
        exam: { select: { startTime: true } },
        assignment: { select: { dueDate: true } },
      },
    }),
  ]);

  const statusCounts = normalizeAttendanceStatusCounts(todayAttendanceGrouped);
  const todayPresent = statusCounts.PRESENT ?? 0;
  const todayAbsent = statusCounts.ABSENT ?? 0;
  const todayLate = statusCounts.LATE ?? 0;
  const todayExcused = statusCounts.EXCUSED ?? 0;

  const caAvg = Math.round((caAvgResult._avg.totalScore ?? 0) * 10) / 10;
  const attendanceData = aggregateAttendanceByDay(weekAttendanceRecords, weekDays);

  const financeData = aggregateMonthlyScores(yearlyScoreRows, monthNames);

  const flagged = await getFlaggedAttendanceStudents({
    schoolId,
    students: allStudents,
    since: absenceWindowStart,
  });
  const todayTotal = todayPresent + todayAbsent + todayLate + todayExcused;
  const todayRate =
    todayTotal > 0 ? Math.round((todayPresent / todayTotal) * 100) : 0;

  return {
    counts: [
      { type: "admin", count: adminCount },
      { type: "teacher", count: teacherCount },
      { type: "student", count: studentCount },
      { type: "parent", count: parentCount },
    ],
    boys: boyCount,
    girls: girlCount,
    attendanceData,
    financeData,
    timetableSnapshot: {
      totalLessons,
      totalClasses,
      todayLessons,
      todayDay: todayLabel,
    },
    attendanceSnapshot: {
      todayPresent,
      todayAbsent,
      todayLate,
      todayExcused,
      todayRate,
      totalStudents,
      flaggedCount: flagged.length,
      flagged: flagged.slice(0, 5),
    },
    caSnapshot: {
      totalRecords: totalCARecords,
      schoolAvg: caAvg,
      configExists: caConfigCount > 0,
    },
    syllabusSnapshot: {
      total: totalSyllabi,
      published: publishedSyllabi,
      draft: totalSyllabi - publishedSyllabi,
    },
  };
}

export async function getCachedAdminDashboardData(
  schoolId: string,
): Promise<AdminDashboardData> {
  return getAdminDashboardData(schoolId);
}
