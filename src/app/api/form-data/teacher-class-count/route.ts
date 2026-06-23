// ─────────────────────────────────────────────────────────────────────────────
// src/app/api/form-data/teacher-class-count/route.ts
// GET /api/form-data/teacher-class-count?teacherId=X&excludeClassId=Y&excludeLessonId=Z
//
// Returns how many UNIQUE classes this teacher currently teaches,
// optionally excluding a class (for update scenarios) and a specific lesson id.
// ─────────────────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/src/lib/prisma";
import { requireRole, unauthorizedResponse } from "@/src/lib/authz";
import { teacherClassCountQuerySchema } from "@/src/lib/validation/timetable";
import { parseSearchParams } from "@/src/lib/validation/parse";
import { enforceRateLimit } from "@/src/lib/rate-limit";

export async function GET(req: NextRequest) {
  try {
    const { userId, schoolId } = await requireRole(["admin"]);
    const limited = await enforceRateLimit(req, { scope: "form-data:teacher-class-count", actorId: userId, limit: 120, windowMs: 60_000 });
    if (limited) return limited;

  const parsed = parseSearchParams(teacherClassCountQuerySchema, req.nextUrl.searchParams);
  if (!parsed.ok) return parsed.response;
  const { teacherId, excludeClassId, excludeLessonId } = parsed.data;

  // Fetch all lessons for this teacher, excluding the current lesson being edited
  const lessons = await prisma.lesson.findMany({
    where: {
      schoolId,
      teacherId,
      ...(excludeLessonId ? { NOT: { id: excludeLessonId } } : {}),
    },
    select: { classId: true },
    distinct: ["classId"],
  });

  // Count unique class IDs, optionally excluding the currently selected class
  // (so editing the same lesson in the same class doesn't falsely count as +1)
  const uniqueClassIds = new Set(
    lessons
      .map((l) => l.classId)
      .filter((id) =>
        excludeClassId ? id !== excludeClassId : true
      )
  );

  return NextResponse.json({ count: uniqueClassIds.size });
  } catch (error) {
    return unauthorizedResponse(error);
  }
}
