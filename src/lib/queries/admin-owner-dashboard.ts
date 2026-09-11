import type {
  BillStatus,
  Day,
  ParentDeliveryStatus,
  ParentTeacherContactStatus,
  PaymentStatus,
  Prisma,
  ReportPublicationStatus,
  TeacherEscalationStatus,
  TeacherObligationStatus,
} from "@/src/generated/prisma";
import prisma from "@/src/lib/prisma";
import { getActiveAcademicPeriod } from "@/src/lib/services/academic-period";
import { getClassReportReadiness } from "@/src/lib/services/report-card-readiness";

const DAY_ENUM_MAP: Record<number, Day> = {
  1: "MONDAY",
  2: "TUESDAY",
  3: "WEDNESDAY",
  4: "THURSDAY",
  5: "FRIDAY",
};

const OPEN_ESCALATION_STATUSES: TeacherEscalationStatus[] = ["OPEN", "ACKNOWLEDGED"];
const ACTIVE_CONTACT_STATUSES: ParentTeacherContactStatus[] = ["PENDING", "ACKNOWLEDGED", "ESCALATED"];
const OPEN_BILL_STATUSES: BillStatus[] = ["UNPAID", "PARTIAL"];
const ACTIVE_PAYMENT_STATUSES: PaymentStatus[] = ["CONFIRMED", "PENDING"];
const ACTIVE_REPORT_STATUSES: ReportPublicationStatus[] = ["SUBMITTED", "REJECTED", "PUBLISHED", "UNPUBLISHED"];

export type AdminOwnerActionItem = {
  id: string;
  section: "schoolPulse" | "finance" | "teacherAccountability" | "academicReadiness" | "parentEngagement";
  severity: "info" | "warning" | "critical";
  title: string;
  detail: string;
  href: string;
};

export type AdminOwnerDashboardData = {
  activePeriod: {
    academicYear: string;
    currentTerm: string;
    classworkWeight: number;
    examWeight: number;
  };
  schoolPulse: {
    todayLabel: string;
    totalStudents: number;
    totalClasses: number;
    lessonsScheduledToday: number;
    lessonsMarkedToday: number;
    unmarkedLessonsToday: number;
    attendanceRecordsToday: number;
    present: number;
    absent: number;
    late: number;
    excused: number;
    attendanceRate: number;
    unmarkedLessons: {
      lessonId: number;
      className: string;
      subjectName: string;
      teacherName: string;
      expectedRecords: number;
      markedRecords: number;
      startTime: Date;
      endTime: Date;
    }[];
  };
  financeSnapshot: {
    expectedAmount: number;
    collectedAmount: number;
    outstandingAmount: number;
    collectionRate: number;
    billCounts: Record<BillStatus, number>;
    confirmedPaymentsToday: number;
    confirmedAmountToday: number;
    overdueBillCount: number;
    recentPayments: {
      id: number;
      receiptNumber: string;
      amount: number;
      status: PaymentStatus;
      paidBy: string;
      paymentDate: Date;
      studentName: string;
    }[];
  };
  teacherAccountability: {
    dutiesToday: number;
    dutiesCompletedToday: number;
    dutiesMissedOrEscalatedToday: number;
    openEscalations: number;
    pendingCorrectionRequests: number;
    weeklyDutyCounts: Record<TeacherObligationStatus, number>;
    recentEscalations: {
      id: string;
      teacherName: string;
      reason: string;
      status: TeacherEscalationStatus;
      escalatedAt: Date;
      title: string;
    }[];
  };
  academicReadiness: {
    caConfigExists: boolean;
    caRecords: number;
    schoolAverage: number;
    reportPublicationCounts: Record<ReportPublicationStatus, number>;
    classReadiness: {
      classId: number;
      className: string;
      studentCount: number;
      subjectCount: number;
      expectedEntryCount: number;
      readyEntryCount: number;
      missingCount: number;
      missingCACount: number;
      missingExamCount: number;
      readinessRate: number;
      status: "READY" | "BLOCKED" | "NO_SUBJECTS" | "NO_STUDENTS";
      href: string;
    }[];
  };
  parentEngagement: {
    totalParents: number;
    parentsMissingEmail: number;
    parentsMissingPhone: number;
    unreadNotifications: number;
    failedDeliveriesThisWeek: number;
    deliveryCountsThisWeek: Record<ParentDeliveryStatus, number>;
    openContactRequests: number;
    escalatedContactRequests: number;
    recentContactRequests: {
      id: string;
      parentName: string;
      studentName: string;
      teacherName: string;
      category: string;
      status: ParentTeacherContactStatus;
      createdAt: Date;
    }[];
  };
  actionCenter: {
    items: AdminOwnerActionItem[];
  };
};

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

