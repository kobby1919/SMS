import { z } from "zod";

export const paymentProviderSchema = z.enum(["PAYSTACK"]);
export const paymentFeePayerRuleSchema = z.enum(["SCHOOL_ABSORBS", "PARENT_PAYS"]);
export const onlinePaymentMethodSchema = z.enum([
  "CARD",
  "MTN_MOMO",
  "VODAFONE_CASH",
  "AIRTELTIGO_MONEY",
  "BANK_TRANSFER",
]);

const optionalCredentialSchema = z
  .string()
  .trim()
  .max(500, "Credential is too long.")
  .optional()
  .transform((value) => (value ? value : undefined));

export const schoolPaymentSettingsSchema = z
  .object({
    onlinePaymentsEnabled: z.boolean().default(false),
    provider: paymentProviderSchema.default("PAYSTACK"),
    publicKey: z
      .string()
      .trim()
      .max(250, "Public key is too long.")
      .optional()
      .transform((value) => (value ? value : undefined)),
    secretKey: optionalCredentialSchema,
    webhookSecret: optionalCredentialSchema,
    acceptedPaymentMethods: z
      .array(onlinePaymentMethodSchema)
      .default([])
      .transform((methods) => Array.from(new Set(methods))),
    settlementAccountReference: z
      .string()
      .trim()
      .max(120, "Settlement account reference is too long.")
      .optional()
      .transform((value) => (value ? value : undefined)),
    feePayerRule: paymentFeePayerRuleSchema.default("SCHOOL_ABSORBS"),
  })
  .superRefine((value, ctx) => {
    if (!value.onlinePaymentsEnabled) return;

    if (!value.publicKey) {
      ctx.addIssue({
        code: "custom",
        path: ["publicKey"],
        message: "Public key is required before online payments can be enabled.",
      });
    }

    if (value.acceptedPaymentMethods.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["acceptedPaymentMethods"],
        message: "Select at least one accepted online payment method.",
      });
    }
  });

export type SchoolPaymentSettingsInput = z.infer<typeof schoolPaymentSettingsSchema>;
