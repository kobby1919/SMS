"use client";

import { useState } from "react";
import type { AdminOwnerDashboardData } from "@/src/lib/queries/admin-owner-dashboard";
import {
  AlertTriangle,
  CalendarCheck2,
  ChevronDown,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  ExternalLink,
  School,
  XCircle,
} from "lucide-react";

type Props = {
  pulse: AdminOwnerDashboardData["schoolPulse"];
  activePeriod: AdminOwnerDashboardData["activePeriod"];
};

function formatTerm(term: string) {
  return term.replace("_", " ");
}

function formatTimeRange(startTime: Date, endTime: Date) {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${formatter.format(new Date(startTime))} - ${formatter.format(new Date(endTime))}`;
}

function formatDay(day: string) {
  return day.charAt(0) + day.slice(1).toLowerCase();
}

function formatActiveDays(days: string[]) {
  if (
    days.length === 5 &&
    days[0] === "MONDAY" &&
    days[4] === "FRIDAY"
  ) {
    return "Monday to Friday";
  }
  return days.map(formatDay).join(", ");
}

function getPulseStatus(pulse: Props["pulse"]) {
  if (!pulse.operatingStatus.isActiveDay) {
    return {
      label: "School Closed",
      tone: "border-slate-200 bg-slate-50 text-slate-700",
      bar: "bg-slate-400",
      message: "Today is outside this school's active operating days, so attendance and lesson completion are not expected.",
    };
  }

  if (pulse.unmarkedLessonsToday > 3) {
    return {
      label: "Critical",
      tone: "border-rose-200 bg-rose-50 text-rose-700",
      bar: "bg-rose-500",
      message: "Several lessons still need attendance, so today's school picture is incomplete.",
    };
  }

  if (pulse.unmarkedLessonsToday > 0 || pulse.attendanceRecordsToday === 0 || pulse.attendanceRate < 70) {
    return {
      label: "Needs Attention",
      tone: "border-amber-200 bg-amber-50 text-amber-700",
      bar: "bg-amber-500",
      message: pulse.unmarkedLessonsToday > 0
        ? "Some lessons are still missing attendance records."
        : "Attendance has not produced a strong enough picture yet.",
    };
  }

  return {
    label: "Healthy",
    tone: "border-emerald-200 bg-emerald-50 text-emerald-700",
    bar: "bg-emerald-500",
    message: "Today looks healthy based on submitted attendance records.",
  };
}

function MetricCard({
  label,
  value,
  tone,
  icon,
}: {
  label: string;
  value: number;
  tone: string;
  icon: React.ReactNode;
}) {
  return (
    <div className={`rounded-lg border p-3 ${tone}`}>
      <div className="mb-2 flex items-center gap-2 text-[11px] font-black uppercase tracking-wide opacity-75">
        {icon}
        <span>{label}</span>
      </div>
      <p className="text-2xl font-black leading-none sm:text-3xl">{value}</p>
    </div>
  );
}

export default function AdminOwnerSchoolPulse({ pulse, activePeriod }: Props) {
  const [expandedClassId, setExpandedClassId] = useState<number | null>(null);
  const [showAllClasses, setShowAllClasses] = useState(false);
  const status = getPulseStatus(pulse);
  const isClosedDay = !pulse.operatingStatus.isActiveDay;
  const expectedDuties = pulse.lessonsMarkedToday + pulse.unmarkedLessonsToday;
  const completionRate =
    expectedDuties > 0
      ? Math.round((pulse.lessonsMarkedToday / expectedDuties) * 100)
      : 0;
  const fullyCoveredClasses = pulse.classDutySummary.filter((item) => item.incompleteDuties === 0).length;
  const classesNeedingFollowUp = pulse.classDutySummary.filter((item) => item.incompleteDuties > 0).length;
  const displayedClassSummary = showAllClasses ? pulse.classDutySummary : pulse.classDutySummary.slice(0, 6);

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-black text-gray-950">Today&apos;s School Pulse</h2>
            <span className={`rounded-full border px-3 py-1 text-xs font-black ${status.tone}`}>
              {status.label}
            </span>
          </div>
          <p className="mt-1 text-sm font-semibold text-gray-500">
            {pulse.todayLabel} · {formatTerm(activePeriod.currentTerm)} · {activePeriod.academicYear}
          </p>
          <p className="mt-3 max-w-2xl text-sm font-medium leading-6 text-gray-600">
            {status.message}
          </p>
          {isClosedDay ? (
            <p className="mt-2 text-xs font-bold text-gray-500">
              Active days: {formatActiveDays(pulse.operatingStatus.activeDays)} · School hours:{" "}
              {pulse.operatingStatus.openingTime}-{pulse.operatingStatus.closingTime}
            </p>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end">
          <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
            <p className="text-[11px] font-black uppercase tracking-wide text-gray-400">Students</p>
            <p className="text-lg font-black text-gray-900">{pulse.totalStudents}</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
            <p className="text-[11px] font-black uppercase tracking-wide text-gray-400">Classes</p>
            <p className="text-lg font-black text-gray-900">{pulse.totalClasses}</p>
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <MetricCard
              label="Present"
              value={pulse.present}
              icon={<CheckCircle2 size={14} />}
              tone="border-emerald-200 bg-emerald-50 text-emerald-700"
            />
            <MetricCard
              label="Absent"
              value={pulse.absent}
              icon={<XCircle size={14} />}
              tone="border-rose-200 bg-rose-50 text-rose-700"
            />
            <MetricCard
              label="Late"
              value={pulse.late}
              icon={<Clock3 size={14} />}
              tone="border-amber-200 bg-amber-50 text-amber-700"
            />
            <MetricCard
              label="Excused"
              value={pulse.excused}
              icon={<ClipboardCheck size={14} />}
              tone="border-indigo-200 bg-indigo-50 text-indigo-700"
            />
          </div>

          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-black text-gray-900">Attendance Rate</p>
              <p className="text-xs font-semibold text-gray-500">
                {isClosedDay
                  ? "Paused because today is not an active school day."
                  : "Based only on submitted records, not unmarked lessons."}
              </p>
            </div>
              <p className="text-2xl font-black text-gray-950">{pulse.attendanceRate}%</p>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
              <div
                className={`h-full rounded-full ${status.bar}`}
                style={{ width: `${Math.min(Math.max(pulse.attendanceRate, 0), 100)}%` }}
              />
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-black text-gray-900">Attendance Duties</p>
              <p className="text-xs font-semibold text-gray-500">
                {isClosedDay
                  ? "No lesson completion is expected today."
                  : "One duty means one scheduled class lesson that needs attendance."}
              </p>
            </div>
            <div className="rounded-lg bg-white px-3 py-2 text-right">
              <p className="text-xl font-black text-gray-950">{completionRate}%</p>
              <p className="text-[10px] font-black uppercase text-gray-400">Marked</p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-white p-3">
              <p className="text-[11px] font-black uppercase tracking-wide text-gray-400">Expected</p>
              <p className="mt-1 text-2xl font-black text-gray-950">{expectedDuties}</p>
            </div>
            <div className="rounded-lg bg-white p-3">
              <p className="text-[11px] font-black uppercase tracking-wide text-gray-400">Completed</p>
              <p className="mt-1 text-2xl font-black text-gray-950">{pulse.lessonsMarkedToday}</p>
            </div>
            <div className="rounded-lg bg-white p-3">
              <p className="text-[11px] font-black uppercase tracking-wide text-gray-400">Incomplete</p>
              <p className="mt-1 text-2xl font-black text-gray-950">{pulse.unmarkedLessonsToday}</p>
            </div>
            <div className="rounded-lg bg-white p-3">
              <p className="text-[11px] font-black uppercase tracking-wide text-gray-400">Records</p>
              <p className="mt-1 text-2xl font-black text-gray-950">{pulse.attendanceRecordsToday}</p>
            </div>
          </div>

          <div className="mt-4 rounded-lg bg-white p-3">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <School size={15} className="text-gray-500" />
                <p className="text-xs font-black uppercase tracking-wide text-gray-500">
                  Classes Today
                </p>
              </div>
              <p className="text-xs font-bold text-gray-500">
                {fullyCoveredClasses} covered · {classesNeedingFollowUp} need follow-up
              </p>
            </div>
            {displayedClassSummary.length > 0 ? (
              <div className="space-y-2">
                {displayedClassSummary.map((item) => (
                  <div key={item.classId} className="rounded-lg border border-gray-100">
                    <button
                      type="button"
                      onClick={() => setExpandedClassId((current) => current === item.classId ? null : item.classId)}
                      className="grid w-full gap-2 p-2 text-left transition hover:bg-gray-50 sm:grid-cols-[100px_1fr_auto_auto] sm:items-center"
                    >
                      <p className="truncate text-xs font-black text-gray-800">{item.className}</p>
                      <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                        <div
                          className={`h-full rounded-full ${item.incompleteDuties > 0 ? "bg-amber-500" : "bg-emerald-500"}`}
                          style={{ width: `${Math.min(Math.max(item.completionRate, 0), 100)}%` }}
                        />
                      </div>
                      <p className="text-xs font-black text-gray-600">
                        {item.completedDuties}/{item.expectedDuties}
                      </p>
                      <ChevronDown
                        size={14}
                        className={`text-gray-400 transition ${expandedClassId === item.classId ? "rotate-180" : ""}`}
                      />
                    </button>

                    {expandedClassId === item.classId ? (
                      <div className="space-y-2 border-t border-gray-100 p-2">
                        {item.duties.map((duty) => (
                          <div
                            key={duty.lessonId}
                            className="grid gap-2 rounded-lg bg-gray-50 p-2 sm:grid-cols-[1fr_auto] sm:items-center"
                          >
                            <div className="min-w-0">
                              <p className="text-xs font-black text-gray-900">{duty.subjectName}</p>
                              <p className="mt-0.5 text-[11px] font-semibold text-gray-500">
                                {duty.teacherName} · {formatTimeRange(duty.startTime, duty.endTime)}
                              </p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                              <span
                                className={`rounded-full px-2 py-1 text-[10px] font-black uppercase ${
                                  duty.isComplete
                                    ? "bg-emerald-100 text-emerald-700"
                                    : "bg-amber-100 text-amber-700"
                                }`}
                              >
                                {duty.isComplete ? "Complete" : "Incomplete"}
                              </span>
                              <span className="rounded-lg bg-white px-2 py-1 text-[11px] font-black text-gray-700">
                                {duty.markedRecords}/{duty.expectedRecords}
                              </span>
                              {!duty.isComplete ? (
                                <a
                                  href={duty.reviewHref}
                                  className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-[11px] font-black text-gray-700 transition hover:bg-gray-50"
                                >
                                  Review
                                </a>
                              ) : null}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))}
                {pulse.classDutySummary.length > 6 ? (
                  <button
                    type="button"
                    onClick={() => setShowAllClasses((value) => !value)}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs font-black text-gray-700 transition hover:bg-gray-50"
                  >
                    {showAllClasses
                      ? "Show fewer classes"
                      : `Show all ${pulse.classDutySummary.length} classes`}
                  </button>
                ) : null}
              </div>
            ) : (
              <p className="text-sm font-semibold text-gray-500">
                No attendance duties are expected for classes today.
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-lg border border-gray-200">
        <div className="flex items-center justify-between gap-3 border-b border-gray-200 px-4 py-3">
          <div className="flex items-center gap-2">
            {!isClosedDay && pulse.unmarkedLessons.length > 0 ? (
              <AlertTriangle size={16} className="text-amber-600" />
            ) : (
              <CalendarCheck2 size={16} className="text-emerald-600" />
            )}
            <p className="text-sm font-black text-gray-900">
              {isClosedDay
                ? "School Closed Today"
                : pulse.unmarkedLessons.length > 0
                  ? "Lessons Needing Attendance"
                  : "Attendance Completion"}
            </p>
          </div>
          {!isClosedDay ? (
            <a
              href="/admin/accountability?type=ATTENDANCE&date=today"
              className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-xs font-black text-gray-700 transition hover:bg-gray-50"
            >
              Review attendance
              <ExternalLink size={12} />
            </a>
          ) : null}
        </div>

        {isClosedDay ? (
          <div className="px-4 py-5">
            <p className="text-sm font-semibold text-slate-700">
              Edujay is not expecting attendance today because {formatDay(pulse.operatingStatus.currentDay)} is outside the active school days.
            </p>
          </div>
        ) : pulse.unmarkedLessons.length > 0 ? (
          <div>
            <div className="border-b border-gray-100 px-4 py-2">
              <p className="text-xs font-semibold text-gray-500">
                Showing {pulse.unmarkedLessons.length} of {pulse.unmarkedLessonsToday} incomplete duties.
              </p>
            </div>
            <div className="divide-y divide-gray-100">
            {pulse.unmarkedLessons.map((lesson) => (
              <div key={lesson.lessonId} className="grid gap-3 px-4 py-3 sm:grid-cols-[1fr_auto] sm:items-center">
                <div className="min-w-0">
                  <p className="text-sm font-black text-gray-950">
                    {lesson.className} · {lesson.subjectName}
                  </p>
                  <p className="mt-1 text-xs font-semibold text-gray-500">
                    {lesson.teacherName} · {formatTimeRange(lesson.startTime, lesson.endTime)}
                  </p>
                  {lesson.obligationStatus ? (
                    <p className="mt-1 text-[11px] font-bold uppercase tracking-wide text-gray-400">
                      Duty status: {lesson.obligationStatus.replace("_", " ")}
                    </p>
                  ) : null}
                </div>
                <div className="flex items-center gap-2 sm:justify-end">
                  <div className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-black text-amber-700">
                    {lesson.markedRecords}/{lesson.expectedRecords} records
                  </div>
                  <a
                    href={lesson.reviewHref}
                    className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-xs font-black text-gray-700 transition hover:bg-gray-50"
                  >
                    Review
                    <ExternalLink size={11} />
                  </a>
                </div>
              </div>
            ))}
            </div>
          </div>
        ) : (
          <div className="px-4 py-5">
            <p className="text-sm font-semibold text-emerald-700">
              All scheduled lessons with students have attendance submitted.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
