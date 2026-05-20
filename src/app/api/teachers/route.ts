// src/app/api/teachers/route.ts — POST (create)

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/src/lib/prisma";
import { clerkClient } from "@clerk/nextjs/server";
import { requireRole, unauthorizedResponse } from "@/src/lib/authz";

export async function POST(req: NextRequest) {
  try {
    const { schoolId } = await requireRole(["admin"]);

    const formData   = await req.formData();
    const username   = formData.get("username")  as string;
    const email      = formData.get("email")     as string;
    const password   = formData.get("password")  as string;
    const name       = formData.get("name")      as string;
    const surname    = formData.get("surname")   as string;
    const phone      = formData.get("phone")     as string | null;
    const address    = formData.get("address")   as string;
    const bloodType  = formData.get("bloodType") as string;
    const sex        = formData.get("sex")       as "MALE" | "FEMALE";
    const subjectIds = JSON.parse(formData.get("subjectIds") as string ?? "[]") as number[];
    const subjects = subjectIds.length
      ? await prisma.subject.findMany({
          where: { id: { in: subjectIds }, schoolId },
          select: { id: true },
        })
      : [];

    if (subjects.length !== subjectIds.length) {
      return NextResponse.json({ error: "One or more subjects were not found." }, { status: 404 });
    }

    // 1. Create Clerk user
    const clerk  = await clerkClient();
    const clerkUser = await clerk.users.createUser({
      username,
      emailAddress: [email],
      password,
      firstName: name,
      lastName:  surname,
      publicMetadata: { role: "teacher", schoolId },
    });

    // 2. Save to DB using Clerk ID
    const teacher = await prisma.teacher.create({
      data: {
        id:        clerkUser.id,
        schoolId,
        username,
        name,
        surname,
        email,
        phone:     phone  || null,
        address,
        bloodType,
        sex,
        subjects: subjects.length
          ? { connect: subjects.map(({ id }) => ({ id })) }
          : undefined,
      },
    });

    return NextResponse.json(teacher, { status: 201 });
  } catch (e: unknown) {
    if (isAuthorizationError(e)) return unauthorizedResponse(e);
    // Clerk error codes
    if (isClerkIdentifierExistsError(e)) {
      return NextResponse.json({ error: "Username or email already exists." }, { status: 409 });
    }
    return NextResponse.json({ error: getErrorMessage(e, "Failed to create teacher.") }, { status: 500 });
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
