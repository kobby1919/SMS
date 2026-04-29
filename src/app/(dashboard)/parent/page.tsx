// src/app/(dashboard)/parent/page.tsx


import prisma from "@/src/lib/prisma";
import { currentUser } from "@clerk/nextjs/server";
import Announcements from "@/src/components/Announcements";
import EventCalendar from "@/src/components/EventCalendar";
import EventList from "@/src/components/EventList";
import ParentTimetableTabs from "@/src/components/ParentTimetableTabs";
import WelcomeBanner from "@/src/components/WelcomeBanner";
import type { ChildSchedule } from "@/src/components/ParentTimetableTabs";
import type { CalendarLesson } from "@/src/components/BigCalendar";
import Link from "next/link";
import {
  CheckCircle2, XCircle, Clock, FileCheck,
  AlertTriangle, TrendingUp, TrendingDown, Minus,
  CalendarDays, ShieldAlert, FileText, Award,
  AlertCircle, Star, BookOpen,
} from "lucide-react";
import { getGradeBandByGrade, computeAggregate, ordinal, TERM_LABELS } from "@/src/lib/caGrades";

export const dynamic = "force-dynamic";

const getStreak = (records: { status: string }[]): number => {
  let streak = 0;
  for (const r of records) {
    if (r.status === "ABSENT") streak++;
    else break;
  }
  return streak;
};

