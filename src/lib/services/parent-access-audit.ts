import type { ParentAccessAuditAction, Prisma } from "@/src/generated/prisma";

type ParentAccessAuditDelegate = {
  parentAccessAuditLog: {
    create(args: Prisma.ParentAccessAuditLogCreateArgs): Promise<unknown>;
  };
};

export type ParentAccessAuditInput = {
  schoolId: string;
  action: ParentAccessAuditAction;
  performedBy: string;
  parentId?: string | null;
  studentId?: string | null;
  inviteId?: string | null;
  relationshipId?: string | null;
  metadata?: Record<string, unknown>;
};

export async function writeParentAccessAudit(
  db: ParentAccessAuditDelegate,
  input: ParentAccessAuditInput,
) {
  await db.parentAccessAuditLog.create({
    data: {
      schoolId: input.schoolId,
      action: input.action,
      performedBy: input.performedBy,
      parentId: input.parentId ?? null,
      studentId: input.studentId ?? null,
      inviteId: input.inviteId ?? null,
      relationshipId: input.relationshipId ?? null,
      metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
    },
  });
}
