"use client";

import type { AdminOwnerDashboardData } from "@/src/lib/queries/admin-owner-dashboard";
import {
  AlertTriangle,
  CalendarCheck2,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  ExternalLink,
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

function getPulseStatus(pulse: Props["pulse"]) {
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
  const status = getPulseStatus(pulse);
  const completionRate =
    pulse.lessonsScheduledToday > 0
      ? Math.round((pulse.lessonsMarkedToday / pulse.lessonsScheduledToday) * 100)
      : 0;

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
                  Based only on submitted records, not unmarked lessons.
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
              <p className="text-sm font-black text-gray-900">Lesson Completion</p>
              <p className="text-xs font-semibold text-gray-500">
                Confirms whether today&apos;s attendance data can be trusted.
              </p>
            </div>
            <div className="rounded-lg bg-white px-3 py-2 text-right">
              <p className="text-xl font-black text-gray-950">{completionRate}%</p>
              <p className="text-[10px] font-black uppercase text-gray-400">Marked</p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-white p-3">
              <p className="text-[11px] font-black uppercase tracking-wide text-gray-400">Scheduled</p>
              <p className="mt-1 text-2xl font-black text-gray-950">{pulse.lessonsScheduledToday}</p>
            </div>
            <div className="rounded-lg bg-white p-3">
              <p className="text-[11px] font-black uppercase tracking-wide text-gray-400">Fully Marked</p>
              <p className="mt-1 text-2xl font-black text-gray-950">{pulse.lessonsMarkedToday}</p>
            </div>
            <div className="rounded-lg bg-white p-3">
              <p className="text-[11px] font-black uppercase tracking-wide text-gray-400">Unmarked</p>
              <p className="mt-1 text-2xl font-black text-gray-950">{pulse.unmarkedLessonsToday}</p>
            </div>
            <div className="rounded-lg bg-white p-3">
              <p className="text-[11px] font-black uppercase tracking-wide text-gray-400">Records</p>
              <p className="mt-1 text-2xl font-black text-gray-950">{pulse.attendanceRecordsToday}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-lg border border-gray-200">
        <div className="flex items-center justify-between gap-3 border-b border-gray-200 px-4 py-3">
          <div className="flex items-center gap-2">
            {pulse.unmarkedLessons.length > 0 ? (
              <AlertTriangle size={16} className="text-amber-600" />
            ) : (
              <CalendarCheck2 size={16} className="text-emerald-600" />
            )}
            <p className="text-sm font-black text-gray-900">
              {pulse.unmarkedLessons.length > 0 ? "Lessons Needing Attendance" : "Attendance Completion"}
            </p>
          </div>
          <a
            href="/admin/accountability"
            className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-xs font-black text-gray-700 transition hover:bg-gray-50"
          >
            Review
            <ExternalLink size={12} />
          </a>
        </div>

        {pulse.unmarkedLessons.length > 0 ? (
          <div className="divide-y divide-gray-100">
            {pulse.unmarkedLessons.map((lesson) => (
              <div key={lesson.lessonId} className="grid gap-3 px-4 py-3 sm:grid-cols-[1fr_auto] sm:items-center">
                <div className="min-w-0">
                  <p className="font-black text-gray-950">
                    {lesson.className} · {lesson.subjectName}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-gray-500">
                    {lesson.teacherName} · {formatTimeRange(lesson.startTime, lesson.endTime)}
                  </p>
                </div>
                <div className="rounded-lg bg-amber-50 px-3 py-2 text-sm font-black text-amber-700">
                  {lesson.markedRecords}/{lesson.expectedRecords} records
                </div>
              </div>
            ))}
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
