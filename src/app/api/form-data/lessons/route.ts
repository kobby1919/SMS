// src/app/api/form-data/lessons/route.ts

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/src/lib/prisma";
import { requireRole, unauthorizedResponse } from "@/src/lib/authz";
import { enforceRateLimit } from "@/src/lib/rate-limit";
import { listLiveTimetableLessons } from "@/src/lib/services/timetable";

export async function GET(req: NextRequest) {
  try {
    const { userId, role, schoolId } = await requireRole(["admin", "teacher"]);
    const limited = await enforceRateLimit(req, { scope: "form-data:lessons", actorId: userId, limit: 120, windowMs: 60_000 });
    if (limited) return limited;

    const lessons = await listLiveTimetableLessons(
      schoolId,
      role === "teacher" ? { teacherId: userId } : {},
    );

    const seen = new Set<string>();
    const unique = lessons.filter((l) => {
      const key = `${l.subject.id}-${l.class.id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    const lessonIds = unique.map((lesson) => lesson.id);
    const nextHomeworkByLessonId = new Map<number, number>();
    if (lessonIds.length > 0) {
      try {
        const homeworkSequences = await prisma.assignment.findMany({
          where: {
            schoolId,
            lessonId: { in: lessonIds },
          },
          select: {
            lessonId: true,
            homeworkSequence: true,
          },
          orderBy: [
            { lessonId: "asc" },
            { homeworkSequence: "desc" },
          ],
        });
        for (const item of homeworkSequences) {
          if (!nextHomeworkByLessonId.has(item.lessonId)) {
            nextHomeworkByLessonId.set(item.lessonId, item.homeworkSequence + 1);
          }
        }
      } catch (error) {
        console.error("Could not calculate next homework sequence", error);
      }
    }

    return NextResponse.json(
      unique.map((l) => ({
        id: l.id,
        day: l.day,
        subjectName: l.subject.name,
        className: l.class.name,
        teacherName: `${l.teacher.name} ${l.teacher.surname}`.trim(),
        nextHomeworkTitle: `Homework ${nextHomeworkByLessonId.get(l.id) ?? 1}`,
      })),
    );
  } catch (error) {
    return unauthorizedResponse(error);
  }
}
