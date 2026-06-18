"use server";

// src/lib/actions/actions.ts

import prisma from "@/src/lib/prisma";
import { requireRole } from "@/src/lib/authz";
import { requireResourceAccess } from "@/src/lib/authz";
import { assertSameSchool } from "@/src/lib/tenant";
import { revalidatePath } from "next/cache";
import { revalidateDashboard, revalidateReferenceData } from "@/src/lib/cacheTags";
import { parseActionInput } from "@/src/lib/validation/parse";
import {
  assignmentFormSchema,
  examFormSchema,
  resultFormSchema,
} from "@/src/lib/validation/academic";

// ─── Auth guards ──────────────────────────────────────────────────────────────
const requireAdmin = () => requireRole(["admin"]);
const requireAdminOrTeacher = () => requireRole(["admin", "teacher"]);

async function getLessonInSchool(lessonId: number, schoolId: string) {
  const lesson = await prisma.lesson.findFirst({
    where: { id: lessonId, schoolId },
    select: { id: true, schoolId: true },
  });
  assertSameSchool(lesson, schoolId);
  return lesson;
}

// ═══════════════════════════════════════════════════════════════════════════════
// LESSON
// ═══════════════════════════════════════════════════════════════════════════════
export async function deleteLesson(id: number) {
  const { schoolId } = await requireAdmin();
  await prisma.lesson.deleteMany({ where: { id, schoolId } });
  revalidatePath("/list/lessons");
  revalidatePath("/admin/timetable");
  revalidateReferenceData(schoolId, "timetable");
  revalidateDashboard(schoolId);
}

// ═══════════════════════════════════════════════════════════════════════════════
// CLASS
// ═══════════════════════════════════════════════════════════════════════════════
export async function createClass(data: {
  name: string; capacity: number; gradeId: number;
  section?: string; supervisorId?: string;
}) {
  const { schoolId } = await requireAdmin();
  await prisma.class.create({ data: { ...data, schoolId } });
  revalidatePath("/list/classes");
  revalidateReferenceData(schoolId, "classes");
  revalidateDashboard(schoolId);
}

export async function updateClass(id: number, data: {
  name?: string; capacity?: number; gradeId?: number;
  section?: string; supervisorId?: string | null;
}) {
  const { schoolId } = await requireAdmin();
  const existing = await prisma.class.findFirst({ where: { id, schoolId } });
  assertSameSchool(existing, schoolId);
  await prisma.class.update({ where: { id }, data });
  revalidatePath("/list/classes");
  revalidateReferenceData(schoolId, "classes");
  revalidateReferenceData(schoolId, "students");
  revalidateDashboard(schoolId);
}

