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

export async function GET(req: NextRequest) {
  try {
    const { schoolId } = await requireRole(["admin"]);

  const { searchParams } = new URL(req.url);
  const teacherId       = searchParams.get("teacherId");
  const excludeClassId  = searchParams.get("excludeClassId");
  const excludeLessonId = searchParams.get("excludeLessonId");

  if (!teacherId) {
    return NextResponse.json({ count: 0 });
  }

  // Fetch all lessons for this teacher, excluding the current lesson being edited
  const lessons = await prisma.lesson.findMany({
    where: {
      schoolId,
      teacherId,
      ...(excludeLessonId ? { NOT: { id: parseInt(excludeLessonId) } } : {}),
    },
    select: { classId: true },
  });

  // Count unique class IDs, optionally excluding the currently selected class
  // (so editing the same lesson in the same class doesn't falsely count as +1)
  const uniqueClassIds = new Set(
    lessons
      .map((l) => l.classId)
      .filter((id) =>
        excludeClassId ? id !== parseInt(excludeClassId) : true
      )
  );

  return NextResponse.json({ count: uniqueClassIds.size });
  } catch (error) {
    return unauthorizedResponse(error);
  }
}
