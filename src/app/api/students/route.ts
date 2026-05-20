// src/app/api/students/route.ts — POST (create)

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/src/lib/prisma";
import { clerkClient } from "@clerk/nextjs/server";
import { requireRole, unauthorizedResponse } from "@/src/lib/authz";

export async function POST(req: NextRequest) {
  try {
    const { schoolId } = await requireRole(["admin"]);

    const formData  = await req.formData();
    const username  = formData.get("username")  as string;
    const email     = formData.get("email")     as string | null;
    const password  = formData.get("password")  as string;
    const name      = formData.get("name")      as string;
    const surname   = formData.get("surname")   as string;
    const phone     = formData.get("phone")     as string | null;
    const address   = formData.get("address")   as string;
    const bloodType = formData.get("bloodType") as string;
    const sex       = formData.get("sex")       as "MALE" | "FEMALE";
    const classId   = parseInt(formData.get("classId")  as string);
    const parentId  = formData.get("parentId") as string;

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
