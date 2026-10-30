"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@clerk/nextjs/server";
import { requireRole } from "@/src/lib/authz";
import {
  acceptParentInviteForUser,
  createParentInvite,
  resendParentInvite,
  revokeParentInvite,
  type CreatedParentInvite,
} from "@/src/lib/services/parent-invites";
import {
  parentInviteCreateSchema,
  parentInviteIdSchema,
  parentInviteTokenSchema,
} from "@/src/lib/validation/parent-invites";
import { parseActionInput } from "@/src/lib/validation/parse";
import prisma from "@/src/lib/prisma";
import { findParentInviteProfile, parentProfileHasAccount, ParentInviteProfileError } from "@/src/lib/services/parent-invite-profile";

export type ParentInviteProfileActionResult =
  | { ok: true; profile: { name: string; surname: string; sex: "MALE" | "FEMALE"; phone: string | null; hasAccount: boolean; wards: { id: string; name: string; surname: string; className: string }[] } | null }
  | { ok: false; message: string };

export async function lookupParentInviteProfileAction(input: unknown): Promise<ParentInviteProfileActionResult> {
  try {
    const context = await requireRole(["admin"]);
    const parsed = parentInviteCreateSchema.pick({ email: true }).safeParse(input);
    if (!parsed.success) return { ok: false, message: "Enter a valid parent email address." };
    const { email } = parsed.data;
    const profile = await findParentInviteProfile(prisma, context.schoolId, email);
    return { ok: true, profile: profile ? {
      name: profile.name, surname: profile.surname, sex: profile.sex, phone: profile.phone, hasAccount: parentProfileHasAccount(profile),
      wards: profile.studentRelationships.map(({ student }) => ({ id: student.id, name: student.name, surname: student.surname, className: student.class.name })),
    } : null };
  } catch (error) {
    return { ok: false, message: error instanceof ParentInviteProfileError ? error.message : "Could not check existing parent links. Please try again." };
  }
}

export type ParentInviteCreateActionResult =
  | { ok: true; invite: CreatedParentInvite }
  | { ok: false; message: string };

export type ParentInviteActionResult =
  | { ok: true; invite?: Awaited<ReturnType<typeof resendParentInvite>> }
  | { ok: false; message: string };

export async function createParentInviteAction(
  input: unknown,
): Promise<ParentInviteCreateActionResult> {
  try {
    const context = await requireRole(["admin"]);
    const data = parseActionInput(parentInviteCreateSchema, input);
    const invite = await createParentInvite(data, context);
    revalidatePath("/list/parents");
    return { ok: true, invite };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Could not create parent invite.",
    };
  }
}

export async function resendParentInviteAction(
  input: unknown,
): Promise<ParentInviteActionResult> {
  try {
    const context = await requireRole(["admin"]);
    const data = parseActionInput(parentInviteIdSchema, input);
    const invite = await resendParentInvite(data, context);
    revalidatePath("/list/parents");
    return { ok: true, invite };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Could not resend parent invite.",
    };
  }
}

export async function revokeParentInviteAction(
  input: unknown,
): Promise<ParentInviteActionResult> {
  try {
    const context = await requireRole(["admin"]);
    const data = parseActionInput(parentInviteIdSchema, input);
    await revokeParentInvite(data, context);
    revalidatePath("/list/parents");
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Could not revoke parent invite.",
    };
  }
}
export async function acceptParentInviteAction(
  input: unknown,
): Promise<ParentInviteActionResult> {
  try {
    const { userId } = await auth();
    if (!userId) {
      return { ok: false, message: "Please sign in before accepting this parent invite." };
    }

    const data = parseActionInput(parentInviteTokenSchema, input);
    await acceptParentInviteForUser({ token: data.token, userId });
    revalidatePath("/list/parents");
    revalidatePath("/parent");
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Could not accept parent invite.",
    };
  }
}
