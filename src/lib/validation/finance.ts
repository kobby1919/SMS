import { z } from "zod";
import {
  billStatusSchema,
  nonEmptyStringSchema,
  paymentMethodSchema,
  paymentStatusSchema,
  positiveIntSchema,
  termSchema,
} from "./common";

export const recordPaymentSchema = z.object({
  studentBillId: positiveIntSchema,
  amount: z.coerce.number().positive(),
  paymentMethod: paymentMethodSchema,
  paidBy: nonEmptyStringSchema,
  referenceNo: z.string().trim().optional().nullable(),
  idempotencyKey: z.string().trim().min(8).max(120).optional().nullable(),
  notes: z.string().trim().optional().nullable(),
  paymentDate: z.string().trim().optional(),
});

export const reversePaymentSchema = z.object({
  paymentId: positiveIntSchema,
  reason: nonEmptyStringSchema,
});

export const generateBillsSchema = z.object({
  feeStructureId: positiveIntSchema,
  classIds: z.array(positiveIntSchema).min(1),
  includeOptionalItems: z.boolean().optional().default(false),
});

export const billPreviewSchema = z.object({
  feeStructureId: positiveIntSchema,
  classIds: z.array(positiveIntSchema).min(1),
});

export const billFiltersSchema = z.object({
  feeStructureId: positiveIntSchema.optional(),
  classId: positiveIntSchema.optional(),
  status: billStatusSchema.optional(),
  studentId: z.string().trim().optional(),
  page: positiveIntSchema.optional(),
});

export const paymentFiltersSchema = z.object({
  status: paymentStatusSchema.optional(),
  method: paymentMethodSchema.optional(),
  dateFrom: z.string().trim().optional(),
  dateTo: z.string().trim().optional(),
  search: z.string().trim().optional(),
  page: positiveIntSchema.optional(),
});

export const feeStructureCreateSchema = z.object({
  title: nonEmptyStringSchema,
  description: z.string().trim().optional().nullable(),
  academicYear: nonEmptyStringSchema,
  term: termSchema,
  gradeId: positiveIntSchema,
});

export const feeStructureUpdateSchema = z.object({
  title: nonEmptyStringSchema.max(150).optional(),
  description: z.string().trim().max(1000).optional().nullable(),
}).refine((value) => Object.keys(value).length > 0, "Provide a field to update.");

export const feeItemSchema = z.object({
  name: nonEmptyStringSchema.max(150),
  amount: z.coerce.number().positive(),
  category: z.enum(["TUITION", "LEVY", "EXAM", "FEEDING", "TRANSPORT", "UNIFORM", "LIBRARY", "SPORTS", "OTHER"]),
  isOptional: z.boolean(),
  description: z.string().trim().max(1000).optional().nullable(),
});

export const feeItemUpdateSchema = feeItemSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  "Provide a fee item field to update.",
);

export const waiveBillSchema = z.object({
  billId: positiveIntSchema,
  reason: nonEmptyStringSchema.max(500),
});

export const dailyFinanceReportQuerySchema = z.object({
  date: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD format")
    .optional(),
});

export const receiptPdfQuerySchema = z.object({
  billId: positiveIntSchema,
  receiptNumber: nonEmptyStringSchema.max(100),
});
