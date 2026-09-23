import prisma from "@/src/lib/prisma";
import { Prisma } from "@/src/generated/prisma";

type CorrectionRisk = "Critical" | "High" | "Watch" | "Normal";

type CorrectionIssue = {
  id: string;
  title: string;
  detail: string;
  amount: number | null;
  href: string;
  risk: CorrectionRisk;
};

export type CorrectionReversalReport = {
  totalRequests: number;
  pendingReview: number;
  approvedWaitingApplication: number;
  applied: number;
  rejected: number;
  cancelled: number;
  reversedPayments: number;
  correctedPayments: number;
  totalAffectedAmount: number;
  pendingAffectedAmount: number;
  oldestPendingDays: number;
  riskyIssueCount: number;
  byType: { label: string; count: number }[];
  byAction: { label: string; count: number }[];
  issues: CorrectionIssue[];
};

const TYPE_LABELS: Record<string, string> = {
  WRONG_AMOUNT: "Wrong amount",
  WRONG_STUDENT: "Wrong student",
  DUPLICATE_PAYMENT: "Duplicate payment",
  WRONG_METHOD: "Wrong method",
  WRONG_REFERENCE: "Wrong reference",
  PAYMENT_BOUNCED: "Payment bounced",
  RECEIPT_CANCELLATION: "Receipt cancellation",
  OTHER: "Other",
};

const ACTION_LABELS: Record<string, string> = {
  REVERSE_PAYMENT: "Reverse payment",
  REPLACE_PAYMENT: "Replace payment",
  MOVE_PAYMENT: "Move payment",
  MARK_DUPLICATE: "Mark duplicate",
  FIX_REFERENCE_OR_METHOD: "Fix method/reference",
  CANCEL_RECEIPT: "Cancel receipt",
};

function asNumber(value: Prisma.Decimal | number | string | null | undefined) {
  if (value instanceof Prisma.Decimal) return value.toNumber();
  return Number(value ?? 0);
}

function personName(person: { name: string; surname: string }) {
  return `${person.name} ${person.surname}`.trim();
}

function daysSince(date: Date, now = new Date()) {
  return Math.max(0, Math.floor((now.getTime() - date.getTime()) / 86_400_000));
}

function labelFromMap(map: Record<string, string>, value: string) {
  return map[value] ?? value.replaceAll("_", " ").toLowerCase();
}

