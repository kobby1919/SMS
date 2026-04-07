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

const SingleStudentPage = () => {
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
          {/* Top banner */}
          <div className="h-24 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-600 relative">
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
            {/* Avatar + name row */}
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 -mt-10 sm:-mt-12 mb-4">
              <div className="flex flex-col sm:flex-row items-center sm:items-end gap-4">
                <div className="relative shrink-0">
                  <Image
                    src="https://images.pexels.com/photos/5414817/pexels-photo-5414817.jpeg?auto=compress&cs=tinysrgb&w=1200"
                    alt="Vicky"
                    width={96}
                    height={96}
                    className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl object-cover ring-4 ring-white shadow-md bg-white"
                  />
                  <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-400 rounded-full border-2 border-white" />
                </div>
                <div className="mb-1 text-center sm:text-left">
                  <h1 className="text-xl font-black text-gray-800 tracking-tight">
                    Miss Vicky
                  </h1>
                  <p className="text-sm text-emerald-600 font-semibold">
                    Grade 11-B Student
                  </p>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex justify-center sm:justify-start gap-2 shrink-0">
                <button className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition-all active:scale-95 shadow-sm">
                  Download Report
                </button>
                <button className="px-4 py-2 rounded-xl bg-gray-100 text-gray-600 text-xs font-bold hover:bg-gray-200 transition-all active:scale-95">
                  Message Parents
                </button>
              </div>
            </div>

            {/* Student Bio */}
            <p className="text-sm text-gray-500 leading-relaxed mb-5 max-w-xl text-center sm:text-left mx-auto sm:mx-0">
              An enthusiastic and dedicated student with a strong interest in
              science and technology. Currently maintaining a high GPA while
              participating in the school's robotics club.
            </p>

            {/* Info pills */}
            <div className="flex flex-wrap justify-center sm:justify-start gap-2.5">
              {[
                { icon: <Droplets size={13} />, label: "O+" },
                { icon: <Calendar size={13} />, label: "Enrollment: 2024" },
                { icon: <Mail size={13} />, label: "chris.jay@school.com" },
                { icon: <Phone size={13} />, label: "+1 987 654" },
              ].map(({ icon, label }) => (
                <div
                  key={label}
                  className="flex items-center gap-1.5 bg-gray-100 rounded-full px-3 py-1.5 text-xs font-medium text-gray-600"
                >
                  <span className="text-emerald-500">{icon}</span>
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
              value: "96%",
              label: "Attendance",
              color: "bg-emerald-50 text-emerald-600",
            },
            {
              icon: <BookOpen size={16} />,
              value: "12",
              label: "Courses",
              color: "bg-blue-50 text-blue-600",
            },
            {
              icon: <Users size={16} />,
              value: "6th",
              label: "Class Rank",
              color: "bg-purple-50 text-purple-600",
            },
            {
              icon: <Award size={16} />,
              value: "4.8",
              label: "GPA",
              color: "bg-amber-50 text-amber-600",
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
                Student Timetable
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Current class schedule
              </p>
            </div>
            <span className="text-xs font-semibold bg-emerald-50 text-emerald-600 px-3 py-1.5 rounded-full">
              Term 2
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
        {/* Shortcuts */}
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
              {
                label: "Lessons",
                href: "/",
                color: "bg-amber-50 text-amber-600 hover:bg-amber-100",
                icon: "📚",
              },
              {
                label: "Teachers",
                href: "/",
                color: "bg-indigo-50 text-indigo-600 hover:bg-indigo-100",
                icon: "👨‍🏫",
              },
              {
                label: "Resources",
                href: "/",
                color: "bg-violet-50 text-violet-600 hover:bg-violet-100",
                icon: "📂",
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

        {/* Reusing common components */}
        <Performance />
        <Announcements />
      </motion.div>
    </motion.div>
  );
};

export default SingleStudentPage;
