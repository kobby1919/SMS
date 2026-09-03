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
  type TeacherWeeklyDayGroup,
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

function typeLabel(type: string) {
  if (type === "ATTENDANCE") return "Attendance";
  if (type === "CA_SCORE_PUBLISHING") return "CA scores";
  if (type === "HOMEWORK_CHECKING") return "Homework";
  if (type === "SYLLABUS_PROGRESS") return "Syllabus";
  if (type === "EXAM_ENTRY") return "Exam entry";
  return type.replaceAll("_", " ");
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

function DutyRowItem({ row, showType = false }: { row: TeacherDutyRow; showType?: boolean }) {
  return (
    <div className="py-3 first:pt-0 last:pb-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          {(showType || row.escalationStatus) && (
            <div className="flex flex-wrap items-center gap-2">
              {showType ? (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-slate-600">
                  {typeLabel(row.type)}
                </span>
              ) : null}
              {row.escalationStatus ? (
                <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-rose-700">
                  Escalated
                </span>
              ) : null}
            </div>
          )}
          <p className={(showType || row.escalationStatus) ? "mt-2 font-black text-slate-950" : "font-black text-slate-950"}>
            {row.title}
          </p>
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
          {row.escalationReason ? (
            <p className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
              {row.escalationReason}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-2.5 py-1 text-xs font-black ${statusClass(row.status)}`}>
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
            <DutyRowItem key={row.id} row={row} />
          ))}
        </div>
      )}
    </section>
  );
}

function TodayDutiesPanel({ rows }: { rows: TeacherDutyRow[] }) {
  const hasNonAttendanceDuty = rows.some((row) => row.type !== "ATTENDANCE");
  if (!hasNonAttendanceDuty) {
    return (
      <DutyList
        title="Today's Duties"
        rows={rows}
        empty="No duty has been assigned to you today."
      />
    );
  }

  const typeOrder = ["ATTENDANCE", "CA_SCORE_PUBLISHING", "HOMEWORK_CHECKING", "SYLLABUS_PROGRESS", "EXAM_ENTRY"];
  const groups = typeOrder
    .map((type) => {
      const groupRows = rows.filter((row) => row.type === type);
      return {
        type,
        rows: groupRows,
        issueCount: groupRows.filter((row) => row.status === "MISSED" || row.status === "ESCALATED" || row.escalationStatus).length,
      };
    })
    .filter((group) => group.rows.length > 0);

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <div className="rounded-lg bg-slate-100 p-2 text-slate-700">
          <Clock3 size={18} />
        </div>
        <div>
          <h2 className="text-base font-black text-slate-950">Today&apos;s Duties</h2>
          <p className="text-sm font-semibold text-slate-500">
            Grouped so attendance, CA, and homework do not become one long list.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        {groups.map((group) => (
          <details
            key={group.type}
            open={group.issueCount > 0}
            className={`rounded-lg border ${group.issueCount > 0 ? "border-rose-200 bg-rose-50/40" : "border-slate-200 bg-slate-50"}`}
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
              <span>
                <span className="block text-sm font-black text-slate-950">
                  {typeLabel(group.type)}
                </span>
                <span className="mt-1 block text-xs font-semibold text-slate-500">
                  {group.rows.length} dut{group.rows.length === 1 ? "y" : "ies"}
                  {group.issueCount > 0 ? ` · ${group.issueCount} issue${group.issueCount === 1 ? "" : "s"}` : ""}
                </span>
              </span>
              <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-black text-slate-600">
                Open
              </span>
            </summary>
            <div className="divide-y divide-slate-100 border-t border-white/70 bg-white px-4 py-2">
              {group.rows.map((row) => (
                <DutyRowItem key={row.id} row={row} />
              ))}
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}

function EscalationDayBreakdown({ days }: { days: TeacherWeeklyDayGroup[] }) {
  const dayGroups = days.map((day) => ({
    ...day,
    rows: day.rows.filter((row) => row.status === "ESCALATED" || row.escalationStatus),
  }));
  const escalationCount = dayGroups.reduce((total, day) => total + day.rows.length, 0);

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <div className="rounded-lg bg-rose-50 p-2 text-rose-700">
          <AlertTriangle size={18} />
        </div>
        <div>
          <h2 className="text-base font-black text-slate-950">Escalations</h2>
          <p className="text-sm font-semibold text-slate-500">
            {escalationCount} escalation{escalationCount === 1 ? "" : "s"} recorded this week.
          </p>
        </div>
      </div>

      {escalationCount === 0 ? (
        <EmptyState message="No escalation is attached to you this week." />
      ) : (
        <div className="space-y-2">
          {dayGroups.map((day) => (
            <details
              key={day.key}
              open={day.isToday && day.rows.length > 0}
              className={`rounded-lg border ${day.rows.length > 0 ? "border-rose-200 bg-rose-50/40" : "border-slate-200 bg-slate-50"}`}
            >
              <summary className="flex cursor-pointer list-none flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <span>
                  <span className="block text-sm font-black text-slate-950">
                    {day.label}
                    {day.isToday ? " · Today" : ""}
                  </span>
                  <span className="mt-1 block text-xs font-semibold text-slate-500">
                    {day.rows.length === 0
                      ? "No escalation"
                      : `${day.rows.length} escalation${day.rows.length === 1 ? "" : "s"}`}
                  </span>
                </span>
                <span className="inline-flex w-fit rounded-full bg-white px-2.5 py-1 text-[11px] font-black uppercase tracking-wide text-slate-600">
                  {day.shortLabel}
                </span>
              </summary>

              <div className="border-t border-white/70 bg-white px-4 py-2">
                {day.rows.length === 0 ? (
                  <p className="py-3 text-sm font-semibold text-slate-400">
                    No escalation was raised on this day.
                  </p>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {day.rows.map((row) => (
                      <DutyRowItem key={row.id} row={row} showType />
                    ))}
                  </div>
                )}
              </div>
            </details>
          ))}
        </div>
      )}
    </section>
  );
}

function WeeklyDayBreakdown({ days }: { days: TeacherWeeklyDayGroup[] }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-base font-black text-slate-950">This Week</h2>
          <p className="text-sm font-semibold text-slate-500">
            Open each day to see the duties, missed work, and escalations for that date.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        {days.map((day) => {
          const tone =
            day.issueCount > 0
              ? "border-rose-200 bg-rose-50/40"
              : day.pendingCount > 0
                ? "border-amber-200 bg-amber-50/40"
                : day.total > 0
                  ? "border-emerald-200 bg-emerald-50/40"
                  : "border-slate-200 bg-slate-50";

          return (
            <details
              key={day.key}
              open={day.isToday}
              className={`rounded-lg border ${tone}`}
            >
              <summary className="flex cursor-pointer list-none flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <span>
                  <span className="block text-sm font-black text-slate-950">
                    {day.label}
                    {day.isToday ? " · Today" : ""}
                  </span>
                  <span className="mt-1 block text-xs font-semibold text-slate-500">
                    {day.total === 0
                      ? "No duty recorded"
                      : `${day.total} dut${day.total === 1 ? "y" : "ies"} · ${day.pendingCount} pending · ${day.issueCount} issue${day.issueCount === 1 ? "" : "s"}`}
                  </span>
                </span>
                <span className="inline-flex w-fit rounded-full bg-white px-2.5 py-1 text-[11px] font-black uppercase tracking-wide text-slate-600">
                  {day.shortLabel}
                </span>
              </summary>

              <div className="border-t border-white/70 bg-white px-4 py-2">
                {day.rows.length === 0 ? (
                  <p className="py-3 text-sm font-semibold text-slate-400">
                    Nothing was expected on this day.
                  </p>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {day.rows.map((row) => (
                      <DutyRowItem key={row.id} row={row} showType />
                    ))}
                  </div>
                )}
              </div>
            </details>
          );
        })}
      </div>
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
              {row.dutyExpectedAt ? (
                <p className="mt-1 text-xs font-black uppercase tracking-wide text-slate-400">
                  Duty date: {formatDateTime(row.dutyExpectedAt)}
                </p>
              ) : null}
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
          label="Week Escalations"
          value={overview.totals.weeklyEscalations}
          helper={`${overview.totals.openEscalations} still open`}
          tone={overview.totals.weeklyEscalations > 0 ? "red" : "green"}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <TodayDutiesPanel rows={overview.todayDuties} />
        <EscalationDayBreakdown days={overview.weeklyDays} />
      </div>

      <WeeklyDayBreakdown days={overview.weeklyDays} />

      <AuditList rows={overview.auditTrail} />
    </div>
  );
};

export default TeacherAccountabilityPage;
