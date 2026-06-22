import { z } from "zod";
import { attendanceStatusSchema, isoDateStringSchema, positiveIntSchema } from "./common";

export const attendanceGetQuerySchema = z.object({
  lessonId: z.string().regex(/^\d+$/).transform(Number),
  date: isoDateStringSchema,
});

export const attendanceRecordSchema = z.object({
  studentId: z.string().trim().min(1),
  status: attendanceStatusSchema,
  note: z.string().trim().optional().nullable(),
});

export const attendanceSubmitSchema = z.object({
  lessonId: positiveIntSchema,
  date: isoDateStringSchema,
  records: z.array(attendanceRecordSchema).min(1),
});

export const attendanceDeleteQuerySchema = z.object({
  id: z.string().regex(/^\d+$/).transform(Number),
});

export const attendanceStatsQuerySchema = z
  .object({
    studentId: z.string().trim().min(1).optional(),
    classId: positiveIntSchema.optional(),
  })
  .refine((value) => !(value.studentId && value.classId), {
    message: "Choose either studentId or classId, not both.",
  });
