import "server-only";
import { z } from "zod";
import prisma from "@/src/lib/prisma";
import { requireRole } from "@/src/lib/authz";
import { getActiveAcademicPeriod } from "@/src/lib/services/academic-period";
import { getSubjectCAProgress, type SubjectCAProgress } from "@/src/lib/services/ca-activity";
import { listLiveTimetableLessons } from "@/src/lib/services/timetable";
import type { Prisma } from "@/src/generated/prisma";

const positiveId = z.string().regex(/^[1-9]\d*$/).transform(Number).pipe(z.number().int().positive().max(Number.MAX_SAFE_INTEGER));

const filters = z.object({
  classId: positiveId.optional(),
  subjectId: positiveId.optional(),
  year: z.string().trim().min(1).max(30).optional(),
  term: z.enum(["TERM_1", "TERM_2", "TERM_3"]).optional(),
  search: z.string().trim().max(100).optional(),
  page: z.string().regex(/^[1-9]\d*$/).transform(Number).pipe(z.number().int().max(100000)).optional().transform((value) => value ?? 1),
});

export function assessmentPosition(progress: SubjectCAProgress, examScore: number | null, examMaximum: number, futureActivities = 0) {
  const activities = progress.buckets.flatMap((bucket) => bucket.activities);
  const scored = activities.filter((activity) => activity.rawScore !== null).length;
  const invalid = !Number.isFinite(progress.earnedMarks) || progress.earnedMarks < 0 || progress.earnedMarks > progress.classworkWeight ||
    !Number.isFinite(progress.classworkWeight) || progress.classworkWeight < 0 || !Number.isFinite(examMaximum) || examMaximum < 0 ||
    (examScore !== null && (!Number.isFinite(examScore) || examScore < 0 || (examMaximum > 0 && examScore > examMaximum))) ||
    activities.some((activity) => !Number.isFinite(activity.rawMaxScore) || activity.rawMaxScore <= 0 ||
      (activity.rawScore !== null && (!Number.isFinite(activity.rawScore) || activity.rawScore < 0 || activity.rawScore > activity.rawMaxScore)));
  const allocationComplete = Math.abs(progress.totalAllocatedMarks - progress.classworkWeight) < 0.005;
  const caComplete = activities.length > 0 && scored === activities.length && allocationComplete &&
    progress.buckets.every((bucket) => bucket.activityCount > 0 &&
      (bucket.aggregationMode !== "SUM_ACTIVITIES" ||
        Math.abs(bucket.activities.reduce((sum, activity) => sum + (activity.allocationMarks ?? 0), 0) - bucket.allocationMarks) < 0.005));
  // Zero is also the database default; it cannot prove an exam was entered.
  const examConfirmed = examMaximum === 0 || (examScore !== null && examScore > 0 && examScore <= examMaximum);
  const complete = !invalid && caComplete && examConfirmed && futureActivities === 0;
  return {
    scored, expected: activities.length, caComplete, examConfirmed,
    ca: !invalid && scored > 0 ? progress.earnedMarks : null,
    status: invalid ? "Needs review" : complete ? "Complete" : scored === 0 && !examScore ? "Not started" : "Incomplete",
    total: complete ? Math.round((progress.earnedMarks + (examMaximum > 0 ? examScore ?? 0 : 0)) * 100) / 100 : null,
  };
}

