import Link from "next/link";
import type { ReactNode } from "react";
import {
  AlertTriangle,
  BellRing,
  Clock3,
  ExternalLink,
  ShieldCheck,
  TimerReset,
} from "lucide-react";
import { requirePageSession } from "@/src/lib/authz";
import {
  getTeacherAccountabilityOverview,
  type AccountabilityAuditRow,
  type AccountabilityEscalationRow,
  type AccountabilityObligationRow,
  type TeacherAccountabilitySummaryRow,
} from "@/src/lib/queries/teacher-accountability-dashboard";
import TeacherEscalationActions from "@/src/components/TeacherEscalationActions";

export const dynamic = "force-dynamic";

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("en-GH", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function statusClass(status: string) {
  if (status === "COMPLETED") return "bg-emerald-50 text-emerald-700";
  if (status === "COMPLETED_LATE") return "bg-amber-50 text-amber-700";
  if (status === "MISSED" || status === "ESCALATED") {
    return "bg-rose-50 text-rose-700";
  }
  return "bg-slate-100 text-slate-700";
}

function escalationReviewHref(escalationId: string) {
  return `/admin/accountability?escalationId=${encodeURIComponent(escalationId)}`;
}

function StatCard({
  label,
  value,
  helper,
  tone = "slate",
}: {
  label: string;
  value: number;
  helper: string;
  tone?: "slate" | "green" | "amber" | "red" | "blue";
}) {
  const toneClass = {
    slate: "bg-white text-slate-950",
    green: "bg-emerald-50 text-emerald-900",
    amber: "bg-amber-50 text-amber-900",
    red: "bg-rose-50 text-rose-900",
    blue: "bg-sky-50 text-sky-900",
  }[tone];

  return (
    <div className={`rounded-lg border border-slate-200 p-4 shadow-sm ${toneClass}`}>
      <p className="text-xs font-black uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-3xl font-black">{value}</p>
      <p className="mt-1 text-sm font-medium text-slate-600">{helper}</p>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-5 text-sm font-semibold text-slate-500">
      {message}
    </div>
  );
}

function ObligationList({
  title,
  rows,
  icon,
}: {
  title: string;
  rows: AccountabilityObligationRow[];
  icon: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <div className="rounded-lg bg-slate-100 p-2 text-slate-700">{icon}</div>
        <h2 className="text-base font-black text-slate-950">{title}</h2>
      </div>

      {rows.length === 0 ? (
        <EmptyState message="No records in this section right now." />
      ) : (
        <div className="divide-y divide-slate-100">
          {rows.map((row) => (
            <div key={row.id} className="py-3 first:pt-0 last:pb-0">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="font-black text-slate-950">{row.title}</p>
                  <p className="mt-1 text-sm font-semibold text-slate-600">
                    {row.teacherName}
                    {row.className ? ` - ${row.className}` : ""}
                    {row.subjectName ? ` - ${row.subjectName}` : ""}
                  </p>
                  <p className="mt-1 text-xs font-bold text-slate-400">
                    Expected: {formatDateTime(row.expectedAt)}
                  </p>
                </div>
                <span
                  className={`w-fit rounded-full px-2.5 py-1 text-xs font-black ${statusClass(row.status)}`}
                >
                  {row.status.replaceAll("_", " ")}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold text-slate-500">
                <span>{row.attendanceCount ?? 0}/{row.studentCount ?? 0} marked</span>
                <span>{row.reminderCount} reminders</span>
                <span>{row.escalationCount} escalations</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function TeacherSummaryTable({ rows }: { rows: TeacherAccountabilitySummaryRow[] }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <div className="rounded-lg bg-slate-100 p-2 text-slate-700">
          <ShieldCheck size={18} />
        </div>
        <h2 className="text-base font-black text-slate-950">
          Weekly Teacher Reliability
        </h2>
      </div>

      {rows.length === 0 ? (
        <EmptyState message="No weekly teacher accountability data yet." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs font-black uppercase tracking-wide text-slate-400">
                <th className="py-2">Teacher</th>
                <th className="py-2">Score</th>
                <th className="py-2">Total</th>
                <th className="py-2">On Time</th>
                <th className="py-2">Late</th>
                <th className="py-2">Missed</th>
                <th className="py-2">Escalated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => (
                <tr key={row.teacherId}>
                  <td className="py-3 font-black text-slate-900">{row.teacherName}</td>
                  <td className="py-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-black ${
                        row.reliabilityScore >= 80
                          ? "bg-emerald-50 text-emerald-700"
                          : row.reliabilityScore >= 60
                            ? "bg-amber-50 text-amber-700"
                            : "bg-rose-50 text-rose-700"
                      }`}
                    >
                      {row.reliabilityScore}%
                    </span>
                  </td>
                  <td className="py-3 font-semibold text-slate-600">{row.total}</td>
                  <td className="py-3 font-semibold text-slate-600">{row.completed}</td>
                  <td className="py-3 font-semibold text-slate-600">{row.completedLate}</td>
                  <td className="py-3 font-semibold text-slate-600">{row.missed}</td>
                  <td className="py-3 font-semibold text-slate-600">{row.escalated}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function EscalationList({
  rows,
  focusedEscalationId,
}: {
  rows: AccountabilityEscalationRow[];
  focusedEscalationId?: string;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <div className="rounded-lg bg-rose-50 p-2 text-rose-700">
          <AlertTriangle size={18} />
        </div>
        <h2 className="text-base font-black text-slate-950">Open Escalations</h2>
      </div>

      {rows.length === 0 ? (
        <EmptyState message="No open escalations. Good discipline so far." />
      ) : (
        <div className="divide-y divide-slate-100">
          {rows.map((row) => {
            const isFocused = row.id === focusedEscalationId;
            return (
            <div
              key={row.id}
              id={`escalation-${row.id}`}
              className={`py-3 first:pt-0 last:pb-0 ${isFocused ? "rounded-lg bg-sky-50 px-3 ring-2 ring-sky-200" : ""}`}
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-black text-slate-950">{row.teacherName}</p>
                    {isFocused ? (
                      <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-sky-700">
                        Selected review
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-sm font-semibold text-slate-600">
                    {row.obligationTitle}
                  </p>
                  <p className="mt-1 text-sm font-medium text-slate-500">{row.reason}</p>
                  <p className="mt-2 text-xs font-bold text-slate-400">
                    Escalated: {formatDateTime(row.escalatedAt)}
                  </p>
                </div>
                <span
                  className={`w-fit rounded-full px-2.5 py-1 text-xs font-black ${statusClass(row.status)}`}
                >
                  {row.status.replaceAll("_", " ")}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link
                  href={escalationReviewHref(row.id)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-slate-950 px-3 py-2 text-xs font-black text-white transition hover:bg-slate-700"
                >
                  Review <ExternalLink size={14} />
                </Link>
              </div>
              {isFocused && ["OPEN", "ACKNOWLEDGED"].includes(row.status) ? (
                <TeacherEscalationActions escalationId={row.id} />
              ) : null}
              {isFocused && ["RESOLVED", "DISMISSED"].includes(row.status) ? (
                <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
                  This escalation is already closed, so no further review action is needed.
                </p>
              ) : null}
            </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function AuditList({ rows }: { rows: AccountabilityAuditRow[] }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <div className="rounded-lg bg-slate-100 p-2 text-slate-700">
          <TimerReset size={18} />
        </div>
        <h2 className="text-base font-black text-slate-950">Recent Audit Trail</h2>
      </div>

      {rows.length === 0 ? (
        <EmptyState message="No accountability audit records yet." />
      ) : (
        <div className="divide-y divide-slate-100">
          {rows.map((row) => (
            <div key={row.id} className="py-3 first:pt-0 last:pb-0">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <p className="font-black text-slate-900">
                  {row.action.replaceAll("_", " ")}
                </p>
                <p className="text-xs font-bold text-slate-400">
                  {formatDateTime(row.createdAt)}
                </p>
              </div>
              <p className="mt-1 text-sm font-semibold text-slate-600">
                {row.teacherName ?? "System"}
              </p>
              {row.message ? (
                <p className="mt-1 text-sm font-medium text-slate-500">
                  {row.message}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

const AdminAccountabilityPage = async ({
  searchParams,
}: {
  searchParams: Promise<{ escalationId?: string }>;
}) => {
  const { escalationId: focusedEscalationId } = await searchParams;
  const { schoolId } = await requirePageSession(["admin"]);
  const overview = await getTeacherAccountabilityOverview(schoolId, new Date(), {
    focusedEscalationId,
  });

  return (
    <div className="flex flex-col gap-5 p-4">
      <div className="rounded-lg border border-slate-200 bg-slate-950 p-5 text-white shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-sky-400/10 p-2 text-sky-200">
              <ShieldCheck size={20} />
            </div>
            <div>
              <h1 className="text-xl font-black">Teacher Accountability</h1>
              <p className="mt-1 max-w-3xl text-sm font-medium leading-relaxed text-slate-300">
                Monitor attendance, CA publishing, late submissions, reminders,
                escalations, and teacher reliability from one place.
              </p>
              {focusedEscalationId ? (
                <p className="mt-3 rounded-lg bg-sky-400/10 px-3 py-2 text-xs font-black text-sky-100">
                  Opened one escalation for review. The selected item is highlighted below.
                </p>
              ) : null}
            </div>
          </div>
          <Link
            href="/admin/accountability-settings"
            className="inline-flex w-fit items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-black text-slate-950 transition hover:bg-slate-100"
          >
            Policy settings <ExternalLink size={16} />
          </Link>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Today"
          value={overview.totals.today}
          helper="Teacher duties tracked today"
          tone="blue"
        />
        <StatCard
          label="Completed"
          value={overview.totals.completed}
          helper="Submitted inside the expected window"
          tone="green"
        />
        <StatCard
          label="Late / Missed"
          value={overview.totals.completedLate + overview.totals.missed}
          helper="Needs closer management attention"
          tone="amber"
        />
        <StatCard
          label="Escalations"
          value={overview.totals.openEscalations}
          helper={`${overview.totals.remindersPending} reminder(s) queued`}
          tone="red"
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <ObligationList
          title="Pending Teacher Duties"
          rows={overview.upcoming}
          icon={<Clock3 size={18} />}
        />
        <EscalationList
          rows={overview.openEscalations}
          focusedEscalationId={focusedEscalationId}
        />
      </div>

      <TeacherSummaryTable rows={overview.teacherSummaries} />

      <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <ObligationList
          title="Weekly Issues"
          rows={overview.issues}
          icon={<BellRing size={18} />}
        />
        <AuditList rows={overview.recentAuditLogs} />
      </div>
    </div>
  );
};

export default AdminAccountabilityPage;