function startOfWeek(date: Date) {
  const value = startOfDay(date);
  const day = value.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  value.setDate(value.getDate() + diff);
  return value;
}

function decimalToNumber(value: Prisma.Decimal | number | string | null | undefined) {
  if (value == null) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  return value.toNumber();
}

function emptyStatusCounts<T extends string>(statuses: readonly T[]) {
  return statuses.reduce((acc, status) => {
    acc[status] = 0;
    return acc;
  }, {} as Record<T, number>);
}

function applyStatusGroups<T extends string>(
  groups: { status: T; _count: { _all: number } }[],
  statuses: readonly T[],
) {
  const counts = emptyStatusCounts(statuses);
  for (const group of groups) counts[group.status] = group._count._all;
  return counts;
}

function percentage(numerator: number, denominator: number) {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 100);
}

function personName(person: { name: string; surname: string }) {
  return `${person.name} ${person.surname}`.trim();
}

function buildActionItems(data: Omit<AdminOwnerDashboardData, "actionCenter">): AdminOwnerActionItem[] {
  const items: AdminOwnerActionItem[] = [];

  if (data.schoolPulse.unmarkedLessonsToday > 0) {
    items.push({
      id: "pulse-unmarked-attendance",
      section: "schoolPulse",
      severity: data.schoolPulse.unmarkedLessonsToday > 3 ? "critical" : "warning",
      title: `${data.schoolPulse.unmarkedLessonsToday} lesson${data.schoolPulse.unmarkedLessonsToday === 1 ? "" : "s"} need attendance`,
      detail: "Some teachers have not completed today's attendance records yet.",
      href: "/admin/accountability",
    });
  }

  if (data.financeSnapshot.outstandingAmount > 0) {
    items.push({
      id: "finance-outstanding",
      section: "finance",
      severity: data.financeSnapshot.collectionRate < 50 ? "critical" : "warning",
      title: `GHS ${data.financeSnapshot.outstandingAmount.toFixed(2)} outstanding`,
      detail: `${data.financeSnapshot.overdueBillCount} bill${data.financeSnapshot.overdueBillCount === 1 ? "" : "s"} are overdue.`,
      href: "/list/finance/bills",
    });
  }

  if (data.teacherAccountability.openEscalations > 0) {
    items.push({
      id: "teacher-open-escalations",
      section: "teacherAccountability",
      severity: "critical",
      title: `${data.teacherAccountability.openEscalations} teacher escalation${data.teacherAccountability.openEscalations === 1 ? "" : "s"} open`,
      detail: "Management review is needed for unresolved teacher duties.",
      href: "/admin/accountability",
    });
  }

  if (!data.academicReadiness.caConfigExists) {
    items.push({
      id: "academic-ca-config",
      section: "academicReadiness",
      severity: "critical",
      title: "CA setup is missing",
      detail: "Admin must set the CA/exam structure before teachers can build valid reports.",
      href: "/admin/ca-config",
    });
  }

  const blockedClasses = data.academicReadiness.classReadiness.filter((item) => item.status === "BLOCKED").length;
  if (blockedClasses > 0) {
    items.push({
      id: "academic-blocked-reports",
      section: "academicReadiness",
      severity: "warning",
      title: `${blockedClasses} class${blockedClasses === 1 ? "" : "es"} blocked for reports`,
      detail: "CA or exam entries are still missing for report-card readiness.",
      href: "/list/report-cards",
    });
  }

  if (data.parentEngagement.openContactRequests > 0) {
    items.push({
      id: "parent-open-contacts",
      section: "parentEngagement",
      severity: data.parentEngagement.escalatedContactRequests > 0 ? "critical" : "warning",
      title: `${data.parentEngagement.openContactRequests} parent request${data.parentEngagement.openContactRequests === 1 ? "" : "s"} need response`,
      detail: `${data.parentEngagement.escalatedContactRequests} request${data.parentEngagement.escalatedContactRequests === 1 ? "" : "s"} already escalated.`,
      href: "/admin/communications",
    });
  }

  if (data.parentEngagement.failedDeliveriesThisWeek > 0) {
    items.push({
      id: "parent-failed-deliveries",
      section: "parentEngagement",
      severity: "warning",
      title: `${data.parentEngagement.failedDeliveriesThisWeek} parent message${data.parentEngagement.failedDeliveriesThisWeek === 1 ? "" : "s"} failed this week`,
      detail: "Check parent contact details or notification provider settings.",
      href: "/admin/notification-settings",
    });
  }

  return items.slice(0, 8);
}

