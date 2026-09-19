import type { Prisma } from "@/src/generated/prisma";

type TeacherAdminAuditInput = {
  schoolId: string;
  teacherId: string;
  actorId?: string | null;
  actorRole?: string | null;
  sourceModel: string;
  sourceId: string;
  before?: Prisma.InputJsonValue;
  after?: Prisma.InputJsonValue;
  message: string;
};

export async function writeTeacherAdminAuditLog(
  tx: Prisma.TransactionClient,
  input: TeacherAdminAuditInput,
) {
  await tx.teacherAccountabilityAuditLog.create({
    data: {
      schoolId: input.schoolId,
      teacherId: input.teacherId,
      action: "SETTINGS_UPDATED",
      actorId: input.actorId ?? null,
      actorRole: input.actorRole ?? null,
      sourceModel: input.sourceModel,
      sourceId: input.sourceId,
      before: input.before,
      after: input.after,
      message: input.message,
    },
  });
}

export async function writeTeacherAdminAuditLogs(
  tx: Prisma.TransactionClient,
  inputs: TeacherAdminAuditInput[],
) {
  for (const input of inputs) {
    await writeTeacherAdminAuditLog(tx, input);
  }
}
