import prisma from "@/src/lib/prisma";
import { Prisma } from "@/src/generated/prisma";
import { getBursarArrearsFollowUp, type BursarArrearsFollowUp } from "@/src/lib/services/bursar-arrears";
import { getClassCollectionReport } from "@/src/lib/services/class-collection-report";

export type WeeklyMoneyDay = {
  date: Date;
  label: string;
  amount: number;
  paymentCount: number;
};

export type WeeklyClassPerformanceRow = {
  classId: number;
  className: string;
  expected: number;
  collected: number;
  outstanding: number;
  weeklyCollected: number;
  weeklyPaymentCount: number;
  collectionRate: number;
  status: "Healthy" | "Watch" | "Weak" | "Critical";
};

export type WeeklyReceiptTrust = {
  receiptsIssuedThisWeek: number;
  voidedReceiptsThisWeek: number;
  pendingReceipts: number;
  failedReceipts: number;
  duplicateReferenceWarnings: number;
  receiptNumberingGaps: number;
};

export type WeeklyCorrectionControl = {
  requestsRaised: number;
  approved: number;
  rejected: number;
  stillPending: number;
  reversalsMade: number;
  totalAffectedAmount: number;
};

export type WeeklyParentPaymentIssues = {
  openQueries: number;
  resolvedThisWeek: number;
  repeatedPaymentDisputes: number;
  billsWithUnresolvedIssues: number;
};

export type WeeklyFinanceSummary = {
  weekStart: Date;
  weekEnd: Date;
  previousWeekStart: Date;
  previousWeekEnd: Date;
  totalCollected: number;
  paymentCount: number;
  previousTotalCollected: number;
  previousPaymentCount: number;
  totalDelta: number;
  paymentDelta: number;
  dailyBreakdown: WeeklyMoneyDay[];
  strongestCollectionDay: WeeklyMoneyDay | null;
  weakestCollectionDay: WeeklyMoneyDay | null;
  classPerformance: WeeklyClassPerformanceRow[];
  topCollectingClasses: WeeklyClassPerformanceRow[];
  weakCollectionClasses: WeeklyClassPerformanceRow[];
  highOutstandingClasses: WeeklyClassPerformanceRow[];
  arrears: BursarArrearsFollowUp;
  receiptTrust: WeeklyReceiptTrust;
  correctionControl: WeeklyCorrectionControl;
  parentPaymentIssues: WeeklyParentPaymentIssues;
};

function asNumber(value: Prisma.Decimal | number | string | null | undefined) {
  if (value instanceof Prisma.Decimal) return value.toNumber();
  return Number(value ?? 0);
}

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

