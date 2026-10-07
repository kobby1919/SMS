"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/src/lib/authz";
import prisma from "@/src/lib/prisma";
import { enforceActionRateLimit } from "@/src/lib/rate-limit";
import { processPaymentWebhookEvent } from "@/src/lib/services/finance-webhook-processor";
import { createParentPaymentIntent } from "@/src/lib/services/payment-intents";
import { verifyProviderPayment } from "@/src/lib/services/payment-checkout-providers";
import { decryptPaymentSecret } from "@/src/lib/services/payment-settings-secrets";
import { createPaymentIntentSchema } from "@/src/lib/validation/payment-intents";
import { parseActionInput } from "@/src/lib/validation/parse";
function formLines(data: FormData) {
  const billIds = data.getAll("studentBillId").map((value) => Number(value));
  const amounts = data.getAll("amount").map((value) => Number(value));
  return billIds.map((studentBillId, index) => ({
    studentBillId,
    amount: amounts[index],
  }));
}

export type ParentCheckoutActionState = {
  status: "idle" | "error" | "success";
  message: string;
  checkoutUrl?: string;
  reference?: string;
};

export async function createParentCheckoutWithState(
  _state: ParentCheckoutActionState,
  data: FormData,
): Promise<ParentCheckoutActionState> {
  try {
    const { userId, schoolId } = await requireRole(["parent"]);
    await enforceActionRateLimit({
      key: `parent:create-checkout:${schoolId}:${userId}`,
      limit: 10,
      windowMs: 60_000,
    });

    const input = parseActionInput(createPaymentIntentSchema, { lines: formLines(data) });
    const result = await createParentPaymentIntent({
      schoolId,
      parentId: userId,
      input,
    });

    return {
      status: "success",
      message: result.reused ? "Existing checkout reopened." : "Checkout is ready.",
      checkoutUrl: result.checkoutUrl,
      reference: result.reference,
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Could not start online checkout.",
    };
  }
}
export async function verifyOnlinePaymentIntent(formData: FormData) {
  const { userId, schoolId } = await requireRole(["bursar"]);
  await enforceActionRateLimit({
    key: `finance:verify-online-payment:${schoolId}:${userId}`,
    limit: 20,
    windowMs: 10 * 60_000,
  });

  const intentId = String(formData.get("intentId") ?? "").trim();
  if (!intentId) throw new Error("Payment intent is required.");

  const intent = await prisma.paymentIntent.findFirst({
    where: { id: intentId, schoolId },
    include: {
      lines: { include: { studentBill: { select: { id: true, studentId: true } } } },
      school: {
        select: {
          paymentSettings: {
            select: {
              provider: true,
              encryptedSecretKey: true,
            },
          },
        },
      },
    },
  });

  if (!intent) throw new Error("Online payment attempt was not found.");
  if (intent.status === "PAID") throw new Error("This online payment has already been confirmed.");
  if (intent.lines.length !== 1) throw new Error("Only one-bill online payment verification is enabled for now.");

  const settings = intent.school.paymentSettings;
  if (!settings?.encryptedSecretKey || settings.provider !== intent.provider) {
    throw new Error("School payment provider settings are not complete for verification.");
  }

  const line = intent.lines[0];
  if (!line) throw new Error("Online payment attempt is missing its bill line.");

  const verification = await verifyProviderPayment({
    provider: intent.provider,
    secretKey: decryptPaymentSecret(settings.encryptedSecretKey),
    reference: intent.reference,
  });

  const event = await prisma.paymentWebhookEvent.create({
    data: {
      provider: intent.provider,
      providerEventId: `manual-verify:${intent.reference}:${randomUUID()}`,
      eventType: verification.status === "SUCCESS" ? "manual.verify.success" : verification.status === "FAILED" ? "manual.verify.failed" : "manual.verify.pending",
      status: "VERIFIED",
      schoolId,
      payload: {
        event: verification.status === "SUCCESS" ? "manual.verify.success" : verification.status === "FAILED" ? "manual.verify.failed" : "manual.verify.pending",
        schoolId,
        amountGhs: verification.amount,
        status: verification.providerStatus,
        paidBy: verification.paidBy,
        data: {
          reference: verification.reference,
          amountGhs: verification.amount,
          status: verification.providerStatus,
          paid_at: verification.paidAt?.toISOString() ?? null,
          studentBillId: line.studentBillId,
          metadata: {
            schoolId,
            paymentIntentId: intent.id,
            studentBillId: line.studentBillId,
            studentId: line.studentBill.studentId,
            reference: intent.reference,
            source: "manual-provider-verification",
          },
        },
      },
    },
  });

  await processPaymentWebhookEvent(event.id);

  revalidatePath("/list/finance/payments");
  revalidatePath(`/list/finance/bills/${line.studentBillId}`);
  revalidatePath("/bursar");
}
