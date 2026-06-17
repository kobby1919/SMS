"use client";

// src/components/AdminDashboard.tsx

import FinanceChart from "@/src/components/FinanceChart";
import CountChart from "@/src/components/CountChart";
import AttendanceBarChart from "@/src/components/AttendanceBarChart";
import EventCalendar from "@/src/components/EventCalendar";
import WelcomeBanner from "@/src/components/WelcomeBanner";
import { motion } from "framer-motion";
import UserCardClient from "./UserCardClient ";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  XCircle,
  Clock,
  FileCheck,
  AlertTriangle,
  CalendarDays,
  TrendingUp,
  ScrollText,
  ChevronRight,
} from "lucide-react";

type CountEntry = {
  type: "admin" | "teacher" | "student" | "parent";
  count: number;
};
type DayData = { name: string; present: number; absent: number };
type MonthData = { name: string; income: number; expense: number };
type TimetableSnapshot = {
  totalLessons: number;
  totalClasses: number;
  todayLessons: number;
  todayDay: string;
};
type AttendanceSnapshot = {
  todayPresent: number;
  todayAbsent: number;
  todayLate: number;
  todayExcused: number;
  todayRate: number;
  totalStudents: number;
  flaggedCount: number;
  flagged: {
    name: string;
    surname: string;
    className: string;
    streak: number;
  }[];
};
type CASnapshot = {
  totalRecords: number;
  schoolAvg: number;
  configExists: boolean;
};
type SyllabusSnapshot = {
  total: number;
  published: number;
  draft: number;
};

type Props = {
  counts: CountEntry[];
  boys: number;
  girls: number;
  attendanceData: DayData[];
  financeData: MonthData[];
  eventList: React.ReactNode;
  announcements: React.ReactNode;
  timetableSnapshot: TimetableSnapshot;
  attendanceSnapshot: AttendanceSnapshot;
  caSnapshot: CASnapshot;
  syllabusSnapshot: SyllabusSnapshot;
};

