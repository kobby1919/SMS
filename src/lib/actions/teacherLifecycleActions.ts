"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/src/lib/authz";
import {
  TeacherLifecycleError,
  updateTeacherLifecycleStatus,
} from "@/src/lib/services/teacher-lifecycle";
import { teacherLifecycleMutationSchema } from "@/src/lib/validation/teacher-lifecycle";
import { parseActionInput } from "@/src/lib/validation/parse";

export type TeacherLifecycleActionResult =
  | { ok: true; teacher: Awaited<ReturnType<typeof updateTeacherLifecycleStatus>> }
  | { ok: false; message: string };

export async function updateTeacherLifecycleStatusAction(
  input: unknown,
): Promise<TeacherLifecycleActionResult> {
  try {
    const context = await requireRole(["admin"]);
    const data = parseActionInput(teacherLifecycleMutationSchema, input);
    const teacher = await updateTeacherLifecycleStatus(data, context);
    revalidatePath("/list/teachers");
    revalidatePath(`/list/teachers/${data.teacherId}`);
    return { ok: true, teacher };
  } catch (error) {
    if (error instanceof TeacherLifecycleError) {
      return { ok: false, message: error.message };
    }
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Could not update teacher status.",
    };
  }
}
