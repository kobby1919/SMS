// src/app/api/students/[id]/route.ts — PUT (update)

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/src/lib/prisma";
import { clerkClient } from "@clerk/nextjs/server";
import { requireRole, unauthorizedResponse } from "@/src/lib/authz";
import { revalidateDashboard, revalidateReferenceData } from "@/src/lib/cacheTags";
import { parseBody } from "@/src/lib/validation/parse";
import { studentUpdateSchema } from "@/src/lib/validation/users";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { schoolId } = await requireRole(["admin"]);
    const { id } = await params;

    const formData  = await req.formData();
    const parsed = parseBody(studentUpdateSchema, {
      name: formData.get("name"),
      surname: formData.get("surname"),
      phone: formData.get("phone"),
      address: formData.get("address"),
      bloodType: formData.get("bloodType"),
      sex: formData.get("sex"),
      classId: formData.get("classId"),
      parentId: formData.get("parentId"),
    });
    if (!parsed.ok) return parsed.response;
    const { name, surname, phone, address, bloodType, sex, classId, parentId } = parsed.data;

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

    revalidateReferenceData(schoolId, "students");
    revalidateDashboard(schoolId);

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
