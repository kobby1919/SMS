import prisma from "@/src/lib/prisma";
import { Prisma } from "@/src/generated/prisma";
import { PAYMENT_METHOD_LABELS } from "@/src/lib/constants/finance";

export type ReceiptIntegrityRisk = "Clean" | "Watch" | "Risk";

export type ReceiptIntegrityIssue = {
  id: string;
  title: string;
  detail: string;
  amount: number | null;
  href: string;
  risk: ReceiptIntegrityRisk;
};

export type ReceiptIntegrityReport = {
  totalReceipts: number;
  confirmedReceipts: number;
  voidedReceipts: number;
  pendingReceipts: number;
  failedReceipts: number;
  correctedReceipts: number;
  correctionLinkedReceipts: number;
  duplicateReferenceCount: number;
  receiptGapCount: number;
  issueCount: number;
  issues: ReceiptIntegrityIssue[];
};

function asNumber(value: Prisma.Decimal | number | string | null | undefined) {
  if (value instanceof Prisma.Decimal) return value.toNumber();
  return Number(value ?? 0);
}

function studentName(student: { name: string; surname: string }) {
  return `${student.name} ${student.surname}`.trim();
}

function receiptCounter(receiptNumber: string) {
  const match = receiptNumber.match(/(\d+)$/);
  return match ? Number(match[1]) : null;
}

