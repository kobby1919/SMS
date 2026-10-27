"use server";

import { z } from "zod";
import { requireRole } from "@/src/lib/authz";
import prisma from "@/src/lib/prisma";
import { enforceActionRateLimit } from "@/src/lib/rate-limit";
import { inspectNeonBackupCatalog, NeonBackupCheckError } from "@/src/lib/services/neon-backup-check";

export async function checkNeonBackupCatalog(targetSchoolId: string) {
  const { userId } = await requireRole(["platform_admin"]);
  try {
    const schoolId = z.string().trim().min(1).max(200).parse(targetSchoolId);
    await enforceActionRateLimit({ key: `migration:backup-check:${userId}`, limit: 5, windowMs: 60000 });
    const school = await prisma.school.findUnique({ where: { id: schoolId }, select: { id: true } });
    if (!school) return { ok: false as const, error: "School not found." };
    const catalog = await inspectNeonBackupCatalog();
    return { ok: true as const, catalog };
  } catch (error) {
    return { ok: false as const, error: error instanceof NeonBackupCheckError ? error.message : "Unable to check backups. Retry later. No recovery readiness was changed." };
  }
}
