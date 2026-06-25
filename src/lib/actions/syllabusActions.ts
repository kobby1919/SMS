"use server";

// src/lib/actions/syllabusActions.ts

import prisma from "@/src/lib/prisma";
import { requireRole } from "@/src/lib/authz";
import { revalidatePath } from "next/cache";
import type { Term, SyllabusStatus } from "@/src/generated/prisma";
import { parseActionInput } from "@/src/lib/validation/parse";
import { revalidateDashboard, revalidateDocument } from "@/src/lib/cacheTags";
import {
  syllabusCreateSchema,
  syllabusProgressSchema,
  syllabusTopicDeleteSchema,
  syllabusTopicOrderSchema,
  syllabusTopicUpsertSchema,
  syllabusUpdateSchema,
} from "@/src/lib/validation/syllabus";
import { positiveIntSchema } from "@/src/lib/validation/common";

// ─── Auth helpers ─────────────────────────────────────────────────────────────

async function requireAdmin(): Promise<{ userId: string; schoolId: string }> {
  const { userId, schoolId } = await requireRole(["admin"]);
  return { userId, schoolId };
}

async function requireAdminOrTeacher(): Promise<{ userId: string; role: string; schoolId: string }> {
  const { userId, role, schoolId } = await requireRole(["admin", "teacher"]);
  return { userId, role, schoolId };
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
  const { schoolId } = await requireAdmin();
  const parsed = parseActionInput(syllabusCreateSchema, data);

  const existing = await prisma.syllabus.findUnique({
    where: {
      schoolId_subjectId_gradeId_term_academicYear: {
        schoolId,
        subjectId:    parsed.subjectId,
        gradeId:      parsed.gradeId,
        term:         parsed.term,
        academicYear: parsed.academicYear,
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
      subjectId:    parsed.subjectId,
      schoolId,
      gradeId:      parsed.gradeId,
      term:         parsed.term,
      academicYear: parsed.academicYear,
      description:  parsed.description ?? "",
      status:       "DRAFT",
    },
  });

  revalidatePath("/list/syllabus");
  revalidateSyllabusDocument(schoolId, syllabus.id);
  return syllabus;
}

export async function updateSyllabus(
  id: number,
  data: { description?: string; status?: SyllabusStatus }
) {
  const parsed = parseActionInput(syllabusUpdateSchema, { id, ...data });
  id = parsed.id;
  data = { description: parsed.description, status: parsed.status };
  const { schoolId } = await requireAdmin();
  const syllabus = await prisma.syllabus.findFirst({
    where: { id, schoolId },
    select: { id: true },
  });
  if (!syllabus) throw new Error("Syllabus not found.");
  await prisma.syllabus.update({ where: { id }, data });
  revalidatePath("/list/syllabus");
  revalidatePath(`/list/syllabus/${id}`);
  revalidateDashboard(schoolId);
  revalidateSyllabusDocument(schoolId, id);
}

function revalidateSyllabusDocument(schoolId: string, syllabusId: number) {
  revalidateDocument(schoolId, "syllabus", syllabusId);
}

export async function deleteSyllabus(id: number) {
  id = parseActionInput(positiveIntSchema, id);
  const { schoolId } = await requireAdmin();
  const syllabus = await prisma.syllabus.findFirst({
    where: { id, schoolId },
    select: { id: true },
  });
  if (!syllabus) throw new Error("Syllabus not found.");
  // Cascade deletes topics + progress via schema onDelete: Cascade
  await prisma.syllabus.delete({ where: { id } });
  revalidatePath("/list/syllabus");
  revalidateDashboard(schoolId);
  revalidateSyllabusDocument(schoolId, id);
}

export async function publishSyllabus(id: number) {
  id = parseActionInput(positiveIntSchema, id);
  const { schoolId } = await requireAdmin();
  const syllabus = await prisma.syllabus.findFirst({
    where: { id, schoolId },
    select: { id: true },
  });
  if (!syllabus) throw new Error("Syllabus not found.");
  // Must have at least one topic to publish
  const count = await prisma.syllabusTopic.count({ where: { syllabusId: id } });
  if (count === 0) throw new Error("Add at least one topic before publishing.");
  await prisma.syllabus.update({ where: { id }, data: { status: "PUBLISHED" } });
  revalidatePath("/list/syllabus");
  revalidatePath(`/list/syllabus/${id}`);
  revalidateDashboard(schoolId);
  revalidateSyllabusDocument(schoolId, id);
}

export async function unpublishSyllabus(id: number) {
  id = parseActionInput(positiveIntSchema, id);
  const { schoolId } = await requireAdmin();
  const syllabus = await prisma.syllabus.findFirst({
    where: { id, schoolId },
    select: { id: true },
  });
  if (!syllabus) throw new Error("Syllabus not found.");
  await prisma.syllabus.update({ where: { id }, data: { status: "DRAFT" } });
  revalidatePath("/list/syllabus");
  revalidatePath(`/list/syllabus/${id}`);
  revalidateDashboard(schoolId);
  revalidateSyllabusDocument(schoolId, id);
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
  teachingResources?: string | null;
};

export async function upsertSyllabusTopic(data: TopicInput) {
  data = parseActionInput(syllabusTopicUpsertSchema, data);
  const { schoolId } = await requireAdmin();

  if (!data.title.trim()) throw new Error("Topic title is required.");
  if (data.weekNumber < 1) throw new Error("Week number must be 1 or greater.");
  const syllabus = await prisma.syllabus.findFirst({
    where: { id: data.syllabusId, schoolId },
    select: { id: true },
  });
  if (!syllabus) throw new Error("Syllabus not found.");

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
    const topic = await prisma.syllabusTopic.findFirst({
      where: {
        id: data.id,
        syllabusId: data.syllabusId,
        syllabus: { is: { schoolId } },
      },
      select: { id: true },
    });
    if (!topic) throw new Error("Topic not found.");
    await prisma.syllabusTopic.update({ where: { id: data.id }, data: payload });
  } else {
    await prisma.syllabusTopic.create({ data: payload });
  }

  revalidatePath(`/list/syllabus/${data.syllabusId}`);
  revalidatePath(`/list/syllabus/${data.syllabusId}/edit`);
  revalidateSyllabusDocument(schoolId, data.syllabusId);
}

