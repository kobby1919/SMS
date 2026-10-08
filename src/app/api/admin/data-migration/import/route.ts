import { NextRequest, NextResponse } from "next/server";

import { Prisma } from "@/src/generated/prisma";
import { requireRole, unauthorizedResponse } from "@/src/lib/authz";
import {
  importValidatedMigrationRows,
  MigrationImportError,
} from "@/src/lib/services/data-migration-import";
import { stagedImportSchema, MigrationStagingError } from "@/src/lib/migration/staging";
import { readMigrationJson } from "@/src/lib/migration/request-body";
import { enforceActionRateLimit, RateLimitExceededError } from "@/src/lib/rate-limit";
import { z } from "zod";
import { BillDiscountError } from "@/src/lib/services/bill-discounts";

const MAX_IMPORT_PAYLOAD_BYTES = 1024;

export async function POST(req: NextRequest) {
  try {
    const { schoolId, userId } = await requireRole(["admin"]);
    await enforceActionRateLimit({ key: `migration:import:${schoolId}:${userId}`, limit: 10, windowMs: 60000 });
    const json = await readMigrationJson(req, MAX_IMPORT_PAYLOAD_BYTES);
    const parsed = stagedImportSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid migration import payload.", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const result = await importValidatedMigrationRows({
      schoolId,
      actorId: userId,
      uploadId: parsed.data.uploadId,
    });

    return NextResponse.json(result, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof MigrationStagingError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof z.ZodError) return NextResponse.json({ error: "The staged file is invalid. Upload and validate it again." }, { status: 400 });
    if (error instanceof RateLimitExceededError) return NextResponse.json({ error: error.message }, { status: 429 });
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
    }
    if (error instanceof MigrationImportError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof BillDiscountError) return NextResponse.json({ error: error.message }, { status: 400 });
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
      return NextResponse.json({ error: "School records or the saved upload changed during import. Nothing was saved. Review the upload and retry." }, { status: 409 });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json(
        { error: "Import conflict detected. Validate again and resolve duplicate records before importing." },
        { status: 409 },
      );
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return NextResponse.json(
        { error: "Import references missing or mismatched records. Validate again before importing." },
        { status: 409 },
      );
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json(
        { error: "Import data changed after validation. Validate again before importing." },
        { status: 409 },
      );
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2028") {
      return NextResponse.json(
        { error: "Import took too long to complete safely. Split the file into smaller batches and try again." },
        { status: 408 },
      );
    }
    return unauthorizedResponse(error);
  }
}
