import { z } from "zod";
import { nonEmptyStringSchema } from "@/src/lib/validation/common";

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

export const parentInviteCreateSchema = z.object({
  name: personNameSchema,
  surname: personNameSchema,
  sex: z.enum(["MALE", "FEMALE"], {
    error: "Select the parent's sex so Edujay can use the correct title.",
  }),
  email: z
    .string()
    .trim()
    .email("Enter a valid parent email address.")
    .max(180, "Email must be 180 characters or fewer.")
    .transform((email) => email.toLowerCase()),
  phone: phoneSchema,
  studentIds: z
    .array(z.string().trim().min(1, "Student id is required."))
    .min(1, "Select at least one ward for this parent."),
});

export const parentInviteIdSchema = z.object({
  inviteId: z.string().trim().min(1, "Invite id is required."),
});

export const parentInviteTokenSchema = z.object({
  token: z.string().trim().min(1, "Invite token is required."),
});

export type ParentInviteCreateInput = z.infer<typeof parentInviteCreateSchema>;
export type ParentInviteIdInput = z.infer<typeof parentInviteIdSchema>;
export type ParentInviteTokenInput = z.infer<typeof parentInviteTokenSchema>;

