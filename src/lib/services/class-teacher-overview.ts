import type { AttendanceStatus, BillStatus, Term } from "@/src/generated/prisma";
import prisma from "@/src/lib/prisma";
import { getActiveAcademicPeriod } from "@/src/lib/services/academic-period";
import { getClassReportReadiness, type ReportReadinessBlocker } from "@/src/lib/services/report-card-readiness";

const dayNames = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"] as const;

function startOfDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function endOfDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(23, 59, 59, 999);
  return copy;
}

function daysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return startOfDay(date);
}

function pct(done: number, total: number) {
  return total > 0 ? Math.round((done / total) * 100) : 0;
}

function statusLabel(status?: string) {
  if (status === "SUBMITTED") return "Submitted to admin";
  if (status === "REJECTED") return "Returned for correction";
  if (status === "PUBLISHED") return "Published";
  if (status === "UNPUBLISHED") return "Not submitted";
  return "Not submitted";
}

export type ClassTeacherOverview = Awaited<ReturnType<typeof getClassTeacherOverview>>;

export async function getClassTeacherOverview({
  schoolId,
  teacherId,
  classId,
}: {
  schoolId: string;
  teacherId: string;
  classId: number;
}) {
  const today = new Date();
  const todayStart = startOfDay(today);
  const todayEnd = endOfDay(today);
  const thirtyDaysAgo = daysAgo(30);
  const todayDay = dayNames[today.getDay()];

  const [activePeriod, klass] = await Promise.all([
    getActiveAcademicPeriod(schoolId),
    prisma.class.findFirst({
      where: { id: classId, schoolId, supervisorId: teacherId },
      select: {
        id: true,
        name: true,
        capacity: true,
        section: true,
        grade: { select: { level: true } },
        supervisor: { select: { id: true, name: true, surname: true } },
        students: {
          select: { id: true, name: true, surname: true, sex: true },
          orderBy: [{ surname: "asc" }, { name: "asc" }],
        },
        lessons: {
          select: {
            id: true,
            day: true,
            subjectId: true,
            subject: { select: { id: true, name: true } },
            teacher: { select: { id: true, name: true, surname: true, phone: true } },
          },
          orderBy: [{ subject: { name: "asc" } }],
        },
      },
    }),
  ]);

  if (!klass) return null;

  const studentIds = klass.students.map((student) => student.id);
  const lessonIds = klass.lessons.map((lesson) => lesson.id);
  const subjectIds = Array.from(new Set(klass.lessons.map((lesson) => lesson.subjectId)));

  const [
    todayAttendance,
    recentAttendanceCounts,
    caRecords,
    homeworkSubmissions,
    openBills,
    publication,
    readiness,
  ] = await Promise.all([
    lessonIds.length > 0
      ? prisma.attendance.findMany({
          where: {
            schoolId,
            lessonId: { in: lessonIds },
            date: { gte: todayStart, lte: todayEnd },
          },
          select: { studentId: true, lessonId: true, status: true },
        })
      : [],
    studentIds.length > 0
      ? prisma.attendance.groupBy({
          by: ["studentId", "status"],
          where: {
            schoolId,
            studentId: { in: studentIds },
            date: { gte: thirtyDaysAgo, lte: todayEnd },
          },
          _count: { _all: true },
        })
      : [],
    studentIds.length > 0 && subjectIds.length > 0
      ? prisma.continuousAssessment.findMany({
          where: {
            schoolId,
            classId,
            studentId: { in: studentIds },
            subjectId: { in: subjectIds },
            term: activePeriod.currentTerm,
            academicYear: activePeriod.academicYear,
          },
          select: {
            studentId: true,
            subjectId: true,
            classworkScore: true,
            examScore: true,
            subject: { select: { name: true } },
          },
        })
      : [],
    studentIds.length > 0
      ? prisma.homeworkSubmission.groupBy({
          by: ["studentId", "status"],
          where: {
            schoolId,
            studentId: { in: studentIds },
            updatedAt: { gte: thirtyDaysAgo },
          },
          _count: { _all: true },
        })
      : [],
    studentIds.length > 0
      ? prisma.studentBill.groupBy({
          by: ["studentId", "status"],
          where: {
            schoolId,
            studentId: { in: studentIds },
            status: { in: ["UNPAID", "PARTIAL", "OVERPAID"] },
          },
          _count: { _all: true },
        })
      : [],
    prisma.reportCardPublication.findUnique({
      where: {
        schoolId_classId_term_academicYear: {
          schoolId,
          classId,
          term: activePeriod.currentTerm,
          academicYear: activePeriod.academicYear,
        },
      },
      select: {
        status: true,
        submittedAt: true,
        reviewedAt: true,
        reviewNote: true,
        publishedAt: true,
      },
    }),
    getClassReportReadiness({
      schoolId,
      classId,
      term: activePeriod.currentTerm,
      academicYear: activePeriod.academicYear,
    }),
  ]);

  const studentCount = klass.students.length;
  const boys = klass.students.filter((student) => student.sex === "MALE").length;
  const girls = klass.students.filter((student) => student.sex === "FEMALE").length;
  const todayLessons = klass.lessons.filter((lesson) => lesson.day === todayDay);
  const attendanceByLesson = new Map<number, typeof todayAttendance>();
  for (const record of todayAttendance) {
    const rows = attendanceByLesson.get(record.lessonId) ?? [];
    rows.push(record);
    attendanceByLesson.set(record.lessonId, rows);
  }

  const attendanceSummary = todayAttendance.reduce(
    (summary, record) => {
      summary[record.status] += 1;
      return summary;
    },
    { PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0 } as Record<AttendanceStatus, number>,
  );
  const unmarkedLessons = todayLessons.filter((lesson) => {
    const records = attendanceByLesson.get(lesson.id) ?? [];
    return records.length < studentCount;
  });

  const subjectTeacherBySubject = new Map<number, { id: string; name: string; phone: string | null }>();
  const subjectNames = new Map<number, string>();
  for (const lesson of klass.lessons) {
    subjectNames.set(lesson.subjectId, lesson.subject.name);
    if (!subjectTeacherBySubject.has(lesson.subjectId)) {
      subjectTeacherBySubject.set(lesson.subjectId, {
        id: lesson.teacher.id,
        name: `${lesson.teacher.name} ${lesson.teacher.surname}`,
        phone: lesson.teacher.phone,
      });
    }
  }

  const caBySubject = new Map<number, typeof caRecords>();
  for (const record of caRecords) {
    const rows = caBySubject.get(record.subjectId) ?? [];
    rows.push(record);
    caBySubject.set(record.subjectId, rows);
  }
  const academicReadiness = subjectIds.map((subjectId) => {
    const records = caBySubject.get(subjectId) ?? [];
    const examReady = records.filter((record) => record.examScore > 0).length;
    return {
      subjectId,
      subjectName: subjectNames.get(subjectId) ?? "Subject",
      teacher: subjectTeacherBySubject.get(subjectId) ?? null,
      caStarted: records.length,
      examReady,
      studentCount,
      caPct: pct(records.length, studentCount),
      examPct: pct(examReady, studentCount),
    };
  }).sort((a, b) => a.subjectName.localeCompare(b.subjectName));

  const blockersBySubject = new Map<number, ReportReadinessBlocker[]>();
  for (const blocker of readiness.blockers) {
    const rows = blockersBySubject.get(blocker.subjectId) ?? [];
    rows.push(blocker);
    blockersBySubject.set(blocker.subjectId, rows);
  }
  const teacherFollowUp = Array.from(blockersBySubject.entries()).map(([subjectId, blockers]) => {
    const missingCA = blockers.filter((blocker) => blocker.reason === "MISSING_CA").length;
    const missingExam = blockers.filter((blocker) => blocker.reason === "MISSING_EXAM").length;
    return {
      subjectId,
      subjectName: subjectNames.get(subjectId) ?? blockers[0]?.subjectName ?? "Subject",
      teacher: subjectTeacherBySubject.get(subjectId) ?? null,
      missingCA,
      missingExam,
      blockerCount: blockers.length,
    };
  }).sort((a, b) => b.blockerCount - a.blockerCount || a.subjectName.localeCompare(b.subjectName));

  const countByStudentStatus = new Map<string, Record<string, number>>();
  for (const row of recentAttendanceCounts) {
    const current = countByStudentStatus.get(row.studentId) ?? {};
    current[row.status] = row._count._all;
    countByStudentStatus.set(row.studentId, current);
  }
  for (const row of homeworkSubmissions) {
    const current = countByStudentStatus.get(row.studentId) ?? {};
    current[`HOMEWORK_${row.status}`] = row._count._all;
    countByStudentStatus.set(row.studentId, current);
  }
  for (const row of openBills) {
    const current = countByStudentStatus.get(row.studentId) ?? {};
    current[`BILL_${row.status}`] = row._count._all;
    countByStudentStatus.set(row.studentId, current);
  }

  const caByStudent = new Map<string, typeof caRecords>();
  for (const record of caRecords) {
    const rows = caByStudent.get(record.studentId) ?? [];
    rows.push(record);
    caByStudent.set(record.studentId, rows);
  }
  const studentsNeedingAttention = klass.students
    .map((student) => {
      const counts = countByStudentStatus.get(student.id) ?? {};
      const studentCA = caByStudent.get(student.id) ?? [];
      const lowSubjects = studentCA.filter(
        (record) => activePeriod.classworkWeight > 0 && record.classworkScore / activePeriod.classworkWeight < 0.5,
      );
      const reasons = [
        (counts.ABSENT ?? 0) >= 2 ? `${counts.ABSENT} absences in 30 days` : null,
        (counts.LATE ?? 0) >= 3 ? `${counts.LATE} late marks in 30 days` : null,
        (counts.HOMEWORK_MISSING ?? 0) >= 2 ? `${counts.HOMEWORK_MISSING} missing homework` : null,
        lowSubjects.length > 0 ? `${lowSubjects.length} low CA subject${lowSubjects.length === 1 ? "" : "s"}` : null,
        (counts.BILL_UNPAID ?? 0) + (counts.BILL_PARTIAL ?? 0) > 0 ? "fee follow-up needed" : null,
      ].filter(Boolean) as string[];

      return {
        id: student.id,
        name: `${student.name} ${student.surname}`,
        reasons,
      };
    })
    .filter((student) => student.reasons.length > 0)
    .sort((a, b) => b.reasons.length - a.reasons.length || a.name.localeCompare(b.name));

  const publicationStatus = publication?.status ?? "UNSUBMITTED";

  return {
    class: {
      id: klass.id,
      name: klass.name,
      capacity: klass.capacity,
      section: klass.section,
      gradeLevel: klass.grade.level,
      supervisorName: klass.supervisor ? `${klass.supervisor.name} ${klass.supervisor.surname}` : "Not assigned",
    },
    activePeriod,
    classSize: {
      total: studentCount,
      boys,
      girls,
      capacity: klass.capacity,
    },
    todayAttendance: {
      present: attendanceSummary.PRESENT,
      absent: attendanceSummary.ABSENT,
      late: attendanceSummary.LATE,
      excused: attendanceSummary.EXCUSED,
      markedRecords: todayAttendance.length,
      expectedRecords: todayLessons.length * studentCount,
      unmarkedLessons: unmarkedLessons.map((lesson) => ({
        id: lesson.id,
        subjectName: lesson.subject.name,
        teacherName: `${lesson.teacher.name} ${lesson.teacher.surname}`,
      })),
    },
    studentsNeedingAttention,
    academicReadiness,
    teacherFollowUp,
    report: {
      status: publicationStatus,
      label: statusLabel(publicationStatus),
      submittedAt: publication?.submittedAt ?? null,
      reviewedAt: publication?.reviewedAt ?? null,
      reviewNote: publication?.reviewNote ?? null,
      publishedAt: publication?.publishedAt ?? null,
      readinessPct: pct(readiness.readyEntryCount, readiness.expectedEntryCount),
      readyEntryCount: readiness.readyEntryCount,
      expectedEntryCount: readiness.expectedEntryCount,
      missingCount: readiness.missingCount,
      missingCACount: readiness.missingCACount,
      missingExamCount: readiness.missingExamCount,
      isReady: readiness.isReady,
    },
  };
}
