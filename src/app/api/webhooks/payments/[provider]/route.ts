import { NextRequest, NextResponse } from "next/server";
import type { PaymentProvider } from "@/src/generated/prisma";
import { enforceRateLimit } from "@/src/lib/rate-limit";
import {
  storePaymentWebhookEvent,
  verifyHmacSignature,
} from "@/src/lib/services/finance-webhooks";
import {
  paymentWebhookPayloadSchema,
  resolveWebhookEventId,
  resolveWebhookEventType,
} from "@/src/lib/validation/finance-webhooks";

type PaymentWebhookRouteContext = {
  params: Promise<{ provider: string }>;
};

const PROVIDERS: Record<string, PaymentProvider> = {
  paystack: "PAYSTACK",
  stripe: "STRIPE",
  manual: "MANUAL",
  other: "OTHER",
};

function providerSecret(provider: PaymentProvider) {
  if (provider === "PAYSTACK") return process.env.PAYSTACK_WEBHOOK_SECRET;
  if (provider === "STRIPE") return process.env.STRIPE_WEBHOOK_SECRET;
  return process.env.PAYMENT_WEBHOOK_SECRET;
}

function providerSignature(req: NextRequest, provider: PaymentProvider) {
  if (provider === "PAYSTACK") return req.headers.get("x-paystack-signature");
  if (provider === "STRIPE") return req.headers.get("stripe-signature");
  return req.headers.get("x-edujay-signature");
}

export async function POST(req: NextRequest, context: PaymentWebhookRouteContext) {
  const { provider: providerSlug } = await context.params;
  const provider = PROVIDERS[providerSlug.toLowerCase()];

  if (!provider) {
    return NextResponse.json({ error: "Unsupported payment provider." }, { status: 404 });
  }

  const limited = await enforceRateLimit(req, {
    scope: `webhook:payment:${provider}`,
    limit: 120,
    windowMs: 60_000,
  });
  if (limited) return limited;

  const rawBody = await req.text();
  const signature = providerSignature(req, provider);
  const verified = verifyHmacSignature({
    rawBody,
    signature,
    secret: providerSecret(provider),
  });

  if (!verified) {
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 401 });
  }

  let json: unknown;
  try {
    json = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const parsed = paymentWebhookPayloadSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid webhook payload.", issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const payload = parsed.data;
  const event = await storePaymentWebhookEvent({
    provider,
    providerEventId: resolveWebhookEventId(payload),
    eventType: resolveWebhookEventType(payload),
    payload,
    signature,
    schoolId: payload.schoolId ?? null,
    verified,
  });

  return NextResponse.json({
    received: true,
    queued: Boolean(payload.schoolId),
    eventId: event.id,
  }, { status: 202 });
}
