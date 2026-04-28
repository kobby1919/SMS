// src/app/api/form-data/lessons/route.ts
// GET /api/form-data/lessons
// Returns all lessons with subject, class and teacher — used by ExamForm lesson picker.

import { NextResponse } from "next/server";
import prisma from "@/src/lib/prisma";

export async function GET() {
  const lessons = await prisma.lesson.findMany({
    select: {
      id:      true,
      name:    true,
      day:     true,
      subject: { select: { name: true } },
      class:   { select: { name: true } },
      teacher: { select: { name: true, surname: true } },
    },
    orderBy: [{ day: "asc" }, { startTime: "asc" }],
  });

  return NextResponse.json(
    lessons.map((l) => ({
      id:          l.id,
      name:        l.name,
      day:         l.day,
      subjectName: l.subject.name,
      className:   l.class.name,
      teacherName: `${l.teacher.name} ${l.teacher.surname}`,
    }))
  );
}