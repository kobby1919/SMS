"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/src/lib/authz";
import {
  createTeacherInvite,
  resendTeacherInvite,
  revokeTeacherInvite,
  type CreatedTeacherInvite,
} from "@/src/lib/services/teacher-invites";
import {
  teacherInviteCreateSchema,
  teacherInviteIdSchema,
} from "@/src/lib/validation/teacher-invites";
import { parseActionInput } from "@/src/lib/validation/parse";

export type TeacherInviteCreateActionResult =
  | { ok: true; invite: CreatedTeacherInvite }
  | { ok: false; message: string };

export type TeacherInviteActionResult =
  | { ok: true; invite?: Awaited<ReturnType<typeof resendTeacherInvite>> }
  | { ok: false; message: string };

export async function createTeacherInviteAction(
  input: unknown,
): Promise<TeacherInviteCreateActionResult> {
  try {
    const context = await requireRole(["admin"]);
    const data = parseActionInput(teacherInviteCreateSchema, input);
    const invite = await createTeacherInvite(data, context);
    revalidatePath("/list/teachers");
    return { ok: true, invite };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Could not create teacher invite.",
    };
  }
}

export async function resendTeacherInviteAction(
  input: unknown,
): Promise<TeacherInviteActionResult> {
  try {
    const context = await requireRole(["admin"]);
    const data = parseActionInput(teacherInviteIdSchema, input);
    const invite = await resendTeacherInvite(data, context);
    revalidatePath("/list/teachers");
    return { ok: true, invite };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Could not resend teacher invite.",
    };
  }
}

export async function revokeTeacherInviteAction(
  input: unknown,
): Promise<TeacherInviteActionResult> {
  try {
    const context = await requireRole(["admin"]);
    const data = parseActionInput(teacherInviteIdSchema, input);
    await revokeTeacherInvite(data, context);
    revalidatePath("/list/teachers");
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Could not revoke teacher invite.",
    };
  }
}
