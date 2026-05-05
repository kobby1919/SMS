"use server";

// src/lib/actions/actions.ts

import prisma from "@/src/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";

// ─── Auth guards ──────────────────────────────────────────────────────────────
async function requireAdmin() {
  const { sessionClaims } = await auth();
  const role = (sessionClaims?.metadata as { role?: string })?.role;
  if (role !== "admin") throw new Error("Unauthorized");
}

async function requireAdminOrTeacher() {
  const { sessionClaims } = await auth();
  const role = (sessionClaims?.metadata as { role?: string })?.role;
  if (role !== "admin" && role !== "teacher") throw new Error("Unauthorized");
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
  name: string; capacity: number; gradeId: number;
  section?: string; supervisorId?: string;
}) {
  await requireAdmin();
  await prisma.class.create({ data });
  revalidatePath("/list/classes");
}

export async function updateClass(id: number, data: {
  name?: string; capacity?: number; gradeId?: number;
  section?: string; supervisorId?: string | null;
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
// PARENT / TEACHER / STUDENT
// ═══════════════════════════════════════════════════════════════════════════════
export async function deleteParent(id: string) {
  await requireAdmin();
  await prisma.parent.delete({ where: { id } });
  revalidatePath("/list/parents");
}

export async function deleteTeacher(id: string) {
  await requireAdmin();
  await prisma.teacher.delete({ where: { id } });
  revalidatePath("/list/teachers");
  revalidatePath("/admin/timetable");
}

export async function deleteStudent(id: string) {
  await requireAdmin();
  await prisma.student.delete({ where: { id } });
  revalidatePath("/list/students");
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXAM
// ═══════════════════════════════════════════════════════════════════════════════
export type ExamFormData = {
  id?:       number;
  title:     string;
  lessonId:  number;
  startTime: string;
  endTime:   string;
};

export async function createExam(data: ExamFormData): Promise<void> {
  await requireAdminOrTeacher();

  const exam = await prisma.exam.create({
    data: {
      title:     data.title,
      lessonId:  data.lessonId,
      startTime: new Date(data.startTime),
      endTime:   new Date(data.endTime),
    },
    include: {
      lesson: {
        select: {
          subject: { select: { name: true } },
          class:   { select: { id: true, name: true } },
        },
      },
    },
  });

  const examDate  = new Intl.DateTimeFormat("en-GH", { day: "numeric", month: "long", year: "numeric" }).format(new Date(data.startTime));
  const startFmt  = new Intl.DateTimeFormat("en-GH", { hour: "2-digit", minute: "2-digit" }).format(new Date(data.startTime));
  const endFmt    = new Intl.DateTimeFormat("en-GH", { hour: "2-digit", minute: "2-digit" }).format(new Date(data.endTime));

  await prisma.announcement.create({
    data: {
      title:       `📝 Exam Scheduled: ${exam.lesson.subject.name}`,
      description: `${data.title} for ${exam.lesson.class.name} has been scheduled on ${examDate} from ${startFmt} to ${endFmt}. Please prepare accordingly.`,
      date:        new Date(),
      classId:     exam.lesson.class.id,
    },
  });

  revalidatePath("/list/exams");
  revalidatePath("/list/announcements");
}

export async function updateExam(data: ExamFormData): Promise<void> {
  if (!data.id) throw new Error("Exam ID required for update.");
  await requireAdminOrTeacher();

  const exam = await prisma.exam.update({
    where: { id: data.id },
    data: {
      title:     data.title,
      lessonId:  data.lessonId,
      startTime: new Date(data.startTime),
      endTime:   new Date(data.endTime),
    },
    include: {
      lesson: {
        select: {
          subject: { select: { name: true } },
          class:   { select: { id: true, name: true } },
        },
      },
    },
  });

  const examDate = new Intl.DateTimeFormat("en-GH", { day: "numeric", month: "long", year: "numeric" }).format(new Date(data.startTime));
  const startFmt = new Intl.DateTimeFormat("en-GH", { hour: "2-digit", minute: "2-digit" }).format(new Date(data.startTime));
  const endFmt   = new Intl.DateTimeFormat("en-GH", { hour: "2-digit", minute: "2-digit" }).format(new Date(data.endTime));

  const announcementData = {
    title:       `📝 Exam Rescheduled: ${exam.lesson.subject.name}`,
    description: `${data.title} for ${exam.lesson.class.name} has been updated to ${examDate} from ${startFmt} to ${endFmt}.`,
    date:        new Date(),
    classId:     exam.lesson.class.id,
  };

  const existing = await prisma.announcement.findFirst({
    where: { title: { contains: "Exam" }, classId: exam.lesson.class.id, date: { gte: new Date(Date.now() - 7 * 86400000) } },
    orderBy: { date: "desc" },
  });

  if (existing) await prisma.announcement.update({ where: { id: existing.id }, data: announcementData });
  else          await prisma.announcement.create({ data: announcementData });

  revalidatePath("/list/exams");
  revalidatePath("/list/announcements");
}

export async function deleteExam(id: number): Promise<void> {
  await requireAdminOrTeacher();
  await prisma.exam.delete({ where: { id } });
  revalidatePath("/list/exams");
}

// ═══════════════════════════════════════════════════════════════════════════════
// ASSIGNMENT — teacher only creates; auto-announces to class
// ═══════════════════════════════════════════════════════════════════════════════
export type AssignmentFormData = {
  id?:       number;
  title:     string;
  lessonId:  number;
  startDate: string; // ISO string
  dueDate:   string; // ISO string
};

export async function createAssignment(data: AssignmentFormData): Promise<void> {
  await requireAdminOrTeacher();

  const assignment = await prisma.assignment.create({
    data: {
      title:     data.title,
      lessonId:  data.lessonId,
      startDate: new Date(data.startDate),
      dueDate:   new Date(data.dueDate),
    },
    include: {
      lesson: {
        select: {
          subject: { select: { name: true } },
          class:   { select: { id: true, name: true } },
          teacher: { select: { name: true, surname: true } },
        },
      },
    },
  });

  const dueFmt = new Intl.DateTimeFormat("en-GH", { day: "numeric", month: "long", year: "numeric" }).format(new Date(data.dueDate));

  await prisma.announcement.create({
    data: {
      title:       `📚 New Assignment: ${assignment.lesson.subject.name}`,
      description: `${data.title} has been assigned to ${assignment.lesson.class.name} by ${assignment.lesson.teacher.name} ${assignment.lesson.teacher.surname}. Due: ${dueFmt}.`,
      date:        new Date(),
      classId:     assignment.lesson.class.id,
    },
  });

  revalidatePath("/list/assignments");
  revalidatePath("/list/announcements");
}

export async function updateAssignment(data: AssignmentFormData): Promise<void> {
  if (!data.id) throw new Error("Assignment ID required for update.");
  await requireAdminOrTeacher();

  const assignment = await prisma.assignment.update({
    where: { id: data.id },
    data: {
      title:     data.title,
      lessonId:  data.lessonId,
      startDate: new Date(data.startDate),
      dueDate:   new Date(data.dueDate),
    },
    include: {
      lesson: {
        select: {
          subject: { select: { name: true } },
          class:   { select: { id: true, name: true } },
          teacher: { select: { name: true, surname: true } },
        },
      },
    },
  });

  const dueFmt = new Intl.DateTimeFormat("en-GH", { day: "numeric", month: "long", year: "numeric" }).format(new Date(data.dueDate));

  const announcementData = {
    title:       `📚 Assignment Updated: ${assignment.lesson.subject.name}`,
    description: `${data.title} for ${assignment.lesson.class.name} has been updated. New due date: ${dueFmt}.`,
    date:        new Date(),
    classId:     assignment.lesson.class.id,
  };

  const existing = await prisma.announcement.findFirst({
    where: {
      title:   { contains: assignment.lesson.subject.name },
      classId: assignment.lesson.class.id,
      date:    { gte: new Date(Date.now() - 14 * 86400000) },
    },
    orderBy: { date: "desc" },
  });

  if (existing) await prisma.announcement.update({ where: { id: existing.id }, data: announcementData });
  else          await prisma.announcement.create({ data: announcementData });

  revalidatePath("/list/assignments");
  revalidatePath("/list/announcements");
}

export async function deleteAssignment(id: number): Promise<void> {
  await requireAdminOrTeacher();
  await prisma.assignment.delete({ where: { id } });
  revalidatePath("/list/assignments");
}

// ═══════════════════════════════════════════════════════════════════════════════
// RESULT
// ═══════════════════════════════════════════════════════════════════════════════
export type ResultFormData = {
  id?:           number;
  score:         number;
  studentId:     string;
  examId?:       number | null;
  assignmentId?: number | null;
};

export async function createResult(data: ResultFormData): Promise<void> {
  if (!data.examId && !data.assignmentId) throw new Error("Either an exam or assignment must be selected.");
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