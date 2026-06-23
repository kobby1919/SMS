import { NextRequest, NextResponse } from "next/server";
import prisma from "@/src/lib/prisma";
import { requireRole, unauthorizedResponse } from "@/src/lib/authz";
import { enforceRateLimit } from "@/src/lib/rate-limit";

export async function GET(req: NextRequest) {
  try {
    const { userId, schoolId } = await requireRole(["admin"]);
    const limited = await enforceRateLimit(req, { scope: "form-data:parents", actorId: userId, limit: 120, windowMs: 60_000 });
    if (limited) return limited;

    const parents = await prisma.parent.findMany({
      where: { schoolId },
      select: {
        id: true,
        name: true,
        surname: true,
      },
      orderBy: {
        name: "asc",
      },
    });

    return NextResponse.json(parents);
  } catch (error) {
    return unauthorizedResponse(error);
  }
}
