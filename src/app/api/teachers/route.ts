// src/app/api/teachers/route.ts — POST (create)

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/src/lib/prisma";
import { auth, clerkClient } from "@clerk/nextjs/server";

export async function POST(req: NextRequest) {
  const { sessionClaims } = await auth();
  const role = (sessionClaims?.metadata as { role?: string })?.role;
  if (role !== "admin") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
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

    // 1. Create Clerk user
    const clerk  = await clerkClient();
    const clerkUser = await clerk.users.createUser({
      username,
      emailAddress: [email],
      password,
      firstName: name,
      lastName:  surname,
      publicMetadata: { role: "teacher" },
    });

    // 2. Save to DB using Clerk ID
    const teacher = await prisma.teacher.create({
      data: {
        id:        clerkUser.id,
        username,
        name,
        surname,
        email,
        phone:     phone  || null,
        address,
        bloodType,
        sex,
        subjects: subjectIds.length
          ? { connect: subjectIds.map((id) => ({ id })) }
          : undefined,
      },
    });

    return NextResponse.json(teacher, { status: 201 });
  } catch (e: any) {
    // Clerk error codes
    if (e?.errors?.[0]?.code === "form_identifier_exists") {
      return NextResponse.json({ error: "Username or email already exists." }, { status: 409 });
    }
    return NextResponse.json({ error: e?.message ?? "Failed to create teacher." }, { status: 500 });
  }
}