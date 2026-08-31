"use client";

// src/components/ReportCardView.tsx

import { useState } from "react";
import Image from "next/image";
import {
  Download,
  ArrowLeft,
  Award,
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  Star,
  Loader2,
} from "lucide-react";
import { getGradeBandByGrade, ordinal, TERM_LABELS } from "@/src/lib/caGrades";
import { formatMark } from "@/src/lib/formatters/marks";
import Link from "next/link";

// ─── Types ────────────────────────────────────────────────────────────────────
type SubjectRow = {
  id: number;
  name: string;
  classworkScore: number;
  examScore: number;
  totalScore: number;
  grade: string;
  gradePoint: number;
  label: string;
  position: number;
  remarks: string;
  isComplete: boolean;
  caChange: number;
  caTrend: "up" | "down" | "steady" | "new";
  hasNewerCARecord: boolean;
};

type Props = {
  branding: {
    displayName: string;
    shortName: string;
    primaryColor: string;
    logoUrl?: string | null;
  };
  student: {
    id: string;
    name: string;
    surname: string;
    img: string | null;
    sex: string;
    bloodType: string;
  };
  classInfo: {
    name: string;
    gradeLevel: string;
    supervisor: string;
    classSize: number;
  };
  parent: { name: string; surname: string; phone: string; email: string };
  term: string;
  academicYear: string;
  cwWeight: number;
  exWeight: number;
  subjectRows: SubjectRow[];
  openedCAUpdate?: {
    subjectName: string;
    activityTitle: string;
    openedAt: Date;
    isLatest: boolean;
  };
  overallStats: {
    aggregate: number;
    avgScore: number;
    totalRawScore: number;
    totalPossible: number;
    overallPosition: number;
    classSize: number;
    subjectCount: number;
    pendingSubjectCount: number;
  };
  attendance: { present: number; absent: number; late: number; total: number };
  role: string;
  publication: {
    isPublished: boolean;
    publishedAt?: Date | null;
  };
};

// ─── Performance narrative ─────────────────────────────────────────────────────
function getPerformanceNarrative(
  aggregate: number,
  avgScore: number,
  position: number,
  classSize: number,
) {
  if (aggregate <= 6 && avgScore >= 80)
    return {
      headline: "Outstanding Performance",
      body: `${position === 1 ? "Top of the class" : `Ranked ${ordinal(position)} in class`} with an exceptional aggregate of ${aggregate}. This student demonstrates mastery across all subjects.`,
      color: "text-emerald-700",
    };
  if (aggregate <= 12 && avgScore >= 65)
    return {
      headline: "Commendable Performance",
      body: `Ranked ${ordinal(position)} out of ${classSize} students with an aggregate of ${aggregate}. Strong understanding across most subjects, performing above average.`,
      color: "text-blue-700",
    };
  if (aggregate <= 18 && avgScore >= 55)
    return {
      headline: "Satisfactory Performance",
      body: `Ranked ${ordinal(position)} with an aggregate of ${aggregate}. A reasonable grasp of content. Consistent effort will lead to further improvement.`,
      color: "text-amber-700",
    };
  if (aggregate <= 24)
    return {
      headline: "Needs Improvement",
      body: `Ranked ${ordinal(position)} with an aggregate of ${aggregate}. Additional support and focused study are recommended. Parental involvement will be key.`,
      color: "text-orange-700",
    };
  return {
    headline: "Requires Urgent Attention",
    body: `Aggregate of ${aggregate} indicates significant academic challenges. Immediate intervention is strongly recommended.`,
    color: "text-rose-700",
  };
}

// ─── Grade badge ──────────────────────────────────────────────────────────────
function GradeBadge({ grade }: { grade: string }) {
  const band = getGradeBandByGrade(grade);
  return (
    <span
      className={`inline-flex items-center justify-center w-10 h-7 rounded-lg text-xs font-black border ${band.bg} ${band.color} ${band.border}`}
    >
      {grade}
    </span>
  );
}

// ─── Position badge ───────────────────────────────────────────────────────────
function PosBadge({ pos }: { pos: number }) {
  if (pos === 0) return <span className="text-gray-300 text-xs">—</span>;
  return (
    <span
      className={`text-xs font-black ${pos <= 3 ? "text-amber-600" : "text-gray-500"}`}
    >
      {ordinal(pos)}
    </span>
  );
}

