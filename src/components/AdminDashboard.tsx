"use client";

import Announcements from "@/src/components/Announcements";
import AttendanceChart from "@/src/components/AttendanceChart";
import FinanceChart from "@/src/components/FinanceChart";
import CountChart from "@/src/components/CountChart";
import EventCalendar from "@/src/components/EventCalendar";
import { motion } from "framer-motion";
import UserCardClient from "./UserCardClient ";

type CountEntry = { type: "admin" | "teacher" | "student" | "parent"; count: number };
type DayData    = { name: string; present: number; absent: number };
type MonthData  = { name: string; income: number; expense: number };

type TimetableSnapshot = {
  totalLessons: number;
  totalClasses: number;
  todayLessons: number;
  todayDay:     string;
};

type Props = {
  counts:            CountEntry[];
  boys:              number;
  girls:             number;
  attendanceData:    DayData[];
  financeData:       MonthData[];
  eventList:         React.ReactNode;
  announcements:     React.ReactNode;
  timetableSnapshot: TimetableSnapshot;
};

const AdminDashboard = ({
  counts, boys, girls, attendanceData, financeData,
  eventList, announcements, timetableSnapshot,
}: Props) => {
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  return (
    <div className="p-4 md:p-6 flex flex-col gap-6">

      {/* WELCOME BANNER */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="bg-gradient-to-r from-jayPurple via-jayPurpleLight to-jaySkyLight rounded-2xl px-6 py-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
      >
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1">{today}</p>
          <h1 className="font-nunito font-extrabold text-2xl md:text-3xl text-gray-800">Welcome back, Mr. Jay 👋</h1>
          <p className="text-sm text-gray-500 mt-1">Here is what is happening at SchoolJay today.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="bg-white text-jayPurple text-xs font-bold px-4 py-2 rounded-full shadow-sm">Term 2 • 2025/26</div>
          <div className="bg-jayPurple text-gray-700 text-xs font-bold px-4 py-2 rounded-full shadow-sm">Admin</div>
        </div>
      </motion.div>

      {/* USER CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {counts.map(({ type, count }, i) => (
          <motion.div key={type} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
            <UserCardClient type={type} count={count} />
          </motion.div>
        ))}
      </div>

      {/* MAIN GRID */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 flex flex-col gap-6">

          {/* Charts row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-1 h-[380px]">
              <CountChart boys={boys} girls={girls} />
            </div>
            <div className="md:col-span-2 h-[380px]">
              <AttendanceChart data={attendanceData} />
            </div>
          </div>

          {/* Finance chart */}
          <div className="h-[420px]">
            <FinanceChart data={financeData} />
          </div>

          {/* TIMETABLE SNAPSHOT CARD */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.3 }}
          >
            <a
              href="/admin/timetable"
              className="block bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md hover:border-indigo-100 transition-all group"
            >
              {/* Card header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center shrink-0 group-hover:bg-indigo-100 transition-colors">
                    <span className="text-lg">📅</span>
                  </div>
                  <div>
                    <h2 className="font-black text-gray-800 text-sm">Master Timetable</h2>
                    <p className="text-[11px] text-gray-400 font-medium">
                      {timetableSnapshot.todayLessons} lessons scheduled for {timetableSnapshot.todayDay}
                    </p>
                  </div>
                </div>
                <span className="text-xs font-bold text-indigo-500 group-hover:text-indigo-700 transition-colors flex items-center gap-1">
                  Open Builder
                  <span className="group-hover:translate-x-0.5 transition-transform inline-block">→</span>
                </span>
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Total Slots",     value: timetableSnapshot.totalLessons, color: "bg-indigo-50 text-indigo-600"   },
                  { label: "Classes Covered", value: timetableSnapshot.totalClasses, color: "bg-emerald-50 text-emerald-600" },
                  { label: "Today's Lessons", value: timetableSnapshot.todayLessons, color: "bg-amber-50 text-amber-600"     },
                ].map((s) => (
                  <div key={s.label} className={`rounded-xl p-3 ${s.color}`}>
                    <p className="text-2xl font-black leading-none">{s.value}</p>
                    <p className="text-[10px] font-bold uppercase tracking-wide opacity-70 mt-1">{s.label}</p>
                  </div>
                ))}
              </div>

              {/* Day pills */}
              <div className="flex gap-2 mt-4 flex-wrap">
                {["Mon", "Tue", "Wed", "Thu", "Fri"].map((d) => (
                  <span
                    key={d}
                    className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-colors
                      ${d === timetableSnapshot.todayDay.slice(0, 3)
                        ? "bg-indigo-600 text-white"
                        : "bg-gray-100 text-gray-400"}`}
                  >
                    {d}
                  </span>
                ))}
              </div>
            </a>
          </motion.div>
        </div>

        {/* RIGHT COLUMN */}
        <div className="flex flex-col gap-4 xl:sticky xl:top-[80px] xl:self-start">
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, delay: 0.2 }}>
            <EventCalendar />
          </motion.div>
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, delay: 0.3 }}>
            {eventList}
          </motion.div>
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, delay: 0.4 }}>
            {announcements}
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
