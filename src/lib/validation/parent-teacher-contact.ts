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