export async function deleteClass(id: number) {
  const { schoolId } = await requireAdmin();
  await prisma.class.deleteMany({ where: { id, schoolId } });
  revalidatePath("/list/classes");
  revalidatePath("/admin/timetable");
  revalidateReferenceData(schoolId, "classes");
  revalidateReferenceData(schoolId, "students");
  revalidateReferenceData(schoolId, "timetable");
  revalidateDashboard(schoolId);
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUBJECT
// ═══════════════════════════════════════════════════════════════════════════════
export async function createSubject(data: { name: string; teacherIds?: string[] }) {
  const { schoolId } = await requireAdmin();
  await prisma.subject.create({
    data: {
      schoolId,
      name: data.name,
      teachers: data.teacherIds?.length
        ? { connect: data.teacherIds.map((id) => ({ id })) }
        : undefined,
    },
  });
  revalidatePath("/list/subjects");
  revalidateReferenceData(schoolId, "subjects");
  revalidateDashboard(schoolId);
}

export async function updateSubject(id: number, data: { name?: string; teacherIds?: string[] }) {
  const { schoolId } = await requireAdmin();
  const existing = await prisma.subject.findFirst({ where: { id, schoolId } });
  assertSameSchool(existing, schoolId);
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
  revalidateReferenceData(schoolId, "subjects");
  revalidateReferenceData(schoolId, "timetable");
  revalidateDashboard(schoolId);
}

export async function deleteSubject(id: number) {
  const { schoolId } = await requireAdmin();
  await prisma.subject.deleteMany({ where: { id, schoolId } });
  revalidatePath("/list/subjects");
  revalidatePath("/admin/timetable");
  revalidateReferenceData(schoolId, "subjects");
  revalidateReferenceData(schoolId, "timetable");
  revalidateDashboard(schoolId);
}

// ═══════════════════════════════════════════════════════════════════════════════
// PARENT / TEACHER / STUDENT
// ═══════════════════════════════════════════════════════════════════════════════
export async function deleteParent(id: string) {
  const { schoolId } = await requireAdmin();
  await prisma.parent.deleteMany({ where: { id, schoolId } });
  revalidatePath("/list/parents");
}

export async function deleteTeacher(id: string) {
  const { schoolId } = await requireAdmin();
  await prisma.teacher.deleteMany({ where: { id, schoolId } });
  revalidatePath("/list/teachers");
  revalidatePath("/admin/timetable");
  revalidateReferenceData(schoolId, "teachers");
  revalidateReferenceData(schoolId, "subjects");
  revalidateReferenceData(schoolId, "timetable");
  revalidateDashboard(schoolId);
}

export async function deleteStudent(id: string) {
  const { schoolId } = await requireAdmin();
  await prisma.student.deleteMany({ where: { id, schoolId } });
  revalidatePath("/list/students");
  revalidateReferenceData(schoolId, "students");
  revalidateDashboard(schoolId);
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
  const parsed = parseActionInput(examFormSchema, data);
  const ctx = await requireAdminOrTeacher();
  await getLessonInSchool(parsed.lessonId, ctx.schoolId);

  const exam = await prisma.exam.create({
    data: {
      schoolId:  ctx.schoolId,
      title:     parsed.title,
      lessonId:  parsed.lessonId,
      startTime: new Date(parsed.startTime),
      endTime:   new Date(parsed.endTime),
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

  const examDate  = new Intl.DateTimeFormat("en-GH", { day: "numeric", month: "long", year: "numeric" }).format(new Date(parsed.startTime));
  const startFmt  = new Intl.DateTimeFormat("en-GH", { hour: "2-digit", minute: "2-digit" }).format(new Date(parsed.startTime));
  const endFmt    = new Intl.DateTimeFormat("en-GH", { hour: "2-digit", minute: "2-digit" }).format(new Date(parsed.endTime));

  await prisma.announcement.create({
    data: {
      schoolId:    ctx.schoolId,
      title:       `📝 Exam Scheduled: ${exam.lesson.subject.name}`,
      description: `${parsed.title} for ${exam.lesson.class.name} has been scheduled on ${examDate} from ${startFmt} to ${endFmt}. Please prepare accordingly.`,
      date:        new Date(),
      classId:     exam.lesson.class.id,
    },
  });

  revalidatePath("/list/exams");
  revalidatePath("/list/announcements");
}

export async function updateExam(data: ExamFormData): Promise<void> {
  if (!data.id) throw new Error("Exam ID required for update.");
  const parsed = parseActionInput(examFormSchema, data);
  const ctx = await requireAdminOrTeacher();
  const existing = await prisma.exam.findFirst({ where: { id: data.id, schoolId: ctx.schoolId } });
  requireResourceAccess(existing, ctx);
  await getLessonInSchool(parsed.lessonId, ctx.schoolId);

  const exam = await prisma.exam.update({
    where: { id: data.id },
    data: {
      title:     parsed.title,
      lessonId:  parsed.lessonId,
      startTime: new Date(parsed.startTime),
      endTime:   new Date(parsed.endTime),
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
    schoolId:    ctx.schoolId,
    title:       `📝 Exam Rescheduled: ${exam.lesson.subject.name}`,
    description: `${data.title} for ${exam.lesson.class.name} has been updated to ${examDate} from ${startFmt} to ${endFmt}.`,
    date:        new Date(),
    classId:     exam.lesson.class.id,
  };

  const existingAnn = await prisma.announcement.findFirst({
    where: {
      schoolId: ctx.schoolId,
      title: { contains: "Exam" },
      classId: exam.lesson.class.id,
      date: { gte: new Date(Date.now() - 7 * 86400000) },
    },
    orderBy: { date: "desc" },
  });

  if (existingAnn) await prisma.announcement.update({ where: { id: existingAnn.id }, data: announcementData });
  else             await prisma.announcement.create({ data: announcementData });

  revalidatePath("/list/exams");
  revalidatePath("/list/announcements");
}

export async function deleteExam(id: number): Promise<void> {
  const { schoolId } = await requireAdminOrTeacher();
  await prisma.exam.deleteMany({ where: { id, schoolId } });
  revalidatePath("/list/exams");
}

// ═══════════════════════════════════════════════════════════════════════════════
// ASSIGNMENT
// ═══════════════════════════════════════════════════════════════════════════════
export type AssignmentFormData = {
  id?:       number;
  title:     string;
  lessonId:  number;
  startDate: string;
  dueDate:   string;
};

export async function createAssignment(data: AssignmentFormData): Promise<void> {
  const parsed = parseActionInput(assignmentFormSchema, data);
  const ctx = await requireAdminOrTeacher();
  await getLessonInSchool(parsed.lessonId, ctx.schoolId);

  const assignment = await prisma.assignment.create({
    data: {
      schoolId:  ctx.schoolId,
      title:     parsed.title,
      lessonId:  parsed.lessonId,
      startDate: new Date(parsed.startDate),
      dueDate:   new Date(parsed.dueDate),
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

  const dueFmt = new Intl.DateTimeFormat("en-GH", { day: "numeric", month: "long", year: "numeric" }).format(new Date(parsed.dueDate));

  await prisma.announcement.create({
    data: {
      schoolId:    ctx.schoolId,
      title:       `📚 New Assignment: ${assignment.lesson.subject.name}`,
      description: `${parsed.title} has been assigned to ${assignment.lesson.class.name} by ${assignment.lesson.teacher.name} ${assignment.lesson.teacher.surname}. Due: ${dueFmt}.`,
      date:        new Date(),
      classId:     assignment.lesson.class.id,
    },
  });

  revalidatePath("/list/assignments");
  revalidatePath("/list/announcements");
}

export async function updateAssignment(data: AssignmentFormData): Promise<void> {
  if (!data.id) throw new Error("Assignment ID required for update.");
  const ctx = await requireAdminOrTeacher();
  const existing = await prisma.assignment.findFirst({ where: { id: data.id, schoolId: ctx.schoolId } });
  requireResourceAccess(existing, ctx);
  await getLessonInSchool(data.lessonId, ctx.schoolId);

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
    schoolId:    ctx.schoolId,
    title:       `📚 Assignment Updated: ${assignment.lesson.subject.name}`,
    description: `${data.title} for ${assignment.lesson.class.name} has been updated. New due date: ${dueFmt}.`,
    date:        new Date(),
    classId:     assignment.lesson.class.id,
  };

  const existingAnn = await prisma.announcement.findFirst({
    where: {
      schoolId: ctx.schoolId,
      title:   { contains: assignment.lesson.subject.name },
      classId: assignment.lesson.class.id,
      date:    { gte: new Date(Date.now() - 14 * 86400000) },
    },
    orderBy: { date: "desc" },
  });

  if (existingAnn) await prisma.announcement.update({ where: { id: existingAnn.id }, data: announcementData });
  else             await prisma.announcement.create({ data: announcementData });

  revalidatePath("/list/assignments");
  revalidatePath("/list/announcements");
}

export async function deleteAssignment(id: number): Promise<void> {
  const { schoolId } = await requireAdminOrTeacher();
  await prisma.assignment.deleteMany({ where: { id, schoolId } });
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
  const parsed = parseActionInput(resultFormSchema, data);
  const ctx = await requireAdminOrTeacher();

  const student = await prisma.student.findFirst({
    where: { id: parsed.studentId, schoolId: ctx.schoolId },
  });
  requireResourceAccess(student, ctx);

  await prisma.result.create({
    data: {
      schoolId:     ctx.schoolId,
      score:        parsed.score,
      studentId:    parsed.studentId,
      examId:       parsed.examId       ?? null,
      assignmentId: parsed.assignmentId ?? null,
    },
  });
  revalidatePath("/list/results");
}

export async function updateResult(data: ResultFormData): Promise<void> {
  const ctx = await requireAdminOrTeacher();
  if (!data.id) throw new Error("Result ID required for update.");
  const existing = await prisma.result.findFirst({ where: { id: data.id, schoolId: ctx.schoolId } });
  requireResourceAccess(existing, ctx);

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
  const { schoolId } = await requireAdminOrTeacher();
  await prisma.result.deleteMany({ where: { id, schoolId } });
  revalidatePath("/list/results");
}
