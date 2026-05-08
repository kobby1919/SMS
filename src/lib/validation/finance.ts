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
