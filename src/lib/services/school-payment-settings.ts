import type { PaymentMethod } from "@/src/generated/prisma";
import prisma from "@/src/lib/prisma";
import { encryptPaymentSecret, hasPaymentSecret } from "@/src/lib/services/payment-settings-secrets";
import type { SchoolPaymentSettingsInput } from "@/src/lib/validation/payment-settings";

const defaultAcceptedPaymentMethods: PaymentMethod[] = [
  "MTN_MOMO",
  "VODAFONE_CASH",
  "AIRTELTIGO_MONEY",
  "BANK_TRANSFER",
];

export async function ensureDefaultSchoolPaymentSettings(schoolId: string) {
  return prisma.schoolPaymentSetting.upsert({
    where: { schoolId },
    create: {
      schoolId,
      onlinePaymentsEnabled: false,
      provider: "PAYSTACK",
      acceptedPaymentMethods: defaultAcceptedPaymentMethods,
      feePayerRule: "SCHOOL_ABSORBS",
    },
    update: {},
  });
}

export function isSchoolPaymentProviderConfigured(settings: {
  onlinePaymentsEnabled: boolean;
  publicKey: string | null;
  encryptedSecretKey: string | null;
  encryptedWebhookSecret: string | null;
  acceptedPaymentMethods: PaymentMethod[];
}) {
  return (
    settings.onlinePaymentsEnabled &&
    Boolean(settings.publicKey) &&
    hasPaymentSecret(settings.encryptedSecretKey) &&
    hasPaymentSecret(settings.encryptedWebhookSecret) &&
    settings.acceptedPaymentMethods.length > 0
  );
}

export async function updateSchoolPaymentSettings({
  schoolId,
  actorId,
  input,
}: {
  schoolId: string;
  actorId: string;
  input: SchoolPaymentSettingsInput;
}) {
  const existing = await ensureDefaultSchoolPaymentSettings(schoolId);
  const encryptedSecretKey = input.secretKey
    ? encryptPaymentSecret(input.secretKey)
    : existing.encryptedSecretKey;
  const encryptedWebhookSecret = input.webhookSecret
    ? encryptPaymentSecret(input.webhookSecret)
    : existing.encryptedWebhookSecret;

  if (input.onlinePaymentsEnabled && (!encryptedSecretKey || !encryptedWebhookSecret)) {
    throw new Error("Secret key and webhook secret are required before online payments can be enabled.");
  }

  return prisma.schoolPaymentSetting.update({
    where: { schoolId },
    data: {
      onlinePaymentsEnabled: input.onlinePaymentsEnabled,
      provider: input.provider,
      publicKey: input.publicKey ?? null,
      encryptedSecretKey,
      encryptedWebhookSecret,
      acceptedPaymentMethods: input.acceptedPaymentMethods,
      settlementAccountReference: input.settlementAccountReference ?? null,
      feePayerRule: input.feePayerRule,
      configuredBy: actorId,
    },
  });
}
