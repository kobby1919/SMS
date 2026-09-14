// src/app/(dashboard)/list/teachers/page.tsx

import Pagination from "@/src/components/pagination";
import { requirePageSession } from "@/src/lib/authz";
import TableSearch from "@/src/components/TableSearch";
import Image from "next/image";
import Link from "next/link";
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  Eye,
  ShieldCheck,
  Users,
} from "lucide-react";
import FormModal from "@/src/components/FormModal";
import prisma from "@/src/lib/prisma";
import { Subject, Prisma } from "@/src/generated/prisma";
import { ITEM_PER_PAGE } from "@/src/lib/settings";
import { listLiveTimetableLessons } from "@/src/lib/services/timetable";

// Dynamic subject color by name initial
const SUBJECT_COLORS = [
  "bg-blue-100 text-blue-700",   "bg-amber-100 text-amber-700",
  "bg-emerald-100 text-emerald-700", "bg-violet-100 text-violet-700",
  "bg-rose-100 text-rose-700",   "bg-orange-100 text-orange-700",
  "bg-teal-100 text-teal-700",   "bg-pink-100 text-pink-700",
];
const getSubjectColor = (_: string, idx: number) =>
  SUBJECT_COLORS[idx % SUBJECT_COLORS.length];

type TeacherSetupStatus = "ready" | "needs-setup";

const statusTabs: Array<{
  key: "all" | "ready" | "needs-setup" | "pending-invites";
  label: string;
}> = [
  { key: "all", label: "All teachers" },
  { key: "ready", label: "Ready" },
  { key: "needs-setup", label: "Needs setup" },
  { key: "pending-invites", label: "Pending invites" },
];

