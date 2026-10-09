import "server-only";
import { z } from "zod";
import prisma from "@/src/lib/prisma";
import { requireRole } from "@/src/lib/authz";

const days = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"] as const;
const filters = z.object({
  classId: z.string().regex(/^[1-9]\d*$/).transform(Number).pipe(z.number().int().safe()).optional(),
  teacherId: z.string().trim().min(1).max(200).optional(),
  day: z.enum(days).optional(),
  search: z.string().trim().max(100).optional(),
  page: z.string().regex(/^[1-9]\d*$/).transform(Number).pipe(z.number().int().max(100000)).optional(),
});

export async function getAdminPublishedSchedule(params: Record<string, string | string[] | undefined>) {
  const { schoolId } = await requireRole(["admin"]);
  const parsed = filters.safeParse(Object.fromEntries(Object.entries(params).filter(([key, value]) => Object.hasOwn(filters.shape, key) && value !== "" && value !== undefined)));
  return prisma.$transaction(async (db) => {
    const publication = await db.timetablePublication.findFirst({
      where: { schoolId, status: "ACTIVE" }, orderBy: [{ publishedAt: "desc" }, { version: "desc" }],
      select: { id: true, version: true, publishedAt: true, lessons: { where: { schoolId }, orderBy: [{ startTime: "asc" }, { sourceId: "asc" }] } },
    });
    const classes = await db.class.findMany({ where: { schoolId }, select: { id: true, name: true, _count: { select: { students: { where: { schoolId, status: "ACTIVE" } } } } }, orderBy: { name: "asc" } });
    const lessons = publication?.lessons ?? [];
    const teachers = [...new Map(lessons.map((lesson) => [lesson.teacherId, { id: lesson.teacherId, name: lesson.teacherName }])).values()].sort((a, b) => a.name.localeCompare(b.name));
    const currentTeachers = await db.teacher.findMany({ where: { schoolId, id: { in: teachers.map((teacher) => teacher.id) } }, select: { id: true, status: true } });
    const unavailableTeachers = teachers.filter((teacher) => !currentTeachers.some((item) => item.id === teacher.id && item.status === "ACTIVE"));
    const uncoveredClasses = classes.filter((cls) => cls._count.students > 0 && !lessons.some((lesson) => lesson.classId === cls.id));
    let error: string | null = parsed.success ? null : "Some schedule filters are invalid.";
    const selection = parsed.success ? parsed.data : {};
    if (selection.classId && !classes.some((cls) => cls.id === selection.classId)) error = "This class is not available in your school.";
    if (selection.teacherId && !teachers.some((teacher) => teacher.id === selection.teacherId)) error = "This teacher is not part of the published schedule.";
    const search = selection.search?.toLocaleLowerCase() ?? "";
    const matches = error ? [] : lessons.filter((lesson) =>
      (!selection.classId || lesson.classId === selection.classId) &&
      (!selection.teacherId || lesson.teacherId === selection.teacherId) &&
      (!selection.day || lesson.day === selection.day) &&
      (!search || `${lesson.className} ${lesson.subjectName} ${lesson.teacherName} ${lesson.name}`.toLocaleLowerCase().includes(search)),
    ).sort((a, b) => days.indexOf(a.day) - days.indexOf(b.day) || a.startTime.getTime() - b.startTime.getTime() || a.sourceId - b.sourceId);
    const pageCount = Math.max(1, Math.ceil(matches.length / 30));
    const page = Math.min(selection.page ?? 1, pageCount);
    return { publication, classes, teachers, unavailableTeachers, uncoveredClasses, days, selection, error, totalLessons: lessons.length, count: matches.length, page, pageCount, lessons: matches.slice((page - 1) * 30, page * 30) };
  }, { isolationLevel: "RepeatableRead", timeout: 15000 });
}
