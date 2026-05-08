// src/app/(dashboard)/admin/timetable/page.tsx

import prisma from "@/src/lib/prisma";
import { requirePageSession } from "@/src/lib/authz";
import { redirect } from "next/navigation";
import TimetableBuilder from "@/src/components/TimetableBuilder";
import type { TBClass, TBTeacher, TBLesson } from "@/src/components/TimetableBuilder";
import { Calendar } from "lucide-react";

const TimetablePage = async () => {
  const { schoolId } = await requirePageSession(["admin"]);

  const [classes, teachers, lessons] = await Promise.all([
    prisma.class.findMany({
      where: { schoolId },
      include: { grade: { select: { level: true, order: true } } },
      orderBy: [{ grade: { order: "asc" } }, { name: "asc" }],
    }),

    prisma.teacher.findMany({
      where: { schoolId },
      select: {
        id: true, name: true, surname: true, maxClasses: true,
        subjects: { select: { id: true, name: true } },
      },
      orderBy: [{ name: "asc" }, { surname: "asc" }],
    }),

    prisma.lesson.findMany({
      where: { schoolId },
      include: {
        subject: { select: { id: true, name: true } },
        class:   { select: { id: true, name: true } },
        teacher: { select: { id: true, name: true, surname: true } },
      },
      orderBy: [{ day: "asc" }, { startTime: "asc" }],
    }),
  ]);

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
    id:    c.id,
    name:  c.name,
    grade: { level: c.grade.level, order: c.grade.order },
  }));

  const serializedTeachers: TBTeacher[] = teachers.map((t) => ({
    id:         t.id,
    name:       t.name,
    surname:    t.surname,
    maxClasses: t.maxClasses,
    subjects:   t.subjects, // ✅ now passed through
  }));

  const totalSubjects = new Set(lessons.map((l) => l.subject.id)).size;

  return (
    <div className="flex-1 m-4 mt-0 flex flex-col gap-5">
      <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 bg-indigo-50 rounded-2xl flex items-center justify-center shrink-0">
              <Calendar size={20} className="text-indigo-600" />
            </div>
            <div>
              <h1 className="text-xl font-black text-gray-800 tracking-tight">Timetable Builder</h1>
              <p className="text-sm text-gray-400 mt-0.5 font-medium">
                Master schedule — {classes.length} classes · {lessons.length} lesson slots
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="bg-indigo-50 text-indigo-600 text-xs font-bold px-4 py-2 rounded-xl border border-indigo-100">
              Term 2 · 2025/26
            </div>
            <div className="bg-emerald-50 text-emerald-600 text-xs font-bold px-4 py-2 rounded-xl border border-emerald-100">
              {totalSubjects} Subjects
            </div>
          </div>
        </div>
      </div>

      <TimetableBuilder
        classes={serializedClasses}
        subjects={[]} // ✅ no longer needed globally — each teacher carries their own
        teachers={serializedTeachers}
        initialLessons={serializedLessons}
      />
    </div>
  );
};

export default TimetablePage;
