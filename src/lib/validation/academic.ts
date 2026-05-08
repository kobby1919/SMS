import { z } from "zod";
import { isoDateStringSchema, nonEmptyStringSchema, positiveIntSchema } from "./common";

export const examFormSchema = z.object({
  id: positiveIntSchema.optional(),
  title: nonEmptyStringSchema,
  lessonId: positiveIntSchema,
  startTime: isoDateStringSchema,
  endTime: isoDateStringSchema,
});

export const assignmentFormSchema = z.object({
  id: positiveIntSchema.optional(),
  title: nonEmptyStringSchema,
  lessonId: positiveIntSchema,
  startDate: isoDateStringSchema,
  dueDate: isoDateStringSchema,
});

export const resultFormSchema = z.object({
  id: positiveIntSchema.optional(),
  score: z.coerce.number().int().min(0).max(100),
  studentId: nonEmptyStringSchema,
  examId: positiveIntSchema.nullable().optional(),
  assignmentId: positiveIntSchema.nullable().optional(),
}).refine((d) => d.examId || d.assignmentId, {
  message: "Select an exam or assignment",
});
