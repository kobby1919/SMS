import { z } from "zod";
import {
  attendanceStatusSchema,
  isoDateStringSchema,
  nonEmptyStringSchema,
  positiveIntSchema,
  stringIdSchema,
  termSchema,
} from "./common";

export const numericIdSchema = z.object({ id: positiveIntSchema });
export const stringIdActionSchema = z.object({ id: stringIdSchema });

export const classCreateSchema = z.object({
  name: nonEmptyStringSchema.max(100),
  capacity: z.coerce.number().int().positive().max(500),
  gradeId: positiveIntSchema,
  section: z.string().trim().max(20).optional(),
  supervisorId: stringIdSchema.optional(),
});

export const classUpdateSchema = classCreateSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  "Provide at least one class field to update.",
);

export const subjectCreateSchema = z.object({
  name: nonEmptyStringSchema.max(100),
  teacherIds: z.array(stringIdSchema).max(100).optional(),
});

export const subjectUpdateSchema = subjectCreateSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  "Provide at least one subject field to update.",
);

export const examFormSchema = z.object({
  id: positiveIntSchema.optional(),
  title: nonEmptyStringSchema,
  lessonId: positiveIntSchema,
  startTime: isoDateStringSchema,
  endTime: isoDateStringSchema,
});

export const assignmentFormSchema = z.object({
  id: positiveIntSchema.optional(),
  title: z.literal("Homework", {
    error: "Assignments in this workflow must be saved as Homework.",
  }),
  lessonId: positiveIntSchema,
  startDate: isoDateStringSchema,
  dueDate: isoDateStringSchema,
}).refine((data) => new Date(data.dueDate) >= new Date(data.startDate), {
  message: "Due date cannot be before the assigned date.",
  path: ["dueDate"],
});

export const announcementFormSchema = z.object({
  id: positiveIntSchema.optional(),
  title: nonEmptyStringSchema.max(140),
  description: nonEmptyStringSchema.max(2000),
  date: isoDateStringSchema,
  classId: positiveIntSchema.nullable().optional(),
  priority: z.enum(["NORMAL", "IMPORTANT", "URGENT"]).default("NORMAL"),
  expiresAt: isoDateStringSchema.nullable().optional(),
}).refine((data) => {
  if (!data.expiresAt) return true;
  return new Date(data.expiresAt) >= new Date(data.date);
}, {
  message: "Expiry date must be on or after the notice date.",
  path: ["expiresAt"],
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

export const homeworkSubmissionSchema = z.object({
  assignmentId: positiveIntSchema,
  studentId: nonEmptyStringSchema,
  status: z.enum(["PENDING", "SUBMITTED", "LATE", "MISSING", "EXCUSED"]),
  submittedAt: isoDateStringSchema.nullable().optional(),
  note: z.string().trim().max(500).nullable().optional(),
});

export const homeworkBulkSubmissionSchema = z.object({
  assignmentId: positiveIntSchema,
  status: z.enum(["PENDING", "SUBMITTED", "LATE", "MISSING", "EXCUSED"]),
  onlyPending: z.boolean().optional().default(true),
  note: z.string().trim().max(500).nullable().optional(),
});

const optionalTimeSchema = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? null : value),
  z
    .string()
    .trim()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:mm time format.")
    .nullable()
    .optional(),
);

export const attendanceCorrectionRequestSchema = z.object({
  attendanceId: positiveIntSchema,
  newStatus: attendanceStatusSchema,
  newNote: z.string().trim().max(500).nullable().optional(),
  newArrivalTime: optionalTimeSchema,
  reason: nonEmptyStringSchema.max(700),
}).superRefine((value, ctx) => {
  if (value.newStatus === "LATE" && !value.newArrivalTime?.trim()) {
    ctx.addIssue({
      code: "custom",
      message: "Arrival time is required when correcting attendance to late.",
      path: ["newArrivalTime"],
    });
  }
});

export const attendanceCorrectionReviewSchema = z.object({
  requestId: stringIdSchema,
  action: z.enum(["APPROVE", "REJECT"]),
  note: z.string().trim().max(700).nullable().optional(),
}).superRefine((value, ctx) => {
  if (value.action === "REJECT" && !value.note?.trim()) {
    ctx.addIssue({
      code: "custom",
      message: "Add a short note before rejecting an attendance correction request.",
      path: ["note"],
    });
  }
});

export const reportCardPdfQuerySchema = z.object({
  studentId: nonEmptyStringSchema,
  term: termSchema.optional(),
  year: z.string().trim().max(20).optional().default(""),
});

export const syllabusPdfQuerySchema = z.object({
  syllabusId: positiveIntSchema,
});
