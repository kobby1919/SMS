import type { z } from "zod";
import { z as zod } from "zod";

export const teacherLifecycleActionSchema = zod.enum([
  "SUSPEND",
  "REACTIVATE",
  "MARK_LEFT_SCHOOL",
]);

export const teacherLifecycleMutationSchema = zod.object({
  teacherId: zod.string().trim().min(1, "Teacher id is required."),
  action: teacherLifecycleActionSchema,
  reason: zod
    .string()
    .trim()
    .min(10, "Give a clear reason of at least 10 characters.")
    .max(500, "Reason must be 500 characters or fewer."),
});

export type TeacherLifecycleActionInput = z.infer<typeof teacherLifecycleActionSchema>;
export type TeacherLifecycleMutationInput = z.infer<typeof teacherLifecycleMutationSchema>;
