import { z } from "zod";

export const approveWaitlistEntrySchema = z.object({
  waitlistEntryId: z.string().trim().min(1),
  expiresInDays: z.coerce.number().int().min(1).max(30).default(7),
});

export const rejectWaitlistEntrySchema = z.object({
  waitlistEntryId: z.string().trim().min(1),
});

export type ApproveWaitlistEntryInput = z.infer<typeof approveWaitlistEntrySchema>;
export type RejectWaitlistEntryInput = z.infer<typeof rejectWaitlistEntrySchema>;
