// src/lib/actions/lesson.actions.ts
// Server actions for lesson CRUD — used by FormModal delete

"use server";

import prisma from "@/src/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";

export async function deleteLesson(id: number) {
  const { sessionClaims } = await auth();
  const role = (sessionClaims?.metadata as { role?: string })?.role;

  if (role !== "admin") {
    throw new Error("Unauthorized");
  }

  await prisma.lesson.delete({ where: { id } });

  revalidatePath("/list/lessons");
  revalidatePath("/admin/timetable");
}