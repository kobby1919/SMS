import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole, unauthorizedResponse } from "@/src/lib/authz";
import { loadStagedMigration, cancelStagedMigration } from "@/src/lib/services/migration-staging";
import { validateMigrationRows } from "@/src/lib/services/data-migration-validation";
import { readMigrationJson } from "@/src/lib/migration/request-body";
import { MigrationStagingError } from "@/src/lib/migration/staging";
import { enforceActionRateLimit, RateLimitExceededError } from "@/src/lib/rate-limit";

type Context = { params: Promise<{ id: string }> };
function failure(error: unknown) {
  if (error instanceof MigrationStagingError) return NextResponse.json({ error: error.message }, { status: error.status });
  if (error instanceof z.ZodError || error instanceof SyntaxError) return NextResponse.json({ error: "Invalid upload request." }, { status: 400 });
  if (error instanceof RateLimitExceededError) return NextResponse.json({ error: error.message }, { status: 429 });
  return unauthorizedResponse(error);
}
export async function GET(_req: NextRequest, context: Context) {
  try {
    const { schoolId, userId } = await requireRole(["admin"]);
    await enforceActionRateLimit({ key: `migration:resume:${schoolId}:${userId}`, limit: 30, windowMs: 60000 });
    const saved = await loadStagedMigration(schoolId, (await context.params).id);
    if (saved.upload.status !== "VALIDATED") throw new MigrationStagingError("This upload has already been imported.", 409);
    const validation = await validateMigrationRows({ schoolId, ...saved.payload });
    return NextResponse.json({ payload: saved.payload, validation: { ...validation, uploadId: saved.upload.id, expiresAt: saved.upload.expiresAt.toISOString(), checksum: saved.upload.checksum }, csv: saved.input.csv }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return failure(error); }
}
export async function DELETE(req: NextRequest, context: Context) {
  try {
    const { schoolId, userId } = await requireRole(["admin"]);
    await enforceActionRateLimit({ key: `migration:cancel:${schoolId}:${userId}`, limit: 20, windowMs: 60000 });
    await readMigrationJson(req, 100);
    await cancelStagedMigration(schoolId, userId, (await context.params).id);
    return NextResponse.json({ ok: true });
  } catch (error) { return failure(error); }
}
