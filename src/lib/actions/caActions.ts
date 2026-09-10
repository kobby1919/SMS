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
  examEntryWindowSchema,
  reportPublicationSchema,
} from "@/src/lib/validation/ca";
import { nonEmptyStringSchema, positiveIntSchema } from "@/src/lib/validation/common";
import type { Prisma, Term } from "@/src/generated/prisma";
import {
  assertTeacherCanManageCAContext,
  calculateAllocatedMark,
  createCAActivity,
  createCABucket,
  getSubjectCAProgress,
  logCAAudit,
  syncComputedCARecordsForActivity,
  upsertCAActivityScore,
} from "@/src/lib/services/ca-activity";
import {
  recordCAActivityGivenEvents,
  recordCAActivityScoreEvents,
} from "@/src/lib/services/parent-daily-summary";
import { syncCAActivityScorePublishingObligation } from "@/src/lib/services/teacher-ca-obligations";
import { getActiveAcademicPeriod } from "@/src/lib/services/academic-period";
import { listClassSubjectsFromTimetable } from "@/src/lib/services/timetable";
import { getClassReportReadiness } from "@/src/lib/services/report-card-readiness";
import { getTeacherScope } from "@/src/lib/services/teacher-scope";
import { recordApprovedCorrectionParentEvent } from "@/src/lib/services/correction-parent-events";

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
async function requireCAAccess(classId: number): Promise<{ userId: string; role: string; schoolId: string }> {
  const { userId, role, schoolId } = await requireRole(["admin", "teacher"]);

  if (role === "admin") return { userId, role, schoolId };

  if (role === "teacher") {
    const cls = await prisma.class.findFirst({
      where: { id: classId, schoolId },
      select: { supervisorId: true },
    });
    if (cls?.supervisorId !== userId) {
      throw new Error("Only the class supervisor can manage CA records for this class.");
    }
    return { userId, role, schoolId };
  }

  throw new Error("Unauthorized");
}

async function assertTeacherUsesActivePeriod({
  schoolId,
  role,
  term,
  academicYear,
}: {
  schoolId: string;
  role: string;
  term: Term;
  academicYear: string;
}) {
  if (role !== "teacher") return;

  const activePeriod = await getActiveAcademicPeriod(schoolId);
  if (term !== activePeriod.currentTerm || academicYear !== activePeriod.academicYear) {
    throw new Error(
      `Teachers can only work in the active academic period: ${activePeriod.academicYear} ${activePeriod.currentTerm.replace("_", " ")}. Ask an admin to change the school period if needed.`,
    );
  }
}

