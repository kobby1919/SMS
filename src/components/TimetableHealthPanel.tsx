import type { TimetableHealthSummary } from "@/src/lib/services/timetable-health";
import { AlertTriangle, CheckCircle2, ShieldCheck } from "lucide-react";

type Props = {
  health: TimetableHealthSummary;
};

const statusCopy = {
  HEALTHY: {
    label: "Healthy",
    tone: "border-emerald-200 bg-emerald-50 text-emerald-800",
    icon: CheckCircle2,
    message: "Your timetable is clean enough to power attendance, CA, homework, and Today’s Pulse.",
  },
  NEEDS_REVIEW: {
    label: "Needs review",
    tone: "border-amber-200 bg-amber-50 text-amber-900",
    icon: AlertTriangle,
    message: "The timetable can still run, but some setup gaps may confuse teachers or dashboards.",
  },
  CRITICAL: {
    label: "Critical",
    tone: "border-rose-200 bg-rose-50 text-rose-800",
    icon: AlertTriangle,
    message: "Fix the critical timetable issues before relying on attendance, CA, homework, or owner dashboard numbers.",
  },
} as const;

export default function TimetableHealthPanel({ health }: Props) {
  const status = statusCopy[health.status];
  const StatusIcon = status.icon;
  const criticalIssues = health.issues.filter((issue) => issue.severity === "critical");
  const warningIssues = health.issues.filter((issue) => issue.severity === "warning");
  const previewIssues = health.issues.slice(0, 5);

  const renderIssue = (issue: TimetableHealthSummary["issues"][number]) => (
    <div key={issue.id} className="flex flex-col gap-2 bg-white px-3 py-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <p className="text-sm font-black text-gray-950">{issue.title}</p>
        <p className="mt-1 text-sm font-semibold leading-6 text-gray-500">{issue.detail}</p>
      </div>
      <span
        className={`w-fit shrink-0 rounded-full px-2.5 py-1 text-[11px] font-black uppercase ${
          issue.severity === "critical"
            ? "bg-rose-50 text-rose-700"
            : "bg-amber-50 text-amber-700"
        }`}
      >
        {issue.severity}
      </span>
    </div>
  );

  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gray-950 text-white">
            <ShieldCheck size={18} />
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-gray-400">Timetable health</p>
            <h2 className="mt-1 text-lg font-black text-gray-950">Source-of-truth check</h2>
            <p className="mt-1 max-w-3xl text-sm font-semibold leading-6 text-gray-500">
              Edujay checks whether this timetable is safe enough to drive attendance, CA, homework,
              syllabus, parent updates, and the owner dashboard.
            </p>
          </div>
        </div>

        <div className={`rounded-xl border px-4 py-3 ${status.tone}`}>
          <div className="flex items-center gap-2">
            <StatusIcon size={16} />
            <p className="text-sm font-black">{status.label}</p>
          </div>
          <p className="mt-1 text-xs font-bold opacity-80">{health.score}% health score</p>
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {[
          ["Lessons", health.totalLessons],
          ["Critical", health.criticalCount],
          ["Warnings", health.warningCount],
          ["Active days", health.activeDayLabel],
          ["School hours", health.schoolHoursLabel],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl bg-gray-50 px-3 py-2.5">
            <p className="text-[11px] font-black uppercase tracking-wide text-gray-400">{label}</p>
            <p className="mt-1 text-sm font-black text-gray-900">{value}</p>
          </div>
        ))}
      </div>

      <div className={`mt-4 rounded-xl border px-3 py-2.5 ${status.tone}`}>
        <p className="text-sm font-bold leading-6">{status.message}</p>
      </div>

      {health.issues.length > 0 ? (
        <div className="mt-4 space-y-3">
          <div className="divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-100">
            {previewIssues.map(renderIssue)}
          </div>

          {health.issues.length > previewIssues.length ? (
            <div className="grid gap-3 lg:grid-cols-2">
              {criticalIssues.length > 0 ? (
                <details className="rounded-xl border border-rose-100 bg-rose-50/60">
                  <summary className="cursor-pointer px-3 py-3 text-sm font-black text-rose-800">
                    View all critical issues ({criticalIssues.length})
                  </summary>
                  <div className="divide-y divide-rose-100 border-t border-rose-100 bg-white">
                    {criticalIssues.map(renderIssue)}
                  </div>
                </details>
              ) : null}

              {warningIssues.length > 0 ? (
                <details className="rounded-xl border border-amber-100 bg-amber-50/60">
                  <summary className="cursor-pointer px-3 py-3 text-sm font-black text-amber-800">
                    View all warnings ({warningIssues.length})
                  </summary>
                  <div className="divide-y divide-amber-100 border-t border-amber-100 bg-white">
                    {warningIssues.map(renderIssue)}
                  </div>
                </details>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-3">
          <p className="text-sm font-bold text-emerald-800">
            No timetable health issues found.
          </p>
        </div>
      )}
    </section>
  );
}
