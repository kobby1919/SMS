import "server-only";
import prisma from "@/src/lib/prisma";
import { Prisma } from "@/src/generated/prisma";
import { inventoryRecordSchema, inventorySchema } from "@/src/lib/migration/inventory";

export class MigrationInventoryConflict extends Error {}

export async function getMigrationInventory(schoolId: string, db: Pick<Prisma.TransactionClient, "onboardingAuditLog"> = prisma) {
  const record = await db.onboardingAuditLog.findFirst({ where: { schoolId, action: "MIGRATION_INVENTORY_RECORDED" }, orderBy: { id: "desc" } });
  // Older agreements remain readable so admins can revise them under newer rules.
  return record ? inventoryRecordSchema.parse(record.metadata) : null;
}

export async function saveMigrationInventory(schoolId: string, actorId: string, raw: unknown) {
  const input = inventorySchema.parse(raw);
  return prisma.$transaction(async (tx) => {
    // Updating the shared row invalidates older serializable import snapshots.
    const school = await tx.$queryRaw<Array<{ id: string }>>`UPDATE "School" SET "updatedAt" = clock_timestamp() WHERE "id" = ${schoolId} RETURNING "id"`;
    if (school.length !== 1) throw new MigrationInventoryConflict("School not found.");
    const current = await getMigrationInventory(schoolId, tx);
    if (input.version !== (current?.version ?? 0)) throw new MigrationInventoryConflict("The inventory changed. Refresh before saving.");
    if (current?.status === "CONFIRMED" && input.status !== "DRAFT") throw new MigrationInventoryConflict("Reopen the inventory before changing the agreed scope.");
    const next = { ...input, acknowledged: input.status === "CONFIRMED" && input.acknowledged, version: input.version + 1 };
    await tx.onboardingAuditLog.create({ data: { schoolId, performedBy: actorId, action: "MIGRATION_INVENTORY_RECORDED", metadata: next } });
    return next;
  }, { maxWait: 15000, timeout: 20000 });
}
