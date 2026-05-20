// ─────────────────────────────────────────────────────────────────────────────
// src/app/api/form-data/classes/route.ts
// GET /api/form-data/classes
// ─────────────────────────────────────────────────────────────────────────────
import { NextResponse } from "next/server";
import prisma from "@/src/lib/prisma";
import { requireRole, unauthorizedResponse } from "@/src/lib/authz";

export async function GET() {
  try {
    const { schoolId } = await requireRole(["admin", "teacher", "bursar"]);

  const classes = await prisma.class.findMany({
    where: { schoolId },
    select: {
      id:    true,
      name:  true,
      grade: { select: { level: true, order: true } },
    },
    orderBy: [{ grade: { order: "asc" } }, { name: "asc" }],
  });
  return NextResponse.json(classes);
  } catch (error) {
    return unauthorizedResponse(error);
  }
}
