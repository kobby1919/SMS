"use server";
import { z } from "zod";
import { requireRole } from "@/src/lib/authz";
import { enforceActionRateLimit } from "@/src/lib/rate-limit";
import { MigrationRecoveryError, saveMigrationRecovery } from "@/src/lib/services/migration-recovery";

export async function recordMigrationRecovery(raw: unknown) {
  const { schoolId, userId } = await requireRole(["admin"]);
  try {
    await enforceActionRateLimit({ key: `migration:recovery:${schoolId}:${userId}`, limit: 10, windowMs: 60000 });
    const recovery = await saveMigrationRecovery(schoolId, userId, raw);
    return { ok: true as const, recovery };
  } catch (error) {
    if (error instanceof z.ZodError) return { ok: false as const, error: error.issues[0]?.message ?? "Check the recovery fields." };
    if (error instanceof MigrationRecoveryError) return { ok: false as const, error: error.message };
    console.error("Migration recovery save failed", { schoolId, code: error && typeof error === "object" && "code" in error ? error.code : "UNKNOWN" });
    return { ok: false as const, error: "Unable to save recovery controls. Refresh and try again." };
  }
}
