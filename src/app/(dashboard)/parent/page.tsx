// src/app/(dashboard)/parent/page.tsx


import { requirePageSession } from "@/src/lib/authz";
import Announcements from "@/src/components/Announcements";
import EventCalendar from "@/src/components/EventCalendar";
import EventList from "@/src/components/EventList";
import ParentTimetableTabs from "@/src/components/ParentTimetableTabs";
import WelcomeBanner from "@/src/components/WelcomeBanner";
import type { ChildSchedule } from "@/src/components/ParentTimetableTabs";
import Link from "next/link";
import {
  CheckCircle2, XCircle, Clock, FileCheck,
  AlertTriangle, TrendingUp, TrendingDown, Minus,
  CalendarDays, ShieldAlert, FileText, Award,
  AlertCircle, Star, BookOpen, BellRing, ClipboardList,
  Megaphone, ReceiptText, WalletCards, MessageCircle,
  BadgeCheck, HandCoins, NotebookTabs, ShieldCheck,
} from "lucide-react";
import { getGradeBandByGrade, ordinal, TERM_LABELS } from "@/src/lib/caGrades";
import {
  getParentDashboardData,
  type ParentAcademicProgress,
  type ParentActivityFeedItem,
  type ParentRiskAlert,
} from "@/src/lib/services/parent-dashboard";

export const dynamic = "force-dynamic";

const activityTone: Record<ParentActivityFeedItem["tone"], string> = {
  green: "bg-emerald-50 text-emerald-700 border-emerald-100",
  blue: "bg-sky-50 text-sky-700 border-sky-100",
  amber: "bg-amber-50 text-amber-700 border-amber-100",
  rose: "bg-rose-50 text-rose-700 border-rose-100",
  violet: "bg-violet-50 text-violet-700 border-violet-100",
  slate: "bg-slate-50 text-slate-700 border-slate-100",
};

function ActivityIcon({ type }: { type: ParentActivityFeedItem["type"] }) {
  const className = "h-4 w-4";
  if (type === "ATTENDANCE") return <CheckCircle2 className={className} />;
  if (type === "ASSESSMENT") return <Award className={className} />;
  if (type === "ASSIGNMENT") return <ClipboardList className={className} />;
  if (type === "ANNOUNCEMENT") return <Megaphone className={className} />;
  if (type === "BILL") return <WalletCards className={className} />;
  return <ReceiptText className={className} />;
}

