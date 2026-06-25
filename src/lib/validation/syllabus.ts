import { z } from "zod";
import { nonEmptyStringSchema, positiveIntSchema, termSchema } from "./common";

export const syllabusCreateSchema = z.object({
  subjectId: positiveIntSchema,
  gradeId: positiveIntSchema,
  term: termSchema,
  academicYear: nonEmptyStringSchema,
  description: z.string().trim().optional(),
});

export const syllabusTopicSchema = z.object({
  weekNumber: positiveIntSchema,
  durationWeeks: positiveIntSchema.optional().default(1),
  order: positiveIntSchema,
  title: nonEmptyStringSchema,
  subtopics: z.array(z.string().trim()).default([]),
  objectives: z.array(z.string().trim()).default([]),
  coreCompetencies: z.array(z.string().trim()).default([]),
  teachingResources: z.string().trim().optional().nullable(),
});

export const syllabusTopicUpsertSchema = syllabusTopicSchema.extend({
  id: positiveIntSchema.optional(),
  syllabusId: positiveIntSchema,
});

export const syllabusProgressSchema = z.object({
  syllabusTopicId: positiveIntSchema,
  classId: positiveIntSchema,
  notes: z.string().trim().optional().nullable(),
});

export const syllabusUpdateSchema = z.object({
  id: positiveIntSchema,
  description: z.string().trim().max(2000).optional(),
  status: z.enum(["DRAFT", "PUBLISHED"]).optional(),
});

export const syllabusTopicDeleteSchema = z.object({
  topicId: positiveIntSchema,
  syllabusId: positiveIntSchema,
});

export const syllabusTopicOrderSchema = z.object({
  syllabusId: positiveIntSchema,
  orderedIds: z.array(positiveIntSchema).min(1).max(100),
});
