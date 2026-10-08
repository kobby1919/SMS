import "server-only";
import prisma from "@/src/lib/prisma";
import { Prisma } from "@/src/generated/prisma";
import { getMigrationInventory } from "@/src/lib/services/migration-inventory";
import { recoveryInputSchema, recoveryBlockers, recoveryDatabaseReferenceSchema } from "@/src/lib/migration/recovery";

export class MigrationRecoveryError extends Error {}
type Db = Pick<Prisma.TransactionClient, "onboardingAuditLog">;

export function getRecoveryDatabaseReference() {
  const result = recoveryDatabaseReferenceSchema.safeParse(process.env.MIGRATION_RECOVERY_DATABASE_REFERENCE);
  return result.success ? result.data : null;
}

export async function getMigrationRecovery(schoolId: string, db: Db = prisma) {
  const log = await db.onboardingAuditLog.findFirst({ where: { schoolId, action: "MIGRATION_RECOVERY_RECORDED" }, orderBy: { id: "desc" } });
  if (!log) return null;
  const parsed = recoveryInputSchema.safeParse(log.metadata);
  if (!parsed.success) throw new MigrationRecoveryError("The recovery checkpoint is invalid. Arrange an audited recovery review.");
  return { logId: log.id, plan: parsed.data, recordedAt: log.createdAt.toISOString(), recordedBy: log.performedBy };
}

export async function requireMigrationRecovery(schoolId: string, inventoryVersion: number, tx: Db) {
  const current = await getMigrationRecovery(schoolId, tx);
  const blockers = recoveryBlockers(current?.plan ?? null, inventoryVersion, process.env.NODE_ENV === "production", new Date(), getRecoveryDatabaseReference());
  if (blockers.length) throw new MigrationRecoveryError(blockers[0]);
  return current;
}

export async function saveMigrationRecovery(schoolId: string, actorId: string, raw: unknown) {
  const input = recoveryInputSchema.parse(raw);
  return prisma.$transaction(async (tx) => {
    // Same school-row lock as inventory saves/imports: a hold cannot race a write.
    const school = await tx.$queryRaw<Array<{ id: string }>>`UPDATE "School" SET "updatedAt" = clock_timestamp() WHERE "id" = ${schoolId} RETURNING "id"`;
    if (school.length !== 1) throw new MigrationRecoveryError("School not found.");
    const inventory = await getMigrationInventory(schoolId, tx);
    if (!inventory || inventory.version !== input.inventoryVersion || (input.status === "READY" && inventory.status !== "CONFIRMED")) throw new MigrationRecoveryError("Review the current inventory and refresh before recording recovery controls.");
    const current = await getMigrationRecovery(schoolId, tx);
    if ((current?.plan.version ?? 0) !== input.version) throw new MigrationRecoveryError("The recovery plan changed. Refresh before saving.");
    if (input.status === "READY") {
      const blockers = recoveryBlockers(input, inventory.version, process.env.NODE_ENV === "production", new Date(), getRecoveryDatabaseReference());
      if (blockers.length) throw new MigrationRecoveryError(blockers[0]);
    }
    const plan = { ...input, version: input.version + 1 };
    const log = await tx.onboardingAuditLog.create({ data: { schoolId, performedBy: actorId, action: "MIGRATION_RECOVERY_RECORDED", metadata: plan } });
    return { logId: log.id, plan, recordedAt: log.createdAt.toISOString(), recordedBy: actorId };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 15000, timeout: 20000 });
}
