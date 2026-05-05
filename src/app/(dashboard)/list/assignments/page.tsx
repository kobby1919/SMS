// src/app/(dashboard)/list/assignments/page.tsx

import Pagination from "@/src/components/pagination";
import TableSearch from "@/src/components/TableSearch";
import {
  Filter,
  ArrowUpDown,
  Briefcase,
  Clock,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import FormModal from "@/src/components/FormModal";
import prisma from "@/src/lib/prisma";
import { ITEM_PER_PAGE } from "@/src/lib/settings";
import { auth } from "@clerk/nextjs/server";

export const dynamic = "force-dynamic";

const getCountdown = (date: Date): string => {
  const days = Math.ceil((date.getTime() - Date.now()) / 86400000);
  if (days < 0) return "Overdue";
  if (days === 0) return "Due Today";
  if (days === 1) return "Due Tomorrow";
  return `Due in ${days}d`;
};

const getCountdownColor = (date: Date): string => {
  const days = Math.ceil((date.getTime() - Date.now()) / 86400000);
  if (days < 0) return "bg-gray-100 text-gray-500";
  if (days <= 1) return "bg-rose-50 text-rose-600 border border-rose-200";
  if (days <= 3) return "bg-amber-50 text-amber-600 border border-amber-200";
  return "bg-emerald-50 text-emerald-600 border border-emerald-200";
};

const AssignmentListPage = async ({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) => {
  const { userId, sessionClaims } = await auth();
  const role = (sessionClaims?.metadata as { role?: string })?.role;
  const currentUserId = userId;

  const { page, tab, ...queryParams } = await searchParams;
  const p = page ? parseInt(page) : 1;
  const activeTab = tab === "past" ? "past" : "upcoming";
  const now = new Date();

  const lessonQuery: any = {};

  if (queryParams.search) {
    lessonQuery.subject = {
      name: { contains: queryParams.search, mode: "insensitive" },
    };
  }
  if (queryParams.classId) {
    lessonQuery.classId = parseInt(queryParams.classId);
  }

  // Role scoping — teacher sees ONLY assignments they created
  switch (role) {
    case "teacher":
      lessonQuery.teacherId = currentUserId!;
      break;
    case "student":
      lessonQuery.class = { students: { some: { id: currentUserId! } } };
      break;
    case "parent":
      lessonQuery.class = { students: { some: { parentId: currentUserId! } } };
      break;
    // admin: no filter — oversight view only, cannot create
  }

  const baseWhere = { lesson: lessonQuery };
  const dateFilter = {
    ...baseWhere,
    dueDate: activeTab === "upcoming" ? { gte: now } : { lt: now },
  };

  const [assignments, upcomingCount, pastCount, overdueCount] =
    await Promise.all([
      prisma.assignment.findMany({
        where: dateFilter,
        include: {
          lesson: {
            select: {
              id: true, // ← include lessonId so update form can pre-select
              subject: { select: { name: true } },
              teacher: { select: { name: true, surname: true } },
              class: { select: { name: true } },
            },
          },
        },
        orderBy:
          activeTab === "upcoming" ? { dueDate: "asc" } : { dueDate: "desc" },
        take: ITEM_PER_PAGE,
        skip: ITEM_PER_PAGE * (p - 1),
      }),
      prisma.assignment.count({
        where: { ...baseWhere, dueDate: { gte: now } },
      }),
      prisma.assignment.count({
        where: { ...baseWhere, dueDate: { lt: now } },
      }),
      prisma.assignment.count({
        where: {
          ...baseWhere,
          dueDate: { lt: now, gte: new Date(Date.now() - 30 * 86400000) },
        },
      }),
    ]);

  const totalCount = activeTab === "upcoming" ? upcomingCount : pastCount;

  // ── Access rules ─────────────────────────────────────────────────────────
  // Only TEACHERS can create/update/delete assignments
  // Admin has read-only oversight — they should not give assignments
  const canManage = role === "teacher";

  return (
    <div className="flex-1 m-4 mt-0 flex flex-col gap-4">
      {/* Header */}
      <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 bg-amber-50 rounded-2xl flex items-center justify-center shrink-0">
              <Briefcase size={20} className="text-amber-600" />
            </div>
            <div>
              <h1 className="text-xl font-black text-gray-800 tracking-tight">
                Assignments
              </h1>
              <p className="text-sm text-gray-400 mt-0.5 font-medium">
                {upcomingCount} active · {pastCount} past
                {overdueCount > 0 && (
                  <span className="ml-2 text-[11px] font-bold text-rose-500 bg-rose-50 px-2 py-0.5 rounded-full">
                    {overdueCount} overdue
                  </span>
                )}
              </p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
            <TableSearch />
            <div className="flex items-center gap-2">
              <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-100 text-gray-600 text-sm font-semibold hover:bg-gray-200 transition-colors">
                <Filter size={14} />
                <span className="hidden sm:inline">Filter</span>
              </button>
              <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-100 text-gray-600 text-sm font-semibold hover:bg-gray-200 transition-colors">
                <ArrowUpDown size={14} />
                <span className="hidden sm:inline">Sort</span>
              </button>
              {/* Teachers only — admins view but do not create */}
              {canManage && <FormModal table="assignment" type="create" />}
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {
            label: "Active",
            value: upcomingCount,
            icon: <Clock size={16} />,
            color: "bg-amber-50 text-amber-600",
          },
          {
            label: "Past",
            value: pastCount,
            icon: <CheckCircle2 size={16} />,
            color: "bg-emerald-50 text-emerald-600",
          },
          {
            label: "Total",
            value: upcomingCount + pastCount,
            icon: <Briefcase size={16} />,
            color: "bg-indigo-50 text-indigo-600",
          },
          {
            label: "Overdue",
            value: overdueCount,
            icon: <AlertTriangle size={16} />,
            color:
              overdueCount > 0
                ? "bg-rose-50 text-rose-600"
                : "bg-gray-50 text-gray-400",
          },
        ].map((s) => (
          <div
            key={s.label}
            className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex items-center gap-3"
          >
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${s.color}`}
            >
              {s.icon}
            </div>
            <div>
              <p className="text-xl font-black text-gray-800 leading-none">
                {s.value}
              </p>
              <p className="text-xs text-gray-400 font-medium mt-0.5">
                {s.label}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex bg-gray-100 p-1 rounded-xl w-fit gap-1">
        {(["upcoming", "past"] as const).map((t) => (
          <a
            key={t}
            href={`?tab=${t}`}
            className={`px-5 py-2 rounded-lg text-sm font-bold transition-all
              ${activeTab === t ? "bg-white text-indigo-600 shadow-sm" : "text-gray-400 hover:text-gray-600"}`}
          >
            {t === "upcoming"
              ? `Active (${upcomingCount})`
              : `Past (${pastCount})`}
          </a>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex-1">
        <div className="w-full overflow-x-auto">
          <table className="w-full min-w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60">
                <th className="text-left px-5 py-3.5 text-xs font-black uppercase tracking-wider text-gray-400">
                  Assignment
                </th>
                <th className="text-left px-4 py-3.5 text-xs font-black uppercase tracking-wider text-gray-400 hidden sm:table-cell">
                  Class
                </th>
                <th className="text-left px-4 py-3.5 text-xs font-black uppercase tracking-wider text-gray-400 hidden md:table-cell">
                  Teacher
                </th>
                <th className="text-left px-4 py-3.5 text-xs font-black uppercase tracking-wider text-gray-400 hidden md:table-cell">
                  Assigned
                </th>
                <th className="text-left px-4 py-3.5 text-xs font-black uppercase tracking-wider text-gray-400">
                  Due
                </th>
                {activeTab === "upcoming" && (
                  <th className="text-left px-4 py-3.5 text-xs font-black uppercase tracking-wider text-gray-400">
                    Status
                  </th>
                )}
                {canManage && (
                  <th className="text-right px-5 py-3.5 text-xs font-black uppercase tracking-wider text-gray-400 sticky right-0 bg-gray-50/60">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {assignments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-16">
                    <Briefcase
                      size={32}
                      className="text-gray-200 mx-auto mb-3"
                    />
                    <p className="text-gray-400 font-semibold text-sm">
                      No {activeTab === "upcoming" ? "active" : "past"}{" "}
                      assignments
                    </p>
                  </td>
                </tr>
              ) : (
                assignments.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-indigo-50/30 transition-colors group"
                  >
                    <td className="px-5 py-4">
                      <p className="font-bold text-sm text-gray-800">
                        {item.lesson.subject?.name}
                      </p>
                      <p className="text-[11px] text-gray-400 mt-0.5 truncate max-w-[200px]">
                        {item.title}
                      </p>
                    </td>
                    <td className="px-4 py-4 hidden sm:table-cell">
                      <span className="text-xs font-bold px-2 py-1 bg-indigo-50 text-indigo-600 rounded-lg">
                        {item.lesson.class.name}
                      </span>
                    </td>
                    <td className="px-4 py-4 hidden md:table-cell">
                      <span className="text-sm text-gray-500">
                        {item.lesson.teacher.name} {item.lesson.teacher.surname}
                      </span>
                    </td>
                    <td className="px-4 py-4 hidden md:table-cell">
                      <span className="text-sm text-gray-400">
                        {new Intl.DateTimeFormat("en-GH", {
                          day: "numeric",
                          month: "short",
                        }).format(item.startDate)}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-sm font-semibold text-gray-700">
                        {new Intl.DateTimeFormat("en-GH", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        }).format(item.dueDate)}
                      </span>
                    </td>
                    {activeTab === "upcoming" && (
                      <td className="px-4 py-4">
                        <span
                          className={`text-[11px] font-black px-2.5 py-1 rounded-lg ${getCountdownColor(item.dueDate)}`}
                        >
                          {getCountdown(item.dueDate)}
                        </span>
                      </td>
                    )}
                    {canManage && (
                      <td className="px-5 py-4 sticky right-0 bg-white group-hover:bg-indigo-50/30 transition-colors">
                        <div className="flex items-center justify-end gap-2">
                          {/* Pass lessonId explicitly so update form can pre-select */}
                          <FormModal
                            table="assignment"
                            type="update"
                            data={{ ...item, lessonId: item.lesson.id }}
                          />
                          <FormModal
                            table="assignment"
                            type="delete"
                            id={item.id}
                          />
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="border-t border-gray-100">
          <Pagination page={p} count={totalCount} />
        </div>
      </div>
    </div>
  );
};

export default AssignmentListPage;
