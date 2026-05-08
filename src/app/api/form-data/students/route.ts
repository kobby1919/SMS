// src/app/api/form-data/students/route.ts
 

import { NextResponse } from "next/server";
import { requireRole, unauthorizedResponse } from "@/src/lib/authz";
import { getCachedStudents } from "@/src/lib/referenceData";

export async function GET() {
  try {
    const { schoolId } = await requireRole(["admin", "teacher", "bursar"]);

    const students = await getCachedStudents(schoolId);
    return NextResponse.json(students);
  } catch (error) {
    return unauthorizedResponse(error);
  }
}
