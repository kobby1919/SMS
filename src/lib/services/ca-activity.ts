import prisma from "@/src/lib/prisma";
import type { CABucketAggregationMode, CAActivityType, Prisma, Term } from "@/src/generated/prisma";
import { getGradeBand } from "@/src/lib/caGrades";

type CAAuditDelegate = {
  create(args: {
    data: {
      schoolId: string;
      actorId?: string;
      action: string;
      entityType: string;
      entityId: string;
      message: string;
      metadata?: Prisma.InputJsonValue;
    };
  }): Promise<unknown>;
};

type PrismaWithCAAudit = typeof prisma & {
  cAAuditLog?: CAAuditDelegate;
};

const prismaWithCAAudit = prisma as PrismaWithCAAudit;

type CAContext = {
  schoolId: string;
  classId: number;
  subjectId: number;
  term: Term;
  academicYear: string;
};

export async function logCAAudit(input: {
  schoolId: string;
  actorId?: string;
  action: string;
  entityType: string;
  entityId: string | number;
  message: string;
  metadata?: Prisma.InputJsonValue;
}) {
  const data = {
    schoolId: input.schoolId,
    actorId: input.actorId,
    action: input.action,
    entityType: input.entityType,
    entityId: String(input.entityId),
    message: input.message,
    metadata: input.metadata,
  };

  if (prismaWithCAAudit.cAAuditLog) {
    return prismaWithCAAudit.cAAuditLog.create({ data });
  }

  await prisma.$executeRaw`
    INSERT INTO "CAAuditLog" (
      "schoolId",
      "actorId",
      "action",
      "entityType",
      "entityId",
      "message",
      "metadata",
      "createdAt"
    )
    VALUES (
      ${data.schoolId},
      ${data.actorId ?? null},
      ${data.action},
      ${data.entityType},
      ${data.entityId},
      ${data.message},
      CAST(${data.metadata ? JSON.stringify(data.metadata) : null} AS JSONB),
      CURRENT_TIMESTAMP
    )
  `;

  return null;
}

export type CABucketInput = CAContext & {
  name: string;
  type: CAActivityType;
  aggregationMode: CABucketAggregationMode;
  allocationMarks: number;
  order?: number;
  createdBy?: string;
};

export type CAActivityInput = {
  schoolId: string;
  bucketId: number;
  title?: string;
  type?: CAActivityType;
  rawMaxScore: number;
  allocationMarks?: number | null;
  activityDate?: Date;
  teacherId: string;
};

export type CAActivityScoreInput = {
  schoolId: string;
  activityId: number;
  studentId: string;
  rawScore: number;
  recordedBy: string;
  comment?: string;
};

export type CAActivityScoreWriteResult = {
  score: {
    id: number;
    studentId: string;
  };
  changed: boolean;
};

export type CABucketProgress = {
  bucketId: number;
  name: string;
  type: CAActivityType;
  aggregationMode: CABucketAggregationMode;
  allocationMarks: number;
  earnedMarks: number;
  activityCount: number;
  scoredActivityCount: number;
  averagePercentage: number;
  activities: {
    id: number;
    title: string;
    rawMaxScore: number;
    allocationMarks: number | null;
    rawScore: number | null;
    earnedMarks: number | null;
    teacherName: string;
    activityDate: Date;
  }[];
};

export type SubjectCAProgress = {
  classworkWeight: number;
  earnedMarks: number;
  possibleRecordedMarks: number;
  totalAllocatedMarks: number;
  completionRate: number;
  buckets: CABucketProgress[];
};

function roundScore(value: number) {
  return Math.round(value * 100) / 100;
}

function toNumber(value: unknown) {
  return Number(value ?? 0);
}

