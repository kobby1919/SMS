"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/src/lib/authz";
import { createTeacherInvite, type CreatedTeacherInvite } from "@/src/lib/services/teacher-invites";
import { teacherInviteCreateSchema } from "@/src/lib/validation/teacher-invites";
import { parseActionInput } from "@/src/lib/validation/parse";

export type TeacherInviteActionResult =
  | { ok: true; invite: CreatedTeacherInvite }
  | { ok: false; message: string };

export async function createTeacherInviteAction(
  input: unknown,
): Promise<TeacherInviteActionResult> {
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
