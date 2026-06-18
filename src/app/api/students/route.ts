// src/app/api/students/route.ts — POST (create)

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/src/lib/prisma";
import { clerkClient } from "@clerk/nextjs/server";
import { requireRole, unauthorizedResponse } from "@/src/lib/authz";
import { revalidateDashboard, revalidateReferenceData } from "@/src/lib/cacheTags";
import { parseBody } from "@/src/lib/validation/parse";
import { studentCreateSchema } from "@/src/lib/validation/users";

export async function POST(req: NextRequest) {
  try {
    const { schoolId } = await requireRole(["admin"]);

    const formData = await req.formData();
    const parsed = parseBody(studentCreateSchema, {
      username: formData.get("username"),
      email: formData.get("email") || "",
      password: formData.get("password"),
      name: formData.get("name"),
      surname: formData.get("surname"),
      phone: formData.get("phone") || null,
      address: formData.get("address"),
      bloodType: formData.get("bloodType"),
      sex: formData.get("sex"),
      classId: formData.get("classId"),
      parentId: formData.get("parentId"),
    });
    if (!parsed.ok) return parsed.response;

    const {
      username,
      email,
      password,
      name,
      surname,
      phone,
      address,
      bloodType,
      sex,
      classId,
      parentId,
    } = parsed.data;

    // Get gradeId from class
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

    // 1. Create Clerk user
    const clerk = await clerkClient();
    const clerkUser = await clerk.users.createUser({
      username,
      ...(email ? { emailAddress: [email] } : {}),
      password,
      firstName: name,
      lastName:  surname,
      publicMetadata: { role: "student", schoolId },
    });

    // 2. Save to DB
    const student = await prisma.student.create({
      data: {
        id:        clerkUser.id,
        schoolId,
        username,
        name,
        surname,
        email:     email    || null,
        phone:     phone    || null,
        address,
        bloodType,
        sex,
        classId,
        gradeId:   cls.gradeId,
        parentId,
      },
    });

    revalidateReferenceData(schoolId, "students");
    revalidateDashboard(schoolId);

    return NextResponse.json(student, { status: 201 });
  } catch (e: unknown) {
    if (isAuthorizationError(e)) return unauthorizedResponse(e);
    if (isClerkIdentifierExistsError(e)) {
      return NextResponse.json({ error: "Username already exists." }, { status: 409 });
    }
    return NextResponse.json({ error: getErrorMessage(e, "Failed to create student.") }, { status: 500 });
  }
}

function isAuthorizationError(error: unknown) {
  return error instanceof Error && error.name === "AuthorizationError";
}

function isClerkIdentifierExistsError(error: unknown) {
  return typeof error === "object" &&
    error !== null &&
    "errors" in error &&
    Array.isArray((error as { errors?: unknown }).errors) &&
    (error as { errors: Array<{ code?: string }> }).errors[0]?.code === "form_identifier_exists";
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}
