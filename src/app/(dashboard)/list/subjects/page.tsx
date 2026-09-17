// src/app/(dashboard)/list/subjects/page.tsx

import Pagination from "@/src/components/pagination";
import { requirePageSession } from "@/src/lib/authz";
import TableSearch from "@/src/components/TableSearch";
import FormModal from "@/src/components/FormModal";
import { Prisma } from "@/src/generated/prisma";
import prisma from "@/src/lib/prisma";
import { ITEM_PER_PAGE } from "@/src/lib/settings";
import { listLiveTimetableLessons } from "@/src/lib/services/timetable";
import { BookOpen, CheckCircle2, Clock3, Users } from "lucide-react";

const subjectColors = [
  "bg-blue-50 text-blue-700 border-blue-100",
  "bg-amber-50 text-amber-700 border-amber-100",
  "bg-emerald-50 text-emerald-700 border-emerald-100",
  "bg-violet-50 text-violet-700 border-violet-100",
  "bg-rose-50 text-rose-700 border-rose-100",
  "bg-cyan-50 text-cyan-700 border-cyan-100",
];

const SubjectListPage = async ({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) => {
  const { role, schoolId } = await requirePageSession();

  const { page, ...queryParams } = await searchParams;
  const p = page ? parseInt(page) : 1;

  const query: Prisma.SubjectWhereInput = { schoolId };

  if (queryParams) {
    for (const [key, value] of Object.entries(queryParams)) {
      if (value !== undefined) {
        switch (key) {
          case "search":
            query.name = { contains: value, mode: "insensitive" };
            break;
        }
      }
    }
  }

  const [subjects, count, liveLessons] = await Promise.all([
    prisma.subject.findMany({
      where: query,
      include: {
        teachers: { where: { status: "ACTIVE" }, select: { id: true, name: true, surname: true } },
        _count: {
          select: {
            lessons: true,
            caBuckets: true,
            caActivities: true,
            continuousAssessments: true,
            syllabi: true,
          },
        },
      },
      orderBy: { name: "asc" },
      take: ITEM_PER_PAGE,
      skip: ITEM_PER_PAGE * (p - 1),
    }),
    prisma.subject.count({ where: query }),
    listLiveTimetableLessons(schoolId),
  ]);

  const liveLessonCountBySubjectId = new Map<number, number>();
  for (const lesson of liveLessons) {
    liveLessonCountBySubjectId.set(
      lesson.subjectId,
      (liveLessonCountBySubjectId.get(lesson.subjectId) ?? 0) + 1,
    );
  }

  const capableTeacherIds = new Set(subjects.flatMap((subject) => subject.teachers.map((teacher) => teacher.id)));
  const readySubjects = subjects.filter((subject) => subject.teachers.length > 0).length;
  const subjectsNeedingTeachers = subjects.filter((subject) => subject.teachers.length === 0).length;

  return (
    <div className="flex-1 m-4 mt-0 flex flex-col gap-4">
      <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-3xl">
            <h1 className="text-xl font-black tracking-tight text-gray-900">Subjects</h1>
            <p className="mt-1 text-sm font-medium leading-6 text-gray-500">
              Define the school curriculum and declare which active teachers are allowed to teach each subject. This is teacher capability; the published timetable decides where those teachers actually teach.
            </p>
          </div>
          <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center lg:w-auto">
            <TableSearch />
            {role === "admin" && <FormModal table="subject" type="create" />}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Curriculum subjects", value: count, icon: BookOpen, tone: "bg-indigo-50 text-indigo-700" },
          { label: "Ready for timetable", value: readySubjects, icon: CheckCircle2, tone: "bg-emerald-50 text-emerald-700" },
          { label: "Capable teachers", value: capableTeacherIds.size, icon: Users, tone: "bg-violet-50 text-violet-700" },
          { label: "Need teacher setup", value: subjectsNeedingTeachers, icon: Clock3, tone: "bg-amber-50 text-amber-700" },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${stat.tone}`}>
                  <Icon size={17} />
                </span>
                <div className="min-w-0">
                  <p className="text-2xl font-black leading-none text-gray-900">{stat.value}</p>
                  <p className="mt-1 text-xs font-bold uppercase tracking-wide text-gray-400">{stat.label}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm font-semibold leading-6 text-amber-800">
        Draft timetable slots and empty CA buckets are setup work. They become operational only after timetable publishing or score/activity records exist. A subject is protected from deletion only when it has published timetable usage, CA activity/report records, or syllabus records.
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-4 py-3 sm:px-5">
          <h2 className="text-sm font-black uppercase tracking-wide text-gray-500">Subject capability list</h2>
        </div>

        <div className="divide-y divide-gray-100">
          {subjects.map((subject, index) => {
            const liveLessonCount = liveLessonCountBySubjectId.get(subject.id) ?? 0;
            const caSetupCount = subject._count.caBuckets;
            const academicRecordCount =
              subject._count.caActivities +
              subject._count.continuousAssessments +
              subject._count.syllabi;
            const protectedUsageCount = liveLessonCount + academicRecordCount;
            const draftLessonCount = subject._count.lessons;
            const color = subjectColors[index % subjectColors.length];
            const statusLabel = subject.teachers.length === 0 ? "Needs teacher" : liveLessonCount > 0 ? "Live" : "Setup ready";
            const statusClass = subject.teachers.length === 0
              ? "bg-amber-50 text-amber-700"
              : liveLessonCount > 0
                ? "bg-emerald-50 text-emerald-700"
                : "bg-indigo-50 text-indigo-700";

            return (
              <div key={subject.id} className="p-4 sm:p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full border px-2.5 py-1 text-xs font-black ${color}`}>
                        {subject.name}
                      </span>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-black ${statusClass}`}>
                        {statusLabel}
                      </span>
                      {protectedUsageCount > 0 && (
                        <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-black text-gray-600">
                          Protected
                        </span>
                      )}
                    </div>

                    <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
                      <div>
                        <p className="text-xs font-black uppercase tracking-wide text-gray-400">Capable teachers</p>
                        <p className="mt-1 font-bold text-gray-800">{subject.teachers.length}</p>
                      </div>
                      <div>
                        <p className="text-xs font-black uppercase tracking-wide text-gray-400">Published lessons</p>
                        <p className="mt-1 font-bold text-gray-800">{liveLessonCount}</p>
                      </div>
                      <div>
                        <p className="text-xs font-black uppercase tracking-wide text-gray-400">Draft slots</p>
                        <p className="mt-1 font-bold text-gray-800">{draftLessonCount}</p>
                      </div>
                      <div>
                        <p className="text-xs font-black uppercase tracking-wide text-gray-400">CA setup</p>
                        <p className="mt-1 font-bold text-gray-800">{caSetupCount}</p>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {subject.teachers.length > 0 ? (
                        subject.teachers.map((teacher) => (
                          <span key={teacher.id} className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-bold text-gray-600">
                            {teacher.name} {teacher.surname}
                          </span>
                        ))
                      ) : (
                        <span className="rounded-full bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-600">
                          No active teacher capability set
                        </span>
                      )}
                    </div>
                  </div>

                  {role === "admin" && (
                    <div className="flex shrink-0 items-center justify-end gap-2 lg:pt-1">
                      <FormModal table="subject" type="update" data={subject} />
                      {protectedUsageCount === 0 && <FormModal table="subject" type="delete" id={subject.id} />}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {subjects.length === 0 && (
            <div className="px-4 py-12 text-center sm:px-5">
              <p className="text-sm font-bold text-gray-500">No subjects found.</p>
              <p className="mt-1 text-xs font-semibold text-gray-400">Create subjects first, then declare teacher capability before building the timetable.</p>
            </div>
          )}
        </div>

        <div className="border-t border-gray-100">
          <Pagination page={p} count={count} />
        </div>
      </div>
    </div>
  );
};

export default SubjectListPage;