export function calculateAllocatedMark(rawScore: number, rawMaxScore: number, allocationMarks: number) {
  if (rawMaxScore <= 0) throw new Error("Raw maximum score must be greater than zero.");
  if (rawScore < 0) throw new Error("Raw score cannot be negative.");
  if (rawScore > rawMaxScore) throw new Error("Raw score cannot exceed the activity maximum score.");
  if (allocationMarks <= 0) throw new Error("CA allocation must be greater than zero.");

  return roundScore((rawScore / rawMaxScore) * allocationMarks);
}

export async function getCAConfigOrThrow(schoolId: string, academicYear: string) {
  const config = await prisma.cAConfig.findUnique({
    where: { schoolId_academicYear: { schoolId, academicYear } },
  });

  if (!config) {
    throw new Error(`No CA configuration found for ${academicYear}. Ask your admin to set it up.`);
  }

  return config;
}

export async function assertCAAllocationWithinConfig(input: {
  schoolId: string;
  classId: number;
  subjectId: number;
  term: Term;
  academicYear: string;
  allocationMarks: number;
  excludeBucketId?: number;
}) {
  const config = await getCAConfigOrThrow(input.schoolId, input.academicYear);
  const existing = await prisma.cABucket.findMany({
    where: {
      schoolId: input.schoolId,
      classId: input.classId,
      subjectId: input.subjectId,
      term: input.term,
      academicYear: input.academicYear,
      ...(input.excludeBucketId ? { id: { not: input.excludeBucketId } } : {}),
    },
    select: { allocationMarks: true },
  });

  const currentTotal = existing.reduce((sum, bucket) => sum + toNumber(bucket.allocationMarks), 0);
  const nextTotal = roundScore(currentTotal + input.allocationMarks);
  const allowed = Number(config.classworkWeight);

  if (input.allocationMarks <= 0) throw new Error("Bucket allocation must be greater than zero.");
  if (nextTotal > allowed) {
    throw new Error(
      `CA buckets total ${nextTotal}, but ${input.academicYear} allows only ${allowed} marks for CA.`,
    );
  }
}

export async function assertTeacherCanManageCAContext(input: {
  userId: string;
  role: string;
  schoolId: string;
  classId: number;
  subjectId: number;
}) {
  if (input.role === "admin") return;

  const allowed = await prisma.lesson.findFirst({
    where: {
      schoolId: input.schoolId,
      classId: input.classId,
      subjectId: input.subjectId,
      teacherId: input.userId,
    },
    select: { id: true },
  });

  if (!allowed) {
    throw new Error("Only the assigned subject teacher can manage this CA structure.");
  }
}

export async function createCABucket(input: CABucketInput) {
  await assertCAAllocationWithinConfig(input);

  const existing = await prisma.cABucket.findFirst({
    where: {
      schoolId: input.schoolId,
      classId: input.classId,
      subjectId: input.subjectId,
      term: input.term,
      academicYear: input.academicYear,
      name: input.name,
    },
    select: { id: true },
  });

  if (existing) {
    throw new Error("This CA bucket already exists. Select the existing bucket and add activities under it.");
  }

  return prisma.cABucket.create({
    data: {
      schoolId: input.schoolId,
      classId: input.classId,
      subjectId: input.subjectId,
      term: input.term,
      academicYear: input.academicYear,
      name: input.name,
      type: input.type,
      aggregationMode: input.aggregationMode,
      allocationMarks: input.allocationMarks,
      order: input.order ?? 0,
      createdBy: input.createdBy,
    },
  });
}

export async function getNextActivitySequence(bucketId: number) {
  const latest = await prisma.cAActivity.findFirst({
    where: { bucketId },
    orderBy: { sequence: "desc" },
    select: { sequence: true },
  });

  return (latest?.sequence ?? 0) + 1;
}

export function defaultActivityTitle(type: CAActivityType, sequence: number) {
  const label: Record<CAActivityType, string> = {
    MIDTERM_EXAM: "Midterm Exam",
    CLASS_TEST: "Class Test",
    CLASS_EXERCISE: "Class Exercise",
    QUIZ: "Quiz",
    HOMEWORK: "Homework",
    PROJECT: "Project",
    PRACTICAL: "Practical",
    PARTICIPATION: "Participation",
    OTHER: "Activity",
  };

  return `${label[type]} ${sequence}`;
}

