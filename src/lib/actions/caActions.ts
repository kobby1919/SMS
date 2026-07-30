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
  caBulkActivityScoreSchema,
  caActivitySchema,
  caBucketSchema,
  caConfigSchema,
  caRecordSchema,
  caRecordUpdateSchema,
} from "@/src/lib/validation/ca";
import { nonEmptyStringSchema, positiveIntSchema } from "@/src/lib/validation/common";
import type { Term } from "@/src/generated/prisma";
import {
  assertTeacherCanManageCAContext,
  createCAActivity,
  createCABucket,
  getSubjectCAProgress,
  logCAAudit,
  syncComputedCARecordsForActivity,
  upsertCAActivityScore,
} from "@/src/lib/services/ca-activity";
import { recordCAActivityScoreEvents } from "@/src/lib/services/parent-daily-summary";

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
      const progress = await getSubjectCAProgress({
        schoolId,
        studentId: row.studentId,
        classId,
        subjectId,
        term,
        academicYear,
      });
      const useActivityCA = progress.totalAllocatedMarks > 0;
      const classworkScore = useActivityCA ? progress.earnedMarks : row.classworkScore;
      const examScore = useActivityCA ? Math.min(row.examScore, config.examWeight) : row.examScore;
      let totalScore: number;
      let grade: string;
      let gradePoint: number;
      if (useActivityCA) {
        totalScore = Math.round((classworkScore + examScore) * 100) / 100;
        const gradeInfo = await getBECEGrade(totalScore);
        grade = gradeInfo.grade;
        gradePoint = gradeInfo.gradePoint;
      } else {
        const computed = await computeCA(
          classworkScore,
          examScore,
          config.classworkWeight,
          config.examWeight,
        );
        totalScore = computed.totalScore;
        grade = computed.grade;
        gradePoint = computed.gradePoint;
      }

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
          classworkScore,
          schoolId,
          examScore,
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
          classworkScore,
          examScore,
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

export async function createCABucketAction(data: {
  name: string;
  type: string;
  aggregationMode: string;
  allocationMarks: number;
  classId: number;
  subjectId: number;
  term: Term;
  academicYear: string;
  order?: number;
}) {
  const parsed = parseActionInput(caBucketSchema, data);
  const { userId, role, schoolId } = await requireRole(["admin", "teacher"]);

  await assertTeacherCanManageCAContext({
    userId,
    role,
    schoolId,
    classId: parsed.classId,
    subjectId: parsed.subjectId,
  });

  const bucket = await createCABucket({
    schoolId,
    classId: parsed.classId,
    subjectId: parsed.subjectId,
    term: parsed.term,
    academicYear: parsed.academicYear,
    name: parsed.name,
    type: parsed.type,
    aggregationMode: parsed.aggregationMode,
    allocationMarks: parsed.allocationMarks,
    order: parsed.order,
    createdBy: role === "teacher" ? userId : undefined,
  });

  await logCAAudit({
    schoolId,
    actorId: role === "teacher" ? userId : undefined,
    action: "CA_BUCKET_CREATED",
    entityType: "CABucket",
    entityId: bucket.id,
    message: `${parsed.name} bucket created with ${parsed.allocationMarks} CA marks.`,
    metadata: parsed,
  });

  revalidatePath("/list/ca");
  revalidatePath("/teacher");
  revalidateDashboard(schoolId);
  return { id: bucket.id };
}

export async function createCAActivityAction(data: {
  bucketId: number;
  title?: string;
  type?: string;
  rawMaxScore: number;
  allocationMarks?: number | null;
  activityDate?: Date;
}) {
  const parsed = parseActionInput(caActivitySchema, data);
  const { userId, schoolId } = await requireRole(["teacher"]);

  const bucket = await prisma.cABucket.findFirst({
    where: { id: parsed.bucketId, schoolId },
    select: { classId: true, subjectId: true },
  });
  if (!bucket) throw new Error("CA bucket not found.");

  await assertTeacherCanManageCAContext({
    userId,
    role: "teacher",
    schoolId,
    classId: bucket.classId,
    subjectId: bucket.subjectId,
  });

  const activity = await createCAActivity({
    schoolId,
    bucketId: parsed.bucketId,
    title: parsed.title,
    type: parsed.type,
    rawMaxScore: parsed.rawMaxScore,
    allocationMarks: parsed.allocationMarks,
    activityDate: parsed.activityDate,
    teacherId: userId,
  });

  await logCAAudit({
    schoolId,
    actorId: userId,
    action: "CA_ACTIVITY_CREATED",
    entityType: "CAActivity",
    entityId: activity.id,
    message: `${activity.title} created for CA score entry.`,
    metadata: {
      bucketId: parsed.bucketId,
      rawMaxScore: parsed.rawMaxScore,
      allocationMarks: parsed.allocationMarks,
    },
  });

  revalidatePath("/list/ca");
  revalidatePath("/teacher");
  revalidateDashboard(schoolId);
  return { id: activity.id };
}

