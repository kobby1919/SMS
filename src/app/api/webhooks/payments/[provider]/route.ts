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
};

function providerEnvSecret(provider: PaymentProvider) {
  if (provider === "PAYSTACK") {
    return process.env.PAYSTACK_WEBHOOK_SECRET ?? process.env.PAYSTACK_SECRET_KEY;
  }
  return undefined;
}

function providerSignatureAlgorithm(provider: PaymentProvider) {
  return provider === "PAYSTACK" ? "sha512" : "sha256";
}

function uniqueSecrets(secrets: Array<string | null | undefined>) {
  return [...new Set(secrets.filter((secret): secret is string => Boolean(secret)))];
}

async function resolveSchoolWebhookSecrets(provider: PaymentProvider, reference: string | null) {
  if (!reference) return null;

  const intent = await prisma.paymentIntent.findFirst({
    where: { provider, reference },
    select: {
      schoolId: true,
      school: {
        select: {
          paymentSettings: {
            select: {
              encryptedSecretKey: true,
              encryptedWebhookSecret: true,
            },
          },
        },
      },
    },
  });

  if (!intent) return null;

  const settings = intent.school.paymentSettings;
  return {
    schoolId: intent.schoolId,
    secrets: provider === "PAYSTACK"
      ? uniqueSecrets([
          settings?.encryptedSecretKey
            ? decryptPaymentSecret(settings.encryptedSecretKey)
            : null,
          settings?.encryptedWebhookSecret
            ? decryptPaymentSecret(settings.encryptedWebhookSecret)
            : null,
        ])
      : uniqueSecrets([
          settings?.encryptedWebhookSecret
            ? decryptPaymentSecret(settings.encryptedWebhookSecret)
            : null,
        ]),
  };
}

function providerSignature(req: NextRequest, provider: PaymentProvider) {
  if (provider === "PAYSTACK") return req.headers.get("x-paystack-signature");
  return null;
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
  const schoolSecrets = await resolveSchoolWebhookSecrets(provider, reference);
  const algorithm = providerSignatureAlgorithm(provider);
  const secretCandidates = [
    ...(schoolSecrets?.secrets ?? []),
    providerEnvSecret(provider),
  ].filter((secret): secret is string => Boolean(secret));
  const verified = secretCandidates.some((secret) =>
    verifyHmacSignature({ rawBody, signature, secret, algorithm }),
  );

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

  const schoolId = schoolSecrets?.schoolId ?? resolveWebhookSchoolId(payload);
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
