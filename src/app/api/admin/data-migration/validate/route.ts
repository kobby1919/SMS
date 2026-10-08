import { NextRequest, NextResponse } from "next/server";

import { requireRole, unauthorizedResponse } from "@/src/lib/authz";
import { stageMigrationUpload, purgeExpiredMigrationUploads } from "@/src/lib/services/migration-staging";
import { readMigrationJson } from "@/src/lib/migration/request-body";
import { MigrationStagingError } from "@/src/lib/migration/staging";
import { enforceActionRateLimit, RateLimitExceededError } from "@/src/lib/rate-limit";
import { z } from "zod";
import { MigrationStorageConfigurationError } from "@/src/lib/services/migration-staging-storage";

const MAX_VALIDATION_PAYLOAD_BYTES = 2_500_000;

export async function POST(req: NextRequest) {
  try {
    const { schoolId, userId } = await requireRole(["admin"]);
    await enforceActionRateLimit({ key: `migration:stage:${schoolId}:${userId}`, limit: 15, windowMs: 60000 });
    const json = await readMigrationJson(req, MAX_VALIDATION_PAYLOAD_BYTES);
    await purgeExpiredMigrationUploads(schoolId, userId);
    const result = await stageMigrationUpload(schoolId, userId, json);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof MigrationStorageConfigurationError) return NextResponse.json({ error: error.message }, { status: 503 });
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid upload." }, { status: 400 });
    if (error instanceof MigrationStagingError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof RateLimitExceededError) return NextResponse.json({ error: error.message }, { status: 429 });
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
    }
    return unauthorizedResponse(error);
  }
}
