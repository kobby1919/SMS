import { NextRequest, NextResponse } from "next/server";
import { runDueParentDailySummaries } from "@/src/lib/services/parent-notification-delivery";

export async function POST(req: NextRequest) {
  const secret = process.env.PARENT_SUMMARY_WORKER_SECRET;
  const authorization = req.headers.get("authorization");
  const providedSecret = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : req.headers.get("x-parent-summary-worker-secret");

  if (!secret) {
    return NextResponse.json(
      { error: "Parent summary worker secret is not configured." },
      { status: 503 },
    );
  }

  if (!providedSecret || providedSecret !== secret) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const results = await runDueParentDailySummaries();

  return NextResponse.json({
    processedSchools: results.length,
    results,
  });
}
