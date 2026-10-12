"use server";

import type { Prisma, Term, SyllabusStatus } from "@/src/generated/prisma";
import { requireRole } from "@/src/lib/authz";
import { revalidatePath } from "next/cache";
import { parseActionInput } from "@/src/lib/validation/parse";
import { revalidateDashboard, revalidateDocument } from "@/src/lib/cacheTags";
import { assertWithinSchoolOperatingHours } from "@/src/lib/services/school-operating-hours";
import { withCurriculumWrite } from "@/src/lib/services/curriculum-write";
import { syllabusCreateSchema, syllabusProgressSchema, syllabusTopicDeleteSchema, syllabusTopicOrderSchema, syllabusTopicUpsertSchema, syllabusTopicSchema, syllabusUpdateSchema } from "@/src/lib/validation/syllabus";
import { positiveIntSchema } from "@/src/lib/validation/common";

function refresh(schoolId: string, id: number) {
  revalidatePath("/list/syllabus");
  revalidatePath(`/list/syllabus/${id}`);
  revalidatePath(`/list/syllabus/${id}/edit`);
  revalidateDashboard(schoolId);
  revalidateDocument(schoolId, "syllabus", id);
}
async function requireGuide(db: Prisma.TransactionClient, schoolId: string, id: number) {
  const guide = await db.syllabus.findFirst({ where: { id, schoolId, subject: { is: { schoolId } }, grade: { is: { schoolId } } }, select: { id: true, status: true } });
  if (!guide) throw new Error("Teaching guide not found.");
  return guide;
}
async function requireNoCoverage(db: Prisma.TransactionClient, syllabusId: number) {
  if (await db.syllabusTopicProgress.count({ where: { syllabusTopic: { is: { syllabusId } } } })) throw new Error("This guide has recorded coverage. Preserve it as history and prepare a new guide for the next period.");
}
async function requireEditableGuide(db: Prisma.TransactionClient, schoolId: string, id: number) {
  const guide = await requireGuide(db, schoolId, id);
  if (guide.status !== "DRAFT") throw new Error("Unpublish the guide before editing its teaching plan.");
  await requireNoCoverage(db, id);
}
async function setGuideStatus(db: Prisma.TransactionClient, schoolId: string, id: number, status: SyllabusStatus) {
  await requireGuide(db, schoolId, id);
  if (status === "PUBLISHED") {
    const topics = await db.syllabusTopic.findMany({ where: { syllabusId: id } });
    if (!topics.length) throw new Error("Add at least one topic before publishing.");
    if (topics.some((topic) => !syllabusTopicSchema.safeParse(topic).success || topic.weekNumber + topic.durationWeeks - 1 > 52)) throw new Error("Correct invalid topic details and planned weeks before publishing.");
  } else await requireNoCoverage(db, id);
  await db.syllabus.updateMany({ where: { id, schoolId }, data: { status } });
}

export type SyllabusInput = { subjectId: number; gradeId: number; term: Term; academicYear: string; description?: string };
export async function createSyllabus(data: SyllabusInput) {
  const { schoolId } = await requireRole(["admin"]);
  const parsed = parseActionInput(syllabusCreateSchema, data);
  const guide = await withCurriculumWrite(async (db) => {
    const subject = await db.subject.findFirst({ where: { id: parsed.subjectId, schoolId }, select: { id: true } });
    const grade = await db.grade.findFirst({ where: { id: parsed.gradeId, schoolId }, select: { id: true } });
    if (!subject || !grade) throw new Error("Choose a subject and grade belonging to your school.");
    return db.syllabus.create({ data: { ...parsed, schoolId, status: "DRAFT" } });
  });
  refresh(schoolId, guide.id);
  return guide;
}
export async function updateSyllabus(id: number, data: { description?: string; status?: SyllabusStatus }) {
  const { schoolId } = await requireRole(["admin"]);
  const parsed = parseActionInput(syllabusUpdateSchema, { ...data, id });
  await withCurriculumWrite(async (db) => {
    await requireGuide(db, schoolId, parsed.id);
    if (parsed.status) await setGuideStatus(db, schoolId, parsed.id, parsed.status);
    if (parsed.description !== undefined) await db.syllabus.updateMany({ where: { id: parsed.id, schoolId }, data: { description: parsed.description } });
  });
  refresh(schoolId, parsed.id);
}
export async function deleteSyllabus(id: number) {
  const { schoolId } = await requireRole(["admin"]);
  id = parseActionInput(positiveIntSchema, id);
  await withCurriculumWrite(async (db) => {
    await requireEditableGuide(db, schoolId, id);
    await db.syllabus.deleteMany({ where: { id, schoolId } });
  });
  refresh(schoolId, id);
}
export async function publishSyllabus(id: number) {
  const { schoolId } = await requireRole(["admin"]);
  id = parseActionInput(positiveIntSchema, id);
  await withCurriculumWrite((db) => setGuideStatus(db, schoolId, id, "PUBLISHED"));
  refresh(schoolId, id);
}
export async function unpublishSyllabus(id: number) {
  const { schoolId } = await requireRole(["admin"]);
  id = parseActionInput(positiveIntSchema, id);
  await withCurriculumWrite((db) => setGuideStatus(db, schoolId, id, "DRAFT"));
  refresh(schoolId, id);
}
export type TopicInput = { id?: number; syllabusId: number; weekNumber: number; durationWeeks?: number; order: number; title: string; subtopics: string[]; objectives: string[]; coreCompetencies: string[]; teachingResources?: string | null };
export async function upsertSyllabusTopic(input: TopicInput) {
  const { schoolId } = await requireRole(["admin"]);
  const { id, ...data } = parseActionInput(syllabusTopicUpsertSchema, input);
  const topic = await withCurriculumWrite(async (db) => {
    await requireEditableGuide(db, schoolId, data.syllabusId);
    if (!id) return db.syllabusTopic.create({ data, select: { id: true } });
    const existing = await db.syllabusTopic.findFirst({ where: { id, syllabusId: data.syllabusId }, select: { id: true } });
    if (!existing) throw new Error("Topic not found in this guide.");
    return db.syllabusTopic.update({ where: { id }, data, select: { id: true } });
  });
  refresh(schoolId, data.syllabusId);
  return topic;
}
export async function deleteSyllabusTopic(topicId: number, syllabusId: number) {
  const { schoolId } = await requireRole(["admin"]);
  ({ topicId, syllabusId } = parseActionInput(syllabusTopicDeleteSchema, { topicId, syllabusId }));
  await withCurriculumWrite(async (db) => {
    await requireEditableGuide(db, schoolId, syllabusId);
    const deleted = await db.syllabusTopic.deleteMany({ where: { id: topicId, syllabusId } });
    if (!deleted.count) throw new Error("Topic not found in this guide.");
  });
  refresh(schoolId, syllabusId);
}
export async function reorderTopics(syllabusId: number, orderedIds: number[]) {
  const { schoolId } = await requireRole(["admin"]);
  ({ syllabusId, orderedIds } = parseActionInput(syllabusTopicOrderSchema, { syllabusId, orderedIds }));
  if (new Set(orderedIds).size !== orderedIds.length) throw new Error("Topic order contains duplicates.");
  await withCurriculumWrite(async (db) => {
    await requireEditableGuide(db, schoolId, syllabusId);
    const topics = await db.syllabusTopic.findMany({ where: { syllabusId }, select: { id: true } });
    if (topics.length !== orderedIds.length || topics.some((topic) => !orderedIds.includes(topic.id))) throw new Error("Include each topic in this guide exactly once.");
    for (const [index, id] of orderedIds.entries()) await db.syllabusTopic.update({ where: { id }, data: { order: index + 1 } });
  });
  refresh(schoolId, syllabusId);
}

