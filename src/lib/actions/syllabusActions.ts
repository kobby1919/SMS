"use server";

// src/lib/actions/syllabusActions.ts
// All server actions for the Syllabus Management feature.

import prisma from "@/src/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import type { Term, SyllabusStatus } from "@/src/generated/prisma";

// ─── Auth helpers ─────────────────────────────────────────────────────────────

async function requireAdmin(): Promise<string> {
  const { userId, sessionClaims } = await auth();
  const role = (sessionClaims?.metadata as { role?: string })?.role;
  if (!userId || role !== "admin") throw new Error("Only admins can perform this action.");
  return userId;
}

async function requireAdminOrTeacher(): Promise<{ userId: string; role: string }> {
  const { userId, sessionClaims } = await auth();
  const role = (sessionClaims?.metadata as { role?: string })?.role;
  if (!userId || (role !== "admin" && role !== "teacher"))
    throw new Error("Unauthorized.");
  return { userId, role };
}

// ─── SYLLABUS CRUD ────────────────────────────────────────────────────────────

export type SyllabusInput = {
  subjectId:    number;
  gradeId:      number;
  term:         Term;
  academicYear: string;
  description?: string;
};

export async function createSyllabus(data: SyllabusInput) {
  await requireAdmin();

  // Check for duplicate
  const existing = await prisma.syllabus.findUnique({
    where: {
      subjectId_gradeId_term_academicYear: {
        subjectId:    data.subjectId,
        gradeId:      data.gradeId,
        term:         data.term,
        academicYear: data.academicYear,
      },
    },
  });
  if (existing) {
    throw new Error(
      "A syllabus for this subject, grade, term, and year already exists."
    );
  }

  const syllabus = await prisma.syllabus.create({
    data: {
      subjectId:    data.subjectId,
      gradeId:      data.gradeId,
      term:         data.term,
      academicYear: data.academicYear,
      description:  data.description ?? "",
      status:       "DRAFT",
    },
  });

  revalidatePath("/list/syllabus");
  return syllabus;
}

export async function updateSyllabus(
  id: number,
  data: { description?: string; status?: SyllabusStatus }
) {
  await requireAdmin();
  await prisma.syllabus.update({ where: { id }, data });
  revalidatePath("/list/syllabus");
  revalidatePath(`/list/syllabus/${id}`);
}

export async function deleteSyllabus(id: number) {
  await requireAdmin();
  // Cascade deletes topics + progress via schema onDelete: Cascade
  await prisma.syllabus.delete({ where: { id } });
  revalidatePath("/list/syllabus");
}

export async function publishSyllabus(id: number) {
  await requireAdmin();
  // Must have at least one topic to publish
  const count = await prisma.syllabusTopic.count({ where: { syllabusId: id } });
  if (count === 0) throw new Error("Add at least one topic before publishing.");
  await prisma.syllabus.update({ where: { id }, data: { status: "PUBLISHED" } });
  revalidatePath("/list/syllabus");
  revalidatePath(`/list/syllabus/${id}`);
}

export async function unpublishSyllabus(id: number) {
  await requireAdmin();
  await prisma.syllabus.update({ where: { id }, data: { status: "DRAFT" } });
  revalidatePath("/list/syllabus");
  revalidatePath(`/list/syllabus/${id}`);
}

// ─── TOPIC CRUD ───────────────────────────────────────────────────────────────

export type TopicInput = {
  id?:                number;    // present = update, absent = create
  syllabusId:         number;
  weekNumber:         number;
  durationWeeks?:     number;
  order:              number;
  title:              string;
  subtopics:          string[];
  objectives:         string[];
  coreCompetencies:   string[];
  teachingResources?: string;
};

export async function upsertSyllabusTopic(data: TopicInput) {
  await requireAdmin();

  if (!data.title.trim()) throw new Error("Topic title is required.");
  if (data.weekNumber < 1) throw new Error("Week number must be 1 or greater.");

  const payload = {
    syllabusId:        data.syllabusId,
    weekNumber:        data.weekNumber,
    durationWeeks:     data.durationWeeks ?? 1,
    order:             data.order,
    title:             data.title.trim(),
    subtopics:         data.subtopics.filter(Boolean),
    objectives:        data.objectives.filter(Boolean),
    coreCompetencies:  data.coreCompetencies.filter(Boolean),
    teachingResources: data.teachingResources?.trim() ?? null,
  };

  if (data.id) {
    await prisma.syllabusTopic.update({ where: { id: data.id }, data: payload });
  } else {
    await prisma.syllabusTopic.create({ data: payload });
  }

  revalidatePath(`/list/syllabus/${data.syllabusId}`);
  revalidatePath(`/list/syllabus/${data.syllabusId}/edit`);
}

export async function deleteSyllabusTopic(topicId: number, syllabusId: number) {
  await requireAdmin();
  await prisma.syllabusTopic.delete({ where: { id: topicId } });
  revalidatePath(`/list/syllabus/${syllabusId}`);
  revalidatePath(`/list/syllabus/${syllabusId}/edit`);
}

export async function reorderTopics(
  syllabusId: number,
  orderedIds: number[]   // topic ids in the new order
) {
  await requireAdmin();
  await Promise.all(
    orderedIds.map((id, idx) =>
      prisma.syllabusTopic.update({ where: { id }, data: { order: idx + 1 } })
    )
  );
  revalidatePath(`/list/syllabus/${syllabusId}/edit`);
}

// ─── PROGRESS (teacher) ───────────────────────────────────────────────────────

export async function markTopicCovered(
  syllabusTopicId: number,
  classId:         number,
  notes?:          string
) {
  const { userId } = await requireAdminOrTeacher();

  await prisma.syllabusTopicProgress.upsert({
    where: { syllabusTopicId_classId: { syllabusTopicId, classId } },
    create: {
      syllabusTopicId,
      classId,
      teacherId:   userId,
      coveredDate: new Date(),
      notes:       notes ?? "",
    },
    update: {
      teacherId:   userId,
      coveredDate: new Date(),
      notes:       notes ?? "",
    },
  });

  // Find the syllabus id for revalidation
  const topic = await prisma.syllabusTopic.findUnique({
    where:  { id: syllabusTopicId },
    select: { syllabusId: true },
  });
  if (topic) revalidatePath(`/list/syllabus/${topic.syllabusId}`);
}

export async function unmarkTopicCovered(
  syllabusTopicId: number,
  classId:         number
) {
  await requireAdminOrTeacher();

  await prisma.syllabusTopicProgress.deleteMany({
    where: { syllabusTopicId, classId },
  });

  const topic = await prisma.syllabusTopic.findUnique({
    where:  { id: syllabusTopicId },
    select: { syllabusId: true },
  });
  if (topic) revalidatePath(`/list/syllabus/${topic.syllabusId}`);
}