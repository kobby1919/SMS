// src/app/api/form-data/students/route.ts
 

import { NextResponse } from "next/server";
import prisma from "@/src/lib/prisma";
import { requireRole, unauthorizedResponse } from "@/src/lib/authz";

export async function GET() {
  try {
    const { schoolId } = await requireRole(["admin", "teacher", "bursar"]);

  const students = await prisma.student.findMany({
    where: { schoolId },
    select: {
      id:      true,
      name:    true,
      surname: true,
      class:   { select: { name: true } },
    },
    orderBy: [{ name: "asc" }, { surname: "asc" }],
  });

  return NextResponse.json(
    students.map((s) => ({
      id:        s.id,
      name:      s.name,
      surname:   s.surname,
      className: s.class.name,
    }))
  );
  } catch (error) {
    return unauthorizedResponse(error);
  }
}
