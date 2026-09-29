import { z } from "zod";

const moneyAmountSchema = z.coerce
  .number()
  .finite("Enter a valid amount.")
  .positive("Amount must be greater than zero.")
  .max(999999.99, "Amount is too large.")
  .refine((value) => Number.isInteger(Math.round(value * 100)), "Use a valid amount with at most two decimal places.");

export const paymentIntentBillLineSchema = z.object({
  studentBillId: z.coerce.number().int().positive(),
  amount: moneyAmountSchema,
});

export const createPaymentIntentSchema = z.object({
  lines: z
    .array(paymentIntentBillLineSchema)
    .min(1, "Select at least one bill to pay.")
    .max(10, "You can pay at most 10 bills in one checkout."),
});

export type CreatePaymentIntentInput = z.infer<typeof createPaymentIntentSchema>;