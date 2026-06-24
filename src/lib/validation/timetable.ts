import { z } from "zod";
import { daySchema, positiveIntSchema } from "./common";

export const timetableLessonSchema = z.object({
  name: z.string().trim().optional(),
  day: daySchema,
  startTime: z.string().trim().min(1),
  endTime: z.string().trim().min(1),
  subjectId: positiveIntSchema,
  classId: positiveIntSchema,
  teacherId: z.string().trim().min(1),
});

export const timetableUpdateSchema = timetableLessonSchema.extend({
  id: positiveIntSchema,
});

export const timetableGetQuerySchema = z.object({
  classId: z
    .string()
    .regex(/^\d+$/)
    .transform(Number)
    .optional(),
});

export const timetableDeleteQuerySchema = z.object({
  id: z.string().regex(/^\d+$/).transform(Number),
});

export const teacherClassCountQuerySchema = z.object({
  teacherId: z.string().trim().min(1),
  excludeClassId: positiveIntSchema.optional(),
  excludeLessonId: positiveIntSchema.optional(),
});
