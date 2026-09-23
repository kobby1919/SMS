import prisma from "@/src/lib/prisma";
import { Prisma } from "@/src/generated/prisma";
import { PAYMENT_METHOD_LABELS } from "@/src/lib/constants/finance";

export type DailyFinanceReportPayment = {
  id: number;
  receiptNumber: string;
  amount: number;
  paymentMethod: string;
  paymentMethodLabel: string;
  paymentDate: Date;
  paidBy: string;
  referenceNo: string | null;
  studentName: string;
  className: string;
  billTitle: string;
};

export type DailyFinanceReportIssue = {
  id: string;
  title: string;
  detail: string;
  amount: number | null;
  href: string;
  tone: "rose" | "amber" | "blue" | "gray";
};

export type DailyFinanceReportMethod = {
  method: string;
  label: string;
  count: number;
  amount: number;
};

export type DailyFinanceReport = {
  date: Date;
  dayStart: Date;
  dayEnd: Date;
  yesterdayStart: Date;
  yesterdayEnd: Date;
  totalReceived: number;
  paymentCount: number;
  receiptCount: number;
  pendingConfirmationCount: number;
  reversalCount: number;
  correctionRequestCount: number;
  openQueryCount: number;
  yesterdayTotalReceived: number;
  yesterdayPaymentCount: number;
  totalDelta: number;
  paymentDelta: number;
  methodBreakdown: DailyFinanceReportMethod[];
  recentPayments: DailyFinanceReportPayment[];
  ownerUpdates: DailyFinanceReportIssue[];
};

function asNumber(value: Prisma.Decimal | number | string | null | undefined) {
  if (value instanceof Prisma.Decimal) return value.toNumber();
  return Number(value ?? 0);
}

function dayBounds(date = new Date()) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);

  const end = new Date(date);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

function previousDayBounds(date: Date) {
  const value = new Date(date);
  value.setDate(value.getDate() - 1);
  return dayBounds(value);
}

function studentName(student: { name: string; surname: string }) {
  return `${student.name} ${student.surname}`.trim();
}

