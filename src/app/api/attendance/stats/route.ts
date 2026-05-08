// src/app/api/attendance/stats/route.ts

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/src/lib/prisma";
import { requireRole, unauthorizedResponse } from "@/src/lib/authz";

export async function GET(req: NextRequest) {
  try {
    const { schoolId } = await requireRole([
      "admin",
      "teacher",
      "student",
      "parent",
      "bursar",
    ]);

    const { searchParams } = new URL(req.url);
    const studentId = searchParams.get("studentId");
    const classId = searchParams.get("classId");

    if (studentId) {
      const student = await prisma.student.findFirst({
        where: { id: studentId, schoolId },
        select: { id: true },
      });
      if (!student) {
        return NextResponse.json({ error: "Student not found." }, { status: 404 });
      }

      const tenantStudent = { schoolId, studentId };
      const grouped = await prisma.attendance.groupBy({
        by: ["status"],
        where: tenantStudent,
        _count: { _all: true },
      });
      const counts = Object.fromEntries(
        grouped.map((row) => [row.status, row._count._all]),
      ) as Record<string, number>;
      const total = grouped.reduce((sum, row) => sum + row._count._all, 0);
      const present = counts.PRESENT ?? 0;
      const absent = counts.ABSENT ?? 0;
      const late = counts.LATE ?? 0;
      const excused = counts.EXCUSED ?? 0;

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const recent = await prisma.attendance.findMany({
        where: { ...tenantStudent, date: { gte: thirtyDaysAgo } },
        orderBy: { date: "asc" },
        select: {
          date: true,
          status: true,
          lesson: { select: { subject: { select: { name: true } } } },
        },
      });

      const sortedRecent = [...recent].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
      );
      let consecutiveAbsences = 0;
      for (const r of sortedRecent) {
        if (r.status === "ABSENT") consecutiveAbsences++;
        else break;
      }

      return NextResponse.json({
        total,
        present,
        absent,
        late,
        excused,
        attendanceRate: total > 0 ? Math.round((present / total) * 100) : 0,
        consecutiveAbsences,
        recentHistory: recent,
      });
    }

    if (classId) {
      const students = await prisma.student.findMany({
        where: { schoolId, classId: parseInt(classId) },
        select: { id: true, name: true, surname: true, img: true },
      });

      const grouped = await prisma.attendance.groupBy({
        by: ["studentId", "status"],
        where: { schoolId, studentId: { in: students.map((s) => s.id) } },
        _count: { _all: true },
      });
      const countsByStudent = new Map<string, Record<string, number>>();
      for (const row of grouped) {
        const counts = countsByStudent.get(row.studentId) ?? {};
        counts[row.status] = row._count._all;
        countsByStudent.set(row.studentId, counts);
      }
      const stats = students.map((s) => {
        const counts = countsByStudent.get(s.id) ?? {};
        const total = Object.values(counts).reduce((sum, value) => sum + value, 0);
        const present = counts.PRESENT ?? 0;
        const absent = counts.ABSENT ?? 0;
        return {
          ...s,
          total,
          present,
          absent,
          rate: total > 0 ? Math.round((present / total) * 100) : 0,
        };
      });

      return NextResponse.json({ students: stats });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);
    const todayWhere = { schoolId, date: { gte: today, lte: todayEnd } };

    const todayGrouped = await prisma.attendance.groupBy({
      by: ["status"],
      where: todayWhere,
      _count: { _all: true },
    });
    const todayCounts = Object.fromEntries(
      todayGrouped.map((row) => [row.status, row._count._all]),
    ) as Record<string, number>;
    const todayTotal = todayGrouped.reduce((sum, row) => sum + row._count._all, 0);
    const todayPresent = todayCounts.PRESENT ?? 0;
    const todayAbsent = todayCounts.ABSENT ?? 0;
    const todayLate = todayCounts.LATE ?? 0;

    const allStudents = await prisma.student.findMany({
      where: { schoolId },
      select: { id: true, name: true, surname: true, classId: true },
    });
    const flagged: { id: string; name: string; surname: string; classId: number; streak: number }[] = [];

    for (const student of allStudents) {
      const recent = await prisma.attendance.findMany({
        where: { schoolId, studentId: student.id },
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
      todayTotal,
      todayPresent,
      todayAbsent,
      todayLate,
      flagged,
    });
  } catch (error) {
    return unauthorizedResponse(error);
  }
}
