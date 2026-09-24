import { NextRequest, NextResponse } from "next/server";
import { enforceRateLimit } from "@/src/lib/rate-limit";
import {
  handleResendEmailWebhook,
  verifyResendWebhookSignature,
} from "@/src/lib/services/notification-webhooks";

export async function POST(req: NextRequest) {
  const limited = await enforceRateLimit(req, {
    scope: "webhook:notification:resend",
    limit: 120,
    windowMs: 60_000,
  });
  if (limited) return limited;

  const rawBody = await req.text();
  const verified = verifyResendWebhookSignature({
    rawBody,
    svixId: req.headers.get("svix-id"),
    svixTimestamp: req.headers.get("svix-timestamp"),
    svixSignature: req.headers.get("svix-signature"),
  });

  if (!verified) {
    return NextResponse.json({ error: "Invalid notification webhook signature." }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return NextResponse.json({ error: "Invalid webhook payload." }, { status: 400 });
  }

  const result = await handleResendEmailWebhook(payload);
  return NextResponse.json(
    {
      received: true,
      processed: result.ok,
      status: result.status,
      message: result.message,
      deliveryId: result.deliveryId,
      providerMessageId: result.providerMessageId,
    },
    { status: result.ok ? 202 : 200 },
  );
}