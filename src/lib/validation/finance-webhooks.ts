import { z } from "zod";
import { randomUUID } from "crypto";

export const paymentWebhookPayloadSchema = z.object({
  id: z.string().trim().min(1).optional(),
  event: z.string().trim().min(1).optional(),
  type: z.string().trim().min(1).optional(),
  data: z.record(z.string(), z.unknown()).optional(),
  schoolId: z.string().trim().min(1).optional(),
});

export function resolveWebhookEventId(payload: z.infer<typeof paymentWebhookPayloadSchema>) {
  return payload.id ?? randomUUID();
}

export function resolveWebhookEventType(payload: z.infer<typeof paymentWebhookPayloadSchema>) {
  return payload.event ?? payload.type ?? "unknown";
}
