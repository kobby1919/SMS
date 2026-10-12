import { z } from "zod";
import { nonEmptyStringSchema, positiveIntSchema, termSchema } from "./common";

export const syllabusCreateSchema = z.object({
  subjectId: positiveIntSchema,
  gradeId: positiveIntSchema,
  term: termSchema,
  academicYear: nonEmptyStringSchema.max(20),
  description: z.string().trim().max(2000).optional(),
});

export const syllabusTopicSchema = z.object({
  weekNumber: positiveIntSchema.max(52),
  durationWeeks: positiveIntSchema.max(52).optional().default(1),
  order: positiveIntSchema.max(1000),
  title: nonEmptyStringSchema.max(300),
  subtopics: z.array(z.string().trim().max(500)).max(100).default([]),
  objectives: z.array(z.string().trim().max(500)).max(100).default([]),
  coreCompetencies: z.array(z.string().trim().max(500)).max(100).default([]),
  teachingResources: z.string().trim().max(4000).optional().nullable(),
});

export const syllabusTopicUpsertSchema = syllabusTopicSchema.extend({
  id: positiveIntSchema.optional(),
  syllabusId: positiveIntSchema,
}).refine((topic) => topic.weekNumber + topic.durationWeeks - 1 <= 52, { message: "Planned topic weeks must fit within 52 weeks.", path: ["durationWeeks"] });

export const syllabusProgressSchema = z.object({
  syllabusTopicId: positiveIntSchema,
  classId: positiveIntSchema,
  notes: z.string().trim().max(2000).optional().nullable(),
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
