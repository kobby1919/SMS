// src/app/api/timetable/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/src/lib/prisma";
import { requireRole, unauthorizedResponse } from "@/src/lib/authz";
import { Day } from "@/src/generated/prisma";
import {
  timetableDeleteQuerySchema,
  timetableGetQuerySchema,
  timetableLessonSchema,
  timetableUpdateSchema,
} from "@/src/lib/validation/timetable";
import { parseBody, parseSearchParams } from "@/src/lib/validation/parse";
import { revalidateDashboard, revalidateReferenceData } from "@/src/lib/cacheTags";

export async function GET(req: NextRequest) {
  try {
    const { schoolId } = await requireRole(["admin"]);
    const parsed = parseSearchParams(timetableGetQuerySchema, new URL(req.url).searchParams);
    if (!parsed.ok) return parsed.response;

    const lessons = await prisma.lesson.findMany({
      where: {
        schoolId,
        ...(parsed.data.classId ? { classId: parsed.data.classId } : {}),
      },
      include: {
        subject: { select: { id: true, name: true } },
        class: { select: { id: true, name: true } },
        teacher: { select: { id: true, name: true, surname: true } },
      },
      orderBy: [{ day: "asc" }, { startTime: "asc" }],
    });

    return NextResponse.json(lessons);
  } catch (error) {
    return unauthorizedResponse(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { schoolId } = await requireRole(["admin"]);
    const body = await req.json();
    const parsed = parseBody(timetableLessonSchema, body);
    if (!parsed.ok) return parsed.response;

    const { name, day, startTime, endTime, subjectId, classId, teacherId } = parsed.data;
    const start = new Date(startTime);
    const end = new Date(endTime);
    if (end <= start) {
      return NextResponse.json({ error: "End time must be after start time." }, { status: 400 });
    }

    const conflict = await checkConflicts({ schoolId, day, start, end, classId, teacherId });
    if (conflict) return NextResponse.json({ error: conflict }, { status: 409 });

    const teacherClassCount = await prisma.lesson.findMany({
      where: { schoolId, teacherId },
      select: { classId: true },
      distinct: ["classId"],
    });
    const uniqueClassIds = new Set(teacherClassCount.map((l) => l.classId));
    if (!uniqueClassIds.has(classId) && uniqueClassIds.size >= 5) {
      return NextResponse.json(
        { error: "This teacher is already assigned to 5 classes (maximum reached)." },
        { status: 409 },
      );
    }

    const subject = await prisma.subject.findFirst({ where: { id: subjectId, schoolId } });
    const cls = await prisma.class.findFirst({ where: { id: classId, schoolId } });
    if (!subject || !cls) {
      return NextResponse.json({ error: "Subject or class not found." }, { status: 404 });
    }

    const lesson = await prisma.lesson.create({
      data: {
        schoolId,
        name: name || `${subject.name} - ${cls.name}`,
        day: day as Day,
        startTime: start,
        endTime: end,
        subjectId,
        classId,
        teacherId,
      },
      include: {
        subject: { select: { id: true, name: true } },
        class: { select: { id: true, name: true } },
        teacher: { select: { id: true, name: true, surname: true } },
      },
    });

    revalidateReferenceData(schoolId, "timetable");
    revalidateDashboard(schoolId);
    return NextResponse.json(lesson, { status: 201 });
  } catch (error) {
    return unauthorizedResponse(error);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { schoolId } = await requireRole(["admin"]);
    const body = await req.json();
    const parsed = parseBody(timetableUpdateSchema, body);
    if (!parsed.ok) return parsed.response;

    const { id, name, day, startTime, endTime, subjectId, classId, teacherId } = parsed.data;
    const start = new Date(startTime);
    const end = new Date(endTime);
    if (end <= start) {
      return NextResponse.json({ error: "End time must be after start time." }, { status: 400 });
    }

    const existing = await prisma.lesson.findFirst({ where: { id, schoolId } });
    if (!existing) {
      return NextResponse.json({ error: "Lesson not found." }, { status: 404 });
    }

    const conflict = await checkConflicts({
      schoolId,
      day,
      start,
      end,
      classId,
      teacherId,
      excludeId: id,
    });
    if (conflict) return NextResponse.json({ error: conflict }, { status: 409 });

    if (existing.classId !== classId) {
      const teacherClassCount = await prisma.lesson.findMany({
        where: { schoolId, teacherId, NOT: { id } },
        select: { classId: true },
        distinct: ["classId"],
      });
      const uniqueClassIds = new Set(teacherClassCount.map((l) => l.classId));
      if (!uniqueClassIds.has(classId) && uniqueClassIds.size >= 5) {
        return NextResponse.json(
          { error: "This teacher is already assigned to 5 classes (maximum reached)." },
          { status: 409 },
        );
      }
    }

    const subject = await prisma.subject.findFirst({ where: { id: subjectId, schoolId } });
    const cls = await prisma.class.findFirst({ where: { id: classId, schoolId } });
    if (!subject || !cls) {
      return NextResponse.json({ error: "Subject or class not found." }, { status: 404 });
    }

    const lesson = await prisma.lesson.update({
      where: { id },
      data: {
        name: name || `${subject.name} - ${cls.name}`,
        day: day as Day,
        startTime: start,
        endTime: end,
        subjectId,
        classId,
        teacherId,
      },
      include: {
        subject: { select: { id: true, name: true } },
        class: { select: { id: true, name: true } },
        teacher: { select: { id: true, name: true, surname: true } },
      },
    });

    revalidateReferenceData(schoolId, "timetable");
    revalidateDashboard(schoolId);
    return NextResponse.json(lesson);
  } catch (error) {
    return unauthorizedResponse(error);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { schoolId } = await requireRole(["admin"]);
    const parsed = parseSearchParams(timetableDeleteQuerySchema, new URL(req.url).searchParams);
    if (!parsed.ok) return parsed.response;

    await prisma.lesson.deleteMany({ where: { id: parsed.data.id, schoolId } });
    revalidateReferenceData(schoolId, "timetable");
    revalidateDashboard(schoolId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return unauthorizedResponse(error);
  }
}

async function checkConflicts({
  schoolId,
  day,
  start,
  end,
  classId,
  teacherId,
  excludeId,
}: {
  schoolId: string;
  day: string;
  start: Date;
  end: Date;
  classId: number;
  teacherId: string;
  excludeId?: number;
}) {
  const baseWhere = {
    schoolId,
    day: day as Day,
    NOT: excludeId ? { id: excludeId } : undefined,
    AND: [{ startTime: { lt: end } }, { endTime: { gt: start } }],
  };

  const classConflict = await prisma.lesson.findFirst({
    where: { ...baseWhere, classId },
    include: { subject: { select: { name: true } } },
  });
  if (classConflict) {
    return `Class conflict: This class already has "${classConflict.subject.name}" at that time on ${day}.`;
  }

  const teacherConflict = await prisma.lesson.findFirst({
    where: { ...baseWhere, teacherId },
    include: { class: { select: { name: true } }, subject: { select: { name: true } } },
  });
  if (teacherConflict) {
    return `Teacher conflict: This teacher already has "${teacherConflict.subject.name}" in ${teacherConflict.class.name} at that time on ${day}.`;
  }

  return null;
}
