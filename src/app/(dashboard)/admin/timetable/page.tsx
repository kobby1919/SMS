// src/app/(dashboard)/admin/timetable/page.tsx

import { requirePageSession } from "@/src/lib/authz";
import TimetableBuilder from "@/src/components/TimetableBuilder";
import type { TBClass, TBTeacher, TBLesson, TBPeriodTemplate } from "@/src/components/TimetableBuilder";
import TimetableHealthPanel from "@/src/components/TimetableHealthPanel";
import { Calendar } from "lucide-react";
import {
  getCachedClasses,
  getCachedPeriodTemplates,
  getCachedTimetableLessons,
  getCachedTimetableTeachers,
} from "@/src/lib/referenceData";
import { getSchoolOperatingWindowStatus } from "@/src/lib/services/school-operating-hours";
import { getTimetableHealthSummary } from "@/src/lib/services/timetable-health";

const TimetablePage = async () => {
  const { schoolId } = await requirePageSession(["admin"]);

  const [classes, teachers, lessons, periodTemplates, operatingRules, timetableHealth] = await Promise.all([
    getCachedClasses(schoolId),
    getCachedTimetableTeachers(schoolId),
    getCachedTimetableLessons(schoolId),
    getCachedPeriodTemplates(schoolId),
    getSchoolOperatingWindowStatus(schoolId),
    getTimetableHealthSummary(schoolId),
  ]);

  const serializedLessons: TBLesson[] = lessons.map((l) => ({
    id:        l.id,
    name:      l.name,
    day:       l.day,
    startTime: l.startTime,
    endTime:   l.endTime,
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
              {operatingRules.openingTime}-{operatingRules.closingTime}
            </div>
            <div className="bg-emerald-50 text-emerald-600 text-xs font-bold px-4 py-2 rounded-xl border border-emerald-100">
              {totalSubjects} Subjects
            </div>
          </div>
        </div>
      </div>

      <TimetableHealthPanel health={timetableHealth} />

      <TimetableBuilder
        classes={serializedClasses}
        subjects={[]} // ✅ no longer needed globally — each teacher carries their own
        teachers={serializedTeachers}
        initialLessons={serializedLessons}
        initialPeriodTemplates={serializedPeriodTemplates}
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
