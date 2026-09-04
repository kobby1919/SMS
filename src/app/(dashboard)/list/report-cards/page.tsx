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
} from "lucide-react";
import {
  TERM_LABELS,
} from "@/src/lib/caGrades";
import ReportCardFilters from "@/src/components/ReportCardFilters";
import ReportPublicationControls from "@/src/components/ReportPublicationControls";
import { listClassSubjectsFromTimetable } from "@/src/lib/services/timetable";
import { getActiveAcademicPeriod } from "@/src/lib/services/academic-period";
import { formatMark } from "@/src/lib/formatters/marks";
import type { Term } from "@/src/generated/prisma";

export const dynamic = "force-dynamic";

const VALID_TERMS = new Set<Term>(["TERM_1", "TERM_2", "TERM_3"]);

function termFromParam(value?: string): Term | null {
  return value && VALID_TERMS.has(value as Term) ? value as Term : null;
}

function intFromParam(value?: string) {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

const ReportCardListPage = async ({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) => {
  const { userId, role, schoolId } = await requirePageSession();

  const params = await searchParams;
  const selectedClassId = intFromParam(params.classId);
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
    const [caRecords, subjectsByClass, publications] = await Promise.all([
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
      prisma.reportCardPublication.findMany({
        where: {
          schoolId,
          classId: { in: classIds },
          term: selectedTerm as Term,
          academicYear: activeYear,
          status: "PUBLISHED",
        },
        select: { classId: true },
      }),
    ]);
    const publishedClassIds = new Set(publications.map((publication) => publication.classId));

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
            const isPublished = publishedClassIds.has(child.classId);
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
                    <p className="text-[10px] font-black uppercase">{isPublished ? "Reports ready" : "Awaiting approval"}</p>
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
                            {record?.examScore && record.examScore > 0 && !isPublished ? " · awaiting school approval" : ""}
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

  // 3. Admin/Teacher Check (Only they see the class report builder)
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
          where: {
            schoolId,
            lessons: { some: { teacherId: userId } },
          },
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
            ? "No timetable classes are assigned to you yet."
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
  const subjectIds = Array.from(subjectMap.keys());

  const [caRecords, publication] = await Promise.all([
    prisma.continuousAssessment.findMany({
      where: {
        classId: activeClass.id,
        schoolId,
        term: selectedTerm as Term,
        academicYear: activeYear,
        ...(subjectIds.length > 0 ? { subjectId: { in: subjectIds } } : {}),
      },
      select: {
        studentId: true,
        subjectId: true,
        classworkScore: true,
        examScore: true,
      },
    }),
    prisma.reportCardPublication.findUnique({
      where: {
        schoolId_classId_term_academicYear: {
          schoolId,
          classId: activeClass.id,
          term: selectedTerm as Term,
          academicYear: activeYear,
        },
      },
    }),
  ]);

  // ── Per-student summary ───────────────────────────────────────────────────
  type StudentRow = {
    id: string;
    name: string;
    surname: string;
    img: string | null;
    subjectsDone: number;
    reportsReady: number;
    status: "not_started" | "building" | "ready";
  };

  const studentRows: StudentRow[] = students.map((s) => {
    const records = caRecords.filter((r) => r.studentId === s.id);
    const reportsReady = records.filter((r) => r.examScore > 0).length;
    const status =
      totalSubjects > 0 && reportsReady >= totalSubjects
        ? "ready"
        : records.length > 0
          ? "building"
          : "not_started";

    return {
      id: s.id,
      name: s.name,
      surname: s.surname,
      img: s.img,
      subjectsDone: records.length,
      reportsReady,
      status,
    };
  });

  const sorted = [...studentRows].sort((a, b) =>
    `${a.surname} ${a.name}`.localeCompare(`${b.surname} ${b.name}`),
  );

  const completeCount = studentRows.filter((s) => s.status === "ready").length;
  const buildingCount = studentRows.filter((s) => s.status === "building").length;
  const readyKeys = new Set(
    caRecords
      .filter((record) => record.examScore > 0)
      .map((record) => `${record.studentId}:${record.subjectId}`),
  );
  const missingReportEntries = students.reduce((count, student) => {
    return count + subjectIds.filter((subjectId) => !readyKeys.has(`${student.id}:${subjectId}`)).length;
  }, 0);
  const isPublished = publication?.status === "PUBLISHED";

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
                Class Report Builder
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
            label: "Ready",
            value: completeCount,
            color: "bg-emerald-50 text-emerald-600",
          },
          {
            label: "Building",
            value: buildingCount,
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

      {role === "admin" && (
        <ReportPublicationControls
          classId={activeClass.id}
          term={selectedTerm}
          academicYear={activeYear}
          isPublished={isPublished}
          canPublish={students.length > 0 && totalSubjects > 0 && missingReportEntries === 0}
          missingCount={missingReportEntries}
          studentCount={students.length}
          subjectCount={totalSubjects}
        />
      )}

      {role === "teacher" && (
        <div className={`rounded-2xl border p-4 text-xs font-semibold ${
          isPublished
            ? "border-emerald-100 bg-emerald-50 text-emerald-700"
            : "border-amber-100 bg-amber-50 text-amber-700"
        }`}>
          {isPublished
            ? "Admin has published this class report set. Parents can now view and download final reports."
            : "This class report set is still awaiting admin approval. Teachers can preview records, but parents cannot download final reports yet."}
        </div>
      )}

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
            Students in this class
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
            sorted.map((s) => {
              const statusLabel =
                s.status === "ready"
                  ? "Report ready"
                  : s.status === "building"
                    ? "CA building, exam pending"
                    : "No CA yet";
              const statusClass =
                s.status === "ready"
                  ? "text-emerald-600"
                  : s.status === "building"
                    ? "text-amber-600"
                    : "text-gray-400";

              return (
                <div
                  key={s.id}
                  className={`flex items-center gap-4 px-5 py-4 transition-colors group
                    hover:bg-gray-50/60`}
                >
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
                      <span className={`flex items-center gap-1 text-[10px] font-bold ${statusClass}`}>
                        {s.status === "ready" ? <CheckCircle2 size={10} /> : <Clock size={10} />}
                        {statusLabel}
                      </span>
                    </div>
                  </div>

                  <div className="hidden sm:block text-right">
                    <p className="text-xs text-gray-400 font-semibold">
                      Progress
                    </p>
                    <p className="text-sm font-black text-gray-800">
                      {s.subjectsDone}/{totalSubjects || 0} CA
                    </p>
                  </div>
                  <div className="hidden md:block text-right">
                    <p className="text-xs text-gray-400 font-semibold">
                      Exams
                    </p>
                    <p className="text-sm font-black text-gray-800">
                      {s.reportsReady}/{totalSubjects || 0} ready
                    </p>
                  </div>

                  <Link
                    href={`/list/report-cards/${s.id}?term=${selectedTerm}&year=${activeYear}&classId=${activeClass.id}`}
                    aria-label={`Open report card for ${s.name} ${s.surname}`}
                    title={`Open report card for ${s.name} ${s.surname}`}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white transition-colors hover:bg-slate-800"
                  >
                    <ChevronRight size={16} />
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
