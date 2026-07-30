import Link from "next/link";
import {
  Award,
  BellRing,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Megaphone,
  ShieldAlert,
  WalletCards,
} from "lucide-react";
import WelcomeBanner from "@/src/components/WelcomeBanner";
import { requirePageSession } from "@/src/lib/authz";
import {
  getParentDashboardData,
  type ParentActivityFeedItem,
  type ParentRiskAlert,
} from "@/src/lib/services/parent-dashboard";

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

function TodayUpdateCard({ items }: { items: ParentActivityFeedItem[] }) {
  const latestSummary = items.find((item) => item.type === "DAILY_SUMMARY");
  const fallbackItems = items.filter((item) => item.type !== "DAILY_SUMMARY").slice(0, 3);
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
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <p className="text-[11px] font-black uppercase tracking-widest text-sky-300">
            Parent Daily Summary
          </p>
          <h1 className="mt-2 text-2xl font-black sm:text-3xl">Today&apos;s School Update</h1>
          <p className="mt-2 text-sm font-medium leading-relaxed text-slate-300">
            A simple summary of what happened at school today. Full details are kept on a separate page so this dashboard stays clean.
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
        const latestAverage = child.ca.latestGroup?.avgScore;
        return (
          <div key={child.id} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
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

            <div className="mt-4 grid grid-cols-3 gap-2">
              <div className="rounded-xl bg-emerald-50 px-3 py-3 text-emerald-700">
                <p className="text-lg font-black">{child.stats.rate}%</p>
                <p className="text-[10px] font-black uppercase">Attendance</p>
              </div>
              <div className="rounded-xl bg-sky-50 px-3 py-3 text-sky-700">
                <p className="text-lg font-black">{latestAverage ?? "-"}{latestAverage ? "%" : ""}</p>
                <p className="text-[10px] font-black uppercase">CA Avg</p>
              </div>
              <div className="rounded-xl bg-amber-50 px-3 py-3 text-amber-700">
                <p className="text-lg font-black">{outstanding > 0 ? "Due" : "OK"}</p>
                <p className="text-[10px] font-black uppercase">Fees</p>
              </div>
            </div>
          </div>
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

const ParentPage = async () => {
  const { userId, schoolId } = await requirePageSession(["parent"]);
  const { parent, childrenData, activityFeed, riskAlerts } = await getParentDashboardData(userId, schoolId);
  const childCount = parent?.students.length ?? 0;
  const parentName = parent ? `${parent.name} ${parent.surname}` : "Parent";

  return (
    <div className="flex flex-col gap-5 p-4">
      <WelcomeBanner
        role="parent"
        name={parentName}
        subtitle={`${childCount} child${childCount !== 1 ? "ren" : ""} enrolled - daily school transparency`}
        tag="Parent Portal"
      />

      <TodayUpdateCard items={activityFeed} />
      <UrgentAlerts alerts={riskAlerts} />
      <ChildrenSnapshot childrenData={childrenData} />

      <section className="grid gap-3 sm:grid-cols-3">
        <Link href="/parent/updates" className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition hover:border-sky-200 hover:bg-sky-50">
          <BellRing className="h-5 w-5 text-sky-600" />
          <p className="mt-3 text-sm font-black text-gray-900">Daily Updates</p>
          <p className="mt-1 text-xs font-semibold text-gray-400">See everything that happened today.</p>
        </Link>
        <Link href="/list/attendance" className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition hover:border-emerald-200 hover:bg-emerald-50">
          <CalendarDays className="h-5 w-5 text-emerald-600" />
          <p className="mt-3 text-sm font-black text-gray-900">Attendance</p>
          <p className="mt-1 text-xs font-semibold text-gray-400">Check attendance history.</p>
        </Link>
        <Link href="/list/finance/bills" className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition hover:border-amber-200 hover:bg-amber-50">
          <WalletCards className="h-5 w-5 text-amber-600" />
          <p className="mt-3 text-sm font-black text-gray-900">Fees</p>
          <p className="mt-1 text-xs font-semibold text-gray-400">View bills, payments, and balances.</p>
        </Link>
      </section>
    </div>
  );
};

export default ParentPage;
