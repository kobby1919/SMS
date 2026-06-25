"use server";

// src/lib/actions/caActions.ts
// Server actions for Continuous Assessment feature

import prisma from "@/src/lib/prisma";
import { requireRole } from "@/src/lib/authz";
import { revalidatePath } from "next/cache";
import { revalidateDashboard, revalidateDocument } from "@/src/lib/cacheTags";
import { parseActionInput } from "@/src/lib/validation/parse";
import {
  caBulkEntrySchema,
  caConfigSchema,
  caRecordSchema,
  caRecordUpdateSchema,
} from "@/src/lib/validation/ca";
import { nonEmptyStringSchema, positiveIntSchema } from "@/src/lib/validation/common";
import type { Term } from "@/src/generated/prisma";

// ─── Ghana BECE Grading System ────────────────────────────────────────────────
// Score ranges → letter grade + grade point
export async function getBECEGrade(score: number): Promise<{ grade: string; gradePoint: number }> {
  if (score >= 90) return { grade: "A1", gradePoint: 1 };
  if (score >= 80) return { grade: "B2", gradePoint: 2 };
  if (score >= 75) return { grade: "B3", gradePoint: 3 };
  if (score >= 70) return { grade: "C4", gradePoint: 4 };
  if (score >= 65) return { grade: "C5", gradePoint: 5 };
  if (score >= 60) return { grade: "C6", gradePoint: 6 };
  if (score >= 55) return { grade: "D7", gradePoint: 7 };
  if (score >= 50) return { grade: "E8", gradePoint: 8 };
  return { grade: "F9", gradePoint: 9 };
}

// Corrected return type to Promise
export async function getGradeLabel(grade: string): Promise<string> {
  const labels: Record<string, string> = {
    A1: "Excellent",       B2: "Very Good",
    B3: "Good",            C4: "Credit",
    C5: "Credit",          C6: "Credit",
    D7: "Pass",            E8: "Pass",
    F9: "Fail",
  };
  return labels[grade] ?? "—";
}

// ─── Auth: only class supervisor / admin may write CA records ─────────────────
async function requireCAAccess(classId: number): Promise<{ userId: string; schoolId: string }> {
  const { userId, role, schoolId } = await requireRole(["admin", "teacher"]);

  if (role === "admin") return { userId, schoolId };

  if (role === "teacher") {
    const cls = await prisma.class.findFirst({
      where: { id: classId, schoolId },
      select: { supervisorId: true },
    });
    if (cls?.supervisorId !== userId) {
      throw new Error("Only the class supervisor can manage CA records for this class.");
    }
    return { userId, schoolId };
  }

  throw new Error("Unauthorized");
}

// ═══════════════════════════════════════════════════════════════════════════════
// CA CONFIG
// ═══════════════════════════════════════════════════════════════════════════════

export type CAConfigInput = {
  academicYear:    string;
  classworkWeight: number;
  examWeight:      number;
};

export async function upsertCAConfig(data: CAConfigInput) {
  const { schoolId } = await requireRole(["admin"]);
  const parsed = parseActionInput(caConfigSchema, data);

  const config = await prisma.cAConfig.upsert({
    where: { schoolId_academicYear: { schoolId, academicYear: parsed.academicYear } },
    create: {
      schoolId,
      academicYear:    parsed.academicYear,
      classworkWeight: parsed.classworkWeight,
      examWeight:      parsed.examWeight,
    },
    update: {
      classworkWeight: parsed.classworkWeight,
      examWeight:      parsed.examWeight,
    },
  });

  revalidatePath("/list/ca");
  revalidatePath("/admin");
  revalidateDashboard(schoolId);
  revalidateDocument(schoolId, "report-card");
  return config;
}

export async function getCAConfig(academicYear: string) {
  academicYear = parseActionInput(nonEmptyStringSchema, academicYear);
  const { schoolId } = await requireRole(["admin", "teacher"]);
  return prisma.cAConfig.findUnique({
    where: { schoolId_academicYear: { schoolId, academicYear } },
  });
}

