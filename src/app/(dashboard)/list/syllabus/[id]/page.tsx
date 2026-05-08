// src/app/(dashboard)/list/syllabus/[id]/page.tsx


import { requirePageSession } from "@/src/lib/authz";
import { notFound } from "next/navigation";
import prisma from "@/src/lib/prisma";
import Link from "next/link";
import {
  BookMarked, ArrowLeft, Edit, Download,
  CheckCircle2, Clock, ChevronRight, Users,
} from "lucide-react";
import { TERM_LABELS } from "@/src/lib/caGrades";
import SyllabusProgressCard from "@/src/components/SyllabusProgressCard";

export const dynamic = "force-dynamic";

const SyllabusViewPage = async ({
  params,
}: {
  params: Promise<{ id: string }>;
}) => {
  const { userId, role, schoolId } = await requirePageSession(["admin", "teacher"]);

  const { id } = await params;
  const syllabusId = parseInt(id);

  const syllabus = await prisma.syllabus.findFirst({
    where:   { id: syllabusId, schoolId },
    include: {
      subject: { select: { name: true } },
      grade:   { select: { level: true } },
      topics: {
        include: {
          progress: {
            include: {
              class:   { select: { id: true, name: true } },
              teacher: { select: { name: true, surname: true } },
            },
          },
        },
        orderBy: { order: "asc" },
      },
    },
  });

  if (!syllabus) notFound();

  // For teachers: find their supervised classes that match this grade
  let teacherClasses: { id: number; name: string }[] = [];
  if (role === "teacher") {
    teacherClasses = await prisma.class.findMany({
      where:  { schoolId, supervisorId: userId, gradeId: syllabus.gradeId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
  }

  // All classes at this grade level (for admin progress overview)
  const gradeClasses = await prisma.class.findMany({
    where:  { schoolId, gradeId: syllabus.gradeId },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const totalTopics = syllabus.topics.length;
  const isPublished = syllabus.status === "PUBLISHED";

  // Completion per class
  const classCompletion = gradeClasses.map((cls) => {
    const covered = syllabus.topics.filter((t) =>
      t.progress.some((p) => p.classId === cls.id)
    ).length;
    return { ...cls, covered, pct: totalTopics > 0 ? Math.round((covered / totalTopics) * 100) : 0 };
  });

  return (
    <div className="flex-1 m-4 mt-0 flex flex-col gap-4">

      {/* Header */}
      <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href="/list/syllabus" className="w-9 h-9 flex items-center justify-center rounded-xl bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors shrink-0">
              <ArrowLeft size={16} />
            </Link>
            <div className="w-11 h-11 bg-violet-50 rounded-2xl flex items-center justify-center shrink-0">
              <BookMarked size={20} className="text-violet-600" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-black text-gray-800 tracking-tight">{syllabus.subject.name}</h1>
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg
                  ${isPublished ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                  {isPublished ? "Published" : "Draft"}
                </span>
              </div>
              <p className="text-sm text-gray-400 mt-0.5 font-medium">
                {syllabus.grade.level} · {TERM_LABELS[syllabus.term]} · {syllabus.academicYear}
                {" · "}{totalTopics} topic{totalTopics !== 1 ? "s" : ""}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* PDF download */}
            <a
              href={`/api/syllabus/pdf?syllabusId=${syllabusId}`}
              target="_blank"
              className="flex items-center gap-2 px-4 py-2 bg-gray-800 text-white rounded-xl text-sm font-bold hover:bg-gray-900 transition-colors"
            >
              <Download size={14} /> Download PDF
            </a>
            {role === "admin" && (
              <Link
                href={`/list/syllabus/${syllabusId}/edit`}
                className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-xl text-sm font-bold hover:bg-violet-700 transition-colors"
              >
                <Edit size={14} /> Edit
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Description */}
      {syllabus.description && (
        <div className="bg-violet-50 border border-violet-100 rounded-2xl p-4">
          <p className="text-xs font-black uppercase tracking-wider text-violet-400 mb-1">Overview</p>
          <p className="text-sm text-violet-800 leading-relaxed">{syllabus.description}</p>
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-4">

        {/* Topics list */}
        <div className="flex-1 flex flex-col gap-3">
          {totalTopics === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
              <BookMarked size={28} className="text-gray-200 mx-auto mb-3" />
              <p className="text-sm font-bold text-gray-400">No topics yet</p>
              {role === "admin" && (
                <Link href={`/list/syllabus/${syllabusId}/edit`} className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-violet-600 hover:text-violet-700">
                  Add topics <ChevronRight size={12} />
                </Link>
              )}
            </div>
          ) : (
            syllabus.topics.map((topic, idx) => {
              const coveredClasses  = topic.progress.map((p) => p.class.name).join(", ");
              const coveredClassIds = new Set(topic.progress.map((p) => p.classId));

              return (
                <div key={topic.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  {/* Topic header */}
                  <div className="flex items-start gap-4 px-5 py-4 border-b border-gray-100">
                    <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center text-sm font-black text-violet-600 shrink-0">
                      W{topic.weekNumber}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-black text-gray-800">{topic.title}</p>
                        {topic.durationWeeks > 1 && (
                          <span className="text-[10px] font-bold px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-lg">
                            {topic.durationWeeks} weeks
                          </span>
                        )}
                      </div>
                      {coveredClasses && (
                        <p className="text-[10px] text-emerald-600 font-bold mt-0.5 flex items-center gap-1">
                          <CheckCircle2 size={9} /> Covered by: {coveredClasses}
                        </p>
                      )}
                    </div>

                    {/* Progress indicator */}
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0
                      ${coveredClassIds.size > 0 ? "bg-emerald-100" : "bg-gray-100"}`}>
                      {coveredClassIds.size > 0
                        ? <CheckCircle2 size={13} className="text-emerald-600" />
                        : <Clock size={13} className="text-gray-400" />}
                    </div>
                  </div>

                  <div className="px-5 py-4 flex flex-col gap-3">
                    {/* Subtopics */}
                    {topic.subtopics.length > 0 && (
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-wider text-gray-400 mb-2">Subtopics</p>
                        <div className="flex flex-wrap gap-1.5">
                          {topic.subtopics.map((st, i) => (
                            <span key={i} className="text-xs font-semibold px-2.5 py-1 bg-gray-50 border border-gray-100 text-gray-600 rounded-lg">
                              {st}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Objectives */}
                    {topic.objectives.length > 0 && (
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-wider text-gray-400 mb-2">Learning Objectives</p>
                        <ul className="flex flex-col gap-1">
                          {topic.objectives.map((obj, i) => (
                            <li key={i} className="flex items-start gap-2 text-xs text-gray-600">
                              <span className="w-4 h-4 rounded-full bg-violet-50 text-violet-600 flex items-center justify-center text-[9px] font-black shrink-0 mt-0.5">
                                {i + 1}
                              </span>
                              {obj}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Core competencies */}
                    {topic.coreCompetencies.length > 0 && (
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-wider text-gray-400 mb-2">Core Competencies</p>
                        <div className="flex flex-wrap gap-1.5">
                          {topic.coreCompetencies.map((cc, i) => (
                            <span key={i} className="text-[10px] font-bold px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-lg border border-indigo-100">
                              {cc}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Teaching resources */}
                    {topic.teachingResources && (
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-wider text-gray-400 mb-1">Teaching Resources</p>
                        <p className="text-xs text-gray-500 leading-relaxed">{topic.teachingResources}</p>
                      </div>
                    )}

                    {/* Progress marking (teacher with supervised class at this grade) */}
                    {(role === "teacher" && teacherClasses.length > 0) && (
                      <SyllabusProgressCard
                        topicId={topic.id}
                        topicTitle={topic.title}
                        teacherClasses={teacherClasses}
                        coveredClassIds={[...coveredClassIds]}
                        existingProgress={topic.progress.map((p) => ({
                          classId: p.classId,
                          notes:   p.notes ?? "",
                          coveredDate: p.coveredDate.toISOString(),
                        }))}
                      />
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Right sidebar — class progress overview */}
        {gradeClasses.length > 0 && totalTopics > 0 && (
          <div className="w-full lg:w-64 shrink-0">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden sticky top-4">
              <div className="px-4 py-3.5 border-b border-gray-100 flex items-center gap-2">
                <Users size={14} className="text-gray-400" />
                <p className="text-xs font-black uppercase tracking-wider text-gray-400">Class Progress</p>
              </div>
              <div className="divide-y divide-gray-50">
                {classCompletion.map((cls) => (
                  <div key={cls.id} className="px-4 py-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-sm font-bold text-gray-700">{cls.name}</p>
                      <span className={`text-[10px] font-black ${cls.pct === 100 ? "text-emerald-600" : "text-gray-400"}`}>
                        {cls.pct}%
                      </span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${cls.pct === 100 ? "bg-emerald-500" : "bg-violet-400"}`}
                        style={{ width: `${cls.pct}%` }}
                      />
                    </div>
                    <p className="text-[9px] text-gray-400 mt-1">{cls.covered}/{totalTopics} topics</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SyllabusViewPage;
