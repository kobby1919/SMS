import { z } from "zod";

export const parentRelationshipStatusSchema = z.enum([
  "ACTIVE",
  "REMOVED",
  "TRANSFERRED",
  "REVOKED",
  "GRADUATED",
]);

export const parentRelationshipRoleSchema = z.enum([
  "PRIMARY_GUARDIAN",
  "GUARDIAN",
  "EMERGENCY_CONTACT",
  "FINANCE_CONTACT",
  "PICKUP_AUTHORIZED",
]);

const optionalNoteSchema = z.preprocess(
  (value) => (typeof value === "string" && value.trim().length === 0 ? null : value),
  z.string().trim().max(500, "Note must be 500 characters or fewer.").nullable().optional(),
);

export const parentRelationshipCreateSchema = z.object({
  parentId: z.string().trim().min(1, "Parent id is required."),
  studentId: z.string().trim().min(1, "Select a ward."),
  role: parentRelationshipRoleSchema.default("PRIMARY_GUARDIAN"),
  note: optionalNoteSchema,
  canViewFees: z.coerce.boolean().default(true),
  canViewReports: z.coerce.boolean().default(true),
  canMessageSchool: z.coerce.boolean().default(true),
});

export const parentRelationshipStatusUpdateSchema = z.object({
  relationshipId: z.string().trim().min(1, "Relationship id is required."),
  status: parentRelationshipStatusSchema,
  note: optionalNoteSchema,
});

export type ParentRelationshipCreateInput = z.infer<typeof parentRelationshipCreateSchema>;
export type ParentRelationshipStatusUpdateInput = z.infer<typeof parentRelationshipStatusUpdateSchema>;
