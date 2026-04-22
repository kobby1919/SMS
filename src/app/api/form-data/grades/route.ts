// src/app/api/form-data/grades/route.ts
import { NextResponse } from "next/server";
import prisma from "@/src/lib/prisma";

export async function GET() {
  const grades = await prisma.grade.findMany({
    select: { id: true, level: true, order: true },
    orderBy: { order: "asc" },
  });
  return NextResponse.json(grades);
}