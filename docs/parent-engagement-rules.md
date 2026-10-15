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

## Step 1 Hardening

Malformed booleans and contact shapes are unavailable, not enabled or contactable.
Conflicting guardian duplicates, contradictory lifecycle evidence and invalid
summary periods raise PARENT_ENGAGEMENT_INCONSISTENT; Step 2 must translate that
code into explicit unavailable tracking, not a healthy zero or generic crash.
Inactive students are not applicable to current contact-readiness counts.

Both nonexistent and ambiguous daylight-saving local send times require setup.
All equal-time email evidence must have valid proof; unrelated SMS/WhatsApp
records cannot poison email status. Neither successful provider delivery nor
usable contact details establishes read status or verified human reachability.

## Step 2 Snapshot Service


`getAdminParentEngagementSnapshot` authenticates admins before opening a
RepeatableRead transaction. It accepts no caller tenant and uses existing records
only; no provider calls, setting upserts, notification generation or delivery writes.

The current cohort is ACTIVE same-school students and authorised guardian links.
Legacy Student.parentId is used only when that parent has no relationship rows.
Current ward/guardian access applies to request inclusion. A canMessageSchool
change governs new messages, not whether management can see an existing eligible
unanswered request. Messaging disabled means new messaging is disabled; existing
eligible unresolved requests remain counted. Revoked links stay excluded from the
current cohort without deleting their historical request records.
Summary schedule/configuration states are independent of messaging policy.

The snapshot returns aggregate counts, not bodies, raw destinations or provider
IDs. Counts/read agreement and exact parent/source/delivery tenant binding are
checked. Histories exceeding bounded synchronous evaluation return unavailable
with null totals, never truncated healthy results. Known database interruptions
and inconsistent evidence have explicit unavailable codes; auth failures and
unexpected bugs are not hidden behind successful empty states.

Recorded invite activation requires acceptedParentId to match acceptedBy exactly,
with same-school ACCEPTED status and a valid, non-future acceptance time. This is
historical activation evidence, not proof of current Clerk login availability.
The DTO explicitly returns portalAccessVerified=false and recorded/unknown
activation counts; absence remains unknown, not automatically inactive. Old parent
summary records without a central bridge remain tracking-unavailable rather than
being claimed never sent. New channel expectations and richer follow-up details
will be wired in Steps 3/4; this service is not yet displayed on the dashboard.

Before pilot, test authenticated two-school access, true PostgreSQL snapshot
isolation under concurrent updates, and representative maximum-size latency.

Step 2 hardening restricts parent reads to current active-ward candidates rather
than loading every retired/unlinked profile. Counters still examine all stored
relationships for each candidate, so legacy fallback cannot revive removed access.
Relationship flags, preference ownership/role and acceptance evidence are validated
before use. Opaque ward/parent IDs are joined with nested sets, not delimiter keys.
Incomplete per-lane evidence has explicit unavailable tracking states; known partial
counts must not be presented as complete healthy totals.

## Step 3 Parent Update Tracking

The snapshot exposes summaries available and mutually exclusive current email
states for the latest scheduled weekly period. Counts are unique parents with a
canonical summary, never delivery attempts. A resend uses its latest delivery
state; these are not lifetime counts of everyone ever successfully contacted.
Queued includes pending/retrying jobs, including deferred quiet-hour work. Sent
means provider acceptance, delivered requires recorded provider confirmation,
and neither means read. Console simulations have their own count and cannot
appear as real sends/deliveries. Legacy unbridged history remains unknown.

Separate channelRoutes describe current weekly delivery eligibility per parent:
available, opted out, disabled, unsupported, not configured, simulated, missing
contact or unavailable. Current preferences never erase actual historical email
states. SMS/WhatsApp are unsupported until adapters are connected. Local provider
configuration is not certification of valid credentials, verified domains or
recipient deliverability. No summary for a parent with no reportable events is
automatically a failure; this section does not claim every parent needs a summary.

No new sender, provider calls, notification writes or dashboard UI are introduced.
The compact dashboard consumes these aggregates in Step 5. Live provider/webhook
verification and school-timezone generator scheduling remain pre-pilot checks.

## Step 4 Response And Contact Readiness

Requests count actual unanswered parent messages, not unread inbox items. Acknowledging
does not answer a request. A newer parent message after a response needs a response
again, even if its stored status still says RESPONDED. An earlier response deadline
cannot be applied to that newer message: report missing/current-deadline setup instead
of accusing the teacher of being overdue. An answered but unresolved escalation stays
in the escalation count without inflating unanswered/high-priority/overdue counts.
Closed/cancelled requests and inactive or revoked ward links are not current duties.
Request IDs and school IDs are checked so duplicate or foreign evidence cannot inflate
the totals. Disabled new messaging never conceals eligible existing response work.

Missing/invalid contacts count once per eligible parent, even for siblings. Student
warnings examine every authorised guardian, independently for email and phone.
One usable contact route prevents a no-external-contact warning. Missing guardian links
are separate from linked guardians with no usable contact. Syntactically usable contact
details are not proof of human reachability or successful delivery.

Imported par_UUID profiles need portal setup: acceptance replaces these placeholders
with the Clerk account ID. A recorded accepted invite is historical activation evidence,
not a live Clerk access check. Unknown accounts stay unknown; never infer inactivity
from absent invite history. inactivePortalAccess is explicitly null and
portalAccessVerified is false until authoritative current account-state evidence is
available. Setup-needed students require all eligible guardians to need setup; another
recorded activation or unknown account prevents an unjustified all-guardians warning.
This is backend tracking; dashboard presentation follows in Step 5.
