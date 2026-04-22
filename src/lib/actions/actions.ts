"use server";

// src/lib/actions/actions.ts
// Central server actions file for all table CRUD operations

import prisma from "@/src/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";

// ─── Auth guard helper ────────────────────────────────────────────────────────
async function requireAdmin() {
  const { sessionClaims } = await auth();
  const role = (sessionClaims?.metadata as { role?: string })?.role;
  if (role !== "admin") throw new Error("Unauthorized");
}

// ═══════════════════════════════════════════════════════════════════════════════
// LESSON
// ═══════════════════════════════════════════════════════════════════════════════
export async function deleteLesson(id: number) {
  await requireAdmin();
  await prisma.lesson.delete({ where: { id } });
  revalidatePath("/list/lessons");
  revalidatePath("/admin/timetable");
}

// ═══════════════════════════════════════════════════════════════════════════════
// CLASS
// ═══════════════════════════════════════════════════════════════════════════════
export async function createClass(data: {
  name: string;
  capacity: number;
  gradeId: number;
  section?: string;
  supervisorId?: string;
}) {
  await requireAdmin();
  await prisma.class.create({ data });
  revalidatePath("/list/classes");
}

export async function updateClass(id: number, data: {
  name?: string;
  capacity?: number;
  gradeId?: number;
  section?: string;
  supervisorId?: string | null;
}) {
  await requireAdmin();
  await prisma.class.update({ where: { id }, data });
  revalidatePath("/list/classes");
}

export async function deleteClass(id: number) {
  await requireAdmin();
  await prisma.class.delete({ where: { id } });
  revalidatePath("/list/classes");
  revalidatePath("/admin/timetable");
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUBJECT
// ═══════════════════════════════════════════════════════════════════════════════
export async function createSubject(data: { name: string; teacherIds?: string[] }) {
  await requireAdmin();
  await prisma.subject.create({
    data: {
      name: data.name,
      teachers: data.teacherIds?.length
        ? { connect: data.teacherIds.map((id) => ({ id })) }
        : undefined,
    },
  });
  revalidatePath("/list/subjects");
}

export async function updateSubject(id: number, data: { name?: string; teacherIds?: string[] }) {
  await requireAdmin();
  await prisma.subject.update({
    where: { id },
    data: {
      name: data.name,
      teachers: data.teacherIds
        ? { set: data.teacherIds.map((tid) => ({ id: tid })) }
        : undefined,
    },
  });
  revalidatePath("/list/subjects");
}

export async function deleteSubject(id: number) {
  await requireAdmin();
  await prisma.subject.delete({ where: { id } });
  revalidatePath("/list/subjects");
  revalidatePath("/admin/timetable");
}

// ═══════════════════════════════════════════════════════════════════════════════
// PARENT
// ═══════════════════════════════════════════════════════════════════════════════
export async function deleteParent(id: string) {
  await requireAdmin();
  await prisma.parent.delete({ where: { id } });
  revalidatePath("/list/parents");
}

// ═══════════════════════════════════════════════════════════════════════════════
// TEACHER
// ═══════════════════════════════════════════════════════════════════════════════
export async function deleteTeacher(id: string) {
  await requireAdmin();
  await prisma.teacher.delete({ where: { id } });
  revalidatePath("/list/teachers");
  revalidatePath("/admin/timetable");
}

// ═══════════════════════════════════════════════════════════════════════════════
// STUDENT
// ═══════════════════════════════════════════════════════════════════════════════
export async function deleteStudent(id: string) {
  await requireAdmin();
  await prisma.student.delete({ where: { id } });
  revalidatePath("/list/students");
}