import { requirePageSession } from "@/src/lib/authz";
import prisma from "@/src/lib/prisma";
import Link from "next/link";
import { z } from "zod";
import { Search, ArrowRight } from "lucide-react";
import { listLiveTimetableLessons } from "@/src/lib/services/timetable";
import AdminCurriculum from "@/src/components/AdminCurriculum";

export const dynamic = "force-dynamic";
const id = z.string().regex(/^[1-9]\d*$/).transform(Number).pipe(z.number().int().safe());
const filters = z.object({ subject: id.optional(), grade: id.optional(), term: z.enum(["TERM_1", "TERM_2", "TERM_3"]).optional(), year: z.string().trim().min(1).max(20).optional() });

export default async function SyllabusListPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { userId, role, schoolId } = await requirePageSession(["admin", "teacher"]);
  const params = await searchParams;
  if (role === "admin") return <AdminCurriculum params={params} />;
  const parsed = filters.safeParse(Object.fromEntries(Object.entries(params).filter(([key, value]) => Object.hasOwn(filters.shape, key) && value !== "" && value !== undefined)));
  const selection = parsed.success ? parsed.data : {};
  const lessons = await listLiveTimetableLessons(schoolId, { teacherId: userId });
  const classes = await prisma.class.findMany({ where: { schoolId, id: { in: [...new Set(lessons.map((lesson) => lesson.classId))] } }, select: { id: true, gradeId: true } });
  const pairs = [...new Map(lessons.flatMap((lesson) => {
    const cls = classes.find((item) => item.id === lesson.classId);
    return cls ? [[`${lesson.subjectId}:${cls.gradeId}`, { subjectId: lesson.subjectId, gradeId: cls.gradeId }] as const] : [];
  })).values()];
  const pairWhere = pairs.length ? { OR: pairs } : { id: { in: [] as number[] } };
  const [guides, subjects, grades] = await Promise.all([
    prisma.syllabus.findMany({ where: { schoolId, status: "PUBLISHED", ...pairWhere, ...(selection.subject ? { subjectId: selection.subject } : {}), ...(selection.grade ? { gradeId: selection.grade } : {}), ...(selection.term ? { term: selection.term } : {}), ...(selection.year ? { academicYear: selection.year } : {}), ...(parsed.success ? {} : { id: -1 }) }, include: { subject: { select: { name: true } }, grade: { select: { level: true } }, _count: { select: { topics: true } } }, orderBy: [{ academicYear: "desc" }, { gradeId: "asc" }, { subjectId: "asc" }] }),
    prisma.subject.findMany({ where: { schoolId, id: { in: [...new Set(pairs.map((pair) => pair.subjectId))] } }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.grade.findMany({ where: { schoolId, id: { in: [...new Set(pairs.map((pair) => pair.gradeId))] } }, select: { id: true, level: true }, orderBy: { order: "asc" } }),
  ]);
  const periods = await prisma.syllabus.findMany({ where: { schoolId, status: "PUBLISHED", ...pairWhere }, select: { academicYear: true }, distinct: ["academicYear"], orderBy: { academicYear: "desc" } });
  const field = "mt-1 min-h-11 w-full min-w-0 rounded-lg border border-gray-300 bg-white px-3 text-sm font-semibold";
  return <main className="m-3 mt-0 min-w-0 flex-1 bg-white p-4 font-inter text-sm font-semibold text-gray-700 sm:m-4 sm:mt-0 sm:p-5">
    <header className="border-b border-gray-200 pb-4"><h1 className="text-xl font-black text-gray-950">Teaching guides</h1><p className="mt-2 font-medium leading-6 text-gray-600">Published guides for your timetable assignments.</p></header>
    <form action="/list/syllabus" className="grid grid-cols-1 gap-3 border-b border-gray-200 py-4 sm:grid-cols-2 xl:grid-cols-5">
      <label className="min-w-0 text-xs">Academic year<select className={field} name="year" defaultValue={selection.year ?? ""}><option value="">All years</option>{periods.map((period) => <option key={period.academicYear}>{period.academicYear}</option>)}</select></label>
      <label className="min-w-0 text-xs">Term<select className={field} name="term" defaultValue={selection.term ?? ""}><option value="">All terms</option>{["TERM_1", "TERM_2", "TERM_3"].map((term) => <option key={term} value={term}>{term.replace("TERM_", "Term ")}</option>)}</select></label>
      <label className="min-w-0 text-xs">Grade<select className={field} name="grade" defaultValue={selection.grade ?? ""}><option value="">All assigned grades</option>{grades.map((grade) => <option key={grade.id} value={grade.id}>{grade.level}</option>)}</select></label>
      <label className="min-w-0 text-xs">Subject<select className={field} name="subject" defaultValue={selection.subject ?? ""}><option value="">All assigned subjects</option>{subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select></label>
      <div className="flex items-end"><button className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-blue-900 px-3 text-xs font-black text-white"><Search size={16} />Review</button></div>
    </form>
    {!parsed.success && <p role="alert" className="py-4 text-amber-800">Some teaching guide filters are invalid.</p>}
    {guides.length === 0 && parsed.success && <p className="py-8 leading-6 text-gray-600">No published guides match this selection. Guides become available after curriculum preparation and timetable publication.</p>}
    <ul className="divide-y divide-gray-200">{guides.map((guide) => <li key={guide.id} className="flex min-w-0 flex-wrap items-center justify-between gap-3 py-4"><div className="min-w-0 flex-1"><h2 className="break-words font-black text-gray-950">{guide.grade.level} · {guide.subject.name}</h2><p className="mt-1 text-xs leading-5">{guide.academicYear} · {guide.term.replace("TERM_", "Term ")} · {guide._count.topics} planned topics</p></div><Link href={`/list/syllabus/${guide.id}`} className="inline-flex min-h-11 items-center gap-2 text-xs font-black text-blue-800">Open guide<ArrowRight size={14} /></Link></li>)}</ul>
  </main>;
}
