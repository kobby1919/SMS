import { z } from "zod";

export const approveWaitlistEntrySchema = z.object({
  waitlistEntryId: z.string().trim().min(1),
  expiresInDays: z.coerce.number().int().min(1).max(30).default(7),
});

export const rejectWaitlistEntrySchema = z.object({
  waitlistEntryId: z.string().trim().min(1),
});

export const schoolProfileSetupSchema = z.object({
  name: z.string().trim().min(2).max(120),
  code: z.string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{3,6}$/, "School code must be 3-6 uppercase letters or numbers, with no spaces."),
  legalName: z.string().trim().max(160).optional().or(z.literal("")),
  displayName: z.string().trim().min(2).max(120).optional().or(z.literal("")),
  shortName: z.string().trim().max(40).optional().or(z.literal("")),
  emailFromName: z.string().trim().max(80).optional().or(z.literal("")),
  primaryColor: z.string().trim().regex(/^#[0-9A-Fa-f]{6}$/, "Use a valid hex color, for example #2563eb.").optional().or(z.literal("")),
  contactEmail: z.string().trim().email().optional().or(z.literal("")),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  address: z.string().trim().max(250).optional().or(z.literal("")),
  logoUrl: z.string().trim().url().optional().or(z.literal("")),
});

export const schoolSetupPathSchema = z.object({
  setupPath: z.enum(["fresh", "migration"]),
});

export const inviteIdSchema = z.object({
  inviteId: z.string().trim().min(1),
});

export const schoolAdminInviteCreateSchema = z.object({
  email: z.string().trim().email("Enter a valid admin email.").max(160),
  expiresInDays: z.coerce.number().int().min(1).max(30).default(7),
});

export type ApproveWaitlistEntryInput = z.infer<typeof approveWaitlistEntrySchema>;
export type RejectWaitlistEntryInput = z.infer<typeof rejectWaitlistEntrySchema>;
export type SchoolProfileSetupInput = z.infer<typeof schoolProfileSetupSchema>;
export type SchoolSetupPathInput = z.infer<typeof schoolSetupPathSchema>;
export type SchoolAdminInviteCreateInput = z.infer<typeof schoolAdminInviteCreateSchema>;