function ActivityFeedPanel({ items }: { items: ParentActivityFeedItem[] }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <BellRing size={17} />
          </div>
          <div>
            <h2 className="text-sm font-black text-gray-900">Live School Feed</h2>
            <p className="text-xs text-gray-400 font-medium mt-0.5">
              Attendance, academics, fees, homework, and notices in one timeline.
            </p>
          </div>
        </div>
        <span className="hidden sm:inline-flex rounded-full bg-slate-50 px-3 py-1 text-[10px] font-black uppercase tracking-wide text-slate-400">
          Source of truth
        </span>
      </div>

      {items.length === 0 ? (
        <div className="px-5 py-8 text-center">
          <p className="text-sm font-bold text-gray-400">No recent school activity yet</p>
          <p className="text-xs text-gray-300 mt-1">
            Updates will appear here when the school records attendance, scores, bills, payments, assignments, or notices.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-gray-50">
          {items.slice(0, 8).map((item) => {
            const content = (
              <div className="flex items-start gap-3 px-5 py-3.5 hover:bg-gray-50/70 transition-colors">
                <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${activityTone[item.tone]}`}>
                  <ActivityIcon type={item.type} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate text-sm font-black text-gray-800">{item.title}</p>
                    <span className="shrink-0 text-[10px] font-bold text-gray-300">
                      {item.occurredAt.toLocaleDateString("en-GH", { day: "numeric", month: "short" })}
                    </span>
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-xs font-medium leading-relaxed text-gray-400">
                    {item.childName && <span className="font-black text-gray-500">{item.childName}: </span>}
                    {item.description}
                  </p>
                </div>
              </div>
            );

            return item.href ? (
              <Link key={item.id} href={item.href}>
                {content}
              </Link>
            ) : (
              <div key={item.id}>{content}</div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AcademicProgressPanel({
  childName,
  progress,
  reportHref,
}: {
  childName: string;
  progress: ParentAcademicProgress;
  reportHref?: string;
}) {
  const trendCopy = {
    up: "Improving",
    down: "Dropping",
    steady: "Stable",
    new: "New data",
  }[progress.trend];
  const trendColor = {
    up: "text-emerald-600 bg-emerald-50",
    down: "text-rose-600 bg-rose-50",
    steady: "text-slate-600 bg-slate-50",
    new: "text-sky-600 bg-sky-50",
  }[progress.trend];

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 bg-sky-50 rounded-xl flex items-center justify-center shrink-0">
            <BookOpen size={15} className="text-sky-600" />
          </div>
          <div>
            <p className="text-sm font-black text-gray-800">Continuous Progress</p>
            <p className="text-[11px] text-gray-400 font-medium mt-0.5">
              See {childName}&apos;s academic movement before end-of-term reports.
            </p>
          </div>
        </div>
        <span className={`shrink-0 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wide ${trendColor}`}>
          {trendCopy}
        </span>
      </div>

      <div className="grid grid-cols-3 divide-x divide-gray-100">
        <div className="p-4">
          <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">CA Ready</p>
          <p className="mt-1 text-2xl font-black text-gray-900">{progress.completionRate}%</p>
          <p className="text-[10px] font-semibold text-gray-400">
            {progress.completedSubjects}/{progress.expectedSubjects || progress.completedSubjects} subjects
          </p>
        </div>
        <div className="p-4">
          <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">Average</p>
          <p className="mt-1 text-2xl font-black text-indigo-700">{progress.averageScore}%</p>
          <p className="text-[10px] font-semibold text-gray-400">Current term</p>
        </div>
        <div className="p-4">
          <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">Movement</p>
          <p className={`mt-1 text-2xl font-black ${progress.trend === "up" ? "text-emerald-600" : progress.trend === "down" ? "text-rose-600" : "text-gray-800"}`}>
            {progress.trendDiff > 0 ? "+" : ""}{progress.trend === "new" ? "0" : progress.trendDiff}%
          </p>
          <p className="text-[10px] font-semibold text-gray-400">Vs previous term</p>
        </div>
      </div>

      <div className="px-5 py-4 border-t border-gray-100">
        <div className="flex items-center justify-between gap-3 mb-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Subjects To Watch</p>
          {reportHref && (
            <Link href={reportHref} className="text-[11px] font-black text-indigo-600 hover:text-indigo-800">
              Open report
            </Link>
          )}
        </div>
        {progress.focusSubjects.length === 0 ? (
          <p className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700">
            No weak subject signal yet. Keep monitoring as teachers publish more CA records.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {progress.focusSubjects.map((subject) => (
              <div key={subject.subjectId} className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate text-xs font-black text-gray-700">{subject.subjectName}</p>
                    <span className={`text-[10px] font-black ${subject.status === "support" ? "text-rose-600" : subject.trend === "down" ? "text-rose-600" : "text-amber-600"}`}>
                      {subject.grade} / {subject.score}%
                    </span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-gray-100">
                    <div
                      className={`h-full rounded-full ${subject.status === "support" ? "bg-rose-500" : subject.status === "watch" ? "bg-amber-500" : "bg-emerald-500"}`}
                      style={{ width: `${Math.max(subject.score, 6)}%` }}
                    />
                  </div>
                </div>
                <span className="w-20 shrink-0 rounded-lg bg-gray-50 px-2 py-1 text-center text-[10px] font-bold text-gray-500">
                  {subject.trend === "new" ? "New" : subject.change > 0 ? `+${subject.change}%` : `${subject.change}%`}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function RiskAlertPanel({ alerts }: { alerts: ParentRiskAlert[] }) {
  const severityStyle = {
    high: "bg-rose-50 text-rose-700 border-rose-100",
    medium: "bg-amber-50 text-amber-700 border-amber-100",
    low: "bg-sky-50 text-sky-700 border-sky-100",
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
            <ShieldAlert size={17} />
          </div>
          <div>
            <h2 className="text-sm font-black text-gray-900">Smart Parent Alerts</h2>
            <p className="text-xs text-gray-400 font-medium mt-0.5">
              Edujay surfaces issues early so parents do not wait until term end.
            </p>
          </div>
        </div>
      </div>
      {alerts.length === 0 ? (
        <div className="px-5 py-5 flex items-start gap-3">
          <ShieldCheck className="h-5 w-5 text-emerald-500 shrink-0" />
          <div>
            <p className="text-sm font-black text-gray-800">No urgent parent alerts</p>
            <p className="text-xs text-gray-400 font-medium mt-0.5">
              Attendance, academics, finance, and school communication are being monitored.
            </p>
          </div>
        </div>
      ) : (
        <div className="divide-y divide-gray-50">
          {alerts.map((alert) => (
            <Link key={alert.id} href={alert.href} className="flex items-start gap-3 px-5 py-3.5 hover:bg-gray-50">
              <span className={`mt-0.5 rounded-xl border px-2 py-1 text-[10px] font-black uppercase ${severityStyle[alert.severity]}`}>
                {alert.severity}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-black text-gray-800">{alert.title}</p>
                <p className="mt-0.5 text-xs font-medium text-gray-400">{alert.description}</p>
              </div>
              <span className="hidden sm:inline text-[11px] font-black text-indigo-600">{alert.actionLabel}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function ParentTrustPanel({ score }: { score: number }) {
  return (
    <div className="bg-slate-950 rounded-2xl border border-slate-800 shadow-sm p-5 text-white">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-sky-300">Transparency Score</p>
          <h2 className="mt-2 text-3xl font-black">{score}%</h2>
          <p className="mt-1 max-w-xl text-sm font-medium text-slate-300">
            This measures how much of the child&apos;s school life is visible to the parent: attendance, CA, finance, and notices.
          </p>
        </div>
        <BadgeCheck className="h-8 w-8 text-emerald-300 shrink-0" />
      </div>
    </div>
  );
}

function ParentValuePanels({ child }: { child: Awaited<ReturnType<typeof getParentDashboardData>>["childrenData"][number] }) {
  const finance = child.financeSummary;
  const homework = child.homeworkSummary;
  const communication = child.communicationSummary;
  const digest = child.weeklyDigest;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 bg-emerald-50 rounded-xl flex items-center justify-center">
            <HandCoins size={15} className="text-emerald-600" />
          </div>
          <div>
            <p className="text-sm font-black text-gray-800">Fee Transparency</p>
            <p className="text-[11px] text-gray-400 font-medium">Bills, payments, and balance in one place.</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <p className="text-[10px] font-black uppercase text-gray-400">Billed</p>
            <p className="text-sm font-black text-gray-800">GHS {finance.totalBilled.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase text-gray-400">Paid</p>
            <p className="text-sm font-black text-emerald-600">GHS {finance.totalPaid.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase text-gray-400">Balance</p>
            <p className="text-sm font-black text-rose-600">GHS {finance.outstanding.toFixed(2)}</p>
          </div>
        </div>
        <div className="mt-4 h-2 rounded-full bg-gray-100 overflow-hidden">
          <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(finance.paymentRate, 100)}%` }} />
        </div>
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-xs font-semibold text-gray-400">
            {finance.lastPayment
              ? `Last receipt: ${finance.lastPayment.receiptNumber}`
              : "No confirmed payment recorded yet"}
          </p>
          <Link href="/list/finance/bills" className="text-[11px] font-black text-indigo-600">View bills</Link>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 bg-violet-50 rounded-xl flex items-center justify-center">
            <NotebookTabs size={15} className="text-violet-600" />
          </div>
          <div>
            <p className="text-sm font-black text-gray-800">Homework Visibility</p>
            <p className="text-[11px] text-gray-400 font-medium">Parents see upcoming work before deadlines pass.</p>
          </div>
        </div>
        {homework.assignments.length === 0 ? (
          <p className="rounded-xl bg-gray-50 px-3 py-3 text-xs font-bold text-gray-400">No assignment has been published for this class yet.</p>
        ) : (
          <div className="space-y-2">
            {homework.assignments.slice(0, 3).map((assignment) => (
              <div key={assignment.id} className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-xs font-black text-gray-700">{assignment.title}</p>
                  <p className="text-[10px] font-semibold text-gray-400">{assignment.subjectName}</p>
                </div>
                <span className={`shrink-0 rounded-lg px-2 py-1 text-[10px] font-black ${
                  assignment.status === "overdue" ? "bg-rose-50 text-rose-600" : "bg-sky-50 text-sky-600"
                }`}>
                  {assignment.dueDate.toLocaleDateString("en-GH", { day: "numeric", month: "short" })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 bg-sky-50 rounded-xl flex items-center justify-center">
            <MessageCircle size={15} className="text-sky-600" />
          </div>
          <div>
            <p className="text-sm font-black text-gray-800">School Connection</p>
            <p className="text-[11px] text-gray-400 font-medium">Teachers and notices tied to this child.</p>
          </div>
        </div>
        <p className="text-xs font-bold text-gray-500">
          {communication.teacherNames.length > 0
            ? `Teachers: ${communication.teacherNames.join(", ")}`
            : "No teacher timetable has been published yet."}
        </p>
        <p className="mt-2 text-xs font-semibold text-gray-400">
          {communication.latestAnnouncement
            ? `Latest notice: ${communication.latestAnnouncement.title}`
            : "No recent school notice for this class."}
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 bg-amber-50 rounded-xl flex items-center justify-center">
            <ReceiptText size={15} className="text-amber-600" />
          </div>
          <div>
            <p className="text-sm font-black text-gray-800">Weekly Digest Preview</p>
            <p className="text-[11px] text-gray-400 font-medium">A compact summary parents can receive weekly.</p>
          </div>
        </div>
        <div className="grid grid-cols-5 gap-2 text-center">
          {[
            ["Att.", digest.attendanceRecords],
            ["CA", digest.academicUpdates],
            ["Fees", digest.financeUpdates],
            ["Work", digest.homeworkUpdates],
            ["News", digest.notices],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl bg-gray-50 px-2 py-2">
              <p className="text-sm font-black text-gray-800">{value}</p>
              <p className="text-[9px] font-black uppercase text-gray-400">{label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 bg-emerald-50 rounded-xl flex items-center justify-center">
            <ShieldCheck size={15} className="text-emerald-600" />
          </div>
          <div>
            <p className="text-sm font-black text-gray-800">Behaviour Record</p>
            <p className="text-[11px] text-gray-400 font-medium">Discipline, praise, and conduct updates for parent trust.</p>
          </div>
        </div>
        <div className="rounded-xl bg-emerald-50 px-3 py-3">
          <p className="text-xs font-black text-emerald-700">No behaviour concern published</p>
          <p className="mt-1 text-[11px] font-medium text-emerald-600">
            When the school starts recording behaviour notes, parents will see praise, warnings, follow-ups, and resolution history here.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 bg-indigo-50 rounded-xl flex items-center justify-center">
            <FileCheck size={15} className="text-indigo-600" />
          </div>
          <div>
            <p className="text-sm font-black text-gray-800">Parent Acknowledgement</p>
            <p className="text-[11px] text-gray-400 font-medium">Important notices become traceable parent confirmations.</p>
          </div>
        </div>
        <div className="flex items-center justify-between gap-3 rounded-xl bg-gray-50 px-3 py-3">
          <div>
            <p className="text-xs font-black text-gray-700">Current pending items</p>
            <p className="mt-1 text-[11px] font-medium text-gray-400">
              {communication.latestAnnouncement
                ? `Latest notice available: ${communication.latestAnnouncement.title}`
                : "No acknowledgement request has been published yet."}
            </p>
          </div>
          <Link href="/list/announcements" className="shrink-0 text-[11px] font-black text-indigo-600">
            Notices
          </Link>
        </div>
      </div>
    </div>
  );
}

const ParentPage = async ({
  searchParams,
}: {
  searchParams: { [key: string]: string | undefined };
}) => {
  const { userId, schoolId } = await requirePageSession(["parent"]);

  const { parent, childrenData, activityFeed, riskAlerts, familyTrustScore } = await getParentDashboardData(userId, schoolId);
  const children = parent?.students ?? [];
  const parentName = parent
    ? `${parent.name} ${parent.surname}`
    : "Parent";

  const childrenSchedules: ChildSchedule[] = childrenData.map((c) => ({
    id: c.id, name: c.name, surname: c.surname,
    className: c.className, lessons: c.lessons,
  }));

  const anyFlagged = childrenData.some((c) => c.isFlagged);
  const childCount = children.length;

  return (
    <div className="p-4 flex flex-col gap-5">

      {/* â”€â”€ WELCOME BANNER â”€â”€ */}
      <WelcomeBanner
        role="parent"
        name={parentName}
        subtitle={`${childCount} child${childCount !== 1 ? "ren" : ""} enrolled Â· monitoring attendance & schedule`}
        tag="Term 2 Â· 2025/26"
      />

      {/* â”€â”€ Flagged alert â”€â”€ */}
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

      <ActivityFeedPanel items={activityFeed} />
      <RiskAlertPanel alerts={riskAlerts} />
      <ParentTrustPanel score={familyTrustScore} />

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

              {/* â”€â”€ CA PERFORMANCE CARD â”€â”€ */}
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
                          {TERM_LABELS[child.ca.latestGroup.term]} Â· {child.ca.latestGroup.year}
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
                        {child.ca.myPosition > 0 ? ordinal(child.ca.myPosition) : "â€”"}
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
                          <p className="text-[10px] font-black text-emerald-700">ðŸŒŸ Excelling In</p>
                          <p className="text-xs font-bold text-emerald-800">{child.ca.bestSubject.subject.name}</p>
                          <p className="text-[10px] text-emerald-600">
                            {child.ca.bestSubject.grade} Â· {child.ca.bestSubject.totalScore.toFixed(1)}%
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-xl border border-amber-100">
                        <AlertCircle size={12} className="text-amber-500 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-[10px] font-black text-amber-700">ðŸ“š Needs Support</p>
                          <p className="text-xs font-bold text-amber-800">{child.ca.weakSubject.subject.name}</p>
                          <p className="text-[10px] text-amber-600">
                            {child.ca.weakSubject.grade} Â· {child.ca.weakSubject.totalScore.toFixed(1)}%
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

              {/* â”€â”€ ATTENDANCE STATS (unchanged) â”€â”€ */}
              <AcademicProgressPanel
                childName={child.name}
                progress={child.academicProgress}
                reportHref={
                  child.ca.latestGroup
                    ? `/list/report-cards/${child.id}?term=${child.ca.latestGroup.term}&year=${child.ca.latestGroup.year}&classId=${child.classId}`
                    : undefined
                }
              />

              <ParentValuePanels child={child} />

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
                  {child.stats.rate >= 80 ? "âœ… Good attendance â€” keep it up!" : child.stats.rate >= 60 ? "âš ï¸ Attendance needs improvement" : "âŒ Poor attendance â€” please contact the school"}
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
                    Full history â†’
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
                    <p className="text-[11px] text-gray-400 mt-0.5">Last 30 days Â· {child.history.length} records</p>
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
                        View all {child.history.length} records â†’
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
            <ParentTimetableTabs schedules={childrenSchedules} />
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
