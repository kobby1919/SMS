import { NextRequest, NextResponse } from "next/server";
import {
  runDueParentDailySummaries,
  runDueParentWeeklySummaries,
} from "@/src/lib/services/parent-notification-delivery";

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

  const force = req.nextUrl.searchParams.get("force") === "true";
  const periodParam = req.nextUrl.searchParams.get("period");
  const now = new Date();

  if (periodParam === "daily") {
    const results = await runDueParentDailySummaries(now, { force });
    return NextResponse.json({
      force,
      period: "daily",
      processedSchools: results.length,
      results,
    });
  }

  if (periodParam === "weekly") {
    const results = await runDueParentWeeklySummaries(now, { force });
    return NextResponse.json({
      force,
      period: "weekly",
      processedSchools: results.length,
      results,
    });
  }

  const [dailyResults, weeklyResults] = await Promise.all([
    runDueParentDailySummaries(now, { force }),
    runDueParentWeeklySummaries(now, { force }),
  ]);
  const results = [...dailyResults, ...weeklyResults];

  return NextResponse.json({
    force,
    period: "auto",
    processedSchools: results.length,
    results,
  });
}
