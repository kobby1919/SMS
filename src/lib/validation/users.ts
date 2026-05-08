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
  subjectIds: z.array(positiveIntSchema).default([]),
});