async function assertExamEntryOpen(input: {
  schoolId: string;
  classId: number;
  term: Term;
  academicYear: string;
}) {
  const window = await prisma.examEntryWindow.findUnique({
    where: {
      schoolId_classId_term_academicYear: {
        schoolId: input.schoolId,
        classId: input.classId,
        term: input.term,
        academicYear: input.academicYear,
      },
    },
    select: { status: true },
  });

  if (window?.status !== "OPEN") {
    throw new Error("Exam entry is locked for this class period. Ask an admin to open exam entry before saving exam scores.");
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// CA CONFIG
// ═══════════════════════════════════════════════════════════════════════════════

export type CAConfigInput = {
  academicYear:    string;
  currentTerm?:    Term;
  isActive?:       boolean;
  classworkWeight: number;
  examWeight:      number;
};

export async function upsertCAConfig(data: CAConfigInput) {
  const { schoolId } = await requireRole(["admin"]);
  const parsed = parseActionInput(caConfigSchema, data);

  const config = await prisma.$transaction(async (tx) => {
    if (parsed.isActive) {
      await tx.cAConfig.updateMany({
        where: { schoolId, academicYear: { not: parsed.academicYear } },
        data: { isActive: false },
      });
    }

    return tx.cAConfig.upsert({
      where: { schoolId_academicYear: { schoolId, academicYear: parsed.academicYear } },
      create: {
        schoolId,
        academicYear:    parsed.academicYear,
        currentTerm:     parsed.currentTerm,
        isActive:        parsed.isActive,
        classworkWeight: parsed.classworkWeight,
        examWeight:      parsed.examWeight,
      },
      update: {
        currentTerm:     parsed.currentTerm,
        isActive:        parsed.isActive,
        classworkWeight: parsed.classworkWeight,
        examWeight:      parsed.examWeight,
      },
    });
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
  const { userId: teacherId, role, schoolId } = await requireCAAccess(parsed.classId);
  await assertTeacherUsesActivePeriod({ schoolId, role, term: parsed.term, academicYear: parsed.academicYear });

  // Get active config
  const config = await prisma.cAConfig.findUnique({
    where: { schoolId_academicYear: { schoolId, academicYear: parsed.academicYear } },
  });
  if (!config) {
    throw new Error(
      `No CA configuration found for ${parsed.academicYear}. Ask your admin to set it up.`
    );
  }
  if (parsed.examScore > 0) {
    await assertExamEntryOpen({
      schoolId,
      classId: parsed.classId,
      term: parsed.term,
      academicYear: parsed.academicYear,
    });
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
  const { userId: teacherId, role, schoolId } = await requireCAAccess(parsed.classId);
  await assertTeacherUsesActivePeriod({ schoolId, role, term: parsed.term, academicYear: parsed.academicYear });

  const config = await prisma.cAConfig.findUnique({
    where: { schoolId_academicYear: { schoolId, academicYear: parsed.academicYear } },
  });
  if (!config) throw new Error(`No CA configuration found for ${parsed.academicYear}.`);
  if (parsed.examScore > 0) {
    await assertExamEntryOpen({
      schoolId,
      classId: parsed.classId,
      term: parsed.term,
      academicYear: parsed.academicYear,
    });
  }

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

function readNumberPayload(value: Prisma.JsonValue | null | undefined, key: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = (value as Record<string, unknown>)[key];
  return typeof raw === "number" && Number.isFinite(raw) ? raw : null;
}

function formatAcademicMark(value: number, maximum?: number | null) {
  const rounded = Math.round(value * 100) / 100;
  return maximum ? `${rounded}/${maximum}` : String(rounded);
}

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
  const { userId: teacherId, role, schoolId } = await requireCAAccess(classId);
  await assertTeacherUsesActivePeriod({ schoolId, role, term, academicYear });

  const config = await prisma.cAConfig.findUnique({
    where: { schoolId_academicYear: { schoolId, academicYear } },
  });
  if (!config) {
    throw new Error(`No CA configuration found for ${academicYear}. Ask your admin to set it up.`);
  }
  if (rows.some((row) => row.examScore > 0)) {
    await assertExamEntryOpen({ schoolId, classId, term, academicYear });
  }

  const submittedStudentIds = rows.map((row) => row.studentId);
  const existingExamRecords = await prisma.continuousAssessment.findMany({
    where: {
      schoolId,
      classId,
      subjectId,
      term,
      academicYear,
      studentId: { in: submittedStudentIds },
      examScore: { gt: 0 },
    },
    select: {
      studentId: true,
      examScore: true,
      student: { select: { name: true, surname: true } },
    },
  });
  const existingExamByStudentId = new Map(existingExamRecords.map((record) => [record.studentId, record]));
  const attemptedOverwrite = rows.find((row) => {
    const existing = existingExamByStudentId.get(row.studentId);
    return existing && Math.round(existing.examScore * 100) / 100 !== Math.round(row.examScore * 100) / 100;
  });
  if (attemptedOverwrite) {
    const existing = existingExamByStudentId.get(attemptedOverwrite.studentId);
    throw new Error(
      existing
        ? `${existing.student.name} ${existing.student.surname} already has a saved exam score. Use the correction request workflow for changes.`
        : "Saved exam scores can only be changed through the correction request workflow.",
    );
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
      const classworkScore = progress.earnedMarks;
      const examScore = Math.min(row.examScore, config.examWeight);
      const totalScore = Math.round((classworkScore + examScore) * 100) / 100;
      const { grade, gradePoint } = await getBECEGrade(totalScore);

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
  await assertTeacherUsesActivePeriod({
    schoolId,
    role,
    term: parsed.term,
    academicYear: parsed.academicYear,
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
    select: { classId: true, subjectId: true, term: true, academicYear: true },
  });
  if (!bucket) throw new Error("CA bucket not found.");

  await assertTeacherCanManageCAContext({
    userId,
    role: "teacher",
    schoolId,
    classId: bucket.classId,
    subjectId: bucket.subjectId,
  });
  await assertTeacherUsesActivePeriod({
    schoolId,
    role: "teacher",
    term: bucket.term,
    academicYear: bucket.academicYear,
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

  await recordCAActivityGivenEvents({
    schoolId,
    activityId: activity.id,
  });
  await syncCAActivityScorePublishingObligation({
    schoolId,
    activityId: activity.id,
  });

  revalidatePath("/list/ca");
  revalidatePath("/list/ca", "page");
  revalidatePath("/parent");
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
    select: {
      classId: true,
      subjectId: true,
      rawMaxScore: true,
      isLocked: true,
      bucket: { select: { term: true, academicYear: true } },
      class: {
        select: {
          students: { select: { id: true } },
          _count: { select: { students: true } },
        },
      },
    },
  });
  if (!activity) throw new Error("CA activity not found.");
  if (activity.isLocked) {
    throw new Error("This CA activity is locked. Score changes require an admin correction process.");
  }

  await assertTeacherCanManageCAContext({
    userId,
    role: "teacher",
    schoolId,
    classId: activity.classId,
    subjectId: activity.subjectId,
  });
  await assertTeacherUsesActivePeriod({
    schoolId,
    role: "teacher",
    term: activity.bucket.term,
    academicYear: activity.bucket.academicYear,
  });

  const studentIds = parsed.rows.map((row) => row.studentId);
  const uniqueStudentIds = new Set(studentIds);
  if (uniqueStudentIds.size !== studentIds.length) {
    throw new Error("Each student may appear only once when publishing CA scores.");
  }
  if (uniqueStudentIds.size !== activity.class._count.students) {
    throw new Error(
      `Publish scores for all ${activity.class._count.students} students before locking this CA activity.`,
    );
  }
  const rosterStudentIds = new Set(activity.class.students.map((student) => student.id));
  const invalidStudentId = studentIds.find((studentId) => !rosterStudentIds.has(studentId));
  if (invalidStudentId) {
    throw new Error("One or more students do not belong to this CA activity class.");
  }
  const rawMaxScore = Number(activity.rawMaxScore);
  const invalidScore = parsed.rows.find((row) => row.rawScore > rawMaxScore);
  if (invalidScore) {
    throw new Error(`Raw score cannot exceed the activity maximum score of ${rawMaxScore}.`);
  }

  const writeResults = await Promise.all(
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
  const changedScores = writeResults.filter((result) => result.changed).map((result) => result.score);
  const allScores = writeResults.map((result) => result.score);

  await syncComputedCARecordsForActivity({
    schoolId,
    activityId: parsed.activityId,
    studentIds: parsed.rows.map((row) => row.studentId),
  });

  const events = changedScores.length > 0
    ? await recordCAActivityScoreEvents({
        schoolId,
        activityId: parsed.activityId,
        scoreIds: changedScores.map((score) => score.id),
      })
    : [];

  if (changedScores.length > 0) {
    await prisma.cAActivity.update({
      where: { id: parsed.activityId, schoolId },
      data: { isLocked: true },
    });
  }
  await syncCAActivityScorePublishingObligation({
    schoolId,
    activityId: parsed.activityId,
  });

  await logCAAudit({
    schoolId,
    actorId: userId,
    action: changedScores.length > 0 ? "CA_ACTIVITY_SCORES_SUBMITTED_AND_LOCKED" : "CA_ACTIVITY_SCORES_UNCHANGED",
    entityType: "CAActivity",
    entityId: parsed.activityId,
    message: changedScores.length > 0
      ? `${allScores.length} student score${allScores.length === 1 ? "" : "s"} submitted and the CA activity was locked.`
      : "No score changes detected for this CA activity.",
    metadata: {
      scoreIds: allScores.map((score) => score.id),
      changedScoreIds: changedScores.map((score) => score.id),
      studentIds: parsed.rows.map((row) => row.studentId),
    },
  });

  revalidatePath("/list/ca");
  revalidatePath("/list/ca", "page");
  revalidatePath("/parent");
  revalidatePath("/teacher");
  revalidateDashboard(schoolId);
  for (const studentId of new Set(parsed.rows.map((row) => row.studentId))) {
    revalidateDocument(schoolId, "report-card", studentId);
  }
  return { count: allScores.length, changedCount: changedScores.length, eventCount: events.length };
}

export async function requestCAActivityScoreCorrection(data: {
  scoreId: number;
  newRawScore: number;
  reason: string;
}) {
  const scoreId = parseActionInput(positiveIntSchema, data.scoreId);
  const newRawScore = Number(data.newRawScore);
  const reason = parseActionInput(nonEmptyStringSchema, data.reason);
  if (!Number.isFinite(newRawScore) || newRawScore < 0) {
    throw new Error("Enter a valid corrected CA score.");
  }

  const { userId, schoolId } = await requireRole(["teacher"]);
  const score = await prisma.cAActivityScore.findFirst({
    where: { id: scoreId, schoolId },
    include: {
      student: { select: { id: true, name: true, surname: true } },
      activity: {
        include: {
          bucket: { select: { name: true, allocationMarks: true, aggregationMode: true, term: true, academicYear: true } },
          class: { select: { id: true, name: true } },
          subject: { select: { id: true, name: true } },
        },
      },
    },
  });
  if (!score) throw new Error("CA activity score not found.");

  await assertTeacherCanManageCAContext({
    userId,
    role: "teacher",
    schoolId,
    classId: score.activity.classId,
    subjectId: score.activity.subjectId,
  });

  const rawMaxScore = Number(score.activity.rawMaxScore);
  if (newRawScore > rawMaxScore) {
    throw new Error(`Corrected score cannot exceed ${rawMaxScore}.`);
  }
  if (Math.round(Number(score.rawScore) * 100) / 100 === Math.round(newRawScore * 100) / 100) {
    throw new Error("Choose a different CA score before requesting correction.");
  }

  const sourceKey = `ca-activity-score:${score.id}:raw-score-correction`;
  const existingRequest = await prisma.teacherCorrectionRequest.findUnique({
    where: {
      schoolId_teacherId_sourceKey_fieldName: {
        schoolId,
        teacherId: userId,
        sourceKey,
        fieldName: "rawScore",
      },
    },
    select: { status: true },
  });
  if (existingRequest) {
    return {
      message:
        existingRequest.status === "PENDING"
          ? "A CA score correction request is already waiting for admin review."
          : "This CA score has already gone through a correction request. Please visit the admin office if it still needs another change.",
    };
  }

  await prisma.$transaction(async (tx) => {
    const request = await tx.teacherCorrectionRequest.create({
      data: {
        schoolId,
        teacherId: userId,
        sourceModel: "CAActivityScore",
        sourceId: String(score.id),
        sourceKey,
        fieldName: "rawScore",
        reason,
        oldValue: {
          rawScore: Number(score.rawScore),
          normalizedContribution: Number(score.normalizedContribution),
          rawMaxScore,
          studentId: score.studentId,
          activityId: score.activityId,
        },
        newValue: {
          rawScore: newRawScore,
          rawMaxScore,
          studentId: score.studentId,
          activityId: score.activityId,
        },
      },
    });

    await tx.teacherAccountabilityAuditLog.create({
      data: {
        schoolId,
        teacherId: userId,
        actorId: userId,
        actorRole: "teacher",
        action: "CORRECTION_REQUESTED",
        sourceModel: "CAActivityScore",
        sourceId: String(score.id),
        before: {
          rawScore: Number(score.rawScore),
          student: `${score.student.name} ${score.student.surname}`,
        },
        after: {
          correctionRequestId: request.id,
          requestedRawScore: newRawScore,
        },
        message: `CA score correction requested for ${score.student.name} ${score.student.surname} in ${score.activity.subject.name}.`,
      },
    });
  });

  revalidatePath("/list/ca");
  revalidatePath("/teacher/accountability");
  revalidatePath("/admin/accountability");
  return { message: "CA score correction request sent to admin. The saved score has not changed yet." };
}

export async function requestExamScoreCorrection(data: {
  studentId: string;
  subjectId: number;
  classId: number;
  term: Term;
  academicYear: string;
  newExamScore: number;
  reason: string;
}) {
  const parsed = parseActionInput(caRecordSchema.extend({
    newExamScore: caRecordSchema.shape.examScore,
    reason: nonEmptyStringSchema,
  }).pick({
    studentId: true,
    subjectId: true,
    classId: true,
    term: true,
    academicYear: true,
    newExamScore: true,
    reason: true,
  }), data);
  const { userId, schoolId } = await requireRole(["teacher"]);

  await assertTeacherCanManageCAContext({
    userId,
    role: "teacher",
    schoolId,
    classId: parsed.classId,
    subjectId: parsed.subjectId,
  });
  await assertTeacherUsesActivePeriod({
    schoolId,
    role: "teacher",
    term: parsed.term,
    academicYear: parsed.academicYear,
  });

  const config = await prisma.cAConfig.findUnique({
    where: { schoolId_academicYear: { schoolId, academicYear: parsed.academicYear } },
  });
  if (!config) throw new Error(`No CA configuration found for ${parsed.academicYear}.`);
  if (parsed.newExamScore > config.examWeight) {
    throw new Error(`Corrected exam score cannot exceed ${config.examWeight}.`);
  }

  const record = await prisma.continuousAssessment.findUnique({
    where: {
      schoolId_studentId_subjectId_classId_term_academicYear: {
        schoolId,
        studentId: parsed.studentId,
        subjectId: parsed.subjectId,
        classId: parsed.classId,
        term: parsed.term,
        academicYear: parsed.academicYear,
      },
    },
    include: {
      student: { select: { name: true, surname: true } },
      subject: { select: { name: true } },
      class: { select: { name: true } },
    },
  });
  if (!record || record.examScore <= 0) {
    throw new Error("No saved exam score exists yet. Use normal exam entry for the first save.");
  }
  if (Math.round(record.examScore * 100) / 100 === Math.round(parsed.newExamScore * 100) / 100) {
    throw new Error("Choose a different exam score before requesting correction.");
  }

  const sourceKey = `continuous-assessment:${record.id}:exam-score-correction`;
  const existingRequest = await prisma.teacherCorrectionRequest.findUnique({
    where: {
      schoolId_teacherId_sourceKey_fieldName: {
        schoolId,
        teacherId: userId,
        sourceKey,
        fieldName: "examScore",
      },
    },
    select: { status: true },
  });
  if (existingRequest) {
    return {
      message:
        existingRequest.status === "PENDING"
          ? "An exam score correction request is already waiting for admin review."
          : "This exam score has already gone through a correction request. Please visit the admin office if it still needs another change.",
    };
  }

  await prisma.$transaction(async (tx) => {
    const request = await tx.teacherCorrectionRequest.create({
      data: {
        schoolId,
        teacherId: userId,
        sourceModel: "ContinuousAssessment",
        sourceId: String(record.id),
        sourceKey,
        fieldName: "examScore",
        reason: parsed.reason,
        oldValue: {
          examScore: record.examScore,
          totalScore: record.totalScore,
          grade: record.grade,
          studentId: record.studentId,
        },
        newValue: {
          examScore: parsed.newExamScore,
          studentId: record.studentId,
          subjectId: record.subjectId,
          classId: record.classId,
          term: record.term,
          academicYear: record.academicYear,
        },
      },
    });

    await tx.teacherAccountabilityAuditLog.create({
      data: {
        schoolId,
        teacherId: userId,
        actorId: userId,
        actorRole: "teacher",
        action: "CORRECTION_REQUESTED",
        sourceModel: "ContinuousAssessment",
        sourceId: String(record.id),
        before: {
          examScore: record.examScore,
          totalScore: record.totalScore,
          student: `${record.student.name} ${record.student.surname}`,
        },
        after: {
          correctionRequestId: request.id,
          requestedExamScore: parsed.newExamScore,
        },
        message: `Exam score correction requested for ${record.student.name} ${record.student.surname} in ${record.subject.name}.`,
      },
    });
  });

  revalidatePath("/list/ca");
  revalidatePath("/list/report-cards");
  revalidatePath("/teacher/accountability");
  revalidatePath("/admin/accountability");
  return { message: "Exam score correction request sent to admin. The saved exam score has not changed yet." };
}

export async function reviewAcademicCorrectionRequest(data: {
  requestId: string;
  action: "APPROVE" | "REJECT";
  note?: string | null;
}) {
  const { userId, schoolId } = await requireRole(["admin"]);
  const requestId = parseActionInput(nonEmptyStringSchema, data.requestId);
  const reviewNote = data.note?.trim() || null;
  if (data.action === "REJECT" && !reviewNote) {
    throw new Error("Add a short note before rejecting an academic correction request.");
  }

  const request = await prisma.teacherCorrectionRequest.findFirst({
    where: {
      id: requestId,
      schoolId,
      status: "PENDING",
      OR: [
        { sourceModel: "CAActivityScore", fieldName: "rawScore" },
        { sourceModel: "ContinuousAssessment", fieldName: "examScore" },
      ],
    },
    include: {
      teacher: { select: { id: true, name: true, surname: true } },
    },
  });
  if (!request) throw new Error("Pending academic correction request not found.");

  const now = new Date();
  if (request.sourceModel === "CAActivityScore") {
    const newRawScore = readNumberPayload(request.newValue, "rawScore");
    if (newRawScore === null) throw new Error("Correction request is missing a valid CA score.");
    const score = await prisma.cAActivityScore.findFirst({
      where: { id: Number.parseInt(request.sourceId, 10), schoolId },
      include: {
        student: { select: { id: true, name: true, surname: true } },
        activity: {
          include: {
            bucket: { select: { name: true, allocationMarks: true, aggregationMode: true, term: true, academicYear: true } },
            class: { select: { name: true } },
            subject: { select: { name: true } },
            teacher: { select: { name: true, surname: true } },
          },
        },
      },
    });
    if (!score) throw new Error("CA score for this correction request no longer exists.");

    const allocation =
      score.activity.bucket.aggregationMode === "SUM_ACTIVITIES"
        ? Number(score.activity.allocationMarks ?? 0)
        : Number(score.activity.bucket.allocationMarks);
    const normalizedContribution = calculateAllocatedMark(
      newRawScore,
      Number(score.activity.rawMaxScore),
      allocation,
    );

    await prisma.$transaction(async (tx) => {
      if (data.action === "APPROVE") {
        await tx.cAActivityScore.update({
          where: { id: score.id },
          data: {
            rawScore: newRawScore,
            normalizedContribution,
          },
        });
      }
      await tx.teacherCorrectionRequest.update({
        where: { id: request.id },
        data: {
          status: data.action === "APPROVE" ? "APPROVED" : "REJECTED",
          reviewedBy: userId,
          reviewedAt: now,
          reviewNote,
        },
      });
      await tx.teacherAccountabilityAuditLog.create({
        data: {
          schoolId,
          teacherId: request.teacherId,
          actorId: userId,
          actorRole: "admin",
          action: data.action === "APPROVE" ? "CORRECTION_APPROVED" : "CORRECTION_REJECTED",
          sourceModel: "CAActivityScore",
          sourceId: String(score.id),
          before: { rawScore: Number(score.rawScore), normalizedContribution: Number(score.normalizedContribution) },
          after: { requestedRawScore: newRawScore, requestStatus: data.action === "APPROVE" ? "APPROVED" : "REJECTED", reviewNote },
          message: data.action === "APPROVE"
            ? `CA score correction approved for ${score.student.name} ${score.student.surname}.`
            : `CA score correction rejected for ${score.student.name} ${score.student.surname}.`,
        },
      });
    });

    if (data.action === "APPROVE") {
      await syncComputedCARecordsForActivity({
        schoolId,
        activityId: score.activityId,
        studentIds: [score.studentId],
      });
      const teacherName = `${score.activity.teacher.name} ${score.activity.teacher.surname}`.trim();
      await recordApprovedCorrectionParentEvent({
        schoolId,
        studentId: score.studentId,
        teacherId: request.teacherId,
        type: "ASSESSMENT",
        title: `${score.activity.subject.name} CA score correction approved`,
        itemLabel: `${score.activity.subject.name}: ${score.activity.title}`,
        previousLabel: formatAcademicMark(Number(score.rawScore), Number(score.activity.rawMaxScore)),
        correctedLabel: formatAcademicMark(newRawScore, Number(score.activity.rawMaxScore)),
        reason: request.reason,
        reviewNote,
        href: `/list/report-cards/${score.studentId}?caScoreId=${score.id}`,
        sourceModel: "CAActivityScore",
        sourceId: String(score.id),
        sourceKey: `ca-activity-score:${score.id}`,
        occurredAt: now,
        payload: {
          studentName: `${score.student.name} ${score.student.surname}`,
          subjectName: score.activity.subject.name,
          teacherName,
          previousRawScore: Number(score.rawScore),
          rawScore: newRawScore,
          rawMaxScore: Number(score.activity.rawMaxScore),
          correctionApproved: true,
        },
      });
    }
  }

  if (request.sourceModel === "ContinuousAssessment") {
    const newExamScore = readNumberPayload(request.newValue, "examScore");
    if (newExamScore === null) throw new Error("Correction request is missing a valid exam score.");
    const record = await prisma.continuousAssessment.findFirst({
      where: { id: Number.parseInt(request.sourceId, 10), schoolId },
      include: {
        student: { select: { id: true, name: true, surname: true } },
        subject: { select: { name: true } },
        class: { select: { name: true } },
        teacher: { select: { name: true, surname: true } },
      },
    });
    if (!record) throw new Error("Exam score record for this correction request no longer exists.");
    const totalScore = Math.round((record.classworkScore + newExamScore) * 100) / 100;
    const { grade, gradePoint } = await getBECEGrade(totalScore);

    await prisma.$transaction(async (tx) => {
      if (data.action === "APPROVE") {
        await tx.continuousAssessment.update({
          where: { id: record.id },
          data: {
            examScore: newExamScore,
            totalScore,
            grade,
            gradePoint,
          },
        });
      }
      await tx.teacherCorrectionRequest.update({
        where: { id: request.id },
        data: {
          status: data.action === "APPROVE" ? "APPROVED" : "REJECTED",
          reviewedBy: userId,
          reviewedAt: now,
          reviewNote,
        },
      });
      await tx.teacherAccountabilityAuditLog.create({
        data: {
          schoolId,
          teacherId: request.teacherId,
          actorId: userId,
          actorRole: "admin",
          action: data.action === "APPROVE" ? "CORRECTION_APPROVED" : "CORRECTION_REJECTED",
          sourceModel: "ContinuousAssessment",
          sourceId: String(record.id),
          before: { examScore: record.examScore, totalScore: record.totalScore, grade: record.grade },
          after: { requestedExamScore: newExamScore, totalScore, grade, requestStatus: data.action === "APPROVE" ? "APPROVED" : "REJECTED", reviewNote },
          message: data.action === "APPROVE"
            ? `Exam score correction approved for ${record.student.name} ${record.student.surname}.`
            : `Exam score correction rejected for ${record.student.name} ${record.student.surname}.`,
        },
      });
    });

    if (data.action === "APPROVE") {
      const teacherName = `${record.teacher.name} ${record.teacher.surname}`.trim();
      await recordApprovedCorrectionParentEvent({
        schoolId,
        studentId: record.studentId,
        teacherId: request.teacherId,
        type: "ASSESSMENT",
        title: `${record.subject.name} exam score correction approved`,
        itemLabel: `${record.subject.name} exam score`,
        previousLabel: formatAcademicMark(record.examScore, null),
        correctedLabel: formatAcademicMark(newExamScore, null),
        reason: request.reason,
        reviewNote,
        href: `/list/report-cards/${record.studentId}`,
        sourceModel: "ContinuousAssessment",
        sourceId: String(record.id),
        sourceKey: `continuous-assessment:${record.id}`,
        occurredAt: now,
        payload: {
          studentName: `${record.student.name} ${record.student.surname}`,
          subjectName: record.subject.name,
          teacherName,
          previousExamScore: record.examScore,
          examScore: newExamScore,
          totalScore,
          grade,
          correctionApproved: true,
        },
      });
    }
  }

  revalidatePath("/list/ca");
  revalidatePath("/list/report-cards");
  revalidatePath("/teacher/accountability");
  revalidatePath("/admin/accountability");
  revalidatePath("/parent");
  revalidatePath("/parent/updates");
  revalidateDashboard(schoolId);

  return {
    message: data.action === "APPROVE"
      ? "Academic correction approved and applied."
      : "Academic correction rejected. The saved academic record was not changed.",
  };
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

export async function publishClassReportCardsAction(data: {
  classId: number;
  term: Term;
  academicYear: string;
  notes?: string;
}) {
  const parsed = parseActionInput(reportPublicationSchema, data);
  const { userId, schoolId } = await requireRole(["admin"]);

  const cls = await prisma.class.findFirst({
    where: { id: parsed.classId, schoolId },
    select: { id: true, name: true },
  });
  if (!cls) throw new Error("Class not found.");

  const examWindow = await prisma.examEntryWindow.findUnique({
    where: {
      schoolId_classId_term_academicYear: {
        schoolId,
        classId: parsed.classId,
        term: parsed.term,
        academicYear: parsed.academicYear,
      },
    },
    select: { status: true },
  });
  if (!examWindow || examWindow.status === "LOCKED") {
    throw new Error("Open exam entry before publishing report cards for this class period.");
  }

  const readiness = await getClassReportReadiness({
    schoolId,
    classId: parsed.classId,
    term: parsed.term,
    academicYear: parsed.academicYear,
  });
  if (readiness.subjectCount === 0) {
    throw new Error("This class has no timetable subjects. Add subjects to the timetable before publishing reports.");
  }
  if (readiness.studentCount === 0) {
    throw new Error("This class has no students to publish report cards for.");
  }
  if (!readiness.isReady) {
    throw new Error(
      `Cannot publish yet. ${readiness.missingCount} student-subject report entr${readiness.missingCount === 1 ? "y is" : "ies are"} still incomplete.`,
    );
  }

  const currentPublication = await prisma.reportCardPublication.findUnique({
    where: {
      schoolId_classId_term_academicYear: {
        schoolId,
        classId: parsed.classId,
        term: parsed.term,
        academicYear: parsed.academicYear,
      },
    },
    select: { status: true },
  });
  if (currentPublication?.status !== "SUBMITTED" && currentPublication?.status !== "PUBLISHED") {
    throw new Error("The class teacher must submit this class report set for admin review before publishing.");
  }

  const publication = await prisma.reportCardPublication.upsert({
    where: {
      schoolId_classId_term_academicYear: {
        schoolId,
        classId: parsed.classId,
        term: parsed.term,
        academicYear: parsed.academicYear,
      },
    },
    create: {
      schoolId,
      classId: parsed.classId,
      term: parsed.term,
      academicYear: parsed.academicYear,
      status: "PUBLISHED",
      notes: parsed.notes,
      reviewedAt: new Date(),
      reviewedBy: userId,
      reviewNote: parsed.notes,
      publishedAt: new Date(),
      publishedBy: userId,
    },
    update: {
      status: "PUBLISHED",
      notes: parsed.notes,
      reviewedAt: new Date(),
      reviewedBy: userId,
      reviewNote: parsed.notes,
      publishedAt: new Date(),
      publishedBy: userId,
      unpublishedAt: null,
      unpublishedBy: null,
    },
  });

  await logCAAudit({
    schoolId,
    actorId: userId,
    action: "REPORT_CARDS_PUBLISHED",
    entityType: "ReportCardPublication",
    entityId: publication.id,
    message: `${cls.name} report cards were published for ${parsed.academicYear} ${parsed.term.replace("_", " ")}.`,
    metadata: {
      classId: parsed.classId,
      term: parsed.term,
      academicYear: parsed.academicYear,
      studentCount: readiness.studentCount,
      subjectCount: readiness.subjectCount,
      notes: parsed.notes,
    },
  });

  revalidatePath("/list/report-cards");
  revalidatePath("/parent");
  revalidateDashboard(schoolId);
  revalidateDocument(schoolId, "report-card");
  return { id: publication.id };
}

export async function submitClassReportCardsForReviewAction(data: {
  classId: number;
  term: Term;
  academicYear: string;
  notes?: string;
}) {
  const parsed = parseActionInput(reportPublicationSchema, data);
  const { userId, role, schoolId } = await requireRole(["teacher"]);
  const activePeriod = await getActiveAcademicPeriod(schoolId);
  if (parsed.term !== activePeriod.currentTerm || parsed.academicYear !== activePeriod.academicYear) {
    throw new Error("Class reports can only be submitted for the active academic period.");
  }

  const teacherScope = await getTeacherScope({ schoolId, teacherId: userId });
  if (!teacherScope.supervisedClassIds.includes(parsed.classId)) {
    throw new Error("Only the assigned class teacher can submit this class for report-card review.");
  }

  const cls = await prisma.class.findFirst({
    where: { id: parsed.classId, schoolId },
    select: { id: true, name: true },
  });
  if (!cls) throw new Error("Class not found.");

  const readiness = await getClassReportReadiness({
    schoolId,
    classId: parsed.classId,
    term: parsed.term,
    academicYear: parsed.academicYear,
  });
  if (readiness.subjectCount === 0) {
    throw new Error("This class has no timetable subjects. Add subjects to the timetable before submitting.");
  }
  if (readiness.studentCount === 0) {
    throw new Error("This class has no students to submit.");
  }
  if (!readiness.isReady) {
    throw new Error(
      `Cannot submit yet. ${readiness.missingCount} student-subject report entr${readiness.missingCount === 1 ? "y is" : "ies are"} still incomplete.`,
    );
  }

  const publication = await prisma.reportCardPublication.upsert({
    where: {
      schoolId_classId_term_academicYear: {
        schoolId,
        classId: parsed.classId,
        term: parsed.term,
        academicYear: parsed.academicYear,
      },
    },
    create: {
      schoolId,
      classId: parsed.classId,
      term: parsed.term,
      academicYear: parsed.academicYear,
      status: "SUBMITTED",
      notes: parsed.notes,
      submittedAt: new Date(),
      submittedBy: userId,
    },
    update: {
      status: "SUBMITTED",
      notes: parsed.notes,
      submittedAt: new Date(),
      submittedBy: userId,
      reviewedAt: null,
      reviewedBy: null,
      reviewNote: null,
      unpublishedAt: null,
      unpublishedBy: null,
    },
  });

  await logCAAudit({
    schoolId,
    actorId: userId,
    action: "REPORT_CARDS_SUBMITTED_FOR_REVIEW",
    entityType: "ReportCardPublication",
    entityId: publication.id,
    message: `${cls.name} report cards were submitted for admin review for ${parsed.academicYear} ${parsed.term.replace("_", " ")}.`,
    metadata: {
      classId: parsed.classId,
      term: parsed.term,
      academicYear: parsed.academicYear,
      studentCount: readiness.studentCount,
      subjectCount: readiness.subjectCount,
      notes: parsed.notes,
      role,
    },
  });

  revalidatePath("/list/report-cards");
  revalidateDashboard(schoolId);
  revalidateDocument(schoolId, "report-card");
  return { id: publication.id };
}

export async function rejectClassReportCardsReviewAction(data: {
  classId: number;
  term: Term;
  academicYear: string;
  notes?: string;
}) {
  const parsed = parseActionInput(reportPublicationSchema, data);
  const { userId, schoolId } = await requireRole(["admin"]);

  const publication = await prisma.reportCardPublication.findUnique({
    where: {
      schoolId_classId_term_academicYear: {
        schoolId,
        classId: parsed.classId,
        term: parsed.term,
        academicYear: parsed.academicYear,
      },
    },
    include: { class: { select: { name: true } } },
  });
  if (!publication || publication.status !== "SUBMITTED") {
    throw new Error("Only submitted report-card sets can be rejected.");
  }

  const updated = await prisma.reportCardPublication.update({
    where: { id: publication.id, schoolId },
    data: {
      status: "REJECTED",
      reviewedAt: new Date(),
      reviewedBy: userId,
      reviewNote: parsed.notes || "Returned for correction.",
    },
  });

  await logCAAudit({
    schoolId,
    actorId: userId,
    action: "REPORT_CARDS_REJECTED",
    entityType: "ReportCardPublication",
    entityId: publication.id,
    message: `${publication.class.name} report cards were returned for correction for ${parsed.academicYear} ${parsed.term.replace("_", " ")}.`,
    metadata: parsed,
  });

  revalidatePath("/list/report-cards");
  revalidateDashboard(schoolId);
  revalidateDocument(schoolId, "report-card");
  return { id: updated.id };
}

export async function unpublishClassReportCardsAction(data: {
  classId: number;
  term: Term;
  academicYear: string;
  notes?: string;
}) {
  const parsed = parseActionInput(reportPublicationSchema, data);
  const { userId, schoolId } = await requireRole(["admin"]);

  const publication = await prisma.reportCardPublication.findUnique({
    where: {
      schoolId_classId_term_academicYear: {
        schoolId,
        classId: parsed.classId,
        term: parsed.term,
        academicYear: parsed.academicYear,
      },
    },
    include: { class: { select: { name: true } } },
  });
  if (!publication) throw new Error("No published report-card record exists for this class period.");

  const updated = await prisma.reportCardPublication.update({
    where: { id: publication.id, schoolId },
    data: {
      status: "UNPUBLISHED",
      notes: parsed.notes,
      unpublishedAt: new Date(),
      unpublishedBy: userId,
    },
  });

  await logCAAudit({
    schoolId,
    actorId: userId,
    action: "REPORT_CARDS_UNPUBLISHED",
    entityType: "ReportCardPublication",
    entityId: publication.id,
    message: `${publication.class.name} report cards were unpublished for ${parsed.academicYear} ${parsed.term.replace("_", " ")}.`,
    metadata: {
      classId: parsed.classId,
      term: parsed.term,
      academicYear: parsed.academicYear,
      notes: parsed.notes,
    },
  });

  revalidatePath("/list/report-cards");
  revalidatePath("/parent");
  revalidateDashboard(schoolId);
  revalidateDocument(schoolId, "report-card");
  return { id: updated.id };
}

export async function openExamEntryWindowAction(data: {
  classId: number;
  term: Term;
  academicYear: string;
  notes?: string;
}) {
  const parsed = parseActionInput(examEntryWindowSchema, data);
  const { userId, schoolId } = await requireRole(["admin"]);

  const cls = await prisma.class.findFirst({
    where: { id: parsed.classId, schoolId },
    select: { id: true, name: true },
  });
  if (!cls) throw new Error("Class not found.");

  const window = await prisma.examEntryWindow.upsert({
    where: {
      schoolId_classId_term_academicYear: {
        schoolId,
        classId: parsed.classId,
        term: parsed.term,
        academicYear: parsed.academicYear,
      },
    },
    create: {
      schoolId,
      classId: parsed.classId,
      term: parsed.term,
      academicYear: parsed.academicYear,
      status: "OPEN",
      openedAt: new Date(),
      openedBy: userId,
      notes: parsed.notes,
    },
    update: {
      status: "OPEN",
      openedAt: new Date(),
      openedBy: userId,
      closedAt: null,
      closedBy: null,
      notes: parsed.notes,
    },
  });

  await logCAAudit({
    schoolId,
    actorId: userId,
    action: "EXAM_ENTRY_OPENED",
    entityType: "ExamEntryWindow",
    entityId: window.id,
    message: `${cls.name} exam entry was opened for ${parsed.academicYear} ${parsed.term.replace("_", " ")}.`,
    metadata: parsed,
  });

  revalidatePath("/list/ca");
  revalidatePath("/list/report-cards");
  revalidateDashboard(schoolId);
  return { id: window.id };
}

export async function closeExamEntryWindowAction(data: {
  classId: number;
  term: Term;
  academicYear: string;
  notes?: string;
}) {
  const parsed = parseActionInput(examEntryWindowSchema, data);
  const { userId, schoolId } = await requireRole(["admin"]);

  const window = await prisma.examEntryWindow.findUnique({
    where: {
      schoolId_classId_term_academicYear: {
        schoolId,
        classId: parsed.classId,
        term: parsed.term,
        academicYear: parsed.academicYear,
      },
    },
    include: { class: { select: { name: true } } },
  });
  if (!window) throw new Error("Exam entry window not found.");

  const updated = await prisma.examEntryWindow.update({
    where: { id: window.id, schoolId },
    data: {
      status: "CLOSED",
      closedAt: new Date(),
      closedBy: userId,
      notes: parsed.notes,
    },
  });

  await logCAAudit({
    schoolId,
    actorId: userId,
    action: "EXAM_ENTRY_CLOSED",
    entityType: "ExamEntryWindow",
    entityId: window.id,
    message: `${window.class.name} exam entry was closed for ${parsed.academicYear} ${parsed.term.replace("_", " ")}.`,
    metadata: parsed,
  });

  revalidatePath("/list/ca");
  revalidatePath("/list/report-cards");
  revalidateDashboard(schoolId);
  return { id: updated.id };
}
