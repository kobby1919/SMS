// ─────────────────────────────────────────────────────────────────────────────
// src/app/api/form-data/teachers/route.ts
// GET /api/form-data/teachers
// ─────────────────────────────────────────────────────────────────────────────
import { NextResponse } from "next/server";
import { requireRole, unauthorizedResponse } from "@/src/lib/authz";
import { getCachedTeachers } from "@/src/lib/referenceData";

export async function GET() {
  try {
    const { schoolId } = await requireRole(["admin", "teacher"]);

    const teachers = await getCachedTeachers(schoolId);
    return NextResponse.json(teachers);
  } catch (error) {
    return unauthorizedResponse(error);
  }
}
