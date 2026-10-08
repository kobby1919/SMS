import "server-only";
import prisma from "@/src/lib/prisma";
import type { Prisma, TeacherAccountabilityAuditAction, TeacherObligationStatus } from "@/src/generated/prisma";

export async function accountabilityTransaction<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await prisma.$transaction(work, { isolationLevel: "Serializable" });
    } catch (error) {
      if (attempt >= 2 || !error || typeof error !== "object" || !("code" in error) || error.code !== "P2034") throw error;
    }
  }
}

const actions: Partial<Record<TeacherObligationStatus, TeacherAccountabilityAuditAction>> = {
  COMPLETED: "OBLIGATION_COMPLETED", COMPLETED_LATE: "OBLIGATION_COMPLETED_LATE",
  MISSED: "OBLIGATION_MISSED", ESCALATED: "OBLIGATION_ESCALATED", CANCELLED: "OBLIGATION_CANCELLED",
};

export async function claimTeacherCorrectionReview(tx: Prisma.TransactionClient, input: {
  id: string; schoolId: string; teacherId: string; action: "APPROVE" | "REJECT"; reviewerId: string; at: Date; note: string | null;
}) {
  const claim = await tx.teacherCorrectionRequest.updateMany({
    where: { id: input.id, schoolId: input.schoolId, teacherId: input.teacherId, status: "PENDING" },
    data: { status: input.action === "APPROVE" ? "APPROVED" : "REJECTED", reviewedBy: input.reviewerId, reviewedAt: input.at, reviewNote: input.note },
  });
  if (claim.count !== 1) throw new Error("This correction has already changed. Refresh before reviewing it again.");
}

// Synchronizers cannot undo a completed duty or an administrator's closed review.
export async function saveTeacherObligation(data: Prisma.TeacherObligationUncheckedCreateInput) {
  return accountabilityTransaction(async (tx) => {
    const teacher = await tx.teacher.findFirst({ where: { id: data.teacherId, schoolId: data.schoolId, status: "ACTIVE" }, select: { id: true } });
    if (!teacher) return null;
    const key = { schoolId_teacherId_sourceKey: { schoolId: data.schoolId, teacherId: data.teacherId, sourceKey: data.sourceKey } };
    const created = await tx.teacherObligation.createMany({ data: [data], skipDuplicates: true });
    const existing = await tx.teacherObligation.findUniqueOrThrow({ where: key });
    if (created.count) {
      await tx.teacherAccountabilityAuditLog.create({ data: {
        schoolId: data.schoolId, teacherId: data.teacherId, action: "OBLIGATION_CREATED", actorRole: "SYSTEM",
        sourceModel: "TeacherObligation", sourceId: existing.id,
        after: { status: existing.status, sourceModel: existing.sourceModel, sourceId: existing.sourceId },
        message: `${existing.title} accountability obligation created.`,
      } });
      return existing;
    }
    if (existing.completedAt || ["COMPLETED", "COMPLETED_LATE", "CANCELLED"].includes(existing.status)) return existing;
    const closed = await tx.teacherEscalation.findFirst({ where: { schoolId: data.schoolId, obligationId: existing.id, status: { in: ["RESOLVED", "DISMISSED"] } }, select: { id: true } });
    if (closed) return existing;
    const status = existing.status === "ESCALATED" && !["COMPLETED", "COMPLETED_LATE", "CANCELLED"].includes(data.status ?? "PENDING") ? "ESCALATED" : data.status ?? "PENDING";
    const updated = await tx.teacherObligation.update({ where: { id: existing.id }, data: {
      status, priority: status === "ESCALATED" ? "HIGH" : data.priority,
      title: data.title, description: data.description, expectedAt: data.expectedAt,
      completedAt: data.completedAt, metadata: data.metadata,
    } });
    if (status !== "PENDING" || existing.expectedAt.getTime() !== updated.expectedAt.getTime()) {
      await tx.teacherReminder.updateMany({ where: { schoolId: data.schoolId, obligationId: existing.id, status: "PENDING" }, data: { status: "SKIPPED", errorMessage: "Superseded by duty completion, review or schedule change." } });
    }
    const action = actions[status];
    if (action && status !== existing.status) await tx.teacherAccountabilityAuditLog.create({ data: {
      schoolId: data.schoolId, teacherId: data.teacherId, action, actorRole: "SYSTEM",
      sourceModel: "TeacherObligation", sourceId: existing.id,
      before: { status: existing.status }, after: { status, completedAt: updated.completedAt?.toISOString() ?? null },
      message: `${data.title} changed from ${existing.status} to ${status}.`,
    } });
    return updated;
  });
}
