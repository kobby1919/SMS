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
  FileText, TrendingUp,
  AlertCircle, ChevronRight, Star,
  WalletCards, History, Link2,
} from "lucide-react";
import { getGradeBandByGrade, computeAggregate, ordinal, TERM_LABELS } from "@/src/lib/caGrades";
import { StudentStatus, type Term } from "@/src/generated/prisma";
import { listLiveTimetableLessons } from "@/src/lib/services/timetable";
import { formatGHS } from "@/src/lib/constants/finance";

const STUDENT_STATUS_LABELS = {
  INCOMPLETE_SETUP: "Incomplete setup",
  ACTIVE: "Active",
  TRANSFERRED: "Transferred",
  GRADUATED: "Graduated",
  WITHDRAWN: "Withdrawn",
} as const;

const STUDENT_STATUS_DOTS = {
  INCOMPLETE_SETUP: "bg-amber-400",
  ACTIVE: "bg-emerald-400",
  TRANSFERRED: "bg-sky-400",
  GRADUATED: "bg-violet-400",
  WITHDRAWN: "bg-rose-400",
} as const;

const BILL_STATUS_LABELS = {
  UNPAID: "Unpaid",
  PARTIAL: "Part paid",
  PAID: "Paid",
  OVERPAID: "Overpaid",
  WAIVED: "Waived",
} as const;

const ACTIVITY_TYPE_COLORS = {
  ATTENDANCE: "bg-emerald-50 text-emerald-700 border-emerald-100",
  ACADEMIC: "bg-violet-50 text-violet-700 border-violet-100",
  ASSIGNMENT: "bg-amber-50 text-amber-700 border-amber-100",
  BILL: "bg-sky-50 text-sky-700 border-sky-100",
  PAYMENT: "bg-emerald-50 text-emerald-700 border-emerald-100",
  ANNOUNCEMENT: "bg-indigo-50 text-indigo-700 border-indigo-100",
  NOTICE: "bg-slate-50 text-slate-700 border-slate-100",
  MESSAGE: "bg-cyan-50 text-cyan-700 border-cyan-100",
  REPORT: "bg-violet-50 text-violet-700 border-violet-100",
  HOMEWORK: "bg-amber-50 text-amber-700 border-amber-100",
  GENERAL: "bg-gray-50 text-gray-600 border-gray-100",
} as const;

function activityTypeColor(type: string) {
  return ACTIVITY_TYPE_COLORS[type as keyof typeof ACTIVITY_TYPE_COLORS] ?? ACTIVITY_TYPE_COLORS.GENERAL;
}

