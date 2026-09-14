import { z } from "zod";
import { nonEmptyStringSchema } from "@/src/lib/validation/common";

const optionalTrimmedString = z.preprocess(
  (value) => {
    if (typeof value !== "string") return value;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  },
  z.string().max(120).nullable().optional(),
);

const personNameSchema = nonEmptyStringSchema
  .min(2, "Name must be at least 2 characters.")
  .max(80, "Name must be 80 characters or fewer.")
  .regex(
    /^[A-Za-z][A-Za-z' -]*$/,
    "Name can only contain letters, spaces, apostrophes, and hyphens.",
  );

const phoneSchema = z.preprocess(
  (value) => {
    if (typeof value !== "string") return value;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  },
  z
    .string()
    .min(7, "Phone number is too short.")
    .max(30, "Phone number is too long.")
    .regex(/^[+\d\s().-]+$/, "Phone number contains invalid characters.")
    .nullable()
    .optional(),
);

export const teacherInviteTypeSchema = z.enum([
  "SUBJECT_TEACHER",
  "CLASS_TEACHER",
  "BOTH",
]);

export const teacherInviteCreateSchema = z.object({
  name: personNameSchema,
  surname: personNameSchema,
  email: z
    .string()
    .trim()
    .email("Enter a valid teacher email address.")
    .max(180, "Email must be 180 characters or fewer.")
    .transform((email) => email.toLowerCase()),
  phone: phoneSchema,
  teacherType: teacherInviteTypeSchema,
  staffId: optionalTrimmedString,
  employmentType: optionalTrimmedString,
});

export const teacherInviteIdSchema = z.object({
  inviteId: z.string().trim().min(1, "Invite id is required."),
});

export type TeacherInviteCreateInput = z.infer<typeof teacherInviteCreateSchema>;
export type TeacherInviteIdInput = z.infer<typeof teacherInviteIdSchema>;
export type TeacherInviteTypeInput = z.infer<typeof teacherInviteTypeSchema>;
