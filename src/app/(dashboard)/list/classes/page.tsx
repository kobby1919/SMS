// src/app/(dashboard)/list/classes/page.tsx

import Pagination from "@/src/components/pagination";
import { requirePageSession } from "@/src/lib/authz";
import TableSearch from "@/src/components/TableSearch";
import Link from "next/link";
import { BookOpen, FileText, GraduationCap, LayoutGrid, Users } from "lucide-react";
import FormModal from "@/src/components/FormModal";
import { getClassesPage } from "@/src/lib/services/classes";
import { getTeacherScope } from "@/src/lib/services/teacher-scope";
import { listLiveTimetableLessons } from "@/src/lib/services/timetable";

const ClassListPage = async ({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) => {
  const { userId, role, schoolId } = await requirePageSession();

  const { page, ...queryParams } = await searchParams;
  const parsedPage = page ? parseInt(page) : 1;
  const p = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;

  const teacherScope = role === "teacher"
    ? await getTeacherScope({ schoolId, teacherId: userId })
    : null;
  const accessibleClassIds = teacherScope?.accessibleClassIds ?? [];
  const [{ classes, count }, liveLessons] = await Promise.all([
    getClassesPage(schoolId, p, {
      search: queryParams.search,
      supervisorId: role === "admin" ? queryParams.supervisorId : undefined,
      classIds: role === "teacher" ? accessibleClassIds : undefined,
    }),
    listLiveTimetableLessons(schoolId),
  ]);
  const supervisedClassIds = new Set(teacherScope?.supervisedClassIds ?? []);
  const taughtClassIds = new Set(teacherScope?.taughtClassIds ?? []);

  const liveLessonCountByClassId = new Map<number, number>();
  const liveTeacherCountByClassId = new Map<number, Set<string>>();
  for (const lesson of liveLessons) {
    liveLessonCountByClassId.set(
      lesson.classId,
      (liveLessonCountByClassId.get(lesson.classId) ?? 0) + 1,
    );
    const teachers = liveTeacherCountByClassId.get(lesson.classId) ?? new Set<string>();
    teachers.add(lesson.teacherId);
    liveTeacherCountByClassId.set(lesson.classId, teachers);
  }

  const totalStudents = classes.reduce((sum, item) => sum + item._count.students, 0);
  const classesWithClassTeacher = classes.filter((item) => item.supervisorId).length;
  const classesWithPublishedTimetable = classes.filter((item) => (liveLessonCountByClassId.get(item.id) ?? 0) > 0).length;
  const classesNeedingSetup = classes.filter((item) => !item.supervisorId || (liveLessonCountByClassId.get(item.id) ?? 0) === 0).length;

  return (
    <div className="flex-1 m-4 mt-0 flex flex-col gap-4">
      <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-3xl">
            <h1 className="text-xl font-black tracking-tight text-gray-900">
              {role === "teacher" ? "My Classes" : "Classes"}
            </h1>
            <p className="mt-1 text-sm font-medium leading-6 text-gray-500">
              {role === "teacher"
                ? "See the classes you supervise or teach from the published timetable."
                : "Set up class groups, assign one class teacher, and check whether each class is ready for timetable, attendance, CA, homework, and reports."}
            </p>
          </div>
          <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center lg:w-auto">
            <TableSearch />
            {role === "admin" && <FormModal table="class" type="create" />}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Classes", value: count, icon: LayoutGrid, tone: "bg-indigo-50 text-indigo-700" },
          { label: "Students", value: totalStudents, icon: Users, tone: "bg-emerald-50 text-emerald-700" },
          { label: "With class teacher", value: classesWithClassTeacher, icon: GraduationCap, tone: "bg-violet-50 text-violet-700" },
          { label: "Need setup", value: classesNeedingSetup, icon: BookOpen, tone: "bg-amber-50 text-amber-700" },
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

      {role === "admin" && (
        <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm font-semibold leading-6 text-amber-800">
          Class teacher responsibility is different from subject teaching. A class teacher supervises the class; subject teachers become attached to a class through the published timetable.
        </div>
      )}

      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-4 py-3 sm:px-5">
          <h2 className="text-sm font-black uppercase tracking-wide text-gray-500">
            {role === "teacher" ? "Class access list" : "Class readiness list"}
          </h2>
        </div>

        <div className="divide-y divide-gray-100">
          {classes.map((item) => {
            const isMyClass = supervisedClassIds.has(item.id);
            const isTaughtClass = taughtClassIds.has(item.id);
            const liveLessonCount = liveLessonCountByClassId.get(item.id) ?? 0;
            const liveTeacherCount = liveTeacherCountByClassId.get(item.id)?.size ?? 0;
            const caSetupCount = item._count.caBuckets;
            const academicRecordCount =
              item._count.caActivities +
              item._count.continuousAssessments +
              item._count.reportPublications +
              item._count.syllabusTopicProgress;
            const draftLessonCount = item._count.lessons;
            const capacityPercent = item.capacity > 0 ? Math.min(100, Math.round((item._count.students / item.capacity) * 100)) : 0;
            const protectedUsageCount = item._count.students + liveLessonCount + academicRecordCount;
            const setupIssues = [
              !item.supervisorId ? "No class teacher" : null,
              liveLessonCount === 0 ? "No published timetable" : null,
              item._count.students === 0 ? "No students" : null,
            ].filter(Boolean);
            const statusLabel = setupIssues.length === 0 ? "Ready" : `${setupIssues.length} setup item${setupIssues.length === 1 ? "" : "s"}`;
            const statusClass = setupIssues.length === 0 ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700";

            return (
              <div key={item.id} className="p-4 sm:p-5">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-indigo-100 bg-indigo-50 px-2.5 py-1 text-xs font-black text-indigo-700">
                        {item.name}
                      </span>
                      <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-black text-gray-600">
                        {item.grade.level}{item.section ? ` · Section ${item.section}` : ""}
                      </span>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-black ${statusClass}`}>
                        {statusLabel}
                      </span>
                      {role === "teacher" && isMyClass && (
                        <span className="rounded-full bg-slate-950 px-2.5 py-1 text-xs font-black text-white">My class</span>
                      )}
                      {role === "teacher" && isTaughtClass && (
                        <span className="rounded-full bg-violet-50 px-2.5 py-1 text-xs font-black text-violet-700">I teach</span>
                      )}
                    </div>

                    <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-5">
                      <div>
                        <p className="text-xs font-black uppercase tracking-wide text-gray-400">Students</p>
                        <div className="mt-1 flex items-center gap-2">
                          <div className="h-2 w-20 overflow-hidden rounded-full bg-gray-100">
                            <div className="h-full rounded-full bg-indigo-500" style={{ width: `${capacityPercent}%` }} />
                          </div>
                          <p className="font-bold text-gray-800">{item._count.students}/{item.capacity}</p>
                        </div>
                      </div>
                      <div>
                        <p className="text-xs font-black uppercase tracking-wide text-gray-400">Class teacher</p>
                        <p className="mt-1 font-bold text-gray-800">
                          {item.supervisor ? `${item.supervisor.name} ${item.supervisor.surname}` : "Not assigned"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-black uppercase tracking-wide text-gray-400">Published lessons</p>
                        <p className="mt-1 font-bold text-gray-800">{liveLessonCount}</p>
                      </div>
                      <div>
                        <p className="text-xs font-black uppercase tracking-wide text-gray-400">Subject teachers</p>
                        <p className="mt-1 font-bold text-gray-800">{liveTeacherCount}</p>
                      </div>
                      <div>
                        <p className="text-xs font-black uppercase tracking-wide text-gray-400">Draft slots</p>
                        <p className="mt-1 font-bold text-gray-800">{draftLessonCount}</p>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {setupIssues.length > 0 ? (
                        setupIssues.map((issue) => (
                          <span key={issue} className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700">
                            {issue}
                          </span>
                        ))
                      ) : (
                        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
                          Ready for daily operation
                        </span>
                      )}
                      {caSetupCount > 0 && (
                        <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-700">
                          {caSetupCount} CA setup item{caSetupCount === 1 ? "" : "s"}
                        </span>
                      )}
                      {academicRecordCount > 0 && (
                        <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-bold text-gray-600">
                          {academicRecordCount} academic record{academicRecordCount === 1 ? "" : "s"}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 xl:pt-1">
                    {role === "teacher" && isMyClass ? (
                      <Link
                        href={`/teacher/classes/${item.id}`}
                        className="inline-flex h-9 items-center justify-center gap-1 rounded-xl bg-slate-900 px-3 text-xs font-black text-white transition-colors hover:bg-slate-800"
                      >
                        <GraduationCap size={14} />
                        Overview
                      </Link>
                    ) : null}
                    <Link
                      href={`/list/students?classId=${item.id}`}
                      className="inline-flex h-9 items-center justify-center gap-1 rounded-xl bg-indigo-50 px-3 text-xs font-black text-indigo-700 transition-colors hover:bg-indigo-100"
                    >
                      <Users size={14} />
                      Students
                    </Link>
                    <Link
                      href={`/list/report-cards?classId=${item.id}`}
                      className="inline-flex h-9 items-center justify-center gap-1 rounded-xl bg-gray-50 px-3 text-xs font-black text-gray-700 transition-colors hover:bg-gray-100"
                    >
                      <FileText size={14} />
                      Reports
                    </Link>
                    {role === "admin" && <FormModal table="class" type="update" data={item} />}
                    {role === "admin" && protectedUsageCount === 0 && <FormModal table="class" type="delete" id={item.id} />}
                  </div>
                </div>
              </div>
            );
          })}

          {classes.length === 0 && (
            <div className="px-4 py-12 text-center sm:px-5">
              <p className="text-sm font-bold text-gray-500">No classes found.</p>
              <p className="mt-1 text-xs font-semibold text-gray-400">Create classes, assign a class teacher, add students, then publish the timetable.</p>
            </div>
          )}
        </div>

        <div className="border-t border-gray-100">
          <Pagination page={p} count={count} />
        </div>
      </div>

      {role === "admin" && classesWithPublishedTimetable === 0 && count > 0 && (
        <div className="rounded-2xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm font-semibold leading-6 text-indigo-800">
          No class has published timetable lessons yet. Draft timetable slots can be prepared, but teacher dashboards, attendance, homework, CA, and parent summaries use only the published timetable.
        </div>
      )}
    </div>
  );
};

export default ClassListPage;

