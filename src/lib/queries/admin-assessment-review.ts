import "server-only";
import { z } from "zod";
import prisma from "@/src/lib/prisma";
import { requireRole } from "@/src/lib/authz";
import { getActiveAcademicPeriod } from "@/src/lib/services/academic-period";
import { getSubjectCAProgress, type SubjectCAProgress } from "@/src/lib/services/ca-activity";
import { listLiveTimetableLessons } from "@/src/lib/services/timetable";

const filters = z.object({
  classId: z.coerce.number().int().positive().optional(),
  subjectId: z.coerce.number().int().positive().optional(),
  year: z.string().trim().min(1).max(30).optional(),
  term: z.enum(["TERM_1", "TERM_2", "TERM_3"]).optional(),
  search: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).max(100000).default(1),
});

export function assessmentPosition(progress: SubjectCAProgress, examScore: number | null, examMaximum: number, futureActivities = 0) {
  const activities = progress.buckets.flatMap((bucket) => bucket.activities);
  const scored = activities.filter((activity) => activity.rawScore !== null).length;
  const allocationComplete = Math.abs(progress.totalAllocatedMarks - progress.classworkWeight) < 0.005;
  const caComplete = activities.length > 0 && scored === activities.length && allocationComplete &&
    progress.buckets.every((bucket) => bucket.activityCount > 0 &&
      (bucket.aggregationMode !== "SUM_ACTIVITIES" ||
        Math.abs(bucket.activities.reduce((sum, activity) => sum + (activity.allocationMarks ?? 0), 0) - bucket.allocationMarks) < 0.005));
  // Zero is also the database default; it cannot prove an exam was entered.
  const examConfirmed = examMaximum === 0 || (examScore !== null && examScore > 0 && examScore <= examMaximum);
  const complete = caComplete && examConfirmed && futureActivities === 0;
  return {
    scored, expected: activities.length, caComplete, examConfirmed,
    ca: scored > 0 ? progress.earnedMarks : null,
    status: complete ? "Complete" : scored === 0 && !examScore ? "Not started" : "Incomplete",
    total: complete ? Math.round((progress.earnedMarks + (examMaximum > 0 ? examScore ?? 0 : 0)) * 100) / 100 : null,
  };
}

export async function getAdminAssessmentReview(params: Record<string, string | undefined>, now = new Date()) {
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
  const config = configs.find((item) => item.academicYear === year);
  const base = { classes, configs, year, term, classId, search: selection.search ?? "", page: selection.page, subjects: [] as { id: number; name: string }[], subjectId: selection.subjectId, teacherNames: [] as string[], rows: [] as Awaited<ReturnType<typeof loadRows>>, count: 0, pageCount: 1, error: null as string | null, config };
  if (!parsed.success) return { ...base, error: "Some filters are invalid. Select a valid class, subject, year and term." };
  if (classId === undefined) return base;
  if (!classes.some((item) => item.id === classId)) return { ...base, error: "This class is not available in your school." };
  if (!config) return { ...base, error: "Assessment configuration is not available for this academic year." };
  const lessons = await listLiveTimetableLessons(schoolId, { classId });
  const currentPeriod = year === active.academicYear && term === active.currentTerm;
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
  const studentWhere = { schoolId, classId, ...(currentPeriod ? { status: "ACTIVE" as const } : {}),
    ...(base.search ? { OR: ["name", "surname", "admissionNumber"].map((field) => ({ [field]: { contains: base.search, mode: "insensitive" as const } })) } : {}) };
  const count = await prisma.student.count({ where: studentWhere });
  const pageCount = Math.max(1, Math.ceil(count / 25));
  const page = Math.min(selection.page, pageCount);
  const students = await prisma.student.findMany({ where: studentWhere, select: { id: true, name: true, surname: true, admissionNumber: true }, orderBy: [{ surname: "asc" }, { name: "asc" }, { id: "asc" }], take: 25, skip: (page - 1) * 25 });
  const rows = await loadRows({ schoolId, classId, subjectId, term, year, now, config, students });
  const teacherNames = currentPeriod ? [...new Set(lessons.filter((lesson) => lesson.subjectId === subjectId).map((lesson) => `${lesson.teacher.name} ${lesson.teacher.surname}`))] : [];
  return { ...base, subjects, subjectId, teacherNames, rows, count, page, pageCount };
}

async function loadRows(input: {
  schoolId: string; classId: number; subjectId: number; term: "TERM_1" | "TERM_2" | "TERM_3"; year: string; now: Date;
  config: { examWeight: number; classworkWeight: number };
  students: { id: string; name: string; surname: string; admissionNumber: string | null }[];
}) {
  const context = { schoolId: input.schoolId, classId: input.classId, subjectId: input.subjectId, term: input.term, academicYear: input.year };
  const ids = input.students.map((student) => student.id);
  const [records, updates, futureActivities] = await Promise.all([
    prisma.continuousAssessment.findMany({ where: { ...context, studentId: { in: ids } }, select: { studentId: true, examScore: true, updatedAt: true } }),
    prisma.cAActivityScore.findMany({ where: { schoolId: input.schoolId, studentId: { in: ids }, activity: { schoolId: input.schoolId, classId: input.classId, subjectId: input.subjectId, activityDate: { lte: input.now }, bucket: context } }, select: { studentId: true, updatedAt: true } }),
    prisma.cAActivity.count({ where: { schoolId: input.schoolId, classId: input.classId, subjectId: input.subjectId, bucket: context, activityDate: { gt: input.now } } }),
  ]);
  return Promise.all(input.students.map(async (student) => {
    const progress = await getSubjectCAProgress({ ...context, studentId: student.id, asOf: input.now });
    const record = records.find((item) => item.studentId === student.id);
    const dates = [...updates.filter((item) => item.studentId === student.id).map((item) => item.updatedAt), ...(record ? [record.updatedAt] : [])];
    return { student, progress, examScore: record?.examScore ?? null, position: assessmentPosition(progress, record?.examScore ?? null, input.config.examWeight, futureActivities), updatedAt: dates.length ? new Date(Math.max(...dates.map((date) => date.getTime()))) : null };
  }));
}