export function parseDailyReportDate(value?: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

export function dailyReportDateInputValue(date: Date) {
  return date.toISOString().split("T")[0];
}

export async function getDailyFinanceReport(schoolId: string, date = new Date()): Promise<DailyFinanceReport> {
  const { start, end } = dayBounds(date);
  const yesterday = previousDayBounds(start);

  const [
    paymentsForTotals,
    recentPaymentRows,
    yesterdayPayments,
    pendingConfirmationCount,
    pendingConfirmations,
    reversalCount,
    reversals,
    correctionRequestCount,
    correctionRequests,
    openQueryCount,
    openQueries,
    highOutstandingBills,
  ] = await Promise.all([
    prisma.payment.findMany({
      where: {
        schoolId,
        status: "CONFIRMED",
        paymentDate: { gte: start, lte: end },
      },
      select: { id: true, amount: true, paymentMethod: true },
    }),
    prisma.payment.findMany({
      where: {
        schoolId,
        status: "CONFIRMED",
        paymentDate: { gte: start, lte: end },
      },
      select: {
        id: true,
        receiptNumber: true,
        amount: true,
        paymentMethod: true,
        paymentDate: true,
        paidBy: true,
        referenceNo: true,
        studentBill: {
          select: {
            feeStructure: { select: { title: true } },
            student: {
              select: {
                name: true,
                surname: true,
                class: { select: { name: true } },
              },
            },
          },
        },
      },
      orderBy: { paymentDate: "desc" },
      take: 12,
    }),
    prisma.payment.findMany({
      where: {
        schoolId,
        status: "CONFIRMED",
        paymentDate: { gte: yesterday.start, lte: yesterday.end },
      },
      select: { amount: true, id: true },
    }),
    prisma.payment.count({ where: { schoolId, status: "PENDING" } }),
    prisma.payment.findMany({
      where: { schoolId, status: "PENDING" },
      select: {
        id: true,
        receiptNumber: true,
        amount: true,
        paymentMethod: true,
        paidBy: true,
        studentBill: {
          select: {
            student: { select: { name: true, surname: true, class: { select: { name: true } } } },
          },
        },
      },
      orderBy: { createdAt: "asc" },
      take: 5,
    }),
    prisma.paymentReversal.count({ where: { schoolId, reversedAt: { gte: start, lte: end } } }),
    prisma.paymentReversal.findMany({
      where: { schoolId, reversedAt: { gte: start, lte: end } },
      select: {
        id: true,
        reason: true,
        payment: {
          select: {
            id: true,
            receiptNumber: true,
            amount: true,
            studentBill: {
              select: {
                student: { select: { name: true, surname: true, class: { select: { name: true } } } },
              },
            },
          },
        },
      },
      orderBy: { reversedAt: "desc" },
      take: 5,
    }),
    prisma.paymentCorrectionRequest.count({
      where: {
        schoolId,
        OR: [
          { requestedAt: { gte: start, lte: end } },
          { status: "PENDING_REVIEW" },
        ],
      },
    }),
    prisma.paymentCorrectionRequest.findMany({
      where: {
        schoolId,
        OR: [
          { requestedAt: { gte: start, lte: end } },
          { status: "PENDING_REVIEW" },
        ],
      },
      select: {
        id: true,
        type: true,
        requestedAction: true,
        status: true,
        originalPayment: { select: { receiptNumber: true, amount: true } },
        studentBill: {
          select: {
            student: { select: { name: true, surname: true, class: { select: { name: true } } } },
          },
        },
      },
      orderBy: [{ status: "asc" }, { requestedAt: "desc" }],
      take: 6,
    }),
    prisma.financeQuery.count({ where: { schoolId, status: { in: ["OPEN", "IN_REVIEW"] } } }),
    prisma.financeQuery.findMany({
      where: { schoolId, status: { in: ["OPEN", "IN_REVIEW"] } },
      select: {
        id: true,
        reason: true,
        status: true,
        studentBill: { select: { id: true, balance: true } },
        student: { select: { name: true, surname: true, class: { select: { name: true } } } },
      },
      orderBy: [{ status: "asc" }, { createdAt: "asc" }],
      take: 5,
    }),
    prisma.studentBill.findMany({
      where: {
        schoolId,
        status: { in: ["UNPAID", "PARTIAL"] },
        balance: { gt: 0 },
      },
      select: {
        id: true,
        balance: true,
        status: true,
        student: { select: { name: true, surname: true, class: { select: { name: true } } } },
      },
      orderBy: { balance: "desc" },
      take: 5,
    }),
  ]);

  const totalReceived = paymentsForTotals.reduce((sum, payment) => sum + asNumber(payment.amount), 0);
  const yesterdayTotalReceived = yesterdayPayments.reduce((sum, payment) => sum + asNumber(payment.amount), 0);
  const byMethod = new Map<string, { count: number; amount: number }>();

  for (const payment of paymentsForTotals) {
    const current = byMethod.get(payment.paymentMethod) ?? { count: 0, amount: 0 };
    current.count += 1;
    current.amount += asNumber(payment.amount);
    byMethod.set(payment.paymentMethod, current);
  }

  const methodBreakdown = Array.from(byMethod.entries())
    .map(([method, value]) => ({
      method,
      label: PAYMENT_METHOD_LABELS[method] ?? method,
      count: value.count,
      amount: value.amount,
    }))
    .sort((a, b) => b.amount - a.amount || a.label.localeCompare(b.label));

  const recentPayments = recentPaymentRows.map((payment) => ({
    id: payment.id,
    receiptNumber: payment.receiptNumber,
    amount: asNumber(payment.amount),
    paymentMethod: payment.paymentMethod,
    paymentMethodLabel: PAYMENT_METHOD_LABELS[payment.paymentMethod] ?? payment.paymentMethod,
    paymentDate: payment.paymentDate,
    paidBy: payment.paidBy,
    referenceNo: payment.referenceNo,
    studentName: studentName(payment.studentBill.student),
    className: payment.studentBill.student.class?.name ?? "No class",
    billTitle: payment.studentBill.feeStructure.title,
  }));

  const ownerUpdates: DailyFinanceReportIssue[] = [
    ...pendingConfirmations.map((payment) => ({
      id: `pending-${payment.id}`,
      title: "Payment confirmation needed",
      detail: `${studentName(payment.studentBill.student)} - ${PAYMENT_METHOD_LABELS[payment.paymentMethod] ?? payment.paymentMethod}`,
      amount: asNumber(payment.amount),
      href: "/list/finance/payments?status=PENDING",
      tone: "amber" as const,
    })),
    ...reversals.map((reversal) => ({
      id: `reversal-${reversal.id}`,
      title: "Payment reversed today",
      detail: `${reversal.payment.receiptNumber} - ${studentName(reversal.payment.studentBill.student)}`,
      amount: asNumber(reversal.payment.amount),
      href: "/list/finance/corrections",
      tone: "rose" as const,
    })),
    ...correctionRequests.map((correction) => ({
      id: `correction-${correction.id}`,
      title: correction.status === "PENDING_REVIEW" ? "Correction awaiting review" : "Correction activity today",
      detail: `${studentName(correction.studentBill.student)} - ${correction.type.replaceAll("_", " ").toLowerCase()}`,
      amount: asNumber(correction.originalPayment.amount),
      href: "/list/finance/corrections",
      tone: correction.status === "PENDING_REVIEW" ? "amber" as const : "blue" as const,
    })),
    ...openQueries.map((query) => ({
      id: `query-${query.id}`,
      title: "Parent payment query open",
      detail: `${studentName(query.student)} - ${query.reason.replaceAll("_", " ").toLowerCase()}`,
      amount: asNumber(query.studentBill.balance),
      href: `/list/finance/bills/${query.studentBill.id}`,
      tone: "blue" as const,
    })),
    ...highOutstandingBills.map((bill) => ({
      id: `outstanding-${bill.id}`,
      title: "High outstanding balance",
      detail: `${studentName(bill.student)} - ${bill.student.class?.name ?? "No class"}`,
      amount: asNumber(bill.balance),
      href: `/list/finance/bills/${bill.id}`,
      tone: "rose" as const,
    })),
  ].slice(0, 10);

  return {
    date,
    dayStart: start,
    dayEnd: end,
    yesterdayStart: yesterday.start,
    yesterdayEnd: yesterday.end,
    totalReceived,
    paymentCount: paymentsForTotals.length,
    receiptCount: paymentsForTotals.length,
    pendingConfirmationCount,
    reversalCount,
    correctionRequestCount,
    openQueryCount,
    yesterdayTotalReceived,
    yesterdayPaymentCount: yesterdayPayments.length,
    totalDelta: totalReceived - yesterdayTotalReceived,
    paymentDelta: paymentsForTotals.length - yesterdayPayments.length,
    methodBreakdown,
    recentPayments,
    ownerUpdates,
  };
}
