import { NextRequest, NextResponse } from "next/server";
import { runNextFinanceJob } from "@/src/lib/services/finance-job-runner";

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
