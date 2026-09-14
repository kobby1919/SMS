import { NextRequest, NextResponse } from "next/server";
import { requireRole, unauthorizedResponse } from "@/src/lib/authz";
import { enforceRateLimit } from "@/src/lib/rate-limit";
import { parseBody } from "@/src/lib/validation/parse";
import { timetablePublishSchema } from "@/src/lib/validation/timetable";
import {
  publishTimetableDraft,
  TimetableServiceError,
} from "@/src/lib/services/timetable";

function publishErrorResponse(error: unknown) {
  if (error instanceof TimetableServiceError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  return unauthorizedResponse(error);
}

export async function POST(req: NextRequest) {
  try {
    const { userId, schoolId } = await requireRole(["admin"]);
    const limited = await enforceRateLimit(req, {
      scope: "timetable:publish",
      actorId: userId,
      limit: 6,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const parsed = parseBody(timetablePublishSchema, await req.json());
    if (!parsed.ok) return parsed.response;

    const publication = await publishTimetableDraft(
      schoolId,
      userId,
      parsed.data.reason,
    );

    return NextResponse.json(publication, { status: 201 });
  } catch (error) {
    return publishErrorResponse(error);
  }
}
