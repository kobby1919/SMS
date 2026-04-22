// src/app/api/students/route.ts — POST (create)

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/src/lib/prisma";
import { auth, clerkClient } from "@clerk/nextjs/server";

export async function POST(req: NextRequest) {
  const { sessionClaims } = await auth();
  const role = (sessionClaims?.metadata as { role?: string })?.role;
  if (role !== "admin") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
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
    const cls = await prisma.class.findUnique({
      where: { id: classId },
      select: { gradeId: true },
    });
    if (!cls) return NextResponse.json({ error: "Class not found." }, { status: 404 });

    // 1. Create Clerk user
    const clerk = await clerkClient();
    const clerkUser = await clerk.users.createUser({
      username,
      ...(email ? { emailAddress: [email] } : {}),
      password,
      firstName: name,
      lastName:  surname,
      publicMetadata: { role: "student" },
    });

    // 2. Save to DB
    const student = await prisma.student.create({
      data: {
        id:        clerkUser.id,
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
  } catch (e: any) {
    if (e?.errors?.[0]?.code === "form_identifier_exists") {
      return NextResponse.json({ error: "Username already exists." }, { status: 409 });
    }
    return NextResponse.json({ error: e?.message ?? "Failed to create student." }, { status: 500 });
  }
}