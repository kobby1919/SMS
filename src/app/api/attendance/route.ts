// src/app/api/attendance/route.ts

import { NextRequest, NextResponse } from "next/server";
import { requireRole, unauthorizedResponse } from "@/src/lib/authz";
import {
  attendanceDeleteQuerySchema,
  attendanceGetQuerySchema,
  attendanceSubmitSchema,
} from "@/src/lib/validation/attendance";
import { parseBody, parseSearchParams } from "@/src/lib/validation/parse";
import { enforceRateLimit } from "@/src/lib/rate-limit";
import { revalidateDashboard } from "@/src/lib/cacheTags";
import {
  deleteAttendanceRecord,
  getAttendanceRecords,
  saveAttendance,
} from "@/src/lib/services/attendance";

export async function GET(req: NextRequest) {
  try {
    const { userId, schoolId } = await requireRole(["admin", "teacher"]);
    const limited = await enforceRateLimit(req, {
      scope: "attendance:read",
      actorId: userId,
      limit: 120,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const parsed = parseSearchParams(attendanceGetQuerySchema, new URL(req.url).searchParams);
    if (!parsed.ok) return parsed.response;

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
    const { userId, role, schoolId } = await requireRole(["admin", "teacher"]);
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
    return unauthorizedResponse(error);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { userId, schoolId } = await requireRole(["admin"]);
    const limited = await enforceRateLimit(req, {
      scope: "attendance:delete",
      actorId: userId,
      limit: 20,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const parsed = parseSearchParams(attendanceDeleteQuerySchema, new URL(req.url).searchParams);
    if (!parsed.ok) return parsed.response;

    await deleteAttendanceRecord({ id: parsed.data.id, schoolId });
    revalidateDashboard(schoolId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return unauthorizedResponse(error);
  }
}