const ParentPage = async ({
  searchParams,
}: {
  searchParams: { [key: string]: string | undefined };
}) => {
  const user = await currentUser();

  const parent = await prisma.parent.findUnique({
    where: { id: user!.id },
    include: {
      students: {
        include: { class: { select: { id: true, name: true } } },
        orderBy: { name: "asc" },
      },
    },
  });

  const children  = parent?.students ?? [];
  const parentName = parent
    ? `${parent.name} ${parent.surname}`
    : (user?.firstName ?? "Parent");

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const childrenData = await Promise.all(
    children.map(async (child) => {
      // ── Timetable ────────────────────────────────────────────────────────
      const lessons = await prisma.lesson.findMany({
        where:   { classId: child.classId },
        include: {
          subject: { select: { name: true } },
          teacher: { select: { name: true, surname: true } },
        },
        orderBy: [{ day: "asc" }, { startTime: "asc" }],
      });

      // ── Attendance ───────────────────────────────────────────────────────
      const todayAttendance = await prisma.attendance.findMany({
        where:   { studentId: child.id, date: { gte: today, lte: todayEnd } },
        include: { lesson: { include: { subject: { select: { name: true } } } } },
        orderBy: { date: "asc" },
      });

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const history = await prisma.attendance.findMany({
        where:   { studentId: child.id, date: { gte: thirtyDaysAgo } },
        include: { lesson: { include: { subject: { select: { name: true } } } } },
        orderBy: { date: "desc" },
      });

      const recentRecords = await prisma.attendance.findMany({
        where:   { studentId: child.id },
        orderBy: { date: "desc" },
        take:    7,
        select:  { status: true },
      });
      const streak = getStreak(recentRecords);

      const total   = history.length;
      const present = history.filter((h) => h.status === "PRESENT").length;
      const absent  = history.filter((h) => h.status === "ABSENT").length;
      const late    = history.filter((h) => h.status === "LATE").length;
      const excused = history.filter((h) => h.status === "EXCUSED").length;
      const rate    = total > 0 ? Math.round((present / total) * 100) : 0;

      const calendarLessons: CalendarLesson[] = lessons.map((l) => ({
        title:     l.subject.name,
        day:       l.day,
        startTime: l.startTime,
        endTime:   l.endTime,
        teacher:   `${l.teacher.name} ${l.teacher.surname}`,
      }));

      // ── CA records — all terms, ordered oldest first ──────────────────────
      const allCA = await prisma.continuousAssessment.findMany({
        where:   { studentId: child.id },
        include: { subject: { select: { name: true } } },
        orderBy: [{ academicYear: "asc" }, { term: "asc" }],
      });

      // Group into term buckets
      const groupMap = new Map<string, typeof allCA>();
      for (const r of allCA) {
        const key = `${r.academicYear}__${r.term}`;
        if (!groupMap.has(key)) groupMap.set(key, []);
        groupMap.get(key)!.push(r);
      }

      const termGroups = Array.from(groupMap.entries()).map(([key, records]) => {
        const [year, term] = key.split("__");
        const scores       = records.map((r) => r.totalScore);
        const gps          = records.map((r) => r.gradePoint);
        const avg          = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
        return {
          term, year, records,
          avgScore:  Math.round(avg * 10) / 10,
          aggregate: computeAggregate(gps),
        };
      });

      const latestGroup = termGroups[termGroups.length - 1] ?? null;
      const prevGroup   = termGroups[termGroups.length - 2] ?? null;

      // Trend vs previous term
      const trendDiff = prevGroup && latestGroup
        ? Math.round((latestGroup.avgScore - prevGroup.avgScore) * 10) / 10
        : 0;
      const trend = !prevGroup || !latestGroup ? "neutral"
        : trendDiff > 2  ? "up"
        : trendDiff < -2 ? "down"
        : "neutral";

      // Class position for latest term
      let myPosition = 0;
      if (latestGroup) {
        const classmatesCA = await prisma.continuousAssessment.findMany({
          where: {
            classId:      child.classId,
            term:         latestGroup.term as any,
            academicYear: latestGroup.year,
          },
          select: { studentId: true, gradePoint: true },
        });
        const gpMap: Record<string, number[]> = {};
        for (const r of classmatesCA) {
          if (!gpMap[r.studentId]) gpMap[r.studentId] = [];
          gpMap[r.studentId].push(r.gradePoint);
        }
        const sorted = Object.entries(gpMap)
          .map(([sid, gps]) => ({ sid, agg: computeAggregate(gps) }))
          .sort((a, b) => a.agg - b.agg);
        myPosition = sorted.findIndex((s) => s.sid === child.id) + 1;
      }

      const classSize = await prisma.student.count({ where: { classId: child.classId } });

      // Best / weakest subject in latest term
      const sortedByGP = latestGroup
        ? [...latestGroup.records].sort((a, b) => a.gradePoint - b.gradePoint)
        : [];
      const bestSubject = sortedByGP[0] ?? null;
      const weakSubject = sortedByGP[sortedByGP.length - 1] ?? null;

      return {
        id: child.id, name: child.name, surname: child.surname,
        className: child.class.name, classId: child.classId,
        lessons: calendarLessons,
        streak, isFlagged: streak >= 3,
        todayAttendance, history,
        stats: { total, present, absent, late, excused, rate },
        ca: { latestGroup, prevGroup, termGroups, trend, trendDiff, myPosition, classSize, bestSubject, weakSubject },
      };
    })
  );

  const childrenSchedules: ChildSchedule[] = childrenData.map((c) => ({
    id: c.id, name: c.name, surname: c.surname,
    className: c.className, lessons: c.lessons,
  }));

  const anyFlagged = childrenData.some((c) => c.isFlagged);
  const childCount = children.length;

  return (
    <div className="p-4 flex flex-col gap-5">

      {/* ── WELCOME BANNER ── */}
      <WelcomeBanner
        role="parent"
        name={parentName}
        subtitle={`${childCount} child${childCount !== 1 ? "ren" : ""} enrolled · monitoring attendance & schedule`}
        tag="Term 2 · 2025/26"
      />

      {/* ── Flagged alert ── */}
      {anyFlagged && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-start gap-3">
          <ShieldAlert size={20} className="text-rose-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-black text-rose-800 text-sm">Attendance Alert</p>
            <p className="text-xs text-rose-600 mt-0.5 font-medium">
              {childrenData.filter((c) => c.isFlagged).map((c) => `${c.name} ${c.surname}`).join(", ")}{" "}
              {childrenData.filter((c) => c.isFlagged).length === 1 ? "has" : "have"} been absent 3 or more consecutive days.
              Please contact the school.
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-col xl:flex-row gap-5">

        {/* LEFT */}
        <div className="w-full xl:w-2/3 flex flex-col gap-5">

          {childrenData.map((child, idx) => (
            <div key={child.id} className="flex flex-col gap-4">

              {/* Child header */}
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-black text-sm
                  ${child.isFlagged ? "bg-rose-100 text-rose-600" : "bg-violet-100 text-violet-600"}`}>
                  {child.name[0]}{child.surname[0]}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="font-black text-gray-800 text-base">{child.name} {child.surname}</h2>
                    <span className="text-[11px] font-bold px-2 py-0.5 bg-violet-50 text-violet-600 rounded-lg">
                      {child.className}
                    </span>
                    {child.isFlagged && (
                      <span className="flex items-center gap-1 text-[11px] font-black px-2 py-0.5 bg-rose-100 text-rose-600 rounded-lg">
                        <AlertTriangle size={10} />{child.streak} days absent
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 font-medium mt-0.5">
                    30-day rate:{" "}
                    <span className={`font-black ${child.stats.rate >= 80 ? "text-emerald-600" : child.stats.rate >= 60 ? "text-amber-600" : "text-rose-600"}`}>
                      {child.stats.rate}%
                    </span>
                  </p>
                </div>
              </div>

              {/* ── CA PERFORMANCE CARD ── */}
              {child.ca.latestGroup ? (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  {/* Card header */}
                  <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-violet-50 rounded-xl flex items-center justify-center">
                        <Award size={14} className="text-violet-600" />
                      </div>
                      <div>
                        <p className="text-sm font-black text-gray-800">Academic Performance</p>
                        <p className="text-[10px] text-gray-400 font-medium">
                          {TERM_LABELS[child.ca.latestGroup.term]} · {child.ca.latestGroup.year}
                        </p>
                      </div>
                    </div>
                    <Link
                      href={`/list/report-cards/${child.id}?term=${child.ca.latestGroup.term}&year=${child.ca.latestGroup.year}&classId=${child.classId}`}
                      className="flex items-center gap-1.5 px-3 py-2 bg-violet-600 text-white rounded-xl text-xs font-bold hover:bg-violet-700 transition-colors shrink-0"
                    >
                      <FileText size={12} /> Report Card
                    </Link>
                  </div>

                  {/* Stats row */}
                  <div className="grid grid-cols-3 divide-x divide-gray-100">
                    {/* Average + trend */}
                    <div className="flex flex-col gap-0.5 p-4">
                      <div className="flex items-center gap-1 mb-0.5">
                        {child.ca.trend === "up"
                          ? <TrendingUp   size={12} className="text-emerald-500" />
                          : child.ca.trend === "down"
                          ? <TrendingDown size={12} className="text-rose-500" />
                          : <Minus        size={12} className="text-gray-400" />}
                        <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">Average</p>
                      </div>
                      <p className={`text-2xl font-black leading-none
                        ${child.ca.trend === "up" ? "text-emerald-700" : child.ca.trend === "down" ? "text-rose-700" : "text-gray-800"}`}>
                        {child.ca.latestGroup.avgScore}%
                      </p>
                      {child.ca.prevGroup && (
                        <p className={`text-[10px] font-semibold mt-0.5
                          ${child.ca.trendDiff > 0 ? "text-emerald-600" : child.ca.trendDiff < 0 ? "text-rose-600" : "text-gray-400"}`}>
                          {child.ca.trendDiff > 0 ? "+" : ""}{child.ca.trendDiff}% vs last term
                        </p>
                      )}
                    </div>

                    {/* Aggregate */}
                    <div className="flex flex-col gap-0.5 p-4">
                      <p className="text-[10px] font-black uppercase tracking-wider text-gray-400 mb-0.5">Aggregate</p>
                      <p className="text-2xl font-black text-amber-600 leading-none">
                        {child.ca.latestGroup.aggregate}
                      </p>
                      <p className="text-[10px] text-gray-400 font-semibold mt-0.5">BECE system</p>
                    </div>

                    {/* Position */}
                    <div className="flex flex-col gap-0.5 p-4">
                      <p className="text-[10px] font-black uppercase tracking-wider text-gray-400 mb-0.5">Position</p>
                      <p className={`text-2xl font-black leading-none
                        ${child.ca.myPosition <= 3 ? "text-amber-600" : "text-gray-800"}`}>
                        {child.ca.myPosition > 0 ? ordinal(child.ca.myPosition) : "—"}
                      </p>
                      <p className="text-[10px] text-gray-400 font-semibold mt-0.5">
                        of {child.ca.classSize} students
                      </p>
                    </div>
                  </div>

                  {/* Subject bars */}
                  <div className="px-5 py-3 border-t border-gray-100 flex flex-col gap-2">
                    {child.ca.latestGroup.records.map((r) => {
                      const band = getGradeBandByGrade(r.grade);
                      return (
                        <div key={r.id} className="flex items-center gap-3">
                          <p className="text-xs font-semibold text-gray-600 w-28 shrink-0 truncate">
                            {r.subject.name}
                          </p>
                          <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${band.bar}`}
                              style={{ width: `${r.totalScore}%` }}
                            />
                          </div>
                          <span className={`text-[10px] font-black w-7 text-right ${band.color}`}>
                            {r.grade}
                          </span>
                          <span className="text-[10px] text-gray-400 w-10 text-right">
                            {r.totalScore.toFixed(1)}%
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Best / weakest */}
                  {child.ca.bestSubject && child.ca.weakSubject &&
                   child.ca.bestSubject.id !== child.ca.weakSubject.id && (
                    <div className="grid grid-cols-2 gap-3 px-5 pb-5">
                      <div className="flex items-start gap-2 p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                        <Star size={12} className="text-emerald-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-[10px] font-black text-emerald-700">🌟 Excelling In</p>
                          <p className="text-xs font-bold text-emerald-800">{child.ca.bestSubject.subject.name}</p>
                          <p className="text-[10px] text-emerald-600">
                            {child.ca.bestSubject.grade} · {child.ca.bestSubject.totalScore.toFixed(1)}%
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-xl border border-amber-100">
                        <AlertCircle size={12} className="text-amber-500 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-[10px] font-black text-amber-700">📚 Needs Support</p>
                          <p className="text-xs font-bold text-amber-800">{child.ca.weakSubject.subject.name}</p>
                          <p className="text-[10px] text-amber-600">
                            {child.ca.weakSubject.grade} · {child.ca.weakSubject.totalScore.toFixed(1)}%
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Term-on-term mini chart */}
                  {child.ca.termGroups.length > 1 && (
                    <div className="px-5 pb-5 border-t border-gray-50 pt-4">
                      <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3">
                        Term Progress
                      </p>
                      <div className="flex items-end gap-2 h-12">
                        {child.ca.termGroups.map((g, i) => {
                          const isLatest = i === child.ca.termGroups.length - 1;
                          const barH     = Math.max((g.avgScore / 100) * 100, 8);
                          const topGrade = g.records.sort((a, b) => a.gradePoint - b.gradePoint)[0]?.grade ?? "F9";
                          const band     = getGradeBandByGrade(topGrade);
                          return (
                            <div key={`${g.year}${g.term}`} className="flex flex-col items-center gap-1 flex-1">
                              <span className="text-[9px] font-black text-gray-400">{g.avgScore}%</span>
                              <div
                                className={`w-full rounded-t-lg ${isLatest ? band.bar : "bg-gray-200"}`}
                                style={{ height: `${barH * 0.4}px` }}
                              />
                              <span className={`text-[9px] font-bold truncate max-w-full text-center
                                ${isLatest ? "text-indigo-600" : "text-gray-400"}`}>
                                {TERM_LABELS[g.term]?.replace("Term ", "T")} {g.year.slice(-2)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center gap-4">
                  <div className="w-9 h-9 bg-gray-50 rounded-xl flex items-center justify-center shrink-0">
                    <BookOpen size={16} className="text-gray-300" />
                  </div>
                  <div>
                    <p className="text-sm font-black text-gray-400">No CA records yet</p>
                    <p className="text-xs text-gray-300 mt-0.5">
                      {child.name}&apos;s class teacher hasn&apos;t entered scores for this term yet.
                    </p>
                  </div>
                </div>
              )}

              {/* ── ATTENDANCE STATS (unchanged) ── */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {[
                  { label: "Present", value: child.stats.present, icon: <CheckCircle2 size={14} />, color: "bg-emerald-50 text-emerald-700" },
                  { label: "Absent",  value: child.stats.absent,  icon: <XCircle      size={14} />, color: "bg-rose-50 text-rose-700"       },
                  { label: "Late",    value: child.stats.late,    icon: <Clock        size={14} />, color: "bg-amber-50 text-amber-700"     },
                  { label: "Excused", value: child.stats.excused, icon: <FileCheck    size={14} />, color: "bg-indigo-50 text-indigo-700"   },
                  { label: "Rate",    value: `${child.stats.rate}%`, icon: <TrendingUp size={14} />, color: "bg-violet-50 text-violet-700" },
                ].map((s) => (
                  <div key={s.label} className={`rounded-2xl p-3 flex items-center gap-2.5 ${s.color}`}>
                    <div className="opacity-60 shrink-0">{s.icon}</div>
                    <div>
                      <p className="text-xl font-black leading-none">{s.value}</p>
                      <p className="text-[10px] font-bold uppercase tracking-wide opacity-60 mt-0.5">{s.label}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Rate bar */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-black text-gray-500 uppercase tracking-wider">30-day Rate</span>
                  <span className={`text-sm font-black ${child.stats.rate >= 80 ? "text-emerald-600" : child.stats.rate >= 60 ? "text-amber-600" : "text-rose-600"}`}>
                    {child.stats.rate}%
                  </span>
                </div>
                <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${child.stats.rate >= 80 ? "bg-emerald-500" : child.stats.rate >= 60 ? "bg-amber-500" : "bg-rose-500"}`}
                    style={{ width: `${child.stats.rate}%` }}
                  />
                </div>
                <p className="text-[10px] text-gray-400 font-medium mt-1.5">
                  {child.stats.rate >= 80 ? "✅ Good attendance — keep it up!" : child.stats.rate >= 60 ? "⚠️ Attendance needs improvement" : "❌ Poor attendance — please contact the school"}
                </p>
              </div>

              {/* Today's attendance (unchanged) */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CalendarDays size={15} className="text-emerald-500" />
                    <h3 className="font-black text-gray-800 text-sm">Today&apos;s Attendance</h3>
                  </div>
                  <Link href="/list/attendance" className="text-xs font-bold text-indigo-500 hover:text-indigo-700 transition-colors">
                    Full history →
                  </Link>
                </div>
                {child.todayAttendance.length === 0 ? (
                  <div className="px-4 py-6 text-center">
                    <p className="text-sm text-gray-400 font-semibold">No attendance recorded today yet</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-50">
                    {child.todayAttendance.map((record) => {
                      const statusConfig = {
                        PRESENT: { color: "text-emerald-600 bg-emerald-50 border-emerald-200", icon: <CheckCircle2 size={12} /> },
                        ABSENT:  { color: "text-rose-600 bg-rose-50 border-rose-200",           icon: <XCircle      size={12} /> },
                        LATE:    { color: "text-amber-600 bg-amber-50 border-amber-200",         icon: <Clock        size={12} /> },
                        EXCUSED: { color: "text-indigo-600 bg-indigo-50 border-indigo-200",     icon: <FileCheck    size={12} /> },
                      };
                      const cfg = statusConfig[record.status as keyof typeof statusConfig];
                      return (
                        <div key={record.id} className="flex items-center gap-3 px-4 py-2.5">
                          <span className="text-sm font-semibold text-gray-700 flex-1">{record.lesson.subject.name}</span>
                          <span className={`flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-lg border ${cfg.color}`}>
                            {cfg.icon}{record.status}
                          </span>
                          {record.note && (
                            <span className="text-[10px] text-gray-400 italic hidden sm:block">&ldquo;{record.note}&rdquo;</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Recent history (unchanged) */}
              {child.history.length > 0 && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-100">
                    <h3 className="font-black text-gray-800 text-sm">Recent History</h3>
                    <p className="text-[11px] text-gray-400 mt-0.5">Last 30 days · {child.history.length} records</p>
                  </div>
                  <div className="divide-y divide-gray-50">
                    {child.history.slice(0, 7).map((record) => {
                      const cfg = {
                        PRESENT: { dot: "bg-emerald-400", text: "text-emerald-700", light: "bg-emerald-50" },
                        ABSENT:  { dot: "bg-rose-400",    text: "text-rose-700",    light: "bg-rose-50"    },
                        LATE:    { dot: "bg-amber-400",   text: "text-amber-700",   light: "bg-amber-50"   },
                        EXCUSED: { dot: "bg-indigo-400",  text: "text-indigo-700",  light: "bg-indigo-50"  },
                      }[record.status as "PRESENT" | "ABSENT" | "LATE" | "EXCUSED"];
                      return (
                        <div key={record.id} className="flex items-center gap-3 px-4 py-2.5">
                          <span className={`w-2 h-2 rounded-full shrink-0 ${cfg.dot}`} />
                          <span className="text-xs text-gray-400 font-semibold w-24 shrink-0">
                            {new Date(record.date).toLocaleDateString("en-GH", { weekday: "short", day: "numeric", month: "short" })}
                          </span>
                          <span className="text-sm font-semibold text-gray-700 flex-1 truncate">{record.lesson.subject.name}</span>
                          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-lg ${cfg.light} ${cfg.text}`}>{record.status}</span>
                        </div>
                      );
                    })}
                  </div>
                  {child.history.length > 7 && (
                    <div className="px-4 py-3 border-t border-gray-100 text-center">
                      <Link href="/list/attendance" className="text-xs font-bold text-indigo-500 hover:text-indigo-700">
                        View all {child.history.length} records →
                      </Link>
                    </div>
                  )}
                </div>
              )}

              {/* Consecutive absence warning (unchanged) */}
              {child.isFlagged && (
                <div className="flex items-start gap-3 p-4 bg-rose-50 border border-rose-200 rounded-2xl">
                  <AlertTriangle size={16} className="text-rose-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-black text-rose-800 text-sm">{child.streak} Consecutive Absences</p>
                    <p className="text-xs text-rose-600 mt-1 font-medium leading-relaxed">
                      {child.name} has been absent for {child.streak} school days in a row.
                      Please contact the class teacher or front office and provide any necessary documentation.
                    </p>
                  </div>
                </div>
              )}

              {idx < childrenData.length - 1 && <div className="border-t border-gray-100 pt-2" />}
            </div>
          ))}

          {children.length === 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
              <p className="text-gray-400 font-semibold">No children linked to your account.</p>
              <p className="text-xs text-gray-300 mt-1">Please contact the school administration.</p>
            </div>
          )}

          {/* Timetable (unchanged) */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h2 className="font-black text-gray-800 text-base mb-4">Class Timetables</h2>
            <ParentTimetableTabs children={childrenSchedules} />
          </div>
        </div>

        {/* RIGHT */}
        <div className="w-full xl:w-1/3 flex flex-col gap-4">
          <EventCalendar />
          <EventList dateParam={searchParams.date} />
          <Announcements />
        </div>
      </div>
    </div>
  );
};

export default ParentPage;