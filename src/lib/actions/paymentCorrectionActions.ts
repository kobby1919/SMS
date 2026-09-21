"use server";

import { revalidatePath } from "next/cache";
import prisma from "@/src/lib/prisma";
import { requireFinanceAccess, writeAuditLog } from "@/src/lib/actions/financeActions";
import { requireResourceAccess } from "@/src/lib/authz";
import { parseActionInput } from "@/src/lib/validation/parse";
import { paymentCorrectionRequestSchema } from "@/src/lib/validation/finance";
import { enforceActionRateLimit } from "@/src/lib/rate-limit";

export type RequestPaymentCorrectionInput = {
  paymentId: number;
  type: string;
  requestedAction: string;
  reason: string;
  proposedChange?: string | null;
  evidenceRef?: string | null;
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
