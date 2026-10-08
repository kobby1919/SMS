import { NextRequest, NextResponse } from "next/server";
import { requireRole, unauthorizedResponse } from "@/src/lib/authz";
import { listStagedMigrationUploads, purgeExpiredMigrationUploads } from "@/src/lib/services/migration-staging";
import { readMigrationJson } from "@/src/lib/migration/request-body";
import { MigrationStagingError } from "@/src/lib/migration/staging";
import { enforceActionRateLimit, RateLimitExceededError } from "@/src/lib/rate-limit";

export async function GET() {
  try { const { schoolId } = await requireRole(["admin"]); return NextResponse.json(await listStagedMigrationUploads(schoolId), { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { return unauthorizedResponse(error); }
}
export async function POST(req: NextRequest) {
  try {
    const { schoolId, userId } = await requireRole(["admin"]);
    await enforceActionRateLimit({ key: `migration:purge:${schoolId}:${userId}`, limit: 10, windowMs: 60000 });
    await readMigrationJson(req, 100);
    await purgeExpiredMigrationUploads(schoolId, userId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof MigrationStagingError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof RateLimitExceededError) return NextResponse.json({ error: error.message }, { status: 429 });
    if (error instanceof SyntaxError) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    return unauthorizedResponse(error);
  }
}
