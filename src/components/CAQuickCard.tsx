// src/components/CAQuickCard.tsx
// A quick-access card for the teacher dashboard showing CA progress
// for their supervised class. Drop this into teacher/page.tsx.

import prisma from "@/src/lib/prisma";
import Link from "next/link";
import { ClipboardList, ChevronRight, CheckCircle2, Clock } from "lucide-react";
import { getGradeBand } from "@/src/lib/caGrades";

type Props = {
  teacherId: string;
  schoolId: string;
};

const CAQuickCard = async ({ teacherId, schoolId }: Props) => {
  // Find supervised classes
  const classes = await prisma.class.findMany({
    where:   { schoolId, supervisorId: teacherId },
    include: {
      students: { select: { id: true } },
      grade:    { select: { level: true } },
    },
  });

  if (classes.length === 0) return null;

  // For each class, get CA progress (how many students have at least one CA record)
  const classStats = await Promise.all(
    classes.map(async (cls) => {
      const totalStudents = cls.students.length;

      const studentsWithCA = await prisma.continuousAssessment.groupBy({
        by:    ["studentId"],
        where: { schoolId, classId: cls.id },
      });

      const uniqueStudentsWithCA = studentsWithCA.length;
      const avgRecord = await prisma.continuousAssessment.aggregate({
        where:   { schoolId, classId: cls.id },
        _avg:    { totalScore: true },
      });

      const avg = avgRecord._avg.totalScore ?? 0;

      return {
        classId:   cls.id,
        className: cls.name,
        gradeLevel: cls.grade.level,
        totalStudents,
        uniqueStudentsWithCA,
        avg: Math.round(avg * 10) / 10,
        band: getGradeBand(avg),
      };
    })
  );

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-50 rounded-xl flex items-center justify-center">
            <ClipboardList size={15} className="text-indigo-600" />
          </div>
          <div>
            <p className="text-sm font-black text-gray-800">Continuous Assessment</p>
            <p className="text-[10px] text-gray-400 font-medium">Your supervised classes</p>
          </div>
        </div>
        <Link
          href="/list/ca"
          className="flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-700"
        >
          Manage <ChevronRight size={13} />
        </Link>
      </div>

      <div className="divide-y divide-gray-50">
        {classStats.map((cls) => {
          const pct = cls.totalStudents > 0
            ? Math.round((cls.uniqueStudentsWithCA / cls.totalStudents) * 100)
            : 0;
          const complete = pct === 100;

          return (
            <Link
              key={cls.classId}
              href={`/list/ca?classId=${cls.classId}`}
              className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 transition-colors"
            >
              {/* Class info */}
              <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center text-[11px] font-black text-indigo-600 shrink-0">
                {cls.className.slice(0, 2).toUpperCase()}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold text-gray-800">{cls.className}</p>
                  {complete && (
                    <CheckCircle2 size={12} className="text-emerald-500 shrink-0" />
                  )}
                  {!complete && (
                    <Clock size={12} className="text-amber-400 shrink-0" />
                  )}
                </div>
                <p className="text-[10px] text-gray-400 font-medium mt-0.5">
                  {cls.uniqueStudentsWithCA}/{cls.totalStudents} students entered
                </p>
                {/* Progress bar */}
                <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden mt-1.5">
                  <div
                    className={`h-full rounded-full transition-all ${complete ? "bg-emerald-400" : "bg-indigo-400"}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>

              {/* Average */}
              {cls.uniqueStudentsWithCA > 0 && (
                <div className={`flex flex-col items-center px-2.5 py-1.5 rounded-xl border shrink-0 ${cls.band.bg} ${cls.band.border}`}>
                  <span className={`text-xs font-black ${cls.band.color}`}>{cls.band.grade}</span>
                  <span className={`text-[9px] font-semibold ${cls.band.color} opacity-70`}>{cls.avg}%</span>
                </div>
              )}

              <ChevronRight size={14} className="text-gray-300 shrink-0" />
            </Link>
          );
        })}
      </div>
    </div>
  );
};

export default CAQuickCard;