const TeacherListPage = async ({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) => {
  const { role, schoolId } = await requirePageSession();

  const { page, ...queryParams } = await searchParams;
  const p = page ? parseInt(page) : 1;
  const selectedStatus =
    queryParams.status === "ready" ||
    queryParams.status === "needs-setup" ||
    queryParams.status === "pending-invites"
      ? queryParams.status
      : "all";

  const query: Prisma.TeacherWhereInput = { schoolId };
  let classFilterTeacherIds: string[] | null = null;

  if (queryParams) {
    for (const [key, value] of Object.entries(queryParams)) {
      if (value !== undefined) {
        switch (key) {
          case "classId":
            classFilterTeacherIds = Array.from(
              new Set(
                (await listLiveTimetableLessons(schoolId, { classId: parseInt(value) }))
                  .map((lesson) => lesson.teacherId),
              ),
            );
            break;
          case "search":
            query.OR = [
              { name: { contains: value, mode: "insensitive" } },
              { surname: { contains: value, mode: "insensitive" } },
              { email: { contains: value, mode: "insensitive" } },
              { phone: { contains: value, mode: "insensitive" } },
            ];
            break;
        }
      }
    }
  }
  if (classFilterTeacherIds) {
    query.id = { in: classFilterTeacherIds };
  }

  const [allTeachers] = await Promise.all([
    prisma.teacher.findMany({
      where: query,
      include: {
        subjects: true,
      },
      orderBy: { name: "asc" },
    }),
  ]);
  const liveLessons = await listLiveTimetableLessons(schoolId);
  const liveLessonsByTeacherId = new Map<string, typeof liveLessons>();
  for (const lesson of liveLessons) {
    const rows = liveLessonsByTeacherId.get(lesson.teacherId) ?? [];
    rows.push(lesson);
    liveLessonsByTeacherId.set(lesson.teacherId, rows);
  }

  const enrichedTeachers = allTeachers.map((teacher) => {
    const teacherLessons = liveLessonsByTeacherId.get(teacher.id) ?? [];
    const taughtClasses = Array.from(
      new Map(teacherLessons.map((l) => [l.class.id, l.class])).values(),
    );
    const hasSubjects = teacher.subjects.length > 0;
    const hasLiveClasses = taughtClasses.length > 0;
    const hasContact = Boolean(teacher.email || teacher.phone);
    const setupStatus: TeacherSetupStatus =
      hasSubjects && hasLiveClasses && hasContact ? "ready" : "needs-setup";
    const missingSetup = [
      !hasContact ? "contact" : null,
      !hasSubjects ? "subjects" : null,
      !hasLiveClasses ? "published timetable classes" : null,
    ].filter(Boolean) as string[];

    return { teacher, taughtClasses, setupStatus, missingSetup };
  });

  const readyTeachers = enrichedTeachers.filter((item) => item.setupStatus === "ready");
  const teachersNeedingSetup = enrichedTeachers.filter((item) => item.setupStatus === "needs-setup");
  const pendingInvites = 0;
  const filteredTeachers =
    selectedStatus === "ready"
      ? readyTeachers
      : selectedStatus === "needs-setup"
        ? teachersNeedingSetup
        : selectedStatus === "pending-invites"
          ? []
          : enrichedTeachers;
  const count = filteredTeachers.length;
  const teachers = filteredTeachers.slice(
    ITEM_PER_PAGE * (p - 1),
    ITEM_PER_PAGE * p,
  );
  const activeTabHref = (status: string) => {
    const params = new URLSearchParams();
    if (status !== "all") params.set("status", status);
    if (queryParams.search) params.set("search", queryParams.search);
    if (queryParams.classId) params.set("classId", queryParams.classId);
    return `/list/teachers${params.toString() ? `?${params.toString()}` : ""}`;
  };

  return (
    <div className="flex-1 m-4 mt-0 flex flex-col gap-4">

      {/* ── Page header ── */}
      <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-black text-gray-800 tracking-tight">Teachers</h1>
            <p className="text-sm text-gray-500 mt-0.5 font-medium">
              Manage teacher access, setup readiness, and published timetable coverage.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
            <TableSearch />
            <div className="flex items-center gap-2">
              {role === "admin" && <FormModal table="teacher" type="create" />}
            </div>
          </div>
        </div>
      </div>

      {/* ── Stats — all from DB, no hardcoded values ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Registered", value: allTeachers.length, icon: <Users size={16} />, color: "bg-indigo-50 text-indigo-600" },
          { label: "Ready", value: readyTeachers.length, icon: <CheckCircle2 size={16} />, color: "bg-emerald-50 text-emerald-600" },
          { label: "Needs setup", value: teachersNeedingSetup.length, icon: <AlertCircle size={16} />, color: "bg-amber-50 text-amber-600" },
          { label: "Pending invites", value: pendingInvites, icon: <Clock3 size={16} />, color: "bg-violet-50 text-violet-600" },
        ].map((stat) => (
          <div key={stat.label} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${stat.color}`}>
              {stat.icon}
            </div>
            <div>
              <p className="text-xl font-black text-gray-800 leading-none">{stat.value}</p>
              <p className="text-xs text-gray-400 font-medium mt-0.5">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-2 shadow-sm">
        <div className="flex gap-2 overflow-x-auto">
          {statusTabs.map((tab) => {
            const active = selectedStatus === tab.key;
            return (
              <Link
                key={tab.key}
                href={activeTabHref(tab.key)}
                className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm font-black transition ${
                  active
                    ? "bg-edujay-primary text-white shadow-sm"
                    : "text-gray-500 hover:bg-gray-50"
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>
      </div>

      {/* ── Table ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex-1">
        <div className="w-full overflow-x-auto">
          <table className="w-full min-w-[360px]">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60">
                <th className="text-left px-4 py-3.5 text-xs font-black uppercase tracking-wider text-gray-400">Teacher</th>
                <th className="text-left px-3 py-3.5 text-xs font-black uppercase tracking-wider text-gray-400 hidden md:table-cell">Subjects</th>
                <th className="text-left px-3 py-3.5 text-xs font-black uppercase tracking-wider text-gray-400 hidden lg:table-cell">Classes</th>
                <th className="text-left px-3 py-3.5 text-xs font-black uppercase tracking-wider text-gray-400 hidden xl:table-cell">Setup</th>
                <th className="text-left px-3 py-3.5 text-xs font-black uppercase tracking-wider text-gray-400 hidden xl:table-cell">Phone</th>
                {role === "admin" && (
                  <th className="text-right px-5 py-3.5 text-xs font-black uppercase tracking-wider text-gray-400 w-[120px]">Actions</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {teachers.map(({ teacher: item, taughtClasses, setupStatus, missingSetup }) => {

                return (
                  <tr key={item.id} className="hover:bg-indigo-50/30 transition-colors duration-150 group">

                    {/* Teacher info */}
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="relative shrink-0">
                          <Image
                            src={item.img || "/noAvatar.png"}
                            alt={item.name}
                            width={40} height={40}
                            className="w-10 h-10 rounded-xl object-cover ring-2 ring-gray-100"
                          />
                          <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-400 rounded-full border-2 border-white" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-sm text-gray-800 truncate">{item.name} {item.surname}</p>
                          <p className="text-xs text-gray-400 truncate">{item.email}</p>
                          <div className="mt-2 flex flex-wrap gap-1 md:hidden">
                            <span
                              className={`rounded-full px-2 py-0.5 text-[11px] font-black ${
                                setupStatus === "ready"
                                  ? "bg-emerald-50 text-emerald-700"
                                  : "bg-amber-50 text-amber-700"
                              }`}
                            >
                              {setupStatus === "ready" ? "Ready" : "Needs setup"}
                            </span>
                            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-bold text-gray-500">
                              {taughtClasses.length} classes
                            </span>
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Subjects — dynamic colors */}
                    <td className="px-3 py-3.5 hidden md:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {item.subjects.slice(0, 2).map((s: Subject, idx: number) => (
                          <span key={s.id} className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${getSubjectColor(s.name, idx)}`}>
                            {s.name}
                          </span>
                        ))}
                        {item.subjects.length > 2 && (
                          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                            +{item.subjects.length - 2}
                          </span>
                        )}
                        {item.subjects.length === 0 && (
                          <span className="text-xs text-gray-300 italic">None assigned</span>
                        )}
                      </div>
                    </td>

                    {/* Classes — from lessons, not supervisor relation */}
                    <td className="px-3 py-3.5 hidden lg:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {taughtClasses.slice(0, 3).map((c) => (
                          <span key={c.id} className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600">
                            {c.name}
                          </span>
                        ))}
                        {taughtClasses.length > 3 && (
                          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                            +{taughtClasses.length - 3}
                          </span>
                        )}
                        {taughtClasses.length === 0 && (
                          <span className="text-xs text-gray-300 italic">No classes yet</span>
                        )}
                      </div>
                    </td>

                    <td className="px-3 py-3.5 hidden xl:table-cell">
                      <div className="flex flex-col gap-1">
                        <span
                          className={`inline-flex w-fit items-center gap-1 rounded-full px-2.5 py-1 text-xs font-black ${
                            setupStatus === "ready"
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-amber-50 text-amber-700"
                          }`}
                        >
                          <ShieldCheck size={12} />
                          {setupStatus === "ready" ? "Ready" : "Needs setup"}
                        </span>
                        {missingSetup.length > 0 && (
                          <span className="max-w-[220px] text-xs font-semibold text-gray-400">
                            Missing {missingSetup.join(", ")}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Phone */}
                    <td className="px-3 py-3.5 hidden xl:table-cell">
                      <span className="text-sm text-gray-600 font-medium">{item.phone ?? "—"}</span>
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-4 w-[120px]">
                      <div className="flex items-center justify-end gap-2">
                        <Link href={`/list/teachers/${item.id}`}>
                          <button className="w-8 h-8 flex items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors">
                            <Eye size={14} />
                          </button>
                        </Link>
                        {role === "admin" && <FormModal table="teacher" type="update" data={item} />}
                        {role === "admin" && <FormModal table="teacher" type="delete" id={item.id} />}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {teachers.length === 0 && (
                <tr>
                  <td
                    colSpan={role === "admin" ? 6 : 5}
                    className="px-5 py-12 text-center"
                  >
                    <p className="text-sm font-black text-gray-500">
                      {selectedStatus === "pending-invites"
                        ? "Teacher invites will appear here after the invite flow is enabled."
                        : "No teachers match this view."}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-gray-400">
                      {selectedStatus === "pending-invites"
                        ? "Next section: create secure teacher invites and track accepted, expired, and revoked invites."
                        : "Try another tab or search term."}
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="border-t border-gray-100">
          <Pagination page={p} count={count} />
        </div>
      </div>
    </div>
  );
};

export default TeacherListPage;
