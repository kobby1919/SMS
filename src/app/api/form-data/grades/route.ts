// src/app/api/form-data/grades/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireRole, unauthorizedResponse } from "@/src/lib/authz";
import { getCachedGrades } from "@/src/lib/referenceData";
import { enforceRateLimit } from "@/src/lib/rate-limit";

export async function GET(req: NextRequest) {
  try {
    const { userId, schoolId } = await requireRole(["admin", "teacher", "bursar"]);
    const limited = await enforceRateLimit(req, { scope: "form-data:grades", actorId: userId, limit: 120, windowMs: 60_000 });
    if (limited) return limited;

    const grades = await getCachedGrades(schoolId);
    return NextResponse.json(grades);
  } catch (error) {
    return unauthorizedResponse(error);
  }
}
