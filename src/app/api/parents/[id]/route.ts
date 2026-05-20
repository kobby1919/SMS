// src/app/api/parents/[id]/route.ts  — PUT (update)

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/src/lib/prisma";
import { requireRole, unauthorizedResponse } from "@/src/lib/authz";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { schoolId } = await requireRole(["admin"]);
    const { id } = await params;

  const body = await req.json();
  const { name, surname, email, phone, address } = body;
  const existingParent = await prisma.parent.findFirst({
    where: { id, schoolId },
    select: { id: true },
  });
  if (!existingParent) return NextResponse.json({ error: "Parent not found." }, { status: 404 });

  const parent = await prisma.parent.update({
    where: { id },
    data: {
      name,
      surname,
      email:   email   || null,
      phone:   phone   || null,
      address,
    },
  });

  return NextResponse.json(parent);
  } catch (error) {
    return unauthorizedResponse(error);
  }
}
