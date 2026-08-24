import prisma from "@/src/lib/prisma";
import { computeAggregate } from "@/src/lib/caGrades";
import type { CalendarLesson } from "@/src/components/BigCalendar";
import type { AttendanceStatus, Term } from "@/src/generated/prisma";
import {
  syncParentNotificationsFromSources,
  type ParentNotificationFeedItem,
} from "@/src/lib/services/parent-notifications";

export type ParentActivityFeedItem = ParentNotificationFeedItem;

export type ParentAcademicProgressSubject = {
  subjectId: number;
  subjectName: string;
  score: number;
  maxScore: number;
  grade: string;
  trend: "up" | "down" | "steady" | "new";
  change: number;
  status: "strong" | "watch" | "support" | "not-started";
  isMature: boolean;
  hasCARecord: boolean;
};

export type ParentAcademicProgress = {
  completionRate: number;
  completedSubjects: number;
  expectedSubjects: number;
  averageScore: number;
  averageCAMarks: number;
  classworkWeight: number;
  reportReadySubjects: number;
  hasReportScores: boolean;
  trend: "up" | "down" | "steady" | "new";
  trendDiff: number;
  subjects: ParentAcademicProgressSubject[];
  focusSubjects: ParentAcademicProgressSubject[];
};

export type ParentRiskAlert = {
  id: string;
  childId?: string;
  childName?: string;
  severity: "high" | "medium" | "low";
  title: string;
  description: string;
  actionLabel: string;
  href: string;
};

export type ParentFinanceSummary = {
  totalBilled: number;
  totalPaid: number;
  outstanding: number;
  paymentRate: number;
  unpaidBills: number;
  lastPayment?: {
    amount: number;
    date: Date;
    receiptNumber: string;
  };
};

export type ParentHomeworkSummary = {
  dueSoon: number;
  overdue: number;
  submitted: number;
  missing: number;
  assignments: {
    id: number;
    title: string;
    subjectName: string;
    dueDate: Date;
    status: "pending" | "submitted" | "late" | "missing" | "excused" | "overdue" | "due-soon" | "upcoming";
  }[];
};

export type ParentCommunicationSummary = {
  teacherNames: string[];
  latestAnnouncement?: {
    title: string;
    date: Date;
  };
};

export type ParentWeeklyDigest = {
  attendanceRecords: number;
  academicUpdates: number;
  financeUpdates: number;
  homeworkUpdates: number;
  notices: number;
};

export type ParentTrustScore = {
  score: number;
  signals: {
    label: string;
    ok: boolean;
    detail: string;
  }[];
};

export type ParentAttendanceInsight = {
  tone: "good" | "warning" | "danger" | "neutral";
  title: string;
  detail: string;
};

function absenceStreak(records: { status: string }[]): number {
  let streak = 0;
  for (const record of records) {
    if (record.status !== "ABSENT") break;
    streak += 1;
  }
  return streak;
}

