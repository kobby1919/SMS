// ─────────────────────────────────────────────────────────────────────────────
// src/app/api/form-data/subjects/route.ts
// GET /api/form-data/subjects
// ─────────────────────────────────────────────────────────────────────────────
import { NextResponse } from "next/server";
import prisma from "@/src/lib/prisma";

export async function GET() {
  const subjects = await prisma.subject.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(subjects);
}