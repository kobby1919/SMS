"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/src/lib/authz";
import {
  createParentInvite,
  resendParentInvite,
  revokeParentInvite,
  type CreatedParentInvite,
} from "@/src/lib/services/parent-invites";
import {
  parentInviteCreateSchema,
  parentInviteIdSchema,
} from "@/src/lib/validation/parent-invites";
import { parseActionInput } from "@/src/lib/validation/parse";

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