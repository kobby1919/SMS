import Link from "next/link";
import {
  AlertTriangle,
  Clock3,
  ExternalLink,
  ShieldCheck,
  TimerReset,
} from "lucide-react";
import { requirePageSession } from "@/src/lib/authz";
import { prepareTeacherAccountabilityForView } from "@/src/lib/services/teacher-accountability-view";
import {
  getTeacherSelfAccountabilityOverview,
  type TeacherAuditRow,
  type TeacherDutyRow,
  type TeacherEscalationRow,
} from "@/src/lib/queries/teacher-self-accountability";

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

function DutyList({
  title,
  rows,
  empty,
}: {
  title: string;
  rows: TeacherDutyRow[];
  empty: string;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <div className="rounded-lg bg-slate-100 p-2 text-slate-700">
          <Clock3 size={18} />
        </div>
        <h2 className="text-base font-black text-slate-950">{title}</h2>
      </div>

      {rows.length === 0 ? (
        <EmptyState message={empty} />
      ) : (
        <div className="divide-y divide-slate-100">
          {rows.map((row) => (
            <div key={row.id} className="py-3 first:pt-0 last:pb-0">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="font-black text-slate-950">{row.title}</p>
                  <p className="mt-1 text-sm font-semibold text-slate-600">
                    {row.className ?? "Class"} - {row.subjectName ?? "Subject"}
                  </p>
                  <p className="mt-1 text-xs font-bold text-slate-400">
                    Due: {formatDateTime(row.expectedAt)}
                  </p>
                  {row.studentCount !== null ? (
                    <p className="mt-1 text-xs font-bold text-slate-500">
                      {row.attendanceCount ?? 0}/{row.studentCount} records submitted
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-black ${statusClass(row.status)}`}
                  >
                    {row.status.replaceAll("_", " ")}
                  </span>
                  <Link
                    href={row.actionHref}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-slate-950 px-3 py-2 text-xs font-black text-white transition hover:bg-slate-700"
                  >
                    Open <ExternalLink size={14} />
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function EscalationList({ rows }: { rows: TeacherEscalationRow[] }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <div className="rounded-lg bg-rose-50 p-2 text-rose-700">
          <AlertTriangle size={18} />
        </div>
        <h2 className="text-base font-black text-slate-950">Escalations</h2>
      </div>

      {rows.length === 0 ? (
        <EmptyState message="No open escalation is attached to you." />
      ) : (
        <div className="divide-y divide-slate-100">
          {rows.map((row) => (
            <div key={row.id} className="py-3 first:pt-0 last:pb-0">
              <p className="font-black text-slate-950">{row.obligationTitle}</p>
              <p className="mt-1 text-sm font-medium text-slate-600">{row.reason}</p>
              <p className="mt-2 text-xs font-bold text-slate-400">
                Escalated: {formatDateTime(row.escalatedAt)}
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function AuditList({ rows }: { rows: TeacherAuditRow[] }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <div className="rounded-lg bg-slate-100 p-2 text-slate-700">
          <TimerReset size={18} />
        </div>
        <h2 className="text-base font-black text-slate-950">My Audit Trail</h2>
      </div>

      {rows.length === 0 ? (
        <EmptyState message="No accountability history has been recorded yet." />
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

const TeacherAccountabilityPage = async () => {
  const { userId, schoolId } = await requirePageSession(["teacher"]);
  await prepareTeacherAccountabilityForView({
    schoolId,
    teacherId: userId,
  });
  const overview = await getTeacherSelfAccountabilityOverview({
    schoolId,
    teacherId: userId,
  });

  return (
    <div className="flex flex-col gap-5 p-4">
      <div className="rounded-lg border border-slate-200 bg-slate-950 p-5 text-white shadow-sm">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-sky-400/10 p-2 text-sky-200">
            <ShieldCheck size={20} />
          </div>
          <div>
            <h1 className="text-xl font-black">My Accountability</h1>
            <p className="mt-1 max-w-3xl text-sm font-medium leading-relaxed text-slate-300">
              Track your duties, escalations, weekly reliability, and audit
              history in one simple place.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Reliability"
          value={overview.totals.reliabilityScore}
          helper="Weekly score based on submitted duties"
          tone={overview.totals.reliabilityScore >= 80 ? "green" : "amber"}
        />
        <StatCard
          label="Today"
          value={overview.totals.today}
          helper="Duties expected today"
          tone="blue"
        />
        <StatCard
          label="Pending"
          value={overview.totals.pending}
          helper="Still waiting this week"
          tone={overview.totals.pending > 0 ? "amber" : "green"}
        />
        <StatCard
          label="Escalations"
          value={overview.totals.openEscalations}
          helper="Open issues needing admin attention"
          tone={overview.totals.openEscalations > 0 ? "red" : "green"}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <DutyList
          title="Today's Duties"
          rows={overview.todayDuties}
          empty="No duty has been assigned to you today."
        />
        <EscalationList rows={overview.escalations} />
      </div>

      <div className="grid gap-5">
        <DutyList
          title="Weekly Issues"
          rows={overview.weeklyIssues}
          empty="No late, missed, or escalated duty is attached to you this week."
        />
      </div>

      <AuditList rows={overview.auditTrail} />
    </div>
  );
};

export default TeacherAccountabilityPage;
