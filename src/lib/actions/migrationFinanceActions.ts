"use server";

import { Prisma } from "@/src/generated/prisma";
import prisma from "@/src/lib/prisma";
import { requireRole } from "@/src/lib/authz";
import { enforceActionRateLimit } from "@/src/lib/rate-limit";
import { assertCanPublishFeeStructure } from "@/src/lib/services/finance-policy";
import { z } from "zod";
import { revalidateDashboard } from "@/src/lib/cacheTags";

export async function getMigrationFinanceStructures() {
  const { schoolId } = await requireRole(["admin"]);
  const rows = await prisma.feeStructure.findMany({ where: { schoolId }, include: { grade: { select: { level: true } }, feeItems: { orderBy: { name: "asc" } } }, orderBy: { updatedAt: "desc" }, take: 100 });
  return rows.map((row) => ({ id: row.id, title: row.title, grade: row.grade.level, term: row.term, academicYear: row.academicYear, status: row.status, dueDate: row.dueDate?.toISOString().slice(0, 10) ?? null, items: row.feeItems.map((item) => ({ id: item.id, name: item.name, amount: item.amount.toFixed(2), category: item.category, frequency: item.billingFrequency, optional: item.isOptional })) }));
}

export async function publishMigrationFeeStructure(rawId: unknown) {
  const id = z.number().int().positive().parse(rawId);
  const { schoolId, userId } = await requireRole(["admin"]);
  await enforceActionRateLimit({ key: `migration:publish-fees:${schoolId}:${userId}`, limit: 20, windowMs: 60_000 });
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "FeeStructure" WHERE "id" = ${id} AND "schoolId" = ${schoolId} FOR UPDATE`;
    const structure = await tx.feeStructure.findFirst({ where: { id, schoolId }, include: { feeItems: true, _count: { select: { bills: true } } } });
    if (!structure) throw new Error("Fee structure not found.");
    if (structure.status === "PUBLISHED") return;
    if (structure._count.bills > 0) throw new Error("Review this already-billed structure before publication.");
    if (!structure.dueDate) throw new Error("Set a due date before publication.");
    assertCanPublishFeeStructure({ status: structure.status, feeItemCount: structure.feeItems.length, mandatoryFeeItemCount: structure.feeItems.filter((item) => !item.isOptional && item.billingFrequency !== "DAILY").length });
    if (structure.feeItems.some((item) => item.billingFrequency === "DAILY")) throw new Error("Daily items belong in daily collection setup.");
    await tx.feeStructure.update({ where: { id }, data: { status: "PUBLISHED", publishedAt: new Date() } });
    await tx.financeAuditLog.create({ data: { schoolId, action: "FEE_STRUCTURE_PUBLISHED", performedBy: userId, entityType: "FeeStructure", entityId: String(id), metadata: { source: "MIGRATION_REVIEW", title: structure.title, feeItems: structure.feeItems.map((item) => ({ name: item.name, amount: item.amount.toFixed(2), category: item.category, frequency: item.billingFrequency, optional: item.isOptional })), dueDate: structure.dueDate.toISOString() } } });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  revalidateDashboard(schoolId);
}
