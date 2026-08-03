import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Award,
  BellRing,
  CheckCircle2,
  ClipboardList,
  WalletCards,
} from "lucide-react";
import { requirePageSession } from "@/src/lib/authz";
import { getParentDashboardData } from "@/src/lib/services/parent-dashboard";
import { getSchoolBranding } from "@/src/lib/services/school-branding";
import { formatMark } from "@/src/lib/formatters/marks";

export const dynamic = "force-dynamic";

function formatGHS(amount: number) {
  return `GHS ${amount.toLocaleString("en-GH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(date: Date) {
  return date.toLocaleDateString("en-GH", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default async function ParentChildCheckupPage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  const { userId, schoolId } = await requirePageSession(["parent"]);
  const { studentId } = await params;
  const [{ childrenData }, branding] = await Promise.all([
    getParentDashboardData(userId, schoolId),
    getSchoolBranding(schoolId),
  ]);
  const child = childrenData.find((item) => item.id === studentId);
  if (!child) notFound();

  const attendanceToday = child.todayAttendance.at(0)?.status ?? "Not marked";
  const homeworkCount = child.homeworkSummary.dueSoon + child.homeworkSummary.overdue;
  const subjectTotal = child.academicProgress.expectedSubjects || child.academicProgress.subjects.length;
  const recentItems = child.activityFeed.slice(0, 5);

  return (
    <div className="flex flex-col gap-5 p-4">
      <div>
        <Link href="/parent" className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-wide text-slate-500 hover:text-slate-900">
          <ArrowLeft size={14} />
          Parent dashboard
        </Link>
      </div>

      <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <p className="text-[11px] font-black uppercase tracking-widest text-gray-400">{branding.displayName} Ward Checkup</p>
        <h1 className="mt-2 text-2xl font-black text-gray-900">{child.name} {child.surname}</h1>
        <p className="mt-1 text-sm font-semibold text-gray-400">{child.className}</p>

        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { label: "Today", value: attendanceToday, icon: <CheckCircle2 size={16} />, tone: "text-emerald-700 bg-emerald-50" },
            { label: "CA subjects", value: `${child.academicProgress.completedSubjects}/${subjectTotal}`, icon: <Award size={16} />, tone: "text-sky-700 bg-sky-50" },
            { label: "Homework", value: String(homeworkCount), icon: <ClipboardList size={16} />, tone: "text-violet-700 bg-violet-50" },
            { label: "Balance", value: formatGHS(child.financeSummary.outstanding), icon: <WalletCards size={16} />, tone: "text-amber-700 bg-amber-50" },
          ].map((item) => (
            <div key={item.label} className={`rounded-xl p-3 ${item.tone}`}>
              <div className="flex items-center justify-between gap-2">
                {item.icon}
                <span className="text-sm font-black">{item.value}</span>
              </div>
              <p className="mt-2 text-[10px] font-black uppercase tracking-wide">{item.label}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-sky-100 bg-sky-50/70 p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-black text-slate-900">Current CA by subject</h2>
            <p className="mt-1 text-xs font-semibold leading-relaxed text-sky-700">
              These are CA marks only. Exam scores are added later before the final report card is complete.
            </p>
          </div>
          <span className="rounded-full bg-white px-2 py-1 text-[10px] font-black text-sky-700">
            {child.academicProgress.completedSubjects}/{subjectTotal}
          </span>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {child.academicProgress.subjects.length > 0 ? (
            child.academicProgress.subjects.map((subject) => {
              const percent = subject.hasCARecord
                ? Math.min(100, Math.round((subject.score / Math.max(subject.maxScore, 1)) * 100))
                : 0;
              return (
                <div key={subject.subjectId} className="rounded-xl bg-white p-3 ring-1 ring-sky-100">
                  <div className="flex items-center justify-between gap-2">
                    <p className="min-w-0 truncate text-sm font-black text-gray-900">{subject.subjectName}</p>
                    <p className="shrink-0 text-sm font-black text-sky-700">
                      {subject.hasCARecord ? `${formatMark(subject.score)}/${formatMark(subject.maxScore)}` : "No CA yet"}
                    </p>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-sky-100">
                    <div className="h-full rounded-full bg-sky-500" style={{ width: `${percent}%` }} />
                  </div>
                </div>
              );
            })
          ) : (
            <p className="rounded-xl bg-white p-3 text-sm font-semibold text-sky-700 ring-1 ring-sky-100">
              No subjects have been linked to this class yet.
            </p>
          )}
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2">
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-black text-gray-900">Attendance</h2>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-emerald-50 p-3 text-emerald-700">
              <p className="text-xl font-black">{child.stats.rate}%</p>
              <p className="text-[10px] font-black uppercase">30-day rate</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3 text-slate-700">
              <p className="text-xl font-black">{child.stats.present}/{child.stats.total}</p>
              <p className="text-[10px] font-black uppercase">Present records</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-black text-gray-900">Fees</h2>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-amber-50 p-3 text-amber-700">
              <p className="text-lg font-black">{formatGHS(child.financeSummary.outstanding)}</p>
              <p className="text-[10px] font-black uppercase">Balance</p>
            </div>
            <div className="rounded-xl bg-emerald-50 p-3 text-emerald-700">
              <p className="text-lg font-black">{child.financeSummary.paymentRate}%</p>
              <p className="text-[10px] font-black uppercase">Paid</p>
            </div>
          </div>
          {child.financeSummary.lastPayment && (
            <p className="mt-3 text-xs font-semibold text-gray-500">
              Last payment: {formatGHS(child.financeSummary.lastPayment.amount)} on {formatDate(child.financeSummary.lastPayment.date)}.
            </p>
          )}
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2">
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-black text-gray-900">Homework</h2>
          {child.homeworkSummary.assignments.length > 0 ? (
            <div className="mt-3 space-y-2">
              {child.homeworkSummary.assignments.slice(0, 4).map((assignment) => (
                <div key={assignment.id} className="rounded-xl bg-slate-50 px-3 py-2">
                  <p className="text-sm font-black text-gray-900">{assignment.title}</p>
                  <p className="text-xs font-semibold text-gray-500">{assignment.subjectName} - due {formatDate(assignment.dueDate)}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm font-semibold text-gray-400">No homework due soon.</p>
          )}
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-black text-gray-900">Recent activity</h2>
          {recentItems.length > 0 ? (
            <div className="mt-3 space-y-2">
              {recentItems.map((item) => (
                <Link key={item.id} href={item.href ?? "/parent/updates"} className="block rounded-xl bg-slate-50 px-3 py-2">
                  <p className="text-sm font-black text-gray-900">{item.title}</p>
                  <p className="mt-0.5 line-clamp-2 text-xs font-semibold text-gray-500">{item.description}</p>
                </Link>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm font-semibold text-gray-400">No recent activity yet.</p>
          )}
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <Link href="/parent/updates" className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition hover:bg-sky-50">
          <BellRing className="h-5 w-5 text-sky-600" />
          <p className="mt-3 text-sm font-black text-gray-900">Daily updates</p>
        </Link>
        <Link href="/parent/finance" className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition hover:bg-amber-50">
          <WalletCards className="h-5 w-5 text-amber-600" />
          <p className="mt-3 text-sm font-black text-gray-900">Fees</p>
        </Link>
        <Link href={`/list/report-cards?childId=${child.id}`} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition hover:bg-blue-50">
          <Award className="h-5 w-5 text-blue-600" />
          <p className="mt-3 text-sm font-black text-gray-900">Full report</p>
        </Link>
      </section>
    </div>
  );
}
