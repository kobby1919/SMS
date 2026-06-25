"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/src/lib/authz";
import {
  approveWaitlistEntry,
  completeSchoolOnboarding,
  createDefaultAcademicSetup,
  recordInviteSent,
  recordOnboardingImport,
  rejectWaitlistEntry,
  resendSchoolInvite,
  revokeSchoolInvite,
  updateSchoolProfileSetup,
  type CreatedSchoolInvite,
} from "@/src/lib/services/onboarding";
import {
  approveWaitlistEntrySchema,
  inviteIdSchema,
  onboardingImportSchema,
  rejectWaitlistEntrySchema,
  schoolProfileSetupSchema,
} from "@/src/lib/validation/onboarding";
import { parseActionInput } from "@/src/lib/validation/parse";
import {
  appBaseUrl,
  sendFirstAdminInviteEmail,
} from "@/src/lib/services/notifications";

export type OnboardingActionResult =
  | { ok: true; invite?: CreatedSchoolInvite; emailProvider?: string; emailWarning?: string }
  | { ok: false; message: string };

export async function approveWaitlistEntryAction(
  input: unknown,
): Promise<OnboardingActionResult> {
  try {
    const context = await requireRole(["platform_admin"]);
    const data = parseActionInput(approveWaitlistEntrySchema, input);
    const invite = await approveWaitlistEntry(data, context);
    const inviteUrl = `${appBaseUrl()}${invite.invitePath}`;
    const email = await sendFirstAdminInviteEmail({
      to: invite.email,
      schoolName: invite.schoolName,
      inviteUrl,
      expiresAt: invite.expiresAt,
    });
    await recordInviteSent({
      inviteId: invite.inviteId,
      provider: email.provider,
      warning: email.ok ? undefined : email.message,
    }, context);
    revalidatePath("/platform/onboarding");
    return {
      ok: true,
      invite,
      emailProvider: email.provider,
      emailWarning: email.ok ? undefined : email.message,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Could not approve onboarding request.",
    };
  }
}

export async function resendSchoolInviteAction(
  input: unknown,
): Promise<OnboardingActionResult> {
  try {
    const context = await requireRole(["platform_admin"]);
    const data = parseActionInput(inviteIdSchema, input);
    const invite = await resendSchoolInvite(data, context);
    revalidatePath("/platform/onboarding");
    return { ok: true, invite };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Could not resend invite.",
    };
  }
}

export async function revokeSchoolInviteAction(
  input: unknown,
): Promise<OnboardingActionResult> {
  try {
    const context = await requireRole(["platform_admin"]);
    const data = parseActionInput(inviteIdSchema, input);
    await revokeSchoolInvite(data, context);
    revalidatePath("/platform/onboarding");
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Could not revoke invite.",
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

export async function updateSchoolProfileSetupAction(
  input: unknown,
): Promise<OnboardingActionResult> {
  try {
    const context = await requireRole(["admin"]);
    const data = parseActionInput(schoolProfileSetupSchema, input);
    await updateSchoolProfileSetup(data, context);
    revalidatePath("/onboarding/setup");
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Could not save school profile.",
    };
  }
}

export async function completeSchoolOnboardingAction(): Promise<OnboardingActionResult> {
  try {
    const context = await requireRole(["admin"]);
    await completeSchoolOnboarding(context);
    revalidatePath("/onboarding/setup");
    revalidatePath("/admin");
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Could not complete setup.",
    };
  }
}

export async function createDefaultAcademicSetupAction(): Promise<OnboardingActionResult> {
  try {
    const context = await requireRole(["admin"]);
    await createDefaultAcademicSetup(context);
    revalidatePath("/onboarding/setup");
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Could not create default academics.",
    };
  }
}

export async function recordOnboardingImportAction(
  input: unknown,
): Promise<OnboardingActionResult> {
  try {
    const context = await requireRole(["admin"]);
    const data = parseActionInput(onboardingImportSchema, input);
    await recordOnboardingImport(data, context);
    revalidatePath("/onboarding/setup");
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Could not record import.",
    };
  }
}
