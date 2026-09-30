import { createHmac, timingSafeEqual } from "crypto";
import prisma from "@/src/lib/prisma";
import { Prisma } from "@/src/generated/prisma";
import type { PaymentProvider, PaymentWebhookEvent, WebhookEventStatus } from "@/src/generated/prisma";
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
  algorithm?: "sha256" | "sha512";
}) {
  if (!input.secret || !input.signature) return false;

  const expected = createHmac(input.algorithm ?? "sha256", input.secret)
    .update(input.rawBody)
    .digest("hex");

  const actual = input.signature.trim();
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(actual);

  if (expectedBuffer.length !== actualBuffer.length) return false;
  return timingSafeEqual(expectedBuffer, actualBuffer);
}

function canRefreshWebhookEvent(status: WebhookEventStatus) {
  return status === "RECEIVED" || status === "VERIFIED" || status === "FAILED";
}

function canQueueWebhookEvent(status: WebhookEventStatus) {
  return status === "RECEIVED" || status === "VERIFIED" || status === "FAILED";
}

function isUniqueConstraintError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

async function findExistingWebhookEvent(input: StorePaymentWebhookInput) {
  return prisma.paymentWebhookEvent.findUnique({
    where: {
      provider_providerEventId: {
        provider: input.provider,
        providerEventId: input.providerEventId,
      },
    },
  });
}

async function refreshExistingWebhookEvent(
  event: PaymentWebhookEvent,
  input: StorePaymentWebhookInput,
) {
  if (!canRefreshWebhookEvent(event.status)) return event;

  return prisma.paymentWebhookEvent.update({
    where: { id: event.id },
    data: {
      eventType: input.eventType,
      payload: input.payload as Prisma.InputJsonValue,
      signature: input.signature ?? event.signature,
      schoolId: input.schoolId ?? event.schoolId,
      status: input.verified ? "VERIFIED" : event.status,
      lastError: input.verified ? null : event.lastError,
    },
  });
}

export async function storePaymentWebhookEvent(input: StorePaymentWebhookInput) {
  let event: PaymentWebhookEvent;

  try {
    event = await prisma.paymentWebhookEvent.create({
      data: {
        provider: input.provider,
        providerEventId: input.providerEventId,
        eventType: input.eventType,
        payload: input.payload as Prisma.InputJsonValue,
        signature: input.signature ?? null,
        schoolId: input.schoolId ?? null,
        status: input.verified ? "VERIFIED" : "RECEIVED",
      },
    });
  } catch (error) {
    if (!isUniqueConstraintError(error)) throw error;

    const existing = await findExistingWebhookEvent(input);
    if (!existing) throw error;
    event = await refreshExistingWebhookEvent(existing, input);
  }

  const queueSchoolId = input.schoolId ?? event.schoolId;
  if (queueSchoolId && canQueueWebhookEvent(event.status)) {
    await enqueueFinanceJob({
      schoolId: queueSchoolId,
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
