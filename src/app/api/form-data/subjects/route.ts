// src/app/api/form-data/subjects/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireRole, unauthorizedResponse } from "@/src/lib/authz";
import { getCachedSubjects } from "@/src/lib/referenceData";

// GET /api/form-data/subjects
// GET /api/form-data/subjects?teacherId=xxx  ← returns only that teacher's subjects
export async function GET(req: NextRequest) {
  try {
    const { schoolId } = await requireRole(["admin", "teacher"]);

    const teacherId = new URL(req.url).searchParams.get("teacherId") ?? undefined;
    const subjects = await getCachedSubjects(schoolId, teacherId);

    return NextResponse.json(subjects);
  } catch (error) {
    return unauthorizedResponse(error);
  }
}
