// src/app/api/form-data/subjects/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireRole, unauthorizedResponse } from "@/src/lib/authz";
import { getCachedSubjects } from "@/src/lib/referenceData";
import { optionalIdQuerySchema } from "@/src/lib/validation/common";
import { parseSearchParams } from "@/src/lib/validation/parse";
import { enforceRateLimit } from "@/src/lib/rate-limit";

// GET /api/form-data/subjects
// GET /api/form-data/subjects?teacherId=xxx  ← returns only that teacher's subjects
export async function GET(req: NextRequest) {
  try {
    const { userId, schoolId } = await requireRole(["admin", "teacher"]);
    const limited = await enforceRateLimit(req, { scope: "form-data:subjects", actorId: userId, limit: 120, windowMs: 60_000 });
    if (limited) return limited;

    const parsed = parseSearchParams(optionalIdQuerySchema, new URL(req.url).searchParams);
    if (!parsed.ok) return parsed.response;
    const subjects = await getCachedSubjects(schoolId, parsed.data.teacherId);

    return NextResponse.json(subjects);
  } catch (error) {
    return unauthorizedResponse(error);
  }
}
