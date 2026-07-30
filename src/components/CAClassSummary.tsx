"use client";

// src/components/CAClassSummary.tsx
// Shows a pivot-style summary: rows = students, cols = subjects
// Displays grade, total score, and highlights positions for each subject.

import { useMemo, useState } from "react";
import { getGradeBandByGrade, ordinal, TERM_LABELS } from "@/src/lib/caGrades";
import { Trophy, Medal, TrendingUp, ChevronDown } from "lucide-react";

type CARecord = {
  id:             number;
  studentId:      string;
  studentName:    string;
  studentSurname: string;
  subjectId:      number;
  subjectName:    string;
  term:           string;
  academicYear:   string;
  classworkScore: number;
  examScore:      number;
  totalScore:     number;
  grade:          string;
  gradePoint:     number;
  remarks:        string;
};

type Student = { id: string; name: string; surname: string };
type Subject = { id: number; name: string };

type Props = {
  className: string;
  students:  Student[];
  subjects:  Subject[];
  caRecords: CARecord[];
};

// ─── Position badge ────────────────────────────────────────────────────────────
function PositionBadge({ pos }: { pos: number }) {
  if (pos === 1) return (
    <span className="flex items-center gap-0.5 text-[10px] font-black text-amber-600">
      <Trophy size={9} /> 1st
    </span>
  );
  if (pos === 2) return (
    <span className="flex items-center gap-0.5 text-[10px] font-black text-slate-500">
      <Medal size={9} /> 2nd
    </span>
  );
  if (pos === 3) return (
    <span className="flex items-center gap-0.5 text-[10px] font-black text-orange-700">
      <Medal size={9} /> 3rd
    </span>
  );
  return <span className="text-[10px] text-gray-400">{ordinal(pos)}</span>;
}