export async function getAdminAssessmentReview(params: Record<string, string | string[] | undefined>, now = new Date()) {
  const { schoolId } = await requireRole(["admin"]);
  const parsed = filters.safeParse(Object.fromEntries(Object.entries(params).filter(([key, value]) => key in filters.shape && value !== undefined && value !== "")));
  const [classes, configs, active] = await Promise.all([
    prisma.class.findMany({ where: { schoolId }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.cAConfig.findMany({ where: { schoolId }, orderBy: { academicYear: "desc" } }),
    getActiveAcademicPeriod(schoolId),
  ]);
  const selection = parsed.success ? parsed.data : { page: 1 };
  const year = selection.year ?? active.academicYear;
  const term = selection.term ?? active.currentTerm;
  const classId = selection.classId ?? classes[0]?.id;
  const currentPeriod = year === active.academicYear && term === active.currentTerm;
  const config = configs.find((item) => item.academicYear === year);
  const base = { classes, configs, year, term, classId, currentPeriod, search: selection.search ?? "", page: selection.page, subjects: [] as { id: number; name: string }[], subjectId: selection.subjectId, teacherNames: [] as string[], rows: [] as Awaited<ReturnType<typeof loadRows>>, count: 0, pageCount: 1, error: null as string | null, config };
  if (!parsed.success) return { ...base, error: "Some filters are invalid. Select a valid class, subject, year and term." };
  if (classId === undefined) return base;
  if (!classes.some((item) => item.id === classId)) return { ...base, error: "This class is not available in your school." };
  if (!config) return { ...base, error: "Assessment configuration is not available for this academic year." };
  const lessons = await listLiveTimetableLessons(schoolId, { classId });
  const historicalSubjects = currentPeriod ? [] : await prisma.subject.findMany({
    where: { schoolId, OR: [
      { caBuckets: { some: { schoolId, classId, term, academicYear: year } } },
      { continuousAssessments: { some: { schoolId, classId, term, academicYear: year } } },
    ] }, select: { id: true, name: true },
  });
  const subjects = [...new Map((currentPeriod ? lessons.map((lesson) => lesson.subject) : historicalSubjects).map((subject) => [subject.id, { id: subject.id, name: subject.name }])).values()].sort((a, b) => a.name.localeCompare(b.name));
  const subjectId = selection.subjectId ?? subjects[0]?.id;
  if (subjectId !== undefined && !subjects.some((item) => item.id === subjectId)) return { ...base, subjects, error: "This subject is not available for the selected class and period." };
  if (subjectId === undefined) return { ...base, subjects };
  const context = { schoolId, classId, subjectId, term, academicYear: year };
  const studentWhere: Prisma.StudentWhereInput = { schoolId,
    ...(currentPeriod ? { classId, status: "ACTIVE" as const } : { OR: [
      { continuousAssessments: { some: context } },
      { caActivityScores: { some: { schoolId, activity: { schoolId, classId, subjectId, bucket: context } } } },
    ] }),
    ...(base.search ? { AND: [{ OR: ["name", "surname", "admissionNumber"].map((field) => ({ [field]: { contains: base.search, mode: "insensitive" as const } })) }] } : {}) };
  return prisma.$transaction(async (db) => {
  const count = await db.student.count({ where: studentWhere });
  const pageCount = Math.max(1, Math.ceil(count / 25));
  const page = Math.min(selection.page, pageCount);
  const students = await db.student.findMany({ where: studentWhere, select: { id: true, name: true, surname: true, admissionNumber: true }, orderBy: [{ surname: "asc" }, { name: "asc" }, { id: "asc" }], take: 25, skip: (page - 1) * 25 });
  const snapshotConfig = await db.cAConfig.findUnique({ where: { schoolId_academicYear: { schoolId, academicYear: year } } });
  if (!snapshotConfig) return { ...base, subjects, subjectId, error: "Assessment configuration changed. Refresh this review." };
  const rows = await loadRows({ schoolId, classId, subjectId, term, year, now, config: snapshotConfig, students }, db);
  const teacherNames = currentPeriod ? [...new Set(lessons.filter((lesson) => lesson.subjectId === subjectId).map((lesson) => `${lesson.teacher.name} ${lesson.teacher.surname}`))] : [];
  return { ...base, config: snapshotConfig, subjects, subjectId, teacherNames, rows, count, page, pageCount };
  }, { isolationLevel: "RepeatableRead", timeout: 30000 });
}

async function loadRows(input: {
  schoolId: string; classId: number; subjectId: number; term: "TERM_1" | "TERM_2" | "TERM_3"; year: string; now: Date;
  config: { examWeight: number; classworkWeight: number };
  students: { id: string; name: string; surname: string; admissionNumber: string | null }[];
}, db: Prisma.TransactionClient) {
  const context = { schoolId: input.schoolId, classId: input.classId, subjectId: input.subjectId, term: input.term, academicYear: input.year };
  const ids = input.students.map((student) => student.id);
  const [records, updates, futureActivities] = await Promise.all([
    db.continuousAssessment.findMany({ where: { ...context, studentId: { in: ids } }, select: { studentId: true, examScore: true, updatedAt: true } }),
    db.cAActivityScore.findMany({ where: { schoolId: input.schoolId, studentId: { in: ids }, activity: { schoolId: input.schoolId, classId: input.classId, subjectId: input.subjectId, activityDate: { lte: input.now }, bucket: context } }, select: { studentId: true, updatedAt: true } }),
    db.cAActivity.count({ where: { schoolId: input.schoolId, classId: input.classId, subjectId: input.subjectId, bucket: context, activityDate: { gt: input.now } } }),
  ]);
  return Promise.all(input.students.map(async (student) => {
    let progress: SubjectCAProgress;
    let invalidScore = false;
    try {
      progress = await getSubjectCAProgress({ ...context, studentId: student.id, asOf: input.now }, db);
    } catch (error) {
      if (!(error instanceof Error) || ![
        "Raw maximum score must be greater than zero.", "Raw score cannot be negative.",
        "Raw score cannot exceed the activity maximum score.", "CA allocation must be greater than zero.",
      ].includes(error.message)) throw error;
      invalidScore = true;
      progress = { classworkWeight: input.config.classworkWeight, earnedMarks: 0, possibleRecordedMarks: 0, totalAllocatedMarks: 0, completionRate: 0, buckets: [] };
    }
    const record = records.find((item) => item.studentId === student.id);
    const dates = [...updates.filter((item) => item.studentId === student.id).map((item) => item.updatedAt), ...(record ? [record.updatedAt] : [])];
    const position = assessmentPosition(progress, record?.examScore ?? null, input.config.examWeight, futureActivities);
    if (invalidScore) position.status = "Needs review";
    return { student, progress, examScore: record?.examScore ?? null, position, updatedAt: dates.length ? new Date(Math.max(...dates.map((date) => date.getTime()))) : null };
  }));
}
