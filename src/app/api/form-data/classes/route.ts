// ─────────────────────────────────────────────────────────────────────────────
// src/app/api/form-data/classes/route.ts
// GET /api/form-data/classes
// ─────────────────────────────────────────────────────────────────────────────
import { NextResponse } from "next/server";
import prisma from "@/src/lib/prisma";

export async function GET() {
  const classes = await prisma.class.findMany({
    select: {
      id:    true,
      name:  true,
      grade: { select: { level: true, order: true } },
    },
    orderBy: [{ grade: { order: "asc" } }, { name: "asc" }],
  });
  return NextResponse.json(classes);
}