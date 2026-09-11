import { NextRequest, NextResponse } from "next/server";
import { runParentTeacherContactEscalationWorker } from "@/src/lib/services/parent-teacher-contact-escalations";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const secret =
    process.env.PARENT_CONTACT_WORKER_SECRET ??
    process.env.PARENT_SUMMARY_WORKER_SECRET;
  const authorization = req.headers.get("authorization");
  const providedSecret = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : req.headers.get("x-parent-contact-worker-secret");

  if (!secret) {
    return NextResponse.json(
      { error: "Parent contact worker secret is not configured." },
      { status: 503 },
    );
  }

  if (!providedSecret || providedSecret !== secret) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const schoolId = req.nextUrl.searchParams.get("schoolId") ?? undefined;
  const limitParam = req.nextUrl.searchParams.get("limit");
  const limit = limitParam ? Number(limitParam) : 100;

  if (!Number.isInteger(limit) || limit < 1 || limit > 500) {
    return NextResponse.json(
      { error: "limit must be an integer between 1 and 500." },
      { status: 400 },
    );
  }

  try {
    const result = await runParentTeacherContactEscalationWorker({
      schoolId,
      limit,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Parent contact worker failed", error);
    return NextResponse.json(
      { error: "Parent contact worker failed." },
      { status: 500 },
    );
  }
}
