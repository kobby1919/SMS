import { NextRequest, NextResponse } from "next/server";
import { requireRole, unauthorizedResponse } from "@/src/lib/authz";
import {
  timetableDeleteQuerySchema,
  timetableGetQuerySchema,
  timetableLessonSchema,
  timetableUpdateSchema,
} from "@/src/lib/validation/timetable";
import { parseBody, parseSearchParams } from "@/src/lib/validation/parse";
import { enforceRateLimit } from "@/src/lib/rate-limit";
import {
  createTimetableLesson,
  deleteTimetableLesson,
  listTimetableLessons,
  TimetableServiceError,
  updateTimetableLesson,
} from "@/src/lib/services/timetable";

function timetableErrorResponse(error: unknown) {
  if (error instanceof TimetableServiceError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  return unauthorizedResponse(error);
}
export async function GET(req: NextRequest) {
  try {
    const { userId, schoolId } = await requireRole(["admin"]);
    const limited = await enforceRateLimit(req, {
      scope: "timetable:read",
      actorId: userId,
      limit: 120,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const parsed = parseSearchParams(timetableGetQuerySchema, req.nextUrl.searchParams);
    if (!parsed.ok) return parsed.response;
    return NextResponse.json(
      await listTimetableLessons(schoolId, parsed.data.classId),
    );
  } catch (error) {
    return timetableErrorResponse(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId, schoolId } = await requireRole(["admin"]);
    const limited = await enforceRateLimit(req, {
      scope: "timetable:create",
      actorId: userId,
      limit: 30,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const parsed = parseBody(timetableLessonSchema, await req.json());
    if (!parsed.ok) return parsed.response;
    const lesson = await createTimetableLesson(schoolId, parsed.data);
    return NextResponse.json(lesson, { status: 201 });
  } catch (error) {
    return timetableErrorResponse(error);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { userId, schoolId } = await requireRole(["admin"]);
    const limited = await enforceRateLimit(req, {
      scope: "timetable:update",
      actorId: userId,
      limit: 30,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const parsed = parseBody(timetableUpdateSchema, await req.json());
    if (!parsed.ok) return parsed.response;
    const { id, ...input } = parsed.data;
    return NextResponse.json(await updateTimetableLesson(schoolId, id, input));
  } catch (error) {
    return timetableErrorResponse(error);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { userId, schoolId } = await requireRole(["admin"]);
    const limited = await enforceRateLimit(req, {
      scope: "timetable:delete",
      actorId: userId,
      limit: 20,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const parsed = parseSearchParams(timetableDeleteQuerySchema, req.nextUrl.searchParams);
    if (!parsed.ok) return parsed.response;
    await deleteTimetableLesson(schoolId, parsed.data.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return timetableErrorResponse(error);
  }
}
