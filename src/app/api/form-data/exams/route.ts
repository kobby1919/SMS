// src/app/api/form-data/exams/route.ts
// GET /api/form-data/exams
// Returns all exams with subject, class and date — used by ResultForm.

import { NextResponse } from "next/server";
import prisma from "@/src/lib/prisma";

export async function GET() {
  const exams = await prisma.exam.findMany({
    select: {
      id:        true,
      title:     true,
      startTime: true,
      lesson: {
        select: {
          subject: { select: { name: true } },
          class:   { select: { name: true } },
        },
      },
    },
    orderBy: { startTime: "desc" },
  });

  return NextResponse.json(
    exams.map((e) => ({
      id:          e.id,
      title:       e.title,
      subjectName: e.lesson.subject.name,
      className:   e.lesson.class.name,
      date:        e.startTime.toISOString(),
    }))
  );
}