export function parseWeeklyReportDate(value?: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

export function weeklyReportDateInputValue(date: Date) {
  return date.toISOString().split("T")[0];
}

export function weekBounds(date = new Date()) {
  const start = startOfDay(date);
  const day = start.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  start.setDate(start.getDate() + diffToMonday);

  const end = endOfDay(start);
  end.setDate(start.getDate() + 6);

  return { start, end };
}

function previousWeekBounds(weekStart: Date) {
  const start = startOfDay(weekStart);
  start.setDate(start.getDate() - 7);
  const end = endOfDay(start);
  end.setDate(start.getDate() + 6);
  return { start, end };
}

function dayKey(date: Date) {
  return date.toISOString().split("T")[0];
}

function dayLabel(date: Date) {
  return date.toLocaleDateString("en-GH", { weekday: "short", day: "numeric", month: "short" });
}

function sevenDayRows(weekStart: Date) {
  return Array.from({ length: 7 }, (_, index) => {
    const date = startOfDay(weekStart);
    date.setDate(weekStart.getDate() + index);
    return {
      date,
      label: dayLabel(date),
      amount: 0,
      paymentCount: 0,
    } satisfies WeeklyMoneyDay;
  });
}

function receiptSeries(receiptNumber: string) {
  const match = receiptNumber.match(/^(.*?)(\d+)$/);
  if (!match) return null;
  return { prefix: match[1], counter: Number(match[2]) };
}

function receiptGapCount(receiptNumbers: string[]) {
  const countersBySeries = new Map<string, number[]>();
  for (const receiptNumber of receiptNumbers) {
    const parsed = receiptSeries(receiptNumber);
    if (!parsed || !Number.isInteger(parsed.counter)) continue;
    const current = countersBySeries.get(parsed.prefix) ?? [];
    current.push(parsed.counter);
    countersBySeries.set(parsed.prefix, current);
  }

  let gaps = 0;
  for (const counters of countersBySeries.values()) {
    counters.sort((a, b) => a - b);
    const uniqueCounters = [...new Set(counters)];
    for (let index = 1; index < uniqueCounters.length; index += 1) {
      const gap = uniqueCounters[index] - uniqueCounters[index - 1];
      if (gap > 1) gaps += gap - 1;
    }
  }

  return gaps;
}

export async function getWeeklyFinanceSummary(schoolId: string, date = new Date()): Promise<WeeklyFinanceSummary> {
  const currentWeek = weekBounds(date);
  const previousWeek = previousWeekBounds(currentWeek.start);

  const [
    payments,
    previousPayments,
    classReport,
    arrears,
    weeklyReversals,
    activeReferenceRows,
    allReceiptNumbers,
    pendingReceipts,
    failedReceipts,
    correctionsRaisedThisWeek,
    correctionsApprovedThisWeek,
    correctionsRejectedThisWeek,
    pendingCorrectionCount,
    correctionAffectedRows,
    weeklyFinanceQueries,
    resolvedFinanceQueries,
    activeFinanceQueries,
  ] = await Promise.all([
    prisma.payment.findMany({
      where: {
        schoolId,
        status: "CONFIRMED",
        paymentDate: { gte: currentWeek.start, lte: currentWeek.end },
        studentBill: { schoolId, student: { schoolId } },
      },
      select: {
        id: true,
        amount: true,
        paymentDate: true,
        studentBill: {
          select: {
            student: { select: { class: { select: { id: true, name: true } } } },
          },
        },
      },
    }),
    prisma.payment.findMany({
      where: {
        schoolId,
        status: "CONFIRMED",
        paymentDate: { gte: previousWeek.start, lte: previousWeek.end },
        studentBill: { schoolId, student: { schoolId } },
      },
      select: { id: true, amount: true },
    }),
    getClassCollectionReport(schoolId),
    getBursarArrearsFollowUp(schoolId, { asOf: currentWeek.end, limit: 12 }),
    prisma.paymentReversal.findMany({
      where: {
        schoolId,
        reversedAt: { gte: currentWeek.start, lte: currentWeek.end },
        payment: { schoolId, studentBill: { schoolId, student: { schoolId } } },
      },
      select: { paymentId: true, payment: { select: { amount: true } } },
    }),
    prisma.payment.findMany({
      where: {
        schoolId,
        referenceNo: { not: null },
        status: { notIn: ["FAILED", "REVERSED"] },
        studentBill: { schoolId, student: { schoolId } },
      },
      select: { id: true, paymentMethod: true, referenceNo: true },
    }),
    prisma.payment.findMany({
      where: { schoolId, studentBill: { schoolId, student: { schoolId } } },
      select: { receiptNumber: true },
      orderBy: { receiptNumber: "asc" },
    }),
    prisma.payment.count({
      where: { schoolId, status: "PENDING", studentBill: { schoolId, student: { schoolId } } },
    }),
    prisma.payment.count({
      where: { schoolId, status: "FAILED", studentBill: { schoolId, student: { schoolId } } },
    }),
    prisma.paymentCorrectionRequest.count({
      where: {
        schoolId,
        requestedAt: { gte: currentWeek.start, lte: currentWeek.end },
        studentBill: { schoolId, student: { schoolId } },
      },
    }),
    prisma.paymentCorrectionRequest.count({
      where: {
        schoolId,
        status: { in: ["APPROVED", "APPLIED"] },
        reviewedAt: { gte: currentWeek.start, lte: currentWeek.end },
        studentBill: { schoolId, student: { schoolId } },
      },
    }),
    prisma.paymentCorrectionRequest.count({
      where: {
        schoolId,
        status: "REJECTED",
        reviewedAt: { gte: currentWeek.start, lte: currentWeek.end },
        studentBill: { schoolId, student: { schoolId } },
      },
    }),
    prisma.paymentCorrectionRequest.count({
      where: { schoolId, status: "PENDING_REVIEW", studentBill: { schoolId, student: { schoolId } } },
    }),
    prisma.paymentCorrectionRequest.findMany({
      where: {
        schoolId,
        OR: [
          { requestedAt: { gte: currentWeek.start, lte: currentWeek.end } },
          { reviewedAt: { gte: currentWeek.start, lte: currentWeek.end } },
          { appliedAt: { gte: currentWeek.start, lte: currentWeek.end } },
        ],
        studentBill: { schoolId, student: { schoolId } },
      },
      select: { originalPaymentId: true, originalPayment: { select: { amount: true } } },
    }),
    prisma.financeQuery.findMany({
      where: {
        schoolId,
        createdAt: { gte: currentWeek.start, lte: currentWeek.end },
        student: { schoolId },
        studentBill: { schoolId },
        parent: { schoolId },
      },
      select: { id: true, parentId: true, studentBillId: true },
    }),
    prisma.financeQuery.count({
      where: {
        schoolId,
        status: { in: ["RESOLVED", "CLOSED"] },
        resolvedAt: { gte: currentWeek.start, lte: currentWeek.end },
        student: { schoolId },
        studentBill: { schoolId },
        parent: { schoolId },
      },
    }),
    prisma.financeQuery.findMany({
      where: {
        schoolId,
        status: { in: ["OPEN", "IN_REVIEW"] },
        student: { schoolId },
        studentBill: { schoolId },
        parent: { schoolId },
      },
      select: { id: true, studentBillId: true },
    }),
  ]);

  const dailyMap = new Map(sevenDayRows(currentWeek.start).map((row) => [dayKey(row.date), row]));
  const weeklyClassMap = new Map<number, { amount: number; count: number }>();

  for (const payment of payments) {
    const amount = asNumber(payment.amount);
    const day = dailyMap.get(dayKey(payment.paymentDate));
    if (day) {
      day.amount += amount;
      day.paymentCount += 1;
    }

    const klass = payment.studentBill.student.class;
    if (klass) {
      const current = weeklyClassMap.get(klass.id) ?? { amount: 0, count: 0 };
      current.amount += amount;
      current.count += 1;
      weeklyClassMap.set(klass.id, current);
    }
  }

  const dailyBreakdown = Array.from(dailyMap.values());
  const daysWithPayments = dailyBreakdown.filter((row) => row.paymentCount > 0);
  const strongestCollectionDay = daysWithPayments.length > 0
    ? [...daysWithPayments].sort((a, b) => b.amount - a.amount || b.paymentCount - a.paymentCount)[0]
    : null;
  const weakestCollectionDay = daysWithPayments.length > 0
    ? [...daysWithPayments].sort((a, b) => a.amount - b.amount || a.paymentCount - b.paymentCount)[0]
    : null;

  const classPerformance = classReport.rows.map((row) => {
    const weekly = weeklyClassMap.get(row.classId) ?? { amount: 0, count: 0 };
    return {
      classId: row.classId,
      className: row.className,
      expected: row.expected,
      collected: row.collected,
      outstanding: row.outstanding,
      weeklyCollected: weekly.amount,
      weeklyPaymentCount: weekly.count,
      collectionRate: row.collectionRate,
      status: row.risk,
    } satisfies WeeklyClassPerformanceRow;
  });

  const topCollectingClasses = [...classPerformance]
    .filter((row) => row.weeklyCollected > 0)
    .sort((a, b) => b.weeklyCollected - a.weeklyCollected || b.weeklyPaymentCount - a.weeklyPaymentCount)
    .slice(0, 5);
  const weakCollectionClasses = [...classPerformance]
    .filter((row) => row.outstanding > 0)
    .sort((a, b) => a.collectionRate - b.collectionRate || b.outstanding - a.outstanding)
    .slice(0, 5);
  const highOutstandingClasses = [...classPerformance]
    .filter((row) => row.outstanding > 0)
    .sort((a, b) => b.outstanding - a.outstanding || a.collectionRate - b.collectionRate)
    .slice(0, 5);

  const totalCollected = payments.reduce((sum, payment) => sum + asNumber(payment.amount), 0);
  const previousTotalCollected = previousPayments.reduce((sum, payment) => sum + asNumber(payment.amount), 0);
  const referenceGroups = new Map<string, number>();
  for (const payment of activeReferenceRows) {
    const reference = payment.referenceNo?.trim();
    if (!reference) continue;
    const key = `${payment.paymentMethod}:${reference.toLowerCase()}`;
    referenceGroups.set(key, (referenceGroups.get(key) ?? 0) + 1);
  }
  const duplicateReferenceWarnings = Array.from(referenceGroups.values()).filter((count) => count > 1).length;
  const affectedPayments = new Map<number, number>();
  for (const correction of correctionAffectedRows) {
    affectedPayments.set(correction.originalPaymentId, asNumber(correction.originalPayment.amount));
  }
  for (const reversal of weeklyReversals) {
    affectedPayments.set(reversal.paymentId, asNumber(reversal.payment.amount));
  }
  const unresolvedBillIds = new Set(activeFinanceQueries.map((query) => query.studentBillId));
  const weeklyQueryBillCounts = new Map<number, number>();
  for (const query of weeklyFinanceQueries) {
    weeklyQueryBillCounts.set(query.studentBillId, (weeklyQueryBillCounts.get(query.studentBillId) ?? 0) + 1);
  }

  return {
    weekStart: currentWeek.start,
    weekEnd: currentWeek.end,
    previousWeekStart: previousWeek.start,
    previousWeekEnd: previousWeek.end,
    totalCollected,
    paymentCount: payments.length,
    previousTotalCollected,
    previousPaymentCount: previousPayments.length,
    totalDelta: totalCollected - previousTotalCollected,
    paymentDelta: payments.length - previousPayments.length,
    dailyBreakdown,
    strongestCollectionDay,
    weakestCollectionDay,
    classPerformance,
    topCollectingClasses,
    weakCollectionClasses,
    highOutstandingClasses,
    arrears,
    receiptTrust: {
      receiptsIssuedThisWeek: payments.length,
      voidedReceiptsThisWeek: weeklyReversals.length,
      pendingReceipts,
      failedReceipts,
      duplicateReferenceWarnings,
      receiptNumberingGaps: receiptGapCount(allReceiptNumbers.map((payment) => payment.receiptNumber)),
    },
    correctionControl: {
      requestsRaised: correctionsRaisedThisWeek,
      approved: correctionsApprovedThisWeek,
      rejected: correctionsRejectedThisWeek,
      stillPending: pendingCorrectionCount,
      reversalsMade: weeklyReversals.length,
      totalAffectedAmount: Array.from(affectedPayments.values()).reduce((sum, amount) => sum + amount, 0),
    },
    parentPaymentIssues: {
      openQueries: activeFinanceQueries.length,
      resolvedThisWeek: resolvedFinanceQueries,
      repeatedPaymentDisputes: Array.from(weeklyQueryBillCounts.values()).filter((count) => count > 1).length,
      billsWithUnresolvedIssues: unresolvedBillIds.size,
    },
  };
}
