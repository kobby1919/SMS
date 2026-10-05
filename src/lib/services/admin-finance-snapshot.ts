import type { PaymentIntentStatus, Prisma } from "@/src/generated/prisma";
import prisma from "@/src/lib/prisma";
import { getBursarArrearsFollowUp } from "@/src/lib/services/bursar-arrears";
import { getClassCollectionReport } from "@/src/lib/services/class-collection-report";
import { getReceiptIntegrityReport } from "@/src/lib/services/receipt-integrity-report";

const OPEN_BILL_STATUSES = ["UNPAID", "PARTIAL"] as const;
const ACTIVE_ONLINE_INTENT_STATUSES: PaymentIntentStatus[] = [
  "PENDING",
  "PENDING_PROVIDER",
  "CHECKOUT_CREATED",
];

export type AdminFinanceSnapshot = Awaited<ReturnType<typeof getAdminFinanceSnapshot>>;

function asNumber(value: Prisma.Decimal | number | string | null | undefined) {
  if (value == null) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  return value.toNumber();
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

function percentage(numerator: number, denominator: number) {
  if (denominator <= 0) return 0;
  return Math.min(100, Math.round((numerator / denominator) * 1000) / 10);
}

function buildDuplicateReferenceCount(
  rows: {
    paymentMethod: string;
    referenceNo: string | null;
    externalProvider: string | null;
    externalReference: string | null;
    recordedBy: string;
  }[],
) {
  const groups = new Map<string, number>();

  for (const row of rows) {
    const onlineVerified = Boolean(
      row.externalProvider &&
        row.externalReference &&
        row.recordedBy === "system:webhook",
    );
    const reference = (onlineVerified ? row.externalReference : row.referenceNo)?.trim();
    if (!reference) continue;

    const method = onlineVerified
      ? `ONLINE:${row.externalProvider}`
      : row.paymentMethod;
    const key = `${method}:${reference.toLowerCase()}`;
    groups.set(key, (groups.get(key) ?? 0) + 1);
  }

  return Array.from(groups.values()).filter((count) => count > 1).length;
}

export async function getAdminFinanceSnapshot(schoolId: string, now = new Date()) {
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);

  const [
    classReport,
    arrears,
    receiptIntegrity,
    confirmedPaymentTotals,
    todayPaymentTotals,
    receiptsIssuedToday,
    onlinePaymentsConfirmedToday,
    pendingOnlinePayments,
    lastPayment,
    pendingCorrectionRequests,
    approvedReversalsToday,
    failedOnlineAttempts,
    activeReferenceRows,
    activeBillRows,
    activeStudentsWithoutBills,
  ] = await Promise.all([
    getClassCollectionReport(schoolId),
    getBursarArrearsFollowUp(schoolId, { asOf: now, limit: 5 }),
    getReceiptIntegrityReport(schoolId),
    prisma.payment.aggregate({
      where: {
        schoolId,
        status: "CONFIRMED",
        studentBill: { schoolId, student: { schoolId, status: "ACTIVE" } },
      },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    prisma.payment.aggregate({
      where: {
        schoolId,
        status: "CONFIRMED",
        paymentDate: { gte: todayStart, lte: todayEnd },
        studentBill: { schoolId, student: { schoolId, status: "ACTIVE" } },
      },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    prisma.payment.count({
      where: {
        schoolId,
        status: "CONFIRMED",
        createdAt: { gte: todayStart, lte: todayEnd },
        studentBill: { schoolId, student: { schoolId, status: "ACTIVE" } },
      },
    }),
    prisma.payment.count({
      where: {
        schoolId,
        status: "CONFIRMED",
        externalProvider: { not: null },
        externalReference: { not: null },
        recordedBy: "system:webhook",
        paymentDate: { gte: todayStart, lte: todayEnd },
        studentBill: { schoolId, student: { schoolId, status: "ACTIVE" } },
      },
    }),
    prisma.paymentIntent.count({
      where: {
        schoolId,
        status: { in: ACTIVE_ONLINE_INTENT_STATUSES },
        student: { schoolId, status: "ACTIVE" },
      },
    }),
    prisma.payment.findFirst({
      where: {
        schoolId,
        status: "CONFIRMED",
        studentBill: { schoolId, student: { schoolId, status: "ACTIVE" } },
      },
      select: { paymentDate: true, receiptNumber: true, amount: true },
      orderBy: { paymentDate: "desc" },
    }),
    prisma.paymentCorrectionRequest.count({
      where: {
        schoolId,
        status: "PENDING_REVIEW",
        studentBill: { schoolId, student: { schoolId, status: "ACTIVE" } },
      },
    }),
    prisma.paymentReversal.count({
      where: {
        schoolId,
        reversedAt: { gte: todayStart, lte: todayEnd },
        payment: { schoolId, studentBill: { schoolId, student: { schoolId, status: "ACTIVE" } } },
      },
    }),
    prisma.paymentIntent.count({
      where: {
        schoolId,
        status: { in: ["FAILED", "EXPIRED", "CANCELLED"] },
        updatedAt: { gte: todayStart, lte: todayEnd },
        student: { schoolId, status: "ACTIVE" },
      },
    }),
    prisma.payment.findMany({
      where: {
        schoolId,
        status: { notIn: ["FAILED", "REVERSED"] },
        studentBill: { schoolId, student: { schoolId, status: "ACTIVE" } },
        OR: [
          { referenceNo: { not: null } },
          { externalReference: { not: null } },
        ],
      },
      select: {
        paymentMethod: true,
        referenceNo: true,
        externalProvider: true,
        externalReference: true,
        recordedBy: true,
      },
    }),
    prisma.studentBill.findMany({
      where: {
        schoolId,
        student: { schoolId, status: "ACTIVE" },
        feeStructure: { schoolId },
      },
      select: {
        studentId: true,
        status: true,
        balance: true,
      },
    }),
    prisma.student.count({
      where: {
        schoolId,
        status: "ACTIVE",
        bills: { none: { schoolId } },
      },
    }),
  ]);

  const confirmedPaymentAmount = asNumber(confirmedPaymentTotals._sum.amount);
  const expectedAmount = classReport.expected;
  const collectedAmount = classReport.collected;
  const outstandingAmount = classReport.outstanding;
  const studentsWithBills = new Set(activeBillRows.map((bill) => bill.studentId));
  const owingStudentIds = new Set(
    activeBillRows
      .filter(
        (bill) =>
          OPEN_BILL_STATUSES.includes(bill.status as (typeof OPEN_BILL_STATUSES)[number]) &&
          asNumber(bill.balance) > 0,
      )
      .map((bill) => bill.studentId),
  );
  const paidStudents = Array.from(studentsWithBills).filter(
    (studentId) => !owingStudentIds.has(studentId),
  ).length;
  const weakClasses = [...classReport.rows]
    .filter((row) => row.outstanding > 0)
    .sort((a, b) => a.collectionRate - b.collectionRate || b.outstanding - a.outstanding)
    .slice(0, 5);
  const highRiskOwingStudents = arrears.items.slice(0, 5).map((item) => ({
    billId: item.billId,
    studentName: item.studentName,
    className: item.className ?? "No class",
    amountOwed: item.amountOwed,
    daysOverdue: item.daysOverdue,
    priority: item.priority,
    parentContactStatus: item.parentContact
      ? item.parentContact.phone || item.parentContact.email
        ? "Contact saved"
        : "Parent profile missing phone/email"
      : "No contact saved",
    href: item.href,
  }));

  const duplicateReferenceWarnings = buildDuplicateReferenceCount(activeReferenceRows);
  const integrityAlerts = [
    {
      id: "pending-corrections",
      label: "Pending correction requests",
      value: pendingCorrectionRequests,
      tone: pendingCorrectionRequests > 0 ? "warning" : "ok",
      href: "/list/finance/corrections?status=PENDING_REVIEW",
    },
    {
      id: "reversals-today",
      label: "Approved reversals today",
      value: approvedReversalsToday,
      tone: approvedReversalsToday > 0 ? "warning" : "ok",
      href: "/list/finance/receipts",
    },
    {
      id: "voided-receipts",
      label: "Voided receipts",
      value: receiptIntegrity.voidedReceipts,
      tone: receiptIntegrity.voidedReceipts > 0 ? "warning" : "ok",
      href: "/list/finance/receipts?status=REVERSED",
    },
    {
      id: "duplicate-references",
      label: "Duplicate reference warnings",
      value: Math.max(duplicateReferenceWarnings, receiptIntegrity.duplicateReferenceCount),
      tone: Math.max(duplicateReferenceWarnings, receiptIntegrity.duplicateReferenceCount) > 0 ? "risk" : "ok",
      href: "/list/finance/payments",
    },
    {
      id: "online-pending-failed",
      label: "Pending/failed online payments",
      value: pendingOnlinePayments + failedOnlineAttempts,
      tone: pendingOnlinePayments + failedOnlineAttempts > 0 ? "warning" : "ok",
      href: "/list/finance/payments?source=online",
    },
    {
      id: "students-without-bills",
      label: "Active students without bills",
      value: activeStudentsWithoutBills,
      tone: activeStudentsWithoutBills > 0 ? "warning" : "ok",
      href: "/list/finance/bills",
    },
  ] as const;

  return {
    generatedAt: now,
    hasFeeRecords: activeBillRows.length > 0,
    moneyPosition: {
      expectedFees: expectedAmount,
      collectedFees: collectedAmount,
      outstandingBalance: outstandingAmount,
      collectionRate: percentage(collectedAmount, expectedAmount),
      paidStudents,
      owingStudents: owingStudentIds.size,
      confirmedPaymentCount: confirmedPaymentTotals._count._all,
      confirmedPaymentAmount,
      importedOrOpeningPaidAmount: Math.max(0, collectedAmount - confirmedPaymentAmount),
    },
    todayActivity: {
      paymentsRecordedToday: todayPaymentTotals._count._all,
      amountCollectedToday: asNumber(todayPaymentTotals._sum.amount),
      receiptsIssuedToday,
      onlinePaymentsConfirmedToday,
      pendingOnlinePayments,
      lastPaymentRecordedAt: lastPayment?.paymentDate ?? null,
      lastPaymentReceiptNumber: lastPayment?.receiptNumber ?? null,
      lastPaymentAmount: asNumber(lastPayment?.amount),
    },
    weakClasses,
    highRiskOwingStudents,
    integrityAlerts,
    receiptIntegrity,
  };
}
