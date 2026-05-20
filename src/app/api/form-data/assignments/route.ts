// src/app/api/form-data/assignments/route.ts
 

import { NextResponse } from "next/server";
import prisma from "@/src/lib/prisma";
import { requireRole, unauthorizedResponse } from "@/src/lib/authz";

export async function GET() {
  try {
    const { schoolId } = await requireRole(["admin", "teacher"]);

  const assignments = await prisma.assignment.findMany({
    where: { schoolId },
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
  } catch (error) {
    return unauthorizedResponse(error);
  }
}
