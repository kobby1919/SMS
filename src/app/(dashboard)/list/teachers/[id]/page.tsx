"use client";

import Announcements from "@/src/components/Announcements";
import BigCalendar from "@/src/components/BigCalendar";
import Performance from "@/src/components/Performance";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Mail,
  Phone,
  Droplets,
  Calendar,
  BookOpen,
  Users,
  Clock,
  Award,
} from "lucide-react";

const SingleTeacherPage = () => {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 },
    },
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1 },
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="flex-1 p-4 flex flex-col gap-4 xl:flex-row"
    >
      {/* ── LEFT ── */}
      <div className="w-full xl:w-2/3 flex flex-col gap-4">
        {/* ── Hero card ── */}
        <motion.div
          variants={itemVariants}
          className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
        >
          <div className="h-24 bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-600 relative">
            <div
              className="absolute inset-0 opacity-20"
              style={{
                backgroundImage:
                  "radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)",
                backgroundSize: "40px 40px",
              }}
            />
          </div>

          <div className="px-5 pb-5">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 -mt-10 sm:-mt-12 mb-4">
              <div className="flex flex-col sm:flex-row items-center sm:items-end gap-4">
                <div className="relative shrink-0">
                  <Image
                    src="https://images.pexels.com/photos/2182970/pexels-photo-2182970.jpeg?auto=compress&cs=tinysrgb&w=1200"
                    alt="Mr Jay"
                    width={96}
                    height={96}
                    className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl object-cover ring-4 ring-white shadow-md bg-white"
                  />
                  <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-400 rounded-full border-2 border-white" />
                </div>
                <div className="mb-1 text-center sm:text-left">
                  <h1 className="text-xl font-black text-gray-800 tracking-tight">
                    Mr. Jay
                  </h1>
                  <p className="text-sm text-indigo-600 font-semibold">
                    Senior Mathematics Teacher
                  </p>
                </div>
              </div>
              <div className="flex justify-center sm:justify-start gap-2 shrink-0">
                <button className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition-all active:scale-95 shadow-sm">
                  Edit Profile
                </button>
                <button className="px-4 py-2 rounded-xl bg-gray-100 text-gray-600 text-xs font-bold hover:bg-gray-200 transition-all active:scale-95">
                  Message
                </button>
              </div>
            </div>
            <p className="text-sm text-gray-500 leading-relaxed mb-5 max-w-xl text-center sm:text-left mx-auto sm:mx-0">
              Dedicated mathematics educator with over 8 years of experience
              inspiring students through innovative teaching methods.
            </p>
            <div className="flex flex-wrap justify-center sm:justify-start gap-2.5">
              {[
                { icon: <Droplets size={13} />, label: "A+" },
                { icon: <Calendar size={13} />, label: "Joined Jan 2026" },
                { icon: <Mail size={13} />, label: "user@gmail.com" },
                { icon: <Phone size={13} />, label: "+1 234 567" },
              ].map(({ icon, label }) => (
                <div
                  key={label}
                  className="flex items-center gap-1.5 bg-gray-100 rounded-full px-3 py-1.5 text-xs font-medium text-gray-600"
                >
                  <span className="text-indigo-500">{icon}</span>
                  {label}
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* ── Stats row ── */}
        <motion.div
          variants={itemVariants}
          className="grid grid-cols-2 sm:grid-cols-4 gap-3"
        >
          {[
            {
              icon: <Clock size={16} />,
              value: "90%",
              label: "Attendance",
              color: "bg-indigo-50 text-indigo-600",
            },
            {
              icon: <BookOpen size={16} />,
              value: "6",
              label: "Lessons",
              color: "bg-amber-50 text-amber-600",
            },
            {
              icon: <Users size={16} />,
              value: "2",
              label: "Branches",
              color: "bg-emerald-50 text-emerald-600",
            },
            {
              icon: <Award size={16} />,
              value: "4",
              label: "Classes",
              color: "bg-violet-50 text-violet-600",
            },
          ].map((stat) => (
            <motion.div
              whileHover={{ scale: 1.02 }}
              key={stat.label}
              className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex items-center gap-3"
            >
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${stat.color}`}
              >
                {stat.icon}
              </div>
              <div>
                <p className="text-xl font-black text-gray-800 leading-none">
                  {stat.value}
                </p>
                <p className="text-xs text-gray-400 font-medium mt-0.5">
                  {stat.label}
                </p>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* ── Schedule ── */}
        <motion.div
          variants={itemVariants}
          className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex-1 min-h-[400px]"
        >
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-4">
            <div>
              <h2 className="text-base font-black text-gray-800">
                Teaching Schedule
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Weekly timetable overview
              </p>
            </div>
            <span className="text-xs font-semibold bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-full">
              This Week
            </span>
          </div>
          <div className="h-[calc(100%-60px)]">
            <BigCalendar />
          </div>
        </motion.div>
      </div>

      {/* ── RIGHT ── */}
      <motion.div
        variants={containerVariants}
        className="w-full xl:w-1/3 flex flex-col gap-4"
      >
        <motion.div
          variants={itemVariants}
          className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-black text-gray-800">Quick Access</h2>
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
              Shortcuts
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            {[
              {
                label: "Classes",
                href: `/list/classes?supervisorId=${"teacher2"}`,
                color: "bg-indigo-50 text-indigo-600 hover:bg-indigo-100",
                icon: "🏫",
              },
              {
                label: "Students",
                href: `/list/students?teacherId=${"teacher2"}`,
                color: "bg-violet-50 text-violet-600 hover:bg-violet-100",
                icon: "👨‍🎓",
              },
              {
                label: "Lessons",
                href: `/list/lessons?teacherId=${"teacher2"}`,
                color: "bg-amber-50 text-amber-600 hover:bg-amber-100",
                icon: "📚",
              },
              {
                label: "Exams",
                href: "/",
                color: "bg-rose-50 text-rose-600 hover:bg-rose-100",
                icon: "📝",
              },
              {
                label: "Assignments",
                href: "/",
                color: "bg-emerald-50 text-emerald-600 hover:bg-emerald-100",
                icon: "✏️",
              },
              {
                label: "Results",
                href: "/",
                color: "bg-sky-50 text-sky-600 hover:bg-sky-100",
                icon: "📊",
              },
            ].map(({ label, href, color, icon }) => (
              <Link
                key={label}
                href={href}
                className={`flex items-center gap-2.5 px-3 py-3 rounded-xl text-xs font-bold transition-all hover:translate-x-1 ${color}`}
              >
                <span className="text-base leading-none">{icon}</span>
                {label}
              </Link>
            ))}
          </div>
        </motion.div>

        <Performance
          currentSemesterValue={9.2}
          previousSemesterValue={8.8}
          trendLabel="4%"
          rankingLabel="Top 15% of Staff"
          chartColor="#6366f1" // Indigo
        />
        <Announcements />
      </motion.div>
    </motion.div>
  );
};

export default SingleTeacherPage;
