// src/app/api/form-data/assignments/route.ts
 

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/src/lib/prisma";
import { requireRole, unauthorizedResponse } from "@/src/lib/authz";
import { enforceRateLimit } from "@/src/lib/rate-limit";

export async function GET(req: NextRequest) {
  try {
    const { userId, schoolId } = await requireRole(["admin", "teacher"]);
    const limited = await enforceRateLimit(req, { scope: "form-data:assignments", actorId: userId, limit: 120, windowMs: 60_000 });
    if (limited) return limited;

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
