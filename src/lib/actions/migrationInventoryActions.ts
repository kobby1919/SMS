"use server";
import { requireRole } from "@/src/lib/authz";
import { enforceActionRateLimit } from "@/src/lib/rate-limit";
import { MigrationInventoryConflict, saveMigrationInventory } from "@/src/lib/services/migration-inventory";
import { revalidateDashboard } from "@/src/lib/cacheTags";
import { z } from "zod";

export async function updateMigrationInventory(raw: unknown) {
  const { schoolId, userId } = await requireRole(["admin"]);
  await enforceActionRateLimit({ key: `migration:inventory:${schoolId}:${userId}`, limit: 30, windowMs: 60000 });
  try {
    const value = await saveMigrationInventory(schoolId, userId, raw);
    revalidateDashboard(schoolId);
    return { ok: true as const, value };
  } catch (error) {
    if (error instanceof z.ZodError) return { ok: false as const, error: error.issues[0]?.message ?? "Check the inventory fields." };
    if (error instanceof MigrationInventoryConflict) return { ok: false as const, error: error.message };
    console.error("Migration inventory save failed", { schoolId, code: error && typeof error === "object" && "code" in error ? error.code : "UNKNOWN" });
    return { ok: false as const, error: "Unable to save the inventory. Refresh and try again." };
  }
}