// ─── Download button ──────────────────────────────────────────────────────────
function DownloadButton({
  studentId,
  term,
  academicYear,
  classId,
}: {
  studentId: string;
  term: string;
  academicYear: string;
  classId?: number;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDownload = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        studentId,
        term,
        year: academicYear,
        ...(classId ? { classId: String(classId) } : {}),
      });
      const res = await fetch(`/api/report-card/pdf?${params.toString()}`);
      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || "PDF generation failed");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `report-card-${studentId.slice(0, 6)}-${term}-${academicYear.replace("/", "-")}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Download failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handleDownload}
        disabled={loading}
        className="flex items-center gap-2 px-4 py-2 bg-gray-800 text-white rounded-xl text-sm font-bold hover:bg-gray-900 transition-colors disabled:opacity-60"
      >
        {loading ? (
          <>
            <Loader2 size={14} className="animate-spin" /> Generating PDF…
          </>
        ) : (
          <>
            <Download size={14} /> Download Report Card
          </>
        )}
      </button>
      {error && <p className="text-xs text-rose-500 font-semibold">{error}</p>}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
const ReportCardView = ({
  branding,
  student,
  classInfo,
  parent,
  term,
  academicYear,
  cwWeight,
  exWeight,
  subjectRows,
  openedCAUpdate,
  overallStats,
  attendance,
  role,
  publication,
}: Props) => {
  const reportReady =
    subjectRows.length > 0 && overallStats.pendingSubjectCount === 0;
  const canDownload = reportReady && publication.isPublished;
  const narrative = reportReady
    ? getPerformanceNarrative(
        overallStats.aggregate,
        overallStats.avgScore,
        overallStats.overallPosition,
        overallStats.classSize,
      )
    : {
        headline: "CA In Progress",
        body: "Class activity scores are being built from real teacher entries. End-of-term exams have not been recorded yet, so final totals, grades, aggregates, and positions are not ready.",
        color: "text-sky-700",
      };
  const attendanceRate =
    attendance.total > 0
      ? Math.round((attendance.present / attendance.total) * 100)
      : 0;

  // Try to get classId from URL (passed as query param from the page)
  const classId =
    typeof window !== "undefined"
      ? parseInt(
          new URLSearchParams(window.location.search).get("classId") ?? "",
        )
      : undefined;

  return (
    <div className="m-3 mt-0 flex flex-1 flex-col gap-4 sm:m-4 sm:mt-0">
      {/* ── Action bar ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Link
          href="/list/report-cards"
          className="flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-gray-700 transition-colors"
        >
          <ArrowLeft size={16} /> {role === "parent" ? "Back to results" : "Back to report cards"}
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          {/* Role badge */}
          <span
            className={`text-xs font-bold px-3 py-1.5 rounded-xl border
            ${
              role === "student"
                ? "bg-indigo-50 text-indigo-600 border-indigo-100"
                : role === "parent"
                  ? "bg-emerald-50 text-emerald-600 border-emerald-100"
                  : "bg-violet-50 text-violet-600 border-violet-100"
            }`}
          >
            {role === "student"
              ? "Student View"
              : role === "parent"
                ? "Parent View"
                : role === "teacher"
                  ? "Teacher View"
                  : "Admin View"}
          </span>
          {canDownload ? (
            <DownloadButton
              studentId={student.id}
              term={term}
              academicYear={academicYear}
              classId={isNaN(classId as number) ? undefined : classId}
            />
          ) : (
            <button
              type="button"
              disabled
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-400 rounded-xl text-sm font-bold"
            >
              <Download size={14} /> {reportReady ? "PDF pending approval" : "PDF pending exams"}
            </button>
          )}
        </div>
      </div>

      {/* ── Report Card (screen view) ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {/* School header */}
        <div
          className="relative overflow-hidden"
          style={{
            background:
              `linear-gradient(135deg, ${branding.primaryColor} 0%, #111827 100%)`,
          }}
        >
          <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full opacity-10 bg-white" />
          <div className="absolute -bottom-4 -left-4 w-24 h-24 rounded-full opacity-10 bg-white" />
          <div className="relative px-8 py-8 text-white">
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
              <div className="text-center sm:text-left flex-1">
                <p className="text-white/60 text-xs font-bold uppercase tracking-[0.2em] mb-1">
                  {branding.displayName}
                </p>
                <h1 className="text-2xl font-black tracking-tight">
                  ACADEMIC REPORT CARD
                </h1>
                <p className="text-white/70 text-sm mt-1 font-medium">
                  {TERM_LABELS[term]} · {academicYear} Academic Year
                </p>
              </div>
              <div className="text-center sm:text-right">
                <p className="text-white/50 text-[10px] font-bold uppercase tracking-widest">
                  Aggregate
                </p>
                <p className="text-5xl font-black text-white leading-none">
                  {reportReady ? overallStats.aggregate : "Pending"}
                </p>
                <p className="text-white/60 text-xs font-semibold mt-1">
                  {reportReady
                    ? `${ordinal(overallStats.overallPosition)} of ${overallStats.classSize}`
                    : "Exam scores not recorded"}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 sm:p-8 flex flex-col gap-6">
          {/* Student + class info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pb-6 border-b border-gray-100">
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center text-xl font-black text-indigo-600 shrink-0 overflow-hidden">
                {student.img ? (
                  <Image
                    unoptimized
                    src={student.img}
                    alt=""
                    width={64}
                    height={64}
                    className="w-full h-full object-cover rounded-2xl"
                  />
                ) : (
                  `${student.name[0]}${student.surname[0]}`
                )}
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-0.5">
                  Student
                </p>
                <p className="text-lg font-black text-gray-900">
                  {student.surname.toUpperCase()}, {student.name}
                </p>
                <p className="text-sm text-gray-500 mt-0.5">
                  {classInfo.gradeLevel} · {classInfo.name}
                </p>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="text-[10px] font-bold px-2 py-0.5 bg-gray-100 text-gray-500 rounded-lg">
                    {student.sex === "MALE" ? "Male" : "Female"}
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 bg-gray-100 text-gray-500 rounded-lg">
                    ID: {student.id.slice(0, 8).toUpperCase()}
                  </span>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: "Class Teacher", value: classInfo.supervisor },
                {
                  label: "Class Size",
                  value: `${classInfo.classSize} students`,
                },
                {
                  label: "Parent / Guardian",
                  value: parent.name ? `${parent.name} ${parent.surname}` : "—",
                },
                { label: "Contact", value: parent.phone || "—" },
              ].map((f) => (
                <div key={f.label}>
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">
                    {f.label}
                  </p>
                  <p className="text-sm font-bold text-gray-800">{f.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Weight pill */}
          <div className="flex items-center gap-3 p-3 bg-indigo-50 border border-indigo-100 rounded-xl">
            <div className="flex h-3 w-24 rounded-full overflow-hidden shrink-0">
              <div
                className="bg-indigo-500 h-full"
                style={{ width: `${cwWeight}%` }}
              />
              <div
                className="bg-emerald-500 h-full"
                style={{ width: `${exWeight}%` }}
              />
            </div>
            <p className="text-xs text-indigo-700 font-semibold">
              Scoring: <strong>{cwWeight}% Class Activities</strong> +{" "}
              <strong>{exWeight}% End-of-Term Exam</strong>
            </p>
          </div>

          {!reportReady && (
            <div className="rounded-xl border border-sky-100 bg-sky-50 px-4 py-3 text-sm font-semibold text-sky-800">
              CA is currently being built from teacher activity entries. Exam scores have not been recorded yet, so this page is a progress view, not a final report card.
            </div>
          )}

          {reportReady && !publication.isPublished && (
            <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
              Report scores are complete, but the final report card is waiting for admin approval before parents can download it.
            </div>
          )}

          {reportReady && publication.isPublished && (
            <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
              This final report card has been approved and published by the school.
            </div>
          )}

          {openedCAUpdate && (
            <div
              className={`rounded-xl border px-4 py-3 text-sm font-semibold ${
                openedCAUpdate.isLatest
                  ? "border-emerald-100 bg-emerald-50 text-emerald-800"
                  : "border-amber-100 bg-amber-50 text-amber-800"
              }`}
            >
              <p className="font-black">
                {openedCAUpdate.isLatest ? "Current CA update" : "Past CA update"}
              </p>
              <p className="mt-1">
                {openedCAUpdate.subjectName} - {openedCAUpdate.activityTitle}.
                {openedCAUpdate.isLatest
                  ? " This is the latest CA record for this subject."
                  : " A newer CA record exists, so parents should use the latest daily update for the current CA position."}
              </p>
            </div>
          )}

          {!reportReady && subjectRows.length > 0 && (
            <div className="rounded-2xl border border-gray-100 bg-white p-4">
              <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                    CA Progress Insight
                  </p>
                  <h2 className="text-base font-black text-gray-900">
                    Current activity progress before exams
                  </h2>
                </div>
                <p className="text-xs font-semibold text-gray-400">
                  Target CA: {cwWeight} marks
                </p>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {subjectRows.map((row) => {
                  const percent = Math.min(100, Math.round((row.classworkScore / Math.max(cwWeight, 1)) * 100));
                  const trendLabel =
                    row.caTrend === "up"
                      ? `Improving by ${formatMark(Math.abs(row.caChange))}`
                      : row.caTrend === "down"
                        ? `Dropping by ${formatMark(Math.abs(row.caChange))}`
                        : row.caTrend === "steady"
                          ? "Steady"
                          : "New CA record";
                  const trendClass =
                    row.caTrend === "up"
                      ? "text-emerald-700 bg-emerald-50"
                      : row.caTrend === "down"
                        ? "text-rose-700 bg-rose-50"
                        : "text-slate-600 bg-slate-50";

                  return (
                    <div key={row.id} className="rounded-xl border border-gray-100 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-black text-gray-900">{row.name}</p>
                        <p className="mt-0.5 text-xs font-semibold text-gray-400">
                          CA {formatMark(row.classworkScore)} / {formatMark(cwWeight)}
                        </p>
                        {row.hasNewerCARecord && (
                          <p className="mt-1 text-[10px] font-black uppercase tracking-wide text-amber-600">
                            Newer CA exists in the latest parent update
                          </p>
                        )}
                      </div>
                        <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${trendClass}`}>
                          {trendLabel}
                        </span>
                      </div>
                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-100">
                        <div className="h-full rounded-full bg-sky-500" style={{ width: `${percent}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Subject table */}
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-gray-400 mb-3">
              Subject Results
            </p>
            <div className="rounded-2xl border border-gray-100 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-wider text-gray-400">
                      Subject
                    </th>
                    <th className="text-center px-3 py-3 text-[10px] font-black uppercase tracking-wider text-gray-400">
                      CW ({cwWeight}%)
                    </th>
                    <th className="text-center px-3 py-3 text-[10px] font-black uppercase tracking-wider text-gray-400">
                      Exam ({exWeight}%)
                    </th>
                    <th className="text-center px-3 py-3 text-[10px] font-black uppercase tracking-wider text-gray-400">
                      Total
                    </th>
                    <th className="text-center px-3 py-3 text-[10px] font-black uppercase tracking-wider text-gray-400">
                      Grade
                    </th>
                    <th className="text-center px-3 py-3 text-[10px] font-black uppercase tracking-wider text-gray-400">
                      Pos.
                    </th>
                    <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-wider text-gray-400 hidden lg:table-cell">
                      Remark
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {subjectRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="text-center py-10 text-gray-300 font-semibold text-sm"
                      >
                        No CA records for this term
                      </td>
                    </tr>
                  ) : (
                    subjectRows.map((row) => {
                      const band = row.isComplete ? getGradeBandByGrade(row.grade) : null;
                      return (
                        <tr key={row.id} className="hover:bg-gray-50/50">
                          <td className="px-4 py-3 font-bold text-gray-800">
                            {row.name}
                          </td>
                          <td className="px-3 py-3 text-center font-semibold text-gray-600">
                            {formatMark(row.classworkScore)}
                          </td>
                          <td className="px-3 py-3 text-center font-semibold text-gray-600">
                            {row.examScore.toFixed(1)}
                          </td>
                          <td className="px-3 py-3 text-center">
                            {row.isComplete && band ? (
                              <span className={`font-black text-sm ${band.color}`}>
                                {row.totalScore.toFixed(1)}
                              </span>
                            ) : (
                              <span className="text-xs font-black text-sky-600">Pending</span>
                            )}
                          </td>
                          <td className="px-3 py-3 text-center">
                            {row.isComplete ? (
                              <GradeBadge grade={row.grade} />
                            ) : (
                              <span className="rounded-lg border border-sky-100 bg-sky-50 px-2 py-1 text-[10px] font-black text-sky-700">
                                CA in build
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-3 text-center">
                            {row.isComplete ? <PosBadge pos={row.position} /> : <span className="text-xs text-gray-300">-</span>}
                          </td>
                          <td className="px-4 py-3 hidden lg:table-cell">
                            <span className="text-xs text-gray-400 italic">
                              {row.isComplete && band
                                ? row.remarks || band.label
                                : "Exam not recorded yet. Current CA is still building."}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
                {subjectRows.length > 0 && (
                  <tfoot>
                    <tr className="bg-indigo-50 border-t-2 border-indigo-100">
                      <td className="px-4 py-3 font-black text-indigo-900">
                        TOTAL / AVERAGE
                      </td>
                      <td className="px-3 py-3 text-center text-indigo-400">
                        —
                      </td>
                      <td className="px-3 py-3 text-center text-indigo-400">
                        —
                      </td>
                      <td className="px-3 py-3 text-center font-black text-indigo-900">
                        {reportReady
                          ? `${overallStats.totalRawScore.toFixed(1)} / ${overallStats.totalPossible}`
                          : "Pending"}
                      </td>
                      <td className="px-3 py-3 text-center font-black text-indigo-900">
                        {reportReady ? `${overallStats.avgScore.toFixed(1)}%` : "Pending"}
                      </td>
                      <td
                        className="px-3 py-3 text-center font-black text-indigo-900"
                        colSpan={2}
                      >
                        Agg:{" "}
                        <span className="text-lg">
                          {reportReady ? overallStats.aggregate : "Pending"}
                        </span>
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

          {/* Grade scale */}
          <div className="grid grid-cols-3 sm:grid-cols-9 gap-1.5">
            {[
              {
                g: "A1",
                r: "≥90",
                c: "bg-emerald-50 text-emerald-700 border-emerald-200",
              },
              {
                g: "B2",
                r: "≥80",
                c: "bg-teal-50 text-teal-700 border-teal-200",
              },
              {
                g: "B3",
                r: "≥75",
                c: "bg-blue-50 text-blue-700 border-blue-200",
              },
              { g: "C4", r: "≥70", c: "bg-sky-50 text-sky-700 border-sky-200" },
              {
                g: "C5",
                r: "≥65",
                c: "bg-amber-50 text-amber-700 border-amber-200",
              },
              {
                g: "C6",
                r: "≥60",
                c: "bg-yellow-50 text-yellow-700 border-yellow-200",
              },
              {
                g: "D7",
                r: "≥55",
                c: "bg-orange-50 text-orange-700 border-orange-200",
              },
              { g: "E8", r: "≥50", c: "bg-red-50 text-red-700 border-red-200" },
              {
                g: "F9",
                r: "<50",
                c: "bg-rose-50 text-rose-700 border-rose-200",
              },
            ].map((b) => (
              <div
                key={b.g}
                className={`text-center py-1.5 rounded-xl border text-[10px] font-black ${b.c}`}
              >
                <div>{b.g}</div>
                <div className="opacity-60 font-semibold">{b.r}</div>
              </div>
            ))}
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              {
                label: "Overall Average",
                value: reportReady ? `${overallStats.avgScore.toFixed(1)}%` : "Pending",
                sub: reportReady
                  ? `${overallStats.subjectCount} completed subjects`
                  : `${overallStats.pendingSubjectCount} CA subject${overallStats.pendingSubjectCount === 1 ? "" : "s"} in build`,
                icon: <TrendingUp size={15} />,
                color: "bg-indigo-50 text-indigo-600",
              },
              {
                label: "Aggregate Score",
                value: reportReady ? overallStats.aggregate : "Pending",
                sub: reportReady ? "Ghana BECE system" : "Waiting for exams",
                icon: <Award size={15} />,
                color: "bg-amber-50 text-amber-600",
              },
              {
                label: "Class Position",
                value: reportReady ? ordinal(overallStats.overallPosition) : "Pending",
                sub: reportReady ? `out of ${overallStats.classSize} students` : "Waiting for exams",
                icon: <Star size={15} />,
                color: "bg-violet-50 text-violet-600",
              },
              {
                label: "Attendance Rate",
                value: `${attendanceRate}%`,
                sub: `${attendance.present} present · ${attendance.absent} absent`,
                icon: <CheckCircle2 size={15} />,
                color:
                  attendanceRate >= 80
                    ? "bg-emerald-50 text-emerald-600"
                    : "bg-rose-50 text-rose-600",
              },
            ].map((s) => (
              <div
                key={s.label}
                className="flex min-w-0 items-center gap-3 rounded-2xl border border-gray-100 bg-white p-4"
              >
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${s.color}`}
                >
                  {s.icon}
                </div>
                <div className="min-w-0">
                  <p className="break-words text-lg font-black leading-none text-gray-800">
                    {s.value}
                  </p>
                  <p className="text-[10px] font-bold text-gray-400 mt-0.5">
                    {s.label}
                  </p>
                  <p className="text-[9px] text-gray-300 mt-0.5">{s.sub}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Attendance bar */}
          <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3">
              Attendance Summary
            </p>
            <div className="flex items-center gap-2 mb-2">
              <div className="flex-1 h-3 bg-gray-200 rounded-full overflow-hidden flex">
                <div
                  className="bg-emerald-500 h-full"
                  style={{
                    width: `${(attendance.present / Math.max(attendance.total, 1)) * 100}%`,
                  }}
                />
                <div
                  className="bg-amber-400 h-full"
                  style={{
                    width: `${(attendance.late / Math.max(attendance.total, 1)) * 100}%`,
                  }}
                />
                <div
                  className="bg-rose-400 h-full"
                  style={{
                    width: `${(attendance.absent / Math.max(attendance.total, 1)) * 100}%`,
                  }}
                />
              </div>
              <span className="text-xs font-black text-gray-600">
                {attendanceRate}%
              </span>
            </div>
            <div className="flex flex-wrap gap-3 text-[10px] font-bold text-gray-500 sm:gap-4">
              {[
                {
                  label: `Present: ${attendance.present}`,
                  color: "bg-emerald-500",
                },
                { label: `Late: ${attendance.late}`, color: "bg-amber-400" },
                { label: `Absent: ${attendance.absent}`, color: "bg-rose-400" },
                { label: `Total: ${attendance.total}`, color: "bg-gray-300" },
              ].map((a) => (
                <span key={a.label} className="flex items-center gap-1">
                  <span
                    className={`w-2 h-2 rounded-full inline-block ${a.color}`}
                  />
                  {a.label}
                </span>
              ))}
            </div>
          </div>

          {/* Performance evaluation */}
          <div className="p-5 rounded-2xl border-l-4 border-indigo-500 bg-indigo-50/50">
            <div className="flex items-start gap-3">
              <Star size={18} className="text-indigo-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-indigo-400 mb-1">
                  Performance Evaluation
                </p>
                <p className={`text-sm font-black mb-1.5 ${narrative.color}`}>
                  {narrative.headline}
                </p>
                <p className="text-xs text-gray-600 leading-relaxed">
                  {narrative.body}
                </p>
              </div>
            </div>
          </div>

          {/* Parent / student insight */}
          {(role === "parent" || role === "student") &&
            subjectRows.some((row) => row.isComplete) &&
            (() => {
              const completedRows = subjectRows.filter((row) => row.isComplete);
              const best = [...completedRows].sort(
                (a, b) => a.gradePoint - b.gradePoint,
              )[0];
              const worst = [...completedRows].sort(
                (a, b) => b.gradePoint - a.gradePoint,
              )[0];
              return (
                <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-100">
                  <p className="text-[10px] font-black uppercase tracking-widest text-emerald-500 mb-3">
                    {role === "parent" ? "Parent Notice" : "Your Progress"}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="flex items-start gap-2">
                      <CheckCircle2
                        size={14}
                        className="text-emerald-600 shrink-0 mt-0.5"
                      />
                      <div>
                        <p className="text-xs font-black text-emerald-800">
                          Strongest Subject
                        </p>
                        <p className="text-xs text-emerald-700">
                          <strong>{best.name}</strong> — {best.grade} (
                          {best.totalScore.toFixed(1)}%)
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <AlertCircle
                        size={14}
                        className="text-amber-500 shrink-0 mt-0.5"
                      />
                      <div>
                        <p className="text-xs font-black text-amber-800">
                          Needs More Attention
                        </p>
                        <p className="text-xs text-amber-700">
                          <strong>{worst.name}</strong> — {worst.grade} (
                          {worst.totalScore.toFixed(1)}%)
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

          {/* Signatures */}
          <div className="grid grid-cols-1 gap-6 border-t border-gray-100 pt-6 sm:grid-cols-3">
            {[
              "Class Teacher",
              "Head Teacher / Principal",
              "Parent / Guardian",
            ].map((label) => (
              <div key={label} className="flex flex-col gap-8">
                <div className="h-10 border-b-2 border-gray-300 border-dashed" />
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 text-center -mt-6">
                  {label}
                </p>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="flex flex-col gap-1 border-t border-gray-100 pt-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[9px] text-gray-300 font-semibold">
              Generated{" "}
              {new Date().toLocaleDateString("en-GH", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>
            <p className="text-[9px] font-semibold text-gray-300 sm:text-right">
              {branding.shortName} - {student.surname.toUpperCase()}, {student.name}{" "}
              - {classInfo.name} - {TERM_LABELS[term]} {academicYear}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportCardView;
