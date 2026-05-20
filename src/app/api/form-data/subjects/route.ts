// src/app/api/form-data/subjects/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/src/lib/prisma";
import { requireRole, unauthorizedResponse } from "@/src/lib/authz";

// GET /api/form-data/subjects
// GET /api/form-data/subjects?teacherId=xxx  ← returns only that teacher's subjects
export async function GET(req: NextRequest) {
  try {
    const { schoolId } = await requireRole(["admin", "teacher"]);

  const teacherId = new URL(req.url).searchParams.get("teacherId");

  const subjects = await prisma.subject.findMany({
    where: teacherId
      ? { schoolId, teachers: { some: { id: teacherId, schoolId } } }
      : { schoolId },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(subjects);
  } catch (error) {
    return unauthorizedResponse(error);
  }
}
