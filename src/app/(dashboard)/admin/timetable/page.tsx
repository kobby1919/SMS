// src/app/(dashboard)/admin/timetable/page.tsx

import { requirePageSession } from "@/src/lib/authz";
import TimetableBuilder from "@/src/components/TimetableBuilder";
import type { TBClass, TBTeacher, TBLesson, TBPeriodTemplate } from "@/src/components/TimetableBuilder";
import TimetableHealthPanel from "@/src/components/TimetableHealthPanel";
import { Calendar } from "lucide-react";
import Link from "next/link";
import prisma from "@/src/lib/prisma";
import AdminPublishedSchedule from "@/src/components/AdminPublishedSchedule";
import {
  getCachedPeriodTemplates,
  getCachedTimetableTeachers,
} from "@/src/lib/referenceData";
import { getSchoolOperatingWindowStatus } from "@/src/lib/services/school-operating-hours";
import { getTimetableHealthSummary } from "@/src/lib/services/timetable-health";
import { getActiveTimetablePublication, listTimetableLessons } from "@/src/lib/services/timetable";

const TimetablePage = async ({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) => {
  const { schoolId } = await requirePageSession(["admin"]);
  const params = await searchParams;
  const published = params.view === "published";
  const navigation = <nav aria-label="Timetable views" className="flex flex-wrap gap-4 border-b border-gray-200 bg-white px-4 sm:px-6"><Link href="/admin/timetable" aria-current={!published ? "page" : undefined} className={`inline-flex min-h-12 items-center border-b-2 text-sm font-semibold ${!published ? "border-blue-800 text-blue-800" : "border-transparent text-gray-600"}`}>Draft & checks</Link><Link href="/admin/timetable?view=published" aria-current={published ? "page" : undefined} className={`inline-flex min-h-12 items-center border-b-2 text-sm font-semibold ${published ? "border-blue-800 text-blue-800" : "border-transparent text-gray-600"}`}>Published schedule</Link></nav>;
  if (published) return <main className="m-3 mt-0 min-w-0 flex-1 sm:m-4 sm:mt-0"><header className="bg-white p-4 sm:p-6"><h1 className="text-xl font-bold text-gray-900">Timetable</h1></header>{navigation}<AdminPublishedSchedule params={params} /></main>;

  const [classes, teachers, lessons, periodTemplates, operatingRules, timetableHealth, activePublication] = await Promise.all([
    prisma.class.findMany({
      where: { schoolId },
      select: { id: true, name: true, grade: { select: { level: true, order: true } } },
      orderBy: [{ grade: { order: "asc" } }, { name: "asc" }],
    }),
    getCachedTimetableTeachers(schoolId),
    listTimetableLessons(schoolId),
    getCachedPeriodTemplates(schoolId),
    getSchoolOperatingWindowStatus(schoolId),
    getTimetableHealthSummary(schoolId),
    getActiveTimetablePublication(schoolId),
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
    periodTemplate: l.periodTemplate,
  }));

  const serializedClasses: TBClass[] = classes.map((c) => ({
    id:    c.id,
    name:  c.name,
    grade: { level: c.grade.level, order: c.grade.order },
  }));

  const serializedPeriodTemplates: TBPeriodTemplate[] = periodTemplates.map((period) => ({
    id: period.id,
    name: period.name,
    type: period.type,
    startTime: period.startTime,
    endTime: period.endTime,
    order: period.order,
    isActive: period.isActive,
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
    <div className="min-w-0 flex-1 m-3 mt-0 flex flex-col gap-4 sm:m-4 sm:mt-0">
      <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 bg-indigo-50 rounded-2xl flex items-center justify-center shrink-0">
              <Calendar size={20} className="text-indigo-600" />
            </div>
            <div>
              <h1 className="text-xl font-black text-gray-800 tracking-tight">Timetable</h1>
              <p className="text-sm text-gray-400 mt-0.5 font-medium">
                Draft · {classes.length} classes · {lessons.length} lesson slots
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="bg-indigo-50 text-indigo-600 text-xs font-bold px-4 py-2 rounded-xl border border-indigo-100">
              {operatingRules.openingTime}-{operatingRules.closingTime}
            </div>
            <div className="bg-emerald-50 text-emerald-600 text-xs font-bold px-4 py-2 rounded-xl border border-emerald-100">
              {totalSubjects} Subjects
            </div>
          </div>
        </div>
      </div>

      {navigation}
      <TimetableHealthPanel health={timetableHealth} />

      <TimetableBuilder
        classes={serializedClasses}
        subjects={[]} // ✅ no longer needed globally — each teacher carries their own
        teachers={serializedTeachers}
        initialLessons={serializedLessons}
        initialPeriodTemplates={serializedPeriodTemplates}
        initialPublication={activePublication ? {
          ...activePublication,
          publishedAt: activePublication.publishedAt.toISOString(),
        } : null}
        timetableHealth={{
          status: timetableHealth.status,
          criticalCount: timetableHealth.criticalCount,
          warningCount: timetableHealth.warningCount,
        }}
        operatingRules={{
          activeDays: operatingRules.activeDays,
          openingTime: operatingRules.openingTime,
          closingTime: operatingRules.closingTime,
          timezone: operatingRules.timezone,
          label: operatingRules.label,
        }}
      />
    </div>
  );
};

export default TimetablePage;
