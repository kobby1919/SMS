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
  "OTHER",
]);
export const billStatusSchema = z.enum([
  "UNPAID",
  "PARTIAL",
  "PAID",
  "OVERPAID",
  "WAIVED",
]);
export const paymentStatusSchema = z.enum(["CONFIRMED", "REVERSED"]);

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
