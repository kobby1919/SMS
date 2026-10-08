import "server-only";
import prisma from "@/src/lib/prisma";
import { Prisma } from "@/src/generated/prisma";
import { inventorySchema } from "@/src/lib/migration/inventory";

export async function getMigrationInventory(schoolId: string, db: Pick<Prisma.TransactionClient, "onboardingAuditLog"> = prisma) {
  const record = await db.onboardingAuditLog.findFirst({ where: { schoolId, action: "MIGRATION_INVENTORY_RECORDED" }, orderBy: { id: "desc" } });
  return record ? inventorySchema.parse(record.metadata) : null;
}

export async function saveMigrationInventory(schoolId: string, actorId: string, raw: unknown) {
  const input = inventorySchema.parse(raw);
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${schoolId}), hashtext('migration-inventory'))`;
    const current = await getMigrationInventory(schoolId, tx);
    if (input.version !== (current?.version ?? 0)) throw new Error("The inventory changed. Refresh before saving.");
    if (current?.status === "CONFIRMED" && input.status !== "DRAFT") throw new Error("Reopen the inventory before changing the agreed scope.");
    const next = { ...input, version: input.version + 1 };
    await tx.onboardingAuditLog.create({ data: { schoolId, performedBy: actorId, action: "MIGRATION_INVENTORY_RECORDED", metadata: next } });
    return next;
  });
}