export async function assertActivityAllocationWithinBucket(input: {
  bucketId: number;
  allocationMarks?: number | null;
  excludeActivityId?: number;
}) {
  const bucket = await prisma.cABucket.findUnique({
    where: { id: input.bucketId },
    select: { allocationMarks: true, aggregationMode: true },
  });

  if (!bucket) throw new Error("CA bucket not found.");
  if (bucket.aggregationMode === "AVERAGE_TO_BUCKET") return;
  if (!input.allocationMarks || input.allocationMarks <= 0) {
    throw new Error("This bucket requires each activity to have its own CA allocation.");
  }

  const activities = await prisma.cAActivity.findMany({
    where: {
      bucketId: input.bucketId,
      ...(input.excludeActivityId ? { id: { not: input.excludeActivityId } } : {}),
    },
    select: { allocationMarks: true },
  });

  const currentTotal = activities.reduce((sum, activity) => sum + toNumber(activity.allocationMarks), 0);
  const nextTotal = roundScore(currentTotal + input.allocationMarks);
  const allowed = toNumber(bucket.allocationMarks);

  if (nextTotal > allowed) {
    throw new Error(`Activities total ${nextTotal}, but this bucket allows only ${allowed} CA marks.`);
  }
}

export async function createCAActivity(input: CAActivityInput) {
  const bucket = await prisma.cABucket.findFirst({
    where: { id: input.bucketId, schoolId: input.schoolId },
    select: {
      id: true,
      schoolId: true,
      classId: true,
      subjectId: true,
      type: true,
      aggregationMode: true,
      isLocked: true,
    },
  });

  if (!bucket) throw new Error("CA bucket not found.");
  if (bucket.isLocked) throw new Error("This CA bucket is locked. Unlocking requires an admin correction process.");
  if (input.rawMaxScore <= 0) throw new Error("Raw maximum score must be greater than zero.");

  await assertActivityAllocationWithinBucket({
    bucketId: bucket.id,
    allocationMarks: input.allocationMarks,
  });

  const sequence = await getNextActivitySequence(bucket.id);
  const type = input.type ?? bucket.type;

  return prisma.cAActivity.create({
    data: {
      schoolId: input.schoolId,
      bucketId: bucket.id,
      classId: bucket.classId,
      subjectId: bucket.subjectId,
      teacherId: input.teacherId,
      type,
      title: input.title?.trim() || defaultActivityTitle(type, sequence),
      rawMaxScore: input.rawMaxScore,
      allocationMarks: bucket.aggregationMode === "SUM_ACTIVITIES" ? input.allocationMarks : null,
      activityDate: input.activityDate ?? new Date(),
      sequence,
    },
  });
}

