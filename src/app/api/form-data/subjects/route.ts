// src/app/api/form-data/subjects/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/src/lib/prisma";

// GET /api/form-data/subjects
// GET /api/form-data/subjects?teacherId=xxx  ← returns only that teacher's subjects
export async function GET(req: NextRequest) {
  const teacherId = new URL(req.url).searchParams.get("teacherId");

  const subjects = await prisma.subject.findMany({
    where: teacherId
      ? { teachers: { some: { id: teacherId } } }
      : undefined,
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(subjects);
}