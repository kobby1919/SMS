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

export async function GET(req: NextRequest) {
  try {
    const { schoolId } = await requireRole(["admin", "teacher"]);
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
    const { schoolId } = await requireRole(["admin", "teacher"]);
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

    return NextResponse.json({ saved: results.length }, { status: 201 });
  } catch (error) {
    return unauthorizedResponse(error);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { schoolId } = await requireRole(["admin"]);
    const parsed = parseSearchParams(attendanceDeleteQuerySchema, new URL(req.url).searchParams);
    if (!parsed.ok) return parsed.response;

    await prisma.attendance.deleteMany({
      where: { id: parsed.data.id, schoolId },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return unauthorizedResponse(error);
  }
}
