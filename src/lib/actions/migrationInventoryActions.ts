"use server";
import { requireRole } from "@/src/lib/authz";
import { enforceActionRateLimit } from "@/src/lib/rate-limit";
import { saveMigrationInventory } from "@/src/lib/services/migration-inventory";
import { revalidateDashboard } from "@/src/lib/cacheTags";

export async function updateMigrationInventory(raw: unknown) {
  const { schoolId, userId } = await requireRole(["admin"]);
  await enforceActionRateLimit({ key: `migration:inventory:${schoolId}:${userId}`, limit: 30, windowMs: 60000 });
  const result = await saveMigrationInventory(schoolId, userId, raw);
  revalidateDashboard(schoolId);
  return result;
}
