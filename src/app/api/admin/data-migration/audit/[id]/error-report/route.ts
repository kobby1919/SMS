import { NextResponse } from "next/server";

import { requireRole, unauthorizedResponse } from "@/src/lib/authz";
import { buildMigrationErrorReportCsv } from "@/src/lib/services/data-migration-audit";

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { schoolId } = await requireRole(["admin"]);
    const { id } = await context.params;
    const auditLogId = Number(id);

    if (!Number.isSafeInteger(auditLogId) || auditLogId <= 0) {
      return NextResponse.json({ error: "Invalid import audit record." }, { status: 400 });
    }

    const csv = await buildMigrationErrorReportCsv({ schoolId, auditLogId });
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="edujay-import-${auditLogId}-errors.csv"`,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("not found")) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    return unauthorizedResponse(error);
  }
}
