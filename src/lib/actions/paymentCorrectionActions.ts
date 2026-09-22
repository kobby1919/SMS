"use server";

import { revalidatePath } from "next/cache";
import prisma from "@/src/lib/prisma";
import { requireFinanceAccess, recomputeBillStatus, writeAuditLog } from "@/src/lib/actions/financeActions";
import { requireResourceAccess } from "@/src/lib/authz";
import { parseActionInput } from "@/src/lib/validation/parse";
import { paymentCorrectionApplySchema, paymentCorrectionCancelSchema, paymentCorrectionRequestSchema, paymentCorrectionReviewSchema } from "@/src/lib/validation/finance";
import { enforceActionRateLimit } from "@/src/lib/rate-limit";
import { Prisma } from "@/src/generated/prisma";
import type { PaymentMethod } from "@/src/generated/prisma";
import { revalidateDashboard, revalidateDocument } from "@/src/lib/cacheTags";
import { enqueueFinanceJob } from "@/src/lib/services/finance-queue";
import { recordParentActivityEvents } from "@/src/lib/services/parent-activity-events";

export type RequestPaymentCorrectionInput = {
  paymentId: number;
  type: string;
  requestedAction: string;
  reason: string;
  proposedChange?: string | null;
  evidenceRef?: string | null;
};

export type ReviewPaymentCorrectionInput = {
  correctionId: number;
  decision: "APPROVE" | "REJECT";
  reviewNote: string;
};
export type CancelPaymentCorrectionInput = {
  correctionId: number;
  cancelReason: string;
};

export type ApplyPaymentCorrectionInput = {
  correctionId: number;
  applicationNote: string;
  correctedAmount?: number | null;
  targetStudentBillId?: number | null;
  paymentMethod?: PaymentMethod | null;
  referenceNo?: string | null;
  paidBy?: string | null;
  paymentDate?: string | null;
};

function isPrismaErrorCode(error: unknown, code: string) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === code
  );
}

const REFERENCE_REQUIRED_PAYMENT_METHODS = new Set<PaymentMethod>([
  "MTN_MOMO",
  "VODAFONE_CASH",
  "AIRTELTIGO_MONEY",
  "BANK_TRANSFER",
  "CHEQUE",
  "POS",
]);

function normalizeCorrectionPaymentDate(dateString?: string | null, fallback?: Date) {
  const date = dateString
    ? new Date(`${dateString}T12:00:00.000Z`)
    : fallback ?? new Date();

  if (Number.isNaN(date.getTime())) {
    throw new Error("Use a valid payment date.");
  }

  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);
  if (date > todayEnd) {
    throw new Error("Payment date cannot be in the future.");
  }

  return date;
}

async function generateReceiptNumberInTransaction(
  tx: Prisma.TransactionClient,
  schoolId: string,
) {
  const year = new Date().getFullYear();

  await tx.receiptCounter.upsert({
    where: { schoolId_year: { schoolId, year } },
    create: { schoolId, year, lastCounter: 0 },
    update: {},
  });

  const counter = await tx.receiptCounter.update({
    where: { schoolId_year: { schoolId, year } },
    data: { lastCounter: { increment: 1 } },
  });

  return `RCP-${year}-${String(counter.lastCounter).padStart(3, "0")}`;
}

async function unwindPaymentAllocation(
  tx: Prisma.TransactionClient,
  payment: {
    id: number;
    amount: Prisma.Decimal;
    studentBillId: number;
    studentBill: {
      lineItems: Array<{
        id: number;
        amount: Prisma.Decimal;
        amountPaid: Prisma.Decimal;
      }>;
    };
  },
) {
  const amountToReverse = new Prisma.Decimal(payment.amount);

  await tx.studentBill.update({
    where: { id: payment.studentBillId },
    data: { amountPaid: { decrement: amountToReverse } },
  });

  let toUnwind = new Prisma.Decimal(amountToReverse);
  const sortedLines = [...payment.studentBill.lineItems].sort((a, b) => b.id - a.id);

  for (const line of sortedLines) {
    if (toUnwind.lte(0)) break;

    const paid = new Prisma.Decimal(line.amountPaid);
    const toDeduct = Prisma.Decimal.min(toUnwind, paid);
    const newPaid = paid.sub(toDeduct);
    const newBal = new Prisma.Decimal(line.amount).sub(newPaid);

    await tx.billLineItem.update({
      where: { id: line.id },
      data: {
        amountPaid: Prisma.Decimal.max(newPaid, 0),
        balance: Prisma.Decimal.max(newBal, 0),
        isPaid: false,
      },
    });

    toUnwind = toUnwind.sub(toDeduct);
  }
}

