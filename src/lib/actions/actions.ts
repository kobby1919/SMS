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

// ─────────────────────────────────────────────────────────────────────────────
// EXAM ACTIONS
// ─────────────────────────────────────────────────────────────────────────────
 
export type ExamFormData = {
  id?:       number;
  title:     string;
  lessonId:  number;
  startTime: string; // ISO string
  endTime:   string; // ISO string
};
 
export async function createExam(data: ExamFormData): Promise<void> {
  await prisma.exam.create({
    data: {
      title:     data.title,
      lessonId:  data.lessonId,
      startTime: new Date(data.startTime),
      endTime:   new Date(data.endTime),
    },
  });
  revalidatePath("/list/exams");
}
 
export async function updateExam(data: ExamFormData): Promise<void> {
  if (!data.id) throw new Error("Exam ID required for update.");
  await prisma.exam.update({
    where: { id: data.id },
    data: {
      title:     data.title,
      lessonId:  data.lessonId,
      startTime: new Date(data.startTime),
      endTime:   new Date(data.endTime),
    },
  });
  revalidatePath("/list/exams");
}
 
export async function deleteExam(id: number): Promise<void> {
  await prisma.exam.delete({ where: { id } });
  revalidatePath("/list/exams");
}

// ─────────────────────────────────────────────────────────────────────────────
// RESULT ACTIONS
// ─────────────────────────────────────────────────────────────────────────────
 
export type ResultFormData = {
  id?:          number;
  score:        number;
  studentId:    string;
  examId?:      number | null;
  assignmentId?: number | null;
};
 
export async function createResult(data: ResultFormData): Promise<void> {
  if (!data.examId && !data.assignmentId) {
    throw new Error("Either an exam or assignment must be selected.");
  }
  await prisma.result.create({
    data: {
      score:        data.score,
      studentId:    data.studentId,
      examId:       data.examId       ?? null,
      assignmentId: data.assignmentId ?? null,
    },
  });
  revalidatePath("/list/results");
}
 
export async function updateResult(data: ResultFormData): Promise<void> {
  if (!data.id) throw new Error("Result ID required for update.");
  await prisma.result.update({
    where: { id: data.id },
    data: {
      score:        data.score,
      studentId:    data.studentId,
      examId:       data.examId       ?? null,
      assignmentId: data.assignmentId ?? null,
    },
  });
  revalidatePath("/list/results");
}
 
export async function deleteResult(id: number): Promise<void> {
  await prisma.result.delete({ where: { id } });
  revalidatePath("/list/results");
}
 
 