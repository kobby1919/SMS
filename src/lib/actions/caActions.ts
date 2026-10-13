"use server";

// src/lib/actions/caActions.ts
// Server actions for Continuous Assessment feature

import prisma from "@/src/lib/prisma";
import { recordExamScores } from "@/src/lib/services/exam-recording";
import { transitionExamEntryWindow } from "@/src/lib/services/exam-entry-window";
import { recordCAActivityScores } from "@/src/lib/services/ca-score-recording";
import { hasRecordedExam, activityEligibility } from "@/src/lib/academic-readiness-rules";
import { claimTeacherCorrectionReview } from "@/src/lib/services/teacher-obligation-store";
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
  rawActivityMarkSchema,
} from "@/src/lib/validation/ca";
import { nonEmptyStringSchema, positiveIntSchema } from "@/src/lib/validation/common";
import type { Prisma, Term } from "@/src/generated/prisma";
import {
  assertTeacherCanManageCAContext,
  calculateAllocatedMark,
  createCAActivity,
  createCABucket,
  logCAAudit,
  syncComputedCARecordsForActivity,
} from "@/src/lib/services/ca-activity";
import {
  recordCAActivityGivenEvents,
  recordCAActivityScoreEvents,
} from "@/src/lib/services/parent-daily-summary";
import { syncCAActivityScorePublishingObligation } from "@/src/lib/services/teacher-ca-obligations";
import { requireActiveAcademicConfig } from "@/src/lib/services/academic-period";
import { assertReportSetEditable, transitionClassReports, type ReportActionInput, type ReportActionMode } from "@/src/lib/services/report-publication";
import { recordApprovedCorrectionParentEvent } from "@/src/lib/services/correction-parent-events";
import { assertWithinSchoolOperatingHours } from "@/src/lib/services/school-operating-hours";
import { assertTeacherCAEntryWindowOpen } from "@/src/lib/services/teacher-ca-entry-window";
import { assertClassSubjectInPublishedTimetable } from "@/src/lib/services/timetable";

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

// Score entry is teacher work; admins review corrections and configure windows.
async function assertTeacherUsesActivePeriod({
  schoolId,
  classId,
  role,
  term,
  academicYear,
}: {
  schoolId: string;
  classId: number;
  role: string;
  term: Term;
  academicYear: string;
}) {
  if (role !== "teacher") return;

  const activePeriod = await requireActiveAcademicConfig(schoolId);
  if (term !== activePeriod.currentTerm || academicYear !== activePeriod.academicYear) {
    throw new Error(
      `Teachers can only work in the active academic period: ${activePeriod.academicYear} ${activePeriod.currentTerm.replace("_", " ")}. Ask an admin to change the school period if needed.`,
    );
  }
  const release = await prisma.reportCardPublication.findUnique({ where: { schoolId_classId_term_academicYear: { schoolId, classId, term, academicYear } }, select: { status: true } });
  if (release && ["SUBMITTED", "PUBLISHED"].includes(release.status)) throw new Error("This report set is submitted or published. Ask an admin to return or withdraw it before changing assessment records.");
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
    const existing = await tx.cAConfig.findUnique({ where: { schoolId_academicYear: { schoolId, academicYear: parsed.academicYear } } });
    if (existing && (existing.classworkWeight !== parsed.classworkWeight || existing.examWeight !== parsed.examWeight)) {
      const [buckets, records] = await Promise.all([
        tx.cABucket.count({ where: { schoolId, academicYear: parsed.academicYear } }),
        tx.continuousAssessment.count({ where: { schoolId, academicYear: parsed.academicYear } }),
      ]);
      if (buckets || records) throw new Error("Assessment weights cannot change after this year's CA setup or score records exist. Use a new academic-year configuration.");
    }
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
  }, { isolationLevel: "Serializable" });

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


export async function createCA(data: CAInput) {
  const parsed = parseActionInput(caRecordSchema, data);
  const results = await bulkUpsertCA([parsed], parsed.subjectId, parsed.classId, parsed.term, parsed.academicYear);
  return results[0];
}

