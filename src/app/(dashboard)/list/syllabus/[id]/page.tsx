import { requirePageSession } from "@/src/lib/authz";
import { notFound } from "next/navigation";
import prisma from "@/src/lib/prisma";
import Link from "next/link";
import { ArrowLeft, Edit, Download } from "lucide-react";
import SyllabusProgressCard from "@/src/components/SyllabusProgressCard";
import { listLiveTimetableLessons } from "@/src/lib/services/timetable";

export const dynamic = "force-dynamic";

export default async function SyllabusViewPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { userId, role, schoolId } = await requirePageSession(["admin", "teacher"]);
  const { id } = await params;
  if (!/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id))) notFound();
  const query = await searchParams;
  if (query.classId !== undefined && (typeof query.classId !== "string" || !/^[1-9]\d*$/.test(query.classId) || !Number.isSafeInteger(Number(query.classId)))) notFound();
  const selectedClassId = query.classId ? Number(query.classId) : undefined;
  const now = new Date();
  const syllabus = await prisma.syllabus.findFirst({
    where: { id: Number(id), schoolId, subject: { is: { schoolId } }, grade: { is: { schoolId } }, ...(role === "teacher" ? { status: "PUBLISHED" } : {}) },
    include: { subject: { select: { name: true } }, grade: { select: { level: true } }, topics: {
      orderBy: [{ weekNumber: "asc" }, { order: "asc" }, { id: "asc" }],
      include: { progress: { where: { schoolId, class: { is: { schoolId } }, teacher: { is: { schoolId } }, coveredDate: { lte: now } }, include: { class: { select: { name: true } }, teacher: { select: { name: true, surname: true } } } } },
    } },
  });
  if (!syllabus) notFound();
  const [lessons, activePeriod] = await Promise.all([
    listLiveTimetableLessons(schoolId, role === "teacher" ? { teacherId: userId } : {}),
    prisma.cAConfig.findFirst({ where: { schoolId, isActive: true }, orderBy: { updatedAt: "desc" }, select: { academicYear: true, currentTerm: true } }),
  ]);
  const currentPeriod = activePeriod?.academicYear === syllabus.academicYear && activePeriod.currentTerm === syllabus.term;
  const scopedLessons = lessons.filter((lesson) => lesson.subjectId === syllabus.subjectId);
  const recordedClassIds = [...new Set(syllabus.topics.flatMap((topic) => topic.progress.map((record) => record.classId)))];
  const gradeClasses = await prisma.class.findMany({ where: { schoolId, ...(role === "teacher" ? { gradeId: syllabus.gradeId, id: { in: [...new Set(scopedLessons.map((lesson) => lesson.classId))] } } : { OR: [{ gradeId: syllabus.gradeId }, { id: { in: recordedClassIds } }] }) }, select: { id: true, name: true, gradeId: true }, orderBy: { name: "asc" } });
  if (role === "teacher" && gradeClasses.length === 0) notFound();
  if (selectedClassId && !gradeClasses.some((cls) => cls.id === selectedClassId)) notFound();
  const classes = selectedClassId ? gradeClasses.filter((cls) => cls.id === selectedClassId) : gradeClasses;
  const visibleIds = new Set(classes.map((cls) => cls.id));
  const topics = syllabus.topics.map((topic) => ({ ...topic, progress: topic.progress.filter((record) => visibleIds.has(record.classId)) }));
  const hasHistory = syllabus.topics.some((topic) => topic.progress.length > 0);
  return <main className="m-3 mt-0 min-w-0 flex-1 bg-white p-4 font-inter text-sm font-semibold text-gray-700 sm:m-4 sm:mt-0 sm:p-5">
    <header className="border-b border-gray-200 pb-4"><Link href="/list/syllabus" className="inline-flex min-h-11 items-center gap-2 text-xs font-black text-blue-800"><ArrowLeft size={16} />{role === "admin" ? "Curriculum" : "Teaching guides"}</Link>
      <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0 flex-1"><h1 className="break-words text-xl font-black text-gray-950">{syllabus.subject.name}</h1><p className="mt-2 break-words text-xs leading-6">{syllabus.grade.level} · {syllabus.term.replace("TERM_", "Term ")} · {syllabus.academicYear} · {syllabus.status === "PUBLISHED" ? "Published" : "Draft"}</p></div><div className="flex flex-wrap gap-4">
        {role === "admin" && !hasHistory && <Link href={`/list/syllabus/${id}/edit`} className="inline-flex min-h-11 items-center gap-2 text-xs font-black text-blue-800"><Edit size={15} />Manage guide</Link>}
        <a href={`/api/syllabus/pdf?syllabusId=${id}`} className="inline-flex min-h-11 items-center gap-2 text-xs font-black text-blue-800"><Download size={15} />Download guide</a>
      </div></div>
      {syllabus.description && <p className="mt-3 whitespace-pre-wrap break-words text-xs leading-6 text-gray-600">{syllabus.description}</p>}
      {role === "admin" && hasHistory && <p className="mt-2 text-xs leading-5 text-gray-500">This teaching plan has recorded coverage and is preserved as history.</p>}
    </header>
    <section className="border-b border-gray-200 py-4"><h2 className="font-black text-gray-950">Teacher-recorded coverage</h2><p className="mt-1 text-xs leading-5 text-gray-500">Not independently verified. Topics without records are not proof of missed teaching. Planned weeks are not calendar deadlines.</p>
      {role === "teacher" && !currentPeriod && <p className="mt-2 text-xs text-amber-800">This is not the active school period. Coverage is read-only.</p>}
      <form action={`/list/syllabus/${id}`} className="mt-3 flex flex-wrap items-end gap-3"><label className="min-w-0 flex-1 text-xs">Class<select name="classId" defaultValue={selectedClassId ?? ""} className="mt-1 min-h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm font-semibold"><option value="">All available classes</option>{gradeClasses.map((cls) => <option key={cls.id} value={cls.id}>{cls.name}</option>)}</select></label><button className="min-h-11 rounded-lg bg-blue-900 px-4 text-xs font-black text-white">Review</button></form>
      <ul className="mt-3 divide-y divide-gray-100">{classes.map((cls) => {
        const covered = topics.filter((topic) => topic.progress.some((record) => record.classId === cls.id)).length;
        const names = currentPeriod && cls.gradeId === syllabus.gradeId ? [...new Set(scopedLessons.filter((lesson) => lesson.classId === cls.id).map((lesson) => `${lesson.teacher.name} ${lesson.teacher.surname}`.trim()))] : [];
        return <li key={cls.id} className="py-3"><p className="break-words font-black">{cls.name}</p><p className="mt-1 text-xs leading-5">{covered} / {topics.length} topics teacher-recorded · {topics.length - covered} without a coverage record</p><p className="mt-1 break-words text-xs text-gray-500">{names.length ? `Published timetable: ${names.join(", ")}` : currentPeriod ? "No published teacher assignment" : "Historical period; current assignments not attributed"}</p></li>;
      })}</ul>{classes.length === 0 && <p className="mt-3 text-xs">No classes are available at this grade.</p>}
    </section>
    <section className="py-4"><h2 className="font-black text-gray-950">Planned topics ({topics.length})</h2>{topics.length === 0 && <p className="py-4 text-gray-600">No topics have been prepared yet.</p>}
      <ol className="divide-y divide-gray-200">{topics.map((topic) => <li key={topic.id} className="py-4">
        <h3 className="break-words font-black text-gray-950">{topic.title}</h3><p className="mt-1 text-xs text-gray-500">Planned week {topic.weekNumber}{topic.durationWeeks > 1 ? `-${topic.weekNumber + topic.durationWeeks - 1}` : ""}</p>
        {(topic.subtopics.length > 0 || topic.objectives.length > 0 || topic.coreCompetencies.length > 0 || topic.teachingResources) && <details className="mt-2"><summary className="cursor-pointer py-2 text-xs text-blue-800">Teaching plan</summary><div className="space-y-3 border-l-2 border-gray-200 pl-3 text-xs leading-5">{[["Subtopics", topic.subtopics], ["Learning objectives", topic.objectives], ["Core competencies", topic.coreCompetencies]].map(([label, items]) => (items as string[]).length > 0 && <div key={label as string}><h4 className="font-black">{label}</h4><ul className="list-inside list-disc">{(items as string[]).map((item, index) => <li key={index} className="break-words">{item}</li>)}</ul></div>)}{topic.teachingResources && <p className="whitespace-pre-wrap break-words"><strong>Resources: </strong>{topic.teachingResources}</p>}</div></details>}
        {topic.progress.length > 0 ? <ul className="mt-2 space-y-2 text-xs leading-5">{topic.progress.map((record) => <li key={record.id} className="break-words"><p>{record.class.name} · Recorded by {record.teacher.name} {record.teacher.surname} · {record.coveredDate.toLocaleDateString("en-GH", { timeZone: "Africa/Accra" })}</p>{record.notes && <p className="whitespace-pre-wrap text-gray-500">{record.notes}</p>}</li>)}</ul> : <p className="mt-2 text-xs text-gray-500">No coverage record for this selection.</p>}
        {role === "teacher" && currentPeriod && <SyllabusProgressCard key={`${topic.id}:${topic.progress.map((record) => `${record.id}:${record.notes}`).join("|")}`} topicId={topic.id} topicTitle={topic.title} teacherClasses={classes.filter((cls) => !topic.progress.some((record) => record.classId === cls.id && record.teacherId !== userId))} coveredClassIds={topic.progress.map((record) => record.classId)} existingProgress={topic.progress.map((record) => ({ classId: record.classId, notes: record.notes ?? "", coveredDate: record.coveredDate.toISOString() }))} />}
      </li>)}</ol>
    </section>
  </main>;
}