export async function upsertCAActivityScore(input: CAActivityScoreInput): Promise<CAActivityScoreWriteResult> {
  const activity = await prisma.cAActivity.findFirst({
    where: { id: input.activityId, schoolId: input.schoolId },
    include: {
      bucket: { select: { allocationMarks: true, aggregationMode: true, isLocked: true } },
    },
  });

  if (!activity) throw new Error("CA activity not found.");
  if (activity.isLocked || activity.bucket.isLocked) {
    throw new Error("This CA activity is locked. Score changes require an admin correction process.");
  }

  const student = await prisma.student.findFirst({
    where: { id: input.studentId, schoolId: input.schoolId, classId: activity.classId },
    select: { id: true },
  });
  if (!student) throw new Error("Student does not belong to this CA activity class.");

  const allocation =
    activity.bucket.aggregationMode === "SUM_ACTIVITIES"
      ? toNumber(activity.allocationMarks)
      : toNumber(activity.bucket.allocationMarks);
  const normalizedContribution = calculateAllocatedMark(
    input.rawScore,
    toNumber(activity.rawMaxScore),
    allocation,
  );
  const nextComment = input.comment?.trim() || null;

  const existing = await prisma.cAActivityScore.findUnique({
    where: { activityId_studentId: { activityId: input.activityId, studentId: input.studentId } },
    select: {
      id: true,
      studentId: true,
      rawScore: true,
      normalizedContribution: true,
      comment: true,
    },
  });

  if (
    existing &&
    toNumber(existing.rawScore) === input.rawScore &&
    toNumber(existing.normalizedContribution) === normalizedContribution &&
    (existing.comment ?? null) === nextComment
  ) {
    return { score: existing, changed: false };
  }

  const score = await prisma.cAActivityScore.upsert({
    where: { activityId_studentId: { activityId: input.activityId, studentId: input.studentId } },
    create: {
      schoolId: input.schoolId,
      activityId: input.activityId,
      studentId: input.studentId,
      rawScore: input.rawScore,
      normalizedContribution,
      recordedBy: input.recordedBy,
      comment: nextComment,
    },
    update: {
      rawScore: input.rawScore,
      normalizedContribution,
      recordedBy: input.recordedBy,
      comment: nextComment,
    },
    select: {
      id: true,
      studentId: true,
    },
  });

  return { score, changed: true };
}

export async function getSubjectCAProgress(input: CAContext & { studentId: string }): Promise<SubjectCAProgress> {
  const config = await getCAConfigOrThrow(input.schoolId, input.academicYear);
  const buckets = await prisma.cABucket.findMany({
    where: {
      schoolId: input.schoolId,
      classId: input.classId,
      subjectId: input.subjectId,
      term: input.term,
      academicYear: input.academicYear,
    },
    include: {
      activities: {
        orderBy: [{ activityDate: "asc" }, { sequence: "asc" }],
        include: {
          teacher: { select: { name: true, surname: true } },
          scores: {
            where: { studentId: input.studentId },
            select: { rawScore: true, normalizedContribution: true },
          },
        },
      },
    },
    orderBy: [{ order: "asc" }, { id: "asc" }],
  });

  const progressBuckets = buckets.map((bucket): CABucketProgress => {
    const allocationMarks = toNumber(bucket.allocationMarks);
    const activityRows = bucket.activities.map((activity) => {
      const score = activity.scores[0];
      const rawMaxScore = toNumber(activity.rawMaxScore);
      const rawScore = score ? toNumber(score.rawScore) : null;
      const activityAllocation = activity.allocationMarks ? toNumber(activity.allocationMarks) : null;
      const earnedMarks = score
        ? bucket.aggregationMode === "SUM_ACTIVITIES"
          ? toNumber(score.normalizedContribution)
          : calculateAllocatedMark(rawScore ?? 0, rawMaxScore, allocationMarks)
        : null;

      return {
        id: activity.id,
        title: activity.title,
        rawMaxScore,
        allocationMarks: activityAllocation,
        rawScore,
        earnedMarks,
        teacherName: `${activity.teacher.name} ${activity.teacher.surname}`,
        activityDate: activity.activityDate,
      };
    });

    const scoredRows = activityRows.filter((activity) => activity.rawScore !== null);
    const averagePercentage = scoredRows.length
      ? scoredRows.reduce((sum, activity) => sum + ((activity.rawScore ?? 0) / activity.rawMaxScore) * 100, 0) /
        scoredRows.length
      : 0;
    const earnedMarks =
      bucket.aggregationMode === "SUM_ACTIVITIES"
        ? Math.min(
            scoredRows.reduce((sum, activity) => sum + (activity.earnedMarks ?? 0), 0),
            allocationMarks,
          )
        : roundScore((averagePercentage / 100) * allocationMarks);

    return {
      bucketId: bucket.id,
      name: bucket.name,
      type: bucket.type,
      aggregationMode: bucket.aggregationMode,
      allocationMarks,
      earnedMarks: roundScore(earnedMarks),
      activityCount: activityRows.length,
      scoredActivityCount: scoredRows.length,
      averagePercentage: roundScore(averagePercentage),
      activities: activityRows,
    };
  });

  const totalAllocatedMarks = roundScore(
    progressBuckets.reduce((sum, bucket) => sum + bucket.allocationMarks, 0),
  );
  const earnedMarks = roundScore(progressBuckets.reduce((sum, bucket) => sum + bucket.earnedMarks, 0));
  const possibleRecordedMarks = roundScore(
    progressBuckets.reduce(
      (sum, bucket) =>
        sum +
        (bucket.aggregationMode === "SUM_ACTIVITIES"
          ? bucket.activities.reduce((inner, activity) => inner + (activity.allocationMarks ?? 0), 0)
          : bucket.scoredActivityCount > 0
            ? bucket.allocationMarks
            : 0),
      0,
    ),
  );

  return {
    classworkWeight: Number(config.classworkWeight),
    earnedMarks,
    possibleRecordedMarks,
    totalAllocatedMarks,
    completionRate: totalAllocatedMarks > 0 ? Math.round((possibleRecordedMarks / totalAllocatedMarks) * 100) : 0,
    buckets: progressBuckets,
  };
}

