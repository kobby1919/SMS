// src/app/(dashboard)/list/results/page.tsx
// Results page — now wired to ContinuousAssessment.totalScore + .grade
// instead of raw Result.score. Legacy Result records are kept but the
// primary source of truth for grades is now the CA system.

import Pagination from "@/src/components/pagination";
import { requirePageSession } from "@/src/lib/authz";
import TableSearch from "@/src/components/TableSearch";
import { ScrollText, TrendingUp, Award, CheckCircle2 } from "lucide-react";
import prisma from "@/src/lib/prisma";
import { ITEM_PER_PAGE } from "@/src/lib/settings";
import { getGradeBandByGrade, TERM_LABELS } from "@/src/lib/caGrades";
import Link from "next/link";
import type { Prisma, Term } from "@/src/generated/prisma";

export const dynamic = "force-dynamic";

const ResultListPage = async ({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) => {
  const { userId, role, schoolId } = await requirePageSession();
  const currentUserId = userId;

  const { page, ...queryParams } = await searchParams;
  const p = page ? parseInt(page) : 1;

  // ── Build CA query ────────────────────────────────────────────────────────
  const where: Prisma.ContinuousAssessmentWhereInput = { schoolId };

  if (queryParams.search) {
    where.OR = [
      { subject: { name: { contains: queryParams.search, mode: "insensitive" } } },
      { student: { name:    { contains: queryParams.search, mode: "insensitive" } } },
      { student: { surname: { contains: queryParams.search, mode: "insensitive" } } },
    ];
  }

  if (queryParams.studentId) where.studentId = queryParams.studentId;
  if (queryParams.term)       where.term       = queryParams.term as Term;
  if (queryParams.year)       where.academicYear = queryParams.year;

  // Role scoping
  switch (role) {
    case "teacher":
      // Show CA records for classes this teacher supervises
      where.class = { supervisorId: currentUserId! };
      break;
    case "student":
      where.studentId = currentUserId!;
      break;
    case "parent":
      where.student = { parentId: currentUserId! };
      break;
  }

  // ── Paginated CA records ──────────────────────────────────────────────────
  const [caRecords, count] = await Promise.all([
    prisma.continuousAssessment.findMany({
      where,
      include: {
        student: { select: { name: true, surname: true, class: { select: { name: true } } } },
        subject: { select: { name: true } },
        teacher: { select: { name: true, surname: true } },
      },
      orderBy: { totalScore: "desc" },
      take:    ITEM_PER_PAGE,
      skip:    ITEM_PER_PAGE * (p - 1),
    }),
    prisma.continuousAssessment.count({ where }),
  ]);

  // ── All records for stats (un-paginated) ──────────────────────────────────
  const allRecords = await prisma.continuousAssessment.findMany({
    where,
    select: {
      totalScore:  true,
      gradePoint:  true,
      grade:       true,
      studentId:   true,
      classId:     true,
      student: { select: { class: { select: { name: true } } } },
    },
  });

  const scores     = allRecords.map((r) => r.totalScore);
  const total      = scores.length;
  const avgScore   = total > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / total) : 0;
  const passCount  = scores.filter((s) => s >= 50).length;
  const failCount  = total - passCount;
  const passRate   = total > 0 ? Math.round((passCount / total) * 100) : 0;
  const highScore  = total > 0 ? Math.max(...scores) : 0;

  // Grade distribution
  const gradeDist: Record<string, number> = {};
  for (const r of allRecords) {
    gradeDist[r.grade] = (gradeDist[r.grade] ?? 0) + 1;
  }
  const a1Count = gradeDist["A1"] ?? 0;
  const b2Count = (gradeDist["B2"] ?? 0) + (gradeDist["B3"] ?? 0);
  const cCount  = (gradeDist["C4"] ?? 0) + (gradeDist["C5"] ?? 0) + (gradeDist["C6"] ?? 0);
  const failGrd = (gradeDist["D7"] ?? 0) + (gradeDist["E8"] ?? 0) + (gradeDist["F9"] ?? 0);

  // Per-class averages (admin/teacher)
  const classBuckets: Record<string, number[]> = {};
  for (const r of allRecords) {
    const cn = r.student?.class?.name ?? "Unknown";
    if (!classBuckets[cn]) classBuckets[cn] = [];
    classBuckets[cn].push(r.totalScore);
  }
  const classAverages = Object.entries(classBuckets)
    .map(([name, s]) => ({
      name,
      avg:   Math.round(s.reduce((a, b) => a + b, 0) / s.length),
      count: s.length,
    }))
    .sort((a, b) => b.avg - a.avg);

  const avgBand  = getGradeBandByGrade(
    avgScore >= 90 ? "A1" : avgScore >= 80 ? "B2" : avgScore >= 75 ? "B3" :
    avgScore >= 70 ? "C4" : avgScore >= 65 ? "C5" : avgScore >= 60 ? "C6" :
    avgScore >= 55 ? "D7" : avgScore >= 50 ? "E8" : "F9"
  );

  // Available terms/years for filter dropdowns
  const configs = await prisma.cAConfig.findMany({ where: { schoolId }, orderBy: { academicYear: "desc" } });
  const years   = configs.map((c) => c.academicYear);

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
              <h1 className="text-xl font-black text-gray-800 tracking-tight">CA Results</h1>
              <p className="text-sm text-gray-400 mt-0.5 font-medium">
                {count} records · {passRate}% pass rate · powered by Continuous Assessment
              </p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
            <TableSearch />
            <div className="flex items-center gap-2">
              {/* Term filter */}
              <select
                className="appearance-none ring-[1.5px] ring-gray-200 px-3 py-2 rounded-xl text-sm font-semibold text-gray-600 outline-none bg-white"
                defaultValue={queryParams.term ?? ""}
              >
                <option value="">All Terms</option>
                {Object.entries(TERM_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
              {/* Year filter */}
              <select
                className="appearance-none ring-[1.5px] ring-gray-200 px-3 py-2 rounded-xl text-sm font-semibold text-gray-600 outline-none bg-white"
                defaultValue={queryParams.year ?? ""}
              >
                <option value="">All Years</option>
                {years.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
              {(role === "admin" || role === "teacher") && (
                <Link
                  href="/list/ca"
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 transition-colors shadow-sm"
                >
                  + Enter CA
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Stats (admin/teacher) ── */}
      {(role === "admin" || role === "teacher") && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              {
                label: "School Average", value: total > 0 ? `${avgScore}%` : "—",
                sub: total > 0 ? `${avgBand.grade} · ${avgBand.label}` : "No data",
                icon: <TrendingUp size={16} />, color: `${avgBand.bg} ${avgBand.color}`,
              },
              {
                label: "Pass Rate", value: total > 0 ? `${passRate}%` : "—",
                sub: `${passCount} passed · ${failCount} failed`,
                icon: <CheckCircle2 size={16} />,
                color: passRate >= 70 ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600",
              },
              {
                label: "Top Score", value: total > 0 ? `${highScore.toFixed(1)}%` : "—",
                sub: "Highest weighted total",
                icon: <Award size={16} />, color: "bg-violet-50 text-violet-600",
              },
              {
                label: "Total Records", value: count,
                sub: `A1: ${a1Count} · B: ${b2Count} · C: ${cCount} · Fail: ${failGrd}`,
                icon: <ScrollText size={16} />, color: "bg-indigo-50 text-indigo-600",
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

          {/* Class averages */}
          {classAverages.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-3.5 border-b border-gray-100">
                <p className="text-xs font-black uppercase tracking-wider text-gray-400">
                  Class Averages (CA Totals)
                </p>
              </div>
              <div className="divide-y divide-gray-50">
                {classAverages.map((cls) => {
                  const band = getGradeBandByGrade(
                    cls.avg >= 90 ? "A1" : cls.avg >= 80 ? "B2" : cls.avg >= 75 ? "B3" :
                    cls.avg >= 70 ? "C4" : cls.avg >= 65 ? "C5" : cls.avg >= 60 ? "C6" :
                    cls.avg >= 55 ? "D7" : cls.avg >= 50 ? "E8" : "F9"
                  );
                  return (
                    <div key={cls.name} className="flex items-center gap-4 px-5 py-3">
                      <span className="text-sm font-black text-gray-800 w-20 shrink-0">{cls.name}</span>
                      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${band.bar}`} style={{ width: `${cls.avg}%` }} />
                      </div>
                      <span className={`text-sm font-black w-12 text-right ${band.color}`}>{cls.avg}%</span>
                      <span className={`text-xs font-black px-2.5 py-1 rounded-lg border w-10 text-center ${band.bg} ${band.color} ${band.border}`}>
                        {band.grade}
                      </span>
                      <span className="text-[11px] text-gray-400 w-16 text-right shrink-0">{cls.count} records</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Student view: personal average ── */}
      {role === "student" && total > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-black uppercase tracking-wider text-gray-400">My Performance</h2>
            {caRecords[0] && (
              <Link
                href={`/list/report-cards/${currentUserId}?term=${caRecords[0].term}&year=${caRecords[0].academicYear}`}
                className="flex items-center gap-1.5 text-xs font-bold text-violet-600 hover:text-violet-700"
              >
                View Report Card <Award size={12} />
              </Link>
            )}
          </div>
          <div className="flex items-center gap-4">
            <div className={`w-16 h-16 rounded-2xl flex flex-col items-center justify-center ${avgBand.bg}`}>
              <span className={`text-2xl font-black ${avgBand.color}`}>{avgBand.grade}</span>
            </div>
            <div className="flex-1">
              <p className={`text-3xl font-black ${avgBand.color}`}>{avgScore}%</p>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden mt-2 max-w-xs">
                <div className={`h-full rounded-full ${avgBand.bar}`} style={{ width: `${avgScore}%` }} />
              </div>
              <p className="text-xs text-gray-400 mt-1">{total} records · best: {highScore.toFixed(1)}%</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Table ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex-1">
        <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
          <p className="text-xs font-black uppercase tracking-wider text-gray-400">
            All Records — {count} entries
          </p>
          <p className="text-[10px] text-gray-300 font-semibold">Showing CA weighted totals</p>
        </div>
        <div className="w-full overflow-x-auto">
          <table className="w-full min-w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60">
                <th className="text-left px-5 py-3.5 text-xs font-black uppercase tracking-wider text-gray-400">Student</th>
                <th className="text-left px-4 py-3.5 text-xs font-black uppercase tracking-wider text-gray-400">Subject</th>
                <th className="text-center px-4 py-3.5 text-xs font-black uppercase tracking-wider text-gray-400">CW</th>
                <th className="text-center px-4 py-3.5 text-xs font-black uppercase tracking-wider text-gray-400">Exam</th>
                <th className="text-center px-4 py-3.5 text-xs font-black uppercase tracking-wider text-gray-400">Total</th>
                <th className="text-center px-4 py-3.5 text-xs font-black uppercase tracking-wider text-gray-400">Grade</th>
                <th className="text-left px-4 py-3.5 text-xs font-black uppercase tracking-wider text-gray-400 hidden lg:table-cell">Term / Year</th>
                <th className="text-left px-4 py-3.5 text-xs font-black uppercase tracking-wider text-gray-400 hidden lg:table-cell">Teacher</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {caRecords.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-16">
                    <ScrollText size={32} className="text-gray-200 mx-auto mb-3" />
                    <p className="text-gray-400 font-semibold text-sm">No CA records found</p>
                    {(role === "admin" || role === "teacher") && (
                      <Link href="/list/ca" className="text-indigo-500 text-sm font-bold mt-2 inline-block hover:text-indigo-700">
                        → Go to CA Entry
                      </Link>
                    )}
                  </td>
                </tr>
              ) : (
                caRecords.map((item) => {
                  const band = getGradeBandByGrade(item.grade);
                  return (
                    <tr key={item.id} className="hover:bg-indigo-50/30 transition-colors group">
                      <td className="px-5 py-4">
                        <p className="font-bold text-sm text-gray-800">
                          {item.student?.surname} {item.student?.name}
                        </p>
                        <p className="text-[11px] text-gray-400">{item.student?.class?.name}</p>
                      </td>
                      <td className="px-4 py-4">
                        <p className="font-bold text-sm text-gray-700">{item.subject.name}</p>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className="text-sm font-semibold text-gray-600">{item.classworkScore.toFixed(1)}</span>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className="text-sm font-semibold text-gray-600">{item.examScore.toFixed(1)}</span>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className={`text-sm font-black px-2.5 py-1 rounded-lg border ${band.bg} ${band.color} ${band.border}`}>
                          {item.totalScore.toFixed(1)}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <div className="flex flex-col items-center gap-0.5">
                          <span className={`text-sm font-black px-2.5 py-1 rounded-lg border ${band.bg} ${band.color} ${band.border}`}>
                            {item.grade}
                          </span>
                          <span className="text-[9px] text-gray-400">{band.label}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4 hidden lg:table-cell">
                        <p className="text-xs font-bold text-gray-600">{TERM_LABELS[item.term]}</p>
                        <p className="text-[10px] text-gray-400">{item.academicYear}</p>
                      </td>
                      <td className="px-4 py-4 hidden lg:table-cell">
                        <span className="text-sm text-gray-500">
                          {item.teacher.name} {item.teacher.surname}
                        </span>
                      </td>
                    </tr>
                  );
                })
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