async function progressAccess(db: Prisma.TransactionClient, schoolId: string, userId: string, syllabusTopicId: number, classId: number) {
  const topic = await db.syllabusTopic.findFirst({ where: { id: syllabusTopicId, syllabus: { is: { schoolId, status: "PUBLISHED", subject: { is: { schoolId } }, grade: { is: { schoolId } } } } }, select: { syllabusId: true, syllabus: { select: { subjectId: true, gradeId: true, academicYear: true, term: true } } } });
  const cls = await db.class.findFirst({ where: { id: classId, schoolId }, select: { gradeId: true } });
  const teacher = await db.teacher.findFirst({ where: { id: userId, schoolId, status: "ACTIVE" }, select: { id: true } });
  if (!topic || !cls || !teacher || cls.gradeId !== topic.syllabus.gradeId) throw new Error("This published guide is not available for your class.");
  const period = await db.cAConfig.findFirst({ where: { schoolId, isActive: true }, orderBy: { updatedAt: "desc" }, select: { academicYear: true, currentTerm: true } });
  if (!period || period.academicYear !== topic.syllabus.academicYear || period.currentTerm !== topic.syllabus.term) throw new Error("Coverage can only be recorded for the active school period.");
  const publication = await db.timetablePublication.findFirst({ where: { schoolId, status: "ACTIVE" }, orderBy: { version: "desc" }, select: { lessons: { where: { schoolId, teacherId: userId, classId, subjectId: topic.syllabus.subjectId }, select: { id: true } } } });
  if (!publication?.lessons.length) throw new Error("You can only record coverage for classes and subjects assigned to you in the active published timetable.");
  await assertWithinSchoolOperatingHours(schoolId, "Updating syllabus progress", db);
  const existing = await db.syllabusTopicProgress.findUnique({ where: { schoolId_syllabusTopicId_classId: { schoolId, syllabusTopicId, classId } }, select: { teacherId: true } });
  if (existing && existing.teacherId !== userId) throw new Error("This coverage was recorded by another teacher and cannot be overwritten or removed by you.");
  return topic;
}
export async function markTopicCovered(syllabusTopicId: number, classId: number, notes?: string | null) {
  const { userId, schoolId } = await requireRole(["teacher"]);
  ({ syllabusTopicId, classId, notes } = parseActionInput(syllabusProgressSchema, { syllabusTopicId, classId, notes }));
  const topic = await withCurriculumWrite(async (db) => {
    const topic = await progressAccess(db, schoolId, userId, syllabusTopicId, classId);
    await db.syllabusTopicProgress.upsert({ where: { schoolId_syllabusTopicId_classId: { schoolId, syllabusTopicId, classId } }, create: { schoolId, syllabusTopicId, classId, teacherId: userId, coveredDate: new Date(), notes: notes ?? "" }, update: { notes: notes ?? "" } });
    return topic;
  });
  refresh(schoolId, topic.syllabusId);
}
export async function unmarkTopicCovered(syllabusTopicId: number, classId: number) {
  const { userId, schoolId } = await requireRole(["teacher"]);
  ({ syllabusTopicId, classId } = parseActionInput(syllabusProgressSchema, { syllabusTopicId, classId }));
  const topic = await withCurriculumWrite(async (db) => {
    const topic = await progressAccess(db, schoolId, userId, syllabusTopicId, classId);
    await db.syllabusTopicProgress.deleteMany({ where: { schoolId, syllabusTopicId, classId, teacherId: userId } });
    return topic;
  });
  refresh(schoolId, topic.syllabusId);
}
