// src/app/(dashboard)/student/page.tsx

import prisma from "@/src/lib/prisma";
import { currentUser } from "@clerk/nextjs/server";
import Announcements from "@/src/components/Announcements";
import EventCalendar from "@/src/components/EventCalendar";
import EventList from "@/src/components/EventList";
import BigCalendar from "@/src/components/BigCalendar";
import WelcomeBanner from "@/src/components/WelcomeBanner";
import type { CalendarLesson } from "@/src/components/BigCalendar";
import Link from "next/link";
import { CheckCircle2, XCircle, Clock, FileCheck, TrendingUp } from "lucide-react";

const StudentPage = async ({
  searchParams,
}: {
  searchParams: { [key: string]: string | undefined };
}) => {
  const user = await currentUser();

  const student = await prisma.student.findUnique({
    where: { id: user!.id },
    select: { id: true, name: true, surname: true, classId: true, class: { select: { name: true } } },
  });

  const lessons = await prisma.lesson.findMany({
    where:   { classId: student?.classId },
    include: {
      subject: { select: { name: true } },
      teacher: { select: { name: true, surname: true } },
    },
    orderBy: [{ day: "asc" }, { startTime: "asc" }],
  });

  const calendarLessons: CalendarLesson[] = lessons.map((l) => ({
    title:     l.subject.name,
    day:       l.day,
    startTime: l.startTime,
    endTime:   l.endTime,
    teacher:   `${l.teacher.name} ${l.teacher.surname}`,
  }));

  const [totalA, presentA, absentA, lateA, excusedA] = await Promise.all([
    prisma.attendance.count({ where: { studentId: user!.id } }),
    prisma.attendance.count({ where: { studentId: user!.id, status: "PRESENT" } }),
    prisma.attendance.count({ where: { studentId: user!.id, status: "ABSENT"  } }),
    prisma.attendance.count({ where: { studentId: user!.id, status: "LATE"    } }),
    prisma.attendance.count({ where: { studentId: user!.id, status: "EXCUSED" } }),
  ]);
  const attendanceRate = totalA > 0 ? Math.round((presentA / totalA) * 100) : 0;

  const recentAttendance = await prisma.attendance.findMany({
    where:   { studentId: user!.id },
    orderBy: { date: "desc" },
    take:    7,
    select:  { status: true, date: true, lesson: { select: { subject: { select: { name: true } } } } },
  });

  const studentName = student?.name ?? user?.firstName ?? "Student";

  return (
    <div className="p-4 flex gap-4 flex-col xl:flex-row">

      <div className="w-full xl:w-2/3 flex flex-col gap-4">

        {/* ── WELCOME BANNER ── */}
        <WelcomeBanner
          role="student"
          name={studentName}
          subtitle={`Class ${student?.class?.name ?? ""} · ${attendanceRate}% attendance rate`}
          tag="Term 2 · 2025/26"
        />

        {/* Attendance summary */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-black text-gray-800 text-base">My Attendance</h2>
              <p className="text-xs text-gray-400 mt-0.5">{totalA} total records</p>
            </div>
            <Link href="/list/attendance" className="text-xs font-bold text-emerald-600 hover:text-emerald-700 transition-colors">
              Full history →
            </Link>
          </div>

          <div className="grid grid-cols-4 gap-2 mb-4">
            {[
              { label: "Present", value: presentA, icon: <CheckCircle2 size={13} />, color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
              { label: "Absent",  value: absentA,  icon: <XCircle      size={13} />, color: "bg-rose-50 text-rose-700 border-rose-200"         },
              { label: "Late",    value: lateA,    icon: <Clock        size={13} />, color: "bg-amber-50 text-amber-700 border-amber-200"       },
              { label: "Excused", value: excusedA, icon: <FileCheck    size={13} />, color: "bg-indigo-50 text-indigo-700 border-indigo-200"    },
            ].map((s) => (
              <div key={s.label} className={`rounded-xl p-3 border ${s.color}`}>
                <div className="flex items-center gap-1 mb-1 opacity-60">{s.icon}<span className="text-[9px] font-black uppercase">{s.label}</span></div>
                <p className="text-xl font-black leading-none">{s.value}</p>
              </div>
            ))}
          </div>

          <div className="mb-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-400 font-semibold flex items-center gap-1.5">
                <TrendingUp size={12} /> Attendance Rate
              </span>
              <span className={`text-xs font-black ${attendanceRate >= 80 ? "text-emerald-600" : attendanceRate >= 60 ? "text-amber-600" : "text-rose-600"}`}>
                {attendanceRate}%
              </span>
            </div>
            <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${attendanceRate >= 80 ? "bg-emerald-500" : attendanceRate >= 60 ? "bg-amber-500" : "bg-rose-500"}`}
                style={{ width: `${attendanceRate}%` }}
              />
            </div>
            <p className="text-[10px] text-gray-400 mt-1">
              {attendanceRate >= 80 ? "✅ Great attendance!" : attendanceRate >= 60 ? "⚠️ Needs improvement" : "❌ Poor attendance"}
            </p>
          </div>

          {recentAttendance.length > 0 && (
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-gray-400 mb-2">Recent</p>
              <div className="flex flex-wrap gap-1.5">
                {recentAttendance.map((r, i) => {
                  const colors: Record<string, string> = {
                    PRESENT: "bg-emerald-100 text-emerald-700",
                    ABSENT:  "bg-rose-100 text-rose-700",
                    LATE:    "bg-amber-100 text-amber-700",
                    EXCUSED: "bg-indigo-100 text-indigo-700",
                  };
                  return (
                    <span key={i} className={`text-[10px] font-bold px-2 py-1 rounded-lg ${colors[r.status]}`}>
                      {r.lesson.subject.name} · {new Date(r.date).toLocaleDateString("en-GH", { day: "numeric", month: "short" })}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {totalA === 0 && (
            <p className="text-xs text-gray-400 text-center py-2">No attendance records yet.</p>
          )}
        </div>

        {/* Timetable */}
        <div className="bg-white p-5 rounded-2xl shadow-sm">
          <div className="mb-4">
            <h1 className="text-xl font-nunito font-extrabold text-gray-800">My Schedule</h1>
            <p className="text-sm text-gray-400 mt-0.5">Class {student?.class?.name ?? ""} — weekly timetable</p>
          </div>
          <BigCalendar lessons={calendarLessons} viewAs="student" />
        </div>
      </div>

      <div className="w-full xl:w-1/3 flex flex-col gap-4">
        <EventCalendar />
        <EventList dateParam={searchParams.date} />
        <Announcements />
      </div>
    </div>
  );
};

export default StudentPage;