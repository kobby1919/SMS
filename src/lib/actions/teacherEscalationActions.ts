"use server";

import { revalidatePath } from "next/cache";
import type {
  TeacherAccountabilityAuditAction,
  TeacherEscalationStatus,
  TeacherObligationStatus,
} from "@/src/generated/prisma";
import { requireRole } from "@/src/lib/authz";
import prisma from "@/src/lib/prisma";
import { parseActionInput } from "@/src/lib/validation/parse";
import { teacherEscalationReviewSchema } from "@/src/lib/validation/teacher-accountability";

export type TeacherEscalationActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

const initialStatusByAction: Record<
  "ACKNOWLEDGE" | "RESOLVE" | "DISMISS",
  TeacherEscalationStatus
> = {
  ACKNOWLEDGE: "ACKNOWLEDGED",
  RESOLVE: "RESOLVED",
  DISMISS: "DISMISSED",
};

const auditActionByAction: Record<
  "ACKNOWLEDGE" | "RESOLVE" | "DISMISS",
  TeacherAccountabilityAuditAction
> = {
  ACKNOWLEDGE: "ESCALATION_ACKNOWLEDGED",
  RESOLVE: "ESCALATION_RESOLVED",
  DISMISS: "ESCALATION_DISMISSED",
};

function obligationStatusForAction(action: "ACKNOWLEDGE" | "RESOLVE" | "DISMISS") {
  if (action === "DISMISS") return "CANCELLED" satisfies TeacherObligationStatus;
  return null;
}

function successMessage(action: "ACKNOWLEDGE" | "RESOLVE" | "DISMISS") {
  if (action === "ACKNOWLEDGE") return "Escalation acknowledged.";
  if (action === "RESOLVE") return "Escalation resolved.";
  return "Escalation dismissed and removed from the teacher's active issue score.";
}

export async function reviewTeacherEscalation(data: unknown) {
  const context = await requireRole(["admin"]);
  const input = parseActionInput(teacherEscalationReviewSchema, data);

  const escalation = await prisma.teacherEscalation.findFirst({
    where: {
      id: input.escalationId,
      schoolId: context.schoolId,
    },
    include: {
      obligation: {
        select: {
          id: true,
          status: true,
          priority: true,
          title: true,
        },
      },
    },
  });

  if (!escalation) {
    throw new Error("Escalation not found.");
  }

  if (escalation.status === "RESOLVED" || escalation.status === "DISMISSED") {
    throw new Error("This escalation has already been closed.");
  }

  if (input.action === "ACKNOWLEDGE" && escalation.status !== "OPEN") {
    throw new Error("Only open escalations can be acknowledged.");
  }

  const nextStatus = initialStatusByAction[input.action];
  const nextObligationStatus = obligationStatusForAction(input.action);
  const now = new Date();

  await prisma.$transaction([
    prisma.teacherEscalation.update({
      where: { id: escalation.id },
      data: {
        status: nextStatus,
        reviewedBy: context.userId,
        reviewNote: input.note,
        resolvedAt: input.action === "ACKNOWLEDGE" ? null : now,
      },
    }),
    ...(nextObligationStatus
      ? [
          prisma.teacherObligation.update({
            where: { id: escalation.obligationId },
            data: {
              status: nextObligationStatus,
              priority: "LOW",
            },
          }),
        ]
      : []),
    prisma.teacherAccountabilityAuditLog.create({
      data: {
        schoolId: context.schoolId,
        teacherId: escalation.teacherId,
        actorId: context.userId,
        actorRole: context.role,
        action: auditActionByAction[input.action],
        sourceModel: "TeacherEscalation",
        sourceId: escalation.id,
        before: {
          escalationStatus: escalation.status,
          obligationStatus: escalation.obligation.status,
          obligationPriority: escalation.obligation.priority,
        },
        after: {
          escalationStatus: nextStatus,
          obligationStatus: nextObligationStatus ?? escalation.obligation.status,
          obligationPriority: nextObligationStatus ? "LOW" : escalation.obligation.priority,
          reviewNote: input.note,
        },
        message: `${successMessage(input.action)} ${escalation.obligation.title}`,
      },
    }),
  ]);

  revalidatePath("/admin/accountability");
  revalidatePath("/teacher/accountability");
  revalidatePath("/teacher");

  return { message: successMessage(input.action) };
}

export async function reviewTeacherEscalationWithState(
  _state: TeacherEscalationActionState,
  data: FormData,
): Promise<TeacherEscalationActionState> {
  try {
    const result = await reviewTeacherEscalation(data);
    return {
      status: "success",
      message: result.message,
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Could not update escalation.",
    };
  }
}
