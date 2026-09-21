import { z } from "zod";

export const termSchema = z.enum(["TERM_1", "TERM_2", "TERM_3"]);
export const daySchema = z.enum([
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
]);
export const attendanceStatusSchema = z.enum([
  "PRESENT",
  "ABSENT",
  "LATE",
  "EXCUSED",
]);
export const paymentMethodSchema = z.enum([
  "CASH",
  "MTN_MOMO",
  "VODAFONE_CASH",
  "AIRTELTIGO_MONEY",
  "BANK_TRANSFER",
  "CHEQUE",
  "POS",
  "OTHER",
]);
export const billStatusSchema = z.enum([
  "UNPAID",
  "PARTIAL",
  "PAID",
  "OVERPAID",
  "WAIVED",
]);
export const paymentStatusSchema = z.enum(["PENDING", "CONFIRMED", "FAILED", "REVERSED"]);
export const paymentCorrectionTypeSchema = z.enum([
  "WRONG_AMOUNT",
  "WRONG_STUDENT",
  "DUPLICATE_PAYMENT",
  "WRONG_METHOD",
  "WRONG_REFERENCE",
  "PAYMENT_BOUNCED",
  "RECEIPT_CANCELLATION",
  "OTHER",
]);
export const paymentCorrectionRequestedActionSchema = z.enum([
  "REVERSE_PAYMENT",
  "REPLACE_PAYMENT",
  "MOVE_PAYMENT",
  "MARK_DUPLICATE",
  "FIX_REFERENCE_OR_METHOD",
  "CANCEL_RECEIPT",
]);

export const positiveIntSchema = z.coerce.number().int().positive();
export const nonEmptyStringSchema = z.string().trim().min(1);
export const stringIdSchema = z.string().trim().min(1).max(200);
export const optionalStringIdSchema = stringIdSchema.optional();

export const optionalIdQuerySchema = z.object({
  teacherId: z.string().trim().min(1).optional(),
});

export const isoDateStringSchema = z
  .string()
  .trim()
  .min(1)
  .refine((v) => !Number.isNaN(Date.parse(v)), "Invalid date");