function formatDate(value?: Date | null) {
  if (!value) return "Not set";
  return value.toLocaleDateString("en-GH", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function shortDateTime(value: Date) {
  return value.toLocaleString("en-GH", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const SingleStudentPage = async ({
  params,
}: {
  params: Promise<{ id: string }>;
}) => {
  const { id }   = await params;
  const { userId, role, schoolId } = await requirePageSession();

  const student = await prisma.student.findFirst({
    where:   { id, schoolId },
    include: {
      class: {
        include: {
          grade:   { select: { level: true } },
          supervisor: { select: { name: true, surname: true } },
        },
      },
      parent:  { select: { name: true, surname: true, phone: true, email: true } },
      attendances: { orderBy: { date: "desc" } },
    },
  });

  if (!student) notFound();
  const liveLessons = await listLiveTimetableLessons(schoolId, { classId: student.classId });

  const isClassTeacherForStudent =
    role === "teacher" && student.class.supervisorId === userId;
  const teachesStudentClass =
    role === "teacher" && liveLessons.some((lesson) => lesson.teacherId === userId);

  if (
    role === "teacher" &&
    (student.status !== StudentStatus.ACTIVE || (!isClassTeacherForStudent && !teachesStudentClass))
  ) {
    notFound();
  }
  const canViewParentContact = role === "admin" || isClassTeacherForStudent;
  const canViewFinance = role === "admin" || role === "bursar";

  // ── Calendar lessons ───────────────────────────────────────────────────────
  const calendarLessons: CalendarLesson[] = liveLessons.map((l) => ({
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

  const uniqueSubjectsCount = new Set(liveLessons.map((l) => l.subject.name)).size;
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
        student:      { status: StudentStatus.ACTIVE },
      },
      select: { studentId: true, gradePoint: true },
    });
    classSize = await prisma.student.count({
      where: { schoolId, classId: student.classId, status: StudentStatus.ACTIVE },
    });

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

  const [studentBills, recentActivity, parentLinks] = await Promise.all([
    canViewFinance
      ? prisma.studentBill.findMany({
          where: { schoolId, studentId: id },
          select: {
            id: true,
            totalAmount: true,
            amountPaid: true,
            discountAmount: true,
            balance: true,
            status: true,
            dueDate: true,
            createdAt: true,
            feeStructure: { select: { title: true, term: true, academicYear: true } },
            payments: {
              where: { status: "CONFIRMED" },
              select: { id: true, amount: true, receiptNumber: true, paymentDate: true },
              orderBy: { paymentDate: "desc" },
              take: 1,
            },
          },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: 5,
        })
      : Promise.resolve([]),
    prisma.parentActivityEvent.findMany({
      where: {
        schoolId,
        studentId: id,
        ...(canViewFinance ? {} : { type: { notIn: ["BILL", "PAYMENT"] } }),
      },
      select: {
        id: true,
        type: true,
        title: true,
        body: true,
        occurredAt: true,
        sourceModel: true,
      },
      orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
      take: 6,
    }),
    canViewParentContact
      ? prisma.parentStudentRelationship.findMany({
          where: { schoolId, studentId: id },
          select: {
            id: true,
            status: true,
            role: true,
            canViewFees: true,
            canViewReports: true,
            canMessageSchool: true,
            note: true,
            parent: { select: { name: true, surname: true, email: true, phone: true } },
          },
          orderBy: [{ status: "asc" }, { role: "asc" }],
        })
      : Promise.resolve([]),
  ]);

  const totalBilled = studentBills.reduce((sum, bill) => sum + Number(bill.totalAmount), 0);
  const totalPaid = studentBills.reduce((sum, bill) => sum + Number(bill.amountPaid), 0);
  const totalDiscount = studentBills.reduce((sum, bill) => sum + Number(bill.discountAmount), 0);
  const totalBalance = studentBills.reduce((sum, bill) => sum + Number(bill.balance), 0);
  const openBills = studentBills.filter((bill) => Number(bill.balance) > 0 && bill.status !== "WAIVED").length;
  const latestBill = studentBills[0] ?? null;
  const latestPayment = studentBills.flatMap((bill) => bill.payments)[0] ?? null;
  const attendanceConcern =
    totalAttendance === 0
      ? "No attendance yet"
      : attendancePct >= 80
        ? "Healthy"
        : attendancePct >= 60
          ? "Watch closely"
          : "Needs attention";

  return (
    <div className="flex-1 p-3 sm:p-4 flex flex-col gap-4 xl:flex-row">

      {/* ── LEFT ── */}
      <div className="w-full xl:w-2/3 flex flex-col gap-4">

        {/* ── Hero card ── */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 sm:p-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
                <div className="relative shrink-0">
                  <Image
                    src={student.img || "/noAvatar.png"}
                    alt={student.name}
                    width={96} height={96}
                    className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl object-cover ring-2 ring-gray-100 bg-white"
                  />
                  <span className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white ${STUDENT_STATUS_DOTS[student.status]}`} />
                </div>
                <div className="text-center sm:text-left">
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
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-violet-600 text-white text-xs font-bold hover:bg-violet-700 transition-all shadow-sm"
                  >
                    <FileText size={13} /> View Report Card
                  </Link>
                )}
                {student.parent && canViewParentContact && student.parent.phone && (
                  <a
                    href={`tel:${student.parent.phone}`}
                    className="px-3 py-2 rounded-lg bg-gray-100 text-gray-600 text-xs font-bold hover:bg-gray-200 transition-all"
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
                { icon: <FileText size={13} />, label: `Admission: ${student.admissionNumber ?? student.username}` },
                { icon: <AlertCircle size={13} />, label: STUDENT_STATUS_LABELS[student.status] },
                { icon: <Calendar size={13} />, label: `Enrolled: ${enrolYear}` },
                { icon: <Users    size={13} />, label: student.sex === "MALE" ? "Male" : "Female" },
                ...(student.email ? [{ icon: <Mail  size={13} />, label: student.email }] : []),
                ...(student.phone ? [{ icon: <Phone size={13} />, label: student.phone }] : []),
              ].map(({ icon, label }) => (
                <div key={label} className="flex max-w-full items-center gap-1.5 rounded-lg bg-gray-100 px-2.5 py-1.5 text-xs font-medium text-gray-600">
                  <span className="text-emerald-500">{icon}</span>
                  <span className="break-words">{label}</span>
                </div>
              ))}
            </div>
        </div>

        {/* ── Stats row ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { icon: <Clock    size={16} />, value: `${attendancePct}%`,  label: "Attendance",   color: `${attendancePct >= 80 ? "bg-emerald-50 text-emerald-600" : attendancePct >= 60 ? "bg-amber-50 text-amber-600" : "bg-rose-50 text-rose-600"}` },
            { icon: <BookOpen size={16} />, value: uniqueSubjectsCount,  label: "Subjects",     color: "bg-blue-50 text-blue-600"    },
            { icon: <Users    size={16} />, value: myPosition > 0 ? ordinal(myPosition) : "—", label: "Position", color: "bg-violet-50 text-violet-600" },
            { icon: <Award    size={16} />, value: latestGroup ? `${latestGroup.avgScore}%` : "—",        label: "CA Avg",   color: "bg-amber-50 text-amber-600"  },
          ].map((stat) => (
            <div key={stat.label} className="bg-white rounded-xl p-3 border border-gray-100 shadow-sm flex items-center gap-3">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${stat.color}`}>
                {stat.icon}
              </div>
              <div>
                <p className="text-xl font-black text-gray-800 leading-none truncate">{stat.value}</p>
                <p className="text-xs text-gray-400 font-medium mt-0.5">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Finance snapshot */}
        {canViewFinance && (
          <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                  <WalletCards size={16} />
                </div>
                <div>
                  <h2 className="text-sm font-black text-gray-800">Finance Snapshot</h2>
                  <p className="text-xs font-semibold text-gray-400">
                    Bills, payments, and outstanding balance for this student.
                  </p>
                </div>
              </div>
              <Link
                href={`/list/finance/bills?search=${encodeURIComponent(student.admissionNumber ?? student.username)}`}
                className="inline-flex items-center gap-1 text-xs font-black text-emerald-600 hover:text-emerald-700"
              >
                Open bills <ChevronRight size={13} />
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
              {[
                { label: "Billed", value: formatGHS(totalBilled), color: "bg-slate-50 text-slate-700" },
                { label: "Paid", value: formatGHS(totalPaid), color: "bg-emerald-50 text-emerald-700" },
                { label: "Discount", value: formatGHS(totalDiscount), color: "bg-sky-50 text-sky-700" },
                { label: "Balance", value: formatGHS(totalBalance), color: totalBalance > 0 ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700" },
              ].map((item) => (
                <div key={item.label} className={`rounded-lg px-3 py-3 ${item.color}`}>
                  <p className="truncate text-sm font-black">{item.value}</p>
                  <p className="mt-1 text-[10px] font-black uppercase opacity-60">{item.label}</p>
                </div>
              ))}
            </div>

            <div className="mt-4 grid gap-2">
              {studentBills.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-200 p-4 text-center">
                  <p className="text-sm font-black text-gray-500">No bills recorded yet.</p>
                  <p className="mt-1 text-xs font-semibold text-gray-400">Finance records will appear here after bills are generated.</p>
                </div>
              ) : (
                <>
                  <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-xs font-black text-gray-800">
                          Latest bill: {latestBill?.feeStructure.title ?? "No title"}
                        </p>
                        <p className="mt-0.5 text-[11px] font-semibold text-gray-400">
                          {latestBill ? `${BILL_STATUS_LABELS[latestBill.status]} · Due ${formatDate(latestBill.dueDate)}` : "No current bill"}
                        </p>
                      </div>
                      <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${openBills > 0 ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"}`}>
                        {openBills} open bill{openBills === 1 ? "" : "s"}
                      </span>
                    </div>
                  </div>
                  <div className="rounded-xl border border-gray-100 p-3">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-xs font-black text-gray-800">Latest confirmed payment</p>
                      <p className="text-xs font-bold text-gray-500">
                        {latestPayment
                          ? `${formatGHS(Number(latestPayment.amount))} · ${latestPayment.receiptNumber} · ${formatDate(latestPayment.paymentDate)}`
                          : "No confirmed payment yet"}
                      </p>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* ── Academic / report snapshot ── */}
        {latestGroup ? (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex flex-col gap-3 px-4 py-4 border-b border-gray-100 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-violet-50 rounded-lg flex items-center justify-center">
                  <TrendingUp size={14} className="text-violet-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-black text-gray-800">Academic / Report Snapshot</p>
                  <p className="text-[10px] text-gray-400 font-medium">
                    {TERM_LABELS[latestGroup.term]} · {latestGroup.year} · Aggregate {latestGroup.aggregate} · {myPosition > 0 ? ordinal(myPosition) : "—"} of {classSize}
                  </p>
                </div>
              </div>
              <Link
                href={`/list/report-cards/${student.id}?term=${latestGroup.term}&year=${latestGroup.year}&classId=${student.classId}`}
                className="inline-flex items-center gap-1 text-xs font-bold text-violet-600 hover:text-violet-700"
              >
                Full Report <ChevronRight size={13} />
              </Link>
            </div>

            {/* Subject bars */}
            <div className="px-4 py-4 flex flex-col gap-3">
              {latestGroup.records.map((r) => {
                const band = getGradeBandByGrade(r.grade);
                return (
                  <div key={r.id} className="grid gap-1.5 sm:grid-cols-[8rem_1fr_auto_auto] sm:items-center sm:gap-3">
                    <p className="min-w-0 break-words text-xs font-semibold text-gray-600">{r.subject.name}</p>
                    <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${band.bar}`} style={{ width: `${Math.min(Math.max(r.totalScore, 0), 100)}%` }} />
                    </div>
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg border w-10 text-center ${band.bg} ${band.color} ${band.border}`}>
                      {r.grade}
                    </span>
                    <span className="text-[10px] text-gray-400 sm:w-10 sm:text-right">{r.totalScore.toFixed(1)}%</span>
                  </div>
                );
              })}
            </div>

            {/* Best / weakest */}
            {bestSubject && weakSubject && bestSubject.id !== weakSubject.id && (
              <div className="grid grid-cols-1 gap-2 px-4 pb-4 sm:grid-cols-2">
                <div className="flex items-start gap-2 p-3 bg-emerald-50 rounded-lg border border-emerald-100">
                  <Star size={12} className="text-emerald-600 shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-[10px] font-black text-emerald-700">Strongest Subject</p>
                    <p className="break-words text-xs font-bold text-emerald-800">{bestSubject.subject.name}</p>
                    <p className="text-[10px] text-emerald-600">{bestSubject.grade} · {bestSubject.totalScore.toFixed(1)}%</p>
                  </div>
                </div>
                <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-lg border border-amber-100">
                  <AlertCircle size={12} className="text-amber-500 shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-[10px] font-black text-amber-700">Needs Attention</p>
                    <p className="break-words text-xs font-bold text-amber-800">{weakSubject.subject.name}</p>
                    <p className="text-[10px] text-amber-600">{weakSubject.grade} · {weakSubject.totalScore.toFixed(1)}%</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="w-9 h-9 bg-gray-50 rounded-lg flex items-center justify-center shrink-0">
              <BookOpen size={16} className="text-gray-300" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-black text-gray-400">No CA records yet</p>
              <p className="text-xs text-gray-300 mt-0.5">Class teacher has not entered scores for this term.</p>
            </div>
            {(role === "admin" || role === "teacher") && (
              <Link href={`/list/ca?classId=${student.classId}`} className="text-xs font-bold text-indigo-500 hover:text-indigo-700 shrink-0">
                Enter CA →
              </Link>
            )}
          </div>
        )}

        {/* ── All terms history ── */}
        {termGroups.length > 1 && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-4 py-3.5 border-b border-gray-100">
              <p className="text-xs font-black uppercase tracking-wider text-gray-400">Academic History</p>
            </div>
            <div className="divide-y divide-gray-50">
              {termGroups.map((g) => {
                const topGrade = [...g.records].sort((a, b) => a.gradePoint - b.gradePoint)[0]?.grade ?? "F9";
                const band     = getGradeBandByGrade(topGrade);
                return (
                  <div key={`${g.year}${g.term}`} className="flex flex-col gap-2 px-4 py-3.5 sm:flex-row sm:items-center sm:gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-gray-800">{TERM_LABELS[g.term]} · {g.year}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        {g.records.length} subject{g.records.length !== 1 ? "s" : ""} · avg {g.avgScore}% · agg {g.aggregate}
                      </p>
                    </div>
                    <span className={`text-xs font-black px-2.5 py-1 rounded-lg border ${band.bg} ${band.color} ${band.border}`}>
                      {topGrade}
                    </span>
                    <Link href={`/list/report-cards/${student.id}?term=${g.term}&year=${g.year}&classId=${student.classId}`} className="inline-flex items-center gap-1 text-xs font-bold text-violet-500 hover:text-violet-700">
                      Report <ChevronRight size={12} />
                    </Link>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Attendance snapshot ── */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-4">
            <div>
              <h2 className="text-sm font-black text-gray-800">Attendance Snapshot</h2>
              <p className="mt-0.5 text-xs font-semibold text-gray-400">{attendanceConcern}</p>
            </div>
            <Link href={`/list/attendance?studentId=${student.id}`} className="text-xs font-bold text-emerald-600 hover:text-emerald-700">
              Full history →
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 mb-3">
            {[
              { label: "Present", value: presentCount, color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
              { label: "Absent",  value: absentCount,  color: "bg-rose-50 text-rose-700 border-rose-200"         },
              { label: "Late",    value: lateCount,    color: "bg-amber-50 text-amber-700 border-amber-200"       },
              { label: "Excused", value: excusedCount, color: "bg-indigo-50 text-indigo-700 border-indigo-200"    },
            ].map((s) => (
              <div key={s.label} className={`rounded-lg p-3 border ${s.color} text-center`}>
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

        {/* Recent activity */}
        <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-50 text-slate-600">
                <History size={16} />
              </div>
              <div>
                <h2 className="text-sm font-black text-gray-800">Recent Activity / History</h2>
                <p className="text-xs font-semibold text-gray-400">Latest parent-safe events linked to this student.</p>
              </div>
            </div>
          </div>
          {recentActivity.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-200 p-4 text-center">
              <p className="text-sm font-black text-gray-500">No recent activity yet.</p>
              <p className="mt-1 text-xs font-semibold text-gray-400">Attendance, bills, homework, and academic events will appear here.</p>
            </div>
          ) : (
            <div className="grid gap-2">
              {recentActivity.map((event) => (
                <div key={event.id} className="rounded-lg border border-gray-100 p-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-gray-800">{event.title}</p>
                      <p className="mt-1 line-clamp-2 text-xs font-semibold text-gray-500">{event.body}</p>
                    </div>
                    <span className={`shrink-0 rounded-full border px-2 py-1 text-[10px] font-black ${activityTypeColor(event.type)}`}>
                      {event.type.toLowerCase()}
                    </span>
                  </div>
                  <p className="mt-2 text-[10px] font-bold uppercase tracking-wide text-gray-400">
                    {shortDateTime(event.occurredAt)} · {event.sourceModel}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Timetable ── */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex-1 min-h-[320px]">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-4">
            <div>
              <h2 className="text-base font-black text-gray-800">Student Timetable</h2>
              <p className="text-xs text-gray-400 mt-0.5">{student.class.name} — weekly schedule</p>
            </div>
            <span className="text-xs font-semibold bg-emerald-50 text-emerald-600 px-3 py-1.5 rounded-full">
              {latestGroup ? `${TERM_LABELS[latestGroup.term]} · ${latestGroup.year}` : "Current Term"}
            </span>
          </div>
          {calendarLessons.length === 0 ? (
            <div className="mb-4 rounded-lg border border-amber-100 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-700">
              No published timetable lessons are available for this class yet.
            </div>
          ) : null}
          <BigCalendar lessons={calendarLessons} viewAs="student" />
        </div>
      </div>

      {/* ── RIGHT ── */}
      <div className="w-full xl:w-1/3 flex flex-col gap-4">

        {/* Class placement */}
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-black text-gray-800">Class Placement</h2>
              <p className="text-xs font-semibold text-gray-400">Current school placement and timetable source.</p>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <Link2 size={16} />
            </div>
          </div>
          <div className="grid gap-2 text-xs font-semibold text-gray-500">
            <div className="flex items-center justify-between gap-3 rounded-xl bg-gray-50 px-3 py-2.5">
              <span>Class</span>
              <span className="text-right font-black text-gray-800">{student.class.name}</span>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-xl bg-gray-50 px-3 py-2.5">
              <span>Grade</span>
              <span className="text-right font-black text-gray-800">{student.class.grade.level}</span>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-xl bg-gray-50 px-3 py-2.5">
              <span>Class teacher</span>
              <span className="text-right font-black text-gray-800">
                {student.class.supervisor ? `${student.class.supervisor.name} ${student.class.supervisor.surname}` : "Not assigned"}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-xl bg-gray-50 px-3 py-2.5">
              <span>Published lessons</span>
              <span className="text-right font-black text-gray-800">{calendarLessons.length}</span>
            </div>
          </div>
        </div>

        {/* Quick access */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-black text-gray-800">Quick Access</h2>
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Shortcuts</span>
          </div>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {[
              { label: "Report Card",  href: latestGroup ? `/list/report-cards/${student.id}?term=${latestGroup.term}&year=${latestGroup.year}&classId=${student.classId}` : "/list/report-cards", color: "bg-violet-50 text-violet-600 hover:bg-violet-100", icon: <FileText size={15} /> },
              { label: "CA Entry",     href: `/list/ca?classId=${student.classId}`,            color: "bg-indigo-50 text-indigo-600 hover:bg-indigo-100",   icon: <Award size={15} /> },
              { label: "Results",      href: `/list/results?studentId=${student.id}`,          color: "bg-sky-50 text-sky-600 hover:bg-sky-100",           icon: <TrendingUp size={15} /> },
              { label: "Attendance",   href: `/list/attendance?studentId=${student.id}`,       color: "bg-emerald-50 text-emerald-600 hover:bg-emerald-100", icon: <Clock size={15} /> },
              { label: "Lessons",      href: `/list/lessons?classId=${student.classId}`,       color: "bg-amber-50 text-amber-600 hover:bg-amber-100",     icon: <BookOpen size={15} /> },
              { label: "Teachers",     href: `/list/teachers?classId=${student.classId}`,      color: "bg-rose-50 text-rose-600 hover:bg-rose-100",        icon: <Users size={15} /> },
              ...(canViewFinance ? [{ label: "Finance", href: `/list/finance/bills?search=${encodeURIComponent(student.admissionNumber ?? student.username)}`, color: "bg-emerald-50 text-emerald-600 hover:bg-emerald-100", icon: <WalletCards size={15} /> }] : []),
            ].map(({ label, href, color, icon }) => (
              <Link key={label} href={href}
                className={`flex items-center gap-2.5 px-3 py-3 rounded-xl text-xs font-bold transition-all hover:translate-x-1 ${color}`}
              >
                <span className="shrink-0 leading-none">{icon}</span>
                {label}
              </Link>
            ))}
          </div>
        </div>

        {/* Parent links */}
        {canViewParentContact && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-black text-gray-800">Parent / Guardian Links</h2>
                <p className="text-xs font-semibold text-gray-400">Portal access and contact routes.</p>
              </div>
              <Users size={16} className="text-indigo-500" />
            </div>
            {parentLinks.length === 0 && !student.parent ? (
              <div className="rounded-xl border border-dashed border-gray-200 p-4 text-center">
                <p className="text-sm font-black text-gray-500">No guardian linked yet.</p>
                <p className="mt-1 text-xs font-semibold text-gray-400">Link a parent before parent portal access can work.</p>
              </div>
            ) : (
              <div className="grid gap-2">
                {(parentLinks.length > 0 ? parentLinks : [{
                  id: "legacy-parent",
                  status: "ACTIVE",
                  role: "PRIMARY_GUARDIAN",
                  canViewFees: true,
                  canViewReports: true,
                  canMessageSchool: true,
                  note: null,
                  parent: student.parent!,
                }]).map((link) => (
                  <div key={link.id} className="rounded-xl border border-gray-100 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black text-gray-800">
                          {link.parent.name} {link.parent.surname}
                        </p>
                        <p className="mt-0.5 text-[10px] font-black uppercase text-gray-400">
                          {link.role.replaceAll("_", " ").toLowerCase()} · {link.status.toLowerCase()}
                        </p>
                      </div>
                      <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-black ${link.status === "ACTIVE" ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
                        {link.status}
                      </span>
                    </div>
                    <div className="mt-3 grid gap-1.5 text-xs font-semibold text-gray-500">
                      {link.parent.email ? (
                        <a href={`mailto:${link.parent.email}`} className="flex items-center gap-2 hover:text-indigo-600">
                          <Mail size={12} className="text-gray-400" /> {link.parent.email}
                        </a>
                      ) : null}
                      {link.parent.phone ? (
                        <a href={`tel:${link.parent.phone}`} className="flex items-center gap-2 hover:text-emerald-600">
                          <Phone size={12} className="text-gray-400" /> {link.parent.phone}
                        </a>
                      ) : null}
                      {!link.parent.email && !link.parent.phone ? (
                        <p>No contact saved</p>
                      ) : null}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {[
                        link.canViewFees ? "Fees" : null,
                        link.canViewReports ? "Reports" : null,
                        link.canMessageSchool ? "Messages" : null,
                      ].filter(Boolean).map((permission) => (
                        <span key={permission} className="rounded-lg bg-gray-50 px-2 py-1 text-[10px] font-black text-gray-500">
                          {permission}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {student.parent && !canViewParentContact && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h2 className="text-base font-black text-gray-800 mb-2">Parent / Guardian</h2>
            <p className="text-xs font-semibold text-gray-400">
              Parent contact details are shown to admins and the assigned class teacher.
            </p>
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
