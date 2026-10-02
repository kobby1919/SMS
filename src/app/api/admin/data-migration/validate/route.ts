import { NextRequest, NextResponse } from "next/server";

import { requireRole, unauthorizedResponse } from "@/src/lib/authz";
import { validateMigrationRows } from "@/src/lib/services/data-migration-validation";
import { migrationValidationPayloadSchema } from "@/src/lib/validation/data-migration";

const MAX_VALIDATION_PAYLOAD_BYTES = 1_500_000;

export async function POST(req: NextRequest) {
  try {
    const { schoolId } = await requireRole(["admin"]);
    const contentLength = Number(req.headers.get("content-length") ?? "0");

    if (Number.isFinite(contentLength) && contentLength > MAX_VALIDATION_PAYLOAD_BYTES) {
      return NextResponse.json(
        { error: "Validation file is too large. Split the spreadsheet before validation." },
        { status: 413 },
      );
    }

    const json = await req.json();
    const parsed = migrationValidationPayloadSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid migration validation payload.", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const result = await validateMigrationRows({
      schoolId,
      areaKey: parsed.data.areaKey,
      headers: parsed.data.headers,
      mapping: parsed.data.mapping,
      rows: parsed.data.rows,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
    }
    return unauthorizedResponse(error);
  }
}