export async function getReceiptIntegrityReport(schoolId: string): Promise<ReceiptIntegrityReport> {
  const [statusCounts, receiptNumbers, referenceRows, payments, correctionLinks, correctionLinkedCount, correctedReceiptCount] = await Promise.all([
    prisma.payment.groupBy({
      by: ["status"],
      where: { schoolId },
      _count: { _all: true },
    }),
    prisma.payment.findMany({
      where: { schoolId },
      select: { receiptNumber: true },
      orderBy: { receiptNumber: "asc" },
    }),
    prisma.payment.findMany({
      where: {
        schoolId,
        referenceNo: { not: null },
        status: { notIn: ["FAILED", "REVERSED"] },
      },
      select: {
        id: true,
        amount: true,
        paymentMethod: true,
        referenceNo: true,
      },
      orderBy: { paymentDate: "desc" },
    }),
    prisma.payment.findMany({
      where: { schoolId },
      select: {
        id: true,
        receiptNumber: true,
        amount: true,
        status: true,
        paymentMethod: true,
        referenceNo: true,
        paymentDate: true,
        studentBill: {
          select: {
            student: { select: { name: true, surname: true, class: { select: { name: true } } } },
          },
        },
        reversal: { select: { reason: true, reversedAt: true } },
        correctionRequests: {
          where: { status: { in: ["PENDING_REVIEW", "APPROVED", "APPLIED"] } },
          select: { id: true, type: true, requestedAction: true, status: true },
          take: 1,
        },
        correctedPaymentCorrections: {
          select: { id: true, originalPayment: { select: { receiptNumber: true } } },
          take: 1,
        },
      },
      orderBy: { paymentDate: "desc" },
      take: 500,
    }),
    prisma.paymentCorrectionRequest.findMany({
      where: {
        schoolId,
        status: { in: ["APPROVED", "APPLIED"] },
        OR: [
          { correctedPaymentId: { not: null } },
          { requestedAction: { in: ["CANCEL_RECEIPT", "REVERSE_PAYMENT", "MARK_DUPLICATE"] } },
        ],
      },
      select: {
        id: true,
        requestedAction: true,
        originalPayment: { select: { id: true, receiptNumber: true, amount: true } },
        correctedPayment: { select: { id: true, receiptNumber: true, amount: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 50,
    }),
    prisma.paymentCorrectionRequest.count({
      where: {
        schoolId,
        status: { in: ["APPROVED", "APPLIED"] },
        OR: [
          { correctedPaymentId: { not: null } },
          { requestedAction: { in: ["CANCEL_RECEIPT", "REVERSE_PAYMENT", "MARK_DUPLICATE"] } },
        ],
      },
    }),
    prisma.paymentCorrectionRequest.count({
      where: {
        schoolId,
        status: { in: ["APPROVED", "APPLIED"] },
        correctedPaymentId: { not: null },
      },
    }),
  ]);
  const countByStatus = Object.fromEntries(statusCounts.map((row) => [row.status, row._count._all])) as Record<string, number>;
  const totalReceipts = statusCounts.reduce((sum, row) => sum + row._count._all, 0);
  const referenceGroups = new Map<string, typeof referenceRows>();

  for (const payment of referenceRows) {
    const ref = payment.referenceNo?.trim();
    if (!ref) continue;
    const key = `${payment.paymentMethod}:${ref.toLowerCase()}`;
    const current = referenceGroups.get(key) ?? [];
    current.push(payment);
    referenceGroups.set(key, current);
  }

  const duplicateReferenceGroups = Array.from(referenceGroups.values()).filter((group) => group.length > 1);
  const counters = receiptNumbers
    .map((payment) => receiptCounter(payment.receiptNumber))
    .filter((value): value is number => Number.isInteger(value))
    .sort((a, b) => a - b);
  let receiptGapCount = 0;
  for (let i = 1; i < counters.length; i += 1) {
    const gap = counters[i] - counters[i - 1];
    if (gap > 1) receiptGapCount += gap - 1;
  }

  const issues: ReceiptIntegrityIssue[] = [
    ...payments
      .filter((payment) => payment.status === "REVERSED")
      .slice(0, 8)
      .map((payment) => ({
        id: `reversed-${payment.id}`,
        title: "Voided receipt",
        detail: `${payment.receiptNumber} - ${studentName(payment.studentBill.student)} - ${payment.reversal?.reason ?? "No reason saved"}`,
        amount: asNumber(payment.amount),
        href: `/list/finance/receipts?search=${encodeURIComponent(payment.receiptNumber)}`,
        risk: "Risk" as const,
      })),
    ...duplicateReferenceGroups.slice(0, 5).map((group) => {
      const first = group[0];
      return {
        id: `duplicate-ref-${first.id}`,
        title: "Possible duplicate reference",
        detail: `${group.length} active payments use ${PAYMENT_METHOD_LABELS[first.paymentMethod] ?? first.paymentMethod} reference ${first.referenceNo}`,
        amount: group.reduce((sum, payment) => sum + asNumber(payment.amount), 0),
        href: `/list/finance/payments?search=${encodeURIComponent(first.referenceNo ?? "")}`,
        risk: "Risk" as const,
      };
    }),
    ...payments
      .filter((payment) => payment.status === "PENDING" || payment.status === "FAILED")
      .slice(0, 6)
      .map((payment) => ({
        id: `unconfirmed-${payment.id}`,
        title: payment.status === "PENDING" ? "Receipt not confirmed" : "Failed payment record",
        detail: `${payment.receiptNumber} - ${studentName(payment.studentBill.student)} - ${PAYMENT_METHOD_LABELS[payment.paymentMethod] ?? payment.paymentMethod}`,
        amount: asNumber(payment.amount),
        href: `/list/finance/receipts?search=${encodeURIComponent(payment.receiptNumber)}`,
        risk: payment.status === "FAILED" ? "Risk" as const : "Watch" as const,
      })),
    ...correctionLinks.slice(0, 6).map((correction) => ({
      id: `correction-link-${correction.id}`,
      title: correction.correctedPayment ? "Corrected receipt issued" : "Receipt correction applied",
      detail: correction.correctedPayment
        ? `${correction.originalPayment.receiptNumber} corrected by ${correction.correctedPayment.receiptNumber}`
        : `${correction.originalPayment.receiptNumber} affected by ${correction.requestedAction.replaceAll("_", " ").toLowerCase()}`,
      amount: asNumber(correction.correctedPayment?.amount ?? correction.originalPayment.amount),
      href: `/list/finance/receipts?search=${encodeURIComponent(correction.correctedPayment?.receiptNumber ?? correction.originalPayment.receiptNumber)}`,
      risk: "Watch" as const,
    })),
  ].slice(0, 14);

  return {
    totalReceipts,
    confirmedReceipts: countByStatus.CONFIRMED ?? 0,
    voidedReceipts: countByStatus.REVERSED ?? 0,
    pendingReceipts: countByStatus.PENDING ?? 0,
    failedReceipts: countByStatus.FAILED ?? 0,
    correctedReceipts: correctedReceiptCount,
    correctionLinkedReceipts: correctionLinkedCount,
    duplicateReferenceCount: duplicateReferenceGroups.length,
    receiptGapCount,
    issueCount: issues.length,
    issues,
  };
}
