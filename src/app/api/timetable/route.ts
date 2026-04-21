// src/app/api/timetable/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/src/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { Day } from "@/src/generated/prisma";

// ─── GET: fetch all lessons (optionally filtered by classId) ─────────────────
export async function GET(req: NextRequest) {
  const { sessionClaims } = await auth();
  const role = (sessionClaims?.metadata as { role?: string })?.role;
  if (role !== "admin") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const classId = searchParams.get("classId");

  const lessons = await prisma.lesson.findMany({
    where: classId ? { classId: parseInt(classId) } : undefined,
    include: {
      subject: { select: { id: true, name: true } },
      class:   { select: { id: true, name: true } },
      teacher: { select: { id: true, name: true, surname: true } },
    },
    orderBy: [{ day: "asc" }, { startTime: "asc" }],
  });

  return NextResponse.json(lessons);
}

// ─── POST: create a new lesson slot ──────────────────────────────────────────
export async function POST(req: NextRequest) {
  const { sessionClaims } = await auth();
  const role = (sessionClaims?.metadata as { role?: string })?.role;
  if (role !== "admin") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { name, day, startTime, endTime, subjectId, classId, teacherId } = body;

  // Validate required fields
  if (!day || !startTime || !endTime || !subjectId || !classId || !teacherId) {
    return NextResponse.json({ error: "All fields are required." }, { status: 400 });
  }

  const start = new Date(startTime);
  const end   = new Date(endTime);

  if (end <= start) {
    return NextResponse.json({ error: "End time must be after start time." }, { status: 400 });
  }

  // ── Conflict detection ───────────────────────────────────────────────────
  const conflict = await checkConflicts({ day, start, end, classId, teacherId });
  if (conflict) return NextResponse.json({ error: conflict }, { status: 409 });

  // ── Teacher class limit (max 5 unique classes) ───────────────────────────
  const teacherClassCount = await prisma.lesson.findMany({
    where: { teacherId },
    select: { classId: true },
    distinct: ["classId"],
  });
  const uniqueClassIds = new Set(teacherClassCount.map((l) => l.classId));
  if (!uniqueClassIds.has(classId) && uniqueClassIds.size >= 5) {
    return NextResponse.json(
      { error: "This teacher is already assigned to 5 classes (maximum reached)." },
      { status: 409 }
    );
  }

  // ── Get subject name for lesson name ─────────────────────────────────────
  const subject = await prisma.subject.findUnique({ where: { id: subjectId } });
  const cls     = await prisma.class.findUnique({ where: { id: classId } });

  const lesson = await prisma.lesson.create({
    data: {
      name:      name || `${subject?.name} - ${cls?.name}`,
      day:       day as Day,
      startTime: start,
      endTime:   end,
      subjectId,
      classId,
      teacherId,
    },
    include: {
      subject: { select: { id: true, name: true } },
      class:   { select: { id: true, name: true } },
      teacher: { select: { id: true, name: true, surname: true } },
    },
  });

  return NextResponse.json(lesson, { status: 201 });
}

// ─── PUT: update an existing lesson slot ─────────────────────────────────────
export async function PUT(req: NextRequest) {
  const { sessionClaims } = await auth();
  const role = (sessionClaims?.metadata as { role?: string })?.role;
  if (role !== "admin") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { id, name, day, startTime, endTime, subjectId, classId, teacherId } = body;

  if (!id) return NextResponse.json({ error: "Lesson ID required." }, { status: 400 });

  const start = new Date(startTime);
  const end   = new Date(endTime);

  if (end <= start) {
    return NextResponse.json({ error: "End time must be after start time." }, { status: 400 });
  }

  // Conflict detection (exclude self)
  const conflict = await checkConflicts({ day, start, end, classId, teacherId, excludeId: id });
  if (conflict) return NextResponse.json({ error: conflict }, { status: 409 });

  // Teacher class limit (exclude current lesson's class)
  const existing = await prisma.lesson.findUnique({ where: { id } });
  if (existing?.classId !== classId) {
    const teacherClassCount = await prisma.lesson.findMany({
      where: { teacherId, NOT: { id } },
      select: { classId: true },
      distinct: ["classId"],
    });
    const uniqueClassIds = new Set(teacherClassCount.map((l) => l.classId));
    if (!uniqueClassIds.has(classId) && uniqueClassIds.size >= 5) {
      return NextResponse.json(
        { error: "This teacher is already assigned to 5 classes (maximum reached)." },
        { status: 409 }
      );
    }
  }

  const subject = await prisma.subject.findUnique({ where: { id: subjectId } });
  const cls     = await prisma.class.findUnique({ where: { id: classId } });

  const lesson = await prisma.lesson.update({
    where: { id },
    data: {
      name:      name || `${subject?.name} - ${cls?.name}`,
      day:       day as Day,
      startTime: start,
      endTime:   end,
      subjectId,
      classId,
      teacherId,
    },
    include: {
      subject: { select: { id: true, name: true } },
      class:   { select: { id: true, name: true } },
      teacher: { select: { id: true, name: true, surname: true } },
    },
  });

  return NextResponse.json(lesson);
}

// ─── DELETE: remove a lesson slot ────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  const { sessionClaims } = await auth();
  const role = (sessionClaims?.metadata as { role?: string })?.role;
  if (role !== "admin") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID required." }, { status: 400 });

  await prisma.lesson.delete({ where: { id: parseInt(id) } });
  return NextResponse.json({ success: true });
}

// ─── Conflict detection helper ────────────────────────────────────────────────
async function checkConflicts({
  day, start, end, classId, teacherId, excludeId,
}: {
  day: string;
  start: Date;
  end: Date;
  classId: number;
  teacherId: string;
  excludeId?: number;
}) {
  const baseWhere = {
    day: day as Day,
    NOT: excludeId ? { id: excludeId } : undefined,
    AND: [
      { startTime: { lt: end } },
      { endTime:   { gt: start } },
    ],
  };

  // 1. Same class, overlapping time?
  const classConflict = await prisma.lesson.findFirst({
    where: { ...baseWhere, classId },
    include: { subject: { select: { name: true } } },
  });
  if (classConflict) {
    return `Class conflict: This class already has "${classConflict.subject.name}" at that time on ${day}.`;
  }

  // 2. Same teacher, overlapping time?
  const teacherConflict = await prisma.lesson.findFirst({
    where: { ...baseWhere, teacherId },
    include: { class: { select: { name: true } }, subject: { select: { name: true } } },
  });
  if (teacherConflict) {
    return `Teacher conflict: This teacher already has "${teacherConflict.subject.name}" in ${teacherConflict.class.name} at that time on ${day}.`;
  }

  return null;
}