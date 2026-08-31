// src/app/(dashboard)/list/ca/page.tsx
// Continuous Assessment management page
// Accessible by: admin (all classes), teacher (supervised classes only)


import { requirePageSession } from "@/src/lib/authz";
import prisma from "@/src/lib/prisma";
import CAEntryForm from "@/src/components/CAEntryForm";
import CAClassSummary from "@/src/components/CAClassSummary";
import CAActivityManager from "@/src/components/CAActivityManager";
import ExamEntryWindowControls from "@/src/components/ExamEntryWindowControls";
import { getActiveAcademicPeriod } from "@/src/lib/services/academic-period";
import { getSubjectCAProgress } from "@/src/lib/services/ca-activity";
import { listClassSubjectsFromTimetable } from "@/src/lib/services/timetable";
import { ClipboardList, AlertTriangle, BookOpen, Users, Layers3 } from "lucide-react";

export const dynamic = "force-dynamic";

const CAPage = async ({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) => {
  const { userId, role, schoolId } = await requirePageSession(["admin", "teacher"]);

  const params = await searchParams;
  const selectedClassId = params.classId ? parseInt(params.classId) : null;
  const viewMode = params.view ?? "entry"; // "entry" | "summary"

  // ── Which classes can this user access? ──────────────────────────────────
  let supervisedClasses: {
    id: number;
    name: string;
    supervisorId: string | null;
    grade: { level: string };
  }[] = [];

  if (role === "admin") {
    supervisedClasses = await prisma.class.findMany({
      where: { schoolId },
      orderBy: { name: "asc" },
      include: { grade: { select: { level: true } } },
    });
  } else {
    supervisedClasses = await prisma.class.findMany({
      where: {
        schoolId,
        OR: [
          { supervisorId: userId },
          { lessons: { some: { teacherId: userId } } },
        ],
      },
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
          <h2 className="text-xl font-black text-gray-800">
            No Classes Assigned
          </h2>
          <p className="text-sm text-gray-400 mt-1 max-w-xs">
            {role === "teacher"
              ? "You are not assigned as supervisor to any class. Contact your admin."
              : "No classes exist yet. Create classes first."}
          </p>
        </div>
      </div>    
    );
  }

  const activeClassId = selectedClassId ?? supervisedClasses[0].id;
  const activeClass =
    supervisedClasses.find((c) => c.id === activeClassId) ??
    supervisedClasses[0];

  // ── Students in this class ────────────────────────────────────────────────
  const students = await prisma.student.findMany({
    where: { schoolId, classId: activeClass.id },
    orderBy: [{ surname: "asc" }, { name: "asc" }],
    select: { id: true, name: true, surname: true },
  });

  // ── Subjects for this class — ONLY from the timetable (Lesson table) ─────
  // A subject may have multiple lesson slots per week (e.g. Math on Mon & Wed).
  // We deduplicate by subjectId so each subject appears only once.
  const subjectsByClass = await listClassSubjectsFromTimetable(
    schoolId,
    [activeClass.id],
    role === "teacher" && activeClass.supervisorId !== userId ? { teacherId: userId } : {},
  );
  const subjects = Array.from(subjectsByClass.get(activeClass.id) ?? [], ([id, name]) => ({ id, name }));

  // ── Existing CA records (pre-fill the entry form) ─────────────────────────
  const existingCA = await prisma.continuousAssessment.findMany({
    where: { schoolId, classId: activeClass.id },
    select: {
      studentId: true,
      subjectId: true,
      term: true,
      academicYear: true,
      classworkScore: true,
      examScore: true,
      totalScore: true,
      grade: true,
      gradePoint: true,
      remarks: true,
    },
  });

  // ── CA summary data (summary tab) ─────────────────────────────────────────
  const summaryData = await prisma.continuousAssessment.findMany({
    where: { schoolId, classId: activeClass.id },
    include: {
      student: { select: { id: true, name: true, surname: true } },
      subject: { select: { id: true, name: true } },
    },
    orderBy: [{ term: "asc" }, { student: { surname: "asc" } }],
  });

  // ── Academic years from CA configs ────────────────────────────────────────
  const [configs, activePeriod] = await Promise.all([
    prisma.cAConfig.findMany({
      where: { schoolId },
      orderBy: [{ isActive: "desc" }, { academicYear: "desc" }],
    }),
    getActiveAcademicPeriod(schoolId),
  ]);
  const academicYears =
    configs.length > 0
      ? configs.map((c) => c.academicYear)
      : [activePeriod.academicYear, "2026/27"];

  const examEntryWindow = await prisma.examEntryWindow.findUnique({
    where: {
      schoolId_classId_term_academicYear: {
        schoolId,
        classId: activeClass.id,
        term: activePeriod.currentTerm,
        academicYear: activePeriod.academicYear,
      },
    },
    select: { status: true },
  });

  const caBuckets = await prisma.cABucket.findMany({
    where: {
      schoolId,
      classId: activeClass.id,
      ...(subjects.length > 0 ? { subjectId: { in: subjects.map((subject) => subject.id) } } : {}),
    },
    include: {
      activities: {
        orderBy: [{ activityDate: "asc" }, { sequence: "asc" }],
        include: {
          teacher: { select: { name: true, surname: true } },
          scores: {
            select: {
              studentId: true,
              rawScore: true,
              normalizedContribution: true,
            },
          },
        },
      },
    },
    orderBy: [{ subjectId: "asc" }, { order: "asc" }, { id: "asc" }],
  });

  const activityCAContexts = Array.from(
    new Map(
      caBuckets.map((bucket) => [
        `${bucket.subjectId}-${bucket.term}-${bucket.academicYear}`,
        {
          subjectId: bucket.subjectId,
          term: bucket.term,
          academicYear: bucket.academicYear,
        },
      ]),
    ).values(),
  );

  const activityCAProgress = (
    await Promise.all(
      activityCAContexts.flatMap((context) =>
        students.map(async (student) => {
          const progress = await getSubjectCAProgress({
            schoolId,
            classId: activeClass.id,
            studentId: student.id,
            subjectId: context.subjectId,
            term: context.term,
            academicYear: context.academicYear,
          });

          return {
            studentId: student.id,
            subjectId: context.subjectId,
            term: context.term,
            academicYear: context.academicYear,
            classworkScore: progress.earnedMarks,
          };
        }),
      ),
    )
  ).flat();

  return (
    <div className="flex-1 m-3 mt-0 flex flex-col gap-4 sm:m-4 sm:mt-0">
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
                {activeClass.name} · {activeClass.grade.level} ·{" "}
                {students.length} students · {subjects.length} subject
                {subjects.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>

          {/* View toggle */}
          <div className="grid w-full grid-cols-3 gap-1 rounded-xl bg-gray-100 p-1 sm:flex sm:w-auto">
            {[
              { key: "entry", label: "Entry", icon: <BookOpen size={13} /> },
              { key: "activity", label: "Activity CA", icon: <Layers3 size={13} /> },
              { key: "summary", label: "Summary", icon: <Users size={13} /> },
            ].map((tab) => (
              <a
                key={tab.key}
                href={`/list/ca?classId=${activeClass.id}&view=${tab.key}`}
                className={`flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-bold transition-all sm:px-4 sm:text-sm
                  ${
                    viewMode === tab.key
                      ? "bg-white text-indigo-600 shadow-sm"
                      : "text-gray-400 hover:text-gray-600"
                  }`}
              >
                {tab.icon} {tab.label}
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* No timetable warning */}
      {subjects.length === 0 && (
        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-2xl">
          <AlertTriangle size={16} className="text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-black text-amber-800">
              No subjects on timetable for {activeClass.name}
            </p>
            <p className="text-xs text-amber-700 mt-0.5">
              No lessons have been scheduled for this class yet. Ask your admin
              to add lessons in the timetable builder — subjects will then
              appear here automatically.
            </p>
          </div>
        </div>
      )}

      <ExamEntryWindowControls
        classId={activeClass.id}
        className={activeClass.name}
        term={activePeriod.currentTerm}
        academicYear={activePeriod.academicYear}
        status={examEntryWindow?.status ?? "LOCKED"}
        role={role}
      />

      <div className="flex gap-4 flex-col lg:flex-row">
        {/* ── Sidebar: class selector ── */}
        <div className="w-full lg:w-56 shrink-0">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <p className="text-xs font-black uppercase tracking-wider text-gray-400">
                My Classes
              </p>
            </div>
            <div className="divide-y divide-gray-50">
              {supervisedClasses.map((cls) => (
                <a
                  key={cls.id} 
                  href={`/list/ca?classId=${cls.id}&view=${viewMode}`}
                  className={`flex items-center gap-3 px-4 py-3 transition-colors
                    ${cls.id === activeClass.id ? "bg-indigo-50" : "hover:bg-gray-50"}`}
                >
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black shrink-0
                    ${
                      cls.id === activeClass.id
                        ? "bg-indigo-600 text-white"
                        : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {cls.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p
                      className={`text-sm font-bold truncate
                      ${cls.id === activeClass.id ? "text-indigo-700" : "text-gray-700"}`}
                    >
                      {cls.name}
                    </p>
                    <p className="text-[10px] text-gray-400">
                      {cls.grade.level}
                    </p>
                  </div>
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* ── Main content ── */}
        <div className="flex-1 min-w-0">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-6">
            {viewMode === "entry" ? (
              <CAEntryForm
                classId={activeClass.id}
                className={activeClass.name}
                students={students}
                subjects={subjects}
                academicYears={academicYears}
                activeTerm={activePeriod.currentTerm}
                activeYear={activePeriod.academicYear}
                examEntryStatus={examEntryWindow?.status ?? "LOCKED"}
                existingCA={existingCA.map((ca) => ({
                  studentId: ca.studentId,
                  subjectId: ca.subjectId,
                  term: ca.term,
                  academicYear: ca.academicYear,
                  classworkScore: ca.classworkScore,
                  examScore: ca.examScore,
                  remarks: ca.remarks,
                }))}
                activityCAProgress={activityCAProgress}
                activityCAContexts={activityCAContexts}
              />
            ) : viewMode === "activity" ? (
              <CAActivityManager
                classId={activeClass.id}
                className={activeClass.name}
                students={students}
                subjects={subjects}
                academicYears={academicYears}
                activeTerm={activePeriod.currentTerm}
                activeYear={activePeriod.academicYear}
                canLock={role === "admin"}
                buckets={caBuckets.map((bucket) => ({
                  id: bucket.id,
                  name: bucket.name,
                  type: bucket.type,
                  aggregationMode: bucket.aggregationMode,
                  allocationMarks: Number(bucket.allocationMarks),
                  term: bucket.term,
                  academicYear: bucket.academicYear,
                  subjectId: bucket.subjectId,
                  isLocked: bucket.isLocked,
                  activities: bucket.activities.map((activity) => ({
                    id: activity.id,
                    title: activity.title,
                    type: activity.type,
                    rawMaxScore: Number(activity.rawMaxScore),
                    allocationMarks: activity.allocationMarks === null ? null : Number(activity.allocationMarks),
                    sequence: activity.sequence,
                    isLocked: activity.isLocked,
                    activityDate: activity.activityDate,
                    teacherName: `${activity.teacher.name} ${activity.teacher.surname}`,
                    scores: activity.scores.map((score) => ({
                      studentId: score.studentId,
                      rawScore: Number(score.rawScore),
                      normalizedContribution: Number(score.normalizedContribution),
                    })),
                  })),
                }))}
              />
            ) : (
              <CAClassSummary
                className={activeClass.name}
                students={students}
                subjects={subjects}
                caRecords={summaryData.map((ca) => ({
                  id: ca.id,
                  studentId: ca.student.id,
                  studentName: ca.student.name,
                  studentSurname: ca.student.surname,
                  subjectId: ca.subject.id,
                  subjectName: ca.subject.name,
                  term: ca.term,
                  academicYear: ca.academicYear,
                  classworkScore: ca.classworkScore,
                  examScore: ca.examScore,
                  totalScore: ca.totalScore,
                  grade: ca.grade,
                  gradePoint: ca.gradePoint,
                  remarks: ca.remarks,
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