export async function getAllCAConfigs() {
  const { schoolId } = await requireRole(["admin", "teacher"]);
  return prisma.cAConfig.findMany({ where: { schoolId }, orderBy: { academicYear: "desc" } });
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONTINUOUS ASSESSMENT CRUD
// ═══════════════════════════════════════════════════════════════════════════════

export type CAInput = {
  id?:           number;
  studentId:     string;
  subjectId:     number;
  classId:       number;
  term:          Term;
  academicYear:  string;
  classworkScore: number; // 0–100
  examScore:      number; // 0–100
  remarks?:       string;
};

/** Calculate weighted total and derive grade */
async function computeCA(
  classworkScore: number,
  examScore: number,
  classworkWeight: number,
  examWeight: number
): Promise<{ totalScore: number; grade: string; gradePoint: number }> { 
  const totalScore =
    (classworkScore * classworkWeight) / 100 +
    (examScore * examWeight) / 100;

  const rounded = Math.round(totalScore * 100) / 100;
  
  const { grade, gradePoint } = await getBECEGrade(rounded); 
  
  return { totalScore: rounded, grade, gradePoint };
}

export async function createCA(data: CAInput) {
  const parsed = parseActionInput(caRecordSchema, data);
  const { userId: teacherId, schoolId } = await requireCAAccess(parsed.classId);

  // Get active config
  const config = await prisma.cAConfig.findUnique({
    where: { schoolId_academicYear: { schoolId, academicYear: parsed.academicYear } },
  });
  if (!config) {
    throw new Error(
      `No CA configuration found for ${parsed.academicYear}. Ask your admin to set it up.`
    );
  }

  const { totalScore, grade, gradePoint } = await computeCA(
    parsed.classworkScore,
    parsed.examScore,
    config.classworkWeight,
    config.examWeight
  );

  const ca = await prisma.continuousAssessment.create({
    data: {
      classworkScore: parsed.classworkScore,
      schoolId,
      examScore:      parsed.examScore,
      totalScore,
      grade,
      gradePoint,
      remarks:     parsed.remarks ?? "",
      term:        parsed.term,
      academicYear: parsed.academicYear,
      studentId:   parsed.studentId,
      subjectId:   parsed.subjectId,
      classId:     parsed.classId,
      teacherId,
      configId:    config.id,
    },
  });

  revalidatePath("/list/ca");
  revalidatePath("/teacher");
  revalidateDashboard(schoolId);
  revalidateDocument(schoolId, "report-card", parsed.studentId);
  return ca;
}

export async function updateCA(data: CAInput) {
  if (!data.id) throw new Error("CA ID required for update.");
  const parsed = parseActionInput(caRecordUpdateSchema, data);
  const { userId: teacherId, schoolId } = await requireCAAccess(parsed.classId);

  const config = await prisma.cAConfig.findUnique({
    where: { schoolId_academicYear: { schoolId, academicYear: parsed.academicYear } },
  });
  if (!config) throw new Error(`No CA configuration found for ${parsed.academicYear}.`);

  const { totalScore, grade, gradePoint } = await computeCA(
    parsed.classworkScore,
    parsed.examScore,
    config.classworkWeight,
    config.examWeight
  );

  await prisma.continuousAssessment.update({
    where: { id: data.id, schoolId },
    data: {
      classworkScore: parsed.classworkScore,
      examScore:      parsed.examScore,
      totalScore,
      grade,
      gradePoint,
      remarks:  parsed.remarks ?? "",
      teacherId,
      configId: config.id,
    },
  });

  revalidatePath("/list/ca");
  revalidatePath("/teacher");
  revalidateDashboard(schoolId);
  revalidateDocument(schoolId, "report-card", parsed.studentId);
}

export async function deleteCA(id: number) {
  id = parseActionInput(positiveIntSchema, id);
  const ca = await prisma.continuousAssessment.findUnique({
    where: { id },
    select: { classId: true, studentId: true },
  });
  if (!ca) throw new Error("CA record not found.");
  const { schoolId } = await requireCAAccess(ca.classId);

  await prisma.continuousAssessment.delete({ where: { id, schoolId } });
  revalidatePath("/list/ca");
  revalidateDashboard(schoolId);
  revalidateDocument(schoolId, "report-card", ca.studentId);
}

// ═══════════════════════════════════════════════════════════════════════════════
// BULK UPSERT — used by the batch CA entry form
// ═══════════════════════════════════════════════════════════════════════════════

export type BulkCARow = {
  studentId:      string;
  classworkScore: number;
  examScore:      number;
  remarks?:       string;
};

export async function bulkUpsertCA(
  rows: BulkCARow[],
  subjectId:    number,
  classId:      number,
  term:          Term,
  academicYear: string
) {
  const parsed = parseActionInput(caBulkEntrySchema, {
    rows,
    subjectId,
    classId,
    term,
    academicYear,
  });
  rows = parsed.rows;
  subjectId = parsed.subjectId;
  classId = parsed.classId;
  term = parsed.term;
  academicYear = parsed.academicYear;
  const { userId: teacherId, schoolId } = await requireCAAccess(classId);

  const config = await prisma.cAConfig.findUnique({
    where: { schoolId_academicYear: { schoolId, academicYear } },
  });
  if (!config) {
    throw new Error(`No CA configuration found for ${academicYear}. Ask your admin to set it up.`);
  }

  const results = await Promise.all(
    rows.map(async (row) => {
      const { totalScore, grade, gradePoint } = await computeCA(
        row.classworkScore,
        row.examScore,
        config.classworkWeight,
        config.examWeight
      );

      return prisma.continuousAssessment.upsert({
        where: {
          schoolId_studentId_subjectId_classId_term_academicYear: {
            schoolId,
            studentId:    row.studentId,
            subjectId,
            classId,
            term,
            academicYear,
          },
        },
        create: {
          classworkScore: row.classworkScore,
          schoolId,
          examScore:      row.examScore,
          totalScore,
          grade,
          gradePoint,
          remarks:     row.remarks ?? "",
          term,
          academicYear,
          studentId:   row.studentId,
          subjectId,
          classId,
          teacherId,
          configId:    config.id,
        },
        update: {
          classworkScore: row.classworkScore,
          examScore:      row.examScore,
          totalScore,
          grade,
          gradePoint,
          remarks:  row.remarks ?? "",
          teacherId,
          configId: config.id,
        },
      });
    })
  );

  revalidatePath("/list/ca");
  revalidatePath("/teacher");
  revalidateDashboard(schoolId);
  for (const studentId of new Set(parsed.rows.map((row) => row.studentId))) {
    revalidateDocument(schoolId, "report-card", studentId);
  }
  return results;
}
