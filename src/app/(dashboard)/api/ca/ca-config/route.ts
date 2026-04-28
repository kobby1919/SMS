// src/app/api/ca/config/route.ts
// Returns the CA config for a given academic year.
// Falls back to { classworkWeight: 30, examWeight: 70 } if not found.

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/src/lib/prisma";

export async function GET(req: NextRequest) {
  const year = req.nextUrl.searchParams.get("year");
  if (!year) {
    return NextResponse.json({ classworkWeight: 30, examWeight: 70 });
  }

  try {
    const config = await prisma.cAConfig.findUnique({
      where: { academicYear: year },
      select: { classworkWeight: true, examWeight: true },
    });

    return NextResponse.json(config ?? { classworkWeight: 30, examWeight: 70 });
  } catch {
    return NextResponse.json({ classworkWeight: 30, examWeight: 70 });
  }
}