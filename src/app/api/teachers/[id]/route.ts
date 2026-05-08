// src/app/api/teachers/[id]/route.ts — PUT (update)

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/src/lib/prisma";
import { clerkClient } from "@clerk/nextjs/server";
import { requireRole, unauthorizedResponse } from "@/src/lib/authz";
import { revalidateReferenceData } from "@/src/lib/cacheTags";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { schoolId } = await requireRole(["admin"]);
    const { id } = await params;

    const formData   = await req.formData();
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

    const existingTeacher = await prisma.teacher.findFirst({
      where: { id, schoolId },
      select: { id: true },
    });
    if (!existingTeacher) return NextResponse.json({ error: "Teacher not found." }, { status: 404 });

    // Update Clerk user name
    const clerk = await clerkClient();
    await clerk.users.updateUser(id, {
      firstName: name,
      lastName:  surname,
    });

    // Update DB
    const teacher = await prisma.teacher.update({
      where: { id },
      data: {
        name,
        surname,
        phone:    phone || null,
        address,
        bloodType,
        sex,
        subjects: { set: subjects.map(({ id }) => ({ id })) },
      },
    });

    revalidateReferenceData(schoolId, "teachers");
    revalidateReferenceData(schoolId, "subjects");

    return NextResponse.json(teacher);
  } catch (e: unknown) {
    if (isAuthorizationError(e)) return unauthorizedResponse(e);
    return NextResponse.json({ error: getErrorMessage(e, "Failed to update teacher.") }, { status: 500 });
  }
}

function isAuthorizationError(error: unknown) {
  return error instanceof Error && error.name === "AuthorizationError";
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}
