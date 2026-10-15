import Link from "next/link";
import { ArrowRight, Mail, MessageCircle, Users } from "lucide-react";
import type { ReactNode } from "react";
import type { getAdminParentEngagementSnapshot } from "@/src/lib/services/admin-parent-engagement";

type Snapshot = Awaited<ReturnType<typeof getAdminParentEngagementSnapshot>>;
const number = (value: number) => value.toLocaleString("en-GH");
function Metric({ value, children }: { value: number; children: ReactNode }) {
  return <div className="flex min-w-0 items-start justify-between gap-3 py-1"><dt className="min-w-0 break-words text-xs font-semibold leading-5 text-gray-600">{children}</dt><dd className="shrink-0 text-sm font-black tabular-nums text-gray-950">{number(value)}</dd></div>;
}
const formatDate = (value: string) => new Intl.DateTimeFormat("en-GH", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(value));

export default function AdminParentEngagement({ snapshot }: { snapshot: Snapshot }) {
  const summaries = snapshot.summaries;
  const requests = snapshot.requests;
  const contacts = snapshot.contacts;
  const emailRoutes = snapshot.channelRoutes?.EMAIL;
  const partial = snapshot.state === "UNAVAILABLE" || snapshot.summaryTrackingState === "UNAVAILABLE" || snapshot.requestsTrackingState === "UNAVAILABLE";
  return <section aria-labelledby="parent-engagement-heading" className="min-w-0 border-t border-gray-200 bg-white p-4 font-nunito sm:p-5 [overflow-wrap:anywhere]">
    <header>
      <h2 id="parent-engagement-heading" className="text-xl font-black text-gray-950">Parent Engagement</h2>
      <p className="mt-1 text-xs font-medium leading-5 text-gray-600">Updates, school responses and guardian contact readiness.</p>
      {snapshot.state === "UNAVAILABLE" && <p role="status" className="mt-2 text-sm font-semibold text-amber-800">Parent tracking is unavailable. Refresh shortly; no totals can be confirmed.</p>}
    </header>
    <div className="my-5 grid min-w-0 grid-cols-1 gap-5 lg:grid-cols-3">
      <div className="min-w-0 border-l-2 border-blue-200 pl-3">
        <h3 className="flex items-center gap-2 text-sm font-black text-gray-950"><Mail size={16} className="shrink-0" aria-hidden="true" />Parent Updates</h3>
        {snapshot.schedule?.period && <p className="mt-3 text-xs leading-5 text-gray-500">Latest scheduled week: {formatDate(snapshot.schedule.period.startDate)} – {formatDate(snapshot.schedule.period.rangeKey.split(":")[1])}</p>}
        {snapshot.summaryTrackingState === "AVAILABLE" && summaries ? <>
          <dl className="mt-2">
            <Metric value={summaries.summariesAvailable}>Parents with a summary available</Metric>
            <Metric value={summaries.queuedOrRetrying}>Emails queued / retrying</Metric>
            <Metric value={summaries.sent}>Emails sent, delivery not confirmed</Metric>
            <Metric value={summaries.delivered}>Provider-confirmed deliveries</Metric>
            <Metric value={summaries.failed}>Emails failed</Metric>
          </dl>
          {summaries.summariesAvailable === 0 && <p className="mt-2 text-xs leading-5 text-gray-500">No summaries recorded for this period. Not every parent has reportable updates.</p>}
          {(summaries.simulated > 0 || summaries.notQueued > 0 || summaries.cancelled > 0) && <p className="mt-2 text-xs leading-5 text-gray-500">{number(summaries.notQueued)} not queued · {number(summaries.cancelled)} cancelled · {number(summaries.simulated)} simulated</p>}
        </> : <p className="mt-3 text-sm leading-6 text-gray-600">{snapshot.summaryTrackingState === "DISABLED" ? "Weekly summaries are switched off." : snapshot.summaryTrackingState === "SETUP_REQUIRED" ? "Weekly summary settings need setup." : "Summary delivery tracking is unavailable; counts cannot be confirmed."}</p>}
        {snapshot.schedule?.nextSendAt && <p className="mt-2 text-xs leading-5 text-gray-500">Next weekly summary due {formatDate(snapshot.schedule.nextSendAt)}.</p>}
        {emailRoutes && (emailRoutes.optedOut > 0 || emailRoutes.disabled > 0 || emailRoutes.unsupported > 0 || emailRoutes.notConfigured > 0 || emailRoutes.simulated > 0) && <p className="mt-2 text-xs leading-5 text-gray-500">Current email preferences: {number(emailRoutes.optedOut)} opted out · {number(emailRoutes.disabled)} disabled · {number(emailRoutes.unsupported + emailRoutes.notConfigured + emailRoutes.simulated)} without a live configured channel. These are not delivery failures.</p>}
        <p className="mt-2 text-xs leading-5 text-gray-500">Delivery confirmation does not mean the update was read.</p>
      </div>
      <div className="min-w-0 border-l-2 border-teal-200 pl-3">
        <h3 className="flex items-center gap-2 text-sm font-black text-gray-950"><MessageCircle size={16} className="shrink-0" aria-hidden="true" />Requests Needing Response</h3>
        {snapshot.newMessagingState !== "AVAILABLE" && <p className="mt-3 text-xs leading-5 text-gray-600">{snapshot.newMessagingState === "DISABLED" ? "New parent–teacher messaging is disabled. Existing requests still need follow-up." : "New messaging policy is not confirmed."}</p>}
        {snapshot.requestsTrackingState === "AVAILABLE" && requests ? <>
          <dl className="mt-3">
            <Metric value={requests.awaitingResponse}>Awaiting school response</Metric>
            <Metric value={requests.overdue}>Past response deadline</Metric>
            <Metric value={requests.highPriority}>High priority, awaiting response</Metric>
            <Metric value={requests.escalated}>Escalations needing review</Metric>
          </dl>
          {requests.missingDeadlines > 0 && <p className="mt-2 text-xs leading-5 text-amber-800">{number(requests.missingDeadlines)} response deadlines need review.</p>}
          {requests.awaitingResponse === 0 && requests.escalated === 0 && <p className="mt-2 text-xs leading-5 text-gray-500">No current response or escalation follow-ups found.</p>}
        </> : <p className="mt-3 text-sm leading-6 text-gray-600">Response tracking is unavailable; outstanding totals cannot be confirmed.</p>}
      </div>
      <div className="min-w-0 border-l-2 border-amber-200 pl-3">
        <h3 className="flex items-center gap-2 text-sm font-black text-gray-950"><Users size={16} className="shrink-0" aria-hidden="true" />Parent Contact Readiness</h3>
        {contacts ? <>
          <dl className="mt-3">
            <Metric value={contacts.missingEmails}>Parents missing email</Metric>
            <Metric value={contacts.missingPhones}>Parents missing phone</Metric>
            <Metric value={contacts.studentsWithoutExternalContact}>Students with no usable guardian contact</Metric>
            <Metric value={contacts.studentsWithoutActiveGuardian}>Students without an active guardian link</Metric>
            <Metric value={contacts.studentsNeedingPortalSetup}>Students whose guardians need portal setup</Metric>
          </dl>
          {(contacts.invalidEmails > 0 || contacts.invalidPhones > 0) && <p className="mt-2 text-xs leading-5 text-amber-800">{number(contacts.invalidEmails)} invalid emails · {number(contacts.invalidPhones)} invalid phone numbers.</p>}
          {snapshot.cohort?.students === 0 && <p className="mt-2 text-xs leading-5 text-gray-500">No active students to evaluate yet.</p>}
          <p className="mt-2 text-xs leading-5 text-gray-500">All authorised guardians are considered. Live portal access is not verified{contacts.studentsWithUnknownActivation > 0 ? `; activation history is unknown for ${number(contacts.studentsWithUnknownActivation)} students` : ""}.</p>
        </> : <p className="mt-3 text-sm leading-6 text-gray-600">Guardian contact readiness is unavailable.</p>}
      </div>
    </div>
    <h3 className="text-sm font-black text-gray-950">Parents Needing Attention</h3>
    {partial && <p role="status" className="mt-2 text-xs leading-5 text-amber-800">Some tracking is unavailable. The issues below cover only records that could be evaluated.</p>}
    {!snapshot.attention?.rows.length ? <p className="py-4 text-sm font-medium leading-6 text-gray-600">{snapshot.attention ? "No action items found in the available records." : "Follow-up items cannot be evaluated right now."}</p> : <>
      <ul className="mt-2 divide-y divide-gray-200">
        {snapshot.attention.rows.map((row) => <li key={row.key} className="flex min-w-0 flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 flex-1"><h4 className="text-sm font-black text-gray-950">{row.title}</h4><p className="mt-1 text-xs font-semibold leading-5 text-gray-600">{row.detail}</p></div>
          <Link href={row.href} prefetch={false} aria-label={`${row.action}: ${row.detail}`} className="inline-flex min-h-10 w-fit max-w-full items-center gap-2 text-xs font-black text-blue-700 sm:shrink-0"><span className="min-w-0 break-words">{row.action}</span><ArrowRight size={14} className="shrink-0" aria-hidden="true" /></Link>
        </li>)}
      </ul>
      {snapshot.attention.total > 5 && <p className="mt-2 text-xs text-gray-500">Showing the highest-priority 5 of {number(snapshot.attention.total)} issues.</p>}
    </>}
  </section>;
}
