// src/app/api/students/[id]/route.ts — PUT (update)

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/src/lib/prisma";
import { clerkClient } from "@clerk/nextjs/server";
import { requireRole, unauthorizedResponse } from "@/src/lib/authz";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { schoolId } = await requireRole(["admin"]);
    const { id } = await params;

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
    const cls = await prisma.class.findFirst({
      where: { id: classId, schoolId },
      select: { gradeId: true },
    });
    if (!cls) return NextResponse.json({ error: "Class not found." }, { status: 404 });

    const parent = await prisma.parent.findFirst({
      where: { id: parentId, schoolId },
      select: { id: true },
    });
    if (!parent) return NextResponse.json({ error: "Parent not found." }, { status: 404 });

    const existingStudent = await prisma.student.findFirst({
      where: { id, schoolId },
      select: { id: true },
    });
    if (!existingStudent) return NextResponse.json({ error: "Student not found." }, { status: 404 });

    // Update Clerk
    const clerk = await clerkClient();
    await clerk.users.updateUser(id, {
      firstName: name,
      lastName:  surname,
    });

    // Update DB
    const student = await prisma.student.update({
      where: { id },
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
  } catch (e: unknown) {
    if (isAuthorizationError(e)) return unauthorizedResponse(e);
    return NextResponse.json({ error: getErrorMessage(e, "Failed to update student.") }, { status: 500 });
  }
}

function isAuthorizationError(error: unknown) {
  return error instanceof Error && error.name === "AuthorizationError";
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}
