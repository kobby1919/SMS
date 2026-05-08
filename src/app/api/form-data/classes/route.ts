// ─────────────────────────────────────────────────────────────────────────────
// src/app/api/form-data/classes/route.ts
// GET /api/form-data/classes
// ─────────────────────────────────────────────────────────────────────────────
import { NextResponse } from "next/server";
import { requireRole, unauthorizedResponse } from "@/src/lib/authz";
import { getCachedClasses } from "@/src/lib/referenceData";

export async function GET() {
  try {
    const { schoolId } = await requireRole(["admin", "teacher", "bursar"]);

    const classes = await getCachedClasses(schoolId);
    return NextResponse.json(classes);
  } catch (error) {
    return unauthorizedResponse(error);
  }
}
