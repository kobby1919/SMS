import { NextRequest, NextResponse } from "next/server";
import { requireRole, unauthorizedResponse } from "@/src/lib/authz";
import prisma from "@/src/lib/prisma";
import { getActiveAcademicPeriod } from "@/src/lib/services/academic-period";
import { enforceRateLimit } from "@/src/lib/rate-limit";

export async function GET(req: NextRequest) {
  try {
    const { userId, schoolId } = await requireRole(["admin", "teacher"]);
    const limited = await enforceRateLimit(req, {
      scope: "ca:config",
      actorId: userId,
      limit: 120,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const year = new URL(req.url).searchParams.get("year")?.trim();
    const config = year
      ? await prisma.cAConfig.findUnique({
          where: { schoolId_academicYear: { schoolId, academicYear: year } },
        })
      : null;

    if (config) {
      return NextResponse.json({
        academicYear: config.academicYear,
        currentTerm: config.currentTerm,
        isActive: config.isActive,
        classworkWeight: config.classworkWeight,
        examWeight: config.examWeight,
      });
    }

    const activePeriod = await getActiveAcademicPeriod(schoolId);
    return NextResponse.json(activePeriod);
  } catch (error) {
    return unauthorizedResponse(error);
  }
}
