import { z } from "zod";
import { nonEmptyStringSchema, positiveIntSchema } from "./common";

export const userSexSchema = z.enum(["MALE", "FEMALE"]);
export const studentStatusSchema = z.enum(["INCOMPLETE_SETUP", "ACTIVE", "TRANSFERRED", "GRADUATED", "WITHDRAWN"]);

export const parentCreateSchema = z.object({
  username: nonEmptyStringSchema,
  name: nonEmptyStringSchema,
  surname: nonEmptyStringSchema,
  email: z.string().email().optional().nullable(),
  phone: z.string().trim().optional().nullable(),
  address: nonEmptyStringSchema,
});

export const parentUpdateSchema = parentCreateSchema.omit({ username: true });

const studentBaseSchema = z.object({
  admissionNumber: z.string().trim().min(2, "Admission number is required.").max(40),
  email: z.string().email().optional().nullable().or(z.literal("")),
  name: nonEmptyStringSchema,
  surname: nonEmptyStringSchema,
  phone: z.string().trim().optional().nullable(),
  address: nonEmptyStringSchema,
  bloodType: nonEmptyStringSchema,
  sex: userSexSchema,
  classId: positiveIntSchema,
  parentId: z.string().trim().optional().nullable().or(z.literal("")),
  parentName: z.string().trim().optional().nullable().or(z.literal("")),
  parentSurname: z.string().trim().optional().nullable().or(z.literal("")),
  parentEmail: z.string().email().optional().nullable().or(z.literal("")),
  parentPhone: z.string().trim().optional().nullable().or(z.literal("")),
});

export const studentCreateSchema = studentBaseSchema.superRefine((value, ctx) => {
  if (value.parentId) return;

  if (!value.parentName?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["parentName"],
      message: "Guardian first name is required when no existing parent is selected.",
    });
  }

  if (!value.parentSurname?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["parentSurname"],
      message: "Guardian last name is required when no existing parent is selected.",
    });
  }

  if (!value.parentEmail?.trim() && !value.parentPhone?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["parentEmail"],
      message: "Provide guardian email or phone so Edujay can match or create the parent.",
    });
  }
});

export const studentUpdateSchema = studentBaseSchema.extend({
  status: studentStatusSchema,
}).omit({ email: true, parentName: true, parentSurname: true, parentEmail: true, parentPhone: true });

export const teacherCreateSchema = z.object({
  username: z.string().trim().min(3).max(20),
  email: z.string().email(),
  password: z.string().min(8),
  name: nonEmptyStringSchema,
  surname: nonEmptyStringSchema,
  phone: z.string().trim().min(7, "Phone number is required and must be at least 7 characters."),
  address: nonEmptyStringSchema,
  bloodType: nonEmptyStringSchema,
  sex: userSexSchema,
  subjectIds: z.preprocess((value) => {
    if (typeof value !== "string") return value;
    try {
      return JSON.parse(value || "[]");
    } catch {
      return value;
    }
  }, z.array(positiveIntSchema).default([])),
});

export const teacherUpdateSchema = teacherCreateSchema.omit({
  username: true,
  email: true,
  password: true,
});

