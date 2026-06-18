// src/app/api/attendance/route.ts

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/src/lib/prisma";
import { requireRole, unauthorizedResponse } from "@/src/lib/authz";
import {
  attendanceDeleteQuerySchema,
  attendanceGetQuerySchema,
  attendanceSubmitSchema,
} from "@/src/lib/validation/attendance";
import { parseBody, parseSearchParams } from "@/src/lib/validation/parse";
import { enforceRateLimit } from "@/src/lib/rate-limit";
import { revalidateDashboard } from "@/src/lib/cacheTags";

export async function GET(req: NextRequest) {
  try {
    const { userId, schoolId } = await requireRole(["admin", "teacher"]);
    const limited = enforceRateLimit(req, {
      scope: "attendance:read",
      actorId: userId,
      limit: 120,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const parsed = parseSearchParams(attendanceGetQuerySchema, new URL(req.url).searchParams);
    if (!parsed.ok) return parsed.response;

    const { lessonId, date } = parsed.data;
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);

    const records = await prisma.attendance.findMany({
      where: {
        schoolId,
        lessonId,
        date: { gte: dayStart, lte: dayEnd },
      },
      include: {
        student: { select: { id: true, name: true, surname: true, img: true } },
      },
    });

    return NextResponse.json(records);
  } catch (error) {
    return unauthorizedResponse(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId, schoolId } = await requireRole(["admin", "teacher"]);
    const limited = enforceRateLimit(req, {
      scope: "attendance:submit",
      actorId: userId,
      limit: 30,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const body = await req.json();
    const parsed = parseBody(attendanceSubmitSchema, body);
    if (!parsed.ok) return parsed.response;

    const { lessonId, date, records } = parsed.data;
    const attendanceDate = new Date(date);
    attendanceDate.setHours(12, 0, 0, 0);

    const lesson = await prisma.lesson.findFirst({
      where: { id: lessonId, schoolId },
      select: { id: true },
    });
    if (!lesson) {
      return NextResponse.json({ error: "Lesson not found." }, { status: 404 });
    }

    const results = await Promise.all(
      records.map((r) =>
        prisma.attendance.upsert({
          where: {
            schoolId_studentId_lessonId_date: {
              schoolId,
              studentId: r.studentId,
              lessonId,
              date: attendanceDate,
            },
          },
          update: {
            status: r.status,
            present: r.status === "PRESENT",
            note: r.note ?? null,
          },
          create: {
            schoolId,
            studentId: r.studentId,
            lessonId,
            date: attendanceDate,
            status: r.status,
            present: r.status === "PRESENT",
            note: r.note ?? null,
          },
        }),
      ),
    );

    revalidateDashboard(schoolId);
    return NextResponse.json({ saved: results.length }, { status: 201 });
  } catch (error) {
    return unauthorizedResponse(error);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { userId, schoolId } = await requireRole(["admin"]);
    const limited = enforceRateLimit(req, {
      scope: "attendance:delete",
      actorId: userId,
      limit: 20,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const parsed = parseSearchParams(attendanceDeleteQuerySchema, new URL(req.url).searchParams);
    if (!parsed.ok) return parsed.response;

    await prisma.attendance.deleteMany({
      where: { id: parsed.data.id, schoolId },
    });
    revalidateDashboard(schoolId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return unauthorizedResponse(error);
  }
}