async function allocatePaymentToBill(
  tx: Prisma.TransactionClient,
  bill: {
    id: number;
    lineItems: Array<{
      id: number;
      amount: Prisma.Decimal;
      amountPaid: Prisma.Decimal;
      balance: Prisma.Decimal;
      isPaid: boolean;
    }>;
  },
  amount: Prisma.Decimal,
) {
  await tx.studentBill.update({
    where: { id: bill.id },
    data: { amountPaid: { increment: amount } },
  });

  let remaining = new Prisma.Decimal(amount);
  const sortedLines = [...bill.lineItems].sort((a, b) => a.id - b.id);

  for (const line of sortedLines) {
    if (remaining.lte(0)) break;
    if (line.isPaid) continue;

    const lineBalance = new Prisma.Decimal(line.balance);
    if (lineBalance.lte(0)) continue;

    const allocated = Prisma.Decimal.min(remaining, lineBalance);
    const newPaid = new Prisma.Decimal(line.amountPaid).add(allocated);
    const newBal = new Prisma.Decimal(line.amount).sub(newPaid);

    await tx.billLineItem.update({
      where: { id: line.id },
      data: {
        amountPaid: newPaid,
        balance: Prisma.Decimal.max(newBal, 0),
        isPaid: newBal.lte(0),
      },
    });

    remaining = remaining.sub(allocated);
  }
}

