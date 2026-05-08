// src/app/api/ca/config/route.ts


import { NextRequest, NextResponse } from "next/server";
import prisma from "@/src/lib/prisma";
import { requireRole, unauthorizedResponse } from "@/src/lib/authz";
import { z } from "zod";
import { nonEmptyStringSchema } from "@/src/lib/validation/common";

const yearQuerySchema = z.object({ year: nonEmptyStringSchema });

export async function GET(req: NextRequest) {
  try {
    const yearParam = req.nextUrl.searchParams.get("year");
    if (!yearParam) {
      return NextResponse.json({ classworkWeight: 30, examWeight: 70 });
    }

    const yearParsed = yearQuerySchema.safeParse({ year: yearParam });
    if (!yearParsed.success) {
      return NextResponse.json({ error: "Invalid year parameter" }, { status: 400 });
    }

    const { schoolId } = await requireRole(["admin", "teacher"]);
    const config = await prisma.cAConfig.findUnique({
      where: { schoolId_academicYear: { schoolId, academicYear: yearParsed.data.year } },
      select: { classworkWeight: true, examWeight: true },
    });

    return NextResponse.json(config ?? { classworkWeight: 30, examWeight: 70 });
  } catch (error) {
    return unauthorizedResponse(error);
  }
}
