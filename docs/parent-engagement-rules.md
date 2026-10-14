# Parent Engagement: Step 1 Contract

The shared rules in `src/lib/parent-engagement-rules.ts` are side-effect-free.
They define metrics; they do not send notifications, grant access or change policy.
Step 2 must authenticate the admin and supply school-scoped, consistent records.

## Time And Cohort

- Summary weeks use Monday through Sunday calendar keys, with an exclusive next
  Monday boundary. Compare the latest scheduled due week, not an upcoming week.
- Schedule uses the configured school timezone, send day and time. Before the
  send instant, retain the previous due period and show the next send date/time.
- Missing/invalid settings and nonexistent local send times are setup-required;
  OFF/DAILY cadence disables weekly tracking, not a delivery failure.
- Eligible summaries come from final parent-safe activity under existing summary
  generation rules. Do not expect a summary for every parent without source events.
- Existing workers/source range keys must be reconciled when wired in Step 3;
  this foundation does not silently rewrite their schedule or stored history.

## Counts And Evidence

- ParentNotification is the canonical update/history source. Identify weekly
  records by ParentWeeklySummary and exact source key, not the central enum alone:
  the existing bridge uses PARENT_DAILY_SUMMARY for both summary cadences.
- Count unique parents within the due period, not wards, attempts or legacy logs.
  Conflicting duplicate canonical records require review rather than guessed counts.
- Read delivery state from central AppNotificationDelivery. Do not add old
  ParentNotificationDeliveryLog attempts to the same totals.
- Email buckets are mutually exclusive current states. Sent means SENT with a
  send timestamp; delivered requires DELIVERED, a provider ID and delivery timestamp.
  Neither means read. Latest failed/retrying state must not be hidden by old success.
- Show NOT_QUEUED, CANCELLED and UNAVAILABLE separately from failed delivery.
  Disabled, opted-out, unsupported/unconfigured and missing-contact routes are not
  send failures. Eligibility/preferences affect future expectations; actual past
  delivery history remains evidence even if preferences change later.

## Response And Contact Rules

- PENDING/ACKNOWLEDGED/RESPONDED labels alone do not prove a response. Compare the
  latest parent message with the latest recorded school response. A new parent
  message after a reply requires another response. Closed/cancelled requests do not.
- Overdue starts after the stored response deadline, not exactly at it. Missing
  deadlines are unconfigured; invalid/future response evidence is unavailable.
- HIGH is the current parent-request priority. Escalated means an open ESCALATED
  request. Do not invent URGENT parent priorities or unread-message counts.
- Missing and invalid contact values are separate. A usable saved email/phone is
  a contact route, not proof of delivery or verified reachability.
- Current cohort: ACTIVE students and same-school ACTIVE guardian relationships.
  Reuse existing ward permission rules. A legacy parent link is permitted only
  when that parent has no relationship rows; never revive revoked/removed access.
- A child's contact readiness considers every authorised active guardian, once
  per parent. One incomplete guardian cannot make the child unreachable if another
  has contact details. Missing guardian link is separate from no external contact.
- Portal activation must come from authoritative onboarding/account evidence.
  Pending invite is not active access; absent legacy evidence is UNAVAILABLE, not
  automatically inactive. Do not infer activation from profile existence or email.
- Messaging policy controls request availability; summary cadence and channel
  preferences control summaries. Keep these policy states separate.
  Turning off new messaging does not erase existing unanswered/escalated requests.
- Equal-time contradictory delivery states are unavailable, not guessed from row
  order. Repeated canonical summary rows merge their delivery evidence before
  choosing the latest state, so joins cannot hide a newer failure.

No dashboard/snapshot integration is introduced in Step 1. No messages or data
are changed. Live authenticated tenant checks remain required before pilot.
