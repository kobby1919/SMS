// src/app/(dashboard)/list/syllabus/[id]/page.tsx


import { requirePageSession } from "@/src/lib/authz";
import { notFound } from "next/navigation";
import prisma from "@/src/lib/prisma";
import Link from "next/link";
import {
  BookMarked, ArrowLeft, Edit, Download,
  CheckCircle2, Clock, ChevronRight, Users, BookOpenCheck, Target,
} from "lucide-react";
import { TERM_LABELS } from "@/src/lib/caGrades";
import SyllabusProgressCard from "@/src/components/SyllabusProgressCard";

export const dynamic = "force-dynamic";

function startMonthForTerm(term: string) {
  if (term === "TERM_1") return 8;
  if (term === "TERM_2") return 0;
  return 4;
}

function currentSyllabusWeek(term: string, academicYear: string) {
  const startYear = Number.parseInt(academicYear.split("/")[0], 10);
  const now = new Date();
  const fallbackYear = Number.isFinite(startYear) ? startYear : now.getFullYear();
  const termStart = new Date(fallbackYear, startMonthForTerm(term), 1);
  const diffMs = now.getTime() - termStart.getTime();
  const week = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000)) + 1;
  return Math.max(1, Math.min(16, week));
}

function topicEndWeek(topic: { weekNumber: number; durationWeeks: number }) {
  return topic.weekNumber + topic.durationWeeks - 1;
}

