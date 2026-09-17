"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@clerk/nextjs/server";
import { requireRole } from "@/src/lib/authz";
import {
  acceptBursarInviteForUser,
  createBursarInvite,
  resendBursarInvite,
  revokeBursarInvite,
  type CreatedBursarInvite,
} from "@/src/lib/services/bursar-invites";
import {
  bursarInviteCreateSchema,
  bursarInviteIdSchema,
  bursarInviteTokenSchema,
} from "@/src/lib/validation/bursar-invites";
import { parseActionInput } from "@/src/lib/validation/parse";

export type BursarInviteCreateActionResult =
  | { ok: true; invite: CreatedBursarInvite }
  | { ok: false; message: string };

export type BursarInviteActionResult =
  | { ok: true; invite?: Awaited<ReturnType<typeof resendBursarInvite>> }
  | { ok: false; message: string };

export async function createBursarInviteAction(
  input: unknown,
): Promise<BursarInviteCreateActionResult> {
  try {
    const context = await requireRole(["admin"]);
    const data = parseActionInput(bursarInviteCreateSchema, input);
    const invite = await createBursarInvite(data, context);
    revalidatePath("/list/bursars");
    return { ok: true, invite };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Could not create bursar invite.",
    };
  }
}

export async function resendBursarInviteAction(
  input: unknown,
): Promise<BursarInviteActionResult> {
  try {
    const context = await requireRole(["admin"]);
    const data = parseActionInput(bursarInviteIdSchema, input);
    const invite = await resendBursarInvite(data, context);
    revalidatePath("/list/bursars");
    return { ok: true, invite };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Could not resend bursar invite.",
    };
  }
}

export async function revokeBursarInviteAction(
  input: unknown,
): Promise<BursarInviteActionResult> {
  try {
    const context = await requireRole(["admin"]);
    const data = parseActionInput(bursarInviteIdSchema, input);
    await revokeBursarInvite(data, context);
    revalidatePath("/list/bursars");
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Could not revoke bursar invite.",
    };
  }
}

export async function acceptBursarInviteAction(
  input: unknown,
): Promise<BursarInviteActionResult> {
  try {
    const { userId } = await auth();
    if (!userId) {
      return { ok: false, message: "Please sign in before accepting this bursar invite." };
    }

    const data = parseActionInput(bursarInviteTokenSchema, input);
    await acceptBursarInviteForUser({ token: data.token, userId });
    revalidatePath("/list/bursars");
    revalidatePath("/bursar");
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Could not accept bursar invite.",
    };
  }
}
