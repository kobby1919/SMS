import { NextResponse } from "next/server";
import { requireRole, unauthorizedResponse } from "@/src/lib/authz";
import { enforceActionRateLimit, RateLimitExceededError } from "@/src/lib/rate-limit";
import { getMigrationReconciliation, reconciliationCsv, MigrationReconciliationError } from "@/src/lib/services/migration-reconciliation";

export async function GET() {
  try {
    const { schoolId, userId } = await requireRole(["admin"]);
    await enforceActionRateLimit({ key: `migration:reconciliation-export:${schoolId}:${userId}`, limit: 10, windowMs: 60000 });
    const report = await getMigrationReconciliation(schoolId);
    return new NextResponse(reconciliationCsv(report), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="migration-reconciliation.csv"', "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
  } catch (error) {
    if (error instanceof MigrationReconciliationError) return NextResponse.json({ error: error.message }, { status: 409 });
    if (error instanceof RateLimitExceededError) return NextResponse.json({ error: error.message }, { status: 429 });
    return unauthorizedResponse(error);
  }
}