export async function syncComputedCARecord(input: CAContext & {
  studentId: string;
  teacherId: string;
}) {
  const config = await getCAConfigOrThrow(input.schoolId, input.academicYear);
  const progress = await getSubjectCAProgress(input);
  const existing = await prisma.continuousAssessment.findUnique({
    where: {
      schoolId_studentId_subjectId_classId_term_academicYear: {
        schoolId: input.schoolId,
        studentId: input.studentId,
        subjectId: input.subjectId,
        classId: input.classId,
        term: input.term,
        academicYear: input.academicYear,
      },
    },
    select: { examScore: true, remarks: true },
  });
  const examScore = Math.min(existing?.examScore ?? 0, Number(config.examWeight));
  const totalScore = roundScore(progress.earnedMarks + examScore);
  const band = getGradeBand(totalScore);

  return prisma.continuousAssessment.upsert({
    where: {
      schoolId_studentId_subjectId_classId_term_academicYear: {
        schoolId: input.schoolId,
        studentId: input.studentId,
        subjectId: input.subjectId,
        classId: input.classId,
        term: input.term,
        academicYear: input.academicYear,
      },
    },
    create: {
      schoolId: input.schoolId,
      studentId: input.studentId,
      subjectId: input.subjectId,
      classId: input.classId,
      teacherId: input.teacherId,
      term: input.term,
      academicYear: input.academicYear,
      classworkScore: progress.earnedMarks,
      examScore,
      totalScore,
      grade: band.grade,
      gradePoint: band.gradePoint,
      remarks: "CA computed from recorded activities.",
      configId: config.id,
    },
    update: {
      teacherId: input.teacherId,
      classworkScore: progress.earnedMarks,
      examScore,
      totalScore,
      grade: band.grade,
      gradePoint: band.gradePoint,
      remarks: existing?.remarks || "CA computed from recorded activities.",
      configId: config.id,
    },
  });
}

export async function syncComputedCARecordsForActivity(input: {
  schoolId: string;
  activityId: number;
  studentIds: string[];
}) {
  const activity = await prisma.cAActivity.findFirst({
    where: { id: input.activityId, schoolId: input.schoolId },
    include: {
      bucket: {
        select: {
          term: true,
          academicYear: true,
        },
      },
    },
  });

  if (!activity) throw new Error("CA activity not found.");

  const uniqueStudentIds = [...new Set(input.studentIds)];
  return Promise.all(
    uniqueStudentIds.map((studentId) =>
      syncComputedCARecord({
        schoolId: input.schoolId,
        studentId,
        classId: activity.classId,
        subjectId: activity.subjectId,
        term: activity.bucket.term,
        academicYear: activity.bucket.academicYear,
        teacherId: activity.teacherId,
      }),
    ),
  );
}
