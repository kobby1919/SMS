import { NextRequest, NextResponse } from "next/server";

import { Prisma } from "@/src/generated/prisma";
import { requireRole, unauthorizedResponse } from "@/src/lib/authz";
import {
  importValidatedMigrationRows,
  MigrationImportError,
} from "@/src/lib/services/data-migration-import";
import { migrationValidationPayloadSchema } from "@/src/lib/validation/data-migration";

const MAX_IMPORT_PAYLOAD_BYTES = 1_500_000;

export async function POST(req: NextRequest) {
  try {
    const { schoolId, userId } = await requireRole(["admin"]);
    const contentLength = Number(req.headers.get("content-length") ?? "0");

    if (Number.isFinite(contentLength) && contentLength > MAX_IMPORT_PAYLOAD_BYTES) {
      return NextResponse.json(
        { error: "Import file is too large. Split the spreadsheet before importing." },
        { status: 413 },
      );
    }

    const json = await req.json();
    const parsed = migrationValidationPayloadSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid migration import payload.", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const result = await importValidatedMigrationRows({
      schoolId,
      actorId: userId,
      areaKey: parsed.data.areaKey,
      fileName: parsed.data.fileName,
      headers: parsed.data.headers,
      mapping: parsed.data.mapping,
      rows: parsed.data.rows,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
    }
    if (error instanceof MigrationImportError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json(
        { error: "Import conflict detected. Validate again and resolve duplicate records before importing." },
        { status: 409 },
      );
    }
    return unauthorizedResponse(error);
  }
}
