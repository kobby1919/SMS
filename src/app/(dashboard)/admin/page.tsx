"use client";

import Announcements from "@/src/components/Announcements";
import AttendanceChart from "@/src/components/AttendanceChart";
import CountChart from "@/src/components/CountChart";
import EventCalendar from "@/src/components/EventCalendar";
import FinanceChart from "@/src/components/FinanceChart";
import UserCard from "@/src/components/UserCard";
import { motion } from "framer-motion";

const cardTypes = [
  { type: "student", icon: "🎓" },
  { type: "teacher", icon: "👩‍🏫" },
  { type: "parent", icon: "👨‍👩‍👧" },
  { type: "staff", icon: "💼" },
];

const AdminPage = () => {
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
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
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1">
            {today}
          </p>
          <h1 className="font-nunito font-extrabold text-2xl md:text-3xl text-gray-800">
            Welcome back, Mr. Jay 👋
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Here is what is happening at SchoolJay today.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="bg-white text-jayPurple text-xs font-bold px-4 py-2 rounded-full shadow-sm">
            Term 2 • 2025/26
          </div>
          <div className="bg-jayPurple text-gray-700 text-xs font-bold px-4 py-2 rounded-full shadow-sm">
            Admin
          </div>
        </div>
      </motion.div>

      {/* USER CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cardTypes.map(({ type }, i) => (
          <motion.div
            key={type}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            <UserCard type={type} />
          </motion.div>
        ))}
      </div>

      {/* MAIN GRID */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* LEFT - takes 2/3 */}
        <div className="xl:col-span-2 flex flex-col gap-6">
          {/* COUNT + ATTENDANCE */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-1 h-[380px]">
              <CountChart />
            </div>
            <div className="md:col-span-2 h-[380px]">
              <AttendanceChart />
            </div>
          </div>

          {/* FINANCE */}
          <div className="h-[420px]">
            <FinanceChart />
          </div>
        </div>

        {/* RIGHT - takes 1/3, sticky */}
        <div className="flex flex-col gap-6 xl:sticky xl:top-[80px] xl:self-start">
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
            <Announcements />
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default AdminPage;