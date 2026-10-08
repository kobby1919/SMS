"use server";
import { z } from "zod";
import { requireRole } from "@/src/lib/authz";
import { enforceActionRateLimit } from "@/src/lib/rate-limit";
import { approveMigrationReconciliation, MigrationReconciliationError } from "@/src/lib/services/migration-reconciliation";

export async function approveSchoolMigration(raw: unknown) {
  const { schoolId, userId } = await requireRole(["admin"]);
  try {
    await enforceActionRateLimit({ key: `migration:approval:${schoolId}:${userId}`, limit: 10, windowMs: 60000 });
    const approval = await approveMigrationReconciliation(schoolId, userId, raw);
    return { ok: true as const, approval };
  } catch (error) {
    if (error instanceof z.ZodError) return { ok: false as const, error: error.issues[0]?.message ?? "Confirm the review fields." };
    if (error instanceof MigrationReconciliationError) return { ok: false as const, error: error.message };
    console.error("Migration approval failed", { schoolId, code: error && typeof error === "object" && "code" in error ? error.code : "UNKNOWN" });
    return { ok: false as const, error: "Unable to record approval. Refresh and try again shortly." };
  }
}
