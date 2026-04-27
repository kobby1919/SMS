// src/app/(dashboard)/list/results/page.tsx

import Pagination from "@/src/components/pagination";
import TableSearch from "@/src/components/TableSearch";
import { Filter, ArrowUpDown, ScrollText, TrendingUp, Award, XCircle, CheckCircle2 } from "lucide-react";
import FormModal from "@/src/components/FormModal";
import { Prisma } from "@/src/generated/prisma";
import prisma from "@/src/lib/prisma";
import { ITEM_PER_PAGE } from "@/src/lib/settings";
import { auth } from "@clerk/nextjs/server";

export const dynamic = "force-dynamic";

// ── Grade band helpers ────────────────────────────────────────────────────────
type GradeBand = { grade: string; label: string; color: string; bg: string; border: string };

const getGrade = (score: number): GradeBand => {
  if (score >= 80) return { grade: "A", label: "Excellent",    color: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200" };
  if (score >= 70) return { grade: "B", label: "Good",         color: "text-blue-700",    bg: "bg-blue-50",    border: "border-blue-200"    };
  if (score >= 60) return { grade: "C", label: "Average",      color: "text-amber-700",   bg: "bg-amber-50",   border: "border-amber-200"   };
  if (score >= 50) return { grade: "D", label: "Below Average",color: "text-orange-700",  bg: "bg-orange-50",  border: "border-orange-200"  };
  return               { grade: "F", label: "Fail",           color: "text-rose-700",    bg: "bg-rose-50",    border: "border-rose-200"    };
};

const ResultListPage = async ({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) => {
  const { userId, sessionClaims } = await auth();
  const role          = (sessionClaims?.metadata as { role?: string })?.role;
  const currentUserId = userId;

  const { page, ...queryParams } = await searchParams;
  const p = page ? parseInt(page) : 1;

  const query: Prisma.ResultWhereInput = {};

  if (queryParams) {
    for (const [key, value] of Object.entries(queryParams)) {
      if (value !== undefined) {
        switch (key) {
          case "studentId":
            query.studentId = value;
            break;
          case "search":
            query.OR = [
              { exam:       { title: { contains: value, mode: "insensitive" } } },
              { assignment: { title: { contains: value, mode: "insensitive" } } },
              { student:    { name:  { contains: value, mode: "insensitive" } } },
            ];
            break;
        }
      }
    }
  }

  // Role-based filtering
  switch (role) {
    case "teacher":
      query.OR = [
        { exam:       { lesson: { teacherId: currentUserId! } } },
        { assignment: { lesson: { teacherId: currentUserId! } } },
      ];
      break;
    case "student":
      query.studentId = currentUserId!;
      break;
    case "parent":
      query.student = { parentId: currentUserId! };
      break;
  }

  // Fetch ALL results (no pagination) for stats, then paginated for table
  const [allResults, pagedResults, count] = await Promise.all([
    // All results for stats (no take/skip)
    prisma.result.findMany({
      where: query,
      select: { score: true },
    }),
    // Paginated results for table
    prisma.result.findMany({
      where: query,
      include: {
        student: { select: { name: true, surname: true, class: { select: { name: true } } } },
        exam: {
          include: {
            lesson: {
              select: {
                subject: { select: { name: true } },
                class:   { select: { name: true } },
                teacher: { select: { name: true, surname: true } },
              },
            },
          },
        },
        assignment: {
          include: {
            lesson: {
              select: {
                subject: { select: { name: true } },
                class:   { select: { name: true } },
                teacher: { select: { name: true, surname: true } },
              },
            },
          },
        },
      },
      orderBy: { score: "desc" },
      take: ITEM_PER_PAGE,
      skip: ITEM_PER_PAGE * (p - 1),
    }),
    prisma.result.count({ where: query }),
  ]);

  // ── Compute stats ─────────────────────────────────────────────────────────
  const scores     = allResults.map((r) => r.score);
  const total      = scores.length;
  const avgScore   = total > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / total) : 0;
  const passCount  = scores.filter((s) => s >= 50).length;
  const failCount  = total - passCount;
  const passRate   = total > 0 ? Math.round((passCount / total) * 100) : 0;
  const highScore  = total > 0 ? Math.max(...scores) : 0;

  // Grade distribution
  const gradeDist = { A: 0, B: 0, C: 0, D: 0, F: 0 };
  scores.forEach((s) => { gradeDist[getGrade(s).grade as keyof typeof gradeDist]++; });

  // Normalise results
  const results = pagedResults
    .map((item) => {
      const assessment = item.exam || item.assignment;
      if (!assessment) return null;
      const isExam    = "startTime" in assessment;
      const grade     = getGrade(item.score);
      return {
        id:             item.id,
        title:          assessment.title,
        type:           isExam ? "Exam" : "Assignment",
        subjectName:    assessment.lesson.subject.name,
        studentName:    item.student?.name    ?? "—",
        studentSurname: item.student?.surname ?? "",
        className:      item.student?.class?.name ?? assessment.lesson.class.name,
        teacherName:    assessment.lesson.teacher.name,
        teacherSurname: assessment.lesson.teacher.surname,
        score:          item.score,
        grade,
        date: isExam
          ? (assessment as any).startTime
          : (assessment as any).startDate,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  const avgGrade = getGrade(avgScore);

  return (
    <div className="flex-1 m-4 mt-0 flex flex-col gap-4">

      {/* ── Header ── */}
      <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 bg-indigo-50 rounded-2xl flex items-center justify-center shrink-0">
              <ScrollText size={20} className="text-indigo-600" />
            </div>
            <div>
              <h1 className="text-xl font-black text-gray-800 tracking-tight">Results</h1>
              <p className="text-sm text-gray-400 mt-0.5 font-medium">
                {count} records · {passRate}% pass rate
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
              {role === "admin" && <FormModal table="result" type="create" />}
            </div>
          </div>
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {
            label: "Class Average",
            value: total > 0 ? `${avgScore}%` : "—",
            sub:   total > 0 ? `Grade ${avgGrade.grade} · ${avgGrade.label}` : "No results yet",
            icon:  <TrendingUp size={16} />,
            color: total > 0 ? avgGrade.bg + " " + avgGrade.color : "bg-gray-50 text-gray-400",
          },
          {
            label: "Pass Rate",
            value: total > 0 ? `${passRate}%` : "—",
            sub:   `${passCount} passed · ${failCount} failed`,
            icon:  <CheckCircle2 size={16} />,
            color: passRate >= 70 ? "bg-emerald-50 text-emerald-600" : passRate >= 50 ? "bg-amber-50 text-amber-600" : "bg-rose-50 text-rose-600",
          },
          {
            label: "Top Score",
            value: total > 0 ? `${highScore}%` : "—",
            sub:   total > 0 ? `Grade ${getGrade(highScore).grade}` : "—",
            icon:  <Award size={16} />,
            color: "bg-violet-50 text-violet-600",
          },
          {
            label: "Total Records",
            value: count,
            sub:   `${gradeDist.A} A · ${gradeDist.B} B · ${gradeDist.C} C · ${gradeDist.D} D · ${gradeDist.F} F`,
            icon:  <ScrollText size={16} />,
            color: "bg-indigo-50 text-indigo-600",
          },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${s.color}`}>{s.icon}</div>
            <div className="min-w-0">
              <p className="text-xl font-black text-gray-800 leading-none">{s.value}</p>
              <p className="text-xs text-gray-400 font-medium mt-0.5">{s.label}</p>
              <p className="text-[10px] text-gray-300 mt-0.5 truncate">{s.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Grade distribution bar ── */}
      {total > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-black uppercase tracking-wider text-gray-400">Grade Distribution</p>
            <p className="text-xs text-gray-400">{total} total results</p>
          </div>
          <div className="flex gap-2 items-end h-12">
            {(["A","B","C","D","F"] as const).map((g) => {
              const count = gradeDist[g];
              const pct   = total > 0 ? Math.round((count / total) * 100) : 0;
              const colors: Record<string, string> = {
                A: "bg-emerald-400", B: "bg-blue-400",
                C: "bg-amber-400",  D: "bg-orange-400", F: "bg-rose-400",
              };
              return (
                <div key={g} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[10px] font-black text-gray-400">{pct}%</span>
                  <div className="w-full rounded-t-lg" style={{ height: `${Math.max(pct * 0.36, 4)}px`, backgroundColor: colors[g].replace("bg-","") }} >
                    <div className={`w-full h-full rounded-t-lg ${colors[g]}`} />
                  </div>
                  <span className="text-[11px] font-black text-gray-600">{g}</span>
                  <span className="text-[9px] text-gray-400">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Table ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex-1">
        <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
          <p className="text-xs font-black uppercase tracking-wider text-gray-400">
            All Records — {count} entries
          </p>
        </div>
        <div className="w-full overflow-x-auto">
          <table className="w-full min-w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60">
                <th className="text-left px-5 py-3.5 text-xs font-black uppercase tracking-wider text-gray-400">Assessment</th>
                <th className="text-left px-4 py-3.5 text-xs font-black uppercase tracking-wider text-gray-400">Student</th>
                <th className="text-left px-4 py-3.5 text-xs font-black uppercase tracking-wider text-gray-400">Score</th>
                <th className="text-left px-4 py-3.5 text-xs font-black uppercase tracking-wider text-gray-400 hidden md:table-cell">Grade</th>
                <th className="text-left px-4 py-3.5 text-xs font-black uppercase tracking-wider text-gray-400 hidden lg:table-cell">Teacher</th>
                <th className="text-left px-4 py-3.5 text-xs font-black uppercase tracking-wider text-gray-400 hidden lg:table-cell">Class</th>
                <th className="text-left px-4 py-3.5 text-xs font-black uppercase tracking-wider text-gray-400 hidden md:table-cell">Date</th>
                {(role === "admin" || role === "teacher") && (
                  <th className="text-right px-5 py-3.5 text-xs font-black uppercase tracking-wider text-gray-400 w-[100px]">Actions</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {results.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-16">
                    <ScrollText size={32} className="text-gray-200 mx-auto mb-3" />
                    <p className="text-gray-400 font-semibold text-sm">No results found</p>
                  </td>
                </tr>
              ) : (
                results.map((item) => (
                  <tr key={item.id} className="hover:bg-indigo-50/30 transition-colors group">
                    <td className="px-5 py-4">
                      <p className="font-bold text-sm text-gray-800">{item.subjectName}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md
                          ${item.type === "Exam" ? "bg-indigo-50 text-indigo-600" : "bg-violet-50 text-violet-600"}`}>
                          {item.type}
                        </span>
                        <span className="text-[10px] text-gray-400">{item.title}</span>
                      </div>
                    </td>

                    <td className="px-4 py-4">
                      <p className="font-bold text-sm text-gray-800">{item.studentName} {item.studentSurname}</p>
                      <p className="text-[11px] text-gray-400">{item.className}</p>
                    </td>

                    {/* Score with visual bar */}
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-black px-2.5 py-1 rounded-lg border ${item.grade.bg} ${item.grade.color} ${item.grade.border}`}>
                          {item.score}
                        </span>
                        <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden hidden sm:block">
                          <div
                            className={`h-full rounded-full ${
                              item.score >= 80 ? "bg-emerald-400" :
                              item.score >= 70 ? "bg-blue-400" :
                              item.score >= 60 ? "bg-amber-400" :
                              item.score >= 50 ? "bg-orange-400" : "bg-rose-400"
                            }`}
                            style={{ width: `${item.score}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    {/* Grade badge */}
                    <td className="px-4 py-4 hidden md:table-cell">
                      <div className="flex flex-col gap-0.5">
                        <span className={`text-sm font-black px-2.5 py-1 rounded-lg w-fit border ${item.grade.bg} ${item.grade.color} ${item.grade.border}`}>
                          {item.grade.grade}
                        </span>
                        <span className="text-[10px] text-gray-400">{item.grade.label}</span>
                      </div>
                    </td>

                    <td className="px-4 py-4 hidden lg:table-cell">
                      <span className="text-sm text-gray-500">{item.teacherName} {item.teacherSurname}</span>
                    </td>

                    <td className="px-4 py-4 hidden lg:table-cell">
                      <span className="text-xs font-bold px-2 py-1 bg-gray-100 text-gray-600 rounded-lg">{item.className}</span>
                    </td>

                    <td className="px-4 py-4 hidden md:table-cell">
                      <span className="text-sm text-gray-500">
                        {new Intl.DateTimeFormat("en-GH", { day: "numeric", month: "short", year: "numeric" }).format(item.date)}
                      </span>
                    </td>

                    <td className="px-5 py-4 w-[100px]">
                      <div className="flex items-center justify-end gap-2">
                        {(role === "admin" || role === "teacher") && (
                          <FormModal table="result" type="update" data={item} />
                        )}
                        {(role === "admin" || role === "teacher") && (
                          <FormModal table="result" type="delete" id={item.id} />
                        )}
                      </div>
                    </td>
                  </tr>
                ))
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

export default ResultListPage;
