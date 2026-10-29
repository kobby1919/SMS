import type { listInviteEmailAttempts } from "@/src/lib/services/invite-email-tracking";

const labels: Record<string, string> = {
  PENDING: "Sending", ACCEPTED: "Accepted by email provider", SENT: "Sent by email provider", DELIVERED: "Delivered to mail server",
  DELAYED: "Delivery delayed", FAILED: "Sending failed", BOUNCED: "Bounced", COMPLAINED: "Spam complaint", NOT_SENT: "Not sent", UNKNOWN: "Sending unconfirmed",
};
type ActivityRow = Awaited<ReturnType<typeof listInviteEmailAttempts>>[number];
function statusTone(status: string) {
  return ["FAILED", "BOUNCED", "COMPLAINED", "NOT_SENT", "UNKNOWN", "DELAYED"].includes(status)
    ? "text-amber-800" : status === "DELIVERED" ? "text-emerald-700" : "text-gray-700";
}
function EmailHistory({ row }: { row: ActivityRow }) {
  const events = Array.isArray(row.metadata.events) ? row.metadata.events : [];
  return <details className="min-w-0 [overflow-wrap:anywhere]"><summary className="cursor-pointer text-gray-700">Email history</summary>
    {typeof row.metadata.providerMessageId === "string" && <p className="mt-2 max-w-[240px] break-all text-xs text-gray-500">Provider ID: {row.metadata.providerMessageId}</p>}
    <ol className="mt-2 space-y-2 text-xs">{events.map((event, index) => {
      const item = event && typeof event === "object" && !Array.isArray(event) ? event : {};
      return <li key={index}>{labels[String(item.status)] || "Status updated"}<br /><span className="text-gray-500">{String(item.at || "")}</span></li>;
    })}</ol>
  </details>;
}
export default function InviteEmailActivity({ rows }: { rows: Awaited<ReturnType<typeof listInviteEmailAttempts>> }) {
  return <section className="min-w-0 border-t border-gray-200 bg-white">
    <p className="px-4 py-3 text-sm text-gray-600">Latest 100 tracked email attempts. Delivery to a mail server does not mean the email was read. Earlier emails without tracking evidence are not included.</p>
    {rows.length === 0 ? <p className="p-4 text-sm text-gray-600">No tracked invitation emails yet.</p> : <>
      <div className="divide-y divide-gray-200 md:hidden">{rows.map((row) => <article key={String(row.metadata.attemptId)} className="min-w-0 space-y-3 px-4 py-4 text-sm [overflow-wrap:anywhere]">
        <p className="break-all font-semibold">{String(row.metadata.email)}</p>
        <p className={`font-semibold ${statusTone(String(row.metadata.status))}`}>{labels[String(row.metadata.status)] || "Untracked"}</p>
        <dl className="grid grid-cols-2 gap-3">
          <div><dt className="text-xs text-gray-500">Role</dt><dd className="capitalize">{row.kind.toLowerCase()}</dd></div>
          <div><dt className="text-xs text-gray-500">Invitation status</dt><dd>{row.invitationState}</dd></div>
          <div className="col-span-2"><dt className="text-xs text-gray-500">Sent attempt (UTC)</dt><dd>{row.createdAt.toISOString().replace("T", " ").slice(0, 19)}</dd></div>
        </dl>
        <EmailHistory row={row} />
      </article>)}</div>
      <div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[960px] text-left text-sm">
        <thead className="border-y border-gray-200 bg-gray-50 text-xs text-gray-600"><tr>
          {["Recipient", "Role", "Email status", "Invitation status", "Sent attempt (UTC)", "History"].map((label) => <th key={label} className="px-4 py-3 font-semibold">{label}</th>)}
        </tr></thead>
        <tbody>{rows.map((row) => {
          const status = String(row.metadata.status);
          return <tr key={String(row.metadata.attemptId)} className="border-b border-gray-100 align-top">
            <td className="max-w-[260px] break-all px-4 py-3">{String(row.metadata.email)}</td>
            <td className="px-4 py-3 capitalize">{row.kind.toLowerCase()}</td>
            <td className={`px-4 py-3 font-semibold ${statusTone(status)}`}>{labels[status] || "Untracked"}</td>
            <td className="px-4 py-3">{row.invitationState}</td>
            <td className="whitespace-nowrap px-4 py-3">{row.createdAt.toISOString().replace("T", " ").slice(0, 19)}</td>
            <td className="min-w-[200px] px-4 py-3"><EmailHistory row={row} /></td>
          </tr>;
        })}</tbody>
      </table></div></>}
  </section>;
}
