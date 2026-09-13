import { z } from "zod";
import { positiveIntSchema } from "@/src/lib/validation/common";

export const periodTemplateTypeSchema = z.enum([
  "TEACHING",
  "BREAK",
  "ASSEMBLY",
  "LUNCH",
  "CLOSING",
  "OTHER",
]);

export const timeStringSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:mm time format.");

export const periodTemplateSchema = z.object({
  name: z.string().trim().min(2, "Enter a clear period name.").max(80),
  type: periodTemplateTypeSchema.default("TEACHING"),
  startTime: timeStringSchema,
  endTime: timeStringSchema,
  order: z.coerce.number().int().min(1).max(50),
  isActive: z.boolean().default(true),
});

export const periodTemplateUpdateSchema = periodTemplateSchema.extend({
  id: z.string().trim().min(1),
});

export const periodTemplateDeleteQuerySchema = z.object({
  id: z.string().trim().min(1),
});

export const periodTemplateSelectQuerySchema = z.object({
  classId: positiveIntSchema.optional(),
});