function buildAttendanceInsight({
  todayRecords,
  weeklyLate,
  absenceStreak,
  rate,
  total,
}: {
  todayRecords: { status: AttendanceStatus }[];
  weeklyLate: number;
  absenceStreak: number;
  rate: number;
  total: number;
}): ParentAttendanceInsight {
  const todayStatuses = todayRecords.map((record) => record.status);
  const todayStatus = todayStatuses.includes("ABSENT")
    ? "ABSENT"
    : todayStatuses.includes("LATE")
      ? "LATE"
      : todayStatuses.includes("EXCUSED")
        ? "EXCUSED"
        : todayStatuses.at(0);

  if (!todayStatus) {
    return {
      tone: "neutral",
      title: "Not marked today",
      detail: "The school has not published today's attendance yet.",
    };
  }

  if (absenceStreak >= 3) {
    return {
      tone: "danger",
      title: "Consecutive absence risk",
      detail: `Absent for ${absenceStreak} recent school days in a row.`,
    };
  }

  if (todayStatus === "ABSENT") {
    return {
      tone: "warning",
      title: "Absent today",
      detail: "The school has marked this child absent today.",
    };
  }

  if (todayStatus === "LATE") {
    return {
      tone: "warning",
      title: "Late today",
      detail: weeklyLate >= 2 ? `Late ${weeklyLate} times in the last 7 days.` : "Arrival was marked late today.",
    };
  }

  if (weeklyLate >= 2) {
    return {
      tone: "warning",
      title: "Late pattern this week",
      detail: `Late ${weeklyLate} times in the last 7 days.`,
    };
  }

  if (total > 0 && rate >= 90) {
    return {
      tone: "good",
      title: "Strong attendance",
      detail: `${rate}% attendance rate over the last 30 days.`,
    };
  }

  if (total > 0 && rate < 75) {
    return {
      tone: "warning",
      title: "Attendance needs attention",
      detail: `${rate}% attendance rate over the last 30 days.`,
    };
  }

  return {
    tone: "good",
    title: "Attendance is being tracked",
    detail: `${total} attendance records are available for the last 30 days.`,
  };
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
  if (children.length === 0) {
    return {
      parent,
      childrenData: [],
      activityFeed: [],
      riskAlerts: [],
      familyTrustScore: 0,
    };
  }

  const childIds = children.map((child) => child.id);
  const classIds = [...new Set(children.map((child) => child.classId))];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayEnd = new Date(today);
  todayEnd.setHours(23, 59, 59, 999);
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const twoWeeksAgo = new Date(today);
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
  const twoWeeksFromNow = new Date(today);
  twoWeeksFromNow.setDate(twoWeeksFromNow.getDate() + 14);
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const [lessons, attendance, assessments, caActivityScores, classCounts, assignments, homeworkSubmissions, announcements, bills, payments, caConfigs] = await Promise.all([
    prisma.lesson.findMany({
      where: { schoolId, classId: { in: classIds } },
      include: {
        subject: { select: { id: true, name: true } },
        teacher: { select: { name: true, surname: true } },
      },
      orderBy: [{ day: "asc" }, { startTime: "asc" }],
    }),
    prisma.attendance.findMany({
      where: { schoolId, studentId: { in: childIds }, date: { gte: thirtyDaysAgo } },
      include: {
        lesson: {
          include: {
            subject: { select: { name: true } },
            teacher: { select: { name: true, surname: true } },
          },
        },
      },
      orderBy: [{ studentId: "asc" }, { date: "desc" }],
    }),
    prisma.continuousAssessment.findMany({
      where: { schoolId, studentId: { in: childIds } },
      include: { subject: { select: { name: true } } },
      orderBy: [{ academicYear: "asc" }, { term: "asc" }],
    }),
    prisma.cAActivityScore.findMany({
      where: { schoolId, studentId: { in: childIds } },
      select: {
        studentId: true,
        createdAt: true,
        activity: {
          select: {
            classId: true,
            subjectId: true,
            bucket: { select: { term: true, academicYear: true } },
          },
        },
      },
    }),
    prisma.student.groupBy({
      by: ["classId"],
      where: { schoolId, classId: { in: classIds } },
      _count: { _all: true },
    }),
    prisma.assignment.findMany({
      where: {
        schoolId,
        dueDate: { gte: twoWeeksAgo, lte: twoWeeksFromNow },
        lesson: { classId: { in: classIds } },
      },
      include: {
        lesson: {
          select: {
            classId: true,
            subject: { select: { name: true } },
          },
        },
      },
      orderBy: { dueDate: "asc" },
      take: 20,
    }),
    prisma.homeworkSubmission.findMany({
      where: {
        schoolId,
        studentId: { in: childIds },
        assignment: { dueDate: { gte: twoWeeksAgo, lte: twoWeeksFromNow } },
      },
      include: {
        assignment: {
          select: {
            id: true,
            title: true,
            dueDate: true,
            lesson: {
              select: {
                subject: { select: { name: true } },
              },
            },
          },
        },
      },
      orderBy: [{ status: "asc" }, { assignment: { dueDate: "asc" } }],
      take: 60,
    }),
    prisma.announcement.findMany({
      where: {
        schoolId,
        date: { gte: thirtyDaysAgo },
        AND: [
          { OR: [{ classId: null }, { classId: { in: classIds } }] },
          { OR: [{ expiresAt: null }, { expiresAt: { gte: today } }] },
        ],
      },
      orderBy: [{ priority: "desc" }, { date: "desc" }],
      take: 20,
    }),
    prisma.studentBill.findMany({
      where: { schoolId, studentId: { in: childIds } },
      include: {
        feeStructure: { select: { title: true, term: true, academicYear: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 20,
    }),
    prisma.payment.findMany({
      where: {
        schoolId,
        status: "CONFIRMED",
        studentBill: { studentId: { in: childIds } },
      },
      include: {
        studentBill: {
          select: {
            id: true,
            studentId: true,
            balance: true,
            status: true,
            feeStructure: { select: { title: true } },
          },
        },
      },
      orderBy: { paymentDate: "desc" },
      take: 20,
    }),
    prisma.cAConfig.findMany({
      where: { schoolId },
      select: { academicYear: true, classworkWeight: true },
    }),
  ]);
  const caConfigByYear = new Map(caConfigs.map((config) => [config.academicYear, config]));

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

  const activityBackedCAKeys = new Set(
    caActivityScores.map(
      (score) =>
        `${score.studentId}__${score.activity.subjectId}__${score.activity.classId}__${score.activity.bucket.term}__${score.activity.bucket.academicYear}`,
    ),
  );
  const firstActivityScoreAtByCAKey = new Map<string, Date>();
  for (const score of caActivityScores) {
    const key = `${score.studentId}__${score.activity.subjectId}__${score.activity.classId}__${score.activity.bucket.term}__${score.activity.bucket.academicYear}`;
    const existing = firstActivityScoreAtByCAKey.get(key);
    if (!existing || score.createdAt < existing) {
      firstActivityScoreAtByCAKey.set(key, score.createdAt);
    }
  }

  const subjectIdsByClass = new Map<number, Map<number, string>>();
  for (const lesson of lessons) {
    const rows = subjectIdsByClass.get(lesson.classId) ?? new Map<number, string>();
    rows.set(lesson.subject.id, lesson.subject.name);
    subjectIdsByClass.set(lesson.classId, rows);
  }
  const homeworkSubmissionsByStudent = new Map<string, typeof homeworkSubmissions>();
  for (const submission of homeworkSubmissions) {
    const rows = homeworkSubmissionsByStudent.get(submission.studentId) ?? [];
    rows.push(submission);
    homeworkSubmissionsByStudent.set(submission.studentId, rows);
  }
  const billsByStudent = new Map<string, typeof bills>();
  for (const bill of bills) {
    const rows = billsByStudent.get(bill.studentId) ?? [];
    rows.push(bill);
    billsByStudent.set(bill.studentId, rows);
  }
  const paymentsByStudent = new Map<string, typeof payments>();
  for (const payment of payments) {
    const rows = paymentsByStudent.get(payment.studentBill.studentId) ?? [];
    rows.push(payment);
    paymentsByStudent.set(payment.studentBill.studentId, rows);
  }
  const teacherNamesByClass = new Map<number, Set<string>>();
  for (const lesson of lessons) {
    const rows = teacherNamesByClass.get(lesson.classId) ?? new Set<string>();
    rows.add(`${lesson.teacher.name} ${lesson.teacher.surname}`);
    teacherNamesByClass.set(lesson.classId, rows);
  }

  const activityFeed = await syncParentNotificationsFromSources({
    schoolId,
    parentId: userId,
    children,
    attendance: attendance.slice(0, 30),
    assessments: assessments.slice(-30),
    assignments,
    announcements,
    bills,
    payments,
  });

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
      const reportReadyRecords = records.filter((record) => record.examScore > 0);
      const scores = reportReadyRecords.map((record) => record.totalScore);
      const caScores = records.map((record) => record.classworkScore);
      return {
        term,
        year,
        records,
        reportReadyRecords,
        avgScore: scores.length
          ? Math.round((scores.reduce((sum, score) => sum + score, 0) / scores.length) * 10) / 10
          : 0,
        avgCAMarks: caScores.length
          ? Math.round((caScores.reduce((sum, score) => sum + score, 0) / caScores.length) * 10) / 10
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
    const childBills = billsByStudent.get(child.id) ?? [];
    const childPayments = paymentsByStudent.get(child.id) ?? [];
    const childHomeworkSubmissions = homeworkSubmissionsByStudent.get(child.id) ?? [];
    const present = childAttendance.filter((row) => row.status === "PRESENT").length;
    const absent = childAttendance.filter((row) => row.status === "ABSENT").length;
    const late = childAttendance.filter((row) => row.status === "LATE").length;
    const excused = childAttendance.filter((row) => row.status === "EXCUSED").length;
    const total = childAttendance.length;
    const rate = total > 0 ? Math.round((present / total) * 100) : 0;
    const todayAttendance = childAttendance.filter(
      (row) => row.date >= today && row.date <= todayEnd,
    );
    const weeklyLate = childAttendance.filter((row) => row.date >= sevenDaysAgo && row.status === "LATE").length;
    const attendanceInsight = buildAttendanceInsight({
      todayRecords: todayAttendance,
      weeklyLate,
      absenceStreak: streak,
      rate,
      total,
    });
    const trendDiff = prevGroup && latestGroup && prevGroup.reportReadyRecords.length > 0 && latestGroup.reportReadyRecords.length > 0
      ? Math.round((latestGroup.avgScore - prevGroup.avgScore) * 10) / 10
      : 0;
    const trend = !prevGroup || !latestGroup || prevGroup.reportReadyRecords.length === 0 || latestGroup.reportReadyRecords.length === 0
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

    const expectedSubjects = subjectIdsByClass.get(child.classId) ?? new Map<number, string>();
    const previousBySubject = new Map(prevGroup?.records.map((record) => [record.subjectId, record]) ?? []);
    const classworkWeight = caConfigByYear.get(latestGroup?.year ?? "")?.classworkWeight ?? 30;
    const latestSubjects = (latestGroup?.records ?? []).filter((record) =>
      (expectedSubjects.size === 0 || expectedSubjects.has(record.subjectId)) &&
      activityBackedCAKeys.has(
        `${record.studentId}__${record.subjectId}__${record.classId}__${record.term}__${record.academicYear}`,
      ),
    );
    const sortedByGradePoint = [...latestSubjects].sort((a, b) => a.gradePoint - b.gradePoint);
    const recordedProgressSubjects = latestSubjects
      .map((record): ParentAcademicProgressSubject => {
        const previous = previousBySubject.get(record.subjectId);
        const change = previous
          ? Math.round((record.totalScore - previous.totalScore) * 10) / 10
          : 0;
        const caKey = `${record.studentId}__${record.subjectId}__${record.classId}__${record.term}__${record.academicYear}`;
        const firstScoreAt = firstActivityScoreAtByCAKey.get(caKey);
        const ageInDays = firstScoreAt
          ? Math.floor((today.getTime() - firstScoreAt.getTime()) / (1000 * 60 * 60 * 24))
          : 0;
        const isMature = ageInDays >= 21;
        return {
          subjectId: record.subjectId,
          subjectName: record.subject.name,
          score: record.classworkScore,
          maxScore: classworkWeight,
          grade: record.grade,
          trend: previous ? (change > 2 ? "up" : change < -2 ? "down" : "steady") : "new",
          change,
          status: !isMature
            ? "watch"
            : (record.classworkScore / Math.max(classworkWeight, 1)) * 100 >= 70
              ? "strong"
              : (record.classworkScore / Math.max(classworkWeight, 1)) * 100 >= 50
                ? "watch"
                : "support",
          isMature,
          hasCARecord: true,
        };
      })
      .sort((a, b) => a.score - b.score);
    const progressBySubjectId = new Map(recordedProgressSubjects.map((subject) => [subject.subjectId, subject]));
    const progressSubjects: ParentAcademicProgressSubject[] = expectedSubjects.size > 0
      ? Array.from(expectedSubjects.entries())
          .map(([subjectId, subjectName]) =>
            progressBySubjectId.get(subjectId) ?? {
              subjectId,
              subjectName,
              score: 0,
              maxScore: classworkWeight,
              grade: "Pending",
              trend: "new" as const,
              change: 0,
              status: "not-started" as const,
              isMature: false,
              hasCARecord: false,
            },
          )
          .sort((a, b) => a.subjectName.localeCompare(b.subjectName))
      : recordedProgressSubjects;
    const completedSubjects = latestSubjects.length;
    const reportReadySubjects = (latestGroup?.reportReadyRecords ?? []).filter((record) =>
      (expectedSubjects.size === 0 || expectedSubjects.has(record.subjectId)) &&
      activityBackedCAKeys.has(
        `${record.studentId}__${record.subjectId}__${record.classId}__${record.term}__${record.academicYear}`,
      ),
    );
    const averageScore = reportReadySubjects.length
      ? Math.round(
          (reportReadySubjects.reduce((sum, record) => sum + record.totalScore, 0) / reportReadySubjects.length) * 10,
        ) / 10
      : 0;
    const averageCAMarks = completedSubjects
      ? Math.round((latestSubjects.reduce((sum, record) => sum + record.classworkScore, 0) / completedSubjects) * 100) / 100
      : 0;
    const academicProgress: ParentAcademicProgress = {
      completionRate: expectedSubjects.size > 0 ? Math.round((completedSubjects / expectedSubjects.size) * 100) : 0,
      completedSubjects,
      expectedSubjects: expectedSubjects.size,
      averageScore,
      averageCAMarks,
      classworkWeight,
      reportReadySubjects: reportReadySubjects.length,
      hasReportScores: reportReadySubjects.length > 0,
      trend: !prevGroup || !latestGroup
        ? "new"
        : trendDiff > 2
          ? "up"
          : trendDiff < -2
            ? "down"
            : "steady",
      trendDiff,
      subjects: progressSubjects,
      focusSubjects: progressSubjects
        .filter((subject) => subject.isMature && (subject.status !== "strong" || subject.trend === "down"))
        .slice(0, 3),
    };
    const financeSummary: ParentFinanceSummary = {
      totalBilled: childBills.reduce((sum, bill) => sum + Number(bill.totalAmount), 0),
      totalPaid: childBills.reduce((sum, bill) => sum + Number(bill.amountPaid), 0),
      outstanding: childBills.reduce((sum, bill) => sum + Number(bill.balance), 0),
      paymentRate: childBills.length
        ? Math.round(
            (childBills.reduce((sum, bill) => sum + Number(bill.amountPaid), 0) /
              Math.max(childBills.reduce((sum, bill) => sum + Number(bill.totalAmount), 0), 1)) *
              100,
          )
        : 100,
      unpaidBills: childBills.filter((bill) => Number(bill.balance) > 0).length,
      lastPayment: childPayments[0]
        ? {
            amount: Number(childPayments[0].amount),
            date: childPayments[0].paymentDate,
            receiptNumber: childPayments[0].receiptNumber,
          }
        : undefined,
    };
    const homeworkSummary: ParentHomeworkSummary = {
      dueSoon: childHomeworkSubmissions.filter((submission) =>
        submission.assignment.dueDate >= today &&
        submission.assignment.dueDate <= twoWeeksFromNow &&
        submission.status === "PENDING",
      ).length,
      overdue: childHomeworkSubmissions.filter((submission) =>
        submission.assignment.dueDate < today &&
        submission.status === "PENDING",
      ).length,
      submitted: childHomeworkSubmissions.filter((submission) => submission.status === "SUBMITTED").length,
      missing: childHomeworkSubmissions.filter((submission) => submission.status === "MISSING").length,
      assignments: childHomeworkSubmissions.slice(0, 5).map((submission) => ({
        id: submission.assignment.id,
        title: submission.assignment.title,
        subjectName: submission.assignment.lesson.subject.name,
        dueDate: submission.assignment.dueDate,
        status:
          submission.status === "SUBMITTED"
            ? "submitted"
            : submission.status === "LATE"
              ? "late"
              : submission.status === "MISSING"
                ? "missing"
                : submission.status === "EXCUSED"
                  ? "excused"
                  : submission.assignment.dueDate < today
                    ? "overdue"
                    : submission.assignment.dueDate <= twoWeeksFromNow
                      ? "due-soon"
                      : "upcoming",
      })),
    };
    const childAnnouncements = announcements.filter(
      (announcement) => announcement.classId === null || announcement.classId === child.classId,
    );
    const communicationSummary: ParentCommunicationSummary = {
      teacherNames: Array.from(teacherNamesByClass.get(child.classId) ?? []).slice(0, 4),
      latestAnnouncement: childAnnouncements[0]
        ? { title: childAnnouncements[0].title, date: childAnnouncements[0].date }
        : undefined,
    };
    const weeklyItems = activityFeed.filter(
      (item) => (!item.childId || item.childId === child.id) && item.occurredAt >= sevenDaysAgo,
    );
    const weeklyDigest: ParentWeeklyDigest = {
      attendanceRecords: weeklyItems.filter((item) => item.type === "ATTENDANCE").length,
      academicUpdates: weeklyItems.filter((item) => item.type === "ASSESSMENT").length,
      financeUpdates: weeklyItems.filter((item) => item.type === "BILL" || item.type === "PAYMENT").length,
      homeworkUpdates: weeklyItems.filter((item) => item.type === "ASSIGNMENT").length,
      notices: weeklyItems.filter((item) => item.type === "ANNOUNCEMENT").length,
    };
    const trustSignals: ParentTrustScore["signals"] = [
      {
        label: "Attendance",
        ok: total > 0,
        detail: total > 0 ? `${total} attendance records in 30 days` : "No recent attendance entries",
      },
      {
        label: "Academics",
        ok: academicProgress.completionRate >= 60 || academicProgress.completedSubjects > 0,
        detail:
          academicProgress.expectedSubjects > 0
            ? `${academicProgress.completedSubjects}/${academicProgress.expectedSubjects} CA subjects published`
            : `${academicProgress.completedSubjects} CA subjects published`,
      },
      {
        label: "Finance",
        ok: childBills.length > 0,
        detail: childBills.length > 0 ? `${childBills.length} fee bill records visible` : "No fee bill published yet",
      },
      {
        label: "Communication",
        ok: childAnnouncements.length > 0,
        detail: childAnnouncements.length > 0 ? `${childAnnouncements.length} notices in the last 30 days` : "No recent notices",
      },
    ];
    const trustScore: ParentTrustScore = {
      score: Math.round((trustSignals.filter((signal) => signal.ok).length / trustSignals.length) * 100),
      signals: trustSignals,
    };
    const riskAlerts: ParentRiskAlert[] = [
      ...(streak >= 3
        ? [{
            id: `attendance-risk-${child.id}`,
            childId: child.id,
            childName: `${child.name} ${child.surname}`,
            severity: "high" as const,
            title: "Consecutive absence risk",
            description: `${child.name} has been absent for ${streak} school days in a row.`,
            actionLabel: "View attendance",
            href: "/list/attendance",
          }]
        : []),
      ...(academicProgress.hasReportScores && academicProgress.trend === "down"
        ? [{
            id: `academic-trend-${child.id}`,
            childId: child.id,
            childName: `${child.name} ${child.surname}`,
            severity: "medium" as const,
            title: "Academic trend is dropping",
            description: `${child.name}'s average is ${Math.abs(academicProgress.trendDiff)}% lower than the previous term.`,
            actionLabel: "Open report",
            href: latestGroup
              ? `/list/report-cards/${child.id}?term=${latestGroup.term}&year=${latestGroup.year}&classId=${child.classId}`
              : "/list/report-cards",
          }]
        : []),
      ...(academicProgress.focusSubjects.some((subject) => subject.status === "support")
        ? [{
            id: `subject-support-${child.id}`,
            childId: child.id,
            childName: `${child.name} ${child.surname}`,
            severity: "medium" as const,
            title: "Subject support needed",
            description: `${child.name} needs support in ${academicProgress.focusSubjects.map((subject) => subject.subjectName).join(", ")}.`,
            actionLabel: "Review progress",
            href: "/parent",
          }]
        : []),
      ...(financeSummary.outstanding > 0
        ? [{
            id: `finance-balance-${child.id}`,
            childId: child.id,
            childName: `${child.name} ${child.surname}`,
            severity: "low" as const,
            title: "Outstanding fee balance",
            description: `GHS ${financeSummary.outstanding.toFixed(2)} is still outstanding.`,
            actionLabel: "View bills",
            href: "/parent/finance",
          }]
        : []),
    ];

    return {
      id: child.id,
      name: child.name,
      surname: child.surname,
      className: child.class.name,
      classId: child.classId,
      lessons: lessonsByClass.get(child.classId) ?? [],
      streak,
      isFlagged: streak >= 3,
      todayAttendance,
      attendanceInsight,
      history: childAttendance,
      stats: {
        total,
        present,
        absent,
        late,
        excused,
        rate,
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
      academicProgress,
      financeSummary,
      homeworkSummary,
      communicationSummary,
      weeklyDigest,
      trustScore,
      riskAlerts,
      activityFeed: activityFeed.filter((item) => !item.childId || item.childId === child.id).slice(0, 8),
    };
  });

  const riskAlerts = childrenData.flatMap((child) => child.riskAlerts).slice(0, 6);
  const familyTrustScore = childrenData.length
    ? Math.round(childrenData.reduce((sum, child) => sum + child.trustScore.score, 0) / childrenData.length)
    : 0;

  return { parent, childrenData, activityFeed, riskAlerts, familyTrustScore };
}
