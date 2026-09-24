import { createHmac, timingSafeEqual } from "crypto";
import prisma from "@/src/lib/prisma";
import { markDelivered, markFailed, markSent } from "@/src/lib/services/app-notifications";
import type { Prisma } from "@/src/generated/prisma";

type ResendWebhookStatus = "SENT" | "DELIVERED" | "FAILED" | "IGNORED";

type ResendWebhookPayload = {
  type?: unknown;
  created_at?: unknown;
  data?: unknown;
};

type ResendWebhookResult = {
  ok: boolean;
  status: ResendWebhookStatus;
  message: string;
  deliveryId?: string;
  providerMessageId?: string;
};

const RESEND_PROVIDER = "resend";
const WEBHOOK_TOLERANCE_MS = 5 * 60 * 1000;

function safeString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function secretBytes(secret: string) {
  const cleaned = secret.trim();
  if (!cleaned) return null;
  const raw = cleaned.startsWith("whsec_") ? cleaned.slice("whsec_".length) : cleaned;

  try {
    return Buffer.from(raw, "base64");
  } catch {
    return Buffer.from(cleaned, "utf8");
  }
}

function candidateSignatures(header: string) {
  return header
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .flatMap((part) => {
      const [version, signature] = part.split(",", 2);
      return version === "v1" && signature ? [signature] : [];
    });
}

function secureEqualBase64(a: string, b: string) {
  let left: Buffer;
  let right: Buffer;
  try {
    left = Buffer.from(a, "base64");
    right = Buffer.from(b, "base64");
  } catch {
    return false;
  }

  return left.length === right.length && timingSafeEqual(left, right);
}

export function verifyResendWebhookSignature({
  rawBody,
  svixId,
  svixTimestamp,
  svixSignature,
  secret = process.env.RESEND_WEBHOOK_SECRET,
}: {
  rawBody: string;
  svixId: string | null;
  svixTimestamp: string | null;
  svixSignature: string | null;
  secret?: string;
}) {
  if (!secret || !svixId || !svixTimestamp || !svixSignature) return false;

  const timestampMs = Number(svixTimestamp) * 1000;
  if (!Number.isFinite(timestampMs)) return false;
  if (Math.abs(Date.now() - timestampMs) > WEBHOOK_TOLERANCE_MS) return false;

  const key = secretBytes(secret);
  if (!key || key.length === 0) return false;

  const signedContent = `${svixId}.${svixTimestamp}.${rawBody}`;
  const expected = createHmac("sha256", key).update(signedContent).digest("base64");

  return candidateSignatures(svixSignature).some((signature) => secureEqualBase64(signature, expected));
}

function dataObject(payload: ResendWebhookPayload) {
  return payload.data && typeof payload.data === "object" && !Array.isArray(payload.data)
    ? payload.data as Record<string, unknown>
    : {};
}

function providerMessageId(payload: ResendWebhookPayload) {
  const data = dataObject(payload);
  return (
    safeString(data.email_id) ??
    safeString(data.emailId) ??
    safeString(data.message_id) ??
    safeString(data.messageId) ??
    safeString(data.id)
  );
}

function statusForEvent(type: string): ResendWebhookStatus {
  switch (type) {
    case "email.sent":
      return "SENT";
    case "email.delivered":
      return "DELIVERED";
    case "email.bounced":
    case "email.complained":
      return "FAILED";
    default:
      return "IGNORED";
  }
}

function webhookErrorMessage(type: string, payload: ResendWebhookPayload) {
  const data = dataObject(payload);
  return (
    safeString(data.reason) ??
    safeString(data.bounce_reason) ??
    safeString(data.complaint_reason) ??
    `Provider webhook reported ${type}.`
  );
}

function webhookMetadata(payload: ResendWebhookPayload): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(payload)) as Prisma.InputJsonValue;
}

async function recordIgnoredWebhook(input: {
  schoolId: string;
  deliveryId: string;
  notificationId: string;
  type: string;
  providerMessageId: string;
  payload: ResendWebhookPayload;
}) {
  await prisma.appNotificationAuditLog.create({
    data: {
      schoolId: input.schoolId,
      notificationId: input.notificationId,
      deliveryId: input.deliveryId,
      event: "DELIVERY_SENT",
      channel: "EMAIL",
      provider: RESEND_PROVIDER,
      providerMessageId: input.providerMessageId,
      message: `Resend webhook received with no status change: ${input.type}.`,
      metadata: webhookMetadata(input.payload),
    },
  });
}

export async function handleResendEmailWebhook(payload: ResendWebhookPayload): Promise<ResendWebhookResult> {
  const type = safeString(payload.type);
  if (!type) {
    return { ok: false, status: "IGNORED", message: "Webhook type is missing." };
  }

  const messageId = providerMessageId(payload);
  if (!messageId) {
    return { ok: false, status: "IGNORED", message: "Provider message id is missing." };
  }

  const delivery = await prisma.appNotificationDelivery.findFirst({
    where: {
      provider: RESEND_PROVIDER,
      providerMessageId: messageId,
      channel: "EMAIL",
    },
    select: {
      id: true,
      schoolId: true,
      notificationId: true,
      status: true,
    },
  });

  if (!delivery) {
    return {
      ok: false,
      status: "IGNORED",
      message: "No Edujay delivery matched this provider message id.",
      providerMessageId: messageId,
    };
  }

  const nextStatus = statusForEvent(type);
  if (nextStatus === "SENT") {
    await markSent({
      schoolId: delivery.schoolId,
      deliveryId: delivery.id,
      provider: RESEND_PROVIDER,
      providerMessageId: messageId,
    });
  } else if (nextStatus === "DELIVERED") {
    await markDelivered({
      schoolId: delivery.schoolId,
      deliveryId: delivery.id,
      provider: RESEND_PROVIDER,
      providerMessageId: messageId,
    });
  } else if (nextStatus === "FAILED") {
    await markFailed({
      schoolId: delivery.schoolId,
      deliveryId: delivery.id,
      provider: RESEND_PROVIDER,
      error: webhookErrorMessage(type, payload),
      retryAt: null,
      incrementAttempts: false,
    });
  } else {
    await recordIgnoredWebhook({
      schoolId: delivery.schoolId,
      deliveryId: delivery.id,
      notificationId: delivery.notificationId,
      type,
      providerMessageId: messageId,
      payload,
    });
  }

  return {
    ok: true,
    status: nextStatus,
    message: `Resend webhook processed: ${type}.`,
    deliveryId: delivery.id,
    providerMessageId: messageId,
  };
}