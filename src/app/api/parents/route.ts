// src/app/api/parents/route.ts  — POST (create)
// src/app/api/parents/[id]/route.ts — PUT (update)

// ─── POST /api/parents ────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/src/lib/prisma";
import { requireRole, unauthorizedResponse } from "@/src/lib/authz";

export async function POST(req: NextRequest) {
  try {
    const { schoolId } = await requireRole(["admin"]);

  const body = await req.json();
  const { username, name, surname, email, phone, address } = body;

  if (!username || !name || !surname || !address) {
    return NextResponse.json({ error: "Required fields missing." }, { status: 400 });
  }

  // Check username unique
  const existing = await prisma.parent.findUnique({ where: { username } });
  if (existing) return NextResponse.json({ error: "Username already taken." }, { status: 409 });

  const parent = await prisma.parent.create({
    data: {
      id:       username, // use username as id for simplicity (swap for Clerk id in production)
      schoolId,
      username,
      name,
      surname,
      email:   email   || null,
      phone:   phone   || null,
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
