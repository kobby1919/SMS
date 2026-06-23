// ─────────────────────────────────────────────────────────────────────────────
// src/app/api/form-data/classes/route.ts
// GET /api/form-data/classes
// ─────────────────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from "next/server";
import { requireRole, unauthorizedResponse } from "@/src/lib/authz";
import { getCachedClasses } from "@/src/lib/referenceData";
import { enforceRateLimit } from "@/src/lib/rate-limit";

export async function GET(req: NextRequest) {
  try {
    const { userId, schoolId } = await requireRole(["admin", "teacher", "bursar"]);
    const limited = await enforceRateLimit(req, { scope: "form-data:classes", actorId: userId, limit: 120, windowMs: 60_000 });
    if (limited) return limited;

    const classes = await getCachedClasses(schoolId);
    return NextResponse.json(classes);
  } catch (error) {
    return unauthorizedResponse(error);
  }
}
