// src/app/api/form-data/students/route.ts
 

import { NextRequest, NextResponse } from "next/server";
import { requireRole, unauthorizedResponse } from "@/src/lib/authz";
import { getCachedStudents } from "@/src/lib/referenceData";
import { enforceRateLimit } from "@/src/lib/rate-limit";

export async function GET(req: NextRequest) {
  try {
    const { userId, schoolId } = await requireRole(["admin", "teacher", "bursar"]);
    const limited = await enforceRateLimit(req, { scope: "form-data:students", actorId: userId, limit: 120, windowMs: 60_000 });
    if (limited) return limited;

    const students = await getCachedStudents(schoolId);
    return NextResponse.json(students);
  } catch (error) {
    return unauthorizedResponse(error);
  }
}
