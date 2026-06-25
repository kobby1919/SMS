import type { FinanceJobType } from "@/src/generated/prisma";
import {
  claimNextFinanceJob,
  completeFinanceJob,
  failFinanceJob,
} from "@/src/lib/services/finance-queue";
import { processPaymentWebhookEvent } from "@/src/lib/services/finance-webhook-processor";

function payloadRecord(payload: unknown): Record<string, unknown> {
  return typeof payload === "object" && payload !== null && !Array.isArray(payload)
    ? payload as Record<string, unknown>
    : {};
}

function payloadString(payload: Record<string, unknown>, key: string) {
  const value = payload[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function runNextFinanceJob(
  workerId: string,
  types: FinanceJobType[] = ["PROCESS_PAYMENT_WEBHOOK"],
) {
  const job = await claimNextFinanceJob(workerId, types);
  if (!job) return null;

  try {
    switch (job.type) {
      case "PROCESS_PAYMENT_WEBHOOK": {
        const webhookEventId = payloadString(payloadRecord(job.payload), "webhookEventId");
        if (!webhookEventId) throw new Error("Payment webhook job is missing webhookEventId.");
        await processPaymentWebhookEvent(webhookEventId);
        break;
      }
      default:
        throw new Error(`Unsupported finance job type: ${job.type}`);
    }

    await completeFinanceJob(job.id);
    return { jobId: job.id, status: "COMPLETED" as const };
  } catch (error) {
    await failFinanceJob(
      job.id,
      error,
      job.attempts >= job.maxAttempts ? "FAILED" : "PENDING",
    );
    throw error;
  }
}
