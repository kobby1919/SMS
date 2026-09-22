import { z } from "zod";
import {
  billStatusSchema,
  nonEmptyStringSchema,
  paymentCorrectionRequestedActionSchema,
  paymentCorrectionTypeSchema,
  paymentMethodSchema,
  paymentStatusSchema,
  positiveIntSchema,
  termSchema,
} from "./common";

const referenceRequiredPaymentMethods = new Set([
  "MTN_MOMO",
  "VODAFONE_CASH",
  "AIRTELTIGO_MONEY",
  "BANK_TRANSFER",
  "CHEQUE",
  "POS",
]);

export const recordPaymentSchema = z.object({
  studentBillId: positiveIntSchema,
  amount: z.coerce.number().positive().max(1_000_000),
  paymentMethod: paymentMethodSchema,
  paidBy: nonEmptyStringSchema.max(150),
  referenceNo: z.string().trim().max(120).optional().nullable(),
  idempotencyKey: z.string().trim().min(8).max(120).optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable(),
  paymentDate: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD date format.")
    .optional(),
}).superRefine((value, ctx) => {
  if (
    referenceRequiredPaymentMethods.has(value.paymentMethod) &&
    !value.referenceNo?.trim()
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["referenceNo"],
      message: "Reference number is required for this payment method.",
    });
  }
});

export const paymentCorrectionRequestSchema = z.object({
  paymentId: positiveIntSchema,
  type: paymentCorrectionTypeSchema,
  requestedAction: paymentCorrectionRequestedActionSchema,
  reason: nonEmptyStringSchema.min(10).max(500),
  proposedChange: z.string().trim().max(1000).optional().nullable(),
  evidenceRef: z.string().trim().max(500).optional().nullable(),
}).superRefine((value, ctx) => {
  const compatible: Record<string, string[]> = {
    WRONG_AMOUNT: ["REPLACE_PAYMENT", "REVERSE_PAYMENT"],
    WRONG_STUDENT: ["MOVE_PAYMENT", "REPLACE_PAYMENT", "REVERSE_PAYMENT"],
    DUPLICATE_PAYMENT: ["MARK_DUPLICATE", "REVERSE_PAYMENT", "CANCEL_RECEIPT"],
    WRONG_METHOD: ["FIX_REFERENCE_OR_METHOD", "REPLACE_PAYMENT"],
    WRONG_REFERENCE: ["FIX_REFERENCE_OR_METHOD"],
    PAYMENT_BOUNCED: ["REVERSE_PAYMENT", "CANCEL_RECEIPT"],
    RECEIPT_CANCELLATION: ["CANCEL_RECEIPT", "REVERSE_PAYMENT"],
    OTHER: ["REVERSE_PAYMENT", "REPLACE_PAYMENT", "MOVE_PAYMENT", "MARK_DUPLICATE", "FIX_REFERENCE_OR_METHOD", "CANCEL_RECEIPT"],
  };

  if (!compatible[value.type]?.includes(value.requestedAction)) {
    ctx.addIssue({
      code: "custom",
      path: ["requestedAction"],
      message: "Requested action does not match the selected correction type.",
    });
  }
});

export const paymentCorrectionReviewSchema = z.object({
  correctionId: positiveIntSchema,
  decision: z.enum(["APPROVE", "REJECT"]),
  reviewNote: nonEmptyStringSchema.min(10).max(1000),
});

export const reversePaymentSchema = z.object({
  paymentId: positiveIntSchema,
  reason: nonEmptyStringSchema.min(10).max(500),
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
  dueDate: z.string().trim().optional().nullable(),
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

export const applyDiscountSchema = z.object({
  billId: positiveIntSchema,
  type: z.enum(["SCHOLARSHIP", "SIBLING", "STAFF_CHILD", "BURSARY", "OTHER"]),
  description: nonEmptyStringSchema.max(500),
  amount: z.coerce.number().positive().optional().nullable(),
  percentage: z.coerce.number().positive().max(100).optional().nullable(),
}).refine(
  (value) => Boolean(value.amount) !== Boolean(value.percentage),
  "Provide either a fixed amount or a percentage, not both.",
);

export const removeDiscountSchema = z.object({
  discountId: positiveIntSchema,
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

export const parentFinanceQuerySchema = z.object({
  studentBillId: positiveIntSchema,
  paymentId: positiveIntSchema.optional().nullable(),
  reason: z.enum([
    "ALREADY_PAID",
    "WRONG_AMOUNT",
    "NEED_CLARIFICATION",
    "RECEIPT_ISSUE",
    "OTHER",
  ]),
  message: nonEmptyStringSchema.max(1000),
});

export const resolveFinanceQuerySchema = z.object({
  queryId: positiveIntSchema,
  response: nonEmptyStringSchema.max(1000),
  status: z.enum(["RESOLVED", "CLOSED"]),
});
