import type { ParentNotificationType } from "@/src/generated/prisma";
import { recordParentActivityEvents } from "@/src/lib/services/parent-activity-events";

type ApprovedCorrectionParentEventInput = {
  schoolId: string;
  studentId: string;
  teacherId?: string | null;
  type: ParentNotificationType;
  title: string;
  itemLabel: string;
  previousLabel: string;
  correctedLabel: string;
  reason?: string | null;
  reviewNote?: string | null;
  href?: string;
  sourceModel: string;
  sourceId: string;
  sourceKey: string;
  occurredAt?: Date;
  payload?: Record<string, unknown>;
};

export async function recordApprovedCorrectionParentEvent(input: ApprovedCorrectionParentEventInput) {
  const occurredAt = input.occurredAt ?? new Date();

  return recordParentActivityEvents({
    schoolId: input.schoolId,
    studentIds: [input.studentId],
    teacherId: input.teacherId ?? null,
    type: input.type,
    title: input.title,
    body: [
      input.itemLabel,
      `Previous record: ${input.previousLabel}`,
      `Corrected record: ${input.correctedLabel}`,
      "The earlier update was entered by mistake and has now been corrected by the school.",
      "Approved by admin",
      input.reason ? `Correction reason: ${input.reason}` : null,
      input.reviewNote ? `Admin note: ${input.reviewNote}` : null,
    ].filter(Boolean).join("\n"),
    href: input.href ?? "/parent/updates",
    sourceModel: input.sourceModel,
    sourceId: input.sourceId,
    sourceKey: `${input.sourceKey}:approved-correction:${occurredAt.getTime()}`,
    occurredAt,
    payload: {
      ...(input.payload ?? {}),
      correctionApproved: true,
      previousLabel: input.previousLabel,
      correctedLabel: input.correctedLabel,
      reason: input.reason ?? null,
      reviewNote: input.reviewNote ?? null,
    },
  });
}
