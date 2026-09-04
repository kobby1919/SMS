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
import {
  teacherEscalationResponseSchema,
  teacherEscalationReviewSchema,
} from "@/src/lib/validation/teacher-accountability";

export type TeacherEscalationActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

const ESCALATION_RESPONSE_FIELD = "escalationResponse";

function actionInput(data: unknown) {
  if (data instanceof FormData) {
    return Object.fromEntries(data.entries());
  }
  return data;
}

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
  const input = parseActionInput(teacherEscalationReviewSchema, actionInput(data));

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
  const correctionRequestStatus =
    input.action === "RESOLVE"
      ? "APPROVED"
      : input.action === "DISMISS"
        ? "REJECTED"
        : null;

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
    ...(correctionRequestStatus
      ? [
          prisma.teacherCorrectionRequest.updateMany({
            where: {
              schoolId: context.schoolId,
              teacherId: escalation.teacherId,
              sourceModel: "TeacherObligation",
              sourceId: escalation.obligationId,
              fieldName: ESCALATION_RESPONSE_FIELD,
              status: "PENDING",
            },
            data: {
              status: correctionRequestStatus,
              reviewedBy: context.userId,
              reviewedAt: now,
              reviewNote: input.note,
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
          correctionRequestStatus,
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

export async function submitTeacherEscalationResponse(data: unknown) {
  const context = await requireRole(["teacher"]);
  const input = parseActionInput(
    teacherEscalationResponseSchema,
    actionInput(data),
  );

  const obligation = await prisma.teacherObligation.findFirst({
    where: {
      id: input.obligationId,
      schoolId: context.schoolId,
      teacherId: context.userId,
    },
    include: {
      escalations: {
        where: { status: { in: ["OPEN", "ACKNOWLEDGED"] } },
        select: {
          id: true,
          status: true,
          reason: true,
          escalatedAt: true,
        },
        orderBy: { escalatedAt: "desc" },
        take: 1,
      },
    },
  });

  if (!obligation) {
    throw new Error("Escalated duty not found.");
  }

  const activeEscalation = obligation.escalations[0] ?? null;
  if (!activeEscalation && obligation.status !== "ESCALATED") {
    throw new Error("Only escalated duties can receive a teacher response.");
  }

  const sourceKey = `teacher-obligation:${obligation.id}:escalation-response`;
  const existing = await prisma.teacherCorrectionRequest.findUnique({
    where: {
      schoolId_teacherId_sourceKey_fieldName: {
        schoolId: context.schoolId,
        teacherId: context.userId,
        sourceKey,
        fieldName: ESCALATION_RESPONSE_FIELD,
      },
    },
    select: {
      id: true,
      status: true,
    },
  });

  if (existing?.status === "PENDING") {
    throw new Error("Your response is already waiting for management review.");
  }

  if (existing && existing.status !== "NEEDS_MORE_INFO") {
    throw new Error("This escalated duty already has a reviewed response.");
  }

  const responsePayload = {
    responseType: input.responseType,
    requestedAction: input.requestedAction,
    escalationId: activeEscalation?.id ?? null,
    obligationType: obligation.type,
    obligationStatus: obligation.status,
  };

  await prisma.$transaction(async (tx) => {
    const request = existing
      ? await tx.teacherCorrectionRequest.update({
          where: { id: existing.id },
          data: {
            reason: input.reason,
            evidenceUrl: input.evidenceUrl ?? null,
            status: "PENDING",
            reviewedBy: null,
            reviewedAt: null,
            reviewNote: null,
            oldValue: {
              escalationId: activeEscalation?.id ?? null,
              escalationStatus: activeEscalation?.status ?? null,
              escalationReason: activeEscalation?.reason ?? null,
            },
            newValue: responsePayload,
          },
        })
      : await tx.teacherCorrectionRequest.create({
          data: {
            schoolId: context.schoolId,
            teacherId: context.userId,
            sourceModel: "TeacherObligation",
            sourceId: obligation.id,
            sourceKey,
            fieldName: ESCALATION_RESPONSE_FIELD,
            reason: input.reason,
            evidenceUrl: input.evidenceUrl ?? null,
            oldValue: {
              escalationId: activeEscalation?.id ?? null,
              escalationStatus: activeEscalation?.status ?? null,
              escalationReason: activeEscalation?.reason ?? null,
            },
            newValue: responsePayload,
          },
        });

    await tx.teacherAccountabilityAuditLog.create({
      data: {
        schoolId: context.schoolId,
        teacherId: context.userId,
        actorId: context.userId,
        actorRole: context.role,
        action: "CORRECTION_REQUESTED",
        sourceModel: "TeacherObligation",
        sourceId: obligation.id,
        before: {
          obligationStatus: obligation.status,
          escalationStatus: activeEscalation?.status ?? null,
        },
        after: {
          correctionRequestId: request.id,
          responseType: input.responseType,
          requestedAction: input.requestedAction,
          status: request.status,
        },
        message:
          input.responseType === "CORRECTION_REQUEST"
            ? `Correction requested for ${obligation.title}.`
            : `Teacher explanation submitted for ${obligation.title}.`,
      },
    });
  });

  revalidatePath("/teacher/accountability");
  revalidatePath("/teacher");
  revalidatePath("/admin/accountability");

  return { message: "Response sent to management for review." };
}

export async function submitTeacherEscalationResponseWithState(
  _state: TeacherEscalationActionState,
  data: FormData,
): Promise<TeacherEscalationActionState> {
  try {
    const result = await submitTeacherEscalationResponse(data);
    return {
      status: "success",
      message: result.message,
    };
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "Could not submit teacher response.",
    };
  }
}
