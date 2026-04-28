// src/app/(dashboard)/list/ca/page.tsx
// Continuous Assessment management page
// Accessible by: admin (all classes), teacher (supervised classes only)

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import prisma from "@/src/lib/prisma";
import CAEntryForm from "@/src/components/CAEntryForm";
import CAClassSummary from "@/src/components/CAClassSummary";
import {
  ClipboardList, AlertTriangle, BookOpen, Users,
} from "lucide-react";

export const dynamic = "force-dynamic";

const CAPage = async ({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) => {
  const { userId, sessionClaims } = await auth();
  const role = (sessionClaims?.metadata as { role?: string })?.role;

  if (!userId || (role !== "admin" && role !== "teacher")) {
    redirect("/");
  }

  const params = await searchParams;
  const selectedClassId = params.classId ? parseInt(params.classId) : null;
  const viewMode = params.view ?? "entry"; // "entry" | "summary"

  // ── Which classes can this user access? ──────────────────────────────────
  let supervisedClasses: { id: number; name: string; grade: { level: string } }[] = [];

  if (role === "admin") {
    supervisedClasses = await prisma.class.findMany({
      orderBy: { name: "asc" },
      include: { grade: { select: { level: true } } },
    });
  } else {
    // teacher — only their supervised classes
    supervisedClasses = await prisma.class.findMany({
      where:   { supervisorId: userId },
      orderBy: { name: "asc" },
      include: { grade: { select: { level: true } } },
    });
  }

  if (supervisedClasses.length === 0) {
    return (
      <div className="flex-1 m-4 flex flex-col items-center justify-center gap-4 text-center">
        <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center">
          <AlertTriangle size={28} className="text-amber-500" />
        </div>
        <div>
          <h2 className="text-xl font-black text-gray-800">No Classes Assigned</h2>
          <p className="text-sm text-gray-400 mt-1 max-w-xs">
            {role === "teacher"
              ? "You are not assigned as a supervisor to any class. Contact your admin."
              : "No classes exist yet. Create classes first."}
          </p>
        </div>
      </div>
    );
  }

  const activeClassId = selectedClassId ?? supervisedClasses[0].id;
  const activeClass   = supervisedClasses.find((c) => c.id === activeClassId) ?? supervisedClasses[0];

  // ── Load students in the active class ────────────────────────────────────
  const students = await prisma.student.findMany({
    where:   { classId: activeClass.id },
    orderBy: [{ surname: "asc" }, { name: "asc" }],
    select:  { id: true, name: true, surname: true },
  });

  // ── Load subjects taught in this class ────────────────────────────────────
  const lessons = await prisma.lesson.findMany({
    where:  { classId: activeClass.id },
    select: { subject: { select: { id: true, name: true } } },
    distinct: ["subjectId"],
  });
  const subjects = lessons.map((l) => l.subject);

  // ── Load existing CA records for this class (for pre-filling) ────────────
  const existingCA = await prisma.continuousAssessment.findMany({
    where: { classId: activeClass.id },
    select: {
      studentId:      true,
      subjectId:      true,
      term:           true,
      academicYear:   true,
      classworkScore: true,
      examScore:      true,
      totalScore:     true,
      grade:          true,
      gradePoint:     true,
      remarks:        true,
    },
  });

  // ── CA summary data for the summary view ─────────────────────────────────
  const summaryData = await prisma.continuousAssessment.findMany({
    where: { classId: activeClass.id },
    include: {
      student: { select: { id: true, name: true, surname: true } },
      subject: { select: { id: true, name: true } },
    },
    orderBy: [{ term: "asc" }, { student: { surname: "asc" } }],
  });

  // Academic years — derive from existing configs + sensible defaults
  const configs = await prisma.cAConfig.findMany({ orderBy: { academicYear: "desc" } });
  const academicYears = configs.length > 0
    ? configs.map((c) => c.academicYear)
    : ["2024/25", "2025/26"];

  return (
    <div className="flex-1 m-4 mt-0 flex flex-col gap-4">

      {/* ── Page Header ── */}
      <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 bg-indigo-50 rounded-2xl flex items-center justify-center shrink-0">
              <ClipboardList size={20} className="text-indigo-600" />
            </div>
            <div>
              <h1 className="text-xl font-black text-gray-800 tracking-tight">
                Continuous Assessment
              </h1>
              <p className="text-sm text-gray-400 mt-0.5 font-medium">
                {activeClass.name} · {activeClass.grade.level} · {students.length} students
              </p>
            </div>
          </div>

          {/* View mode toggle */}
          <div className="flex items-center gap-2">
            <div className="flex bg-gray-100 p-1 rounded-xl gap-1">
              {[
                { key: "entry",   label: "Entry",   icon: <BookOpen size={13} /> },
                { key: "summary", label: "Summary", icon: <Users    size={13} /> },
              ].map((tab) => (
                <a
                  key={tab.key}
                  href={`/list/ca?classId=${activeClass.id}&view=${tab.key}`}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold transition-all
                    ${viewMode === tab.key
                      ? "bg-white text-indigo-600 shadow-sm"
                      : "text-gray-400 hover:text-gray-600"}`}
                >
                  {tab.icon} {tab.label}
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-4 flex-col lg:flex-row">

        {/* ── Sidebar: class selector ── */}
        <div className="w-full lg:w-56 shrink-0">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <p className="text-xs font-black uppercase tracking-wider text-gray-400">My Classes</p>
            </div>
            <div className="divide-y divide-gray-50">
              {supervisedClasses.map((cls) => (
                <a
                  key={cls.id}
                  href={`/list/ca?classId=${cls.id}&view=${viewMode}`}
                  className={`flex items-center gap-3 px-4 py-3 transition-colors
                    ${cls.id === activeClass.id
                      ? "bg-indigo-50"
                      : "hover:bg-gray-50"}`}
                >
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black shrink-0
                    ${cls.id === activeClass.id ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-500"}`}>
                    {cls.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className={`text-sm font-bold truncate ${cls.id === activeClass.id ? "text-indigo-700" : "text-gray-700"}`}>
                      {cls.name}
                    </p>
                    <p className="text-[10px] text-gray-400">{cls.grade.level}</p>
                  </div>
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* ── Main content ── */}
        <div className="flex-1 min-w-0">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            {viewMode === "entry" ? (
              <CAEntryForm
                classId={activeClass.id}
                className={activeClass.name}
                students={students}
                subjects={subjects}
                academicYears={academicYears}
                existingCA={existingCA.map((ca) => ({
                  studentId:      ca.studentId,
                  classworkScore: ca.classworkScore,
                  examScore:      ca.examScore,
                  remarks:        ca.remarks,
                }))}
              />
            ) : (
              <CAClassSummary
                className={activeClass.name}
                students={students}
                subjects={subjects}
                caRecords={summaryData.map((ca) => ({
                  id:             ca.id,
                  studentId:      ca.student.id,
                  studentName:    ca.student.name,
                  studentSurname: ca.student.surname,
                  subjectId:      ca.subject.id,
                  subjectName:    ca.subject.name,
                  term:           ca.term,
                  academicYear:   ca.academicYear,
                  classworkScore: ca.classworkScore,
                  examScore:      ca.examScore,
                  totalScore:     ca.totalScore,
                  grade:          ca.grade,
                  gradePoint:     ca.gradePoint,
                  remarks:        ca.remarks,
                }))}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CAPage;
