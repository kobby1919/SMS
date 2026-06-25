"use server";

// src/lib/actions/waitlistActions.ts

import prisma from "@/src/lib/prisma";
import { z } from "zod";
import type { WaitlistRole } from "@/src/generated/prisma";
import { enforceActionRateLimit } from "@/src/lib/rate-limit";

// ─── SCHEMA ───────────────────────────────────────────────────────────────────

const waitlistSchema = z.object({
  name:       z.string().min(2,  { message: "Name must be at least 2 characters." }),
  schoolName: z.string().min(2,  { message: "School name must be at least 2 characters." }),
  email:      z.string().email(  { message: "Please enter a valid email address." }),
  role:       z.enum(["HEADMASTER", "ADMINISTRATOR", "TEACHER", "OTHER"], {
    error: () => ({ message: "Please select your role." }),
  }),
  message:    z.string().max(500, { message: "Message must be under 500 characters." }).optional(),
});

// ─── TYPES ────────────────────────────────────────────────────────────────────

export type WaitlistInput = z.infer<typeof waitlistSchema>;

export type WaitlistResult =
  | { ok: true }
  | { ok: false; fieldErrors?: Partial<Record<keyof WaitlistInput, string>>; message: string };

// ─── ACTION ───────────────────────────────────────────────────────────────────

export async function joinWaitlist(data: WaitlistInput): Promise<WaitlistResult> {
  // Validate
  const parsed = waitlistSchema.safeParse(data);

  if (!parsed.success) {
    const flat = parsed.error.flatten().fieldErrors;
    return {
      ok:          false,
      message:     "Please fix the errors below.",
      fieldErrors: {
        name:       flat.name?.[0],
        schoolName: flat.schoolName?.[0],
        email:      flat.email?.[0],
        role:       flat.role?.[0],
        message:    flat.message?.[0],
      },
    };
  }

  const { name, schoolName, email, role, message } = parsed.data;
  await enforceActionRateLimit({
    key: `public:waitlist:${email.toLowerCase()}`,
    limit: 3,
    windowMs: 60 * 60_000,
  });

  // Duplicate check
  const existing = await prisma.waitlistEntry.findUnique({
    where:  { email },
    select: { id: true },
  });

  if (existing) {
    return {
      ok:      false,
      message: "This email is already on the waitlist. We'll be in touch soon.",
    };
  }

  // Save
  await prisma.waitlistEntry.create({
    data: {
      name,
      schoolName,
      email,
      role:    role as WaitlistRole,
      message: message ?? null,
    },
  });

  return { ok: true };
}
