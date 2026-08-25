import { z } from "zod";
import { nonEmptyStringSchema, positiveIntSchema, termSchema } from "./common";

export const caActivityTypeSchema = z.enum([
  "MIDTERM_EXAM",
  "CLASS_TEST",
  "CLASS_EXERCISE",
  "QUIZ",
  "HOMEWORK",
  "PROJECT",
  "PRACTICAL",
  "PARTICIPATION",
  "OTHER",
]);

export const caBucketAggregationModeSchema = z.enum([
  "AVERAGE_TO_BUCKET",
  "SUM_ACTIVITIES",
]);

export const caConfigSchema = z.object({
  academicYear: nonEmptyStringSchema,
  currentTerm: termSchema.default("TERM_1"),
  isActive: z.coerce.boolean().default(false),
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

export const caBucketSchema = z.object({
  name: z.string().trim().min(2).max(80),
  type: caActivityTypeSchema,
  aggregationMode: caBucketAggregationModeSchema,
  allocationMarks: z.coerce.number().positive().max(100),
  classId: positiveIntSchema,
  subjectId: positiveIntSchema,
  term: termSchema,
  academicYear: nonEmptyStringSchema,
  order: z.coerce.number().int().min(0).max(100).optional(),
});

export const caActivitySchema = z.object({
  bucketId: positiveIntSchema,
  title: z.string().trim().min(2).max(100).optional(),
  type: caActivityTypeSchema.optional(),
  rawMaxScore: z.coerce.number().positive().max(1000),
  allocationMarks: z.coerce.number().positive().max(100).optional().nullable(),
  activityDate: z.coerce.date().optional(),
});

export const caActivityScoreSchema = z.object({
  activityId: positiveIntSchema,
  studentId: nonEmptyStringSchema,
  rawScore: z.coerce.number().min(0).max(1000),
  comment: z.string().trim().max(300).optional(),
});

export const caBulkActivityScoreSchema = z.object({
  activityId: positiveIntSchema,
  rows: z.array(z.object({
    studentId: nonEmptyStringSchema,
    rawScore: z.coerce.number().min(0).max(1000),
    comment: z.string().trim().max(300).optional(),
  })).min(1).max(500),
});
