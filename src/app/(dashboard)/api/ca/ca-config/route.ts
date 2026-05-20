// src/app/api/ca/config/route.ts


import { NextRequest, NextResponse } from "next/server";
import prisma from "@/src/lib/prisma";
import { requireRole } from "@/src/lib/authz";

export async function GET(req: NextRequest) {
  const year = req.nextUrl.searchParams.get("year");
  if (!year) {
    return NextResponse.json({ classworkWeight: 30, examWeight: 70 });
  }

  try {
    const { schoolId } = await requireRole(["admin", "teacher"]);
    const config = await prisma.cAConfig.findUnique({
      where: { schoolId_academicYear: { schoolId, academicYear: year } },
      select: { classworkWeight: true, examWeight: true },
    });

    return NextResponse.json(config ?? { classworkWeight: 30, examWeight: 70 });
  } catch {
    return NextResponse.json({ classworkWeight: 30, examWeight: 70 });
  }
}
