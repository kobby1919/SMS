"use server";

// src/lib/actions/actions.ts

import prisma from "@/src/lib/prisma";
import { AuthorizationError, requireRole } from "@/src/lib/authz";
import { requireResourceAccess } from "@/src/lib/authz";
import { assertSameSchool } from "@/src/lib/tenant";
import { revalidatePath } from "next/cache";
import { revalidateDashboard, revalidateReferenceData } from "@/src/lib/cacheTags";
import { recordParentActivityEvents } from "@/src/lib/services/parent-activity-events";
import { markHomeworkSubmission, syncHomeworkSubmissionsForAssignment } from "@/src/lib/services/homework";
import { parseActionInput } from "@/src/lib/validation/parse";
import {
  assignmentFormSchema,
  classCreateSchema,
  classUpdateSchema,
  examFormSchema,
  homeworkSubmissionSchema,
  numericIdSchema,
  resultFormSchema,
  stringIdActionSchema,
  subjectCreateSchema,
  subjectUpdateSchema,
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
  ({ id } = parseActionInput(numericIdSchema, { id }));
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
  data = parseActionInput(classCreateSchema, data);
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
  ({ id } = parseActionInput(numericIdSchema, { id }));
  data = parseActionInput(classUpdateSchema, data);
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
  ({ id } = parseActionInput(numericIdSchema, { id }));
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
  data = parseActionInput(subjectCreateSchema, data);
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
  ({ id } = parseActionInput(numericIdSchema, { id }));
  data = parseActionInput(subjectUpdateSchema, data);
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
  ({ id } = parseActionInput(numericIdSchema, { id }));
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
  ({ id } = parseActionInput(stringIdActionSchema, { id }));
  const { schoolId } = await requireAdmin();
  await prisma.parent.deleteMany({ where: { id, schoolId } });
  revalidatePath("/list/parents");
}

export async function deleteTeacher(id: string) {
  ({ id } = parseActionInput(stringIdActionSchema, { id }));
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
  ({ id } = parseActionInput(stringIdActionSchema, { id }));
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
  revalidateDashboard(ctx.schoolId);
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
  revalidateDashboard(ctx.schoolId);
}

export async function deleteExam(id: number): Promise<void> {
  ({ id } = parseActionInput(numericIdSchema, { id }));
  const { schoolId } = await requireAdminOrTeacher();
  await prisma.exam.deleteMany({ where: { id, schoolId } });
  revalidatePath("/list/exams");
  revalidateDashboard(schoolId);
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
  await syncHomeworkSubmissionsForAssignment(assignment.id, ctx.schoolId);

  await prisma.announcement.create({
    data: {
      schoolId:    ctx.schoolId,
      title:       `📚 New Assignment: ${assignment.lesson.subject.name}`,
      description: `${parsed.title} has been assigned to ${assignment.lesson.class.name} by ${assignment.lesson.teacher.name} ${assignment.lesson.teacher.surname}. Due: ${dueFmt}.`,
      date:        new Date(),
      classId:     assignment.lesson.class.id,
    },
  });

  await recordParentActivityEvents({
    schoolId: ctx.schoolId,
    classId: assignment.lesson.class.id,
    type: "ASSIGNMENT",
    title: `${assignment.lesson.subject.name} assignment published`,
    body: `${parsed.title} is due on ${dueFmt}. Teacher: ${assignment.lesson.teacher.name} ${assignment.lesson.teacher.surname}.`,
    href: "/list/assignments",
    sourceModel: "Assignment",
    sourceId: String(assignment.id),
    sourceKey: `assignment:${assignment.id}:created`,
    teacherId: ctx.role === "teacher" ? ctx.userId : null,
    occurredAt: new Date(),
    payload: {
      assignmentTitle: parsed.title,
      subjectName: assignment.lesson.subject.name,
      dueDate: parsed.dueDate,
    },
  });

  revalidatePath("/list/assignments");
  revalidatePath("/list/announcements");
  revalidateDashboard(ctx.schoolId);
}

