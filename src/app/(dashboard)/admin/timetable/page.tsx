// src/app/(dashboard)/admin/timetable/page.tsx

import prisma from "@/src/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import TimetableBuilder from "@/src/components/TimetableBuilder";
import type { TBClass, TBSubject, TBTeacher, TBLesson } from "@/src/components/TimetableBuilder";
import { Calendar } from "lucide-react";

const TimetablePage = async () => {
  // Auth guard — admin only
  const { sessionClaims } = await auth();
  const role = (sessionClaims?.metadata as { role?: string })?.role;
  if (role !== "admin") redirect("/");

  // Fetch all data in parallel
  const [classes, subjects, teachers, lessons] = await Promise.all([
    // Classes sorted by grade order then name
    prisma.class.findMany({
      include: { grade: { select: { level: true, order: true } } },
      orderBy: [{ grade: { order: "asc" } }, { name: "asc" }],
    }),

    // All subjects
    prisma.subject.findMany({
      orderBy: { name: "asc" },
    }),

    // All teachers with class count info
    prisma.teacher.findMany({
      select: {
        id: true, name: true, surname: true, maxClasses: true,
      },
      orderBy: [{ name: "asc" }, { surname: "asc" }],
    }),

    // All lessons with relations
    prisma.lesson.findMany({
      include: {
        subject: { select: { id: true, name: true } },
        class:   { select: { id: true, name: true } },
        teacher: { select: { id: true, name: true, surname: true } },
      },
      orderBy: [{ day: "asc" }, { startTime: "asc" }],
    }),
  ]);

  // Serialize dates to strings for client component
  const serializedLessons: TBLesson[] = lessons.map((l) => ({
    id:        l.id,
    name:      l.name,
    day:       l.day,
    startTime: l.startTime.toISOString(),
    endTime:   l.endTime.toISOString(),
    subject:   l.subject,
    class:     l.class,
    teacher:   l.teacher,
  }));

  const serializedClasses: TBClass[] = classes.map((c) => ({
    id:      c.id,
    name:    c.name,
    grade:   { level: c.grade.level, order: c.grade.order },
  }));

  return (
    <div className="flex-1 m-4 mt-0 flex flex-col gap-5">

      {/* ── Page header ── */}
      <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 bg-indigo-50 rounded-2xl flex items-center justify-center shrink-0">
              <Calendar size={20} className="text-indigo-600" />
            </div>
            <div>
              <h1 className="text-xl font-black text-gray-800 tracking-tight">
                Timetable Builder
              </h1>
              <p className="text-sm text-gray-400 mt-0.5 font-medium">
                Master schedule — {classes.length} classes · {lessons.length} lesson slots
              </p>
            </div>
          </div>
          {/* Term badge */}
          <div className="flex items-center gap-2">
            <div className="bg-indigo-50 text-indigo-600 text-xs font-bold px-4 py-2 rounded-xl border border-indigo-100">
              Term 2 · 2025/26
            </div>
            <div className="bg-emerald-50 text-emerald-600 text-xs font-bold px-4 py-2 rounded-xl border border-emerald-100">
              {subjects.length} Subjects
            </div>
          </div>
        </div>
      </div>

      {/* ── Timetable Builder ── */}
      <TimetableBuilder
        classes={serializedClasses}
        subjects={subjects}
        teachers={teachers}
        initialLessons={serializedLessons}
      />
    </div>
  );
};

export default TimetablePage;
