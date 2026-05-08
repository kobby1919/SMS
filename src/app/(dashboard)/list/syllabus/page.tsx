// src/app/(dashboard)/list/syllabus/page.tsx


import { redirect } from "next/navigation";
import { requirePageSession } from "@/src/lib/authz";
import prisma from "@/src/lib/prisma";
import Link from "next/link";
import {
  BookMarked, Plus, Edit, Trash2, Eye,
  CheckCircle2, Clock, Filter,
} from "lucide-react";
import { TERM_LABELS } from "@/src/lib/caGrades";
import SyllabusDeleteButton from "@/src/components/SyllabusDeleteButton";

export const dynamic = "force-dynamic";

const SyllabusListPage = async ({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) => {
  const { userId, role, schoolId } = await requirePageSession(["admin", "teacher"]);

  const sp            = await searchParams;
  const filterSubject = sp.subject ? parseInt(sp.subject) : undefined;
  const filterGrade   = sp.grade   ? parseInt(sp.grade)   : undefined;
  const filterTerm    = sp.term    as string | undefined;
  const filterYear    = sp.year    as string | undefined;
  const filterStatus  = sp.status  as string | undefined;

  // For teachers: only show syllabi for subjects they teach
  let teacherSubjectIds: number[] | undefined;
  if (role === "teacher") {
    const teacher = await prisma.teacher.findFirst({
      where:  { id: userId, schoolId },
      select: { subjects: { select: { id: true } } },
    });
    teacherSubjectIds = teacher?.subjects.map((s) => s.id) ?? [];
  }

  const where: any = { schoolId };
  if (filterSubject)             where.subjectId = filterSubject;
  if (filterGrade)               where.gradeId   = filterGrade;
  if (filterTerm)                where.term      = filterTerm;
  if (filterYear)                where.academicYear = filterYear;
  if (filterStatus)              where.status    = filterStatus;
  if (teacherSubjectIds)         where.subjectId = { in: teacherSubjectIds };

  const syllabi = await prisma.syllabus.findMany({
    where,
    include: {
      subject: { select: { name: true } },
      grade:   { select: { level: true, order: true } },
      topics: {
        select: {
          id: true,
          progress: { select: { classId: true } },
        },
      },
    },
    orderBy: [{ grade: { order: "asc" } }, { subject: { name: "asc" } }, { term: "asc" }],
  });

  const subjects = await prisma.subject.findMany({ where: { schoolId }, orderBy: { name: "asc" } });
  const grades   = await prisma.grade.findMany({ where: { schoolId }, orderBy: { order: "asc" } });
  const configs  = await prisma.cAConfig.findMany({ where: { schoolId }, orderBy: { academicYear: "desc" } });
  const years    = configs.map((c) => c.academicYear);

  const totalPublished = syllabi.filter((s) => s.status === "PUBLISHED").length;
  const totalDraft     = syllabi.filter((s) => s.status === "DRAFT").length;

  return (
    <div className="flex-1 m-4 mt-0 flex flex-col gap-4">

      {/* Header */}
      <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 bg-violet-50 rounded-2xl flex items-center justify-center shrink-0">
              <BookMarked size={20} className="text-violet-600" />
            </div>
            <div>
              <h1 className="text-xl font-black text-gray-800 tracking-tight">Syllabi</h1>
              <p className="text-sm text-gray-400 mt-0.5 font-medium">
                {syllabi.length} syllabi · {totalPublished} published · {totalDraft} draft
              </p>
            </div>
          </div>
          {role === "admin" && (
            <Link
              href="/list/syllabus/new"
              className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 text-white rounded-xl text-sm font-bold hover:bg-violet-700 transition-colors shadow-sm shrink-0"
            >
              <Plus size={16} /> New Syllabus
            </Link>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter size={13} className="text-gray-400" />
          <p className="text-xs font-black uppercase tracking-wider text-gray-400">Filters</p>
        </div>
        <form className="flex flex-wrap gap-2">
          <select name="subject" defaultValue={filterSubject ?? ""} className="appearance-none ring-[1.5px] ring-gray-200 px-3 py-2 rounded-xl text-sm font-semibold text-gray-600 outline-none bg-white">
            <option value="">All Subjects</option>
            {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select name="grade" defaultValue={filterGrade ?? ""} className="appearance-none ring-[1.5px] ring-gray-200 px-3 py-2 rounded-xl text-sm font-semibold text-gray-600 outline-none bg-white">
            <option value="">All Grades</option>
            {grades.map((g) => <option key={g.id} value={g.id}>{g.level}</option>)}
          </select>
          <select name="term" defaultValue={filterTerm ?? ""} className="appearance-none ring-[1.5px] ring-gray-200 px-3 py-2 rounded-xl text-sm font-semibold text-gray-600 outline-none bg-white">
            <option value="">All Terms</option>
            {Object.entries(TERM_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <select name="year" defaultValue={filterYear ?? ""} className="appearance-none ring-[1.5px] ring-gray-200 px-3 py-2 rounded-xl text-sm font-semibold text-gray-600 outline-none bg-white">
            <option value="">All Years</option>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <select name="status" defaultValue={filterStatus ?? ""} className="appearance-none ring-[1.5px] ring-gray-200 px-3 py-2 rounded-xl text-sm font-semibold text-gray-600 outline-none bg-white">
            <option value="">All Status</option>
            <option value="DRAFT">Draft</option>
            <option value="PUBLISHED">Published</option>
          </select>
          <button type="submit" className="px-4 py-2 bg-violet-600 text-white rounded-xl text-sm font-bold hover:bg-violet-700 transition-colors">
            Apply
          </button>
          <Link href="/list/syllabus" className="px-4 py-2 bg-gray-100 text-gray-600 rounded-xl text-sm font-bold hover:bg-gray-200 transition-colors">
            Clear
          </Link>
        </form>
      </div>

      {/* Grid */}
      {syllabi.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-16 text-center">
          <BookMarked size={32} className="text-gray-200 mx-auto mb-3" />
          <p className="text-sm font-bold text-gray-400">No syllabi found</p>
          {role === "admin" && (
            <Link href="/list/syllabus/new" className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-violet-600 hover:text-violet-700">
              <Plus size={13} /> Create your first syllabus
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {syllabi.map((s) => {
            const totalTopics    = s.topics.length;
            const coveredClasses = new Set(s.topics.flatMap((t) => t.progress.map((p) => p.classId))).size;
            const isPublished    = s.status === "PUBLISHED";

            return (
              <div key={s.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow group">
                {/* Top colour strip */}
                <div className={`h-1.5 w-full ${isPublished ? "bg-emerald-500" : "bg-amber-400"}`} />

                <div className="p-5">
                  {/* Status + term */}
                  <div className="flex items-center justify-between mb-3">
                    <span className={`flex items-center gap-1.5 text-[10px] font-black px-2.5 py-1 rounded-xl
                      ${isPublished ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                      {isPublished ? <CheckCircle2 size={10} /> : <Clock size={10} />}
                      {isPublished ? "Published" : "Draft"}
                    </span>
                    <span className="text-[10px] font-bold text-gray-400">
                      {TERM_LABELS[s.term]} · {s.academicYear}
                    </span>
                  </div>

                  {/* Subject + grade */}
                  <h2 className="text-base font-black text-gray-800 leading-tight">{s.subject.name}</h2>
                  <p className="text-sm text-violet-600 font-bold mt-0.5">{s.grade.level}</p>

                  {/* Description */}
                  {s.description && (
                    <p className="text-xs text-gray-400 mt-2 line-clamp-2 leading-relaxed">{s.description}</p>
                  )}

                  {/* Stats */}
                  <div className="flex items-center gap-4 mt-4 pt-3 border-t border-gray-100">
                    <div className="text-center">
                      <p className="text-lg font-black text-gray-800 leading-none">{totalTopics}</p>
                      <p className="text-[9px] font-bold text-gray-400 uppercase mt-0.5">Topics</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-black text-gray-800 leading-none">{coveredClasses}</p>
                      <p className="text-[9px] font-bold text-gray-400 uppercase mt-0.5">Classes Tracking</p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 ml-auto">
                      <Link
                        href={`/list/syllabus/${s.id}`}
                        className="w-8 h-8 flex items-center justify-center rounded-xl bg-violet-50 text-violet-600 hover:bg-violet-100 transition-colors"
                        title="View"
                      >
                        <Eye size={14} />
                      </Link>
                      {role === "admin" && (
                        <>
                          <Link
                            href={`/list/syllabus/${s.id}/edit`}
                            className="w-8 h-8 flex items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors"
                            title="Edit"
                          >
                            <Edit size={14} />
                          </Link>
                          <SyllabusDeleteButton id={s.id} name={`${s.subject.name} — ${s.grade.level}`} />
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default SyllabusListPage;