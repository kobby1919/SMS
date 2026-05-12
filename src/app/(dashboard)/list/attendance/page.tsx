// src/app/(dashboard)/list/attendance/page.tsx

import prisma from "@/src/lib/prisma";
import { requirePageSession } from "@/src/lib/authz";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  CheckCircle2, XCircle, Clock, FileCheck,
  AlertTriangle, Users, CalendarDays, TrendingUp,
} from "lucide-react";
import AttendanceFilters from "@/src/components/AttendanceFilters";


const AttendanceListPage = async ({
  searchParams,
}: {
  searchParams: Promise<{ classId?: string; date?: string; status?: string }>;
}) => {
  const { role, schoolId } = await requirePageSession();

  const params = await searchParams;
  const today  = new Date();
  today.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const filterDate = params.date ? new Date(params.date) : today;
  filterDate.setHours(0, 0, 0, 0);
  const filterDateEnd = new Date(filterDate);
  filterDateEnd.setHours(23, 59, 59, 999);

  // ── Today's school-wide stats ─────────────────────────────────────────────
  const [todayGrouped, totalStudents] = await Promise.all([
    prisma.attendance.groupBy({
      by: ["status"],
      where: { schoolId, date: { gte: today, lte: todayEnd } },
      _count: { _all: true },
    }),
    prisma.student.count({ where: { schoolId } }),
  ]);
  const todayStatusCounts = Object.fromEntries(
    todayGrouped.map((row) => [row.status, row._count._all]),
  ) as Record<string, number>;
  const todayPresent = todayStatusCounts.PRESENT ?? 0;
  const todayAbsent = todayStatusCounts.ABSENT ?? 0;
  const todayLate = todayStatusCounts.LATE ?? 0;
  const todayExcused = todayStatusCounts.EXCUSED ?? 0;

  const todayTotal = todayPresent + todayAbsent + todayLate + todayExcused;
  const todayRate  = todayTotal > 0 ? Math.round((todayPresent / todayTotal) * 100) : 0;

  // ── All classes for filter ────────────────────────────────────────────────
  const classes = await prisma.class.findMany({
    where: { schoolId },
    include: { grade: { select: { level: true, order: true } } },
    orderBy: [{ grade: { order: "asc" } }, { name: "asc" }],
  });

  // ── Attendance records with filters ──────────────────────────────────────
  const whereClause: any = {
    schoolId,
    date: { gte: filterDate, lte: filterDateEnd },
  };
  if (params.classId) {
    whereClause.student = { classId: parseInt(params.classId) };
  }
  if (params.status) {
    whereClause.status = params.status;
  }

  const records = await prisma.attendance.findMany({
    where:   whereClause,
    include: {
      student: {
        select: {
          id: true, name: true, surname: true, img: true,
          class: { select: { name: true } },
        },
      },
      lesson: {
        select: { subject: { select: { name: true } } },
      },
    },
    orderBy: [{ date: "desc" }, { student: { name: "asc" } }],
    take: 100,
  });

  // ── Flagged students (3+ consecutive absences) ────────────────────────────
  const allStudents = await prisma.student.findMany({
    where: { schoolId },
    select: {
      id: true, name: true, surname: true,
      class: { select: { name: true } },
    },
  });
  const studentIds = allStudents.map((student) => student.id);
  const absenceWindowStart = new Date(today);
  absenceWindowStart.setDate(absenceWindowStart.getDate() - 30);
  const recentAttendanceRows = studentIds.length
    ? await prisma.attendance.findMany({
        where: {
          schoolId,
          studentId: { in: studentIds },
          date: { gte: absenceWindowStart },
        },
        orderBy: [{ studentId: "asc" }, { date: "desc" }],
        select: { studentId: true, status: true },
      })
    : [];
  const recentByStudent = new Map<string, { status: string }[]>();
  for (const row of recentAttendanceRows) {
    const recent = recentByStudent.get(row.studentId) ?? [];
    if (recent.length < 5) {
      recent.push({ status: row.status });
      recentByStudent.set(row.studentId, recent);
    }
  }

  const flagged: { id: string; name: string; surname: string; className: string; streak: number }[] = [];
  for (const student of allStudents) {
    const recent = recentByStudent.get(student.id) ?? [];
    let streak = 0;
    for (const r of recent) {
      if (r.status === "ABSENT") streak++;
      else break;
    }
    if (streak >= 3) flagged.push({ ...student, className: student.class.name, streak });
  }

  const statusConfig = {
    PRESENT: { icon: <CheckCircle2 size={14} />, color: "text-emerald-600 bg-emerald-50 border-emerald-200" },
    ABSENT:  { icon: <XCircle      size={14} />, color: "text-rose-600 bg-rose-50 border-rose-200"         },
    LATE:    { icon: <Clock        size={14} />, color: "text-amber-600 bg-amber-50 border-amber-200"       },
    EXCUSED: { icon: <FileCheck    size={14} />, color: "text-indigo-600 bg-indigo-50 border-indigo-200"    },
  };

  return (
    <div className="flex-1 m-4 mt-0 flex flex-col gap-5">

      {/* ── Header ── */}
      <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 bg-emerald-50 rounded-2xl flex items-center justify-center shrink-0">
              <CalendarDays size={20} className="text-emerald-600" />
            </div>
            <div>
              <h1 className="text-xl font-black text-gray-800 tracking-tight">Attendance</h1>
              <p className="text-sm text-gray-400 mt-0.5 font-medium">
                {totalStudents} students · School-wide records
              </p>
            </div>
          </div>
          {["admin", "teacher"].includes(role) && (
            <Link
              href="/list/attendance/take"
              className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 transition-all shadow-sm"
            >
              <CalendarDays size={15} />
              Take Attendance
            </Link>
          )}
        </div>
      </div>

      {/* ── Today's stats ── */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: "Present",      value: todayPresent, icon: <CheckCircle2 size={16} />, color: "bg-emerald-50 text-emerald-600" },
          { label: "Absent",       value: todayAbsent,  icon: <XCircle      size={16} />, color: "bg-rose-50 text-rose-600"       },
          { label: "Late",         value: todayLate,    icon: <Clock        size={16} />, color: "bg-amber-50 text-amber-600"     },
          { label: "Excused",      value: todayExcused, icon: <FileCheck    size={16} />, color: "bg-indigo-50 text-indigo-600"   },
          { label: "Today's Rate", value: `${todayRate}%`, icon: <TrendingUp size={16} />, color: "bg-violet-50 text-violet-600" },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${s.color}`}>
              {s.icon}
            </div>
            <div>
              <p className="text-xl font-black text-gray-800 leading-none">{s.value}</p>
              <p className="text-xs text-gray-400 font-medium mt-0.5">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Flagged students ── */}
      {flagged.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={16} className="text-amber-600" />
            <h2 className="font-black text-amber-800 text-sm">
              {flagged.length} student{flagged.length !== 1 ? "s" : ""} flagged for consecutive absences
            </h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {flagged.map((s) => (
              <div key={s.id} className="flex items-center gap-2 bg-white border border-amber-200 px-3 py-2 rounded-xl">
                <span className="text-xs font-bold text-gray-800">{s.name} {s.surname}</span>
                <span className="text-xs text-gray-400">· {s.className}</span>
                <span className="text-[10px] font-black px-1.5 py-0.5 bg-rose-100 text-rose-700 rounded-lg">
                  {s.streak} days absent
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Filters ── */}
      <AttendanceFilters
        classes={classes.map((c) => ({ id: c.id, name: c.name }))}
        currentDate={params.date ?? new Date().toISOString().split("T")[0]}
        currentClassId={params.classId}
        currentStatus={params.status}
      />

      {/* ── Records table ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
          <p className="text-xs font-black uppercase tracking-wider text-gray-400">
            Records — {records.length} entries
          </p>
          <Users size={14} className="text-gray-300" />
        </div>

        {records.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <CalendarDays size={32} className="text-gray-200 mb-3" />
            <p className="text-gray-400 font-semibold text-sm">No attendance records found</p>
            <p className="text-gray-300 text-xs mt-1">for the selected filters</p>
          </div>
        ) : (
          <div className="w-full overflow-x-auto">
            <table className="w-full min-w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60">
                  <th className="text-left px-4 py-3 text-xs font-black uppercase tracking-wider text-gray-400">Student</th>
                  <th className="text-left px-3 py-3 text-xs font-black uppercase tracking-wider text-gray-400 hidden sm:table-cell">Class</th>
                  <th className="text-left px-3 py-3 text-xs font-black uppercase tracking-wider text-gray-400 hidden md:table-cell">Subject</th>
                  <th className="text-left px-3 py-3 text-xs font-black uppercase tracking-wider text-gray-400">Status</th>
                  <th className="text-left px-3 py-3 text-xs font-black uppercase tracking-wider text-gray-400 hidden lg:table-cell">Note</th>
                  <th className="text-left px-3 py-3 text-xs font-black uppercase tracking-wider text-gray-400 hidden md:table-cell">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {records.map((r) => {
                  const cfg = statusConfig[r.status as keyof typeof statusConfig];
                  return (
                    <tr key={r.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-bold text-sm text-gray-800">
                          {r.student.name} {r.student.surname}
                        </p>
                      </td>
                      <td className="px-3 py-3 hidden sm:table-cell">
                        <span className="text-xs font-semibold px-2 py-1 bg-indigo-50 text-indigo-600 rounded-lg">
                          {r.student.class.name}
                        </span>
                      </td>
                      <td className="px-3 py-3 hidden md:table-cell">
                        <span className="text-sm text-gray-500">{r.lesson.subject.name}</span>
                      </td>
                      <td className="px-3 py-3">
                        <span className={`flex items-center gap-1.5 w-fit px-2.5 py-1 rounded-lg text-xs font-bold border ${cfg.color}`}>
                          {cfg.icon}
                          {r.status}
                        </span>
                      </td>
                      <td className="px-3 py-3 hidden lg:table-cell">
                        <span className="text-xs text-gray-400 italic">{r.note ?? "—"}</span>
                      </td>
                      <td className="px-3 py-3 hidden md:table-cell">
                        <span className="text-xs text-gray-500 font-medium">
                          {new Date(r.date).toLocaleDateString("en-GH", {
                            day: "numeric", month: "short", year: "numeric",
                          })}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AttendanceListPage;
