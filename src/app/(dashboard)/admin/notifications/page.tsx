import type { ReactNode } from "react";
import { BellRing, CheckCircle2, Clock3, MailWarning, RefreshCcw, ShieldCheck, XCircle } from "lucide-react";
import { requirePageSession } from "@/src/lib/authz";
import {
  DELIVERY_CHANNELS,
  DELIVERY_STATUSES,
  RECIPIENT_TYPES,
  getNotificationMonitorData,
} from "@/src/lib/queries/notification-monitor";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{
    status?: string;
    channel?: string;
    recipientType?: string;
    from?: string;
    to?: string;
  }>;
};

function readable(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatDateTime(value: Date | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

function statusClass(status: string) {
  if (status === "FAILED") return "bg-rose-50 text-rose-700 ring-rose-200";
  if (status === "RETRYING") return "bg-amber-50 text-amber-700 ring-amber-200";
  if (status === "DELIVERED" || status === "SENT") return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (status === "CANCELLED") return "bg-slate-100 text-slate-700 ring-slate-200";
  return "bg-sky-50 text-sky-700 ring-sky-200";
}

function StatCard({
  label,
  value,
  note,
  tone,
  icon,
}: {
  label: string;
  value: number;
  note: string;
  tone: string;
  icon: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-black text-slate-950">{value.toLocaleString()}</p>
        </div>
        <div className={`rounded-xl p-2 ${tone}`}>{icon}</div>
      </div>
      <p className="mt-3 text-sm font-semibold leading-relaxed text-slate-500">{note}</p>
    </div>
  );
}

function FilterSelect({
  label,
  name,
  value,
  options,
}: {
  label: string;
  name: string;
  value?: string;
  options: readonly string[];
}) {
  return (
    <label className="flex flex-col gap-1 text-xs font-black uppercase tracking-wide text-slate-500">
      {label}
      <select
        name={name}
        defaultValue={value ?? ""}
        className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold normal-case tracking-normal text-slate-800 outline-none focus:border-edujay-primary"
      >
        <option value="">All</option>
        {options.map((option) => (
          <option key={option} value={option}>{readable(option)}</option>
        ))}
      </select>
    </label>
  );
}

const AdminNotificationsPage = async ({ searchParams }: PageProps) => {
  const { schoolId } = await requirePageSession(["admin"]);
  const params = await searchParams;
  const { summary, deliveries, filteredCount, filters } = await getNotificationMonitorData(schoolId, params);

  return (
    <div className="flex flex-col gap-5 p-4">
      <div className="rounded-2xl border border-slate-200 bg-slate-950 p-5 text-white shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-sky-400/10 p-2 text-sky-200">
              <BellRing size={20} />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-sky-200">Notification monitor</p>
              <h1 className="mt-1 text-xl font-black">Delivery Health</h1>
              <p className="mt-1 max-w-3xl text-sm font-medium leading-relaxed text-slate-300">
                Track whether Edujay notifications are queued, sent, delivered, retrying, or failed for this school.
              </p>
            </div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-slate-200">
            {summary.totalNotifications.toLocaleString()} notifications created
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Queued" value={summary.deliveryCounts.PENDING} note="Waiting for the worker to process." tone="bg-sky-50 text-sky-700" icon={<Clock3 size={18} />} />
        <StatCard label="Sent or delivered" value={summary.deliveryCounts.SENT + summary.deliveryCounts.DELIVERED} note="Provider accepted or confirmed delivery." tone="bg-emerald-50 text-emerald-700" icon={<CheckCircle2 size={18} />} />
        <StatCard label="Failed" value={summary.deliveryCounts.FAILED} note="Needs review before stakeholders complain." tone="bg-rose-50 text-rose-700" icon={<XCircle size={18} />} />
        <StatCard label="Retrying" value={summary.deliveryCounts.RETRYING} note="Edujay will try again according to retry rules." tone="bg-amber-50 text-amber-700" icon={<RefreshCcw size={18} />} />
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <StatCard label="Unread in-app" value={summary.unreadNotifications} note="Bell notifications not yet read by recipients." tone="bg-indigo-50 text-indigo-700" icon={<BellRing size={18} />} />
        <StatCard label="Needs attention" value={summary.attentionCount} note="Failed plus retrying deliveries." tone="bg-orange-50 text-orange-700" icon={<MailWarning size={18} />} />
        <StatCard label="Cancelled" value={summary.deliveryCounts.CANCELLED} note="Stopped by system rules or admin action." tone="bg-slate-100 text-slate-700" icon={<ShieldCheck size={18} />} />
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-base font-black text-slate-950">Delivery records</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              Showing latest {deliveries.length.toLocaleString()} of {filteredCount.toLocaleString()} matching delivery jobs.
            </p>
          </div>
          <a href="/admin/notifications" className="text-sm font-black text-edujay-primary">Clear filters</a>
        </div>

        <form className="mt-4 grid gap-3 md:grid-cols-5" action="/admin/notifications">
          <FilterSelect label="Status" name="status" value={filters.status} options={DELIVERY_STATUSES} />
          <FilterSelect label="Channel" name="channel" value={filters.channel} options={DELIVERY_CHANNELS} />
          <FilterSelect label="Recipient" name="recipientType" value={filters.recipientType} options={RECIPIENT_TYPES} />
          <label className="flex flex-col gap-1 text-xs font-black uppercase tracking-wide text-slate-500">
            From
            <input name="from" type="date" defaultValue={filters.from ?? ""} className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-bold normal-case tracking-normal text-slate-800 outline-none focus:border-edujay-primary" />
          </label>
          <label className="flex flex-col gap-1 text-xs font-black uppercase tracking-wide text-slate-500">
            To
            <input name="to" type="date" defaultValue={filters.to ?? ""} className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-bold normal-case tracking-normal text-slate-800 outline-none focus:border-edujay-primary" />
          </label>
          <div className="md:col-span-5">
            <button type="submit" className="h-11 w-full rounded-xl bg-edujay-primary px-4 text-sm font-black text-white shadow-sm md:w-auto">
              Apply filters
            </button>
          </div>
        </form>

        <div className="mt-5 hidden overflow-hidden rounded-2xl border border-slate-200 lg:block">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-black uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Notification</th>
                <th className="px-4 py-3">Recipient</th>
                <th className="px-4 py-3">Channel</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Attempts</th>
                <th className="px-4 py-3">Provider</th>
                <th className="px-4 py-3">Last update</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {deliveries.map((delivery) => (
                <tr key={delivery.id} className="align-top">
                  <td className="px-4 py-3">
                    <p className="font-black text-slate-900">{delivery.notification.title}</p>
                    <p className="mt-1 line-clamp-2 max-w-md text-xs font-semibold text-slate-500">{delivery.notification.body}</p>
                    <p className="mt-2 text-[11px] font-bold uppercase text-slate-400">{readable(delivery.notification.category)} · {readable(delivery.notification.type)}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-bold text-slate-800">{readable(delivery.notification.recipientType)}</p>
                    <p className="mt-1 max-w-[180px] truncate text-xs font-semibold text-slate-500">{delivery.destination}</p>
                  </td>
                  <td className="px-4 py-3 font-bold text-slate-700">{readable(delivery.channel)}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-black uppercase tracking-wide ring-1 ${statusClass(delivery.status)}`}>{readable(delivery.status)}</span>
                    {delivery.lastError && <p className="mt-2 max-w-[220px] text-xs font-semibold text-rose-600">{delivery.lastError}</p>}
                  </td>
                  <td className="px-4 py-3 font-bold text-slate-700">{delivery.attempts}</td>
                  <td className="px-4 py-3">
                    <p className="font-bold text-slate-700">{delivery.provider ?? "-"}</p>
                    {delivery.providerMessageId && <p className="mt-1 max-w-[160px] truncate text-xs font-semibold text-slate-400">{delivery.providerMessageId}</p>}
                  </td>
                  <td className="px-4 py-3 text-xs font-bold text-slate-500">
                    <p>Created {formatDateTime(delivery.createdAt)}</p>
                    <p>Sent {formatDateTime(delivery.sentAt)}</p>
                    <p>Failed {formatDateTime(delivery.failedAt)}</p>
                  </td>
                </tr>
              ))}
              {deliveries.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm font-bold text-slate-500">No delivery records match these filters.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-5 grid gap-3 lg:hidden">
          {deliveries.map((delivery) => (
            <article key={delivery.id} className="rounded-2xl border border-slate-200 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-slate-900">{delivery.notification.title}</p>
                  <p className="mt-1 text-xs font-bold uppercase text-slate-400">{readable(delivery.notification.recipientType)} · {readable(delivery.channel)}</p>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-black uppercase tracking-wide ring-1 ${statusClass(delivery.status)}`}>{readable(delivery.status)}</span>
              </div>
              <p className="mt-3 line-clamp-3 text-sm font-semibold text-slate-600">{delivery.notification.body}</p>
              <div className="mt-4 grid gap-2 text-xs font-bold text-slate-500">
                <p className="truncate">Destination: {delivery.destination}</p>
                <p>Attempts: {delivery.attempts}</p>
                <p>Provider: {delivery.provider ?? "-"}</p>
                <p>Created: {formatDateTime(delivery.createdAt)}</p>
                {delivery.lastError && <p className="text-rose-600">Error: {delivery.lastError}</p>}
              </div>
            </article>
          ))}
          {deliveries.length === 0 && <p className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm font-bold text-slate-500">No delivery records match these filters.</p>}
        </div>
      </section>
    </div>
  );
};

export default AdminNotificationsPage;