export async function requestPaymentCorrection(input: RequestPaymentCorrectionInput) {
  const ctx = await requireFinanceAccess();
  const { userId, schoolId, role } = ctx;

  if (role !== "bursar") {
    throw new Error("Only a bursar can request a payment correction. Admins review and decide on correction requests.");
  }

  await enforceActionRateLimit({
    key: `finance:payment-correction-request:${schoolId}:${userId}`,
    limit: 12,
    windowMs: 10 * 60_000,
  });

  const data = parseActionInput(paymentCorrectionRequestSchema, input);

  const payment = requireResourceAccess(
    await prisma.payment.findFirst({
      where: { id: data.paymentId, schoolId },
      include: {
        studentBill: {
          select: {
            id: true,
            schoolId: true,
            status: true,
            balance: true,
            amountPaid: true,
            student: {
              select: {
                id: true,
                name: true,
                surname: true,
                class: { select: { name: true } },
              },
            },
            feeStructure: { select: { title: true, term: true, academicYear: true } },
          },
        },
        correctionRequests: {
          where: { status: { in: ["PENDING_REVIEW", "APPROVED"] } },
          select: { id: true, status: true },
          take: 1,
        },
        reversal: { select: { id: true, reason: true, reversedAt: true } },
      },
    }),
    ctx,
    "Payment not found.",
  );

  if (payment.status !== "CONFIRMED") {
    throw new Error("Only confirmed payments can enter the correction workflow. Pending, failed, or already reversed payments cannot be corrected again.");
  }

  if (payment.reversal) {
    throw new Error("This payment has already been reversed. Create a new approved finance record instead of correcting a reversed receipt.");
  }

  if (payment.correctionRequests.length > 0) {
    throw new Error("This receipt already has an open correction request awaiting admin review.");
  }

  try {
    const correction = await prisma.paymentCorrectionRequest.create({
      data: {
        schoolId,
        originalPaymentId: payment.id,
        studentBillId: payment.studentBillId,
        type: data.type,
        requestedAction: data.requestedAction,
        reason: data.reason.trim(),
        proposedChange: data.proposedChange?.trim() || null,
        evidenceRef: data.evidenceRef?.trim() || null,
        requestedBy: userId,
      },
    });

    await writeAuditLog({
      schoolId,
      action: "PAYMENT_CORRECTION_REQUESTED",
      performedBy: userId,
      entityType: "PaymentCorrectionRequest",
      entityId: correction.id,
      metadata: {
        correctionId: correction.id,
        correctionType: correction.type,
        requestedAction: correction.requestedAction,
        status: correction.status,
        originalPaymentId: payment.id,
        receiptNumber: payment.receiptNumber,
        paymentAmount: Number(payment.amount),
        paymentMethod: payment.paymentMethod,
        studentBillId: payment.studentBillId,
        studentId: payment.studentBill.student.id,
        studentName: `${payment.studentBill.student.name} ${payment.studentBill.student.surname}`,
        className: payment.studentBill.student.class?.name ?? null,
        billStatus: payment.studentBill.status,
        billBalance: Number(payment.studentBill.balance),
        reason: correction.reason,
      },
    });

    revalidatePath("/bursar");
    revalidatePath("/list/finance/payments");
    revalidatePath("/list/finance/receipts");
    revalidatePath(`/list/finance/bills/${payment.studentBillId}`);

    return correction;
  } catch (error) {
    if (isPrismaErrorCode(error, "P2002")) {
      throw new Error("This receipt already has an open correction request awaiting admin review.");
    }
    throw error;
  }
}
export async function reviewPaymentCorrection(input: ReviewPaymentCorrectionInput) {
  const ctx = await requireFinanceAccess();
  const { userId, schoolId, role } = ctx;

  if (role !== "admin") {
    throw new Error("Only an admin can review payment correction requests. Bursars request corrections; admins approve or reject them.");
  }

  await enforceActionRateLimit({
    key: `finance:payment-correction-review:${schoolId}:${userId}`,
    limit: 20,
    windowMs: 10 * 60_000,
  });

  const data = parseActionInput(paymentCorrectionReviewSchema, input);
  const nextStatus = data.decision === "APPROVE" ? "APPROVED" : "REJECTED";

  const correction = requireResourceAccess(
    await prisma.paymentCorrectionRequest.findFirst({
      where: { id: data.correctionId, schoolId },
      include: {
        originalPayment: {
          include: {
            studentBill: {
              select: {
                id: true,
                schoolId: true,
                studentId: true,
                status: true,
                balance: true,
                amountPaid: true,
                student: {
                  select: {
                    id: true,
                    name: true,
                    surname: true,
                    class: { select: { name: true } },
                  },
                },
              },
            },
            reversal: { select: { id: true, reason: true, reversedAt: true } },
          },
        },
        correctedPayment: { select: { id: true, receiptNumber: true, status: true } },
      },
    }),
    ctx,
    "Correction request not found.",
  );

  if (correction.originalPayment.schoolId !== schoolId || correction.originalPayment.studentBill.schoolId !== schoolId) {
    throw new Error("Correction source records do not belong to this school.");
  }

  if (correction.originalPayment.studentBillId !== correction.studentBillId) {
    throw new Error("Correction source records are inconsistent. The affected bill must match the original payment bill.");
  }

  if (correction.status !== "PENDING_REVIEW") {
    throw new Error("Only pending correction requests can be reviewed.");
  }

  if (correction.requestedBy === userId) {
    throw new Error("You cannot approve or reject a correction request you created.");
  }

  if (data.decision === "APPROVE") {
    if (correction.originalPayment.status !== "CONFIRMED") {
      throw new Error("Only corrections for confirmed payments can be approved. Reject this request and create a fresh correction if needed.");
    }

    if (correction.originalPayment.reversal) {
      throw new Error("This payment has already been reversed. Reject this request and review the reversal history instead.");
    }
  }

  const reviewedAt = new Date();
  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.paymentCorrectionRequest.updateMany({
      where: {
        id: correction.id,
        schoolId,
        status: "PENDING_REVIEW",
      },
      data: {
        status: nextStatus,
        reviewedBy: userId,
        reviewedAt,
        reviewNote: data.reviewNote.trim(),
      },
    });

    if (result.count !== 1) {
      throw new Error("This correction request has already been reviewed. Refresh the page and check the latest status.");
    }

    return tx.paymentCorrectionRequest.findUniqueOrThrow({
      where: { id: correction.id },
    });
  });

  await writeAuditLog({
    schoolId,
    action: data.decision === "APPROVE" ? "PAYMENT_CORRECTION_APPROVED" : "PAYMENT_CORRECTION_REJECTED",
    performedBy: userId,
    entityType: "PaymentCorrectionRequest",
    entityId: correction.id,
    metadata: {
      correctionId: correction.id,
      correctionType: correction.type,
      requestedAction: correction.requestedAction,
      previousStatus: correction.status,
      status: updated.status,
      originalPaymentId: correction.originalPaymentId,
      correctedPaymentId: correction.correctedPaymentId,
      receiptNumber: correction.originalPayment.receiptNumber,
      paymentAmount: Number(correction.originalPayment.amount),
      paymentMethod: correction.originalPayment.paymentMethod,
      studentBillId: correction.studentBillId,
      studentId: correction.originalPayment.studentBill.student.id,
      studentName: `${correction.originalPayment.studentBill.student.name} ${correction.originalPayment.studentBill.student.surname}`,
      className: correction.originalPayment.studentBill.student.class?.name ?? null,
      requestedBy: correction.requestedBy,
      reviewedBy: userId,
      reviewNote: updated.reviewNote,
    },
  });

  revalidatePath("/bursar");
  revalidatePath("/list/finance/payments");
  revalidatePath("/list/finance/receipts");
  revalidatePath(`/list/finance/bills/${correction.studentBillId}`);

  return updated;
}
export async function applyPaymentCorrection(input: ApplyPaymentCorrectionInput) {
  const ctx = await requireFinanceAccess();
  const { userId, schoolId, role } = ctx;

  if (role !== "admin") {
    throw new Error("Only an admin can apply an approved payment correction.");
  }

  await enforceActionRateLimit({
    key: `finance:payment-correction-apply:${schoolId}:${userId}`,
    limit: 12,
    windowMs: 10 * 60_000,
  });

  const data = parseActionInput(paymentCorrectionApplySchema, input);

  const correction = requireResourceAccess(
    await prisma.paymentCorrectionRequest.findFirst({
      where: { id: data.correctionId, schoolId },
      include: {
        originalPayment: {
          include: {
            studentBill: {
              include: {
                lineItems: true,
                student: { select: { id: true, name: true, surname: true, class: { select: { name: true } } } },
                feeStructure: { select: { title: true } },
              },
            },
            reversal: true,
          },
        },
        correctedPayment: { select: { id: true, receiptNumber: true, status: true } },
      },
    }),
    ctx,
    "Correction request not found.",
  );

  if (correction.status !== "APPROVED") {
    throw new Error("Only approved correction requests can be applied.");
  }

  if (correction.appliedAt || correction.correctedPayment) {
    throw new Error("This correction request has already been applied.");
  }

  if (correction.originalPayment.schoolId !== schoolId || correction.originalPayment.studentBill.schoolId !== schoolId) {
    throw new Error("Correction source records do not belong to this school.");
  }

  if (correction.originalPayment.studentBillId !== correction.studentBillId) {
    throw new Error("Correction source records are inconsistent. The affected bill must match the original payment bill.");
  }

  if (correction.originalPayment.status !== "CONFIRMED" || correction.originalPayment.reversal) {
    throw new Error("The original payment is no longer valid for correction application. It may already be reversed or changed.");
  }

  const correctedPaymentActions = ["REPLACE_PAYMENT", "MOVE_PAYMENT", "FIX_REFERENCE_OR_METHOD"];
  const shouldCreateCorrectedPayment = correctedPaymentActions.includes(correction.requestedAction);

  if (shouldCreateCorrectedPayment && correction.requestedAction === "MOVE_PAYMENT" && !data.targetStudentBillId) {
    throw new Error("Choose the bill that should receive the moved payment.");
  }

  if (correction.requestedAction === "REPLACE_PAYMENT" && !data.correctedAmount) {
    throw new Error("Enter the corrected amount before applying a replacement payment.");
  }

  if (correction.requestedAction === "FIX_REFERENCE_OR_METHOD" && !data.paymentMethod && data.referenceNo === undefined) {
    throw new Error("Provide a corrected payment method or reference number before applying this correction.");
  }

  const originalPayment = correction.originalPayment;
  const correctedAmount = shouldCreateCorrectedPayment
    ? new Prisma.Decimal(data.correctedAmount ?? originalPayment.amount)
    : null;
  const correctedMethod = data.paymentMethod ?? originalPayment.paymentMethod;
  const correctedReference = data.referenceNo === undefined
    ? originalPayment.referenceNo
    : data.referenceNo?.trim() || null;
  const correctedPaidBy = data.paidBy?.trim() || originalPayment.paidBy;
  const correctedPaymentDate = normalizeCorrectionPaymentDate(data.paymentDate, originalPayment.paymentDate);
  const targetBillId = correction.requestedAction === "MOVE_PAYMENT"
    ? data.targetStudentBillId
    : originalPayment.studentBillId;

  if (shouldCreateCorrectedPayment) {
    if (!targetBillId) {
      throw new Error("A target bill is required for this correction.");
    }

    if (correctedMethod === "CASH" && correctedReference) {
      throw new Error("Cash payments should not use an external reference number.");
    }

    if (REFERENCE_REQUIRED_PAYMENT_METHODS.has(correctedMethod) && !correctedReference) {
      throw new Error("Reference number is required for this corrected payment method.");
    }
  }

  const appliedAt = new Date();
  const result = await prisma.$transaction(async (tx) => {
    const lockedCorrection = await tx.paymentCorrectionRequest.findFirst({
      where: { id: correction.id, schoolId, status: "APPROVED", appliedAt: null },
      select: { id: true },
    });

    if (!lockedCorrection) {
      throw new Error("This correction request has already been applied or changed. Refresh and check the latest status.");
    }

    const freshPayment = await tx.payment.findFirst({
      where: { id: originalPayment.id, schoolId },
      include: {
        studentBill: { include: { lineItems: true } },
        reversal: true,
      },
    });

    if (!freshPayment || freshPayment.status !== "CONFIRMED" || freshPayment.reversal) {
      throw new Error("The original payment can no longer be corrected safely.");
    }

    await tx.payment.update({
      where: { id: freshPayment.id },
      data: { status: "REVERSED" },
    });

    await tx.paymentReversal.create({
      data: {
        schoolId,
        paymentId: freshPayment.id,
        reason: `Correction #${correction.id}: ${data.applicationNote.trim()}`,
        reversedBy: userId,
        reversedAt: appliedAt,
      },
    });

    await unwindPaymentAllocation(tx, freshPayment);

    let correctedPayment: { id: number; receiptNumber: string; studentBillId: number; paymentDate: Date } | null = null;

    if (shouldCreateCorrectedPayment) {
      const safeTargetBillId = targetBillId;
      if (!safeTargetBillId) {
        throw new Error("A target bill is required for this correction.");
      }

      const targetBill = await tx.studentBill.findFirst({
        where: { id: safeTargetBillId, schoolId },
        include: {
          student: { select: { id: true, name: true, surname: true } },
        },
      });

      if (!targetBill) {
        throw new Error("Target bill not found for corrected payment.");
      }

      if (targetBill.status === "WAIVED") {
        throw new Error("Cannot apply a corrected payment to a waived bill.");
      }

      if (correctedReference) {
        const duplicateReference = await tx.payment.findFirst({
          where: {
            schoolId,
            paymentMethod: correctedMethod,
            referenceNo: { equals: correctedReference, mode: "insensitive" },
            status: { notIn: ["FAILED", "REVERSED"] },
          },
          select: { id: true, receiptNumber: true },
        });

        if (duplicateReference) {
          throw new Error(`Reference number already used on receipt ${duplicateReference.receiptNumber}.`);
        }
      }

      const currentBalance = new Prisma.Decimal(targetBill.totalAmount)
        .sub(targetBill.amountPaid)
        .sub(targetBill.discountAmount);
      const amount = correctedAmount ?? new Prisma.Decimal(originalPayment.amount);

      if (amount.gt(currentBalance.mul(1.5))) {
        throw new Error(
          `Corrected payment amount (GHS ${amount.toFixed(2)}) is more than 150% of the outstanding balance (GHS ${currentBalance.toFixed(2)}).`,
        );
      }

      const receiptNumber = await generateReceiptNumberInTransaction(tx, schoolId);
      correctedPayment = await tx.payment.create({
        data: {
          receiptNumber,
          amount,
          schoolId,
          paymentMethod: correctedMethod,
          paymentDate: correctedPaymentDate,
          paidBy: correctedPaidBy,
          referenceNo: correctedReference,
          idempotencyKey: `correction:${schoolId}:${correction.id}:corrected`,
          notes: `Corrected from ${originalPayment.receiptNumber}. ${data.applicationNote.trim()}`,
          status: "CONFIRMED",
          studentBillId: targetBill.id,
          recordedBy: userId,
        },
        select: { id: true, receiptNumber: true, studentBillId: true, paymentDate: true },
      });

      const targetBillLines = await tx.billLineItem.findMany({
        where: { studentBillId: targetBill.id },
      });

      await allocatePaymentToBill(tx, { id: targetBill.id, lineItems: targetBillLines }, amount);
    }

    const updateResult = await tx.paymentCorrectionRequest.updateMany({
      where: { id: correction.id, schoolId, status: "APPROVED", appliedAt: null },
      data: {
        status: "APPLIED",
        appliedBy: userId,
        appliedAt,
        correctedPaymentId: correctedPayment?.id ?? null,
      },
    });

    if (updateResult.count !== 1) {
      throw new Error("This correction request has already been applied. Refresh and check the latest status.");
    }

    return { correctedPayment };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  const affectedBillIds = new Set<number>([originalPayment.studentBillId]);
  if (result.correctedPayment) affectedBillIds.add(result.correctedPayment.studentBillId);

  for (const billId of affectedBillIds) {
    await recomputeBillStatus(billId, schoolId);
    revalidatePath(`/list/finance/bills/${billId}`);
  }

  await recordParentActivityEvents({
    schoolId,
    studentIds: [originalPayment.studentBill.student.id],
    type: "PAYMENT",
    title: result.correctedPayment
      ? `Payment correction applied: ${result.correctedPayment.receiptNumber}`
      : `Receipt voided: ${originalPayment.receiptNumber}`,
    body: result.correctedPayment
      ? `A payment correction has been approved and applied. Original receipt ${originalPayment.receiptNumber} was voided and corrected receipt ${result.correctedPayment.receiptNumber} was issued.`
      : `A payment correction has been approved and applied. Receipt ${originalPayment.receiptNumber} was voided and remains visible only for history.`,
    href: `/parent/finance/bills/${result.correctedPayment?.studentBillId ?? originalPayment.studentBillId}`,
    sourceModel: "PaymentCorrectionRequest",
    sourceId: String(correction.id),
    sourceKey: `payment-correction:${correction.id}:applied`,
    occurredAt: appliedAt,
    payload: {
      correctionId: correction.id,
      originalPaymentId: originalPayment.id,
      originalReceiptNumber: originalPayment.receiptNumber,
      correctedPaymentId: result.correctedPayment?.id ?? null,
      correctedReceiptNumber: result.correctedPayment?.receiptNumber ?? null,
    },
  });
  await writeAuditLog({
    schoolId,
    action: "PAYMENT_CORRECTION_APPLIED",
    performedBy: userId,
    entityType: "PaymentCorrectionRequest",
    entityId: correction.id,
    metadata: {
      correctionId: correction.id,
      correctionType: correction.type,
      requestedAction: correction.requestedAction,
      originalPaymentId: originalPayment.id,
      originalReceiptNumber: originalPayment.receiptNumber,
      originalStudentBillId: originalPayment.studentBillId,
      correctedPaymentId: result.correctedPayment?.id ?? null,
      correctedReceiptNumber: result.correctedPayment?.receiptNumber ?? null,
      correctedStudentBillId: result.correctedPayment?.studentBillId ?? null,
      applicationNote: data.applicationNote.trim(),
      appliedBy: userId,
      appliedAt: appliedAt.toISOString(),
    },
  });

  await Promise.all([
    enqueueFinanceJob({
      schoolId,
      type: "RECOMPUTE_FINANCE_SUMMARY",
      payload: {
        reason: "PAYMENT_CORRECTION_APPLIED",
        correctionId: correction.id,
        originalPaymentId: originalPayment.id,
        correctedPaymentId: result.correctedPayment?.id ?? null,
      },
      idempotencyKey: `finance-summary:${schoolId}:payment-correction:${correction.id}`,
      createdBy: userId,
    }),
    enqueueFinanceJob({
      schoolId,
      type: "GENERATE_DAILY_REPORT",
      payload: { date: appliedAt.toISOString().slice(0, 10) },
      idempotencyKey: `daily-report:${schoolId}:payment-correction:${correction.id}`,
      createdBy: userId,
    }),
    ...(result.correctedPayment ? [
      enqueueFinanceJob({
        schoolId,
        type: "GENERATE_RECEIPT_PDF",
        payload: {
          paymentId: result.correctedPayment.id,
          receiptNumber: result.correctedPayment.receiptNumber,
        },
        idempotencyKey: `receipt-pdf:${schoolId}:${result.correctedPayment.id}`,
        createdBy: userId,
      }),
      enqueueFinanceJob({
        schoolId,
        type: "SEND_PAYMENT_RECEIPT",
        payload: {
          paymentId: result.correctedPayment.id,
          studentBillId: result.correctedPayment.studentBillId,
          receiptNumber: result.correctedPayment.receiptNumber,
        },
        idempotencyKey: `payment-receipt:${schoolId}:${result.correctedPayment.id}`,
        createdBy: userId,
      }),
    ] : []),
  ]);

  revalidatePath("/bursar");
  revalidatePath("/list/finance/corrections");
  revalidatePath("/list/finance/payments");
  revalidatePath("/list/finance/receipts");
  revalidatePath("/list/finance/bills");
  revalidatePath("/parent");
  revalidatePath("/parent/finance");
  revalidateDashboard(schoolId);
  revalidateDocument(schoolId, "receipt", originalPayment.id);
  if (result.correctedPayment) {
    revalidateDocument(schoolId, "receipt", result.correctedPayment.id);
  }

  return result;
}
export async function cancelPaymentCorrection(input: CancelPaymentCorrectionInput) {
  const ctx = await requireFinanceAccess();
  const { userId, schoolId, role } = ctx;

  if (role !== "admin") {
    throw new Error("Only an admin can cancel a payment correction request.");
  }

  await enforceActionRateLimit({
    key: `finance:payment-correction-cancel:${schoolId}:${userId}`,
    limit: 20,
    windowMs: 10 * 60_000,
  });

  const data = parseActionInput(paymentCorrectionCancelSchema, input);

  const correction = requireResourceAccess(
    await prisma.paymentCorrectionRequest.findFirst({
      where: { id: data.correctionId, schoolId },
      include: {
        originalPayment: { select: { id: true, receiptNumber: true, studentBillId: true } },
        correctedPayment: { select: { id: true, receiptNumber: true } },
      },
    }),
    ctx,
    "Correction request not found.",
  );

  if (!["PENDING_REVIEW", "APPROVED"].includes(correction.status)) {
    throw new Error("Only pending or approved correction requests can be cancelled before application.");
  }

  if (correction.appliedAt || correction.correctedPaymentId) {
    throw new Error("Applied correction requests cannot be cancelled. Use a new correction request if another finance change is needed.");
  }

  const cancelledAt = new Date();
  const updateResult = await prisma.paymentCorrectionRequest.updateMany({
    where: {
      id: correction.id,
      schoolId,
      status: { in: ["PENDING_REVIEW", "APPROVED"] },
      appliedAt: null,
      correctedPaymentId: null,
    },
    data: {
      status: "CANCELLED",
      reviewedBy: correction.reviewedBy ?? userId,
      reviewedAt: correction.reviewedAt ?? cancelledAt,
      reviewNote: data.cancelReason.trim(),
    },
  });

  if (updateResult.count !== 1) {
    throw new Error("This correction request has already changed. Refresh and check the latest status.");
  }

  await writeAuditLog({
    schoolId,
    action: "PAYMENT_CORRECTION_CANCELLED",
    performedBy: userId,
    entityType: "PaymentCorrectionRequest",
    entityId: correction.id,
    metadata: {
      correctionId: correction.id,
      previousStatus: correction.status,
      status: "CANCELLED",
      originalPaymentId: correction.originalPaymentId,
      originalReceiptNumber: correction.originalPayment.receiptNumber,
      correctedPaymentId: correction.correctedPaymentId,
      cancelReason: data.cancelReason.trim(),
      cancelledBy: userId,
      cancelledAt: cancelledAt.toISOString(),
    },
  });

  revalidatePath("/bursar");
  revalidatePath("/list/finance/corrections");
  revalidatePath("/list/finance/payments");
  revalidatePath("/list/finance/receipts");
  revalidatePath(`/list/finance/bills/${correction.originalPayment.studentBillId}`);

  return { id: correction.id, status: "CANCELLED" as const };
}
