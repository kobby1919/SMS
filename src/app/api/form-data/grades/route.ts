// src/app/api/form-data/grades/route.ts
import { NextResponse } from "next/server";
import prisma from "@/src/lib/prisma";
import { requireRole, unauthorizedResponse } from "@/src/lib/authz";

export async function GET() {
  try {
    const { schoolId } = await requireRole(["admin", "teacher", "bursar"]);

  const grades = await prisma.grade.findMany({
    where: { schoolId },
    select: { id: true, level: true, order: true },
    orderBy: { order: "asc" },
  });
  return NextResponse.json(grades);
  } catch (error) {
    return unauthorizedResponse(error);
  }
}
