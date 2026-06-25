import { createHmac, timingSafeEqual } from "crypto";
import prisma from "@/src/lib/prisma";
import { Prisma } from "@/src/generated/prisma";
import type { PaymentProvider, WebhookEventStatus } from "@/src/generated/prisma";
import { enqueueFinanceJob } from "@/src/lib/services/finance-queue";

export type StorePaymentWebhookInput = {
  provider: PaymentProvider;
  providerEventId: string;
  eventType: string;
  payload: Record<string, unknown>;
  signature?: string | null;
  schoolId?: string | null;
  verified?: boolean;
};

export function verifyHmacSignature(input: {
  rawBody: string;
  signature: string | null;
  secret: string | undefined;
}) {
  if (!input.secret || !input.signature) return false;

  const expected = createHmac("sha256", input.secret)
    .update(input.rawBody)
    .digest("hex");

  const actual = input.signature.trim();
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(actual);

  if (expectedBuffer.length !== actualBuffer.length) return false;
  return timingSafeEqual(expectedBuffer, actualBuffer);
}

export async function storePaymentWebhookEvent(input: StorePaymentWebhookInput) {
  const event = await prisma.paymentWebhookEvent.upsert({
    where: {
      provider_providerEventId: {
        provider: input.provider,
        providerEventId: input.providerEventId,
      },
    },
    update: {},
    create: {
      provider: input.provider,
      providerEventId: input.providerEventId,
      eventType: input.eventType,
      payload: input.payload as Prisma.InputJsonValue,
      signature: input.signature ?? null,
      schoolId: input.schoolId ?? null,
      status: input.verified ? "VERIFIED" : "RECEIVED",
    },
  });

  if (input.schoolId && event.status !== "PROCESSED") {
    await enqueueFinanceJob({
      schoolId: input.schoolId,
      type: "PROCESS_PAYMENT_WEBHOOK",
      payload: {
        webhookEventId: event.id,
        provider: input.provider,
        eventType: input.eventType,
      },
      idempotencyKey: `webhook:${input.provider}:${input.providerEventId}`,
    });
  }

  return event;
}

export async function markPaymentWebhookEvent(
  id: string,
  status: WebhookEventStatus,
  error?: unknown,
) {
  return prisma.paymentWebhookEvent.update({
    where: { id },
    data: {
      status,
      processedAt: status === "PROCESSED" || status === "IGNORED" ? new Date() : undefined,
      lastError: error
        ? (error instanceof Error ? error.message : String(error)).slice(0, 1000)
        : undefined,
    },
  });
}