export async function getCorrectionReversalReport(schoolId: string): Promise<CorrectionReversalReport> {
  const [statusCounts, typeCounts, actionCounts, corrections, reversals] = await Promise.all([
    prisma.paymentCorrectionRequest.groupBy({
      by: ["status"],
      where: { schoolId },
      _count: { _all: true },
    }),
    prisma.paymentCorrectionRequest.groupBy({
      by: ["type"],
      where: { schoolId },
      _count: { _all: true },
      orderBy: { _count: { type: "desc" } },
    }),
    prisma.paymentCorrectionRequest.groupBy({
      by: ["requestedAction"],
      where: { schoolId },
      _count: { _all: true },
      orderBy: { _count: { requestedAction: "desc" } },
    }),
    prisma.paymentCorrectionRequest.findMany({
      where: { schoolId },
      select: {
        id: true,
        type: true,
        requestedAction: true,
        status: true,
        reason: true,
        requestedAt: true,
        reviewedAt: true,
        appliedAt: true,
        originalPayment: {
          select: {
            id: true,
            receiptNumber: true,
            amount: true,
            status: true,
            paymentMethod: true,
            referenceNo: true,
          },
        },
        correctedPayment: { select: { id: true, receiptNumber: true, amount: true } },
        studentBill: {
          select: {
            id: true,
            student: { select: { name: true, surname: true, class: { select: { name: true } } } },
          },
        },
      },
      orderBy: [{ status: "asc" }, { requestedAt: "desc" }],
      take: 300,
    }),
    prisma.paymentReversal.findMany({
      where: { schoolId },
      select: {
        id: true,
        reason: true,
        reversedAt: true,
        payment: {
          select: {
            id: true,
            receiptNumber: true,
            amount: true,
            studentBill: {
              select: {
                id: true,
                student: { select: { name: true, surname: true, class: { select: { name: true } } } },
              },
            },
          },
        },
      },
      orderBy: { reversedAt: "desc" },
      take: 80,
    }),
  ]);

  const countByStatus = Object.fromEntries(statusCounts.map((row) => [row.status, row._count._all])) as Record<string, number>;
  const pendingCorrections = corrections.filter((item) => item.status === "PENDING_REVIEW");
  const approvedCorrections = corrections.filter((item) => item.status === "APPROVED");
  const totalAffectedAmount = corrections.reduce((sum, item) => sum + asNumber(item.originalPayment.amount), 0);
  const pendingAffectedAmount = pendingCorrections.reduce((sum, item) => sum + asNumber(item.originalPayment.amount), 0);
  const oldestPendingDays = pendingCorrections.reduce((max, item) => Math.max(max, daysSince(item.requestedAt)), 0);

  const issues: CorrectionIssue[] = [
    ...pendingCorrections.slice(0, 8).map((item) => {
      const age = daysSince(item.requestedAt);
      return {
        id: `pending-correction-${item.id}`,
        title: age > 2 ? "Correction waiting too long" : "Correction awaiting review",
        detail: `${personName(item.studentBill.student)} - ${item.originalPayment.receiptNumber} - ${labelFromMap(TYPE_LABELS, item.type)}`,
        amount: asNumber(item.originalPayment.amount),
        href: "/list/finance/corrections?status=PENDING_REVIEW",
        risk: age > 2 ? "High" as const : "Watch" as const,
      };
    }),
    ...approvedCorrections.slice(0, 6).map((item) => ({
      id: `approved-correction-${item.id}`,
      title: "Approved correction not applied",
      detail: `${personName(item.studentBill.student)} - ${labelFromMap(ACTION_LABELS, item.requestedAction)} must still be applied`,
      amount: asNumber(item.originalPayment.amount),
      href: "/list/finance/corrections?status=APPROVED",
      risk: "High" as const,
    })),
    ...corrections
      .filter((item) => item.requestedAction === "MOVE_PAYMENT" || item.type === "WRONG_STUDENT" || item.type === "DUPLICATE_PAYMENT")
      .slice(0, 6)
      .map((item) => ({
        id: `sensitive-correction-${item.id}`,
        title: "Sensitive correction path",
        detail: `${labelFromMap(TYPE_LABELS, item.type)} on ${item.originalPayment.receiptNumber}. Check family, bill, and receipt history carefully.`,
        amount: asNumber(item.originalPayment.amount),
        href: "/list/finance/corrections",
        risk: item.status === "APPLIED" ? "Watch" as const : "Critical" as const,
      })),
    ...reversals.slice(0, 5).map((item) => ({
      id: `reversal-${item.id}`,
      title: "Payment reversed",
      detail: `${item.payment.receiptNumber} - ${personName(item.payment.studentBill.student)} - ${item.reason}`,
      amount: asNumber(item.payment.amount),
      href: `/list/finance/receipts?search=${encodeURIComponent(item.payment.receiptNumber)}`,
      risk: "Watch" as const,
    })),
  ].slice(0, 14);

  return {
    totalRequests: statusCounts.reduce((sum, row) => sum + row._count._all, 0),
    pendingReview: countByStatus.PENDING_REVIEW ?? 0,
    approvedWaitingApplication: countByStatus.APPROVED ?? 0,
    applied: countByStatus.APPLIED ?? 0,
    rejected: countByStatus.REJECTED ?? 0,
    cancelled: countByStatus.CANCELLED ?? 0,
    reversedPayments: reversals.length,
    correctedPayments: corrections.filter((item) => item.correctedPayment).length,
    totalAffectedAmount,
    pendingAffectedAmount,
    oldestPendingDays,
    riskyIssueCount: issues.filter((item) => item.risk === "Critical" || item.risk === "High").length,
    byType: typeCounts.slice(0, 6).map((row) => ({ label: labelFromMap(TYPE_LABELS, row.type), count: row._count._all })),
    byAction: actionCounts.slice(0, 6).map((row) => ({ label: labelFromMap(ACTION_LABELS, row.requestedAction), count: row._count._all })),
    issues,
  };
}
