"use server";

// src/lib/actions/actions.ts

import prisma from "@/src/lib/prisma";
import type { AttendanceStatus, HomeworkSubmissionStatus, Prisma } from "@/src/generated/prisma";
import { AuthorizationError, requireRole } from "@/src/lib/authz";
import { requireResourceAccess } from "@/src/lib/authz";
import { assertSameSchool } from "@/src/lib/tenant";
import { revalidatePath } from "next/cache";
import { revalidateDashboard, revalidateReferenceData } from "@/src/lib/cacheTags";
import { recordParentActivityEvents } from "@/src/lib/services/parent-activity-events";
import {
  markHomeworkSubmission,
  markHomeworkSubmissionsForAssignment,
  syncHomeworkSubmissionsForAssignment,
} from "@/src/lib/services/homework";
import { syncHomeworkCheckingObligation } from "@/src/lib/services/teacher-homework-obligations";
import { parseActionInput } from "@/src/lib/validation/parse";
import {
  announcementFormSchema,
  attendanceCorrectionRequestSchema,
  attendanceCorrectionReviewSchema,
  assignmentFormSchema,
  classCreateSchema,
  classUpdateSchema,
  examFormSchema,
  homeworkBulkSubmissionSchema,
  homeworkSubmissionSchema,
  numericIdSchema,
  resultFormSchema,
  stringIdActionSchema,
  subjectCreateSchema,
  subjectUpdateSchema,
} from "@/src/lib/validation/academic";

const ATTENDANCE_STATUS_LABELS: Record<AttendanceStatus, string> = {
  PRESENT: "Present",
  ABSENT: "Absent",
  LATE: "Late",
  EXCUSED: "Excused",
};

// ─── Auth guards ──────────────────────────────────────────────────────────────
const requireAdmin = () => requireRole(["admin"]);
const requireAdminOrTeacher = () => requireRole(["admin", "teacher"]);

async function getLessonInSchool(lessonId: number, schoolId: string) {
  const lesson = await prisma.lesson.findFirst({
    where: { id: lessonId, schoolId },
    select: { id: true, schoolId: true, teacherId: true },
  });
  assertSameSchool(lesson, schoolId);
  return lesson;
}

