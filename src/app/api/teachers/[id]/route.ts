// src/app/api/teachers/[id]/route.ts — PUT (update)

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/src/lib/prisma";
import { auth, clerkClient } from "@clerk/nextjs/server";

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { sessionClaims } = await auth();
  const role = (sessionClaims?.metadata as { role?: string })?.role;
  if (role !== "admin") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const formData   = await req.formData();
    const name       = formData.get("name")      as string;
    const surname    = formData.get("surname")   as string;
    const phone      = formData.get("phone")     as string | null;
    const address    = formData.get("address")   as string;
    const bloodType  = formData.get("bloodType") as string;
    const sex        = formData.get("sex")       as "MALE" | "FEMALE";
    const subjectIds = JSON.parse(formData.get("subjectIds") as string ?? "[]") as number[];

    // Update Clerk user name
    const clerk = await clerkClient();
    await clerk.users.updateUser(params.id, {
      firstName: name,
      lastName:  surname,
    });

    // Update DB
    const teacher = await prisma.teacher.update({
      where: { id: params.id },
      data: {
        name,
        surname,
        phone:    phone || null,
        address,
        bloodType,
        sex,
        subjects: { set: subjectIds.map((id) => ({ id })) },
      },
    });

    return NextResponse.json(teacher);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Failed to update teacher." }, { status: 500 });
  }
}