export async function getAdminOwnerDashboardData(
  schoolId: string,
  now = new Date(),
): Promise<AdminOwnerDashboardData> {
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const weekStart = startOfWeek(now);
  const todayDay = DAY_ENUM_MAP[now.getDay()] ?? "MONDAY";
  const todayLabel = now.toLocaleDateString("en-US", { weekday: "long" });
  const activePeriod = await getActiveAcademicPeriod(schoolId);

  const [
    totalStudents,
    totalParents,
    totalClasses,
    todaysLessons,
    todayAttendanceGroups,
    financeAggregate,
    billStatusGroups,
    confirmedPaymentsTodayAggregate,
    overdueBillCount,
    recentPayments,
    todayDutyGroups,
    weeklyDutyGroups,
    openEscalations,
    pendingCorrectionRequests,
    recentEscalations,
    caConfigCount,
    caRecordCount,
    caAverage,
    reportPublicationGroups,
    classes,
    parentsMissingEmail,
    parentsMissingPhone,
    unreadNotifications,
    deliveryStatusGroups,
    contactStatusGroups,
    recentContactRequests,
  ] = await Promise.all([
    prisma.student.count({ where: { schoolId } }),
    prisma.parent.count({ where: { schoolId } }),
    prisma.class.count({ where: { schoolId } }),
    prisma.lesson.findMany({
      where: { schoolId, day: todayDay },
      select: {
        id: true,
        name: true,
        startTime: true,
        endTime: true,
        class: {
          select: {
            id: true,
            name: true,
            _count: { select: { students: true } },
          },
        },
        subject: { select: { name: true } },
        teacher: { select: { name: true, surname: true } },
      },
      orderBy: [{ startTime: "asc" }, { id: "asc" }],
    }),
    prisma.attendance.groupBy({
      by: ["status"],
      where: { schoolId, date: { gte: todayStart, lte: todayEnd } },
      _count: { _all: true },
    }),
    prisma.studentBill.aggregate({
      where: { schoolId },
      _sum: { totalAmount: true, amountPaid: true, balance: true },
    }),
    prisma.studentBill.groupBy({
      by: ["status"],
      where: { schoolId },
      _count: { _all: true },
    }),
    prisma.payment.aggregate({
      where: {
        schoolId,
        status: "CONFIRMED",
        paymentDate: { gte: todayStart, lte: todayEnd },
      },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    prisma.studentBill.count({
      where: {
        schoolId,
        status: { in: OPEN_BILL_STATUSES },
        balance: { gt: 0 },
        dueDate: { lt: todayStart },
      },
    }),
    prisma.payment.findMany({
      where: { schoolId, status: { in: ACTIVE_PAYMENT_STATUSES } },
      select: {
        id: true,
        receiptNumber: true,
        amount: true,
        status: true,
        paidBy: true,
        paymentDate: true,
        studentBill: {
          select: {
            student: { select: { name: true, surname: true } },
          },
        },
      },
      orderBy: { paymentDate: "desc" },
      take: 5,
    }),
    prisma.teacherObligation.groupBy({
      by: ["status"],
      where: { schoolId, expectedAt: { gte: todayStart, lte: todayEnd } },
      _count: { _all: true },
    }),
    prisma.teacherObligation.groupBy({
      by: ["status"],
      where: { schoolId, expectedAt: { gte: weekStart, lte: todayEnd } },
      _count: { _all: true },
    }),
    prisma.teacherEscalation.count({
      where: { schoolId, status: { in: OPEN_ESCALATION_STATUSES } },
    }),
    prisma.teacherCorrectionRequest.count({
      where: { schoolId, status: "PENDING" },
    }),
    prisma.teacherEscalation.findMany({
      where: { schoolId, status: { in: OPEN_ESCALATION_STATUSES } },
      select: {
        id: true,
        reason: true,
        status: true,
        escalatedAt: true,
        teacher: { select: { name: true, surname: true } },
        obligation: { select: { title: true } },
      },
      orderBy: { escalatedAt: "desc" },
      take: 5,
    }),
    prisma.cAConfig.count({
      where: {
        schoolId,
        isActive: true,
        academicYear: activePeriod.academicYear,
        currentTerm: activePeriod.currentTerm,
      },
    }),
    prisma.continuousAssessment.count({
      where: {
        schoolId,
        academicYear: activePeriod.academicYear,
        term: activePeriod.currentTerm,
      },
    }),
    prisma.continuousAssessment.aggregate({
      where: {
        schoolId,
        academicYear: activePeriod.academicYear,
        term: activePeriod.currentTerm,
      },
      _avg: { totalScore: true },
    }),
    prisma.reportCardPublication.groupBy({
      by: ["status"],
      where: {
        schoolId,
        academicYear: activePeriod.academicYear,
        term: activePeriod.currentTerm,
        status: { in: ACTIVE_REPORT_STATUSES },
      },
      _count: { _all: true },
    }),
    prisma.class.findMany({
      where: { schoolId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
      take: 12,
    }),
    prisma.parent.count({
      where: { schoolId, OR: [{ email: null }, { email: "" }] },
    }),
    prisma.parent.count({
      where: { schoolId, OR: [{ phone: null }, { phone: "" }] },
    }),
    prisma.parentNotification.count({
      where: { schoolId, readAt: null },
    }),
    prisma.parentNotificationDeliveryLog.groupBy({
      by: ["status"],
      where: { schoolId, attemptedAt: { gte: weekStart, lte: todayEnd } },
      _count: { _all: true },
    }),
    prisma.parentTeacherContactRequest.groupBy({
      by: ["status"],
      where: { schoolId },
      _count: { _all: true },
    }),
    prisma.parentTeacherContactRequest.findMany({
      where: { schoolId, status: { in: ACTIVE_CONTACT_STATUSES } },
      select: {
        id: true,
        category: true,
        status: true,
        createdAt: true,
        parent: { select: { name: true, surname: true } },
        student: { select: { name: true, surname: true } },
        teacher: { select: { name: true, surname: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  const todaysLessonIds = todaysLessons.map((lesson) => lesson.id);
  const attendanceByLesson = todaysLessonIds.length
    ? await prisma.attendance.groupBy({
        by: ["lessonId"],
        where: {
          schoolId,
          lessonId: { in: todaysLessonIds },
          date: { gte: todayStart, lte: todayEnd },
        },
        _count: { _all: true },
      })
    : [];
  const lessonAttendanceCount = new Map(
    attendanceByLesson.map((row) => [row.lessonId, row._count._all]),
  );

  const attendanceCounts = applyStatusGroups(todayAttendanceGroups, ["PRESENT", "ABSENT", "LATE", "EXCUSED"] as const);
  const attendanceRecordsToday =
    attendanceCounts.PRESENT + attendanceCounts.ABSENT + attendanceCounts.LATE + attendanceCounts.EXCUSED;
  const lessonsMarkedToday = todaysLessons.filter((lesson) => {
    const expected = lesson.class._count.students;
    const marked = lessonAttendanceCount.get(lesson.id) ?? 0;
    return expected > 0 && marked >= expected;
  }).length;
  const unmarkedLessons = todaysLessons
    .map((lesson) => {
      const expectedRecords = lesson.class._count.students;
      const markedRecords = lessonAttendanceCount.get(lesson.id) ?? 0;
      return {
        lessonId: lesson.id,
        className: lesson.class.name,
        subjectName: lesson.subject.name,
        teacherName: personName(lesson.teacher),
        expectedRecords,
        markedRecords,
        startTime: lesson.startTime,
        endTime: lesson.endTime,
      };
    })
    .filter((lesson) => lesson.expectedRecords > 0 && lesson.markedRecords < lesson.expectedRecords)
    .slice(0, 6);

  const billCounts = applyStatusGroups(
    billStatusGroups,
    ["UNPAID", "PARTIAL", "PAID", "OVERPAID", "WAIVED"] as const,
  );
  const weeklyDutyCounts = applyStatusGroups(
    weeklyDutyGroups,
    ["PENDING", "COMPLETED", "COMPLETED_LATE", "MISSED", "ESCALATED", "CANCELLED"] as const,
  );
  const todayDutyCounts = applyStatusGroups(
    todayDutyGroups,
    ["PENDING", "COMPLETED", "COMPLETED_LATE", "MISSED", "ESCALATED", "CANCELLED"] as const,
  );
  const reportPublicationCounts = applyStatusGroups(
    reportPublicationGroups,
    ["SUBMITTED", "REJECTED", "PUBLISHED", "UNPUBLISHED"] as const,
  );
  const deliveryCountsThisWeek = applyStatusGroups(
    deliveryStatusGroups,
    ["PENDING", "SENT", "FAILED", "SKIPPED"] as const,
  );
  const contactCounts = applyStatusGroups(
    contactStatusGroups,
    ["PENDING", "ACKNOWLEDGED", "RESPONDED", "ESCALATED", "CLOSED", "CANCELLED"] as const,
  );

  const classReadinessRaw = await Promise.all(
    classes.map(async (cls) => ({
      cls,
      readiness: await getClassReportReadiness({
        schoolId,
        classId: cls.id,
        academicYear: activePeriod.academicYear,
        term: activePeriod.currentTerm,
      }),
    })),
  );

  const classReadiness = classReadinessRaw.map(({ cls, readiness }) => {
    const readinessRate = percentage(readiness.readyEntryCount, readiness.expectedEntryCount);
    const status: "READY" | "BLOCKED" | "NO_SUBJECTS" | "NO_STUDENTS" =
      readiness.studentCount === 0
        ? "NO_STUDENTS"
        : readiness.subjectCount === 0
          ? "NO_SUBJECTS"
          : readiness.isReady
            ? "READY"
            : "BLOCKED";
    return {
      classId: cls.id,
      className: cls.name,
      studentCount: readiness.studentCount,
      subjectCount: readiness.subjectCount,
      expectedEntryCount: readiness.expectedEntryCount,
      readyEntryCount: readiness.readyEntryCount,
      missingCount: readiness.missingCount,
      missingCACount: readiness.missingCACount,
      missingExamCount: readiness.missingExamCount,
      readinessRate,
      status,
      href: `/list/report-cards?classId=${cls.id}`,
    };
  });

  const expectedAmount = decimalToNumber(financeAggregate._sum.totalAmount);
  const collectedAmount = decimalToNumber(financeAggregate._sum.amountPaid);
  const outstandingAmount = decimalToNumber(financeAggregate._sum.balance);

  const dataWithoutActions: Omit<AdminOwnerDashboardData, "actionCenter"> = {
    activePeriod: {
      academicYear: activePeriod.academicYear,
      currentTerm: activePeriod.currentTerm,
      classworkWeight: activePeriod.classworkWeight,
      examWeight: activePeriod.examWeight,
    },
    schoolPulse: {
      todayLabel,
      totalStudents,
      totalClasses,
      lessonsScheduledToday: todaysLessons.length,
      lessonsMarkedToday,
      unmarkedLessonsToday: unmarkedLessons.length,
      attendanceRecordsToday,
      present: attendanceCounts.PRESENT,
      absent: attendanceCounts.ABSENT,
      late: attendanceCounts.LATE,
      excused: attendanceCounts.EXCUSED,
      attendanceRate: percentage(attendanceCounts.PRESENT, attendanceRecordsToday),
      unmarkedLessons,
    },
    financeSnapshot: {
      expectedAmount,
      collectedAmount,
      outstandingAmount,
      collectionRate: percentage(collectedAmount, expectedAmount),
      billCounts,
      confirmedPaymentsToday: confirmedPaymentsTodayAggregate._count._all,
      confirmedAmountToday: decimalToNumber(confirmedPaymentsTodayAggregate._sum.amount),
      overdueBillCount,
      recentPayments: recentPayments.map((payment) => ({
        id: payment.id,
        receiptNumber: payment.receiptNumber,
        amount: decimalToNumber(payment.amount),
        status: payment.status,
        paidBy: payment.paidBy,
        paymentDate: payment.paymentDate,
        studentName: personName(payment.studentBill.student),
      })),
    },
    teacherAccountability: {
      dutiesToday: Object.values(todayDutyCounts).reduce((sum, value) => sum + value, 0),
      dutiesCompletedToday: todayDutyCounts.COMPLETED + todayDutyCounts.COMPLETED_LATE,
      dutiesMissedOrEscalatedToday: todayDutyCounts.MISSED + todayDutyCounts.ESCALATED,
      openEscalations,
      pendingCorrectionRequests,
      weeklyDutyCounts,
      recentEscalations: recentEscalations.map((escalation) => ({
        id: escalation.id,
        teacherName: personName(escalation.teacher),
        reason: escalation.reason,
        status: escalation.status,
        escalatedAt: escalation.escalatedAt,
        title: escalation.obligation.title,
      })),
    },
    academicReadiness: {
      caConfigExists: caConfigCount > 0,
      caRecords: caRecordCount,
      schoolAverage: Math.round(decimalToNumber(caAverage._avg.totalScore) * 10) / 10,
      reportPublicationCounts,
      classReadiness,
    },
    parentEngagement: {
      totalParents,
      parentsMissingEmail,
      parentsMissingPhone,
      unreadNotifications,
      failedDeliveriesThisWeek: deliveryCountsThisWeek.FAILED,
      deliveryCountsThisWeek,
      openContactRequests:
        contactCounts.PENDING + contactCounts.ACKNOWLEDGED + contactCounts.ESCALATED,
      escalatedContactRequests: contactCounts.ESCALATED,
      recentContactRequests: recentContactRequests.map((request) => ({
        id: request.id,
        parentName: personName(request.parent),
        studentName: personName(request.student),
        teacherName: personName(request.teacher),
        category: request.category,
        status: request.status,
        createdAt: request.createdAt,
      })),
    },
  };

  return {
    ...dataWithoutActions,
    actionCenter: {
      items: buildActionItems(dataWithoutActions),
    },
  };
}
