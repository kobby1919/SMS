import type { TeacherStatus } from "@/src/generated/prisma";
import type { AuthzContext } from "@/src/lib/authz";
import { revalidatePath } from "next/cache";
import prisma from "@/src/lib/prisma";
import { revalidateDashboard, revalidateReferenceData } from "@/src/lib/cacheTags";
import { nextTeacherProfileStatus } from "@/src/lib/services/teacher-profile-completion";
import type { TeacherLifecycleMutationInput } from "@/src/lib/validation/teacher-lifecycle";

export class TeacherLifecycleError extends Error {
  constructor(message: string, readonly status: 400 | 404 | 409 = 400) {
    super(message);
    this.name = "TeacherLifecycleError";
  }
}

type TeacherLifecycleTeacher = {
  id: string;
  schoolId: string;
  status: TeacherStatus;
  name: string;
  surname: string;
  email: string | null;
  phone: string | null;
  address: string | null;
};

export type TeacherLifecycleAvailability = {
  canSuspend: boolean;
  canReactivate: boolean;
  canMarkLeftSchool: boolean;
  reasons: {
    suspend?: string;
    reactivate?: string;
    markLeftSchool?: string;
  };
};

export function getTeacherLifecycleAvailability(
  status: TeacherStatus,
): TeacherLifecycleAvailability {
  return {
    canSuspend: status === "ACTIVE" || status === "INCOMPLETE_SETUP" || status === "INVITED",
    canReactivate: status === "SUSPENDED",
    canMarkLeftSchool:
      status === "ACTIVE" ||
      status === "INCOMPLETE_SETUP" ||
      status === "INVITED" ||
      status === "SUSPENDED",
    reasons: {
      suspend:
        status === "SUSPENDED"
          ? "Teacher is already suspended."
          : status === "LEFT_SCHOOL"
            ? "Teacher has already left the school."
            : undefined,
      reactivate:
        status === "SUSPENDED"
          ? undefined
          : status === "LEFT_SCHOOL"
            ? "Teachers marked as left school must be invited again if they return."
            : "Only suspended teachers can be reactivated.",
      markLeftSchool:
        status === "LEFT_SCHOOL" ? "Teacher has already been marked as left school." : undefined,
    },
  };
}

function actionLabel(action: TeacherLifecycleMutationInput["action"]) {
  switch (action) {
    case "SUSPEND":
      return "suspended";
    case "REACTIVATE":
      return "reactivated";
    case "MARK_LEFT_SCHOOL":
      return "marked as left school";
  }
}

function nextStatusForAction(
  teacher: TeacherLifecycleTeacher,
  action: TeacherLifecycleMutationInput["action"],
): TeacherStatus {
  const availability = getTeacherLifecycleAvailability(teacher.status);

  if (action === "SUSPEND") {
    if (!availability.canSuspend) {
      throw new TeacherLifecycleError(
        availability.reasons.suspend ?? "This teacher cannot be suspended from the current status.",
        409,
      );
    }
    return "SUSPENDED";
  }

  if (action === "REACTIVATE") {
    if (!availability.canReactivate) {
      throw new TeacherLifecycleError(
        availability.reasons.reactivate ?? "This teacher cannot be reactivated from the current status.",
        409,
      );
    }
    return nextTeacherProfileStatus({
      status: "ACTIVE",
      name: teacher.name,
      surname: teacher.surname,
      email: teacher.email,
      phone: teacher.phone,
      address: teacher.address,
    });
  }

  if (!availability.canMarkLeftSchool) {
    throw new TeacherLifecycleError(
      availability.reasons.markLeftSchool ?? "This teacher cannot be marked as left school from the current status.",
      409,
    );
  }
  return "LEFT_SCHOOL";
}

export async function updateTeacherLifecycleStatus(
  input: TeacherLifecycleMutationInput,
  context: AuthzContext,
) {
  const teacher = await prisma.teacher.findFirst({
    where: { id: input.teacherId, schoolId: context.schoolId },
    select: {
      id: true,
      schoolId: true,
      status: true,
      name: true,
      surname: true,
      email: true,
      phone: true,
      address: true,
    },
  });

  if (!teacher) {
    throw new TeacherLifecycleError("Teacher not found.", 404);
  }

  const nextStatus = nextStatusForAction(teacher, input.action);
  if (nextStatus === teacher.status) {
    throw new TeacherLifecycleError("This lifecycle action would not change the teacher status.", 409);
  }

  const message = `${teacher.name} ${teacher.surname}`.trim() || "Teacher";

  const updated = await prisma.$transaction(async (tx) => {
    const statusUpdate = await tx.teacher.updateMany({
      where: {
        id: teacher.id,
        schoolId: context.schoolId,
        status: teacher.status,
      },
      data: { status: nextStatus },
    });

    if (statusUpdate.count !== 1) {
      throw new TeacherLifecycleError(
        "Teacher status changed while you were working. Refresh and try again.",
        409,
      );
    }

    const row = await tx.teacher.findFirstOrThrow({
      where: { id: teacher.id, schoolId: context.schoolId },
      select: { id: true, status: true, name: true, surname: true, email: true },
    });

    await tx.teacherAccountabilityAuditLog.create({
      data: {
        schoolId: context.schoolId,
        teacherId: teacher.id,
        action: "SETTINGS_UPDATED",
        actorId: context.userId,
        actorRole: context.role,
        sourceModel: "TEACHER_LIFECYCLE",
        sourceId: teacher.id,
        before: {
          status: teacher.status,
        },
        after: {
          status: nextStatus,
          lifecycleAction: input.action,
          reason: input.reason,
        },
        message: `${message} was ${actionLabel(input.action)}. Reason: ${input.reason}`,
      },
    });

    return row;
  });

  revalidateReferenceData(context.schoolId, "teachers");
  revalidateReferenceData(context.schoolId, "timetable");
  revalidateDashboard(context.schoolId);
  revalidatePath("/list/teachers");
  revalidatePath(`/list/teachers/${teacher.id}`);
  revalidatePath("/teacher");

  return updated;
}