export async function updateCA(data: CAInput) {
  const parsed = parseActionInput(caRecordUpdateSchema, data);
  const { schoolId } = await requireRole(["teacher"]);
  const existing = await prisma.continuousAssessment.findFirst({
    where: { id: parsed.id, schoolId, studentId: parsed.studentId, classId: parsed.classId, subjectId: parsed.subjectId, term: parsed.term, academicYear: parsed.academicYear },
    select: { id: true },
  });
  if (!existing) throw new Error("Assessment record does not match the selected student and subject.");
  await bulkUpsertCA([parsed], parsed.subjectId, parsed.classId, parsed.term, parsed.academicYear);
}

export async function deleteCA(id: number) {
  parseActionInput(positiveIntSchema, id);
  await requireRole(["teacher"]);
  throw new Error("Assessment history cannot be deleted. Use the correction request workflow.");
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
  rows: BulkCARow[], subjectId: number, classId: number, term: Term, academicYear: string,
) {
  const parsed = parseActionInput(caBulkEntrySchema, { rows, subjectId, classId, term, academicYear });
  const { schoolId, userId: teacherId } = await requireRole(["teacher"]);
  const results = await recordExamScores({ ...parsed, schoolId, teacherId });
  revalidatePath("/list/ca");
  revalidatePath("/teacher");
  revalidatePath("/admin");
  revalidateDashboard(schoolId);
  for (const row of parsed.rows) revalidateDocument(schoolId, "report-card", row.studentId);
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

  await assertClassSubjectInPublishedTimetable({ schoolId, classId: parsed.classId, subjectId: parsed.subjectId });
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
    classId: parsed.classId,
    term: parsed.term,
    academicYear: parsed.academicYear,
  });

  if (role === "teacher") {
    await assertTeacherCAEntryWindowOpen({
      schoolId,
      teacherId: userId,
      classId: parsed.classId,
      subjectId: parsed.subjectId,
      actionLabel: "Creating a CA bucket",
    });
  }

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
    classId: bucket.classId,
    term: bucket.term,
    academicYear: bucket.academicYear,
  });
  await assertTeacherCAEntryWindowOpen({
    schoolId,
    teacherId: userId,
    classId: bucket.classId,
    subjectId: bucket.subjectId,
    actionLabel: "Creating a CA activity",
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
      activityDate: true,
      bucket: { select: { term: true, academicYear: true } },
      class: {
        select: {
          students: { where: { schoolId, status: "ACTIVE" }, select: { id: true, createdAt: true, classJoinedAt: true } },
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
    classId: activity.classId,
    term: activity.bucket.term,
    academicYear: activity.bucket.academicYear,
  });
  await assertTeacherCAEntryWindowOpen({
    schoolId,
    teacherId: userId,
    classId: activity.classId,
    subjectId: activity.subjectId,
    actionLabel: "Publishing CA scores",
  });

  const studentIds = parsed.rows.map((row) => row.studentId);
  const uniqueStudentIds = new Set(studentIds);
  if (uniqueStudentIds.size !== studentIds.length) {
    throw new Error("Each student may appear only once when publishing CA scores.");
  }
  const eligibleStudents = activity.class.students.filter((student) => activityEligibility(student, activity.activityDate) === "ELIGIBLE");
  if (eligibleStudents.some((student) => !uniqueStudentIds.has(student.id))) {
    throw new Error(
      `Publish scores for all ${eligibleStudents.length} eligible students before locking this CA activity.`,
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

  const writeResults = await recordCAActivityScores({ schoolId, teacherId: userId, activityId: parsed.activityId, rows: parsed.rows });
  const changedScores = writeResults.filter((result) => result.changed).map((result) => result.score);
  const allScores = writeResults.map((result) => result.score);

  const events = changedScores.length > 0
    ? await recordCAActivityScoreEvents({
        schoolId,
        activityId: parsed.activityId,
        scoreIds: changedScores.map((score) => score.id),
      })
    : [];

  await syncCAActivityScorePublishingObligation({
    schoolId,
    activityId: parsed.activityId,
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
  const newRawScore = parseActionInput(rawActivityMarkSchema, data.newRawScore);
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
  await assertTeacherCAEntryWindowOpen({
    schoolId,
    teacherId: userId,
    classId: score.activity.classId,
    subjectId: score.activity.subjectId,
    actionLabel: "Requesting a CA score correction",
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
    classId: parsed.classId,
    term: parsed.term,
    academicYear: parsed.academicYear,
  });
  await assertTeacherCAEntryWindowOpen({
    schoolId,
    teacherId: userId,
    classId: parsed.classId,
    subjectId: parsed.subjectId,
    actionLabel: "Requesting exam score correction",
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
  if (!record || !hasRecordedExam(record)) {
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
  if (data.action !== "APPROVE" && data.action !== "REJECT") throw new Error("Choose approve or reject.");
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
      where: { id: Number.parseInt(request.sourceId, 10), schoolId, student: { schoolId }, activity: { schoolId, teacherId: request.teacherId, teacher: { schoolId }, class: { schoolId }, subject: { schoolId }, bucket: { schoolId } } },
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
        await assertReportSetEditable(tx, { schoolId, classId: score.activity.classId, term: score.activity.bucket.term, academicYear: score.activity.bucket.academicYear });
        const changed = await tx.cAActivityScore.updateMany({
          where: { id: score.id, schoolId, updatedAt: score.updatedAt },
          data: {
            rawScore: newRawScore,
            normalizedContribution,
          },
        });
        if (changed.count !== 1) throw new Error("This score changed during review. Refresh before approving.");
      }
      await claimTeacherCorrectionReview(tx, { id: request.id, schoolId, teacherId: request.teacherId, action: data.action, reviewerId: userId, at: now, note: reviewNote });
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
    }, { isolationLevel: "Serializable" });

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
      where: { id: Number.parseInt(request.sourceId, 10), schoolId, teacherId: request.teacherId, teacher: { schoolId }, student: { schoolId }, class: { schoolId }, subject: { schoolId } },
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
        await assertReportSetEditable(tx, { schoolId, classId: record.classId, term: record.term, academicYear: record.academicYear });
        const config = await tx.cAConfig.findUnique({ where: { schoolId_academicYear: { schoolId, academicYear: record.academicYear } }, select: { examWeight: true } });
        if (!config || !Number.isFinite(config.examWeight) || newExamScore < 0 || newExamScore > config.examWeight) throw new Error("The requested exam score exceeds the configured exam maximum.");
        const changed = await tx.continuousAssessment.updateMany({
          where: { id: record.id, schoolId, updatedAt: record.updatedAt },
          data: {
            examScore: newExamScore,
            examRecordedAt: record.examRecordedAt ?? new Date(),
            totalScore,
            grade,
            gradePoint,
          },
        });
        if (changed.count !== 1) throw new Error("This assessment changed during review. Refresh before approving.");
      }
      await claimTeacherCorrectionReview(tx, { id: request.id, schoolId, teacherId: request.teacherId, action: data.action, reviewerId: userId, at: now, note: reviewNote });
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
    }, { isolationLevel: "Serializable" });

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

async function runReportAction(mode: ReportActionMode, data: ReportActionInput) {
  const parsed = parseActionInput(reportPublicationSchema, data);
  const actor = await requireRole(mode === "SUBMIT" ? ["teacher"] : ["admin"]);
  if (mode === "SUBMIT") await assertWithinSchoolOperatingHours(actor.schoolId, "Submitting class report cards");
  const result = await transitionClassReports(mode, parsed, actor);
  revalidatePath("/list/report-cards");
  revalidatePath("/parent");
  revalidateDashboard(actor.schoolId);
  revalidateDocument(actor.schoolId, "report-card");
  return result;
}

export async function publishClassReportCardsAction(data: ReportActionInput) {
  return runReportAction("PUBLISH", data);
}
export async function submitClassReportCardsForReviewAction(data: ReportActionInput) {
  return runReportAction("SUBMIT", data);
}
export async function rejectClassReportCardsReviewAction(data: ReportActionInput) {
  return runReportAction("REJECT", data);
}
export async function unpublishClassReportCardsAction(data: ReportActionInput) {
  return runReportAction("UNPUBLISH", data);
}

export async function openExamEntryWindowAction(data: {
  classId: number;
  term: Term;
  academicYear: string;
  notes?: string;
}) {
  const parsed = parseActionInput(examEntryWindowSchema, data);
  const actor = await requireRole(["admin"]);
  const { schoolId } = actor;
  const window = await transitionExamEntryWindow("OPEN", parsed, actor);

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
  const actor = await requireRole(["admin"]);
  const { schoolId } = actor;
  const updated = await transitionExamEntryWindow("CLOSE", parsed, actor);

  revalidatePath("/list/ca");
  revalidatePath("/list/report-cards");
  revalidateDashboard(schoolId);
  return { id: updated.id };
}
