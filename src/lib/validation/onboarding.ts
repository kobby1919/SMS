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
  contactEmail: z.string().trim().email().optional().or(z.literal("")),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  address: z.string().trim().max(250).optional().or(z.literal("")),
});

export type ApproveWaitlistEntryInput = z.infer<typeof approveWaitlistEntrySchema>;
export type RejectWaitlistEntryInput = z.infer<typeof rejectWaitlistEntrySchema>;
export type SchoolProfileSetupInput = z.infer<typeof schoolProfileSetupSchema>;
