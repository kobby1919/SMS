// src/app/(dashboard)/list/students/[id]/page.tsx

import prisma from "@/src/lib/prisma";
import { notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import Announcements from "@/src/components/Announcements";
import BigCalendar from "@/src/components/BigCalendar";
import Performance from "@/src/components/Performance";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import type { CalendarLesson } from "@/src/components/BigCalendar";
import {
  Mail, Phone, Droplets, Calendar,
  BookOpen, Users, Clock, Award,
} from "lucide-react";

const SingleStudentPage = async ({
  params,
}: {
  params: Promise<{ id: string }>;
}) => {
  const {id} = await params
  const { sessionClaims } = await auth();
  const role = (sessionClaims?.metadata as { role?: string })?.role;

  // Fetch student with all relations
  const student = await prisma.student.findUnique({
    where: { id:  id},
    include: {
      class: {
        include: {
          grade:    { select: { level: true } },
          lessons: {
            include: {
              subject: { select: { name: true } },
              teacher: { select: { name: true, surname: true } },
            },
            orderBy: [{ day: "asc" }, { startTime: "asc" }],
          },
        },
      },
      parent:  { select: { name: true, surname: true, phone: true, email: true } },
      results: { include: { exam: true, assignment: true } },
      attendances: true,
    },
  });

  if (!student) notFound();

  // ── Calendar lessons ────────────────────────────────────────────────────────
  const calendarLessons: CalendarLesson[] = student.class.lessons.map((l) => ({
    title:     l.subject.name,
    day:       l.day,
    startTime: l.startTime,
    endTime:   l.endTime,
    teacher:   `${l.teacher.name} ${l.teacher.surname}`,
  }));

  // ── Real stats ──────────────────────────────────────────────────────────────
  const totalAttendance  = student.attendances.length;
  const presentCount     = student.attendances.filter((a) => a.present).length;
  const attendancePct    = totalAttendance > 0
    ? Math.round((presentCount / totalAttendance) * 100)
    : 0;

  const lessonCount = student.class.lessons.length / 5; // unique per day average
  const uniqueLessonsPerWeek = new Set(
    student.class.lessons.map((l) => l.subject.name)
  ).size;

  // Average score across all results
  const scores = student.results
    .map((r) => r.score)
    .filter((s) => s !== null) as number[];
  const avgScore = scores.length > 0
    ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1)
    : "N/A";

  // Enrolment year
  const enrolYear = new Date(student.createdAt).getFullYear();

  return (
    <div className="flex-1 p-4 flex flex-col gap-4 xl:flex-row">

      {/* ── LEFT ── */}
      <div className="w-full xl:w-2/3 flex flex-col gap-4">

        {/* ── Hero card ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {/* Banner */}
          <div className="h-24 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-600 relative">
            <div className="absolute inset-0 opacity-20"
              style={{
                backgroundImage: "radial-gradient(circle at 20% 50%, white 1px, transparent 1px)",
                backgroundSize: "40px 40px",
              }}
            />
          </div>

          <div className="px-5 pb-5">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 -mt-10 sm:-mt-12 mb-4">
              <div className="flex flex-col sm:flex-row items-center sm:items-end gap-4">
                <div className="relative shrink-0">
                  <Image
                    src={student.img || "/noAvatar.png"}
                    alt={student.name}
                    width={96} height={96}
                    className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl object-cover ring-4 ring-white shadow-md bg-white"
                  />
                  <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-400 rounded-full border-2 border-white" />
                </div>
                <div className="mb-1 text-center sm:text-left">
                  <h1 className="text-xl font-black text-gray-800 tracking-tight">
                    {student.name} {student.surname}
                  </h1>
                  <p className="text-sm text-emerald-600 font-semibold">
                    {student.class.grade.level} · {student.class.name}
                  </p>
                </div>
              </div>

              <div className="flex justify-center sm:justify-start gap-2 shrink-0">
                {(role === "admin" || role === "teacher") && (
                  <button className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition-all active:scale-95 shadow-sm">
                    Download Report
                  </button>
                )}
                {student.parent && (
                  <button className="px-4 py-2 rounded-xl bg-gray-100 text-gray-600 text-xs font-bold hover:bg-gray-200 transition-all active:scale-95">
                    Contact: {student.parent.name}
                  </button>
                )}
              </div>
            </div>

            {/* Info pills */}
            <div className="flex flex-wrap justify-center sm:justify-start gap-2.5">
              {[
                { icon: <Droplets size={13} />, label: student.bloodType },
                { icon: <Calendar size={13} />,  label: `Enrolled: ${enrolYear}` },
                ...(student.email ? [{ icon: <Mail size={13} />, label: student.email }] : []),
                ...(student.phone ? [{ icon: <Phone size={13} />, label: student.phone }] : []),
              ].map(({ icon, label }) => (
                <div key={label} className="flex items-center gap-1.5 bg-gray-100 rounded-full px-3 py-1.5 text-xs font-medium text-gray-600">
                  <span className="text-emerald-500">{icon}</span>
                  {label}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Stats ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { icon: <Clock size={16} />,    value: `${attendancePct}%`,        label: "Attendance",    color: "bg-emerald-50 text-emerald-600" },
            { icon: <BookOpen size={16} />, value: uniqueLessonsPerWeek,        label: "Subjects",      color: "bg-blue-50 text-blue-600"       },
            { icon: <Users size={16} />,    value: student.class.name,          label: "Class",         color: "bg-purple-50 text-purple-600"   },
            { icon: <Award size={16} />,    value: `${avgScore}`,               label: "Avg Score",     color: "bg-amber-50 text-amber-600"     },
          ].map((stat) => (
            <div key={stat.label} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${stat.color}`}>
                {stat.icon}
              </div>
              <div>
                <p className="text-xl font-black text-gray-800 leading-none truncate">{stat.value}</p>
                <p className="text-xs text-gray-400 font-medium mt-0.5">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── Timetable ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex-1 min-h-[400px]">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-4">
            <div>
              <h2 className="text-base font-black text-gray-800">Student Timetable</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                {student.class.name} — weekly schedule
              </p>
            </div>
            <span className="text-xs font-semibold bg-emerald-50 text-emerald-600 px-3 py-1.5 rounded-full">
              Term 2
            </span>
          </div>
          <BigCalendar lessons={calendarLessons} viewAs="student" />
        </div>
      </div>

      {/* ── RIGHT ── */}
      <div className="w-full xl:w-1/3 flex flex-col gap-4">

        {/* Quick access — real IDs */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-black text-gray-800">Quick Access</h2>
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Shortcuts</span>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            {[
              { label: "Exams",       href: `/list/exams?classId=${student.classId}`,          color: "bg-rose-50 text-rose-600 hover:bg-rose-100",       icon: "📝" },
              { label: "Assignments", href: `/list/assignments?classId=${student.classId}`,    color: "bg-emerald-50 text-emerald-600 hover:bg-emerald-100", icon: "✏️" },
              { label: "Results",     href: `/list/results?studentId=${student.id}`,           color: "bg-sky-50 text-sky-600 hover:bg-sky-100",           icon: "📊" },
              { label: "Lessons",     href: `/list/lessons?classId=${student.classId}`,        color: "bg-amber-50 text-amber-600 hover:bg-amber-100",     icon: "📚" },
              { label: "Teachers",    href: `/list/teachers?classId=${student.classId}`,       color: "bg-indigo-50 text-indigo-600 hover:bg-indigo-100",  icon: "👨‍🏫" },
            ].map(({ label, href, color, icon }) => (
              <Link key={label} href={href}
                className={`flex items-center gap-2.5 px-3 py-3 rounded-xl text-xs font-bold transition-all hover:translate-x-1 ${color}`}
              >
                <span className="text-base leading-none">{icon}</span>
                {label}
              </Link>
            ))}
          </div>
        </div>

        {/* Parent info card */}
        {student.parent && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h2 className="text-base font-black text-gray-800 mb-3">Parent / Guardian</h2>
            <div className="flex flex-col gap-2">
              <p className="text-sm font-bold text-gray-700">
                {student.parent.name} {student.parent.surname}
              </p>
              {student.parent.email && (
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <Mail size={12} className="text-gray-400" />
                  {student.parent.email}
                </div>
              )}
              {student.parent.phone && (
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <Phone size={12} className="text-gray-400" />
                  {student.parent.phone}
                </div>
              )}
            </div>
          </div>
        )}

        <Performance
          title="Academic Standing"
          currentSemesterValue={scores.length > 0 ? parseFloat(avgScore as string) : 0}
          previousSemesterValue={0}
          trendLabel="This Term"
          rankingLabel={`${student.class.name} · ${student.class.grade.level}`}
          chartColor="#10b981"
        />
        <Announcements />
      </div>
    </div>
  );
};

export default SingleStudentPage;
