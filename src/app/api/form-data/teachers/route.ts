// ─────────────────────────────────────────────────────────────────────────────
// src/app/api/form-data/teachers/route.ts
// GET /api/form-data/teachers
// ─────────────────────────────────────────────────────────────────────────────
import { NextResponse } from "next/server";
import prisma from "@/src/lib/prisma";

export async function GET() {
  const teachers = await prisma.teacher.findMany({
    select: {
      id:         true,
      name:       true,
      surname:    true,
      maxClasses: true,
    },
    orderBy: [{ name: "asc" }, { surname: "asc" }],
  });
  return NextResponse.json(teachers);
}