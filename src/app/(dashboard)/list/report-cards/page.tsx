// src/app/(dashboard)/list/report-cards/page.tsx
 

import { redirect } from "next/navigation";
import prisma from "@/src/lib/prisma";
import { requirePageSession } from "@/src/lib/authz";
import Link from "next/link";
import Image from "next/image";
import {
  FileText,
  AlertTriangle,
  ChevronRight,
  CheckCircle2,
  Clock,
  Trophy,
} from "lucide-react";
import {
  getGradeBandByGrade,
  computeAggregate,
  ordinal,
  TERM_LABELS,
} from "@/src/lib/caGrades";
import ReportCardFilters from "@/src/components/ReportCardFilters";
import { listClassSubjectsFromTimetable } from "@/src/lib/services/timetable";
import { getActiveAcademicPeriod } from "@/src/lib/services/academic-period";
import { formatMark } from "@/src/lib/formatters/marks";
import type { Term } from "@/src/generated/prisma";

export const dynamic = "force-dynamic";

const VALID_TERMS = new Set<Term>(["TERM_1", "TERM_2", "TERM_3"]);

function termFromParam(value?: string): Term | null {
  return value && VALID_TERMS.has(value as Term) ? value as Term : null;
}

const ReportCardListPage = async ({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) => {
  const { userId, role, schoolId } = await requirePageSession();

  const params = await searchParams;
  const selectedClassId = params.classId ? parseInt(params.classId) : null;
  const requestedTerm = termFromParam(params.term);
  const selectedYear = params.year ?? "";
  const selectedChildId = params.childId;
  const activePeriod = await getActiveAcademicPeriod(schoolId);

  if (role === "student") {
    const selectedTerm = requestedTerm ?? activePeriod.currentTerm;
    const activeYear = selectedYear || activePeriod.academicYear;
    redirect(
      `/list/report-cards/${userId}?term=${selectedTerm}&year=${activeYear}`,
    );
  }
  // 3. Handle Parent with Multiple Children
  if (role === "parent") {
    const [children, configs] = await Promise.all([
      prisma.student.findMany({
        where: { schoolId, parentId: userId },
        select: {
          id: true,
          name: true,
          surname: true,
          img: true,
          classId: true,
          class: { select: { name: true } },
        },
        orderBy: [{ name: "asc" }, { surname: "asc" }],
      }),
      prisma.cAConfig.findMany({ where: { schoolId }, orderBy: { academicYear: "desc" } }),
    ]);

    if (children.length === 0) redirect("/");
    const visibleChildren = selectedChildId
      ? children.filter((child) => child.id === selectedChildId)
      : children;
    const safeVisibleChildren = visibleChildren.length > 0 ? visibleChildren : children;
    const childIds = safeVisibleChildren.map((child) => child.id);
    const selectedTerm = requestedTerm ?? activePeriod.currentTerm;
    const activeYear = selectedYear || activePeriod.academicYear || configs[0]?.academicYear || "2025/26";
    const config = configs.find((item) => item.academicYear === activeYear);
    const cwWeight = config?.classworkWeight ?? 30;
    const classIds = [...new Set(safeVisibleChildren.map((child) => child.classId))];
    const [caRecords, subjectsByClass] = await Promise.all([
      prisma.continuousAssessment.findMany({
        where: {
          schoolId,
          studentId: { in: childIds },
          term: selectedTerm as Term,
          academicYear: activeYear,
        },
        include: { subject: { select: { id: true, name: true } } },
        orderBy: { subject: { name: "asc" } },
      }),
      listClassSubjectsFromTimetable(schoolId, classIds),
    ]);

    return (
      <div className="m-3 mt-0 flex flex-1 flex-col gap-4 sm:m-4 sm:mt-0">
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                <FileText size={20} />
              </div>
              <div>
                <h1 className="text-xl font-black text-gray-900">Ward Results</h1>
                <p className="mt-0.5 text-sm font-semibold text-gray-400">
                  Report-card building summary for {TERM_LABELS[selectedTerm]} - {activeYear}
                </p>
              </div>
            </div>
          </div>
        </div>

        <section className="grid gap-3 lg:grid-cols-2">
          {safeVisibleChildren.map((child) => {
            const subjects = subjectsByClass.get(child.classId) ?? new Map<number, string>();
            const records = caRecords.filter((record) => record.studentId === child.id);
            const recordsBySubject = new Map(records.map((record) => [record.subjectId, record]));
            const subjectRows = subjects.size > 0
              ? Array.from(subjects.entries()).map(([subjectId, subjectName]) => ({
                  subjectId,
                  subjectName,
                  record: recordsBySubject.get(subjectId),
                }))
              : records.map((record) => ({
                  subjectId: record.subjectId,
                  subjectName: record.subject.name,
                  record,
                }));
            const reportReady = records.filter((record) => record.examScore > 0);
            const caStarted = records.length;
            const subjectTotal = subjectRows.length;
            const avgCA = caStarted
              ? records.reduce((sum, record) => sum + record.classworkScore, 0) / caStarted
              : 0;

            return (
              <article key={child.id} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-blue-50 text-sm font-black text-blue-700">
                    {child.img ? (
                      <Image
                        unoptimized
                        src={child.img}
                        alt=""
                        width={48}
                        height={48}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      `${child.name[0]}${child.surname[0]}`
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-base font-black text-gray-900">{child.name} {child.surname}</h2>
                    <p className="mt-0.5 text-xs font-bold text-gray-400">{child.class.name}</p>
                  </div>
                  <span className="rounded-full bg-sky-50 px-2 py-1 text-[10px] font-black text-sky-700">
                    {caStarted}/{subjectTotal || caStarted} CA
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <div className="rounded-xl bg-sky-50 p-3 text-sky-700">
                    <p className="text-sm font-black">{caStarted}/{subjectTotal || caStarted}</p>
                    <p className="text-[10px] font-black uppercase">CA started</p>
                  </div>
                  <div className="rounded-xl bg-blue-50 p-3 text-blue-700">
                    <p className="text-sm font-black">{reportReady.length}/{subjectTotal || reportReady.length}</p>
                    <p className="text-[10px] font-black uppercase">Reports ready</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3 text-slate-700">
                    <p className="text-sm font-black">{formatMark(avgCA)}/{formatMark(cwWeight)}</p>
                    <p className="text-[10px] font-black uppercase">Avg CA</p>
                  </div>
                </div>

                <div className="mt-4 rounded-xl border border-gray-100">
                  <div className="border-b border-gray-100 px-3 py-2">
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Report building summary</p>
                  </div>
                  <div className="divide-y divide-gray-50">
                    {subjectRows.length > 0 ? subjectRows.map(({ subjectId, subjectName, record }) => (
                      <div key={subjectId} className="flex flex-col gap-1 px-3 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-xs font-black text-gray-900">{subjectName}</p>
                          <p className="text-[10px] font-semibold text-gray-400">
                            {record?.examScore && record.examScore > 0 ? "Report score ready" : record ? "CA building, exam pending" : "No CA yet"}
                          </p>
                        </div>
                        <p className="shrink-0 text-xs font-black text-sky-700">
                          {record ? `${formatMark(record.classworkScore)}/${formatMark(cwWeight)}` : "-"}
                        </p>
                      </div>
                    )) : (
                      <p className="px-3 py-3 text-xs font-semibold text-gray-400">No class subjects have been linked yet.</p>
                    )}
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
                  <Link
                    href={`/list/report-cards/${child.id}?term=${selectedTerm}&year=${activeYear}&classId=${child.classId}`}
                    className="rounded-xl bg-slate-900 px-3 py-2 text-center text-xs font-black text-white"
                  >
                    Open full report
                  </Link>
                  {selectedChildId && (
                    <Link
                      href="/list/report-cards"
                      className="rounded-xl border border-gray-200 px-3 py-2 text-center text-xs font-black text-gray-600"
                    >
                      Show all wards
                    </Link>
                  )}
                  <Link
                    href={`/parent/children/${child.id}`}
                    className="rounded-xl border border-gray-200 px-3 py-2 text-center text-xs font-black text-gray-600"
                  >
                    Open ward checkup
                  </Link>
                </div>
              </article>
            );
          })}
        </section>

        <div className="rounded-2xl border border-sky-100 bg-sky-50 p-4">
          <p className="text-sm font-black text-sky-900">How to read this</p>
          <p className="mt-1 text-xs font-semibold leading-relaxed text-sky-700">
            CA shows the continuous assessment marks collected so far. A report becomes ready when the exam score is added. This helps parents see how the report card is being built before the end of term.
          </p>
        </div>
      </div>
    );
  }

  // 3. Admin/Teacher Check (Only they see the list view)
  if (role !== "admin" && role !== "teacher") {
    redirect("/");
  }

  // ── Classes this user can access ─────────────────────────────────────────
  const supervisedClasses =
    role === "admin"
      ? await prisma.class.findMany({
          where: { schoolId },
          orderBy: { name: "asc" },
          include: { grade: { select: { level: true } } },
        })
      : await prisma.class.findMany({
          where: { schoolId, supervisorId: userId },
          orderBy: { name: "asc" },
          include: { grade: { select: { level: true } } },
        });

  if (supervisedClasses.length === 0) {
    return (
      <div className="flex-1 m-4 flex flex-col items-center justify-center gap-4 text-center">
        <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center">
          <AlertTriangle size={28} className="text-amber-500" />
        </div>
        <h2 className="text-xl font-black text-gray-800">
          No Classes Assigned
        </h2>
        <p className="text-sm text-gray-400 max-w-xs">
          {role === "teacher"
            ? "You are not assigned as supervisor to any class."
            : "No classes exist yet."}
        </p>
      </div>
    );
  }

  const activeClassId = selectedClassId ?? supervisedClasses[0].id;
  const activeClass =
    supervisedClasses.find((c) => c.id === activeClassId) ??
    supervisedClasses[0];

  // ── Academic years from configs ───────────────────────────────────────────
  const configs = await prisma.cAConfig.findMany({
    where: { schoolId },
    orderBy: { academicYear: "desc" },
  });
  const academicYears =
    configs.length > 0
      ? configs.map((c) => c.academicYear)
      : ["2024/25", "2025/26"];
  const selectedTerm = requestedTerm ?? activePeriod.currentTerm;
  const activeYear = selectedYear || activePeriod.academicYear || academicYears[0] || "2025/26";

  // ── Config for this year ──────────────────────────────────────────────────
  const config = await prisma.cAConfig.findUnique({
    where: { schoolId_academicYear: { schoolId, academicYear: activeYear } },
  });

  // ── Students in this class ────────────────────────────────────────────────
  const students = await prisma.student.findMany({
    where: { schoolId, classId: activeClass.id },
    orderBy: [{ surname: "asc" }, { name: "asc" }],
    select: { id: true, name: true, surname: true, img: true, sex: true },
  });

  // ── CA records for this class / term / year ───────────────────────────────
  const caRecords = await prisma.continuousAssessment.findMany({
    where: {
      classId: activeClass.id,
      schoolId,
      term: selectedTerm as Term,
      academicYear: activeYear,
    },
    select: {
      studentId: true,
      subjectId: true,
      totalScore: true,
      grade: true,
      gradePoint: true,
    },
  });

  // ── Subjects for this class (from timetable) ──────────────────────────────
  const lessons = await prisma.lesson.findMany({
    where: { schoolId, classId: activeClass.id },
    select: { subject: { select: { id: true, name: true } } },
  });
  const subjectMap = new Map<number, string>();
  for (const l of lessons) {
    if (!subjectMap.has(l.subject.id))
      subjectMap.set(l.subject.id, l.subject.name);
  }
  const totalSubjects = subjectMap.size;

  // ── Per-student summary ───────────────────────────────────────────────────
  type StudentRow = {
    id: string;
    name: string;
    surname: string;
    img: string | null;
    subjectsDone: number;
    totalScore: number;
    aggregate: number;
    gradePoints: number[];
    topGrade: string;
    complete: boolean;
  };

  const studentRows: StudentRow[] = students.map((s) => {
    const records = caRecords.filter((r) => r.studentId === s.id);
    const gps = records.map((r) => r.gradePoint);
    const scores = records.map((r) => r.totalScore);
    const avg =
      scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    const agg = computeAggregate(gps);
    const top =
      records.sort((a, b) => a.gradePoint - b.gradePoint)[0]?.grade ?? "—";

    return {
      id: s.id,
      name: s.name,
      surname: s.surname,
      img: s.img,
      subjectsDone: records.length,
      totalScore: Math.round(avg * 10) / 10,
      aggregate: agg,
      gradePoints: gps,
      topGrade: top,
      complete: records.length >= totalSubjects && totalSubjects > 0,
    };
  });

  // Sort by aggregate ascending (lower = better), then avg descending
  const sorted = [...studentRows].sort((a, b) => {
    if (a.aggregate !== b.aggregate) return a.aggregate - b.aggregate;
    return b.totalScore - a.totalScore;
  });

  const completeCount = studentRows.filter((s) => s.complete).length;

  return (
    <div className="flex-1 m-4 mt-0 flex flex-col gap-4">
      {/* Header */}
      <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 bg-violet-50 rounded-2xl flex items-center justify-center shrink-0">
              <FileText size={20} className="text-violet-600" />
            </div>
            <div>
              <h1 className="text-xl font-black text-gray-800 tracking-tight">
                Report Cards
              </h1>
              <p className="text-sm text-gray-400 mt-0.5 font-medium">
                {activeClass.name} · {TERM_LABELS[selectedTerm]} · {activeYear}
              </p>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Class */}
            <ReportCardFilters
              supervisedClasses={supervisedClasses}
              academicYears={academicYears}
              activeClassId={activeClassId}
              activeTerm={selectedTerm}
              activeYear={activeYear}
            />
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {
            label: "Students",
            value: students.length,
            color: "bg-indigo-50 text-indigo-600",
          },
          {
            label: "Complete",
            value: completeCount,
            color: "bg-emerald-50 text-emerald-600",
          },
          {
            label: "Pending",
            value: students.length - completeCount,
            color: "bg-amber-50 text-amber-600",
          },
          {
            label: "Subjects",
            value: totalSubjects,
            color: "bg-violet-50 text-violet-600",
          },
        ].map((s) => (
          <div
            key={s.label}
            className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex items-center gap-3"
          >
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${s.color}`}
            >
              <span className="text-xl font-black">{s.value}</span>
            </div>
            <p className="text-sm font-bold text-gray-500">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Config warning */}
      {!config && (
        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-2xl">
          <AlertTriangle size={16} className="text-amber-500 shrink-0 mt-0.5" />
          <p className="text-xs font-semibold text-amber-700">
            No CA configuration found for <strong>{activeYear}</strong>. Report
            cards will use the default 30% / 70% split. Ask your admin to
            configure weights at{" "}
            <Link href="/admin/ca-config" className="underline">
              CA Settings
            </Link>
            .
          </p>
        </div>
      )}

      {/* Student list */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
          <p className="text-xs font-black uppercase tracking-wider text-gray-400">
            All Students — ranked by aggregate
          </p>
          <p className="text-xs text-gray-400 font-semibold">
            {completeCount}/{students.length} ready
          </p>
        </div>

        <div className="divide-y divide-gray-50">
          {sorted.length === 0 ? (
            <div className="py-16 text-center">
              <FileText size={28} className="text-gray-200 mx-auto mb-3" />
              <p className="text-sm text-gray-400 font-semibold">
                No students in this class
              </p>
            </div>
          ) : (
            sorted.map((s, idx) => {
              const position = idx + 1;
              const band =
                s.totalScore > 0 ? getGradeBandByGrade(s.topGrade) : null;
              const isTop3 = position <= 3 && s.complete;

              return (
                <div
                  key={s.id}
                  className={`flex items-center gap-4 px-5 py-4 transition-colors group
                    ${isTop3 ? "bg-amber-50/40" : "hover:bg-gray-50/60"}`}
                >
                  {/* Position */}
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm font-black shrink-0
                    ${
                      position === 1 && s.complete
                        ? "bg-amber-100 text-amber-700"
                        : position === 2 && s.complete
                          ? "bg-slate-100 text-slate-600"
                          : position === 3 && s.complete
                            ? "bg-orange-100 text-orange-700"
                            : "bg-gray-100 text-gray-400"
                    }`}
                  >
                    {isTop3 ? <Trophy size={14} /> : position}
                  </div>

                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-sm font-black text-indigo-600 shrink-0">
                    {s.img ? (
                      <Image
                        unoptimized
                        src={s.img}
                        alt=""
                        width={40}
                        height={40}
                        className="w-full h-full object-cover rounded-xl"
                      />
                    ) : (
                      `${s.name[0]}${s.surname[0]}`
                    )}
                  </div>

                  {/* Name */}
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-800 text-sm">
                      {s.surname} {s.name}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {s.complete ? (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600">
                          <CheckCircle2 size={10} /> Complete
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-amber-500">
                          <Clock size={10} /> {s.subjectsDone}/{totalSubjects}{" "}
                          subjects
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Scores */}
                  {s.subjectsDone > 0 && (
                    <div className="hidden sm:flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-xs text-gray-400 font-semibold">
                          Avg Score
                        </p>
                        <p className="text-sm font-black text-gray-800">
                          {s.totalScore}%
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-400 font-semibold">
                          Aggregate
                        </p>
                        <p className="text-sm font-black text-gray-800">
                          {s.aggregate}
                        </p>
                      </div>
                      {band && (
                        <div
                          className={`px-2.5 py-1 rounded-xl border text-xs font-black ${band.bg} ${band.color} ${band.border}`}
                        >
                          {s.topGrade}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Position badge */}
                  {s.complete && (
                    <div className="hidden md:block text-right">
                      <p className="text-xs text-gray-400 font-semibold">
                        Position
                      </p>
                      <p className="text-sm font-black text-gray-800">
                        {ordinal(position)}
                      </p>
                    </div>
                  )}

                  {/* View report card link */}
                  <Link
                    href={`/list/report-cards/${s.id}?term=${selectedTerm}&year=${activeYear}&classId=${activeClass.id}`}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all shrink-0
                      ${
                        s.complete
                          ? "bg-violet-600 text-white hover:bg-violet-700 shadow-sm"
                          : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                      }`}
                  >
                    <FileText size={12} />
                    <span className="hidden sm:inline">
                      {s.complete ? "View Report" : "Incomplete"}
                    </span>
                    <ChevronRight size={12} />
                  </Link>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default ReportCardListPage;
