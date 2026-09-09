import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AlertTriangle,
  CalendarCheck2,
  ChevronRight,
  ClipboardList,
  FileText,
  GraduationCap,
  Users,
} from "lucide-react";
import { requirePageSession } from "@/src/lib/authz";
import { getClassTeacherOverview } from "@/src/lib/services/class-teacher-overview";
import { TERM_LABELS } from "@/src/lib/caGrades";

function parseClassId(value: string) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function reportTone(status: string) {
  if (status === "PUBLISHED") return "bg-emerald-50 text-emerald-700";
  if (status === "SUBMITTED") return "bg-blue-50 text-blue-700";
  if (status === "REJECTED") return "bg-rose-50 text-rose-700";
  return "bg-amber-50 text-amber-700";
}

const ClassTeacherControlPage = async ({
  params,
}: {
  params: Promise<{ classId: string }>;
}) => {
  const { userId, schoolId } = await requirePageSession(["teacher"]);
  const { classId: rawClassId } = await params;
  const classId = parseClassId(rawClassId);
  if (!classId) notFound();

  const overview = await getClassTeacherOverview({ schoolId, teacherId: userId, classId });
  if (!overview) notFound();

  const attendanceMarkedPct = overview.todayAttendance.lessonCount > 0
    ? Math.round((overview.todayAttendance.markedLessons / overview.todayAttendance.lessonCount) * 100)
    : 0;

  return (
    <div className="m-3 mt-0 flex min-w-0 flex-1 flex-col gap-4 sm:m-4 sm:mt-0">
      <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase text-gray-400">Class Teacher Control Center</p>
            <h1 className="mt-1 break-words text-2xl font-black text-edujay-ink sm:text-3xl">
              {overview.class.name}
            </h1>
            <p className="mt-1 text-sm font-semibold text-gray-500">
              Grade {overview.class.gradeLevel} · {TERM_LABELS[overview.activePeriod.currentTerm]} · {overview.activePeriod.academicYear}
            </p>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:flex lg:flex-wrap">
            <Link
              href={`/list/students?classId=${overview.class.id}`}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-edujay-soft px-3 py-2.5 text-xs font-black text-edujay-primary transition hover:bg-blue-100"
            >
              <Users size={14} />
              Students
            </Link>
            <Link
              href={`/list/report-cards?classId=${overview.class.id}`}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-edujay-ink px-3 py-2.5 text-xs font-black text-white transition hover:bg-edujay-primaryDark"
            >
              <FileText size={14} />
              Reports
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "Class Size",
            value: overview.classSize.total,
            detail: `${overview.classSize.boys} boys · ${overview.classSize.girls} girls`,
            icon: <Users size={16} />,
            tone: "bg-blue-50 text-blue-700",
          },
          {
            label: "Attendance Today",
            value: `${overview.todayAttendance.markedLessons}/${overview.todayAttendance.lessonCount}`,
            detail: `${attendanceMarkedPct}% lessons fully marked · ${overview.todayAttendance.incompleteLessonCount} lesson${overview.todayAttendance.incompleteLessonCount === 1 ? "" : "s"} need attendance`,
            icon: <CalendarCheck2 size={16} />,
            tone: "bg-emerald-50 text-emerald-700",
          },
          {
            label: "Needs Attention",
            value: overview.studentsNeedingAttention.length,
            detail: "students to follow up",
            icon: <AlertTriangle size={16} />,
            tone: "bg-amber-50 text-amber-700",
          },
          {
            label: "Report Readiness",
            value: `${overview.report.readinessPct}%`,
            detail: overview.report.label,
            icon: <FileText size={16} />,
            tone: reportTone(overview.report.status),
          },
        ].map((item) => (
          <div key={item.label} className="min-w-0 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            <div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-xl ${item.tone}`}>
              {item.icon}
            </div>
            <p className="break-words text-2xl font-black text-edujay-ink">{item.value}</p>
            <p className="mt-1 text-xs font-black uppercase text-gray-400">{item.label}</p>
            <p className="mt-1 text-xs font-semibold leading-relaxed text-gray-500">{item.detail}</p>
          </div>
        ))}
      </section>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="min-w-0 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h2 className="text-base font-black text-edujay-ink">Today&apos;s Attendance Health</h2>
              <p className="text-xs font-semibold leading-relaxed text-gray-400">
                Calculated from today&apos;s timetable lessons and attendance saved for this class.
              </p>
            </div>
            <CalendarCheck2 size={18} className="shrink-0 text-edujay-primary" />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              ["Present", overview.todayAttendance.present, "text-emerald-700 bg-emerald-50"],
              ["Absent", overview.todayAttendance.absent, "text-rose-700 bg-rose-50"],
              ["Late", overview.todayAttendance.late, "text-amber-700 bg-amber-50"],
              ["Excused", overview.todayAttendance.excused, "text-blue-700 bg-blue-50"],
            ].map(([label, value, tone]) => (
              <div key={label} className={`rounded-xl p-3 ${tone}`}>
                <p className="text-xl font-black">{value}</p>
                <p className="text-[10px] font-black uppercase">{label}</p>
              </div>
            ))}
          </div>
          <div className="mt-3 rounded-xl bg-gray-50 p-3">
            {overview.todayAttendance.incompleteLessons.length === 0 ? (
              <p className="text-sm font-bold text-gray-500">All expected lesson attendance is marked for today.</p>
            ) : (
              <div className="space-y-2">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs font-black uppercase text-gray-400">Lessons needing attendance</p>
                  <p className="text-xs font-bold text-gray-500">
                    {overview.todayAttendance.incompleteLessonCount} lesson{overview.todayAttendance.incompleteLessonCount === 1 ? "" : "s"} · {overview.todayAttendance.missingRecords} missing student record{overview.todayAttendance.missingRecords === 1 ? "" : "s"}
                  </p>
                </div>
                <p className="rounded-lg bg-blue-50 px-3 py-2 text-xs font-semibold leading-relaxed text-blue-700">
                  Lesson count and student-record count are different. For example, if 9 lessons are incomplete in a class of 2 students, that creates 18 missing student attendance records.
                </p>
                {overview.todayAttendance.incompleteLessons.map((lesson) => (
                  <div key={lesson.id} className="rounded-lg bg-white p-3 ring-1 ring-gray-100">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <p className="break-words text-sm font-black text-edujay-ink">
                        {lesson.subjectName}
                      </p>
                      <p className="text-xs font-bold text-gray-500">
                        {lesson.markedRecords}/{lesson.expectedRecords} marked
                      </p>
                    </div>
                    <p className="mt-1 break-words text-xs font-semibold text-gray-500">
                      Teacher: {lesson.teacherName}
                    </p>
                    <Link
                      href={`/list/attendance/take?lessonId=${lesson.id}`}
                      className="mt-2 inline-flex w-full items-center justify-center rounded-lg bg-edujay-soft px-3 py-2 text-xs font-black text-edujay-primary transition hover:bg-blue-100 sm:w-fit"
                    >
                      Open attendance
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="min-w-0 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h2 className="text-base font-black text-edujay-ink">Students Needing Attention</h2>
              <p className="text-xs font-semibold leading-relaxed text-gray-400">
                Only students crossing clear follow-up thresholds appear here.
              </p>
            </div>
            <ClipboardList size={18} className="shrink-0 text-edujay-primary" />
          </div>
          {overview.studentsNeedingAttention.length === 0 ? (
            <p className="rounded-xl bg-gray-50 p-4 text-sm font-bold text-gray-500">
              No student has crossed an attention threshold.
            </p>
          ) : (
            <div className="divide-y divide-gray-50">
              {overview.studentsNeedingAttention.slice(0, 6).map((student) => (
                <Link
                  key={student.id}
                  href={`/list/students/${student.id}`}
                  className="flex items-center justify-between gap-3 py-3 transition hover:bg-gray-50"
                >
                  <div className="min-w-0">
                    <p className="break-words text-sm font-black text-edujay-ink">{student.name}</p>
                    <p className="mt-0.5 break-words text-xs font-semibold leading-relaxed text-gray-500">
                      {student.reasons.join(" · ")}
                    </p>
                  </div>
                  <ChevronRight size={16} className="shrink-0 text-gray-300" />
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="min-w-0 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h2 className="text-base font-black text-edujay-ink">Academic Readiness</h2>
            <p className="text-xs font-semibold leading-relaxed text-gray-400">CA and exam completion by timetable subject.</p>
          </div>
          <GraduationCap size={18} className="shrink-0 text-edujay-primary" />
        </div>
        <div className="grid gap-2 md:grid-cols-2">
          {overview.academicReadiness.map((subject) => (
            <div key={subject.subjectId} className="min-w-0 rounded-xl border border-gray-100 p-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="break-words text-sm font-black text-edujay-ink">{subject.subjectName}</p>
                  <p className="mt-0.5 break-words text-xs font-semibold text-gray-400">
                    {subject.teacher?.name ?? "No teacher"}{subject.teacher?.phone ? ` · ${subject.teacher.phone}` : ""}
                  </p>
                </div>
                <p className="shrink-0 text-xs font-black text-gray-500 sm:text-right">
                  {subject.examReady}/{subject.studentCount} ready
                </p>
              </div>
              <div className="mt-3 space-y-2">
                <div>
                  <div className="mb-1 flex justify-between text-[10px] font-black uppercase text-gray-400">
                    <span>CA started</span>
                    <span>{subject.caPct}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                    <div className="h-full rounded-full bg-edujay-primary" style={{ width: `${subject.caPct}%` }} />
                  </div>
                </div>
                <div>
                  <div className="mb-1 flex justify-between text-[10px] font-black uppercase text-gray-400">
                    <span>Exam scores</span>
                    <span>{subject.examPct}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                    <div className="h-full rounded-full bg-slate-900" style={{ width: `${subject.examPct}%` }} />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="min-w-0 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h2 className="text-base font-black text-edujay-ink">Teacher Follow-Up</h2>
              <p className="text-xs font-semibold leading-relaxed text-gray-400">Subject teachers blocking report readiness.</p>
            </div>
            <Users size={18} className="shrink-0 text-edujay-primary" />
          </div>
          {overview.teacherFollowUp.length === 0 ? (
            <p className="rounded-xl bg-emerald-50 p-4 text-sm font-bold text-emerald-700">
              No subject teacher is blocking report readiness.
            </p>
          ) : (
            <div className="divide-y divide-gray-50">
              {overview.teacherFollowUp.map((item) => (
                <div key={item.subjectId} className="py-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="break-words text-sm font-black text-edujay-ink">{item.subjectName}</p>
                      <p className="mt-0.5 break-words text-xs font-semibold text-gray-400">
                        {item.teacher?.name ?? "No teacher"}{item.teacher?.phone ? ` · ${item.teacher.phone}` : ""}
                      </p>
                    </div>
                    <span className="rounded-lg bg-amber-50 px-2 py-1 text-[10px] font-black text-amber-700">
                      {item.blockerCount} blocker{item.blockerCount === 1 ? "" : "s"}
                    </span>
                  </div>
                  <p className="mt-1 text-xs font-semibold text-gray-500">
                    {item.missingCA} missing CA · {item.missingExam} missing exam
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="min-w-0 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h2 className="text-base font-black text-edujay-ink">Report Submission Status</h2>
              <p className="text-xs font-semibold leading-relaxed text-gray-400">Class teacher review before admin publishing.</p>
            </div>
            <FileText size={18} className="shrink-0 text-edujay-primary" />
          </div>
          <div className={`rounded-xl p-4 ${reportTone(overview.report.status)}`}>
            <p className="text-lg font-black">{overview.report.label}</p>
            <p className="mt-1 text-sm font-semibold">
              {overview.report.readyEntryCount}/{overview.report.expectedEntryCount} student-subject entries ready.
            </p>
          </div>
          {overview.report.reviewNote ? (
            <p className="mt-3 rounded-xl bg-rose-50 p-3 text-xs font-semibold text-rose-700">
              Admin note: {overview.report.reviewNote}
            </p>
          ) : null}
          <Link
            href={`/list/report-cards?classId=${overview.class.id}`}
            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-edujay-ink px-3 py-3 text-xs font-black text-white transition hover:bg-edujay-primaryDark"
          >
            Open report builder
            <ChevronRight size={14} />
          </Link>
        </section>
      </div>
    </div>
  );
};

export default ClassTeacherControlPage;
