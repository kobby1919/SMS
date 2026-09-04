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
  type TeacherHistoryWeekGroup,
  type TeacherDutyRow,
} from "@/src/lib/queries/teacher-self-accountability";
import TeacherEscalationResponseForm from "@/src/components/TeacherEscalationResponseForm";

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

function obligationReviewHref(obligationId: string) {
  return `/teacher/accountability?obligationId=${encodeURIComponent(obligationId)}`;
}

function needsManagementReview(row: TeacherDutyRow) {
  return row.status === "ESCALATED" || Boolean(row.escalationStatus);
}

function needsTeacherAttention(row: TeacherDutyRow) {
  return (
    row.status === "MISSED" ||
    row.status === "ESCALATED" ||
    Boolean(row.escalationStatus) ||
    row.teacherResponseStatus === "NEEDS_MORE_INFO"
  );
}

function dutyActionLabel(row: TeacherDutyRow) {
  if (needsManagementReview(row)) {
    if (row.teacherResponseStatus === "PENDING") return "View";
    return "Respond";
  }
  if (row.status === "COMPLETED" || row.status === "COMPLETED_LATE") {
    return "View";
  }
  return "Open";
}

function historyRowMatchesFocus(row: { actionHref: string }, focusedObligationId?: string) {
  if (!focusedObligationId) return false;
  return row.actionHref.includes(`obligationId=${encodeURIComponent(focusedObligationId)}`);
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

function DutyRowItem({
  row,
  showType = false,
  focusedObligationId,
  allowResponseForm = false,
}: {
  row: TeacherDutyRow;
  showType?: boolean;
  focusedObligationId?: string;
  allowResponseForm?: boolean;
}) {
  const isFocused = row.id === focusedObligationId;
  const href = needsManagementReview(row) ? obligationReviewHref(row.id) : row.actionHref;

  return (
    <div
      id={`obligation-${row.id}`}
      className={`py-3 first:pt-0 last:pb-0 ${isFocused ? "rounded-lg bg-sky-50 px-3 ring-2 ring-sky-200" : ""}`}
    >
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
          {row.teacherResponseStatus ? (
            <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">
              Response status: {row.teacherResponseStatus.replaceAll("_", " ")}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-2.5 py-1 text-xs font-black ${statusClass(row.status)}`}>
            {row.status.replaceAll("_", " ")}
          </span>
          <Link
            href={href}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-950 px-3 py-2 text-xs font-black text-white transition hover:bg-slate-700"
          >
            {dutyActionLabel(row)} <ExternalLink size={14} />
          </Link>
        </div>
      </div>
      {allowResponseForm && isFocused && needsManagementReview(row) ? (
        <TeacherEscalationResponseForm
          obligationId={row.id}
          existingStatus={row.teacherResponseStatus}
          existingReason={row.teacherResponseReason}
        />
      ) : null}
    </div>
  );
}

function NeedsAttentionPanel({
  rows,
  focusedObligationId,
}: {
  rows: TeacherDutyRow[];
  focusedObligationId?: string;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-start gap-2">
        <div className="rounded-lg bg-rose-50 p-2 text-rose-700">
          <AlertTriangle size={18} />
        </div>
        <div>
          <h2 className="text-base font-black text-slate-950">
            Recent Escalations
          </h2>
          <p className="text-sm font-semibold text-slate-500">
            Only duties that need a teacher response appear here.
          </p>
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState message="No escalation needs your response right now." />
      ) : (
        <div className="divide-y divide-slate-100">
          {rows.map((row) => (
            <DutyRowItem
              key={row.id}
              row={row}
              showType
              focusedObligationId={focusedObligationId}
              allowResponseForm
            />
          ))}
        </div>
      )}
    </section>
  );
}

function DutyList({
  title,
  rows,
  empty,
  focusedObligationId,
}: {
  title: string;
  rows: TeacherDutyRow[];
  empty: string;
  focusedObligationId?: string;
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
            <DutyRowItem key={row.id} row={row} focusedObligationId={focusedObligationId} />
          ))}
        </div>
      )}
    </section>
  );
}

function TodayDutiesPanel({
  rows,
  focusedObligationId,
}: {
  rows: TeacherDutyRow[];
  focusedObligationId?: string;
}) {
  const hasNonAttendanceDuty = rows.some((row) => row.type !== "ATTENDANCE");
  if (!hasNonAttendanceDuty) {
    return (
      <DutyList
        title="Today's Duties"
        rows={rows}
        empty="No duty has been assigned to you today."
        focusedObligationId={focusedObligationId}
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
            open={group.issueCount > 0 || group.rows.some((row) => row.id === focusedObligationId)}
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
                <DutyRowItem key={row.id} row={row} focusedObligationId={focusedObligationId} />
              ))}
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}

function HistorySection({
  weeks,
  focusedObligationId,
}: {
  weeks: TeacherHistoryWeekGroup[];
  focusedObligationId?: string;
}) {
  const total = weeks.reduce((count, week) => count + week.rows.length, 0);
  const hasFocusedHistory = weeks.some((week) =>
    week.rows.some((row) => historyRowMatchesFocus(row, focusedObligationId)),
  );

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <details open={hasFocusedHistory}>
        <summary className="flex cursor-pointer list-none flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <span className="flex items-center gap-2">
            <span className="rounded-lg bg-slate-100 p-2 text-slate-700">
              <TimerReset size={18} />
            </span>
            <span>
              <span className="block text-base font-black text-slate-950">
                Past Escalations
              </span>
              <span className="mt-1 block text-sm font-semibold text-slate-500">
                Closed issues and teacher responses, grouped by week.
              </span>
            </span>
          </span>
          <span className="inline-flex w-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">
            {total} event{total === 1 ? "" : "s"}
          </span>
        </summary>

        <div className="mt-4">
          {total === 0 ? (
            <EmptyState message="No past escalation history has been recorded yet." />
          ) : (
            <div className="space-y-2">
              {weeks.map((week) => (
                <details
                  key={week.key}
                  open={
                    week.rows.some((row) => historyRowMatchesFocus(row, focusedObligationId))
                  }
                  className={`rounded-lg border ${week.rows.length > 0 ? "border-slate-200 bg-slate-50" : "border-slate-100 bg-white"}`}
                >
                  <summary className="flex cursor-pointer list-none flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <span>
                      <span className="block text-sm font-black text-slate-950">
                        {week.label}
                      </span>
                      <span className="mt-1 block text-xs font-semibold text-slate-500">
                        {week.rows.length === 0
                          ? "No closed escalation"
                          : `${week.rows.length} event${week.rows.length === 1 ? "" : "s"} recorded`}
                      </span>
                    </span>
                    <span className="inline-flex w-fit rounded-full bg-white px-2.5 py-1 text-[11px] font-black uppercase tracking-wide text-slate-600">
                      Week
                    </span>
                  </summary>

                  <div className="border-t border-slate-100 bg-white px-4 py-2">
                    {week.rows.length === 0 ? (
                      <p className="py-3 text-sm font-semibold text-slate-400">
                        Nothing was closed in this week.
                      </p>
                    ) : (
                      <div className="divide-y divide-slate-100">
                        {week.rows.map((row) => {
                          const isFocused = historyRowMatchesFocus(row, focusedObligationId);
                          return (
                          <div
                            key={row.id}
                            className={`py-3 first:pt-0 last:pb-0 ${isFocused ? "rounded-lg bg-sky-50 px-3 ring-2 ring-sky-200" : ""}`}
                          >
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  {row.dutyType ? (
                                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-slate-600">
                                      {typeLabel(row.dutyType)}
                                    </span>
                                  ) : null}
                                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-slate-600">
                                    Recorded {formatDateTime(row.createdAt)}
                                  </span>
                                </div>
                                <p className="mt-2 font-black text-slate-950">
                                  {row.title}
                                </p>
                                {row.className || row.subjectName ? (
                                  <p className="mt-1 text-sm font-semibold text-slate-600">
                                    {row.className ?? "Class"} - {row.subjectName ?? "Subject"}
                                  </p>
                                ) : null}
                                {row.dutyExpectedAt ? (
                                  <p className="mt-1 text-xs font-bold text-slate-400">
                                    Duty due: {formatDateTime(row.dutyExpectedAt)}
                                  </p>
                                ) : null}
                                {row.message ? (
                                  <p className="mt-2 text-sm font-medium text-slate-500">
                                    {row.message}
                                  </p>
                                ) : null}
                                {row.nextStep ? (
                                  <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">
                                    {row.nextStep}
                                  </p>
                                ) : null}
                              </div>
                              <Link
                                href={row.actionHref}
                                className="inline-flex w-fit items-center gap-1.5 rounded-lg bg-slate-950 px-3 py-2 text-xs font-black text-white transition hover:bg-slate-700"
                              >
                                Open <ExternalLink size={14} />
                              </Link>
                            </div>
                          </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </details>
              ))}
            </div>
          )}
        </div>
      </details>
    </section>
  );
}

const TeacherAccountabilityPage = async ({
  searchParams,
}: {
  searchParams: Promise<{ obligationId?: string }>;
}) => {
  const { obligationId: focusedObligationId } = await searchParams;
  const { userId, schoolId } = await requirePageSession(["teacher"]);
  await prepareTeacherAccountabilityForView({
    schoolId,
    teacherId: userId,
  });
  const overview = await getTeacherSelfAccountabilityOverview({
    schoolId,
    teacherId: userId,
  });
  const attentionRows = overview.weeklyIssues.filter(needsTeacherAttention);
  const attentionIds = new Set(attentionRows.map((row) => row.id));
  const todayRows = overview.todayDuties.filter((row) => !attentionIds.has(row.id));
  const resolvedThisWeek = overview.historyDays.reduce(
    (count, day) =>
      count +
      day.rows.filter((row) =>
        row.action === "ESCALATION_RESOLVED" ||
        row.action === "ESCALATION_DISMISSED" ||
        row.action === "CORRECTION_REQUESTED",
      ).length,
    0,
  );

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
              See what needs your attention, finish today&apos;s duties, and
              keep your teaching records clean.
            </p>
            {focusedObligationId ? (
              <p className="mt-3 rounded-lg bg-sky-400/10 px-3 py-2 text-xs font-black text-sky-100">
                Opened one duty. The matching item is highlighted below.
              </p>
            ) : null}
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          label="Today"
          value={overview.totals.today}
          helper="Duties expected today"
          tone="blue"
        />
        <StatCard
          label="Needs Attention"
          value={attentionRows.length}
          helper="Missed or escalated items"
          tone={attentionRows.length > 0 ? "red" : "green"}
        />
        <StatCard
          label="Resolved"
          value={resolvedThisWeek}
          helper="Responses or decisions this week"
          tone="green"
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
        <NeedsAttentionPanel
          rows={attentionRows}
          focusedObligationId={focusedObligationId}
        />
        <TodayDutiesPanel rows={todayRows} focusedObligationId={focusedObligationId} />
      </div>

      <HistorySection weeks={overview.historyWeeks} focusedObligationId={focusedObligationId} />
    </div>
  );
};

export default TeacherAccountabilityPage;