export async function deleteSyllabusTopic(topicId: number, syllabusId: number) {
  ({ topicId, syllabusId } = parseActionInput(syllabusTopicDeleteSchema, { topicId, syllabusId }));
  const { schoolId } = await requireAdmin();
  const topic = await prisma.syllabusTopic.findFirst({
    where: {
      id: topicId,
      syllabusId,
      syllabus: { is: { schoolId } },
    },
    select: { id: true },
  });
  if (!topic) throw new Error("Topic not found.");
  await prisma.syllabusTopic.delete({ where: { id: topicId } });
  revalidatePath(`/list/syllabus/${syllabusId}`);
  revalidatePath(`/list/syllabus/${syllabusId}/edit`);
  revalidateSyllabusDocument(schoolId, syllabusId);
}

export async function reorderTopics(
  syllabusId: number,
  orderedIds: number[]   // topic ids in the new order
) {
  ({ syllabusId, orderedIds } = parseActionInput(syllabusTopicOrderSchema, { syllabusId, orderedIds }));
  const { schoolId } = await requireAdmin();
  const syllabus = await prisma.syllabus.findFirst({
    where: { id: syllabusId, schoolId },
    select: { id: true },
  });
  if (!syllabus) throw new Error("Syllabus not found.");
  const topics = await prisma.syllabusTopic.findMany({
    where: {
      id: { in: orderedIds },
      syllabusId,
      syllabus: { is: { schoolId } },
    },
    select: { id: true },
  });
  if (topics.length !== orderedIds.length) {
    throw new Error("One or more topics were not found.");
  }
  await prisma.$transaction(
    orderedIds.map((id, idx) =>
      prisma.syllabusTopic.update({ where: { id }, data: { order: idx + 1 } })
    )
  );
  revalidatePath(`/list/syllabus/${syllabusId}/edit`);
  revalidateSyllabusDocument(schoolId, syllabusId);
}

// ─── PROGRESS (teacher) ───────────────────────────────────────────────────────

export async function markTopicCovered(
  syllabusTopicId: number,
  classId:         number,
  notes?:          string | null
) {
  ({ syllabusTopicId, classId, notes } = parseActionInput(syllabusProgressSchema, { syllabusTopicId, classId, notes }));
  const { userId, schoolId } = await requireAdminOrTeacher();
  const [topic, cls] = await Promise.all([
    prisma.syllabusTopic.findFirst({
      where: { id: syllabusTopicId, syllabus: { is: { schoolId } } },
      select: { syllabusId: true },
    }),
    prisma.class.findFirst({
      where: { id: classId, schoolId },
      select: { id: true },
    }),
  ]);
  if (!topic) throw new Error("Topic not found.");
  if (!cls) throw new Error("Class not found.");

  await prisma.syllabusTopicProgress.upsert({
    where: { schoolId_syllabusTopicId_classId: { schoolId, syllabusTopicId, classId } },
    create: {
      schoolId,
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

  revalidatePath(`/list/syllabus/${topic.syllabusId}`);
  revalidateSyllabusDocument(schoolId, topic.syllabusId);
}

export async function unmarkTopicCovered(
  syllabusTopicId: number,
  classId:         number
) {
  ({ syllabusTopicId, classId } = parseActionInput(syllabusProgressSchema, { syllabusTopicId, classId }));
  const { schoolId } = await requireAdminOrTeacher();
  const topic = await prisma.syllabusTopic.findFirst({
    where: { id: syllabusTopicId, syllabus: { is: { schoolId } } },
    select: { syllabusId: true },
  });
  if (!topic) throw new Error("Topic not found.");
  const cls = await prisma.class.findFirst({
    where: { id: classId, schoolId },
    select: { id: true },
  });
  if (!cls) throw new Error("Class not found.");

  await prisma.syllabusTopicProgress.deleteMany({
    where: { schoolId, syllabusTopicId, classId },
  });

  revalidatePath(`/list/syllabus/${topic.syllabusId}`);
  revalidateSyllabusDocument(schoolId, topic.syllabusId);
}
