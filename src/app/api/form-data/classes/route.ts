// ─────────────────────────────────────────────────────────────────────────────
// src/app/api/form-data/classes/route.ts
// GET /api/form-data/classes
// ─────────────────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from "next/server";
import { requireRole, unauthorizedResponse } from "@/src/lib/authz";
import { getCachedClasses } from "@/src/lib/referenceData";
import { enforceRateLimit } from "@/src/lib/rate-limit";
import prisma from "@/src/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const { userId, role, schoolId } = await requireRole(["admin", "teacher", "bursar"]);
    const limited = await enforceRateLimit(req, { scope: "form-data:classes", actorId: userId, limit: 120, windowMs: 60_000 });
    if (limited) return limited;

    if (role === "teacher") {
      const classes = await prisma.class.findMany({
        where: {
          schoolId,
          lessons: { some: { teacherId: userId } },
        },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      });
      return NextResponse.json(classes);
    }

    const classes = await getCachedClasses(schoolId);
    return NextResponse.json(classes);
  } catch (error) {
    return unauthorizedResponse(error);
  }
}
