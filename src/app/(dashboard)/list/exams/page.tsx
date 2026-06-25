// src/app/(dashboard)/list/exams/page.tsx

import Pagination from "@/src/components/pagination";
import { requirePageSession } from "@/src/lib/authz";
import TableSearch from "@/src/components/TableSearch";
import { Filter, ArrowUpDown, Calendar, Clock, CheckCircle2, BookOpen } from "lucide-react";
import FormModal from "@/src/components/FormModal";
import { Prisma } from "@/src/generated/prisma";
import prisma from "@/src/lib/prisma";
import { ITEM_PER_PAGE } from "@/src/lib/settings";

// ── Grade helpers ─────────────────────────────────────────────────────────────
const getCountdown = (date: Date): string => {
  const now   = new Date();
  const diff  = date.getTime() - now.getTime();
  const days  = Math.ceil(diff / (1000 * 60 * 60 * 24));
  if (days < 0)  return "Past";
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  return `In ${days} days`;
};

const getCountdownColor = (date: Date): string => {
  const now  = new Date();
  const diff = date.getTime() - now.getTime();
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
  if (days < 0)  return "bg-gray-100 text-gray-400";
  if (days <= 1) return "bg-rose-50 text-rose-600 border border-rose-200";
  if (days <= 3) return "bg-amber-50 text-amber-600 border border-amber-200";
  return "bg-emerald-50 text-emerald-600 border border-emerald-200";
};

export const dynamic = "force-dynamic";

