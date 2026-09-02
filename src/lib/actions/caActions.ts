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
import {
  recordCAActivityGivenEvents,
  recordCAActivityScoreEvents,
} from "@/src/lib/services/parent-daily-summary";
import { syncCAActivityScorePublishingObligation } from "@/src/lib/services/teacher-ca-obligations";
import { getActiveAcademicPeriod } from "@/src/lib/services/academic-period";
import { listClassSubjectsFromTimetable } from "@/src/lib/services/timetable";

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
      bucket: { select: { term: true, academicYear: true } },
      class: {
        select: {
          _count: { select: { students: true } },
        },
      },
    },
  });
  if (!activity) throw new Error("CA activity not found.");

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

  const subjectsByClass = await listClassSubjectsFromTimetable(schoolId, [parsed.classId]);
  const subjectIds = Array.from(subjectsByClass.get(parsed.classId)?.keys() ?? []);
  if (subjectIds.length === 0) {
    throw new Error("This class has no timetable subjects. Add subjects to the timetable before publishing reports.");
  }

  const students = await prisma.student.findMany({
    where: { schoolId, classId: parsed.classId },
    select: { id: true },
  });
  if (students.length === 0) {
    throw new Error("This class has no students to publish report cards for.");
  }

  const caRecords = await prisma.continuousAssessment.findMany({
    where: {
      schoolId,
      classId: parsed.classId,
      term: parsed.term,
      academicYear: parsed.academicYear,
      subjectId: { in: subjectIds },
    },
    select: { studentId: true, subjectId: true, examScore: true },
  });

  const readyKeys = new Set(
    caRecords
      .filter((record) => record.examScore > 0)
      .map((record) => `${record.studentId}:${record.subjectId}`),
  );
  const missingCount = students.reduce((count, student) => {
    return count + subjectIds.filter((subjectId) => !readyKeys.has(`${student.id}:${subjectId}`)).length;
  }, 0);

  if (missingCount > 0) {
    throw new Error(
      `Cannot publish yet. ${missingCount} student-subject report entry${missingCount === 1 ? " is" : " entries are"} still missing exam scores.`,
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
      status: "PUBLISHED",
      notes: parsed.notes,
      publishedBy: userId,
    },
    update: {
      status: "PUBLISHED",
      notes: parsed.notes,
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
      studentCount: students.length,
      subjectCount: subjectIds.length,
      notes: parsed.notes,
    },
  });

  revalidatePath("/list/report-cards");
  revalidatePath("/parent");
  revalidateDashboard(schoolId);
  revalidateDocument(schoolId, "report-card");
  return { id: publication.id };
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
