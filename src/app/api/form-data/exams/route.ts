// src/app/api/form-data/exams/route.ts


import { NextResponse } from "next/server";
import prisma from "@/src/lib/prisma";
import { requireRole, unauthorizedResponse } from "@/src/lib/authz";

export async function GET() {
  try {
    const { schoolId } = await requireRole(["admin", "teacher"]);

  const exams = await prisma.exam.findMany({
    where: { schoolId },
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
  } catch (error) {
    return unauthorizedResponse(error);
  }
}
