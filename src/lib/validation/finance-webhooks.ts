import { z } from "zod";

export const paymentWebhookPayloadSchema = z.object({
  id: z.string().trim().min(1).optional(),
  event: z.string().trim().min(1).optional(),
  type: z.string().trim().min(1).optional(),
  reference: z.string().trim().min(1).optional(),
  schoolId: z.string().trim().min(1).optional(),
  data: z.record(z.string(), z.unknown()).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
}).passthrough();

type WebhookPayload = z.infer<typeof paymentWebhookPayloadSchema>;

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function readString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return null;
}

export function resolveWebhookEventType(payload: WebhookPayload) {
  return payload.event ?? payload.type ?? "unknown";
}

export function resolveWebhookReference(payload: WebhookPayload) {
  const data = asRecord(payload.data);
  const metadata = asRecord(data.metadata ?? payload.metadata);
  return readString(
    data.reference,
    data.id,
    data.payment_intent,
    payload.reference,
    metadata.reference,
  );
}

export function resolveWebhookSchoolId(payload: WebhookPayload) {
  const data = asRecord(payload.data);
  const metadata = asRecord(data.metadata ?? payload.metadata);
  return readString(payload.schoolId, data.schoolId, metadata.schoolId);
}

export function resolveWebhookEventId(payload: WebhookPayload) {
  const data = asRecord(payload.data);
  const directId = readString(payload.id, data.id, data.event_id, data.eventId);
  if (directId) return `${resolveWebhookEventType(payload)}:${directId}`;

  const reference = resolveWebhookReference(payload);
  const eventType = resolveWebhookEventType(payload);
  if (reference) return `${eventType}:${reference}`;

  throw new Error("Webhook payload is missing a stable provider event id or reference.");
}