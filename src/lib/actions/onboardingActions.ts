"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/src/lib/authz";
import {
  approveWaitlistEntry,
  rejectWaitlistEntry,
  type CreatedSchoolInvite,
} from "@/src/lib/services/onboarding";
import {
  approveWaitlistEntrySchema,
  rejectWaitlistEntrySchema,
} from "@/src/lib/validation/onboarding";
import { parseActionInput } from "@/src/lib/validation/parse";

export type OnboardingActionResult =
  | { ok: true; invite?: CreatedSchoolInvite }
  | { ok: false; message: string };

export async function approveWaitlistEntryAction(
  input: unknown,
): Promise<OnboardingActionResult> {
  try {
    const context = await requireRole(["platform_admin"]);
    const data = parseActionInput(approveWaitlistEntrySchema, input);
    const invite = await approveWaitlistEntry(data, context);
    revalidatePath("/platform/onboarding");
    return { ok: true, invite };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Could not approve onboarding request.",
    };
  }
}

export async function rejectWaitlistEntryAction(
  input: unknown,
): Promise<OnboardingActionResult> {
  try {
    const context = await requireRole(["platform_admin"]);
    const data = parseActionInput(rejectWaitlistEntrySchema, input);
    await rejectWaitlistEntry(data, context);
    revalidatePath("/platform/onboarding");
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Could not reject onboarding request.",
    };
  }
}
