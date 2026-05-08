// src/app/api/parents/route.ts

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/src/lib/prisma";
import { requireRole, unauthorizedResponse } from "@/src/lib/authz";
import { parseBody } from "@/src/lib/validation/parse";
import { parentCreateSchema } from "@/src/lib/validation/users";

export async function POST(req: NextRequest) {
  try {
    const { schoolId } = await requireRole(["admin"]);

    const body = await req.json();
    const parsed = parseBody(parentCreateSchema, body);
    if (!parsed.ok) return parsed.response;

    const { username, name, surname, email, phone, address } = parsed.data;

    const existing = await prisma.parent.findFirst({
      where: { username, schoolId },
    });
    if (existing) {
      return NextResponse.json({ error: "Username already taken." }, { status: 409 });
    }

    const parent = await prisma.parent.create({
      data: {
        id: username,
        schoolId,
        username,
        name,
        surname,
        email: email ?? null,
        phone: phone ?? null,
        address,
      },
    });

    return NextResponse.json(parent, { status: 201 });
  } catch (error) {
    return unauthorizedResponse(error);
  }
}

export async function GET() {
  try {
    const { schoolId } = await requireRole(["admin"]);

    const parents = await prisma.parent.findMany({
      where: { schoolId },
      select: { id: true, name: true, surname: true },
      orderBy: [{ name: "asc" }, { surname: "asc" }],
    });
    return NextResponse.json(parents);
  } catch (error) {
    return unauthorizedResponse(error);
  }
}