function progressTone(status: string) {
  if (status === "Completed") return "bg-emerald-50 text-emerald-700 border-emerald-100";
  if (status === "Behind") return "bg-amber-50 text-amber-700 border-amber-100";
  if (status === "Ahead") return "bg-indigo-50 text-indigo-700 border-indigo-100";
  return "bg-sky-50 text-sky-700 border-sky-100";
}

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

  // For teachers: find timetable classes where they teach this syllabus subject.
  let teacherClasses: { id: number; name: string }[] = [];
  if (role === "teacher") {
    teacherClasses = await prisma.class.findMany({
      where:  {
        schoolId,
        gradeId: syllabus.gradeId,
        lessons: {
          some: {
            teacherId: userId,
            subjectId: syllabus.subjectId,
          },
        },
      },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });

    if (teacherClasses.length === 0) notFound();
  }

  // All classes at this grade level (for admin progress overview)
  const gradeClasses =
    role === "teacher"
      ? teacherClasses
      : await prisma.class.findMany({
          where:  { schoolId, gradeId: syllabus.gradeId },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        });

  const totalTopics = syllabus.topics.length;
  const isPublished = syllabus.status === "PUBLISHED";

  // Completion per class
  const classCompletion = gradeClasses.map((cls) => {
    const coveredTopicIds = new Set(
      syllabus.topics
        .filter((topic) => topic.progress.some((p) => p.classId === cls.id))
        .map((topic) => topic.id),
    );
    const covered = coveredTopicIds.size;
    const expectedThroughCurrentWeek = syllabus.topics.filter((topic) => topic.weekNumber <= currentSyllabusWeek(syllabus.term, syllabus.academicYear)).length;
    const overdue = syllabus.topics.filter((topic) => topicEndWeek(topic) < currentSyllabusWeek(syllabus.term, syllabus.academicYear) && !coveredTopicIds.has(topic.id)).length;
    const status =
      totalTopics === 0 ? "No topics" :
      covered >= totalTopics ? "Completed" :
      overdue > 0 ? "Behind" :
      covered > expectedThroughCurrentWeek ? "Ahead" :
      "On track";

    return {
      ...cls,
      covered,
      overdue,
      status,
      pct: totalTopics > 0 ? Math.round((covered / totalTopics) * 100) : 0,
    };
  });

  const syllabusWeek = currentSyllabusWeek(syllabus.term, syllabus.academicYear);
  const currentWeekTopics = syllabus.topics.filter((topic) => {
    const endWeek = topicEndWeek(topic);
    return topic.weekNumber <= syllabusWeek && endWeek >= syllabusWeek;
  });
  const expectedThroughCurrentWeek = syllabus.topics.filter((topic) => topic.weekNumber <= syllabusWeek).length;
  const teacherClassInsights = teacherClasses.map((cls) => {
    const coveredTopicIds = new Set(
      syllabus.topics
        .filter((topic) => topic.progress.some((p) => p.classId === cls.id))
        .map((topic) => topic.id),
    );
    const coveredCount = coveredTopicIds.size;
    const overdueTopics = syllabus.topics.filter((topic) => topicEndWeek(topic) < syllabusWeek && !coveredTopicIds.has(topic.id));
    const dueNowTopics = currentWeekTopics.filter((topic) => !coveredTopicIds.has(topic.id));
    const nextTopic = syllabus.topics.find((topic) => !coveredTopicIds.has(topic.id)) ?? null;
    const status =
      totalTopics === 0 ? "No topics" :
      coveredCount >= totalTopics ? "Completed" :
      overdueTopics.length > 0 ? "Behind" :
      coveredCount > expectedThroughCurrentWeek ? "Ahead" :
      "On track";

    return {
      ...cls,
      coveredCount,
      overdueCount: overdueTopics.length,
      dueNowCount: dueNowTopics.length,
      nextTopic,
      status,
      progressPct: totalTopics > 0 ? Math.round((coveredCount / totalTopics) * 100) : 0,
    };
  });
  const teacherProgressPct =
    teacherClassInsights.length > 0
      ? Math.round(teacherClassInsights.reduce((sum, item) => sum + item.progressPct, 0) / teacherClassInsights.length)
      : 0;
  const teacherCoveredCount = teacherClassInsights.reduce((sum, item) => sum + item.coveredCount, 0);
  const teacherTotalClassTopics = teacherClassInsights.length * totalTopics;
  const teacherUrgentInsight =
    teacherClassInsights.find((item) => item.status === "Behind") ??
    teacherClassInsights.find((item) => item.status === "On track") ??
    teacherClassInsights.find((item) => item.status === "Ahead") ??
    teacherClassInsights[0] ??
    null;
  const teacherPace = teacherUrgentInsight?.status ?? "No topics";
  const teacherPaceClass = progressTone(teacherPace);

  return (
    <div className="flex-1 m-3 mt-0 flex flex-col gap-4 sm:m-4 sm:mt-0">

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

          <div className="grid w-full grid-cols-1 gap-2 sm:flex sm:w-auto sm:shrink-0 sm:items-center">
            {/* PDF download */}
            <a
              href={`/api/syllabus/pdf?syllabusId=${syllabusId}`}
              target="_blank"
              className="flex items-center justify-center gap-2 rounded-xl bg-gray-800 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-gray-900"
            >
              <Download size={14} /> Download PDF
            </a>
            {role === "admin" && (
              <Link
                href={`/list/syllabus/${syllabusId}/edit`}
                className="flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-violet-700"
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

      {role === "teacher" && (
        <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">This Week</p>
                <h2 className="mt-1 text-lg font-black text-gray-900">
                  Week {syllabusWeek} Teaching Focus
                </h2>
                <p className="mt-1 text-sm font-semibold text-gray-500">
                  {teacherClasses.map((cls) => cls.name).join(", ")} · {syllabus.subject.name}
                </p>
              </div>
              <span className={`w-fit rounded-xl border px-3 py-1.5 text-xs font-black ${teacherPaceClass}`}>
                {teacherPace}
              </span>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-2xl font-black text-slate-900">{teacherProgressPct}%</p>
                <p className="mt-1 text-[10px] font-black uppercase text-slate-400">Covered</p>
              </div>
              <div className="rounded-xl bg-emerald-50 p-4">
                <p className="text-2xl font-black text-emerald-700">
                  {teacherCoveredCount}/{teacherTotalClassTopics || totalTopics}
                </p>
                <p className="mt-1 text-[10px] font-black uppercase text-emerald-500">Topics done</p>
              </div>
              <div className="rounded-xl bg-violet-50 p-4">
                <p className="text-2xl font-black text-violet-700">{currentWeekTopics.length || 0}</p>
                <p className="mt-1 text-[10px] font-black uppercase text-violet-500">Due now</p>
              </div>
            </div>

            <div className="mt-5 h-2 overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full rounded-full bg-emerald-500"
                style={{ width: `${teacherProgressPct}%` }}
              />
            </div>

            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              {teacherClassInsights.map((item) => (
                <div key={item.id} className="rounded-xl border border-gray-100 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-black text-gray-900">{item.name}</p>
                      <p className="mt-0.5 text-[10px] font-bold text-gray-400">
                        {item.coveredCount}/{totalTopics} covered
                        {item.overdueCount > 0 ? ` · ${item.overdueCount} overdue` : ""}
                      </p>
                    </div>
                    <span className={`rounded-lg border px-2 py-1 text-[10px] font-black ${progressTone(item.status)}`}>
                      {item.status}
                    </span>
                  </div>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-gray-100">
                    <div className="h-full rounded-full bg-emerald-500" style={{ width: `${item.progressPct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <BookOpenCheck size={16} className="text-violet-600" />
              <p className="text-sm font-black text-gray-900">
                {teacherUrgentInsight?.nextTopic ? "Next Topic To Cover" : "Teaching Guide Complete"}
              </p>
            </div>
            {teacherUrgentInsight?.nextTopic ? (
              <div className="mt-4">
                <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">
                  {teacherUrgentInsight.name} · Week {teacherUrgentInsight.nextTopic.weekNumber}
                </p>
                <h3 className="mt-1 text-base font-black text-gray-900">{teacherUrgentInsight.nextTopic.title}</h3>
                {teacherUrgentInsight.nextTopic.objectives.length > 0 && (
                  <div className="mt-3 rounded-xl bg-gray-50 p-3">
                    <div className="mb-2 flex items-center gap-2">
                      <Target size={13} className="text-gray-400" />
                      <p className="text-[10px] font-black uppercase text-gray-400">Main objective</p>
                    </div>
                    <p className="text-xs font-semibold leading-relaxed text-gray-600">
                      {teacherUrgentInsight.nextTopic.objectives[0]}
                    </p>
                  </div>
                )}
                {teacherUrgentInsight.overdueCount > 0 && (
                  <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700">
                    {teacherUrgentInsight.overdueCount} earlier topic{teacherUrgentInsight.overdueCount !== 1 ? "s are" : " is"} still pending for this class.
                  </p>
                )}
              </div>
            ) : (
              <p className="mt-3 text-sm font-semibold leading-relaxed text-gray-500">
                All topics in this syllabus have been marked as covered for your timetable classes.
              </p>
            )}
          </div>
        </section>
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
            syllabus.topics.map((topic) => {
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

                    {/* Progress marking (teacher with timetable classes at this grade/subject) */}
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
                    <span className={`mt-2 inline-flex rounded-lg border px-2 py-1 text-[9px] font-black ${progressTone(cls.status)}`}>
                      {cls.status}{cls.overdue > 0 ? ` · ${cls.overdue} overdue` : ""}
                    </span>
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
