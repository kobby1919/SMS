// src/app/api/attendance/route.ts

import { NextRequest, NextResponse } from "next/server";
import { AuthorizationError, requireRole, unauthorizedResponse } from "@/src/lib/authz";
import { getLiveTimetableLessonBySourceId } from "@/src/lib/services/timetable";
import {
  attendanceGetQuerySchema,
  attendanceSubmitSchema,
} from "@/src/lib/validation/attendance";
import { parseBody, parseSearchParams } from "@/src/lib/validation/parse";
import { enforceRateLimit } from "@/src/lib/rate-limit";
import { revalidateDashboard } from "@/src/lib/cacheTags";
import { assertWithinSchoolOperatingHours } from "@/src/lib/services/school-operating-hours";
import {
  AttendanceSubmissionLockedError,
  getAttendanceRecords,
  saveAttendance,
} from "@/src/lib/services/attendance";

export async function GET(req: NextRequest) {
  try {
    const { userId, role, schoolId } = await requireRole(["admin", "teacher"]);
    const limited = await enforceRateLimit(req, {
      scope: "attendance:read",
      actorId: userId,
      limit: 120,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const parsed = parseSearchParams(attendanceGetQuerySchema, new URL(req.url).searchParams);
    if (!parsed.ok) return parsed.response;
    if (role === "teacher") {
      const lesson = await getLiveTimetableLessonBySourceId(schoolId, parsed.data.lessonId);
      if (!lesson || lesson.teacherId !== userId) throw new AuthorizationError("This lesson is outside your published teaching scope.");
    }

    const records = await getAttendanceRecords({
      schoolId,
      lessonId: parsed.data.lessonId,
      date: new Date(parsed.data.date),
    });

    return NextResponse.json(records);
  } catch (error) {
    return unauthorizedResponse(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId, role, schoolId } = await requireRole(["teacher"]);
    const limited = await enforceRateLimit(req, {
      scope: "attendance:submit",
      actorId: userId,
      limit: 30,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const body = await req.json();
    const parsed = parseBody(attendanceSubmitSchema, body);
    if (!parsed.ok) return parsed.response;

    if (role === "teacher") {
      await assertWithinSchoolOperatingHours(schoolId, "Submitting attendance");
    }

    const saved = await saveAttendance({
      schoolId,
      lessonId: parsed.data.lessonId,
      date: new Date(parsed.data.date),
      records: parsed.data.records,
      actorId: userId,
      actorRole: role ?? "teacher",
    });

    revalidateDashboard(schoolId);
    return NextResponse.json({ saved }, { status: 201 });
  } catch (error) {
    if (error instanceof AttendanceSubmissionLockedError) {
      return NextResponse.json(
        { error: error.message, code: "ATTENDANCE_LOCKED" },
        { status: 409 },
      );
    }
    return unauthorizedResponse(error);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { userId } = await requireRole(["admin"]);
    const limited = await enforceRateLimit(req, {
      scope: "attendance:delete",
      actorId: userId,
      limit: 20,
      windowMs: 60_000,
    });
    if (limited) return limited;

    return NextResponse.json({ error: "Attendance history cannot be deleted. Review a correction request instead." }, { status: 405 });
  } catch (error) {
    return unauthorizedResponse(error);
  }
}
