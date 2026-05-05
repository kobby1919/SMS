// src/app/api/form-data/lessons/route.ts

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/src/lib/prisma";

export async function GET() {
  const { userId, sessionClaims } = await auth();
  const role = (sessionClaims?.metadata as { role?: string })?.role;

  if (!userId || (role !== "admin" && role !== "teacher")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // For teachers: fetch ONLY lessons where they are the assigned teacher.
  // This means only subjects they personally teach, in the exact classes
  // they are timetabled for — nothing more.
  const where = role === "teacher"
    ? { teacherId: userId }   // strictly their own lessons
    : {};                      // admin sees everything

  const lessons = await prisma.lesson.findMany({
    where,
    select: {
      id:      true,
      day:     true,
      subject: { select: { id: true, name: true } },
      class:   { select: { id: true, name: true } },
      teacher: { select: { name: true, surname: true } },
    },
    orderBy: [
      { class:   { name: "asc" } },
      { subject: { name: "asc" } },
      { day:     "asc" },
    ],
  });

  // Deduplicate by subjectId + classId so each subject-class pair
  // appears only once even if the lesson runs multiple times a week
  // (e.g. Math 4A appears Mon AND Wed → show once as "Math · 4A")
  const seen   = new Set<string>();
  const unique = lessons.filter((l) => {
    const key = `${l.subject.id}-${l.class.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return NextResponse.json(
    unique.map((l) => ({
      id:          l.id,
      day:         l.day,
      subjectName: l.subject.name,
      className:   l.class.name,
      teacherName: `${l.teacher.name} ${l.teacher.surname}`,
    }))
  );
}