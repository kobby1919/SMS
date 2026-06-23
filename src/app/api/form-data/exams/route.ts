// src/app/api/form-data/exams/route.ts


import { NextRequest, NextResponse } from "next/server";
import prisma from "@/src/lib/prisma";
import { requireRole, unauthorizedResponse } from "@/src/lib/authz";
import { enforceRateLimit } from "@/src/lib/rate-limit";

export async function GET(req: NextRequest) {
  try {
    const { userId, schoolId } = await requireRole(["admin", "teacher"]);
    const limited = await enforceRateLimit(req, { scope: "form-data:exams", actorId: userId, limit: 120, windowMs: 60_000 });
    if (limited) return limited;

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
