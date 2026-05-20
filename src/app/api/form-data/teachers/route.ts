// ─────────────────────────────────────────────────────────────────────────────
// src/app/api/form-data/teachers/route.ts
// GET /api/form-data/teachers
// ─────────────────────────────────────────────────────────────────────────────
import { NextResponse } from "next/server";
import prisma from "@/src/lib/prisma";
import { requireRole, unauthorizedResponse } from "@/src/lib/authz";

export async function GET() {
  try {
    const { schoolId } = await requireRole(["admin", "teacher"]);

  const teachers = await prisma.teacher.findMany({
    where: { schoolId },
    select: {
      id:         true,
      name:       true,
      surname:    true,
      maxClasses: true,
    },
    orderBy: [{ name: "asc" }, { surname: "asc" }],
  });
  return NextResponse.json(teachers);
  } catch (error) {
    return unauthorizedResponse(error);
  }
}
