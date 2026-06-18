// src/app/api/teachers/route.ts — POST (create)

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/src/lib/prisma";
import { clerkClient } from "@clerk/nextjs/server";
import { requireRole, unauthorizedResponse } from "@/src/lib/authz";
import { revalidateDashboard, revalidateReferenceData } from "@/src/lib/cacheTags";
import { parseBody } from "@/src/lib/validation/parse";
import { teacherCreateSchema } from "@/src/lib/validation/users";

export async function POST(req: NextRequest) {
  try {
    const { schoolId } = await requireRole(["admin"]);

    const formData = await req.formData();
    const parsedSubjectIds = parseSubjectIds(formData.get("subjectIds"));
    if (!parsedSubjectIds.ok) return parsedSubjectIds.response;

    const parsed = parseBody(teacherCreateSchema, {
      username: formData.get("username"),
      email: formData.get("email"),
      password: formData.get("password"),
      name: formData.get("name"),
      surname: formData.get("surname"),
      phone: formData.get("phone") || null,
      address: formData.get("address"),
      bloodType: formData.get("bloodType"),
      sex: formData.get("sex"),
      subjectIds: parsedSubjectIds.data,
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
      subjectIds,
    } = parsed.data;
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

    revalidateReferenceData(schoolId, "teachers");
    if (subjectIds.length) revalidateReferenceData(schoolId, "subjects");
    revalidateReferenceData(schoolId, "timetable");
    revalidateDashboard(schoolId);

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

function parseSubjectIds(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || value.length === 0) {
    return { ok: true as const, data: [] };
  }

  try {
    const parsed = JSON.parse(value);
    return { ok: true as const, data: parsed };
  } catch {
    return {
      ok: false as const,
      response: NextResponse.json(
        {
          error: "Validation failed",
          issues: { subjectIds: ["Invalid subject list."] },
        },
        { status: 400 },
      ),
    };
  }
}