function requireTeacherOwnsLesson(
  lesson: Awaited<ReturnType<typeof getLessonInSchool>>,
  ctx: Awaited<ReturnType<typeof requireAdminOrTeacher>>,
) {
  if (ctx.role === "teacher" && lesson.teacherId !== ctx.userId) {
    throw new AuthorizationError("You can only assign homework for lessons assigned to you.", 403);
  }
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

async function getClassInSchool(classId: number | null | undefined, schoolId: string) {
  if (!classId) return null;
  const klass = await prisma.class.findFirst({
    where: { id: classId, schoolId },
    select: { id: true, schoolId: true, name: true },
  });
  assertSameSchool(klass, schoolId);
  return klass;
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
// ANNOUNCEMENT / NOTICE
// ═══════════════════════════════════════════════════════════════════════════════
export type AnnouncementFormData = {
  id?: number;
  title: string;
  description: string;
  date: string;
  classId?: number | null;
  priority?: "NORMAL" | "IMPORTANT" | "URGENT";
  expiresAt?: string | null;
};

function noticePriorityLabel(priority: "NORMAL" | "IMPORTANT" | "URGENT") {
  if (priority === "URGENT") return "Urgent";
  if (priority === "IMPORTANT") return "Important";
  return "Notice";
}

export async function createAnnouncement(data: AnnouncementFormData): Promise<void> {
  const parsed = parseActionInput(announcementFormSchema, data);
  const ctx = await requireAdmin();
  const klass = await getClassInSchool(parsed.classId, ctx.schoolId);

  const announcement = await prisma.announcement.create({
    data: {
      schoolId: ctx.schoolId,
      title: parsed.title,
      description: parsed.description,
      date: new Date(parsed.date),
      classId: klass?.id ?? null,
      priority: parsed.priority,
      expiresAt: parsed.expiresAt ? new Date(parsed.expiresAt) : null,
    },
  });

  await recordParentActivityEvents({
    schoolId: ctx.schoolId,
    classId: announcement.classId,
    type: "ANNOUNCEMENT",
    title: `${noticePriorityLabel(announcement.priority)}: ${announcement.title}`,
    body: [
      announcement.description,
      klass ? `Audience: ${klass.name}` : "Audience: Whole school",
      `Priority: ${noticePriorityLabel(announcement.priority)}`,
    ].join("\n"),
    href: "/list/announcements",
    sourceModel: "Announcement",
    sourceId: String(announcement.id),
    sourceKey: `announcement:${announcement.id}:${announcement.priority}`,
    occurredAt: announcement.date,
    payload: {
      title: announcement.title,
      audience: klass?.name ?? "Whole school",
      priority: announcement.priority,
      expiresAt: announcement.expiresAt?.toISOString() ?? null,
    },
  });

  revalidatePath("/list/announcements");
  revalidatePath("/parent");
  revalidatePath("/parent/updates");
  revalidateDashboard(ctx.schoolId);
}

export async function updateAnnouncement(data: AnnouncementFormData): Promise<void> {
  if (!data.id) throw new Error("Announcement ID required for update.");
  const parsed = parseActionInput(announcementFormSchema, data);
  const ctx = await requireAdmin();
  const existing = await prisma.announcement.findFirst({ where: { id: data.id, schoolId: ctx.schoolId } });
  requireResourceAccess(existing, ctx);
  const klass = await getClassInSchool(parsed.classId, ctx.schoolId);

  const announcement = await prisma.announcement.update({
    where: { id: data.id },
    data: {
      title: parsed.title,
      description: parsed.description,
      date: new Date(parsed.date),
      classId: klass?.id ?? null,
      priority: parsed.priority,
      expiresAt: parsed.expiresAt ? new Date(parsed.expiresAt) : null,
    },
  });

  await recordParentActivityEvents({
    schoolId: ctx.schoolId,
    classId: announcement.classId,
    type: "ANNOUNCEMENT",
    title: `${noticePriorityLabel(announcement.priority)} updated: ${announcement.title}`,
    body: [
      announcement.description,
      klass ? `Audience: ${klass.name}` : "Audience: Whole school",
      `Priority: ${noticePriorityLabel(announcement.priority)}`,
    ].join("\n"),
    href: "/list/announcements",
    sourceModel: "Announcement",
    sourceId: String(announcement.id),
    sourceKey: `announcement:${announcement.id}:updated:${Date.now()}`,
    occurredAt: new Date(),
    payload: {
      title: announcement.title,
      audience: klass?.name ?? "Whole school",
      priority: announcement.priority,
      expiresAt: announcement.expiresAt?.toISOString() ?? null,
    },
  });

  revalidatePath("/list/announcements");
  revalidatePath("/parent");
  revalidatePath("/parent/updates");
  revalidateDashboard(ctx.schoolId);
}

export async function deleteAnnouncement(id: number): Promise<void> {
  ({ id } = parseActionInput(numericIdSchema, { id }));
  const { schoolId } = await requireAdmin();
  await prisma.announcement.deleteMany({ where: { id, schoolId } });
  revalidatePath("/list/announcements");
  revalidatePath("/parent");
  revalidatePath("/parent/updates");
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

type AssignmentWithLessonSummary = Prisma.AssignmentGetPayload<{
  include: {
    lesson: {
      select: {
        subject: { select: { name: true } };
        class: { select: { id: true; name: true } };
        teacher: { select: { name: true; surname: true } };
      };
    };
  };
}>;

async function nextHomeworkSequence(tx: Prisma.TransactionClient, schoolId: string, lessonId: number) {
  const latest = await tx.assignment.findFirst({
    where: { schoolId, lessonId },
    select: { homeworkSequence: true },
    orderBy: { homeworkSequence: "desc" },
  });
  return (latest?.homeworkSequence ?? 0) + 1;
}

function isUniqueConstraintError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}

export async function createAssignment(data: AssignmentFormData): Promise<{ id: number; title: string }> {
  const parsed = parseActionInput(assignmentFormSchema, data);
  const ctx = await requireAdminOrTeacher();
  const lesson = await getLessonInSchool(parsed.lessonId, ctx.schoolId);
  requireTeacherOwnsLesson(lesson, ctx);

  let assignment: AssignmentWithLessonSummary | null = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      assignment = await prisma.$transaction(async (tx) => {
        const homeworkSequence = await nextHomeworkSequence(tx, ctx.schoolId, parsed.lessonId);
        return tx.assignment.create({
          data: {
            schoolId:          ctx.schoolId,
            title:             `Homework ${homeworkSequence}`,
            homeworkSequence,
            lessonId:          parsed.lessonId,
            startDate:         new Date(parsed.startDate),
            dueDate:           new Date(parsed.dueDate),
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
      });
      break;
    } catch (error) {
      if (!isUniqueConstraintError(error) || attempt === 2) throw error;
    }
  }
  if (!assignment) throw new Error("Could not create homework. Please try again.");

  const dueFmt = new Intl.DateTimeFormat("en-GH", { day: "numeric", month: "long", year: "numeric" }).format(new Date(parsed.dueDate));
  await syncHomeworkSubmissionsForAssignment(assignment.id, ctx.schoolId);
  await syncHomeworkCheckingObligation({
    schoolId: ctx.schoolId,
    assignmentId: assignment.id,
  });

  await prisma.announcement.create({
    data: {
      schoolId:    ctx.schoolId,
      title:       `New Homework: ${assignment.lesson.subject.name}`,
      description: `${assignment.title} has been assigned to ${assignment.lesson.class.name} by ${assignment.lesson.teacher.name} ${assignment.lesson.teacher.surname}. Due: ${dueFmt}.`,
      date:        new Date(),
      classId:     assignment.lesson.class.id,
    },
  });

  await recordParentActivityEvents({
    schoolId: ctx.schoolId,
    classId: assignment.lesson.class.id,
    type: "ASSIGNMENT",
    title: `${assignment.lesson.subject.name}: ${assignment.title} published`,
    body: `${assignment.title} is due on ${dueFmt}. Teacher: ${assignment.lesson.teacher.name} ${assignment.lesson.teacher.surname}.`,
    href: "/list/assignments",
    sourceModel: "Assignment",
    sourceId: String(assignment.id),
    sourceKey: `assignment:${assignment.id}:created`,
    teacherId: ctx.role === "teacher" ? ctx.userId : null,
    occurredAt: new Date(),
    payload: {
      assignmentTitle: assignment.title,
      subjectName: assignment.lesson.subject.name,
      homeworkSequence: assignment.homeworkSequence,
      dueDate: parsed.dueDate,
    },
  });

  revalidatePath("/list/assignments");
  revalidatePath("/list/announcements");
  revalidateDashboard(ctx.schoolId);

  return { id: assignment.id, title: assignment.title };
}

export async function updateAssignment(data: AssignmentFormData): Promise<{ id: number; title: string }> {
  if (!data.id) throw new Error("Assignment ID required for update.");
  const parsed = parseActionInput(assignmentFormSchema, data);
  const ctx = await requireAdminOrTeacher();
  const existing = await prisma.assignment.findFirst({
    where: { id: data.id, schoolId: ctx.schoolId },
    include: {
      homeworkSubmissions: {
        select: { status: true, checkedAt: true },
      },
    },
  });
  const existingInSchool = requireResourceAccess(existing, ctx);
  const existingDueEnd = new Date(existingInSchool.dueDate);
  existingDueEnd.setHours(23, 59, 59, 999);
  if (existingDueEnd < new Date()) {
    throw new Error("Past homework cannot be updated. Create a new homework if the class needs another task.");
  }
  const hasCheckedHomework = existingInSchool.homeworkSubmissions.some(
    (submission) => submission.checkedAt || submission.status !== "PENDING",
  );
  if (hasCheckedHomework) {
    throw new Error("This homework already has student checks, so its details cannot be edited.");
  }
  if (parsed.lessonId !== existingInSchool.lessonId) {
    throw new Error("Homework subject and class cannot be changed after creation. Create a new homework instead.");
  }
  const nextLesson = await getLessonInSchool(parsed.lessonId, ctx.schoolId);
  requireTeacherOwnsLesson(nextLesson, ctx);

  const assignment = await prisma.assignment.update({
    where: { id: data.id },
    data: {
      title:     existingInSchool.title,
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
  await syncHomeworkCheckingObligation({
    schoolId: ctx.schoolId,
    assignmentId: assignment.id,
  });

  const announcementData = {
    schoolId:    ctx.schoolId,
    title:       `Homework Updated: ${assignment.lesson.subject.name}`,
    description: `${assignment.title} for ${assignment.lesson.class.name} has been updated. New due date: ${dueFmt}.`,
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
    title: `${assignment.lesson.subject.name}: ${assignment.title} updated`,
    body: `${assignment.title} has been updated. New due date: ${dueFmt}.`,
    href: "/list/assignments",
    sourceModel: "Assignment",
    sourceId: String(assignment.id),
    sourceKey: `assignment:${assignment.id}:updated:${new Date(parsed.dueDate).getTime()}`,
    teacherId: ctx.role === "teacher" ? ctx.userId : null,
    occurredAt: new Date(),
    payload: {
      assignmentTitle: assignment.title,
      subjectName: assignment.lesson.subject.name,
      homeworkSequence: assignment.homeworkSequence,
      dueDate: parsed.dueDate,
    },
  });

  revalidatePath("/list/assignments");
  revalidatePath("/list/announcements");
  revalidateDashboard(ctx.schoolId);

  return { id: assignment.id, title: assignment.title };
}

export async function deleteAssignment(id: number): Promise<void> {
  ({ id } = parseActionInput(numericIdSchema, { id }));
  await requireAdminOrTeacher();
  throw new Error("Homework cannot be deleted after it has been assigned. Keep it for audit history.");
}

export type HomeworkSubmissionFormData = {
  assignmentId: number;
  studentId: string;
  status: "PENDING" | "SUBMITTED" | "LATE" | "MISSING" | "EXCUSED";
  submittedAt?: string | null;
  note?: string | null;
};

export type HomeworkSubmissionActionResult = {
  changed: boolean;
  status: "PENDING" | "SUBMITTED" | "LATE" | "MISSING" | "EXCUSED";
  message: string;
  approvalRequired?: boolean;
};

type AssignmentWithHomeworkAccess = NonNullable<Awaited<ReturnType<typeof getAssignmentForHomeworkAccess>>>;

async function getAssignmentForHomeworkAccess(assignmentId: number, schoolId: string) {
  return prisma.assignment.findFirst({
    where: { id: assignmentId, schoolId },
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
}

function requireHomeworkTeacherAccess(
  assignment: AssignmentWithHomeworkAccess,
  ctx: Awaited<ReturnType<typeof requireAdminOrTeacher>>,
) {
  if (ctx.role === "teacher" && assignment.lesson.teacherId !== ctx.userId) {
    throw new AuthorizationError("You can only update homework for your assigned lesson.", 403);
  }
}

function assertHomeworkCanBeChecked(dueDate: Date) {
  const dueEnd = new Date(dueDate);
  dueEnd.setHours(23, 59, 59, 999);
  if (dueEnd >= new Date()) {
    throw new Error("Homework is still open. Check submissions after the due date.");
  }
}

function normalizeHomeworkSubmissionStatus(status: HomeworkSubmissionStatus, dueDate: Date) {
  const dueEnd = new Date(dueDate);
  dueEnd.setHours(23, 59, 59, 999);
  return status === "SUBMITTED" && dueEnd < new Date() ? "LATE" : status;
}

function isFinalHomeworkStatus(status: HomeworkSubmissionStatus) {
  return status === "SUBMITTED" ||
    status === "LATE" ||
    status === "MISSING" ||
    status === "EXCUSED";
}

function homeworkStatusLabel(status: HomeworkSubmissionStatus) {
  return status.toLowerCase().replace(/_/g, " ");
}

function readHomeworkCorrectionStatus(value: Prisma.JsonValue | null | undefined): HomeworkSubmissionStatus | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const status = (value as { status?: unknown }).status;
  return typeof status === "string" &&
    ["PENDING", "SUBMITTED", "LATE", "MISSING", "EXCUSED"].includes(status)
    ? status as HomeworkSubmissionStatus
    : null;
}

function readAttendanceCorrectionValue(value: Prisma.JsonValue | null | undefined): {
  status: AttendanceStatus;
  note: string | null;
  arrivalTime: string | null;
} | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const payload = value as {
    status?: unknown;
    note?: unknown;
    arrivalTime?: unknown;
  };
  if (
    typeof payload.status !== "string" ||
    !["PRESENT", "ABSENT", "LATE", "EXCUSED"].includes(payload.status)
  ) {
    return null;
  }
  return {
    status: payload.status as AttendanceStatus,
    note: typeof payload.note === "string" ? payload.note : null,
    arrivalTime: typeof payload.arrivalTime === "string" ? payload.arrivalTime : null,
  };
}

function attendanceStatusLabel(status: AttendanceStatus) {
  return ATTENDANCE_STATUS_LABELS[status] ?? status;
}

export async function requestAttendanceCorrection(data: {
  attendanceId: number;
  newStatus: AttendanceStatus;
  newNote?: string | null;
  newArrivalTime?: string | null;
  reason: string;
}): Promise<{ message: string }> {
  const parsed = parseActionInput(attendanceCorrectionRequestSchema, data);
  const ctx = await requireRole(["teacher"]);

  const attendance = await prisma.attendance.findFirst({
    where: {
      id: parsed.attendanceId,
      schoolId: ctx.schoolId,
    },
    include: {
      student: { select: { id: true, name: true, surname: true } },
      lesson: {
        select: {
          id: true,
          teacherId: true,
          class: { select: { name: true } },
          subject: { select: { name: true } },
        },
      },
    },
  });

  if (!attendance) throw new Error("Attendance record not found.");
  if (attendance.lesson.teacherId !== ctx.userId) {
    throw new AuthorizationError("You can only request corrections for attendance you are responsible for.", 403);
  }

  const newNote = parsed.newNote?.trim() || null;
  const newArrivalTime = parsed.newStatus === "LATE" ? parsed.newArrivalTime?.trim() ?? null : null;
  const hasChange =
    attendance.status !== parsed.newStatus ||
    (attendance.note ?? null) !== newNote ||
    (attendance.arrivalTime ?? null) !== newArrivalTime;

  if (!hasChange) {
    throw new Error("Choose a different attendance value before requesting correction.");
  }

  const sourceKey = `attendance:${attendance.id}:status-correction`;
  const existingRequest = await prisma.teacherCorrectionRequest.findUnique({
    where: {
      schoolId_teacherId_sourceKey_fieldName: {
        schoolId: ctx.schoolId,
        teacherId: ctx.userId,
        sourceKey,
        fieldName: "attendanceStatus",
      },
    },
    select: { id: true, status: true },
  });

  if (existingRequest) {
    return {
      message:
        existingRequest.status === "PENDING"
          ? "A correction request for this attendance record is already waiting for admin review."
          : "This attendance record has already gone through a correction request. Please visit the admin office if it still needs another change.",
    };
  }

  await prisma.$transaction(async (tx) => {
    const request = await tx.teacherCorrectionRequest.create({
      data: {
        schoolId: ctx.schoolId,
        teacherId: ctx.userId,
        sourceModel: "Attendance",
        sourceId: String(attendance.id),
        sourceKey,
        fieldName: "attendanceStatus",
        reason: parsed.reason,
        oldValue: {
          status: attendance.status,
          note: attendance.note,
          arrivalTime: attendance.arrivalTime,
        },
        newValue: {
          status: parsed.newStatus,
          note: newNote,
          arrivalTime: newArrivalTime,
          attendanceId: attendance.id,
          studentId: attendance.studentId,
          lessonId: attendance.lessonId,
        },
      },
    });

    await tx.teacherAccountabilityAuditLog.create({
      data: {
        schoolId: ctx.schoolId,
        teacherId: ctx.userId,
        actorId: ctx.userId,
        actorRole: ctx.role,
        action: "CORRECTION_REQUESTED",
        sourceModel: "Attendance",
        sourceId: String(attendance.id),
        before: {
          status: attendance.status,
          student: `${attendance.student.name} ${attendance.student.surname}`,
        },
        after: {
          correctionRequestId: request.id,
          requestedStatus: parsed.newStatus,
          status: request.status,
        },
        message: `Attendance correction requested for ${attendance.student.name} ${attendance.student.surname} in ${attendance.lesson.subject.name}.`,
      },
    });
  });

  revalidatePath("/list/attendance");
  revalidatePath("/list/attendance/take");
  revalidatePath("/teacher/accountability");
  revalidatePath("/admin/accountability");

  return {
    message: "Correction request sent to admin for review. The saved attendance record has not changed yet.",
  };
}

export async function reviewAttendanceCorrectionRequest(data: {
  requestId: string;
  action: "APPROVE" | "REJECT";
  note?: string | null;
}): Promise<{ message: string }> {
  const parsed = parseActionInput(attendanceCorrectionReviewSchema, data);
  const ctx = await requireRole(["admin"]);
  const reviewNote = parsed.note?.trim() || null;

  const request = await prisma.teacherCorrectionRequest.findFirst({
    where: {
      id: parsed.requestId,
      schoolId: ctx.schoolId,
      sourceModel: "Attendance",
      fieldName: "attendanceStatus",
      status: "PENDING",
    },
    include: {
      teacher: { select: { id: true, name: true, surname: true } },
    },
  });

  if (!request) throw new Error("Pending attendance correction request not found.");

  const requested = readAttendanceCorrectionValue(request.newValue);
  const previous = readAttendanceCorrectionValue(request.oldValue);
  if (!requested || !previous) {
    throw new Error("Attendance correction request is missing valid status data.");
  }

  const attendance = await prisma.attendance.findFirst({
    where: {
      id: Number.parseInt(request.sourceId, 10),
      schoolId: ctx.schoolId,
    },
    include: {
      student: { select: { id: true, name: true, surname: true } },
      lesson: {
        select: {
          id: true,
          teacherId: true,
          subject: { select: { name: true } },
          teacher: { select: { name: true, surname: true } },
        },
      },
    },
  });

  if (!attendance) throw new Error("Attendance record for this correction request no longer exists.");

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    if (parsed.action === "APPROVE") {
      await tx.attendance.update({
        where: { id: attendance.id },
        data: {
          status: requested.status,
          present: requested.status === "PRESENT",
          note: requested.note,
          arrivalTime: requested.status === "LATE" ? requested.arrivalTime : null,
          followUpStatus: requested.status === "ABSENT" && !requested.note ? "PENDING_REASON" : "NOT_REQUIRED",
          correctionCount: { increment: 1 },
          lastCorrectedAt: now,
        },
      });

      await tx.attendanceAuditLog.create({
        data: {
          schoolId: ctx.schoolId,
          attendanceId: attendance.id,
          studentId: attendance.studentId,
          lessonId: attendance.lessonId,
          actorId: ctx.userId,
          action: "ATTENDANCE_CORRECTION_APPROVED",
          previousStatus: attendance.status,
          newStatus: requested.status,
          previousNote: attendance.note,
          newNote: requested.note,
          previousArrivalTime: attendance.arrivalTime,
          newArrivalTime: requested.arrivalTime,
          previousFollowUp: attendance.followUpStatus,
          newFollowUp: requested.status === "ABSENT" && !requested.note ? "PENDING_REASON" : "NOT_REQUIRED",
          reason: request.reason,
        },
      });
    }

    await tx.teacherCorrectionRequest.update({
      where: { id: request.id },
      data: {
        status: parsed.action === "APPROVE" ? "APPROVED" : "REJECTED",
        reviewedBy: ctx.userId,
        reviewedAt: now,
        reviewNote,
      },
    });

    await tx.teacherAccountabilityAuditLog.create({
      data: {
        schoolId: ctx.schoolId,
        teacherId: request.teacherId,
        actorId: ctx.userId,
        actorRole: ctx.role,
        action: parsed.action === "APPROVE" ? "CORRECTION_APPROVED" : "CORRECTION_REJECTED",
        sourceModel: "Attendance",
        sourceId: String(attendance.id),
        before: {
          status: attendance.status,
          correctionRequestId: request.id,
        },
        after: {
          requestedStatus: requested.status,
          requestStatus: parsed.action === "APPROVE" ? "APPROVED" : "REJECTED",
          reviewNote,
        },
        message: parsed.action === "APPROVE"
          ? `Attendance correction approved for ${attendance.student.name} ${attendance.student.surname}.`
          : `Attendance correction rejected for ${attendance.student.name} ${attendance.student.surname}.`,
      },
    });
  });

  if (parsed.action === "APPROVE") {
    const teacherName = `${attendance.lesson.teacher.name} ${attendance.lesson.teacher.surname}`.trim();
    const statusLabel = attendanceStatusLabel(requested.status);
    await recordParentActivityEvents({
      schoolId: ctx.schoolId,
      studentIds: [attendance.studentId],
      teacherId: attendance.lesson.teacherId,
      type: "ATTENDANCE",
      title: `${attendance.lesson.subject.name} attendance corrected: ${statusLabel}`,
      body: [
        `${statusLabel} for ${attendance.lesson.subject.name}${requested.arrivalTime ? ` at ${requested.arrivalTime}` : ""}.`,
        `Teacher: ${teacherName}`,
        `Approved by admin`,
        request.reason ? `Reason: ${request.reason}` : null,
      ].filter(Boolean).join("\n"),
      href: "/parent/updates",
      sourceModel: "Attendance",
      sourceId: String(attendance.id),
      sourceKey: `attendance:${attendance.id}:approved:${requested.status}:${now.getTime()}`,
      occurredAt: now,
      payload: {
        studentName: `${attendance.student.name} ${attendance.student.surname}`,
        status: requested.status,
        statusLabel,
        note: requested.note,
        arrivalTime: requested.arrivalTime,
        subjectName: attendance.lesson.subject.name,
        teacherName,
        correctionApproved: true,
      },
    });
  }

  revalidatePath("/list/attendance");
  revalidatePath("/list/attendance/take");
  revalidatePath("/teacher/accountability");
  revalidatePath("/admin/accountability");
  revalidatePath("/parent");
  revalidatePath("/parent/updates");
  revalidateDashboard(ctx.schoolId);

  return {
    message: parsed.action === "APPROVE"
      ? "Attendance correction approved and applied."
      : "Attendance correction rejected. The saved attendance record was not changed.",
  };
}

export async function updateHomeworkSubmission(data: HomeworkSubmissionFormData): Promise<HomeworkSubmissionActionResult> {
  const parsed = parseActionInput(homeworkSubmissionSchema, data);
  const ctx = await requireAdminOrTeacher();

  const assignment = await getAssignmentForHomeworkAccess(parsed.assignmentId, ctx.schoolId);
  const assignmentInSchool = requireResourceAccess(assignment, ctx);
  requireHomeworkTeacherAccess(assignmentInSchool, ctx);
  assertHomeworkCanBeChecked(assignmentInSchool.dueDate);

  const existingSubmission = await prisma.homeworkSubmission.findUnique({
    where: {
      schoolId_assignmentId_studentId: {
        schoolId: ctx.schoolId,
        assignmentId: parsed.assignmentId,
        studentId: parsed.studentId,
      },
    },
    select: {
      id: true,
      status: true,
      submittedAt: true,
      checkedAt: true,
      note: true,
      student: { select: { name: true, surname: true } },
    },
  });

  const statusToRequest = normalizeHomeworkSubmissionStatus(parsed.status, assignmentInSchool.dueDate);
  const isCorrectionRequest =
    ctx.role === "teacher" &&
    existingSubmission?.checkedAt &&
    isFinalHomeworkStatus(existingSubmission.status) &&
    existingSubmission.status !== statusToRequest;

  if (isCorrectionRequest) {
    const reason = parsed.note?.trim();
    if (!reason) {
      throw new Error("A correction reason is required before changing an already checked homework record.");
    }

    const sourceKey = `homework-submission:${existingSubmission.id}:status-correction`;
    const pendingRequest = await prisma.teacherCorrectionRequest.findUnique({
      where: {
        schoolId_teacherId_sourceKey_fieldName: {
          schoolId: ctx.schoolId,
          teacherId: ctx.userId,
          sourceKey,
          fieldName: "homeworkSubmissionStatus",
        },
      },
      select: {
        id: true,
        status: true,
        newValue: true,
      },
    });

    if (pendingRequest?.status === "PENDING") {
      const pendingStatus = readHomeworkCorrectionStatus(pendingRequest.newValue);
      return {
        changed: false,
        status: existingSubmission.status,
        approvalRequired: true,
        message: `A correction request${pendingStatus ? ` to mark this as ${homeworkStatusLabel(pendingStatus)}` : ""} is already waiting for admin review.`,
      };
    }

    const submittedAt =
      statusToRequest === "SUBMITTED" || statusToRequest === "LATE"
        ? parsed.submittedAt ? new Date(parsed.submittedAt) : new Date()
        : null;

    await prisma.$transaction(async (tx) => {
      const request = pendingRequest
        ? await tx.teacherCorrectionRequest.update({
            where: { id: pendingRequest.id },
            data: {
              status: "PENDING",
              reviewedBy: null,
              reviewedAt: null,
              reviewNote: null,
              reason,
              oldValue: {
                status: existingSubmission.status,
                submittedAt: existingSubmission.submittedAt?.toISOString() ?? null,
                note: existingSubmission.note,
              },
              newValue: {
                status: statusToRequest,
                submittedAt: submittedAt?.toISOString() ?? null,
                note: reason,
                assignmentId: parsed.assignmentId,
                studentId: parsed.studentId,
              },
            },
          })
        : await tx.teacherCorrectionRequest.create({
            data: {
              schoolId: ctx.schoolId,
              teacherId: ctx.userId,
              sourceModel: "HomeworkSubmission",
              sourceId: String(existingSubmission.id),
              sourceKey,
              fieldName: "homeworkSubmissionStatus",
              reason,
              oldValue: {
                status: existingSubmission.status,
                submittedAt: existingSubmission.submittedAt?.toISOString() ?? null,
                note: existingSubmission.note,
              },
              newValue: {
                status: statusToRequest,
                submittedAt: submittedAt?.toISOString() ?? null,
                note: reason,
                assignmentId: parsed.assignmentId,
                studentId: parsed.studentId,
              },
            },
          });

      await tx.teacherAccountabilityAuditLog.create({
        data: {
          schoolId: ctx.schoolId,
          teacherId: ctx.userId,
          actorId: ctx.userId,
          actorRole: ctx.role,
          action: "CORRECTION_REQUESTED",
          sourceModel: "HomeworkSubmission",
          sourceId: String(existingSubmission.id),
          before: {
            status: existingSubmission.status,
            student: `${existingSubmission.student.name} ${existingSubmission.student.surname}`,
          },
          after: {
            correctionRequestId: request.id,
            requestedStatus: statusToRequest,
            status: request.status,
          },
          message: `Homework status correction requested for ${assignmentInSchool.lesson.subject.name}: ${assignmentInSchool.title}.`,
        },
      });
    });

    revalidatePath("/list/assignments");
    revalidatePath("/teacher/accountability");
    revalidatePath("/admin/accountability");

    return {
      changed: false,
      status: existingSubmission.status,
      approvalRequired: true,
      message: "Correction request sent to admin for review. The saved homework status has not changed yet.",
    };
  }

  const result = await markHomeworkSubmission({
    schoolId: ctx.schoolId,
    assignmentId: parsed.assignmentId,
    studentId: parsed.studentId,
    status: parsed.status,
    checkedById: ctx.role === "teacher" ? ctx.userId : null,
    submittedAt: parsed.submittedAt ? new Date(parsed.submittedAt) : null,
    note: parsed.note ?? null,
  });
  const submission = result.submission;
  const effectiveStatus = result.effectiveStatus;

  if (result.changed) {
    const statusLabel = effectiveStatus.toLowerCase().replace(/_/g, " ");
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
      sourceKey: `homework-submission:${submission.id}:${effectiveStatus}:${submission.checkedAt?.getTime() ?? Date.now()}`,
      occurredAt: submission.checkedAt ?? new Date(),
      payload: {
        assignmentTitle: assignmentInSchool.title,
        subjectName: assignmentInSchool.lesson.subject.name,
        status: effectiveStatus,
        note: parsed.note ?? null,
      },
    });
  }
  await syncHomeworkCheckingObligation({
    schoolId: ctx.schoolId,
    assignmentId: parsed.assignmentId,
  });

  revalidatePath("/list/assignments");
  revalidatePath("/parent");
  revalidatePath("/parent/updates");
  revalidateDashboard(ctx.schoolId);

  return {
    changed: result.changed,
    status: effectiveStatus,
    message: result.changed
      ? effectiveStatus === "LATE" && parsed.status === "SUBMITTED"
        ? "Deadline has passed, so this was saved as late."
        : "Homework status saved."
      : "No change detected. This record was already saved.",
  };
}

export async function reviewHomeworkSubmissionCorrectionRequest(data: {
  requestId: string;
  action: "APPROVE" | "REJECT";
  note?: string | null;
}): Promise<{ message: string }> {
  const ctx = await requireRole(["admin"]);
  const requestId = data.requestId?.trim();
  const reviewNote = data.note?.trim() || null;

  if (!requestId) throw new Error("Correction request is required.");
  if (data.action === "REJECT" && !reviewNote) {
    throw new Error("Add a short note before rejecting a homework correction request.");
  }

  const request = await prisma.teacherCorrectionRequest.findFirst({
    where: {
      id: requestId,
      schoolId: ctx.schoolId,
      sourceModel: "HomeworkSubmission",
      fieldName: "homeworkSubmissionStatus",
      status: "PENDING",
    },
    include: {
      teacher: { select: { id: true, name: true, surname: true } },
    },
  });

  if (!request) {
    throw new Error("Pending homework correction request not found.");
  }

  const requestedStatus = readHomeworkCorrectionStatus(request.newValue);
  if (!requestedStatus) {
    throw new Error("Correction request is missing a valid target homework status.");
  }

  const submission = await prisma.homeworkSubmission.findFirst({
    where: {
      id: Number.parseInt(request.sourceId, 10),
      schoolId: ctx.schoolId,
    },
    include: {
      student: { select: { id: true, name: true, surname: true } },
      assignment: {
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
      },
    },
  });

  if (!submission) {
    throw new Error("Homework submission for this correction request no longer exists.");
  }

  const now = new Date();
  const submittedAt =
    requestedStatus === "SUBMITTED" || requestedStatus === "LATE"
      ? now
      : null;

  await prisma.$transaction(async (tx) => {
    if (data.action === "APPROVE") {
      await tx.homeworkSubmission.update({
        where: { id: submission.id },
        data: {
          status: requestedStatus,
          submittedAt,
          checkedAt: now,
          checkedById: submission.assignment.lesson.teacherId,
          note: request.reason,
        },
      });
    }

    await tx.teacherCorrectionRequest.update({
      where: { id: request.id },
      data: {
        status: data.action === "APPROVE" ? "APPROVED" : "REJECTED",
        reviewedBy: ctx.userId,
        reviewedAt: now,
        reviewNote,
      },
    });

    await tx.teacherAccountabilityAuditLog.create({
      data: {
        schoolId: ctx.schoolId,
        teacherId: request.teacherId,
        actorId: ctx.userId,
        actorRole: ctx.role,
        action: data.action === "APPROVE" ? "CORRECTION_APPROVED" : "CORRECTION_REJECTED",
        sourceModel: "HomeworkSubmission",
        sourceId: String(submission.id),
        before: {
          status: submission.status,
          correctionRequestId: request.id,
        },
        after: {
          requestedStatus,
          requestStatus: data.action === "APPROVE" ? "APPROVED" : "REJECTED",
          reviewNote,
        },
        message: data.action === "APPROVE"
          ? `Homework correction approved for ${submission.student.name} ${submission.student.surname}.`
          : `Homework correction rejected for ${submission.student.name} ${submission.student.surname}.`,
      },
    });
  });

  if (data.action === "APPROVE") {
    const statusLabel = homeworkStatusLabel(requestedStatus);
    await recordParentActivityEvents({
      schoolId: ctx.schoolId,
      studentIds: [submission.studentId],
      teacherId: submission.assignment.lesson.teacherId,
      type: "ASSIGNMENT",
      title: `${submission.assignment.lesson.subject.name} homework ${statusLabel}`,
      body: [
        `${submission.assignment.lesson.subject.name}: ${submission.assignment.title}`,
        `Status corrected to: ${statusLabel}`,
        `Approved by admin`,
        request.reason ? `Reason: ${request.reason}` : null,
      ].filter(Boolean).join("\n"),
      href: "/list/assignments",
      sourceModel: "HomeworkSubmission",
      sourceId: String(submission.id),
      sourceKey: `homework-submission:${submission.id}:approved:${requestedStatus}:${now.getTime()}`,
      occurredAt: now,
      payload: {
        assignmentTitle: submission.assignment.title,
        subjectName: submission.assignment.lesson.subject.name,
        status: requestedStatus,
        note: request.reason,
      },
    });
  }

  await syncHomeworkCheckingObligation({
    schoolId: ctx.schoolId,
    assignmentId: submission.assignmentId,
  });

  revalidatePath("/list/assignments");
  revalidatePath("/teacher/accountability");
  revalidatePath("/admin/accountability");
  revalidatePath("/parent");
  revalidatePath("/parent/updates");
  revalidateDashboard(ctx.schoolId);

  return {
    message: data.action === "APPROVE"
      ? "Homework correction approved and applied."
      : "Homework correction rejected. The saved homework status was not changed.",
  };
}

export type HomeworkBulkSubmissionFormData = {
  assignmentId: number;
  status: "PENDING" | "SUBMITTED" | "LATE" | "MISSING" | "EXCUSED";
  onlyPending?: boolean;
  note?: string | null;
};

export async function updateHomeworkSubmissionsBulk(data: HomeworkBulkSubmissionFormData): Promise<{ updated: number }> {
  const parsed = parseActionInput(homeworkBulkSubmissionSchema, data);
  const ctx = await requireAdminOrTeacher();
  const assignment = await getAssignmentForHomeworkAccess(parsed.assignmentId, ctx.schoolId);
  const assignmentInSchool = requireResourceAccess(assignment, ctx);
  requireHomeworkTeacherAccess(assignmentInSchool, ctx);
  assertHomeworkCanBeChecked(assignmentInSchool.dueDate);

  const isPastDeadline = (() => {
    const end = new Date(assignmentInSchool.dueDate);
    end.setHours(23, 59, 59, 999);
    return end < new Date();
  })();
  const effectiveStatus = parsed.status === "SUBMITTED" && isPastDeadline ? "LATE" : parsed.status;
  if (parsed.status === "SUBMITTED" && isPastDeadline) {
    throw new Error("After the due date, mark late submissions individually so each late record is intentional.");
  }
  if (effectiveStatus === "PENDING") {
    throw new Error("Bulk reset to pending is not allowed after homework records have been created.");
  }
  if (effectiveStatus === "EXCUSED" && !parsed.note?.trim()) {
    throw new Error("Excused homework requires a short note.");
  }

  const submissions = await markHomeworkSubmissionsForAssignment({
    schoolId: ctx.schoolId,
    assignmentId: parsed.assignmentId,
    status: effectiveStatus,
    checkedById: ctx.role === "teacher" ? ctx.userId : null,
    submittedAt: effectiveStatus === "SUBMITTED" || effectiveStatus === "LATE" ? new Date() : null,
    onlyPending: parsed.onlyPending,
    note: parsed.note ?? null,
  });

  if (submissions.length > 0) {
    const statusLabel = effectiveStatus.toLowerCase().replace(/_/g, " ");
    await recordParentActivityEvents({
      schoolId: ctx.schoolId,
      studentIds: submissions.map((submission) => submission.studentId),
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
      sourceId: String(parsed.assignmentId),
      sourceKey: `homework-submission-bulk:${parsed.assignmentId}:${effectiveStatus}:${Date.now()}`,
      occurredAt: new Date(),
      payload: {
        assignmentTitle: assignmentInSchool.title,
        subjectName: assignmentInSchool.lesson.subject.name,
        status: effectiveStatus,
        note: parsed.note ?? null,
      },
    });
  }
  await syncHomeworkCheckingObligation({
    schoolId: ctx.schoolId,
    assignmentId: parsed.assignmentId,
  });

  revalidatePath("/list/assignments");
  revalidatePath("/parent");
  revalidatePath("/parent/updates");
  revalidateDashboard(ctx.schoolId);

  return { updated: submissions.length };
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
