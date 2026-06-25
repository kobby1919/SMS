import prisma from "@/src/lib/prisma";
import { computeAggregate } from "@/src/lib/caGrades";
import type { CalendarLesson } from "@/src/components/BigCalendar";
import type { Term } from "@/src/generated/prisma";

function absenceStreak(records: { status: string }[]): number {
  let streak = 0;
  for (const record of records) {
    if (record.status !== "ABSENT") break;
    streak += 1;
  }
  return streak;
}

export async function getParentDashboardData(userId: string, schoolId: string) {
  const parent = await prisma.parent.findFirst({
    where: { id: userId, schoolId },
    include: {
      students: {
        where: { schoolId },
        include: { class: { select: { id: true, name: true } } },
        orderBy: { name: "asc" },
      },
    },
  });
  const children = parent?.students ?? [];
  if (children.length === 0) return { parent, childrenData: [] };

  const childIds = children.map((child) => child.id);
  const classIds = [...new Set(children.map((child) => child.classId))];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayEnd = new Date(today);
  todayEnd.setHours(23, 59, 59, 999);
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [lessons, attendance, assessments, classCounts] = await Promise.all([
    prisma.lesson.findMany({
      where: { schoolId, classId: { in: classIds } },
      include: {
        subject: { select: { name: true } },
        teacher: { select: { name: true, surname: true } },
      },
      orderBy: [{ day: "asc" }, { startTime: "asc" }],
    }),
    prisma.attendance.findMany({
      where: { schoolId, studentId: { in: childIds }, date: { gte: thirtyDaysAgo } },
      include: { lesson: { include: { subject: { select: { name: true } } } } },
      orderBy: [{ studentId: "asc" }, { date: "desc" }],
    }),
    prisma.continuousAssessment.findMany({
      where: { schoolId, studentId: { in: childIds } },
      include: { subject: { select: { name: true } } },
      orderBy: [{ academicYear: "asc" }, { term: "asc" }],
    }),
    prisma.student.groupBy({
      by: ["classId"],
      where: { schoolId, classId: { in: classIds } },
      _count: { _all: true },
    }),
  ]);

  const lessonsByClass = new Map<number, CalendarLesson[]>();
  for (const lesson of lessons) {
    const rows = lessonsByClass.get(lesson.classId) ?? [];
    rows.push({
      title: lesson.subject.name,
      day: lesson.day,
      startTime: lesson.startTime,
      endTime: lesson.endTime,
      teacher: `${lesson.teacher.name} ${lesson.teacher.surname}`,
    });
    lessonsByClass.set(lesson.classId, rows);
  }

  const attendanceByStudent = new Map<string, typeof attendance>();
  for (const record of attendance) {
    const rows = attendanceByStudent.get(record.studentId) ?? [];
    rows.push(record);
    attendanceByStudent.set(record.studentId, rows);
  }

  const assessmentsByStudent = new Map<string, typeof assessments>();
  for (const record of assessments) {
    const rows = assessmentsByStudent.get(record.studentId) ?? [];
    rows.push(record);
    assessmentsByStudent.set(record.studentId, rows);
  }

  const prepared = children.map((child) => {
    const childAttendance = attendanceByStudent.get(child.id) ?? [];
    const childAssessments = assessmentsByStudent.get(child.id) ?? [];
    const groupMap = new Map<string, typeof childAssessments>();
    for (const record of childAssessments) {
      const key = `${record.academicYear}__${record.term}`;
      const rows = groupMap.get(key) ?? [];
      rows.push(record);
      groupMap.set(key, rows);
    }
    const termGroups = Array.from(groupMap.entries()).map(([key, records]) => {
      const [year, term] = key.split("__");
      const scores = records.map((record) => record.totalScore);
      return {
        term,
        year,
        records,
        avgScore: scores.length
          ? Math.round((scores.reduce((sum, score) => sum + score, 0) / scores.length) * 10) / 10
          : 0,
        aggregate: computeAggregate(records.map((record) => record.gradePoint)),
      };
    });
    return {
      child,
      childAttendance,
      termGroups,
      latestGroup: termGroups.at(-1) ?? null,
      prevGroup: termGroups.at(-2) ?? null,
    };
  });

  const latestScopes = prepared.flatMap(({ child, latestGroup }) =>
    latestGroup
      ? [{ classId: child.classId, term: latestGroup.term as Term, academicYear: latestGroup.year }]
      : [],
  );
  const classAssessments = latestScopes.length
    ? await prisma.continuousAssessment.findMany({
        where: { schoolId, OR: latestScopes },
        select: { classId: true, term: true, academicYear: true, studentId: true, gradePoint: true },
      })
    : [];
  const classSizeById = new Map(classCounts.map((row) => [row.classId, row._count._all]));

  const childrenData = prepared.map(({ child, childAttendance, termGroups, latestGroup, prevGroup }) => {
    const streak = absenceStreak(childAttendance.slice(0, 7));
    const present = childAttendance.filter((row) => row.status === "PRESENT").length;
    const absent = childAttendance.filter((row) => row.status === "ABSENT").length;
    const late = childAttendance.filter((row) => row.status === "LATE").length;
    const excused = childAttendance.filter((row) => row.status === "EXCUSED").length;
    const total = childAttendance.length;
    const trendDiff = prevGroup && latestGroup
      ? Math.round((latestGroup.avgScore - prevGroup.avgScore) * 10) / 10
      : 0;
    const trend = !prevGroup || !latestGroup
      ? "neutral"
      : trendDiff > 2
        ? "up"
        : trendDiff < -2
          ? "down"
          : "neutral";

    let myPosition = 0;
    if (latestGroup) {
      const peers = classAssessments.filter(
        (row) =>
          row.classId === child.classId &&
          row.term === latestGroup.term &&
          row.academicYear === latestGroup.year,
      );
      const gradePoints = new Map<string, number[]>();
      for (const row of peers) {
        const values = gradePoints.get(row.studentId) ?? [];
        values.push(row.gradePoint);
        gradePoints.set(row.studentId, values);
      }
      const ranked = Array.from(gradePoints, ([studentId, values]) => ({
        studentId,
        aggregate: computeAggregate(values),
      })).sort((a, b) => a.aggregate - b.aggregate);
      myPosition = ranked.findIndex((row) => row.studentId === child.id) + 1;
    }

    const sortedByGradePoint = latestGroup
      ? [...latestGroup.records].sort((a, b) => a.gradePoint - b.gradePoint)
      : [];

    return {
      id: child.id,
      name: child.name,
      surname: child.surname,
      className: child.class.name,
      classId: child.classId,
      lessons: lessonsByClass.get(child.classId) ?? [],
      streak,
      isFlagged: streak >= 3,
      todayAttendance: childAttendance.filter(
        (row) => row.date >= today && row.date <= todayEnd,
      ),
      history: childAttendance,
      stats: {
        total,
        present,
        absent,
        late,
        excused,
        rate: total > 0 ? Math.round((present / total) * 100) : 0,
      },
      ca: {
        latestGroup,
        prevGroup,
        termGroups,
        trend,
        trendDiff,
        myPosition,
        classSize: classSizeById.get(child.classId) ?? 0,
        bestSubject: sortedByGradePoint.at(0) ?? null,
        weakSubject: sortedByGradePoint.at(-1) ?? null,
      },
    };
  });

  return { parent, childrenData };
}
