// src/app/(dashboard)/list/students/[id]/page.tsx
//
// feat: enhance student profile with CA academic history, report card access,
//       attendance breakdown, and subject performance — replacing raw Result.score
//       with ContinuousAssessment data as the primary academic source of truth

import prisma from "@/src/lib/prisma";
import { notFound } from "next/navigation";
import { requirePageSession } from "@/src/lib/authz";
import Announcements from "@/src/components/Announcements";
import BigCalendar from "@/src/components/BigCalendar";
import Image from "next/image";
import Link from "next/link";
import type { CalendarLesson } from "@/src/components/BigCalendar";
import {
  Mail, Phone, Droplets, Calendar,
  BookOpen, Users, Clock, Award,
  FileText, TrendingUp, CheckCircle2,
  AlertCircle, ChevronRight, Star,
} from "lucide-react";
import { getGradeBandByGrade, computeAggregate, ordinal, TERM_LABELS } from "@/src/lib/caGrades";
import type { Term } from "@/src/generated/prisma";

const SingleStudentPage = async ({
  params,
}: {
  params: Promise<{ id: string }>;
}) => {
  const { id }   = await params;
  const { role, schoolId } = await requirePageSession();

  const student = await prisma.student.findFirst({
    where:   { id, schoolId },
    include: {
      class: {
        include: {
          grade:   { select: { level: true } },
          supervisor: { select: { name: true, surname: true } },
          lessons: {
            include: {
              subject: { select: { name: true } },
              teacher: { select: { name: true, surname: true } },
            },
            orderBy: [{ day: "asc" }, { startTime: "asc" }],
          },
        },
      },
      parent:  { select: { name: true, surname: true, phone: true, email: true } },
      results: { include: { exam: true, assignment: true } },
      attendances: { orderBy: { date: "desc" } },
    },
  });

  if (!student) notFound();

  // ── Calendar lessons ───────────────────────────────────────────────────────
  const calendarLessons: CalendarLesson[] = student.class.lessons.map((l) => ({
    title:     l.subject.name,
    day:       l.day,
    startTime: l.startTime,
    endTime:   l.endTime,
    teacher:   `${l.teacher.name} ${l.teacher.surname}`,
  }));

  // ── Attendance stats ───────────────────────────────────────────────────────
  const totalAttendance = student.attendances.length;
  const presentCount    = student.attendances.filter((a) => a.status === "PRESENT").length;
  const absentCount     = student.attendances.filter((a) => a.status === "ABSENT").length;
  const lateCount       = student.attendances.filter((a) => a.status === "LATE").length;
  const excusedCount    = student.attendances.filter((a) => a.status === "EXCUSED").length;
  const attendancePct   = totalAttendance > 0
    ? Math.round((presentCount / totalAttendance) * 100)
    : 0;

  const uniqueSubjectsCount = new Set(student.class.lessons.map((l) => l.subject.name)).size;
  const enrolYear           = new Date(student.createdAt).getFullYear();

  // ── CA records — all terms ─────────────────────────────────────────────────
  const allCA = await prisma.continuousAssessment.findMany({
    where:   { schoolId, studentId: id },
    include: { subject: { select: { name: true } } },
    orderBy: [{ academicYear: "desc" }, { term: "desc" }],
  });

  // Group by term + year
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

  const latestGroup = termGroups[0] ?? null;

  // Class position for latest term
  let myPosition = 0;
  let classSize  = 0;
  if (latestGroup) {
    const classmatesCA = await prisma.continuousAssessment.findMany({
      where: {
        schoolId,
        classId:      student.classId,
        term:         latestGroup.term as Term,
        academicYear: latestGroup.year,
      },
      select: { studentId: true, gradePoint: true },
    });
    classSize = await prisma.student.count({ where: { schoolId, classId: student.classId } });

    const gpMap: Record<string, number[]> = {};
    for (const r of classmatesCA) {
      if (!gpMap[r.studentId]) gpMap[r.studentId] = [];
      gpMap[r.studentId].push(r.gradePoint);
    }
    const sorted = Object.entries(gpMap)
      .map(([sid, gps]) => ({ sid, agg: computeAggregate(gps) }))
      .sort((a, b) => a.agg - b.agg);
    myPosition = sorted.findIndex((s) => s.sid === id) + 1;
  }

  // Best / weakest in latest term
  const sortedByGP  = latestGroup ? [...latestGroup.records].sort((a, b) => a.gradePoint - b.gradePoint) : [];
  const bestSubject = sortedByGP[0] ?? null;
  const weakSubject = sortedByGP[sortedByGP.length - 1] ?? null;

  // CA avg score to replace old avgScore
  const caAvgScore = latestGroup
    ? latestGroup.avgScore
    : student.results.length > 0
      ? parseFloat((student.results.map((r) => r.score).reduce((a, b) => a + b, 0) / student.results.length).toFixed(1))
      : 0;

  return (
    <div className="flex-1 p-4 flex flex-col gap-4 xl:flex-row">

      {/* ── LEFT ── */}
      <div className="w-full xl:w-2/3 flex flex-col gap-4">

        {/* ── Hero card ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="h-24 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-600 relative">
            <div className="absolute inset-0 opacity-20"
              style={{
                backgroundImage: "radial-gradient(circle at 20% 50%, white 1px, transparent 1px)",
                backgroundSize: "40px 40px",
              }}
            />
          </div>

          <div className="px-5 pb-5">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 -mt-10 sm:-mt-12 mb-4">
              <div className="flex flex-col sm:flex-row items-center sm:items-end gap-4">
                <div className="relative shrink-0">
                  <Image
                    src={student.img || "/noAvatar.png"}
                    alt={student.name}
                    width={96} height={96}
                    className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl object-cover ring-4 ring-white shadow-md bg-white"
                  />
                  <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-400 rounded-full border-2 border-white" />
                </div>
                <div className="mb-1 text-center sm:text-left">
                  <h1 className="text-xl font-black text-gray-800 tracking-tight">
                    {student.name} {student.surname}
                  </h1>
                  <p className="text-sm text-emerald-600 font-semibold">
                    {student.class.grade.level} · {student.class.name}
                  </p>
                  {student.class.supervisor && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      Class Teacher: {student.class.supervisor.name} {student.class.supervisor.surname}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex justify-center sm:justify-start gap-2 shrink-0 flex-wrap">
                {latestGroup && (
                  <Link
                    href={`/list/report-cards/${student.id}?term=${latestGroup.term}&year=${latestGroup.year}&classId=${student.classId}`}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 text-white text-xs font-bold hover:bg-violet-700 transition-all shadow-sm"
                  >
                    <FileText size={13} /> View Report Card
                  </Link>
                )}
                {student.parent && (
                  <a
                    href={`tel:${student.parent.phone}`}
                    className="px-4 py-2 rounded-xl bg-gray-100 text-gray-600 text-xs font-bold hover:bg-gray-200 transition-all"
                  >
                    Contact Parent
                  </a>
                )}
              </div>
            </div>

            {/* Info pills */}
            <div className="flex flex-wrap justify-center sm:justify-start gap-2.5">
              {[
                { icon: <Droplets size={13} />, label: student.bloodType },
                { icon: <Calendar size={13} />, label: `Enrolled: ${enrolYear}` },
                { icon: <Users    size={13} />, label: student.sex === "MALE" ? "Male" : "Female" },
                ...(student.email ? [{ icon: <Mail  size={13} />, label: student.email }] : []),
                ...(student.phone ? [{ icon: <Phone size={13} />, label: student.phone }] : []),
              ].map(({ icon, label }) => (
                <div key={label} className="flex items-center gap-1.5 bg-gray-100 rounded-full px-3 py-1.5 text-xs font-medium text-gray-600">
                  <span className="text-emerald-500">{icon}</span>
                  {label}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Stats row ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { icon: <Clock    size={16} />, value: `${attendancePct}%`,  label: "Attendance",   color: `${attendancePct >= 80 ? "bg-emerald-50 text-emerald-600" : attendancePct >= 60 ? "bg-amber-50 text-amber-600" : "bg-rose-50 text-rose-600"}` },
            { icon: <BookOpen size={16} />, value: uniqueSubjectsCount,  label: "Subjects",     color: "bg-blue-50 text-blue-600"    },
            { icon: <Users    size={16} />, value: myPosition > 0 ? ordinal(myPosition) : "—", label: "Position", color: "bg-violet-50 text-violet-600" },
            { icon: <Award    size={16} />, value: latestGroup ? `${caAvgScore}%` : "—",        label: "CA Avg",   color: "bg-amber-50 text-amber-600"  },
          ].map((stat) => (
            <div key={stat.label} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${stat.color}`}>
                {stat.icon}
              </div>
              <div>
                <p className="text-xl font-black text-gray-800 leading-none truncate">{stat.value}</p>
                <p className="text-xs text-gray-400 font-medium mt-0.5">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── Latest CA Performance ── */}
        {latestGroup ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-violet-50 rounded-xl flex items-center justify-center">
                  <TrendingUp size={14} className="text-violet-600" />
                </div>
                <div>
                  <p className="text-sm font-black text-gray-800">CA Performance</p>
                  <p className="text-[10px] text-gray-400 font-medium">
                    {TERM_LABELS[latestGroup.term]} · {latestGroup.year} · Aggregate {latestGroup.aggregate} · {myPosition > 0 ? ordinal(myPosition) : "—"} of {classSize}
                  </p>
                </div>
              </div>
              <Link
                href={`/list/report-cards/${student.id}?term=${latestGroup.term}&year=${latestGroup.year}&classId=${student.classId}`}
                className="flex items-center gap-1 text-xs font-bold text-violet-600 hover:text-violet-700"
              >
                Full Report <ChevronRight size={13} />
              </Link>
            </div>

            {/* Subject bars */}
            <div className="px-5 py-4 flex flex-col gap-2.5">
              {latestGroup.records.map((r) => {
                const band = getGradeBandByGrade(r.grade);
                return (
                  <div key={r.id} className="flex items-center gap-3">
                    <p className="text-xs font-semibold text-gray-600 w-32 shrink-0 truncate">{r.subject.name}</p>
                    <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${band.bar}`} style={{ width: `${r.totalScore}%` }} />
                    </div>
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg border w-10 text-center ${band.bg} ${band.color} ${band.border}`}>
                      {r.grade}
                    </span>
                    <span className="text-[10px] text-gray-400 w-10 text-right">{r.totalScore.toFixed(1)}%</span>
                  </div>
                );
              })}
            </div>

            {/* Best / weakest */}
            {bestSubject && weakSubject && bestSubject.id !== weakSubject.id && (
              <div className="grid grid-cols-2 gap-3 px-5 pb-5">
                <div className="flex items-start gap-2 p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                  <Star size={12} className="text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[10px] font-black text-emerald-700">Strongest Subject</p>
                    <p className="text-xs font-bold text-emerald-800">{bestSubject.subject.name}</p>
                    <p className="text-[10px] text-emerald-600">{bestSubject.grade} · {bestSubject.totalScore.toFixed(1)}%</p>
                  </div>
                </div>
                <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-xl border border-amber-100">
                  <AlertCircle size={12} className="text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[10px] font-black text-amber-700">Needs Attention</p>
                    <p className="text-xs font-bold text-amber-800">{weakSubject.subject.name}</p>
                    <p className="text-[10px] text-amber-600">{weakSubject.grade} · {weakSubject.totalScore.toFixed(1)}%</p>
                  </div>
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
              <p className="text-xs text-gray-300 mt-0.5">Class teacher has not entered scores for this term.</p>
            </div>
            {(role === "admin" || role === "teacher") && (
              <Link href="/list/ca" className="ml-auto text-xs font-bold text-indigo-500 hover:text-indigo-700 shrink-0">
                Enter CA →
              </Link>
            )}
          </div>
        )}

        {/* ── All terms history ── */}
        {termGroups.length > 1 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-gray-100">
              <p className="text-xs font-black uppercase tracking-wider text-gray-400">Academic History</p>
            </div>
            <div className="divide-y divide-gray-50">
              {termGroups.map((g) => {
                const topGrade = g.records.sort((a, b) => a.gradePoint - b.gradePoint)[0]?.grade ?? "F9";
                const band     = getGradeBandByGrade(topGrade);
                return (
                  <div key={`${g.year}${g.term}`} className="flex items-center gap-4 px-5 py-3.5">
                    <div className="flex-1">
                      <p className="text-sm font-bold text-gray-800">{TERM_LABELS[g.term]} · {g.year}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        {g.records.length} subject{g.records.length !== 1 ? "s" : ""} · avg {g.avgScore}% · agg {g.aggregate}
                      </p>
                    </div>
                    <span className={`text-xs font-black px-2.5 py-1 rounded-lg border ${band.bg} ${band.color} ${band.border}`}>
                      {topGrade}
                    </span>
                    <Link
                      href={`/list/report-cards/${student.id}?term=${g.term}&year=${g.year}&classId=${student.classId}`}
                      className="flex items-center gap-1 text-xs font-bold text-violet-500 hover:text-violet-700"
                    >
                      Report <ChevronRight size={12} />
                    </Link>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Attendance breakdown ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-black text-gray-800">Attendance Record</h2>
            <Link href={`/list/attendance?studentId=${student.id}`} className="text-xs font-bold text-emerald-600 hover:text-emerald-700">
              Full history →
            </Link>
          </div>
          <div className="grid grid-cols-4 gap-2 mb-3">
            {[
              { label: "Present", value: presentCount, color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
              { label: "Absent",  value: absentCount,  color: "bg-rose-50 text-rose-700 border-rose-200"         },
              { label: "Late",    value: lateCount,    color: "bg-amber-50 text-amber-700 border-amber-200"       },
              { label: "Excused", value: excusedCount, color: "bg-indigo-50 text-indigo-700 border-indigo-200"    },
            ].map((s) => (
              <div key={s.label} className={`rounded-xl p-3 border ${s.color} text-center`}>
                <p className="text-xl font-black leading-none">{s.value}</p>
                <p className="text-[9px] font-black uppercase mt-1 opacity-60">{s.label}</p>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden flex">
              <div className="bg-emerald-500 h-full" style={{ width: `${(presentCount / Math.max(totalAttendance, 1)) * 100}%` }} />
              <div className="bg-amber-400 h-full"   style={{ width: `${(lateCount    / Math.max(totalAttendance, 1)) * 100}%` }} />
              <div className="bg-rose-400 h-full"    style={{ width: `${(absentCount  / Math.max(totalAttendance, 1)) * 100}%` }} />
            </div>
            <span className={`text-xs font-black ${attendancePct >= 80 ? "text-emerald-600" : attendancePct >= 60 ? "text-amber-600" : "text-rose-600"}`}>
              {attendancePct}%
            </span>
          </div>
        </div>

        {/* ── Timetable ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex-1 min-h-[400px]">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-4">
            <div>
              <h2 className="text-base font-black text-gray-800">Student Timetable</h2>
              <p className="text-xs text-gray-400 mt-0.5">{student.class.name} — weekly schedule</p>
            </div>
            <span className="text-xs font-semibold bg-emerald-50 text-emerald-600 px-3 py-1.5 rounded-full">
              {latestGroup ? `${TERM_LABELS[latestGroup.term]} · ${latestGroup.year}` : "Current Term"}
            </span>
          </div>
          <BigCalendar lessons={calendarLessons} viewAs="student" />
        </div>
      </div>

      {/* ── RIGHT ── */}
      <div className="w-full xl:w-1/3 flex flex-col gap-4">

        {/* Quick access */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-black text-gray-800">Quick Access</h2>
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Shortcuts</span>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            {[
              { label: "Report Card",  href: latestGroup ? `/list/report-cards/${student.id}?term=${latestGroup.term}&year=${latestGroup.year}&classId=${student.classId}` : "/list/report-cards", color: "bg-violet-50 text-violet-600 hover:bg-violet-100", icon: "📄" },
              { label: "CA Entry",     href: `/list/ca?classId=${student.classId}`,            color: "bg-indigo-50 text-indigo-600 hover:bg-indigo-100",   icon: "📝" },
              { label: "Results",      href: `/list/results?studentId=${student.id}`,          color: "bg-sky-50 text-sky-600 hover:bg-sky-100",           icon: "📊" },
              { label: "Attendance",   href: `/list/attendance?studentId=${student.id}`,       color: "bg-emerald-50 text-emerald-600 hover:bg-emerald-100", icon: "✅" },
              { label: "Lessons",      href: `/list/lessons?classId=${student.classId}`,       color: "bg-amber-50 text-amber-600 hover:bg-amber-100",     icon: "📚" },
              { label: "Teachers",     href: `/list/teachers?classId=${student.classId}`,      color: "bg-rose-50 text-rose-600 hover:bg-rose-100",        icon: "👨‍🏫" },
            ].map(({ label, href, color, icon }) => (
              <Link key={label} href={href}
                className={`flex items-center gap-2.5 px-3 py-3 rounded-xl text-xs font-bold transition-all hover:translate-x-1 ${color}`}
              >
                <span className="text-base leading-none">{icon}</span>
                {label}
              </Link>
            ))}
          </div>
        </div>

        {/* Parent info */}
        {student.parent && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h2 className="text-base font-black text-gray-800 mb-3">Parent / Guardian</h2>
            <div className="flex flex-col gap-2">
              <p className="text-sm font-bold text-gray-700">
                {student.parent.name} {student.parent.surname}
              </p>
              {student.parent.email && (
                <a href={`mailto:${student.parent.email}`} className="flex items-center gap-2 text-xs text-gray-500 hover:text-indigo-600">
                  <Mail size={12} className="text-gray-400" /> {student.parent.email}
                </a>
              )}
              {student.parent.phone && (
                <a href={`tel:${student.parent.phone}`} className="flex items-center gap-2 text-xs text-gray-500 hover:text-emerald-600">
                  <Phone size={12} className="text-gray-400" /> {student.parent.phone}
                </a>
              )}
            </div>
          </div>
        )}

        {/* Mini term chart */}
        {termGroups.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <p className="text-xs font-black uppercase tracking-wider text-gray-400 mb-4">Term Progress</p>
            <div className="flex items-end gap-2 h-16">
              {termGroups.slice().reverse().map((g, i) => {
                const isLatest = i === termGroups.length - 1;
                const topGrade = g.records.sort((a, b) => a.gradePoint - b.gradePoint)[0]?.grade ?? "F9";
                const band     = getGradeBandByGrade(topGrade);
                const barH     = Math.max((g.avgScore / 100) * 100, 8);
                return (
                  <Link
                    key={`${g.year}${g.term}`}
                    href={`/list/report-cards/${student.id}?term=${g.term}&year=${g.year}&classId=${student.classId}`}
                    className="flex flex-col items-center gap-1 flex-1 group"
                  >
                    <span className="text-[9px] font-black text-gray-400 group-hover:text-indigo-500">
                      {g.avgScore}%
                    </span>
                    <div
                      className={`w-full rounded-t-lg transition-all group-hover:opacity-80 ${isLatest ? band.bar : "bg-gray-200"}`}
                      style={{ height: `${barH * 0.44}px` }}
                    />
                    <span className="text-[8px] font-bold text-gray-400 text-center leading-tight">
                      {TERM_LABELS[g.term]?.replace("Term ", "T")}{"\n"}{g.year.slice(-2)}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        <Announcements />
      </div>
    </div>
  );
};

export default SingleStudentPage;