export async function bulkUpsertCAActivityScores(data: {
  activityId: number;
  rows: { studentId: string; rawScore: number; comment?: string }[];
}) {
  const parsed = parseActionInput(caBulkActivityScoreSchema, data);
  const { userId, schoolId } = await requireRole(["teacher"]);

  const activity = await prisma.cAActivity.findFirst({
    where: { id: parsed.activityId, schoolId },
    select: { classId: true, subjectId: true },
  });
  if (!activity) throw new Error("CA activity not found.");

  await assertTeacherCanManageCAContext({
    userId,
    role: "teacher",
    schoolId,
    classId: activity.classId,
    subjectId: activity.subjectId,
  });

  const scores = await Promise.all(
    parsed.rows.map((row) =>
      upsertCAActivityScore({
        schoolId,
        activityId: parsed.activityId,
        studentId: row.studentId,
        rawScore: row.rawScore,
        recordedBy: userId,
        comment: row.comment,
      }),
    ),
  );

  await syncComputedCARecordsForActivity({
    schoolId,
    activityId: parsed.activityId,
    studentIds: parsed.rows.map((row) => row.studentId),
  });

  const events = await recordCAActivityScoreEvents({
    schoolId,
    activityId: parsed.activityId,
    scoreIds: scores.map((score) => score.id),
  });

  await logCAAudit({
    schoolId,
    actorId: userId,
    action: "CA_ACTIVITY_SCORES_UPSERTED",
    entityType: "CAActivity",
    entityId: parsed.activityId,
    message: `${scores.length} student score${scores.length === 1 ? "" : "s"} saved for a CA activity.`,
    metadata: {
      scoreIds: scores.map((score) => score.id),
      studentIds: parsed.rows.map((row) => row.studentId),
    },
  });

  revalidatePath("/list/ca");
  revalidatePath("/parent");
  revalidatePath("/teacher");
  revalidateDashboard(schoolId);
  for (const studentId of new Set(parsed.rows.map((row) => row.studentId))) {
    revalidateDocument(schoolId, "report-card", studentId);
  }
  return { count: scores.length, eventCount: events.length };
}

export async function lockCABucketAction(bucketId: number) {
  bucketId = parseActionInput(positiveIntSchema, bucketId);
  const { userId, schoolId } = await requireRole(["admin"]);

  const bucket = await prisma.cABucket.update({
    where: { id: bucketId, schoolId },
    data: { isLocked: true },
  });

  await logCAAudit({
    schoolId,
    actorId: userId,
    action: "CA_BUCKET_LOCKED",
    entityType: "CABucket",
    entityId: bucket.id,
    message: `${bucket.name} bucket was locked.`,
  });

  revalidatePath("/list/ca");
  revalidateDashboard(schoolId);
  return { id: bucket.id };
}

export async function lockCAActivityAction(activityId: number) {
  activityId = parseActionInput(positiveIntSchema, activityId);
  const { userId, schoolId } = await requireRole(["admin"]);

  const activity = await prisma.cAActivity.update({
    where: { id: activityId, schoolId },
    data: { isLocked: true },
  });

  await logCAAudit({
    schoolId,
    actorId: userId,
    action: "CA_ACTIVITY_LOCKED",
    entityType: "CAActivity",
    entityId: activity.id,
    message: `${activity.title} activity was locked.`,
  });

  revalidatePath("/list/ca");
  revalidateDashboard(schoolId);
  return { id: activity.id };
}