const CAClassSummary = ({ className, students, subjects, caRecords }: Props) => {
  const [filterTerm, setFilterTerm]   = useState<string>("all");
  const [filterYear, setFilterYear]   = useState<string>("all");

  
  // 1. Memoize unique terms and years
  const { terms, years } = useMemo(()=> {
    return {
      terms: [...new Set(caRecords.map((r)=>r.term))].sort(),
      years: [...new Set(caRecords.map((r)=>r.academicYear))].sort().reverse(),
    }
  }, [caRecords]);

  // 2. Memoize all heavy calculations
  const filtered = caRecords.filter((r) => {
    const termMatch = filterTerm === "all" || r.term === filterTerm;
    const yearMatch = filterYear === "all" || r.academicYear === filterYear;
    return termMatch && yearMatch;
  });

  // Build a lookup: studentId → subjectId → CA record
  const lookup: Record<string, Record<number, CARecord>> = {};
  for (const r of filtered) {
    if (!lookup[r.studentId]) lookup[r.studentId] = {};
    lookup[r.studentId][r.subjectId] = r;
  }

  // For each subject, compute position ranking (by totalScore desc)
  const subjectPositions: Record<number, Record<string, number>> = {};
  for (const sub of subjects) {
    const rows = students
      .map((s) => ({ studentId: s.id, score: lookup[s.id]?.[sub.id]?.totalScore ?? -1 }))
      .filter((r) => r.score >= 0)
      .sort((a, b) => b.score - a.score);

    subjectPositions[sub.id] = {};
    rows.forEach((r, idx) => {
      subjectPositions[sub.id][r.studentId] = idx + 1;
    });
  }

  // Overall: sum of gradePoints per student → rank (lower = better)
  const studentOverall: Record<string, { totalScore: number; aggregate: number; subjects: number }> = {};
  for (const s of students) {
    const records = subjects.map((sub) => lookup[s.id]?.[sub.id]).filter(Boolean) as CARecord[];
    const scores  = records.map((r) => r.totalScore);
    const gps     = records.map((r) => r.gradePoint);

    // Best 6 gradePoints for aggregate (BECE style)
    const best6 = [...gps].sort((a, b) => a - b).slice(0, 6);
    const agg   = best6.reduce((a, b) => a + b, 0);
    const avg   = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;

    studentOverall[s.id] = {
      totalScore: Math.round(avg * 10) / 10,
      aggregate:  agg,
      subjects:   records.length,
    };
  }

  // Sort students by aggregate ascending (lower = better)
  const sortedStudents = [...students].sort((a, b) => {
    const aData = studentOverall[a.id];
    const bData = studentOverall[b.id];
    if (aData.aggregate !== bData.aggregate) return aData.aggregate - bData.aggregate;
    return bData.totalScore - aData.totalScore; // tiebreak: higher avg
  });

  const overallPositions: Record<string, number> = {};
  sortedStudents.forEach((s, idx) => {
    overallPositions[s.id] = idx + 1;
  });

  if (caRecords.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
        <div className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center">
          <TrendingUp size={22} className="text-gray-300" />
        </div>
        <p className="text-sm font-bold text-gray-400">No CA records yet</p>
        <p className="text-xs text-gray-300">Switch to the Entry tab to add scores.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-gray-800">CA Summary</h2>
          <p className="text-sm text-gray-400 font-medium mt-0.5">{className} — all subjects</p>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <select
              value={filterTerm}
              onChange={(e) => setFilterTerm(e.target.value)}
              className="appearance-none ring-[1.5px] ring-gray-200 px-3 py-2 rounded-xl text-xs font-bold text-gray-600 focus:ring-indigo-500 outline-none bg-white pr-7"
            >
              <option value="all">All Terms</option>
              {terms.map((t) => (
                <option key={t} value={t}>{TERM_LABELS[t] ?? t}</option>
              ))}
            </select>
            <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>

          <div className="relative">
            <select
              value={filterYear}
              onChange={(e) => setFilterYear(e.target.value)}
              className="appearance-none ring-[1.5px] ring-gray-200 px-3 py-2 rounded-xl text-xs font-bold text-gray-600 focus:ring-indigo-500 outline-none bg-white pr-7"
            >
              <option value="all">All Years</option>
              {years.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Pivot table */}
      <div className="overflow-x-auto rounded-2xl border border-gray-100">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="text-left px-4 py-3 text-xs font-black uppercase tracking-wider text-gray-400 sticky left-0 bg-gray-50 z-10 min-w-[160px]">
                Student
              </th>
              {subjects.map((sub) => (
                <th key={sub.id} className="px-3 py-3 text-center text-xs font-black uppercase tracking-wider text-gray-400 min-w-[100px]">
                  <div className="flex flex-col items-center gap-0.5">
                    <span className="truncate max-w-[90px]">{sub.name}</span>
                  </div>
                </th>
              ))}
              <th className="px-4 py-3 text-center text-xs font-black uppercase tracking-wider text-indigo-400 min-w-[110px]">
                Aggregate
              </th>
              <th className="px-4 py-3 text-center text-xs font-black uppercase tracking-wider text-indigo-400 min-w-[80px]">
                Position
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {sortedStudents.map((student, rowIdx) => {
              const overall  = studentOverall[student.id];
              const position = overallPositions[student.id];
              const isTop    = position <= 3;

              return (
                <tr
                  key={student.id}
                  className={`transition-colors ${isTop ? "bg-amber-50/30" : "hover:bg-gray-50/50"}`}
                >
                  {/* Student */}
                  <td className={`px-4 py-3 sticky left-0 z-10 ${isTop ? "bg-amber-50/50" : "bg-white"}`}>
                    <div className="flex items-center gap-2.5">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-black shrink-0
                        ${position === 1 ? "bg-amber-100 text-amber-700"
                          : position === 2 ? "bg-slate-100 text-slate-600"
                          : position === 3 ? "bg-orange-100 text-orange-700"
                          : "bg-indigo-50 text-indigo-600"}`}>
                        {rowIdx + 1}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-gray-800 text-sm truncate">
                          {student.name} {student.surname}
                        </p>
                      </div>
                    </div>
                  </td>

                  {/* Per-subject cells */}
                  {subjects.map((sub) => {
                    const rec = lookup[student.id]?.[sub.id];
                    const pos = subjectPositions[sub.id]?.[student.id];
                    if (!rec) {
                      return (
                        <td key={sub.id} className="px-3 py-3 text-center">
                          <span className="text-xs text-gray-200 font-bold">—</span>
                        </td>
                      );
                    }
                    const band = getGradeBandByGrade(rec.grade);
                    return (
                      <td key={sub.id} className="px-3 py-3 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className={`text-xs font-black px-2 py-0.5 rounded-lg border ${band.bg} ${band.color} ${band.border}`}>
                            {rec.grade}
                          </span>
                          <span className="text-[10px] text-gray-400 font-semibold">
                            {Math.round(rec.totalScore * 10) / 10}%
                          </span>
                          <span className="text-[9px] font-semibold text-gray-400">
                            CA {Math.round(rec.classworkScore * 10) / 10} + Exam {Math.round(rec.examScore * 10) / 10}
                          </span>
                          {pos && <PositionBadge pos={pos} />}
                        </div>
                      </td>
                    );
                  })}

                  {/* Aggregate */}
                  <td className="px-4 py-3 text-center">
                    {overall.subjects > 0 ? (
                      <div className="flex flex-col items-center gap-0.5">
                        <span className="text-base font-black text-gray-800">
                          {overall.aggregate}
                        </span>
                        <span className="text-[10px] text-gray-400">
                          ({overall.subjects} subj)
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-200">—</span>
                    )}
                  </td>

                  {/* Overall position */}
                  <td className="px-4 py-3 text-center">
                    {overall.subjects > 0 ? (
                      <PositionBadge pos={position} />
                    ) : (
                      <span className="text-xs text-gray-200">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-2 pt-1">
        <span className="text-[10px] text-gray-400 font-semibold">Grades:</span>
        {[
          { g: "A1", label: "≥90", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
          { g: "B2", label: "≥80", color: "bg-teal-50 text-teal-700 border-teal-200"         },
          { g: "B3", label: "≥75", color: "bg-blue-50 text-blue-700 border-blue-200"         },
          { g: "C4", label: "≥70", color: "bg-sky-50 text-sky-700 border-sky-200"            },
          { g: "C5", label: "≥65", color: "bg-amber-50 text-amber-700 border-amber-200"      },
          { g: "C6", label: "≥60", color: "bg-yellow-50 text-yellow-700 border-yellow-200"   },
          { g: "D7", label: "≥55", color: "bg-orange-50 text-orange-700 border-orange-200"   },
          { g: "E8", label: "≥50", color: "bg-red-50 text-red-700 border-red-200"            },
          { g: "F9", label: "<50", color: "bg-rose-50 text-rose-700 border-rose-200"         },
        ].map((b) => (
          <span key={b.g} className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border ${b.color}`}>
            {b.g} {b.label}
          </span>
        ))}
      </div>

      <p className="text-[10px] text-gray-400 font-medium">
        * Aggregate = sum of best 6 grade points (Ghana BECE system). Lower aggregate = better performance.
        Position is ranked by aggregate ascending, with average score as tiebreaker.
      </p>
    </div>
  );
};

export default CAClassSummary;
