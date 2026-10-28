// src/app/(dashboard)/list/syllabus/[id]/edit/page.tsx

import { requirePageSession } from "@/src/lib/authz";
import { notFound } from "next/navigation";
import prisma from "@/src/lib/prisma";
import Link from "next/link";
import { ArrowLeft, BookMarked, Eye } from "lucide-react";
import { TERM_LABELS } from "@/src/lib/caGrades";
import SyllabusTopicEditor from "@/src/components/SyllabusTopicEditor";
export const dynamic = "force-dynamic";

const SyllabusEditPage = async ({
  params,
}: {
  params: Promise<{ id: string }>;
}) => {
  const { schoolId } = await requirePageSession(["admin"]);

  const { id } = await params;
  if (!/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id))) notFound();
  const syllabusId = Number(id);

  const syllabus = await prisma.syllabus.findFirst({
    where:   { id: syllabusId, schoolId },
    include: {
      subject: { select: { name: true } },
      grade:   { select: { level: true } },
      topics: {
        orderBy: { order: "asc" },
        select: {
          id: true, weekNumber: true, durationWeeks: true,
          order: true, title: true, subtopics: true,
          objectives: true, coreCompetencies: true, teachingResources: true,
        },
      },
    },
  });

  if (!syllabus) notFound();
  const historyCount = await prisma.syllabusTopicProgress.count({ where: { syllabusTopic: { is: { syllabusId } } } });
  if (historyCount > 0) return <main className="m-3 min-w-0 bg-white p-4 font-inter sm:m-4 sm:p-5"><h1 className="text-xl font-black text-gray-950">Teaching guide preserved</h1><p className="mt-3 text-sm font-semibold leading-6 text-gray-600">This plan has recorded coverage. Its topics cannot be rewritten or removed.</p><Link className="mt-4 inline-flex min-h-11 items-center gap-2 text-xs font-black text-blue-800" href={`/list/syllabus/${syllabusId}`}><Eye size={14} />Review guide and coverage</Link></main>;

  return (
    <div className="flex-1 m-4 mt-0 flex flex-col gap-4">

      {/* Header */}
      <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href={`/list/syllabus/${syllabusId}`} className="w-9 h-9 flex items-center justify-center rounded-xl bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors shrink-0">
              <ArrowLeft size={16} />
            </Link>
            <div className="w-11 h-11 bg-violet-50 rounded-2xl flex items-center justify-center shrink-0">
              <BookMarked size={20} className="text-violet-600" />
            </div>
            <div>
              <h1 className="text-xl font-black text-gray-800 tracking-tight">
                Editing: {syllabus.subject.name}
              </h1>
              <p className="text-sm text-gray-400 mt-0.5 font-medium">
                {syllabus.grade.level} · {TERM_LABELS[syllabus.term]} · {syllabus.academicYear}
              </p>
            </div>
          </div>
          <Link
            href={`/list/syllabus/${syllabusId}`}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-600 rounded-xl text-sm font-bold hover:bg-gray-200 transition-colors shrink-0"
          >
            <Eye size={14} /> Preview
          </Link>
        </div>
      </div>

      {/* Topic editor (full client component) */}
      <SyllabusTopicEditor
        syllabusId={syllabusId}
        syllabusStatus={syllabus.status}
        initialTopics={syllabus.topics.map((t) => ({
          id:                t.id,
          weekNumber:        t.weekNumber,
          durationWeeks:     t.durationWeeks,
          order:             t.order,
          title:             t.title,
          subtopics:         t.subtopics,
          objectives:        t.objectives,
          coreCompetencies:  t.coreCompetencies,
          teachingResources: t.teachingResources ?? "",
        }))}
      />
    </div>
  );
};

export default SyllabusEditPage;
