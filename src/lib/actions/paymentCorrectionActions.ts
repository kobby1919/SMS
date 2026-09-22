"use server";

import { revalidatePath } from "next/cache";
import prisma from "@/src/lib/prisma";
import { requireFinanceAccess, writeAuditLog } from "@/src/lib/actions/financeActions";
import { requireResourceAccess } from "@/src/lib/authz";
import { parseActionInput } from "@/src/lib/validation/parse";
import { paymentCorrectionRequestSchema, paymentCorrectionReviewSchema } from "@/src/lib/validation/finance";
import { enforceActionRateLimit } from "@/src/lib/rate-limit";

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

function isPrismaErrorCode(error: unknown, code: string) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === code
  );
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
