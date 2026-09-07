// src/app/api/form-data/lessons/route.ts

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/src/lib/prisma";
import { requireRole, unauthorizedResponse } from "@/src/lib/authz";
import { enforceRateLimit } from "@/src/lib/rate-limit";

export async function GET(req: NextRequest) {
  try {
    const { userId, role, schoolId } = await requireRole(["admin", "teacher"]);
    const limited = await enforceRateLimit(req, { scope: "form-data:lessons", actorId: userId, limit: 120, windowMs: 60_000 });
    if (limited) return limited;

    const where =
      role === "teacher"
        ? { schoolId, teacherId: userId }
        : { schoolId };

    const lessons = await prisma.lesson.findMany({
      where,
      select: {
        id: true,
        day: true,
        subject: { select: { id: true, name: true } },
        class: { select: { id: true, name: true } },
        teacher: { select: { name: true, surname: true } },
      },
      orderBy: [
        { class: { name: "asc" } },
        { subject: { name: "asc" } },
        { day: "asc" },
      ],
    });

    const seen = new Set<string>();
    const unique = lessons.filter((l) => {
      const key = `${l.subject.id}-${l.class.id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    const lessonIds = unique.map((lesson) => lesson.id);
    const homeworkSequences = lessonIds.length > 0
      ? await prisma.assignment.groupBy({
          by: ["lessonId"],
          where: {
            schoolId,
            lessonId: { in: lessonIds },
          },
          _max: { homeworkSequence: true },
        })
      : [];
    const nextHomeworkByLessonId = new Map(
      homeworkSequences.map((item) => [
        item.lessonId,
        (item._max.homeworkSequence ?? 0) + 1,
      ]),
    );

    return NextResponse.json(
      unique.map((l) => ({
        id: l.id,
        day: l.day,
        subjectName: l.subject.name,
        className: l.class.name,
        teacherName: `${l.teacher.name} ${l.teacher.surname}`,
        nextHomeworkTitle: `Homework ${nextHomeworkByLessonId.get(l.id) ?? 1}`,
      })),
    );
  } catch (error) {
    return unauthorizedResponse(error);
  }
}
