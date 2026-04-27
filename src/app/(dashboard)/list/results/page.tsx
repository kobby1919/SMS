// src/app/(dashboard)/list/results/page.tsx

import Pagination from "@/src/components/pagination";
import TableSearch from "@/src/components/TableSearch";
import { Filter, ArrowUpDown, ScrollText, TrendingUp, Award, CheckCircle2 } from "lucide-react";
import FormModal from "@/src/components/FormModal";
import { Prisma } from "@/src/generated/prisma";
import prisma from "@/src/lib/prisma";
import { ITEM_PER_PAGE } from "@/src/lib/settings";
import { auth } from "@clerk/nextjs/server";

export const dynamic = "force-dynamic";

// ─── Grade band ───────────────────────────────────────────────────────────────
type GradeBand = {
  grade: string; label: string;
  color: string; bg: string; border: string; bar: string;
};

const getGrade = (score: number): GradeBand => {
  if (score >= 80) return { grade: "A", label: "Excellent",     color: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200", bar: "bg-emerald-400" };
  if (score >= 70) return { grade: "B", label: "Good",          color: "text-blue-700",    bg: "bg-blue-50",    border: "border-blue-200",    bar: "bg-blue-400"    };
  if (score >= 60) return { grade: "C", label: "Average",       color: "text-amber-700",   bg: "bg-amber-50",   border: "border-amber-200",   bar: "bg-amber-400"   };
  if (score >= 50) return { grade: "D", label: "Below Average", color: "text-orange-700",  bg: "bg-orange-50",  border: "border-orange-200",  bar: "bg-orange-400"  };
  return               { grade: "F", label: "Fail",            color: "text-rose-700",    bg: "bg-rose-50",    border: "border-rose-200",    bar: "bg-rose-400"    };
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

  // All results for stats (un-paginated)
  const allResults = await prisma.result.findMany({
    where: query,
    select: {
      score:     true,
      studentId: true,
      student:   { select: { name: true, surname: true, class: { select: { name: true } } } },
      exam:      { include: { lesson: { select: { class: { select: { name: true } } } } } },
      assignment:{ include: { lesson: { select: { class: { select: { name: true } } } } } },
    },
  });

  // Paginated results for table
  const [pagedResults, count] = await Promise.all([
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

  // ── Global stats ─────────────────────────────────────────────────────────
  const scores    = allResults.map((r) => r.score);
  const total     = scores.length;
  const avgScore  = total > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / total) : 0;
  const passCount = scores.filter((s) => s >= 50).length;
  const failCount = total - passCount;
  const passRate  = total > 0 ? Math.round((passCount / total) * 100) : 0;
  const highScore = total > 0 ? Math.max(...scores) : 0;
  const gradeDist = { A: 0, B: 0, C: 0, D: 0, F: 0 };
  scores.forEach((s) => { gradeDist[getGrade(s).grade as keyof typeof gradeDist]++; });
  const avgGrade  = getGrade(avgScore);

  // ── Student personal stats ────────────────────────────────────────────────
  // Shown prominently when role === "student"
  const myScores       = role === "student" ? scores : [];
  const myAvg          = myScores.length > 0 ? Math.round(myScores.reduce((a, b) => a + b, 0) / myScores.length) : 0;
  const myBest         = myScores.length > 0 ? Math.max(...myScores) : 0;
  const myPassRate     = myScores.length > 0 ? Math.round((myScores.filter((s) => s >= 50).length / myScores.length) * 100) : 0;
  const myAvgGrade     = getGrade(myAvg);

  // ── Class breakdown (admin/teacher) ──────────────────────────────────────
  // Group results by class name → compute average per class
  const classBuckets: Record<string, number[]> = {};
  if (role === "admin" || role === "teacher") {
    for (const r of allResults) {
      const className =
        r.student?.class?.name ??
        r.exam?.lesson?.class?.name ??
        r.assignment?.lesson?.class?.name ??
        "Unknown";
      if (!classBuckets[className]) classBuckets[className] = [];
      classBuckets[className].push(r.score);
    }
  }
  const classAverages = Object.entries(classBuckets)
    .map(([name, s]) => ({
      name,
      avg:   Math.round(s.reduce((a, b) => a + b, 0) / s.length),
      count: s.length,
      grade: getGrade(Math.round(s.reduce((a, b) => a + b, 0) / s.length)),
    }))
    .sort((a, b) => b.avg - a.avg);

  // ── Normalise table rows ──────────────────────────────────────────────────
  const results = pagedResults
    .map((item) => {
      const assessment = item.exam || item.assignment;
      if (!assessment) return null;
      const isExam = "startTime" in assessment;
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
        grade:          getGrade(item.score),
        date:           isExam ? (assessment as any).startTime : (assessment as any).startDate,
        // Pass raw data for update modal
        examId:         item.exam       ? item.exam.id       : null,
        assignmentId:   item.assignment ? item.assignment.id : null,
        studentId:      item.studentId,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

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

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* STUDENT VIEW — personal average shown prominently at the top      */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {role === "student" && myScores.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-xs font-black uppercase tracking-wider text-gray-400 mb-4">My Performance</h2>
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">

            {/* Big grade circle */}
            <div className={`w-20 h-20 rounded-2xl flex flex-col items-center justify-center shrink-0 ${myAvgGrade.bg}`}>
              <span className={`text-3xl font-black leading-none ${myAvgGrade.color}`}>{myAvgGrade.grade}</span>
              <span className={`text-[10px] font-bold uppercase tracking-wide mt-0.5 ${myAvgGrade.color} opacity-60`}>avg</span>
            </div>

            <div className="flex-1">
              <div className="flex items-baseline gap-2 mb-1">
                <span className={`text-4xl font-black ${myAvgGrade.color}`}>{myAvg}%</span>
                <span className="text-sm text-gray-400 font-semibold">{myAvgGrade.label}</span>
              </div>
              {/* Personal rate bar */}
              <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden mb-2 max-w-xs">
                <div
                  className={`h-full rounded-full ${myAvgGrade.bar}`}
                  style={{ width: `${myAvg}%` }}
                />
              </div>
              <p className="text-xs text-gray-400">
                {myScores.length} assessments · best score {myBest}% · {myPassRate}% pass rate
              </p>
            </div>

            {/* Mini grade dist */}
            <div className="flex gap-2 flex-wrap">
              {(["A","B","C","D","F"] as const).map((g) => {
                const cnt = myScores.filter((s) => getGrade(s).grade === g).length;
                const colors: Record<string, string> = {
                  A: "bg-emerald-50 text-emerald-700 border-emerald-200",
                  B: "bg-blue-50 text-blue-700 border-blue-200",
                  C: "bg-amber-50 text-amber-700 border-amber-200",
                  D: "bg-orange-50 text-orange-700 border-orange-200",
                  F: "bg-rose-50 text-rose-700 border-rose-200",
                };
                return (
                  <div key={g} className={`flex flex-col items-center px-3 py-2 rounded-xl border ${colors[g]}`}>
                    <span className="text-lg font-black leading-none">{cnt}</span>
                    <span className="text-[10px] font-black uppercase mt-0.5 opacity-60">{g}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* ADMIN / TEACHER VIEW — global stats + class breakdown             */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {(role === "admin" || role === "teacher") && (
        <>
          {/* Global stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              {
                label: "Overall Average", value: total > 0 ? `${avgScore}%` : "—",
                sub:   total > 0 ? `Grade ${avgGrade.grade} · ${avgGrade.label}` : "No results yet",
                icon:  <TrendingUp size={16} />,
                color: total > 0 ? `${avgGrade.bg} ${avgGrade.color}` : "bg-gray-50 text-gray-400",
              },
              {
                label: "Pass Rate", value: total > 0 ? `${passRate}%` : "—",
                sub:   `${passCount} passed · ${failCount} failed`,
                icon:  <CheckCircle2 size={16} />,
                color: passRate >= 70 ? "bg-emerald-50 text-emerald-600" : passRate >= 50 ? "bg-amber-50 text-amber-600" : "bg-rose-50 text-rose-600",
              },
              {
                label: "Top Score", value: total > 0 ? `${highScore}%` : "—",
                sub:   total > 0 ? `Grade ${getGrade(highScore).grade}` : "—",
                icon:  <Award size={16} />,
                color: "bg-violet-50 text-violet-600",
              },
              {
                label: "Total Records", value: count,
                sub:   `${gradeDist.A}A · ${gradeDist.B}B · ${gradeDist.C}C · ${gradeDist.D}D · ${gradeDist.F}F`,
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

          {/* Grade distribution bar */}
          {total > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-black uppercase tracking-wider text-gray-400">Grade Distribution</p>
                <p className="text-xs text-gray-400">{total} total results</p>
              </div>
              <div className="flex gap-2 items-end h-12">
                {(["A","B","C","D","F"] as const).map((g) => {
                  const cnt = gradeDist[g];
                  const pct = total > 0 ? Math.round((cnt / total) * 100) : 0;
                  const barColors: Record<string, string> = {
                    A: "bg-emerald-400", B: "bg-blue-400",
                    C: "bg-amber-400",  D: "bg-orange-400", F: "bg-rose-400",
                  };
                  return (
                    <div key={g} className="flex-1 flex flex-col items-center gap-1">
                      <span className="text-[10px] font-black text-gray-400">{pct}%</span>
                      <div
                        className={`w-full rounded-t-lg ${barColors[g]}`}
                        style={{ height: `${Math.max(pct * 0.36, 4)}px` }}
                      />
                      <span className="text-[11px] font-black text-gray-600">{g}</span>
                      <span className="text-[9px] text-gray-400">{cnt}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Per-class average breakdown */}
          {classAverages.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-3.5 border-b border-gray-100">
                <p className="text-xs font-black uppercase tracking-wider text-gray-400">
                  Class Averages — {classAverages.length} classes
                </p>
              </div>
              <div className="divide-y divide-gray-50">
                {classAverages.map((cls) => (
                  <div key={cls.name} className="flex items-center gap-4 px-5 py-3">
                    {/* Class name */}
                    <span className="text-sm font-black text-gray-800 w-20 shrink-0">{cls.name}</span>

                    {/* Progress bar */}
                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${cls.grade.bar}`}
                        style={{ width: `${cls.avg}%` }}
                      />
                    </div>

                    {/* Avg score */}
                    <span className={`text-sm font-black w-12 text-right ${cls.grade.color}`}>
                      {cls.avg}%
                    </span>

                    {/* Grade badge */}
                    <span className={`text-xs font-black px-2.5 py-1 rounded-lg border w-10 text-center
                      ${cls.grade.bg} ${cls.grade.color} ${cls.grade.border}`}>
                      {cls.grade.grade}
                    </span>

                    {/* Count */}
                    <span className="text-[11px] text-gray-400 w-16 text-right shrink-0">
                      {cls.count} results
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── PARENT VIEW — simple pass rate card ── */}
      {role === "parent" && total > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Average Score", value: `${avgScore}%`, sub: `${avgGrade.label}`, color: `${avgGrade.bg} ${avgGrade.color}`, icon: <TrendingUp size={16} /> },
            { label: "Pass Rate",     value: `${passRate}%`, sub: `${passCount} passed`, color: "bg-emerald-50 text-emerald-600", icon: <CheckCircle2 size={16} /> },
            { label: "Best Score",    value: `${highScore}%`, sub: `Grade ${getGrade(highScore).grade}`, color: "bg-violet-50 text-violet-600", icon: <Award size={16} /> },
            { label: "Total Results", value: count, sub: "all assessments", color: "bg-indigo-50 text-indigo-600", icon: <ScrollText size={16} /> },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${s.color}`}>{s.icon}</div>
              <div>
                <p className="text-xl font-black text-gray-800 leading-none">{s.value}</p>
                <p className="text-xs text-gray-400 font-medium mt-0.5">{s.label}</p>
                <p className="text-[10px] text-gray-300">{s.sub}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Table ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex-1">
        <div className="px-5 py-3.5 border-b border-gray-100">
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

                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-black px-2.5 py-1 rounded-lg border
                          ${item.grade.bg} ${item.grade.color} ${item.grade.border}`}>
                          {item.score}
                        </span>
                        <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden hidden sm:block">
                          <div
                            className={`h-full rounded-full ${item.grade.bar}`}
                            style={{ width: `${item.score}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-4 hidden md:table-cell">
                      <div className="flex flex-col gap-0.5">
                        <span className={`text-sm font-black px-2.5 py-1 rounded-lg w-fit border
                          ${item.grade.bg} ${item.grade.color} ${item.grade.border}`}>
                          {item.grade.grade}
                        </span>
                        <span className="text-[10px] text-gray-400">{item.grade.label}</span>
                      </div>
                    </td>

                    <td className="px-4 py-4 hidden lg:table-cell">
                      <span className="text-sm text-gray-500">{item.teacherName} {item.teacherSurname}</span>
                    </td>

                    <td className="px-4 py-4 hidden lg:table-cell">
                      <span className="text-xs font-bold px-2 py-1 bg-gray-100 text-gray-600 rounded-lg">
                        {item.className}
                      </span>
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