const ExamListPage = async ({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) => {
  const { userId, role, schoolId } = await requirePageSession();
  const currentUserId = userId;

  const { page, tab, ...queryParams } = await searchParams;
  const p          = page ? parseInt(page) : 1;
  const activeTab  = tab === "past" ? "past" : "upcoming";
  const now        = new Date();

  const query: Prisma.ExamWhereInput = { schoolId };
  query.lesson = {};

  if (queryParams) {
    for (const [key, value] of Object.entries(queryParams)) {
      if (value !== undefined) {
        switch (key) {
          case "classId":
            query.lesson.classId = parseInt(value);
            break;
          case "teacherId":
            query.lesson.teacherId = value;
            break;
          case "search":
            query.lesson.subject = { name: { contains: value, mode: "insensitive" } };
            break;
        }
      }
    }
  }

  // Role-based filtering
  switch (role) {
    case "teacher":
      query.lesson.teacherId = currentUserId!;
      break;
    case "student":
      query.lesson.class = { students: { some: { id: currentUserId! } } };
      break;
    case "parent":
      query.lesson.class = { students: { some: { parentId: currentUserId! } } };
      break;
  }

  // Upcoming vs past
  const dateFilter: Prisma.ExamWhereInput = {
    ...query,
    startTime: activeTab === "upcoming" ? { gte: now } : { lt: now },
  };

  const [exams, upcomingCount, pastCount] = await Promise.all([
    prisma.exam.findMany({
      where: dateFilter,
      include: {
        lesson: {
          select: {
            subject: { select: { name: true } },
            teacher: { select: { name: true, surname: true } },
            class:   { select: { name: true } },
          },
        },
        // Count results for this exam
        results: { select: { score: true } },
      },
      orderBy: activeTab === "upcoming"
        ? { startTime: "asc" }   // soonest first
        : { startTime: "desc" }, // most recent first
      take: ITEM_PER_PAGE,
      skip: ITEM_PER_PAGE * (p - 1),
    }),
    prisma.exam.count({ where: { ...query, startTime: { gte: now } } }),
    prisma.exam.count({ where: { ...query, startTime: { lt:  now } } }),
  ]);

  const totalCount = activeTab === "upcoming" ? upcomingCount : pastCount;

  return (
    <div className="flex-1 m-4 mt-0 flex flex-col gap-4">

      {/* ── Header ── */}
      <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 bg-indigo-50 rounded-2xl flex items-center justify-center shrink-0">
              <Calendar size={20} className="text-indigo-600" />
            </div>
            <div>
              <h1 className="text-xl font-black text-gray-800 tracking-tight">Exams</h1>
              <p className="text-sm text-gray-400 mt-0.5 font-medium">
                {upcomingCount} upcoming · {pastCount} past
              </p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
            <TableSearch />
            <div className="flex items-center gap-2">
              <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-100 text-gray-600 text-sm font-semibold hover:bg-gray-200 transition-colors">
                <Filter size={14} /><span className="hidden sm:inline">Filter</span>
              </button>
              <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-100 text-gray-600 text-sm font-semibold hover:bg-gray-200 transition-colors">
                <ArrowUpDown size={14} /><span className="hidden sm:inline">Sort</span>
              </button>
              {role === "admin" && <FormModal table="exam" type="create" />}
            </div>
          </div>
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Upcoming",     value: upcomingCount, icon: <Clock        size={16} />, color: "bg-amber-50 text-amber-600"     },
          { label: "Past",         value: pastCount,     icon: <CheckCircle2 size={16} />, color: "bg-emerald-50 text-emerald-600" },
          { label: "Total",        value: upcomingCount + pastCount, icon: <Calendar  size={16} />, color: "bg-indigo-50 text-indigo-600"   },
          { label: "Classes",      value: new Set(exams.map((e) => e.lesson.class.name)).size, icon: <BookOpen size={16} />, color: "bg-violet-50 text-violet-600" },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${s.color}`}>{s.icon}</div>
            <div>
              <p className="text-xl font-black text-gray-800 leading-none">{s.value}</p>
              <p className="text-xs text-gray-400 font-medium mt-0.5">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Tabs ── */}
      <div className="flex bg-gray-100 p-1 rounded-xl w-fit gap-1">
        {(["upcoming", "past"] as const).map((t) => (
          <a
            key={t}
            href={`?tab=${t}`}
            className={`px-5 py-2 rounded-lg text-sm font-bold transition-all capitalize
              ${activeTab === t ? "bg-white text-indigo-600 shadow-sm" : "text-gray-400 hover:text-gray-600"}`}
          >
            {t === "upcoming" ? `Upcoming (${upcomingCount})` : `Past (${pastCount})`}
          </a>
        ))}
      </div>

      {/* ── Table ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex-1">
        <div className="w-full overflow-x-auto">
          <table className="w-full min-w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60">
                <th className="text-left px-5 py-3.5 text-xs font-black uppercase tracking-wider text-gray-400">Subject</th>
                <th className="text-left px-4 py-3.5 text-xs font-black uppercase tracking-wider text-gray-400 hidden sm:table-cell">Class</th>
                <th className="text-left px-4 py-3.5 text-xs font-black uppercase tracking-wider text-gray-400 hidden md:table-cell">Teacher</th>
                <th className="text-left px-4 py-3.5 text-xs font-black uppercase tracking-wider text-gray-400">Date</th>
                <th className="text-left px-4 py-3.5 text-xs font-black uppercase tracking-wider text-gray-400 hidden lg:table-cell">Time</th>
                {activeTab === "upcoming" && (
                  <th className="text-left px-4 py-3.5 text-xs font-black uppercase tracking-wider text-gray-400">Countdown</th>
                )}
                {activeTab === "past" && (
                  <th className="text-left px-4 py-3.5 text-xs font-black uppercase tracking-wider text-gray-400 hidden md:table-cell">Results</th>
                )}
                {(role === "admin" || role === "teacher") && (
                  <th className="text-right px-5 py-3.5 text-xs font-black uppercase tracking-wider text-gray-400 w-[100px]">Actions</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {exams.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-16">
                    <Calendar size={32} className="text-gray-200 mx-auto mb-3" />
                    <p className="text-gray-400 font-semibold text-sm">
                      No {activeTab} exams found
                    </p>
                  </td>
                </tr>
              ) : (
                exams.map((item) => {
                  const avgScore = item.results.length > 0
                    ? Math.round(item.results.reduce((s, r) => s + r.score, 0) / item.results.length)
                    : null;

                  return (
                    <tr key={item.id} className="hover:bg-indigo-50/30 transition-colors group">
                      <td className="px-5 py-4">
                        <p className="font-bold text-sm text-gray-800">{item.lesson.subject.name}</p>
                        <p className="text-[11px] text-gray-400 mt-0.5">{item.title}</p>
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
                      <td className="px-4 py-4">
                        <span className="text-sm font-semibold text-gray-700">
                          {new Intl.DateTimeFormat("en-GH", { day: "numeric", month: "short", year: "numeric" }).format(item.startTime)}
                        </span>
                      </td>
                      <td className="px-4 py-4 hidden lg:table-cell">
                        <span className="text-xs text-gray-400 font-medium">
                          {new Intl.DateTimeFormat("en-GH", { hour: "2-digit", minute: "2-digit" }).format(item.startTime)}
                          {" – "}
                          {new Intl.DateTimeFormat("en-GH", { hour: "2-digit", minute: "2-digit" }).format(item.endTime)}
                        </span>
                      </td>

                      {/* Countdown — upcoming only */}
                      {activeTab === "upcoming" && (
                        <td className="px-4 py-4">
                          <span className={`text-[11px] font-black px-2.5 py-1 rounded-lg ${getCountdownColor(item.startTime)}`}>
                            {getCountdown(item.startTime)}
                          </span>
                        </td>
                      )}

                      {/* Results summary — past only */}
                      {activeTab === "past" && (
                        <td className="px-4 py-4 hidden md:table-cell">
                          {avgScore !== null ? (
                            <div className="flex items-center gap-2">
                              <span className={`text-[11px] font-black px-2.5 py-1 rounded-lg
                                ${avgScore >= 80 ? "bg-emerald-50 text-emerald-700" :
                                  avgScore >= 70 ? "bg-blue-50 text-blue-700" :
                                  avgScore >= 60 ? "bg-amber-50 text-amber-700" :
                                  avgScore >= 50 ? "bg-orange-50 text-orange-700" :
                                  "bg-rose-50 text-rose-700"}`}>
                                Avg {avgScore}%
                              </span>
                              <span className="text-[10px] text-gray-400">{item.results.length} marked</span>
                            </div>
                          ) : (
                            <span className="text-[11px] text-gray-300 font-medium">Not marked</span>
                          )}
                        </td>
                      )}

                      <td className="px-5 py-4 w-[100px]">
                        <div className="flex items-center justify-end gap-2">
                          {(role === "admin" || role === "teacher") && (
                            <FormModal table="exam" type="update" data={item} />
                          )}
                          {(role === "admin" || role === "teacher") && (
                            <FormModal table="exam" type="delete" id={item.id} />
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
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

export default ExamListPage;
