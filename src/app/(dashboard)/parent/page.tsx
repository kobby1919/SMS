import Link from "next/link";
import {
  Award,
  BellRing,
  CheckCircle2,
  ClipboardList,
  Megaphone,
  ShieldAlert,
  WalletCards,
} from "lucide-react";
import { requirePageSession } from "@/src/lib/authz";
import {
  getParentDashboardData,
  type ParentActionCue,
  type ParentActivityFeedItem,
  type ParentRiskAlert,
} from "@/src/lib/services/parent-dashboard";
import { getSchoolBranding } from "@/src/lib/services/school-branding";

export const dynamic = "force-dynamic";

type DailySummaryCounts = {
  attendance: number;
  academics: number;
  homework: number;
  notices: number;
  finance: number;
};

const emptyDailyCounts: DailySummaryCounts = {
  attendance: 0,
  academics: 0,
  homework: 0,
  notices: 0,
  finance: 0,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function numberFromPayload(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function getDailySummaryCounts(summary?: ParentActivityFeedItem): DailySummaryCounts {
  if (!isRecord(summary?.payload)) return emptyDailyCounts;
  const counts = summary.payload.counts;
  if (!isRecord(counts)) return emptyDailyCounts;

  return {
    attendance: numberFromPayload(counts.attendance),
    academics: numberFromPayload(counts.academics),
    homework: numberFromPayload(counts.homework),
    notices: numberFromPayload(counts.notices),
    finance: numberFromPayload(counts.finance),
  };
}

function getPreviewLines(summary?: ParentActivityFeedItem) {
  return (summary?.description ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 3);
}

function actionCueToneClass(tone: string) {
  switch (tone) {
    case "blue":
      return "bg-sky-50 text-sky-800 ring-sky-100";
    case "emerald":
      return "bg-emerald-50 text-emerald-800 ring-emerald-100";
    case "amber":
      return "bg-amber-50 text-amber-800 ring-amber-100";
    case "rose":
      return "bg-rose-50 text-rose-800 ring-rose-100";
    case "violet":
      return "bg-violet-50 text-violet-800 ring-violet-100";
    default:
      return "bg-slate-50 text-slate-700 ring-slate-100";
  }
}

function formatGHS(amount: number) {
  return `GHS ${amount.toLocaleString("en-GH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function TodayUpdateCard({ items, schoolName }: { items: ParentActivityFeedItem[]; schoolName: string }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const todayItems = items.filter((item) => item.occurredAt >= today && item.occurredAt < tomorrow);
  const latestSummary = todayItems.find((item) => item.type === "DAILY_SUMMARY");
  const fallbackItems = todayItems.filter((item) => item.type !== "DAILY_SUMMARY").slice(0, 3);
  const counts = getDailySummaryCounts(latestSummary);
  const previewLines = getPreviewLines(latestSummary);
  const totalUpdates = latestSummary
    ? Object.values(counts).reduce((sum, value) => sum + value, 0)
    : fallbackItems.length;

  const groups = [
    { label: "Attendance", value: counts.attendance, icon: <CheckCircle2 size={16} />, color: "text-emerald-700 bg-emerald-50" },
    { label: "Academics", value: counts.academics, icon: <Award size={16} />, color: "text-sky-700 bg-sky-50" },
    { label: "Homework", value: counts.homework, icon: <ClipboardList size={16} />, color: "text-violet-700 bg-violet-50" },
    { label: "Fees", value: counts.finance, icon: <WalletCards size={16} />, color: "text-amber-700 bg-amber-50" },
    { label: "Notices", value: counts.notices, icon: <Megaphone size={16} />, color: "text-slate-700 bg-slate-50" },
  ];

  return (
    <section className="rounded-2xl border border-slate-200 bg-slate-950 p-5 text-white shadow-sm sm:p-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-3xl">
          <p className="text-[11px] font-black uppercase tracking-widest text-sky-300">
            {schoolName} Parent Summary
          </p>
          <h1 className="mt-2 text-2xl font-black sm:text-3xl">Today&apos;s School Update</h1>
          <p className="mt-2 text-sm font-medium leading-relaxed text-slate-300">
            The quick version first. Open the full update only when you want the details.
          </p>
        </div>

        <Link
          href="/parent/updates"
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-sky-100 sm:w-auto"
        >
          <BellRing size={16} />
          View all updates
        </Link>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-5">
        {groups.map((group) => (
          <div key={group.label} className={`rounded-xl px-3 py-3 ${group.color}`}>
            <div className="flex items-center justify-between gap-2">
              {group.icon}
              <span className="text-xl font-black">{latestSummary ? group.value : "-"}</span>
            </div>
            <p className="mt-2 text-[10px] font-black uppercase tracking-wide">{group.label}</p>
          </div>
        ))}
      </div>

      <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
        {previewLines.length > 0 ? (
          <div className="space-y-2">
            {previewLines.map((line, index) => (
              <p key={`${index}-${line}`} className="text-sm font-semibold leading-relaxed text-slate-200">
                {line}
              </p>
            ))}
          </div>
        ) : fallbackItems.length > 0 ? (
          <div className="space-y-2">
            {fallbackItems.map((item) => (
              <p key={item.id} className="text-sm font-semibold leading-relaxed text-slate-200">
                {item.childName ? `${item.childName}: ` : ""}{item.title}
              </p>
            ))}
          </div>
        ) : (
          <p className="text-sm font-semibold text-slate-300">
            No update has been generated yet. Once the school records attendance, CA activity, homework, notices, or fees, it will appear here.
          </p>
        )}
        <p className="mt-3 text-[11px] font-bold uppercase tracking-widest text-slate-500">
          {totalUpdates} update{totalUpdates === 1 ? "" : "s"} today
        </p>
      </div>
    </section>
  );
}

function ChildrenSnapshot({
  childrenData,
}: {
  childrenData: Awaited<ReturnType<typeof getParentDashboardData>>["childrenData"];
}) {
  if (childrenData.length === 0) {
    return (
      <section className="rounded-2xl border border-gray-100 bg-white p-8 text-center shadow-sm">
        <p className="text-sm font-black text-gray-500">No children linked to your account.</p>
        <p className="mt-1 text-xs font-semibold text-gray-400">Please contact the school administration.</p>
      </section>
    );
  }

  return (
    <section className="grid gap-3 md:grid-cols-2">
      {childrenData.map((child) => {
        const outstanding = child.financeSummary.outstanding;
        const caAverage = child.academicProgress.completedSubjects > 0
          ? child.academicProgress.averageCAMarks
          : null;
        const attendanceToday = child.todayAttendance.at(0)?.status ?? "Not marked";
        const homeworkAttentionCount = child.homeworkSummary.overdue + child.homeworkSummary.missing;
        const homeworkLabel = homeworkAttentionCount > 0
          ? `${homeworkAttentionCount} need attention`
          : child.homeworkSummary.dueSoon > 0
            ? `${child.homeworkSummary.dueSoon} due soon`
            : child.homeworkSummary.submitted > 0
              ? `${child.homeworkSummary.submitted} submitted`
              : "No issue";
        const academicLabel = caAverage === null
          ? "CA building"
          : child.academicProgress.hasReportScores
            ? child.academicProgress.trend === "down"
              ? "Dropping"
              : child.academicProgress.trend === "up"
                ? "Improving"
                : "Steady"
            : "CA building";
        const subjectCountLabel = `${child.academicProgress.completedSubjects}/${child.academicProgress.expectedSubjects || child.academicProgress.subjects.length}`;
        return (
          <article key={child.id} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="truncate text-base font-black text-gray-900">
                  {child.name} {child.surname}
                </h2>
                <p className="mt-0.5 text-xs font-bold text-gray-400">{child.className}</p>
              </div>
              {child.isFlagged && (
                <span className="rounded-full bg-rose-50 px-2.5 py-1 text-[10px] font-black uppercase text-rose-600">
                  Alert
                </span>
              )}
            </div>

            <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 p-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Today</p>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div>
                  <p className="text-sm font-black text-emerald-700">{attendanceToday}</p>
                  <p className="text-[10px] font-bold uppercase text-slate-400">Attendance</p>
                </div>
                <div>
                  <p className="text-sm font-black text-sky-700">{academicLabel}</p>
                  <p className="text-[10px] font-bold uppercase text-slate-400">Academics</p>
                </div>
                <div>
                  <p className="text-sm font-black text-violet-700">{homeworkLabel}</p>
                  <p className="text-[10px] font-bold uppercase text-slate-400">Homework</p>
                </div>
                <div>
                  <p className="text-sm font-black text-amber-700">{outstanding > 0 ? "Due" : "OK"}</p>
                  <p className="text-[10px] font-bold uppercase text-slate-400">Fees</p>
                </div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2">
              <div className="rounded-xl bg-white px-3 py-2 ring-1 ring-gray-100">
                <p className="text-sm font-black text-gray-900">{child.stats.rate}%</p>
                <p className="text-[10px] font-bold uppercase text-gray-400">30-day attendance</p>
              </div>
              <div className="rounded-xl bg-white px-3 py-2 ring-1 ring-gray-100">
                <p className="text-sm font-black text-gray-900">{subjectCountLabel}</p>
                <p className="text-[10px] font-bold uppercase text-gray-400">CA subjects</p>
              </div>
              <div className="rounded-xl bg-white px-3 py-2 ring-1 ring-gray-100">
                <p className="text-sm font-black text-gray-900">{formatGHS(outstanding)}</p>
                <p className="text-[10px] font-bold uppercase text-gray-400">Balance</p>
              </div>
            </div>

            <p className="mt-4 rounded-xl border border-slate-100 bg-slate-50 px-3 py-3 text-xs font-semibold leading-relaxed text-slate-500">
              Open this ward to see attendance, subject CA progress, fees, homework status, notices, and where support may be needed.
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              <Link href={`/parent/children/${child.id}`} className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-black text-white">
                Open ward checkup
              </Link>
              <Link href="/parent/finance" className="rounded-xl border border-gray-200 px-3 py-2 text-xs font-black text-gray-600">
                Fees
              </Link>
              <Link href={`/list/report-cards?childId=${child.id}`} className="rounded-xl border border-gray-200 px-3 py-2 text-xs font-black text-gray-600">
                Results
              </Link>
            </div>
          </article>
        );
      })}
    </section>
  );
}

function UrgentAlerts({ alerts }: { alerts: ParentRiskAlert[] }) {
  if (alerts.length === 0) return null;

  return (
    <section className="rounded-2xl border border-rose-100 bg-rose-50 p-4">
      <div className="mb-3 flex items-center gap-2">
        <ShieldAlert size={18} className="text-rose-600" />
        <h2 className="text-sm font-black text-rose-800">Needs Attention</h2>
      </div>
      <div className="space-y-2">
        {alerts.slice(0, 3).map((alert) => (
          <Link key={alert.id} href={alert.href} className="block rounded-xl bg-white px-3 py-3">
            <p className="text-sm font-black text-gray-900">{alert.title}</p>
            <p className="mt-0.5 text-xs font-semibold text-gray-500">{alert.description}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}

function ParentActionCues({ cues }: { cues: (ParentActionCue & { childName?: string })[] }) {
  if (cues.length === 0) return null;

  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-black text-gray-900">What to do next</h2>
      <p className="mt-1 text-xs font-semibold text-gray-400">A short action list based on today&apos;s school records.</p>
      <div className="mt-3 grid gap-2 md:grid-cols-2">
        {cues.slice(0, 4).map((cue) => (
          <Link key={cue.id} href={cue.href} className={`rounded-xl p-3 ring-1 transition hover:scale-[1.01] ${actionCueToneClass(cue.tone)}`}>
            <p className="text-sm font-black">{cue.childName ? `${cue.childName}: ${cue.label}` : cue.label}</p>
            <p className="mt-1 text-xs font-semibold leading-relaxed opacity-80">{cue.detail}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}

const ParentPage = async () => {
  const { userId, schoolId } = await requirePageSession(["parent"]);
  const [{ parent, childrenData, activityFeed, riskAlerts }, branding] = await Promise.all([
    getParentDashboardData(userId, schoolId),
    getSchoolBranding(schoolId),
  ]);
  const childCount = parent?.students.length ?? 0;
  const parentName = parent ? `${parent.name} ${parent.surname}` : "Parent";
  const actionCues = childrenData.flatMap((child) =>
    child.actionCues.map((cue) => ({
      ...cue,
      childName: `${child.name} ${child.surname}`,
    })),
  );

  return (
    <div className="flex flex-col gap-5 p-4">
      <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <p className="text-xs font-black uppercase tracking-widest text-gray-400">Parent Portal</p>
        <h1 className="mt-2 text-2xl font-black text-gray-900">Hello, {parentName}</h1>
        <p className="mt-1 text-sm font-semibold text-gray-500">
          {childCount} child{childCount !== 1 ? "ren" : ""} linked at {branding.displayName}. Start with today&apos;s update, then open a ward only when you need more detail.
        </p>
      </section>

      <TodayUpdateCard items={activityFeed} schoolName={branding.displayName} />
      <UrgentAlerts alerts={riskAlerts} />
      <ParentActionCues cues={actionCues} />
      <ChildrenSnapshot childrenData={childrenData} />

      <section className="grid gap-3 sm:grid-cols-3">
        <Link href="/parent/updates" className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition hover:border-sky-200 hover:bg-sky-50">
          <BellRing className="h-5 w-5 text-sky-600" />
          <p className="mt-3 text-sm font-black text-gray-900">Today&apos;s Update</p>
          <p className="mt-1 text-xs font-semibold text-gray-400">Attendance, academics, fees, homework, and notices.</p>
        </Link>
        <Link href="/parent/finance" className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition hover:border-amber-200 hover:bg-amber-50">
          <WalletCards className="h-5 w-5 text-amber-600" />
          <p className="mt-3 text-sm font-black text-gray-900">Fees</p>
          <p className="mt-1 text-xs font-semibold text-gray-400">View bills, payments, and balances.</p>
        </Link>
        <Link href="/list/report-cards" className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition hover:border-blue-200 hover:bg-blue-50">
          <Award className="h-5 w-5 text-blue-600" />
          <p className="mt-3 text-sm font-black text-gray-900">Results</p>
          <p className="mt-1 text-xs font-semibold text-gray-400">Open published reports and academic progress.</p>
        </Link>
      </section>
    </div>
  );
};

export default ParentPage;
