// src/app/api/form-data/assignments/route.ts
// GET /api/form-data/assignments
// Returns all assignments with subject, class and due date — used by ResultForm.

import { NextResponse } from "next/server";
import prisma from "@/src/lib/prisma";

export async function GET() {
  const assignments = await prisma.assignment.findMany({
    select: {
      id:      true,
      title:   true,
      dueDate: true,
      lesson: {
        select: {
          subject: { select: { name: true } },
          class:   { select: { name: true } },
        },
      },
    },
    orderBy: { dueDate: "desc" },
  });

  return NextResponse.json(
    assignments.map((a) => ({
      id:          a.id,
      title:       a.title,
      subjectName: a.lesson.subject.name,
      className:   a.lesson.class.name,
      date:        a.dueDate.toISOString(),
    }))
  );
}