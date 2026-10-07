"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@clerk/nextjs/server";
import { requireRole } from "@/src/lib/authz";
import {
  acceptCollectorInviteForUser,
  createCollectorInvite,
  resendCollectorInvite,
  revokeCollectorInvite,
  type CreatedCollectorInvite,
} from "@/src/lib/services/collector-invites";
import {
  collectorInviteCreateSchema,
  collectorInviteIdSchema,
  collectorInviteTokenSchema,
} from "@/src/lib/validation/collector-invites";
import { parseActionInput } from "@/src/lib/validation/parse";

export type CollectorInviteCreateActionResult =
  | { ok: true; invite: CreatedCollectorInvite }
  | { ok: false; message: string };

export type CollectorInviteActionResult =
  | { ok: true; invite?: Awaited<ReturnType<typeof resendCollectorInvite>> }
  | { ok: false; message: string };

export async function createCollectorInviteAction(
  input: unknown,
): Promise<CollectorInviteCreateActionResult> {
  try {
    const context = await requireRole(["bursar"]);
    const data = parseActionInput(collectorInviteCreateSchema, input);
    const invite = await createCollectorInvite(data, context);
    revalidatePath("/list/finance/daily-collections");
    return { ok: true, invite };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Could not create collector invite.",
    };
  }
}

export async function resendCollectorInviteAction(
  input: unknown,
): Promise<CollectorInviteActionResult> {
  try {
    const context = await requireRole(["bursar"]);
    const data = parseActionInput(collectorInviteIdSchema, input);
    const invite = await resendCollectorInvite(data, context);
    revalidatePath("/list/finance/daily-collections");
    return { ok: true, invite };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Could not resend collector invite.",
    };
  }
}

export async function revokeCollectorInviteAction(
  input: unknown,
): Promise<CollectorInviteActionResult> {
  try {
    const context = await requireRole(["bursar"]);
    const data = parseActionInput(collectorInviteIdSchema, input);
    await revokeCollectorInvite(data, context);
    revalidatePath("/list/finance/daily-collections");
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Could not revoke collector invite.",
    };
  }
}

export async function acceptCollectorInviteAction(
  input: unknown,
): Promise<CollectorInviteActionResult> {
  try {
    const { userId } = await auth();
    if (!userId) {
      return { ok: false, message: "Please sign in before accepting this collector invite." };
    }

    const data = parseActionInput(collectorInviteTokenSchema, input);
    await acceptCollectorInviteForUser({ token: data.token, userId });
    revalidatePath("/list/finance/daily-collections");
    revalidatePath("/collector");
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Could not accept collector invite.",
    };
  }
}
