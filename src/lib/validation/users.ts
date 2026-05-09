import { z } from "zod";
import { nonEmptyStringSchema, positiveIntSchema } from "./common";

export const userSexSchema = z.enum(["MALE", "FEMALE"]);

export const parentCreateSchema = z.object({
  username: nonEmptyStringSchema,
  name: nonEmptyStringSchema,
  surname: nonEmptyStringSchema,
  email: z.string().email().optional().nullable(),
  phone: z.string().trim().optional().nullable(),
  address: nonEmptyStringSchema,
});

export const parentUpdateSchema = parentCreateSchema.omit({ username: true });

export const studentCreateSchema = z.object({
  username: z.string().trim().min(3).max(20),
  email: z.string().email().optional().nullable().or(z.literal("")),
  password: z.string().min(8),
  name: nonEmptyStringSchema,
  surname: nonEmptyStringSchema,
  phone: z.string().trim().optional().nullable(),
  address: nonEmptyStringSchema,
  bloodType: nonEmptyStringSchema,
  sex: userSexSchema,
  classId: positiveIntSchema,
  parentId: nonEmptyStringSchema,
});

export const studentUpdateSchema = studentCreateSchema.omit({
  username: true,
  email: true,
  password: true,
});

export const teacherCreateSchema = z.object({
  username: z.string().trim().min(3).max(20),
  email: z.string().email(),
  password: z.string().min(8),
  name: nonEmptyStringSchema,
  surname: nonEmptyStringSchema,
  phone: z.string().trim().optional().nullable(),
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
