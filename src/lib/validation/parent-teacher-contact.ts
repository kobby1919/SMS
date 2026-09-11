import { z } from "zod";

export const parentTeacherContactRequestSchema = z.object({
  studentId: z.string().min(1, "Student is required."),
  teacherId: z.string().min(1, "Teacher is required."),
  category: z.enum(["ATTENDANCE", "ACADEMIC_SUPPORT", "HOMEWORK", "WELLBEING", "GENERAL"]),
  preferredChannel: z.enum(["IN_APP", "EMAIL", "SMS", "WHATSAPP"]),
  priority: z.enum(["LOW", "NORMAL", "HIGH"]).default("NORMAL"),
  subject: z.string().trim().min(4, "Subject must be at least 4 characters.").max(120),
  message: z.string().trim().min(10, "Message must be at least 10 characters.").max(1000),
});

export const teacherContactRequestIdSchema = z.object({
  requestId: z.string().min(1, "Request is required."),
});

export const teacherContactResponseSchema = teacherContactRequestIdSchema.extend({
  response: z.string().trim().min(5, "Response must be at least 5 characters.").max(1000),
});

export const adminContactRequestReviewSchema = teacherContactRequestIdSchema.extend({
  note: z.string().trim().max(500, "Note must be 500 characters or less.").optional(),
});
