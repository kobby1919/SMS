import { NextRequest, NextResponse } from "next/server";
import { runNextFinanceJob } from "@/src/lib/services/finance-job-runner";
import * as Sentry from "@sentry/nextjs";

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  // Both Vercel projects share this code; scheduled processing is opt-in.
  if (process.env.FINANCE_SCHEDULE_ENABLED !== "true") {
    return NextResponse.json({ skipped: true }, {
      headers: { "Cache-Control": "no-store" },
    });
  }

  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Finance cron secret is not configured." }, { status: 503 });
  }
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const deadline = Date.now() + 30_000;
  let completed = 0;
  let failed = 0;
  for (let attempt = 0; attempt < 5 && Date.now() < deadline; attempt += 1) {
    try {
      const result = await runNextFinanceJob(`cron-worker:${crypto.randomUUID()}`);
      if (!result) break;
      completed += 1;
    } catch (error) {
      // The queue retains retry details. Never expose provider errors or secrets.
      failed += 1;
      Sentry.captureException(error, { tags: { component: "finance-cron" } });
      console.error("Scheduled finance job failed; inspect the finance queue securely.");
    }
  }

  return NextResponse.json({ completed, failed }, {
    status: failed ? 500 : 200,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(req: NextRequest) {
  const secret = process.env.FINANCE_WORKER_SECRET;
  const authorization = req.headers.get("authorization");
  const providedSecret = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : req.headers.get("x-finance-worker-secret");

  if (!secret) {
    return NextResponse.json(
      { error: "Finance worker secret is not configured." },
      { status: 503 },
    );
  }

  if (!providedSecret || providedSecret !== secret) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const result = await runNextFinanceJob(`api-worker:${crypto.randomUUID()}`);

  return NextResponse.json({
    processed: Boolean(result),
    result,
  });
}
