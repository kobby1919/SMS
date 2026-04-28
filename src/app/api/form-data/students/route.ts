// src/app/api/form-data/students/route.ts
// GET /api/form-data/students
// Returns all students with class name — used by ResultForm student picker.

import { NextResponse } from "next/server";
import prisma from "@/src/lib/prisma";

export async function GET() {
  const students = await prisma.student.findMany({
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
}