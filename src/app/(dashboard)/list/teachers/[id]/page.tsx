// src/app/(dashboard)/list/teachers/[id]/page.tsx

import prisma from "@/src/lib/prisma";
import { notFound } from "next/navigation";
import { requirePageSession } from "@/src/lib/authz";
import Announcements from "@/src/components/Announcements";
import BigCalendar from "@/src/components/BigCalendar";
import Performance from "@/src/components/Performance";
import Image from "next/image";
import Link from "next/link";
import type { CalendarLesson } from "@/src/components/BigCalendar";
import {
  Mail, Phone, Droplets, Calendar,
  BookOpen, Users, Clock, Award,
} from "lucide-react";

const SingleTeacherPage = async ({
  params,
}: {
  params: Promise<{ id: string }>;
}) => {
  const { id } = await params;
  const { role, schoolId } = await requirePageSession();

  // Fetch teacher with all relations
  const teacher = await prisma.teacher.findFirst({
    where: { id, schoolId },
    include: {
      subjects: { select: { id: true, name: true } },
      lessons: {
        include: {
          subject: { select: { name: true } },
          class:   { select: { id: true, name: true } },
        },
        orderBy: [{ day: "asc" }, { startTime: "asc" }],
      },
      classes: { select: { id: true, name: true } }, // supervised classes
    },
  });

  if (!teacher) notFound();

  // ── Unique classes taught (from lessons) ─────────────────────────────────
  const taughtClasses = Array.from(
    new Map(teacher.lessons.map((l) => [l.class.id, l.class])).values()
  );

  // ── Calendar lessons ─────────────────────────────────────────────────────
  const calendarLessons: CalendarLesson[] = teacher.lessons.map((l) => ({
    title:     l.subject.name,
    day:       l.day,
    startTime: l.startTime,
    endTime:   l.endTime,
    className: l.class.name,
  }));

  // ── Stats ─────────────────────────────────────────────────────────────────
  const joinYear = new Date(teacher.createdAt).getFullYear();

  // Attendance across all their lessons' attendance records
  const [totalAttendance, presentAttendance] = await Promise.all([
    prisma.attendance.count({ where: { schoolId, lesson: { teacherId: teacher.id } } }),
    prisma.attendance.count({ where: { schoolId, lesson: { teacherId: teacher.id }, present: true } }),
  ]);
  const attendancePct = totalAttendance > 0
    ? Math.round((presentAttendance / totalAttendance) * 100)
    : 0;

  return (
    <div className="flex-1 p-4 flex flex-col gap-4 xl:flex-row">

      {/* ── LEFT ── */}
      <div className="w-full xl:w-2/3 flex flex-col gap-4">

        {/* ── Hero card ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="h-24 bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-600 relative">
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
                    src={teacher.img || "/noAvatar.png"}
                    alt={teacher.name}
                    width={96} height={96}
                    className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl object-cover ring-4 ring-white shadow-md bg-white"
                  />
                  <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-400 rounded-full border-2 border-white" />
                </div>
                <div className="mb-1 text-center sm:text-left">
                  <h1 className="text-xl font-black text-gray-800 tracking-tight">
                    {teacher.name} {teacher.surname}
                  </h1>
                  <p className="text-sm text-indigo-600 font-semibold">
                    {teacher.subjects.map((s) => s.name).join(", ") || "No subjects assigned"}
                  </p>
                </div>
              </div>

              {role === "admin" && (
                <div className="flex justify-center sm:justify-start gap-2 shrink-0">
                  <button className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition-all active:scale-95 shadow-sm">
                    Edit Profile
                  </button>
                </div>
              )}
            </div>

            {/* Info pills */}
            <div className="flex flex-wrap justify-center sm:justify-start gap-2.5">
              {[
                { icon: <Droplets size={13} />, label: teacher.bloodType },
                { icon: <Calendar size={13} />,  label: `Joined ${joinYear}` },
                ...(teacher.email ? [{ icon: <Mail size={13} />, label: teacher.email }] : []),
                ...(teacher.phone ? [{ icon: <Phone size={13} />, label: teacher.phone }] : []),
              ].map(({ icon, label }) => (
                <div key={label} className="flex items-center gap-1.5 bg-gray-100 rounded-full px-3 py-1.5 text-xs font-medium text-gray-600">
                  <span className="text-indigo-500">{icon}</span>
                  {label}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Stats ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { icon: <Clock size={16} />,    value: `${attendancePct}%`,    label: "Class Attendance", color: "bg-indigo-50 text-indigo-600"   },
            { icon: <BookOpen size={16} />, value: teacher.lessons.length, label: "Total Lessons",    color: "bg-amber-50 text-amber-600"    },
            { icon: <Users size={16} />,    value: taughtClasses.length,   label: "Classes",          color: "bg-emerald-50 text-emerald-600" },
            { icon: <Award size={16} />,    value: teacher.subjects.length, label: "Subjects",        color: "bg-violet-50 text-violet-600"  },
          ].map((stat) => (
            <div key={stat.label} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${stat.color}`}>
                {stat.icon}
              </div>
              <div>
                <p className="text-xl font-black text-gray-800 leading-none">{stat.value}</p>
                <p className="text-xs text-gray-400 font-medium mt-0.5">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── Class pills ── */}
        {taughtClasses.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <p className="text-xs font-black uppercase tracking-widest text-gray-400 mb-3">Teaching</p>
            <div className="flex flex-wrap gap-2">
              {taughtClasses.map((c) => (
                <span key={c.id} className="text-xs font-bold px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-xl">
                  {c.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ── Timetable ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex-1 min-h-[400px]">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-4">
            <div>
              <h2 className="text-base font-black text-gray-800">Teaching Schedule</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                {teacher.name} — all classes, weekly timetable
              </p>
            </div>
            <span className="text-xs font-semibold bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-full">
              This Week
            </span>
          </div>
          <BigCalendar lessons={calendarLessons} viewAs="teacher" />
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
              { label: "Classes",     href: `/list/classes?supervisorId=${teacher.id}`,   color: "bg-indigo-50 text-indigo-600 hover:bg-indigo-100",   icon: "🏫" },
              { label: "Students",    href: `/list/students?teacherId=${teacher.id}`,      color: "bg-violet-50 text-violet-600 hover:bg-violet-100",   icon: "👨‍🎓" },
              { label: "Lessons",     href: `/list/lessons?teacherId=${teacher.id}`,       color: "bg-amber-50 text-amber-600 hover:bg-amber-100",      icon: "📚" },
              { label: "Exams",       href: `/list/exams?teacherId=${teacher.id}`,         color: "bg-rose-50 text-rose-600 hover:bg-rose-100",         icon: "📝" },
              { label: "Assignments", href: `/list/assignments?teacherId=${teacher.id}`,   color: "bg-emerald-50 text-emerald-600 hover:bg-emerald-100", icon: "✏️" },
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

        <Performance
          currentSemesterValue={attendancePct}
          previousSemesterValue={0}
          trendLabel="Attendance Rate"
          rankingLabel={`${taughtClasses.length} classes · ${teacher.lessons.length} lessons`}
          chartColor="#6366f1"
        />
        <Announcements />
      </div>
    </div>
  );
};

export default SingleTeacherPage;
