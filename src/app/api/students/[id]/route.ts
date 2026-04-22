// src/app/api/students/[id]/route.ts — PUT (update)

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
    const formData  = await req.formData();
    const name      = formData.get("name")      as string;
    const surname   = formData.get("surname")   as string;
    const phone     = formData.get("phone")     as string | null;
    const address   = formData.get("address")   as string;
    const bloodType = formData.get("bloodType") as string;
    const sex       = formData.get("sex")       as "MALE" | "FEMALE";
    const classId   = parseInt(formData.get("classId") as string);
    const parentId  = formData.get("parentId") as string;

    // Get gradeId from new class
    const cls = await prisma.class.findUnique({
      where: { id: classId },
      select: { gradeId: true },
    });
    if (!cls) return NextResponse.json({ error: "Class not found." }, { status: 404 });

    // Update Clerk
    const clerk = await clerkClient();
    await clerk.users.updateUser(params.id, {
      firstName: name,
      lastName:  surname,
    });

    // Update DB
    const student = await prisma.student.update({
      where: { id: params.id },
      data: {
        name,
        surname,
        phone:    phone || null,
        address,
        bloodType,
        sex,
        classId,
        gradeId:  cls.gradeId,
        parentId,
      },
    });

    return NextResponse.json(student);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Failed to update student." }, { status: 500 });
  }
}