const AdminDashboard = ({
  counts,
  boys,
  girls,
  attendanceData,
  financeData,
  eventList,
  announcements,
  timetableSnapshot,
  attendanceSnapshot,
  caSnapshot,
  syllabusSnapshot,
}: Props) => {
  const router = useRouter();
  const noAttendanceTaken =
    attendanceSnapshot.todayPresent + attendanceSnapshot.todayAbsent === 0;

  return (
    <div className="p-4 md:p-6 flex flex-col gap-6">
      <WelcomeBanner
        role="admin"
        name="Admin"
        subtitle="Here is what is happening at your school today."
        tag="Term 2 · 2025/26"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {counts.map(({ type, count }, i) => (
          <motion.div
            key={type}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            <UserCardClient type={type} count={count} />
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 flex flex-col gap-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-1 h-[300px]">
              <CountChart boys={boys} girls={girls} />
            </div>
            <div className="md:col-span-2 h-[300px]">
              <AttendanceBarChart data={attendanceData} />
            </div>
          </div>

          {/* ── Attendance card ── */}
          <motion.div 
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.15 }}
          >
            <div
              onClick={() => router.push("/list/attendance")}
              className="block bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md hover:border-emerald-100 transition-all group cursor-pointer"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center shrink-0 group-hover:bg-emerald-100 transition-colors">
                    <CalendarDays size={18} className="text-emerald-600" />
                  </div>
                  <div>
                    <h2 className="font-black text-gray-800 text-sm">
                      Today&apos;s Attendance
                    </h2>
                    <p className="text-[11px] text-gray-400 font-medium">
                      {attendanceSnapshot.todayRate}% rate ·{" "}
                      {attendanceSnapshot.todayPresent +
                        attendanceSnapshot.todayAbsent +
                        attendanceSnapshot.todayLate +
                        attendanceSnapshot.todayExcused}{" "}
                      records taken
                    </p>
                  </div>
                </div>
                <span className="text-xs font-bold text-emerald-500 group-hover:text-emerald-700 transition-colors">
                  View All →
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
                {[
                  {
                    label: "Present",
                    value: attendanceSnapshot.todayPresent,
                    icon: <CheckCircle2 size={13} />,
                    color: "bg-emerald-50 text-emerald-700 border-emerald-200",
                  },
                  {
                    label: "Absent",
                    value: attendanceSnapshot.todayAbsent,
                    icon: <XCircle size={13} />,
                    color: "bg-rose-50 text-rose-700 border-rose-200",
                  },
                  {
                    label: "Late",
                    value: attendanceSnapshot.todayLate,
                    icon: <Clock size={13} />,
                    color: "bg-amber-50 text-amber-700 border-amber-200",
                  },
                  {
                    label: "Excused",
                    value: attendanceSnapshot.todayExcused,
                    icon: <FileCheck size={13} />,
                    color: "bg-indigo-50 text-indigo-700 border-indigo-200",
                  },
                ].map((s) => (
                  <div
                    key={s.label}
                    className={`rounded-xl p-3 border ${s.color}`}
                  >
                    <div className="flex items-center gap-1 mb-1.5 opacity-60">
                      {s.icon}
                      <span className="text-[9px] font-black uppercase tracking-wide">
                        {s.label}
                      </span>
                    </div>
                    <p className="text-2xl font-black leading-none">
                      {s.value}
                    </p>
                  </div>
                ))}
              </div>
              <div className="mb-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] text-gray-400 font-semibold">
                    School-wide rate
                  </span>
                  <span
                    className={`text-[11px] font-black ${attendanceSnapshot.todayRate >= 80 ? "text-emerald-600" : attendanceSnapshot.todayRate >= 60 ? "text-amber-600" : "text-rose-600"}`}
                  >
                    {attendanceSnapshot.todayRate}%
                  </span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${attendanceSnapshot.todayRate >= 80 ? "bg-emerald-500" : attendanceSnapshot.todayRate >= 60 ? "bg-amber-500" : "bg-rose-500"}`}
                    style={{
                      width: `${Math.max(attendanceSnapshot.todayRate, 0)}%`,
                    }}
                  />
                </div>
              </div>
              {attendanceSnapshot.flaggedCount > 0 ? (
                <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                  <AlertTriangle
                    size={13}
                    className="text-amber-600 shrink-0 mt-0.5"
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-amber-800">
                      {attendanceSnapshot.flaggedCount} student
                      {attendanceSnapshot.flaggedCount !== 1 ? "s" : ""} with 3+
                      consecutive absences
                    </p>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {attendanceSnapshot.flagged.map((s, i) => (
                        <span
                          key={i}
                          className="text-[10px] font-bold px-2 py-0.5 bg-white border border-amber-200 text-amber-700 rounded-lg"
                        >
                          {s.name} · {s.className} · {s.streak}d
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-2">
                  {noAttendanceTaken ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push("/list/attendance/take");
                      }}
                      className="text-xs text-emerald-600 font-bold hover:underline cursor-pointer bg-transparent border-none p-0"
                    >
                      → No attendance taken yet — take attendance now
                    </button>
                  ) : (
                    <p className="text-xs text-emerald-600 font-semibold">
                      ✅ No flagged students today
                    </p>
                  )}
                </div>
              )}
            </div>
          </motion.div>

          <div className="h-[420px]">
            <FinanceChart data={financeData} />
          </div>

          {/* ── Timetable card — uses <a> (no nested links inside) ── */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.3 }}
          >
            <a
              href="/admin/timetable"
              className="block bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md hover:border-indigo-100 transition-all group"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center shrink-0 group-hover:bg-indigo-100 transition-colors">
                    <span className="text-lg">📅</span>
                  </div>
                  <div>
                    <h2 className="font-black text-gray-800 text-sm">
                      Master Timetable
                    </h2>
                    <p className="text-[11px] text-gray-400 font-medium">
                      {timetableSnapshot.todayLessons} lessons scheduled for{" "}
                      {timetableSnapshot.todayDay}
                    </p>
                  </div>
                </div>
                <span className="text-xs font-bold text-indigo-500 group-hover:text-indigo-700 transition-colors flex items-center gap-1">
                  Open Builder{" "}
                  <span className="group-hover:translate-x-0.5 transition-transform inline-block">
                    →
                  </span>
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  {
                    label: "Total Slots",
                    value: timetableSnapshot.totalLessons,
                    color: "bg-indigo-50 text-indigo-600",
                  },
                  {
                    label: "Classes Covered",
                    value: timetableSnapshot.totalClasses,
                    color: "bg-emerald-50 text-emerald-600",
                  },
                  {
                    label: "Today's Lessons",
                    value: timetableSnapshot.todayLessons,
                    color: "bg-amber-50 text-amber-600",
                  },
                ].map((s) => (
                  <div key={s.label} className={`rounded-xl p-3 ${s.color}`}>
                    <p className="text-2xl font-black leading-none">
                      {s.value}
                    </p>
                    <p className="text-[10px] font-bold uppercase tracking-wide opacity-70 mt-1">
                      {s.label}
                    </p>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 mt-4 flex-wrap">
                {["Mon", "Tue", "Wed", "Thu", "Fri"].map((day) => (
                  <span
                    key={day}
                    className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-colors ${day === timetableSnapshot.todayDay.slice(0, 3) ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-400"}`}
                  >
                    {day}
                  </span>
                ))}
              </div>
            </a>
          </motion.div>
        </div>

        {/* ── RIGHT SIDEBAR ── */}
        <div className="flex flex-col gap-4 xl:sticky xl:top-[80px] xl:self-start">
          {/* ── CA Snapshot card ──
              FIX: outer wrapper is now a plain div + router.push on click.
              The inner "set up now" link uses e.stopPropagation() so it
              navigates to its own route without triggering the outer click.
          */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <div
              onClick={() => router.push("/list/ca")}
              className="block bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md hover:border-violet-100 transition-all group cursor-pointer"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-violet-50 rounded-xl flex items-center justify-center shrink-0 group-hover:bg-violet-100 transition-colors">
                    <TrendingUp size={16} className="text-violet-600" />
                  </div>
                  <div>
                    <h2 className="font-black text-gray-800 text-sm">
                      Continuous Assessment
                    </h2>
                    <p className="text-[10px] text-gray-400 font-medium">
                      School-wide CA overview
                    </p>
                  </div>
                </div>
                <ChevronRight
                  size={14}
                  className="text-gray-300 group-hover:text-violet-500 transition-colors"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-violet-50 rounded-xl p-3">
                  <p className="text-xl font-black text-violet-700 leading-none">
                    {caSnapshot.totalRecords}
                  </p>
                  <p className="text-[9px] font-bold text-violet-500 uppercase mt-1">
                    Total Records
                  </p>
                </div>
                <div
                  className={`rounded-xl p-3 ${caSnapshot.schoolAvg >= 70 ? "bg-emerald-50" : caSnapshot.schoolAvg >= 50 ? "bg-amber-50" : "bg-rose-50"}`}
                >
                  <p
                    className={`text-xl font-black leading-none ${caSnapshot.schoolAvg >= 70 ? "text-emerald-700" : caSnapshot.schoolAvg >= 50 ? "text-amber-700" : "text-rose-700"}`}
                  >
                    {caSnapshot.totalRecords > 0
                      ? `${caSnapshot.schoolAvg}%`
                      : "—"}
                  </p>
                  <p
                    className={`text-[9px] font-bold uppercase mt-1 ${caSnapshot.schoolAvg >= 70 ? "text-emerald-500" : caSnapshot.schoolAvg >= 50 ? "text-amber-500" : "text-rose-500"}`}
                  >
                    School Avg
                  </p>
                </div>
              </div>
              {!caSnapshot.configExists && (
                <p className="text-[10px] text-amber-600 font-semibold mt-3 flex items-center gap-1">
                  <AlertTriangle size={10} /> No CA config set —{" "}
                  {/* ✅ span + router.push instead of nested <Link> */}
                  <span
                    className="underline cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push("/admin/ca-config");
                    }}
                  >
                    set up now
                  </span>
                </p>
              )}
            </div>
          </motion.div>

          {/* ── Syllabus Snapshot card ──
              FIX: outer wrapper is now a plain div + router.push on click.
              The inner "create the first one" span uses e.stopPropagation()
              so it navigates to /list/syllabus/new independently.
          */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
          >
            <div
              onClick={() => router.push("/list/syllabus")}
              className="block bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md hover:border-indigo-100 transition-all group cursor-pointer"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-indigo-50 rounded-xl flex items-center justify-center shrink-0 group-hover:bg-indigo-100 transition-colors">
                    <ScrollText size={16} className="text-indigo-600" />
                  </div>
                  <div>
                    <h2 className="font-black text-gray-800 text-sm">
                      Syllabi
                    </h2>
                    <p className="text-[10px] text-gray-400 font-medium">
                      Subject syllabus management
                    </p>
                  </div>
                </div>
                <ChevronRight
                  size={14}
                  className="text-gray-300 group-hover:text-indigo-500 transition-colors"
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  {
                    label: "Total",
                    value: syllabusSnapshot.total,
                    color: "bg-indigo-50 text-indigo-700",
                  },
                  {
                    label: "Published",
                    value: syllabusSnapshot.published,
                    color: "bg-emerald-50 text-emerald-700",
                  },
                  {
                    label: "Draft",
                    value: syllabusSnapshot.draft,
                    color: "bg-amber-50 text-amber-700",
                  },
                ].map((s) => (
                  <div
                    key={s.label}
                    className={`rounded-xl p-3 ${s.color} text-center`}
                  >
                    <p className="text-xl font-black leading-none">{s.value}</p>
                    <p className="text-[9px] font-bold uppercase mt-1 opacity-70">
                      {s.label}
                    </p>
                  </div>
                ))}
              </div>
              {syllabusSnapshot.total === 0 && (
                <p className="text-[10px] text-gray-400 font-semibold mt-3 text-center">
                  No syllabi yet —{" "}
                  {/* ✅ span + router.push instead of nested <Link> */}
                  <span
                    className="text-indigo-500 underline cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push("/list/syllabus/new");
                    }}
                  >
                    create the first one
                  </span>
                </p>
              )}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <EventCalendar />
          </motion.div>
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            {eventList}
          </motion.div>
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            {announcements}
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
