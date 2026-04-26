// src/app/(dashboard)/teacher/page.tsx

import prisma from "@/src/lib/prisma";
import { currentUser } from "@clerk/nextjs/server";
import Announcements from "@/src/components/Announcements";
import EventCalendar from "@/src/components/EventCalendar";
import EventList from "@/src/components/EventList";
import BigCalendar from "@/src/components/BigCalendar";
import WelcomeBanner from "@/src/components/WelcomeBanner";
import type { CalendarLesson } from "@/src/components/BigCalendar";

const TeacherPage = async ({
  searchParams,
}: {
  searchParams: { [key: string]: string | undefined };
}) => {
  const user = await currentUser();

  const teacher = await prisma.teacher.findUnique({
    where: { id: user!.id },
    include: { classes: { select: { id: true, name: true } } },
  });

  const lessons = await prisma.lesson.findMany({
    where:   { teacherId: user!.id },
    include: {
      subject: { select: { name: true } },
      class:   { select: { name: true } },
    },
    orderBy: [{ day: "asc" }, { startTime: "asc" }],
  });

  const taughtClasses = Array.from(
    new Map(lessons.map((l) => [l.class.name, l.class.name])).values()
  );

  const calendarLessons: CalendarLesson[] = lessons.map((l) => ({
    title:     l.subject.name,
    day:       l.day,
    startTime: l.startTime,
    endTime:   l.endTime,
    className: l.class.name,
  }));

  const teacherFirstName = teacher?.name ?? user?.firstName ?? "Teacher";
  const teacherFullName  = teacher ? `${teacher.name} ${teacher.surname}` : teacherFirstName;

  return (
    <div className="p-4 flex gap-4 flex-col xl:flex-row">

      <div className="w-full xl:w-2/3 flex flex-col gap-4">

        {/* ── WELCOME BANNER ── */}
        <WelcomeBanner
          role="teacher"
          name={teacherFirstName}
          subtitle={`Teaching ${taughtClasses.length} class${taughtClasses.length !== 1 ? "es" : ""} · ${lessons.length} total periods`}
          tag="Term 2 · 2025/26"
        />

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
              <span className="text-lg">📋</span>
            </div>
            <div>
              <p className="text-xl font-black text-gray-800 leading-none">{lessons.length}</p>
              <p className="text-xs text-gray-400 font-medium mt-0.5">Total Periods</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
              <span className="text-lg">🏫</span>
            </div>
            <div>
              <p className="text-xl font-black text-gray-800 leading-none">{taughtClasses.length}</p>
              <p className="text-xs text-gray-400 font-medium mt-0.5">
                Classes{" "}
                <span className={taughtClasses.length >= 5 ? "text-rose-500" : "text-gray-400"}>
                  ({taughtClasses.length}/5)
                </span>
              </p>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm col-span-2 sm:col-span-1">
            <p className="text-xs text-gray-400 font-medium mb-2">Teaching</p>
            <div className="flex flex-wrap gap-1.5">
              {taughtClasses.length > 0
                ? taughtClasses.map((name) => (
                    <span key={name} className="text-[11px] font-bold px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-lg">{name}</span>
                  ))
                : <span className="text-xs text-gray-300">No classes assigned</span>}
            </div>
          </div>
        </div>

        {/* Timetable */}
        <div className="bg-white p-5 rounded-2xl shadow-sm">
          <div className="mb-4">
            <h1 className="text-xl font-nunito font-extrabold text-gray-800">My Schedule</h1>
            <p className="text-sm text-gray-400 mt-0.5">{teacherFullName} — all classes, weekly timetable</p>
          </div>
          <BigCalendar lessons={calendarLessons} viewAs="teacher" />
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

export default TeacherPage;