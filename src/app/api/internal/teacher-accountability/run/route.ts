import { NextRequest, NextResponse } from "next/server";
import { runTeacherAccountabilityWorker } from "@/src/lib/services/teacher-accountability";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const secret =
    process.env.TEACHER_ACCOUNTABILITY_WORKER_SECRET ??
    process.env.PARENT_SUMMARY_WORKER_SECRET;
  const authorization = req.headers.get("authorization");
  const providedSecret = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : req.headers.get("x-teacher-accountability-worker-secret");

  if (!secret) {
    return NextResponse.json(
      { error: "Teacher accountability worker secret is not configured." },
      { status: 503 },
    );
  }

  if (!providedSecret || providedSecret !== secret) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const schoolId = searchParams.get("schoolId") ?? undefined;
  const limitParam = searchParams.get("limit");
  const limit = limitParam ? Number(limitParam) : 200;

  if (!Number.isInteger(limit) || limit < 1 || limit > 1000) {
    return NextResponse.json(
      { error: "limit must be an integer between 1 and 1000." },
      { status: 400 },
    );
  }

  try {
    const result = await runTeacherAccountabilityWorker({ schoolId, limit });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Teacher accountability worker failed", error);
    return NextResponse.json(
      { error: "Teacher accountability worker failed." },
      { status: 500 },
    );
  }
}
