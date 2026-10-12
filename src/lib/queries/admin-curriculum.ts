import "server-only";
import { z } from "zod";
import prisma from "@/src/lib/prisma";
import { requireRole } from "@/src/lib/authz";

const id = z.string().regex(/^[1-9]\d*$/).transform(Number).pipe(z.number().int().safe());
const filters = z.object({ view: z.enum(["coverage", "guides"]).optional(), year: z.string().trim().min(1).max(20).optional(), term: z.enum(["TERM_1", "TERM_2", "TERM_3"]).optional(), classId: id.optional(), subjectId: id.optional(), page: id.pipe(z.number().max(100000)).optional() });

export async function getAdminCurriculum(params: Record<string, string | string[] | undefined>, now = new Date()) {
  const { schoolId } = await requireRole(["admin"]);
  const parsed = filters.safeParse(Object.fromEntries(Object.entries(params).filter(([key, value]) => Object.hasOwn(filters.shape, key) && value !== "" && value !== undefined)));
  return prisma.$transaction(async (db) => {
    const classes = await db.class.findMany({ where: { schoolId }, select: { id: true, name: true, gradeId: true }, orderBy: { name: "asc" } });
    const subjects = await db.subject.findMany({ where: { schoolId }, select: { id: true, name: true }, orderBy: { name: "asc" } });
    const configs = await db.cAConfig.findMany({ where: { schoolId }, select: { academicYear: true, currentTerm: true, isActive: true }, orderBy: [{ updatedAt: "desc" }, { academicYear: "desc" }] });
    const periods = await db.syllabus.findMany({ where: { schoolId }, select: { academicYear: true }, distinct: ["academicYear"], orderBy: { academicYear: "desc" } });
    const active = configs.find((config) => config.isActive);
    const years = [...new Set([...configs.map((config) => config.academicYear), ...periods.map((period) => period.academicYear)])].sort().reverse();
    const selection = parsed.success ? parsed.data : {};
    const year = selection.year ?? active?.academicYear ?? years[0] ?? "";
    const term = selection.term ?? active?.currentTerm ?? "TERM_1";
    const currentPeriod = active?.academicYear === year && active.currentTerm === term;
    let error: string | null = parsed.success ? null : "Some curriculum filters are invalid.";
    if (selection.classId && !classes.some((cls) => cls.id === selection.classId)) error = "This class is not available in your school.";
    if (selection.subjectId && !subjects.some((subject) => subject.id === selection.subjectId)) error = "This subject is not available in your school.";
    if (year && !years.includes(year)) error = "This academic year is not available in your school.";
    const guides = await db.syllabus.findMany({
        where: { schoolId, academicYear: year, term, subject: { is: { schoolId } }, grade: { is: { schoolId } },
          ...(selection.subjectId ? { subjectId: selection.subjectId } : {}),
          ...(selection.classId ? { OR: [{ gradeId: classes.find((cls) => cls.id === selection.classId)?.gradeId ?? -1 }, { topics: { some: { progress: { some: { schoolId, classId: selection.classId } } } } }] } : {}), ...(error ? { id: -1 } : {}),
        },
        include: { subject: { select: { name: true } }, grade: { select: { level: true } }, topics: {
          orderBy: [{ weekNumber: "asc" }, { order: "asc" }, { id: "asc" }],
          include: { progress: { where: { schoolId, class: { is: { schoolId } }, teacher: { is: { schoolId } }, coveredDate: { lte: now } }, select: { classId: true, coveredDate: true } } },
        } }, orderBy: [{ gradeId: "asc" }, { subjectId: "asc" }],
      });
    const publication = currentPeriod && !error ? await db.timetablePublication.findFirst({ where: { schoolId, status: "ACTIVE" }, orderBy: { version: "desc" }, select: { lessons: { where: { schoolId }, select: { classId: true, subjectId: true, teacherId: true, teacherName: true } } } }) : null;
    const teachers = publication ? await db.teacher.findMany({ where: { schoolId, id: { in: [...new Set(publication.lessons.map((lesson) => lesson.teacherId))] } }, select: { id: true, status: true } }) : [];
    const rows = classes.flatMap((cls) => {
      if (selection.classId && cls.id !== selection.classId) return [];
      return subjects.filter((subject) => !selection.subjectId || subject.id === selection.subjectId).flatMap((subject) => {
        const matchingGuides = guides.filter((guide) => guide.subjectId === subject.id && (guide.gradeId === cls.gradeId || guide.topics.some((topic) => topic.progress.some((progress) => progress.classId === cls.id))));
        const needsCurrentGuide = publication?.lessons.some((lesson) => lesson.classId === cls.id && lesson.subjectId === subject.id) && !matchingGuides.some((guide) => guide.gradeId === cls.gradeId);
        const applicableGuides = needsCurrentGuide ? [...matchingGuides, undefined] : matchingGuides;
        return applicableGuides.map((guide) => {
        const historicalPlacement = guide !== undefined && guide.gradeId !== cls.gradeId;
        const recorded = guide?.topics.filter((topic) => topic.progress.some((progress) => progress.classId === cls.id)).length ?? 0;
        const assignments = historicalPlacement ? [] : [...new Map((publication?.lessons ?? []).filter((lesson) => lesson.classId === cls.id && lesson.subjectId === subject.id).map((lesson) => [lesson.teacherId, { name: lesson.teacherName, active: teachers.some((teacher) => teacher.id === lesson.teacherId && teacher.status === "ACTIVE") }])).values()];
        return { classId: cls.id, className: cls.name, subjectId: subject.id, subjectName: subject.name, guideId: guide?.id ?? null, guideStatus: guide?.status ?? null, guideGrade: guide?.grade.level ?? null, historicalPlacement, planned: guide?.topics.length ?? 0, recorded, gaps: guide?.topics.filter((topic) => !topic.progress.some((progress) => progress.classId === cls.id)).map((topic) => ({ id: topic.id, title: topic.title, weekNumber: topic.weekNumber, durationWeeks: topic.durationWeeks })) ?? [], assignments };
        });
      });
    });
    const view = selection.view ?? "coverage";
    const count = view === "guides" ? guides.length : rows.length;
    const pageCount = Math.max(1, Math.ceil(count / 25));
    const page = Math.min(selection.page ?? 1, pageCount);
    const offset = (page - 1) * 25;
    return { classes, subjects, years, year, term, currentPeriod, activePeriodAvailable: active !== undefined, publicationAvailable: publication !== null, error, selection, view, page, pageCount, count,
      guides: guides.slice(offset, offset + 25).map((guide) => ({ id: guide.id, subjectName: guide.subject.name, gradeName: guide.grade.level, status: guide.status, planned: guide.topics.length })), rows: error ? [] : rows.slice(offset, offset + 25),
      totals: { guides: guides.length, published: guides.filter((guide) => guide.status === "PUBLISHED").length, missing: rows.filter((row) => !row.guideId).length },
    };
  }, { isolationLevel: "RepeatableRead", timeout: 30000 });
}
