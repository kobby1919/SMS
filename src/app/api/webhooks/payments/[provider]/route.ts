import { NextRequest, NextResponse } from "next/server";
import prisma from "@/src/lib/prisma";
import type { PaymentProvider } from "@/src/generated/prisma";
import { enforceRateLimit } from "@/src/lib/rate-limit";
import {
  storePaymentWebhookEvent,
  verifyHmacSignature,
} from "@/src/lib/services/finance-webhooks";
import { decryptPaymentSecret } from "@/src/lib/services/payment-settings-secrets";
import {
  paymentWebhookPayloadSchema,
  resolveWebhookEventId,
  resolveWebhookEventType,
  resolveWebhookReference,
  resolveWebhookSchoolId,
} from "@/src/lib/validation/finance-webhooks";

type PaymentWebhookRouteContext = {
  params: Promise<{ provider: string }>;
};

const PROVIDERS: Record<string, PaymentProvider> = {
  paystack: "PAYSTACK",
  flutterwave: "FLUTTERWAVE",
  hubtel: "HUBTEL",
  expresspay: "EXPRESSPAY",
  theteller: "THETELLER",
  stripe: "STRIPE",
  manual: "MANUAL",
  bank: "BANK_TRANSFER",
  "bank-transfer": "BANK_TRANSFER",
  momo: "MOBILE_MONEY",
  "mobile-money": "MOBILE_MONEY",
  other: "OTHER",
};

function providerEnvSecret(provider: PaymentProvider) {
  if (provider === "PAYSTACK") return process.env.PAYSTACK_WEBHOOK_SECRET;
  if (provider === "FLUTTERWAVE") return process.env.FLUTTERWAVE_WEBHOOK_SECRET;
  if (provider === "HUBTEL") return process.env.HUBTEL_WEBHOOK_SECRET;
  if (provider === "EXPRESSPAY") return process.env.EXPRESSPAY_WEBHOOK_SECRET;
  if (provider === "THETELLER") return process.env.THETELLER_WEBHOOK_SECRET;
  if (provider === "STRIPE") return process.env.STRIPE_WEBHOOK_SECRET;
  return process.env.PAYMENT_WEBHOOK_SECRET;
}

function providerSignatureAlgorithm(provider: PaymentProvider) {
  return provider === "PAYSTACK" ? "sha512" : "sha256";
}

async function resolveSchoolWebhookSecret(provider: PaymentProvider, reference: string | null) {
  if (!reference) return null;

  const intent = await prisma.paymentIntent.findFirst({
    where: { provider, reference },
    select: {
      schoolId: true,
      school: {
        select: {
          paymentSettings: {
            select: { encryptedWebhookSecret: true },
          },
        },
      },
    },
  });

  if (!intent?.school.paymentSettings?.encryptedWebhookSecret) {
    return intent ? { schoolId: intent.schoolId, secret: null } : null;
  }

  return {
    schoolId: intent.schoolId,
    secret: decryptPaymentSecret(intent.school.paymentSettings.encryptedWebhookSecret),
  };
}

function providerSignature(req: NextRequest, provider: PaymentProvider) {
  if (provider === "PAYSTACK") return req.headers.get("x-paystack-signature");
  if (provider === "FLUTTERWAVE") {
    return req.headers.get("verif-hash") ?? req.headers.get("x-flutterwave-signature");
  }
  if (provider === "HUBTEL") return req.headers.get("x-hubtel-signature");
  if (provider === "EXPRESSPAY") return req.headers.get("x-expresspay-signature");
  if (provider === "THETELLER") return req.headers.get("x-theteller-signature");
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
  const reference = resolveWebhookReference(payload);
  const schoolSecret = await resolveSchoolWebhookSecret(provider, reference);
  const algorithm = providerSignatureAlgorithm(provider);
  const verifiedBySchoolSecret = verifyHmacSignature({
    rawBody,
    signature,
    secret: schoolSecret?.secret ?? undefined,
    algorithm,
  });
  const verifiedByEnvSecret = verifyHmacSignature({
    rawBody,
    signature,
    secret: providerEnvSecret(provider),
    algorithm,
  });
  const verified = verifiedBySchoolSecret || verifiedByEnvSecret;

  if (!verified) {
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 401 });
  }

  let providerEventId: string;
  try {
    providerEventId = resolveWebhookEventId(payload);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Webhook payload is missing a stable id." },
      { status: 400 },
    );
  }

  const schoolId = schoolSecret?.schoolId ?? resolveWebhookSchoolId(payload);
  const event = await storePaymentWebhookEvent({
    provider,
    providerEventId,
    eventType: resolveWebhookEventType(payload),
    payload,
    signature,
    schoolId,
    verified,
  });

  return NextResponse.json({
    received: true,
    queued: Boolean(schoolId),
    eventId: event.id,
  }, { status: 202 });
}
