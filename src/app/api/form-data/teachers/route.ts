// ─────────────────────────────────────────────────────────────────────────────
// src/app/api/form-data/teachers/route.ts
// GET /api/form-data/teachers
// ─────────────────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from "next/server";
import { requireRole, unauthorizedResponse } from "@/src/lib/authz";
import { getCachedTeachers } from "@/src/lib/referenceData";
import { enforceRateLimit } from "@/src/lib/rate-limit";

export async function GET(req: NextRequest) {
  try {
    const { userId, schoolId } = await requireRole(["admin", "teacher"]);
    const limited = await enforceRateLimit(req, { scope: "form-data:teachers", actorId: userId, limit: 120, windowMs: 60_000 });
    if (limited) return limited;

    const teachers = await getCachedTeachers(schoolId);
    return NextResponse.json(teachers);
  } catch (error) {
    return unauthorizedResponse(error);
  }
}
