import { NextRequest, NextResponse } from "next/server";
import { runNotificationDeliveryWorker } from "@/src/lib/services/notification-job-runner";

function providedSecret(req: NextRequest) {
  const authorization = req.headers.get("authorization");
  if (authorization?.startsWith("Bearer ")) return authorization.slice("Bearer ".length).trim();
  return req.headers.get("x-notification-worker-secret");
}

function positiveNumber(value: string | null) {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

export async function POST(req: NextRequest) {
  const secret = process.env.NOTIFICATION_WORKER_SECRET;

  if (!secret) {
    return NextResponse.json(
      { error: "Notification worker secret is not configured." },
      { status: 503 },
    );
  }

  if (providedSecret(req) !== secret) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const url = new URL(req.url);
  const result = await runNotificationDeliveryWorker({
    schoolId: url.searchParams.get("schoolId") ?? undefined,
    limit: positiveNumber(url.searchParams.get("limit")),
    schoolLimit: positiveNumber(url.searchParams.get("schoolLimit")),
  });

  return NextResponse.json({
    processed: result.processedDeliveries > 0,
    ...result,
  });
}