// src/app/(dashboard)/student/page.tsx
//
// feat: add CA summary and report card link to student dashboard
//   - Preserves existing attendance card, timetable, and layout exactly
//   - Adds CA results card showing latest term grades, subject bars,
//     best/weakest subject callout, and a direct report card link
//   - Falls back gracefully when no CA records exist yet

import prisma from "@/src/lib/prisma";
import { currentUser } from "@clerk/nextjs/server";
import Announcements from "@/src/components/Announcements";
import EventCalendar from "@/src/components/EventCalendar";
import EventList from "@/src/components/EventList";
import BigCalendar from "@/src/components/BigCalendar";
import WelcomeBanner from "@/src/components/WelcomeBanner";
import type { CalendarLesson } from "@/src/components/BigCalendar";
import Link from "next/link";
import {
  CheckCircle2, XCircle, Clock, FileCheck,
  TrendingUp, FileText, Award, AlertCircle, BookOpen,
} from "lucide-react";
import { getGradeBandByGrade, computeAggregate, ordinal, TERM_LABELS } from "@/src/lib/caGrades";

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

  // ── Attendance stats ──────────────────────────────────────────────────────
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

  // ── CA records — latest term with data ────────────────────────────────────
  const allCA = await prisma.continuousAssessment.findMany({
    where:   { studentId: user!.id },
    include: { subject: { select: { name: true } } },
    orderBy: [{ academicYear: "desc" }, { term: "desc" }],
  });

  // Pick the most recent term group
  const latestCA = (() => {
    if (allCA.length === 0) return null;
    const first   = allCA[0];
    const records = allCA.filter(
      (r) => r.term === first.term && r.academicYear === first.academicYear
    );
    return { term: first.term, year: first.academicYear, records };
  })();

  // Compute aggregate + avg for latest term
  const gradePoints = latestCA?.records.map((r) => r.gradePoint) ?? [];
  const totalScores = latestCA?.records.map((r) => r.totalScore) ?? [];
  const aggregate   = gradePoints.length > 0 ? computeAggregate(gradePoints) : 0;
  const avgScore    = totalScores.length > 0
    ? Math.round((totalScores.reduce((a, b) => a + b, 0) / totalScores.length) * 10) / 10
    : 0;

  // Class position
  let myPosition = 0;
  if (latestCA && student?.classId) {
    const classmatesCA = await prisma.continuousAssessment.findMany({
      where: {
        classId:      student.classId,
        term:         latestCA.term as any,
        academicYear: latestCA.year,
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
    myPosition = sorted.findIndex((s) => s.sid === user!.id) + 1;
  }

  // Best and weakest subject
  const sortedByGP  = latestCA ? [...latestCA.records].sort((a, b) => a.gradePoint - b.gradePoint) : [];
  const bestSubject  = sortedByGP[0] ?? null;
  const weakSubject  = sortedByGP[sortedByGP.length - 1] ?? null;

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

        {/* ── CA RESULTS CARD ── */}
        {latestCA ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-violet-50 rounded-xl flex items-center justify-center">
                  <TrendingUp size={15} className="text-violet-600" />
                </div>
                <div>
                  <p className="text-sm font-black text-gray-800">My CA Results</p>
                  <p className="text-[10px] text-gray-400 font-medium">
                    {TERM_LABELS[latestCA.term]} · {latestCA.year}
                  </p>
                </div>
              </div>
              <Link
                href={`/list/report-cards/${user!.id}?term=${latestCA.term}&year=${latestCA.year}&classId=${student?.classId}`}
                className="flex items-center gap-1.5 px-3 py-2 bg-violet-600 text-white rounded-xl text-xs font-bold hover:bg-violet-700 transition-colors"
              >
                <FileText size={12} /> View Report Card
              </Link>
            </div>

            {/* Key stats */}
            <div className="grid grid-cols-3 divide-x divide-gray-100">
              {[
                { label: "Average",   value: `${avgScore}%`,                                    color: "text-indigo-700"  },
                { label: "Aggregate", value: aggregate,                                          color: "text-amber-600"   },
                { label: "Position",  value: myPosition > 0 ? ordinal(myPosition) : "—",        color: "text-violet-700"  },
              ].map((s) => (
                <div key={s.label} className="flex flex-col items-center py-4 gap-0.5">
                  <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Subject bars */}
            <div className="px-5 pb-4 flex flex-col gap-2">
              {latestCA.records.map((r) => {
                const band = getGradeBandByGrade(r.grade);
                return (
                  <div key={r.id} className="flex items-center gap-3">
                    <p className="text-xs font-semibold text-gray-600 w-32 shrink-0 truncate">
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

            {/* Best / weakest callout */}
            {bestSubject && weakSubject && bestSubject.id !== weakSubject.id && (
              <div className="grid grid-cols-2 gap-3 px-5 pb-5">
                <div className="flex items-start gap-2 p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                  <CheckCircle2 size={13} className="text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[10px] font-black text-emerald-700">Strongest</p>
                    <p className="text-xs font-bold text-emerald-800">{bestSubject.subject.name}</p>
                    <p className="text-[10px] text-emerald-600">
                      {bestSubject.grade} · {bestSubject.totalScore.toFixed(1)}%
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-xl border border-amber-100">
                  <AlertCircle size={13} className="text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[10px] font-black text-amber-700">Focus Area</p>
                    <p className="text-xs font-bold text-amber-800">{weakSubject.subject.name}</p>
                    <p className="text-[10px] text-amber-600">
                      {weakSubject.grade} · {weakSubject.totalScore.toFixed(1)}%
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex items-center gap-4">
            <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center shrink-0">
              <BookOpen size={18} className="text-gray-300" />
            </div>
            <div>
              <p className="text-sm font-black text-gray-400">No CA records yet</p>
              <p className="text-xs text-gray-300 mt-0.5">
                Your class teacher hasn&apos;t entered scores for this term yet.
              </p>
            </div>
          </div>
        )}

        {/* ── ATTENDANCE CARD (unchanged from original) ── */}
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
                <div className="flex items-center gap-1 mb-1 opacity-60">
                  {s.icon}
                  <span className="text-[9px] font-black uppercase">{s.label}</span>
                </div>
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

        {/* ── TIMETABLE (unchanged from original) ── */}
        <div className="bg-white p-5 rounded-2xl shadow-sm">
          <div className="mb-4">
            <h1 className="text-xl font-nunito font-extrabold text-gray-800">My Schedule</h1>
            <p className="text-sm text-gray-400 mt-0.5">
              Class {student?.class?.name ?? ""} — weekly timetable
            </p>
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