export async function updateAssignment(data: AssignmentFormData): Promise<void> {
  if (!data.id) throw new Error("Assignment ID required for update.");
  const parsed = parseActionInput(assignmentFormSchema, data);
  const ctx = await requireAdminOrTeacher();
  const existing = await prisma.assignment.findFirst({ where: { id: data.id, schoolId: ctx.schoolId } });
  requireResourceAccess(existing, ctx);
  await getLessonInSchool(parsed.lessonId, ctx.schoolId);

  const assignment = await prisma.assignment.update({
    where: { id: data.id },
    data: {
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

  const dueFmt = new Intl.DateTimeFormat("en-GH", { day: "numeric", month: "long", year: "numeric" }).format(new Date(data.dueDate));
  await syncHomeworkSubmissionsForAssignment(assignment.id, ctx.schoolId);

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

  await recordParentActivityEvents({
    schoolId: ctx.schoolId,
    classId: assignment.lesson.class.id,
    type: "ASSIGNMENT",
    title: `${assignment.lesson.subject.name} assignment updated`,
    body: `${parsed.title} has been updated. New due date: ${dueFmt}.`,
    href: "/list/assignments",
    sourceModel: "Assignment",
    sourceId: String(assignment.id),
    sourceKey: `assignment:${assignment.id}:updated:${new Date(parsed.dueDate).getTime()}`,
    teacherId: ctx.role === "teacher" ? ctx.userId : null,
    occurredAt: new Date(),
    payload: {
      assignmentTitle: parsed.title,
      subjectName: assignment.lesson.subject.name,
      dueDate: parsed.dueDate,
    },
  });

  revalidatePath("/list/assignments");
  revalidatePath("/list/announcements");
  revalidateDashboard(ctx.schoolId);
}

export async function deleteAssignment(id: number): Promise<void> {
  ({ id } = parseActionInput(numericIdSchema, { id }));
  const { schoolId } = await requireAdminOrTeacher();
  await prisma.assignment.deleteMany({ where: { id, schoolId } });
  revalidatePath("/list/assignments");
  revalidateDashboard(schoolId);
}

export type HomeworkSubmissionFormData = {
  assignmentId: number;
  studentId: string;
  status: "PENDING" | "SUBMITTED" | "LATE" | "MISSING" | "EXCUSED";
  submittedAt?: string | null;
  note?: string | null;
};

export async function updateHomeworkSubmission(data: HomeworkSubmissionFormData): Promise<void> {
  const parsed = parseActionInput(homeworkSubmissionSchema, data);
  const ctx = await requireAdminOrTeacher();

  const assignment = await prisma.assignment.findFirst({
    where: { id: parsed.assignmentId, schoolId: ctx.schoolId },
    include: {
      lesson: {
        select: {
          teacherId: true,
          classId: true,
          subject: { select: { name: true } },
          teacher: { select: { name: true, surname: true } },
        },
      },
    },
  });
  const assignmentInSchool = requireResourceAccess(assignment, ctx);

  if (ctx.role === "teacher" && assignmentInSchool.lesson.teacherId !== ctx.userId) {
    throw new AuthorizationError("You can only update homework for your assigned lesson.", 403);
  }

  const submission = await markHomeworkSubmission({
    schoolId: ctx.schoolId,
    assignmentId: parsed.assignmentId,
    studentId: parsed.studentId,
    status: parsed.status,
    checkedById: ctx.role === "teacher" ? ctx.userId : null,
    submittedAt: parsed.submittedAt ? new Date(parsed.submittedAt) : null,
    note: parsed.note ?? null,
  });

  const statusLabel = parsed.status.toLowerCase().replace(/_/g, " ");
  await recordParentActivityEvents({
    schoolId: ctx.schoolId,
    studentIds: [parsed.studentId],
    teacherId: ctx.role === "teacher" ? ctx.userId : assignmentInSchool.lesson.teacherId,
    type: "ASSIGNMENT",
    title: `${assignmentInSchool.lesson.subject.name} homework ${statusLabel}`,
    body: [
      `${assignmentInSchool.lesson.subject.name}: ${assignmentInSchool.title}`,
      `Status: ${statusLabel}`,
      `Teacher: ${assignmentInSchool.lesson.teacher.name} ${assignmentInSchool.lesson.teacher.surname}`,
      parsed.note ? `Note: ${parsed.note}` : null,
    ].filter(Boolean).join("\n"),
    href: "/list/assignments",
    sourceModel: "HomeworkSubmission",
    sourceId: String(submission.id),
    sourceKey: `homework-submission:${submission.id}`,
    occurredAt: submission.checkedAt ?? new Date(),
    payload: {
      assignmentTitle: assignmentInSchool.title,
      subjectName: assignmentInSchool.lesson.subject.name,
      status: parsed.status,
      note: parsed.note ?? null,
    },
  });

  revalidatePath("/list/assignments");
  revalidatePath("/parent");
  revalidatePath("/parent/updates");
  revalidateDashboard(ctx.schoolId);
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
  revalidateDashboard(ctx.schoolId);
}

export async function updateResult(data: ResultFormData): Promise<void> {
  const ctx = await requireAdminOrTeacher();
  if (!data.id) throw new Error("Result ID required for update.");
  const parsed = parseActionInput(resultFormSchema, data);
  const existing = await prisma.result.findFirst({ where: { id: data.id, schoolId: ctx.schoolId } });
  requireResourceAccess(existing, ctx);

  await prisma.result.update({
    where: { id: data.id },
    data: {
      score:        parsed.score,
      studentId:    parsed.studentId,
      examId:       parsed.examId       ?? null,
      assignmentId: parsed.assignmentId ?? null,
    },
  });
  revalidatePath("/list/results");
  revalidateDashboard(ctx.schoolId);
}

export async function deleteResult(id: number): Promise<void> {
  ({ id } = parseActionInput(numericIdSchema, { id }));
  const { schoolId } = await requireAdminOrTeacher();
  await prisma.result.deleteMany({ where: { id, schoolId } });
  revalidatePath("/list/results");
  revalidateDashboard(schoolId);
}
