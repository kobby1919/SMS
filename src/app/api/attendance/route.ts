// src/app/api/attendance/route.ts

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/src/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { AttendanceStatus } from "@/src/generated/prisma";

// ─── GET: fetch attendance for a lesson on a date ─────────────────────────────
export async function GET(req: NextRequest) {
  const { sessionClaims } = await auth();
  const role = (sessionClaims?.metadata as { role?: string })?.role;
  if (!["admin", "teacher"].includes(role!)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const lessonId = searchParams.get("lessonId");
  const date     = searchParams.get("date"); // ISO string

  if (!lessonId || !date) {
    return NextResponse.json({ error: "lessonId and date required" }, { status: 400 });
  }

  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(date);
  dayEnd.setHours(23, 59, 59, 999);

  const records = await prisma.attendance.findMany({
    where: {
      lessonId: parseInt(lessonId),
      date: { gte: dayStart, lte: dayEnd },
    },
    include: {
      student: { select: { id: true, name: true, surname: true, img: true } },
    },
  });

  return NextResponse.json(records);
}

// ─── POST: submit attendance for a full class ─────────────────────────────────
// Body: { lessonId, date, records: [{ studentId, status, note? }] }
export async function POST(req: NextRequest) {
  const { sessionClaims } = await auth();
  const role = (sessionClaims?.metadata as { role?: string })?.role;
  if (!["admin", "teacher"].includes(role!)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { lessonId, date, records } = body;

  if (!lessonId || !date || !Array.isArray(records)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const attendanceDate = new Date(date);
  attendanceDate.setHours(12, 0, 0, 0); // noon to avoid timezone edge cases

  // Upsert each student record
  const results = await Promise.all(
    records.map(async (r: { studentId: string; status: AttendanceStatus; note?: string }) => {
      return prisma.attendance.upsert({
        where: {
          studentId_lessonId_date: {
            studentId: r.studentId,
            lessonId:  parseInt(lessonId),
            date:      attendanceDate,
          },
        },
        update: {
          status:  r.status,
          present: r.status === "PRESENT",
          note:    r.note ?? null,
        },
        create: {
          studentId: r.studentId,
          lessonId:  parseInt(lessonId),
          date:      attendanceDate,
          status:    r.status,
          present:   r.status === "PRESENT",
          note:      r.note ?? null,
        },
      });
    })
  );

  return NextResponse.json({ saved: results.length }, { status: 201 });
}

// ─── DELETE: remove an attendance record ──────────────────────────────────────
export async function DELETE(req: NextRequest) {
  const { sessionClaims } = await auth();
  const role = (sessionClaims?.metadata as { role?: string })?.role;
  if (role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

  await prisma.attendance.delete({ where: { id: parseInt(id) } });
  return NextResponse.json({ success: true });
}