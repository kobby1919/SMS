// src/app/api/parents/[id]/route.ts  — PUT (update)

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/src/lib/prisma";
import { auth } from "@clerk/nextjs/server";

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { sessionClaims } = await auth();
  const role = (sessionClaims?.metadata as { role?: string })?.role;
  if (role !== "admin") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { name, surname, email, phone, address } = body;

  const parent = await prisma.parent.update({
    where: { id: params.id },
    data: {
      name,
      surname,
      email:   email   || null,
      phone:   phone   || null,
      address,
    },
  });

  return NextResponse.json(parent);
}