// src/app/api/form-data/grades/route.ts
import { NextResponse } from "next/server";
import { requireRole, unauthorizedResponse } from "@/src/lib/authz";
import { getCachedGrades } from "@/src/lib/referenceData";

export async function GET() {
  try {
    const { schoolId } = await requireRole(["admin", "teacher", "bursar"]);

    const grades = await getCachedGrades(schoolId);
    return NextResponse.json(grades);
  } catch (error) {
    return unauthorizedResponse(error);
  }
}
