// src/app/api/attendance/stats/route.ts

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/src/lib/prisma";
import { auth } from "@clerk/nextjs/server";

// GET /api/attendance/stats?studentId=X  — student's attendance summary
// GET /api/attendance/stats?classId=X    — class attendance summary
// GET /api/attendance/stats?teacherId=X  — teacher's class attendance summary
// GET /api/attendance/stats              — school-wide (admin)

export async function GET(req: NextRequest) {
  const { sessionClaims } = await auth();
  const role = (sessionClaims?.metadata as { role?: string })?.role;
  if (!role) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const studentId = searchParams.get("studentId");
  const classId   = searchParams.get("classId");
  const teacherId = searchParams.get("teacherId");

  // ── Student stats ─────────────────────────────────────────────────────────
  if (studentId) {
    const [total, present, absent, late, excused] = await Promise.all([
      prisma.attendance.count({ where: { studentId } }),
      prisma.attendance.count({ where: { studentId, status: "PRESENT" } }),
      prisma.attendance.count({ where: { studentId, status: "ABSENT" } }),
      prisma.attendance.count({ where: { studentId, status: "LATE" } }),
      prisma.attendance.count({ where: { studentId, status: "EXCUSED" } }),
    ]);

    // Last 30 days breakdown
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recent = await prisma.attendance.findMany({
      where: { studentId, date: { gte: thirtyDaysAgo } },
      orderBy: { date: "asc" },
      select: { date: true, status: true, lesson: { select: { subject: { select: { name: true } } } } },
    });

    // Consecutive absences (streak detection)
    const sortedRecent = [...recent].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    let consecutiveAbsences = 0;
    for (const r of sortedRecent) {
      if (r.status === "ABSENT") consecutiveAbsences++;
      else break;
    }

    return NextResponse.json({
      total, present, absent, late, excused,
      attendanceRate: total > 0 ? Math.round((present / total) * 100) : 0,
      consecutiveAbsences,
      recentHistory: recent,
    });
  }

  // ── Class stats ───────────────────────────────────────────────────────────
  if (classId) {
    const students = await prisma.student.findMany({
      where: { classId: parseInt(classId) },
      select: { id: true, name: true, surname: true, img: true },
    });

    const stats = await Promise.all(
      students.map(async (s) => {
        const [total, present, absent] = await Promise.all([
          prisma.attendance.count({ where: { studentId: s.id } }),
          prisma.attendance.count({ where: { studentId: s.id, status: "PRESENT" } }),
          prisma.attendance.count({ where: { studentId: s.id, status: "ABSENT" } }),
        ]);
        return {
          ...s,
          total, present, absent,
          rate: total > 0 ? Math.round((present / total) * 100) : 0,
        };
      })
    );

    return NextResponse.json({ students: stats });
  }

  // ── School-wide today stats (admin dashboard) ────────────────────────────
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const [todayTotal, todayPresent, todayAbsent, todayLate] = await Promise.all([
    prisma.attendance.count({ where: { date: { gte: today, lte: todayEnd } } }),
    prisma.attendance.count({ where: { date: { gte: today, lte: todayEnd }, status: "PRESENT" } }),
    prisma.attendance.count({ where: { date: { gte: today, lte: todayEnd }, status: "ABSENT" } }),
    prisma.attendance.count({ where: { date: { gte: today, lte: todayEnd }, status: "LATE" } }),
  ]);

  // Students flagged for 3+ consecutive absences
  const allStudents = await prisma.student.findMany({ select: { id: true, name: true, surname: true, classId: true } });
  const flagged: { id: string; name: string; surname: string; classId: number; streak: number }[] = [];

  for (const student of allStudents) {
    const recent = await prisma.attendance.findMany({
      where: { studentId: student.id },
      orderBy: { date: "desc" },
      take: 5,
      select: { status: true },
    });
    let streak = 0;
    for (const r of recent) {
      if (r.status === "ABSENT") streak++;
      else break;
    }
    if (streak >= 3) flagged.push({ ...student, streak });
  }

  return NextResponse.json({
    today: { total: todayTotal, present: todayPresent, absent: todayAbsent, late: todayLate },
    todayRate: todayTotal > 0 ? Math.round((todayPresent / todayTotal) * 100) : 0,
    flagged,
  });
}