import { z } from "zod";
import { nonEmptyStringSchema, positiveIntSchema, termSchema } from "./common";

export const caConfigSchema = z.object({
  academicYear: nonEmptyStringSchema,
  classworkWeight: z.coerce.number().min(0).max(100),
  examWeight: z.coerce.number().min(0).max(100),
}).refine((d) => d.classworkWeight + d.examWeight === 100, {
  message: "Classwork and exam weights must sum to 100",
});

export const caRecordSchema = z.object({
  studentId: nonEmptyStringSchema,
  subjectId: positiveIntSchema,
  classId: positiveIntSchema,
  term: termSchema,
  academicYear: nonEmptyStringSchema,
  classworkScore: z.coerce.number().min(0).max(100),
  examScore: z.coerce.number().min(0).max(100),
  remarks: z.string().trim().optional(),
});

export const caRecordUpdateSchema = caRecordSchema.extend({
  id: positiveIntSchema,
});

export const caBulkUpsertSchema = z.object({
  classId: positiveIntSchema,
  term: termSchema,
  academicYear: nonEmptyStringSchema,
  records: z.array(caRecordSchema).min(1),
});

export const caBulkEntrySchema = z.object({
  rows: z.array(z.object({
    studentId: nonEmptyStringSchema,
    classworkScore: z.coerce.number().min(0).max(100),
    examScore: z.coerce.number().min(0).max(100),
    remarks: z.string().trim().max(500).optional(),
  })).min(1).max(500),
  subjectId: positiveIntSchema,
  classId: positiveIntSchema,
  term: termSchema,
  academicYear: nonEmptyStringSchema,
});
