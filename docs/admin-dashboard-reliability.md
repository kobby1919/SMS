# Admin dashboard reliability

## Request and failure boundaries

- `/admin` checks the authenticated admin and completed school setup before rendering any section.
- Five independent Suspense boundaries stream School Pulse, Finance, Accountability, Academic Readiness and Parent Engagement.
- Each request has its own read coordinator: at most two section services run concurrently. Waiting sections retain their loading state and start in order when a slot becomes free. Waiting time is not treated as a failed read. Each service retains its database transaction timeout. No shared cross-school cache or global queue is introduced.
- Data failures show an unavailable state, never substitute zero balances, zero absences or an all-clear. Other successful sections remain usable.
- Client rendering errors have a section boundary. Refresh requests new server data and resets boundaries. Redirects and Next.js control-flow errors are rethrown; server authorization errors are not converted to ordinary loader results.
- The existing route error page remains the final recovery boundary for shared layout, authentication and infrastructure failures. Streaming does not make these dependencies failure-proof.
- Refresh is user-controlled. No automatic retry loop, polling storm, or speculative dashboard-shortcut prefetching.

## Source of truth and database work

- School Pulse now calls canonical Attendance Review directly, without the legacy all-sections owner-dashboard loader. It does not independently recompute attendance, upsert operating settings, fetch finance/parent data or run report readiness for each class.
- Active academic configuration is read from the same attendance snapshot. Missing or ambiguous configuration is not replaced with a fabricated year or term.
- Finance and its receipt/daily-collection helpers share one `RepeatableRead` transaction (5-second acquisition limit, 30-second transaction timeout). Existing fee, discount and collection calculations are retained.
- Attendance uses a repeatable-read snapshot with a 30-second transaction timeout. Dashboard accountability uses the same isolation with a 30-second timeout. Academic and parent services retain their existing transaction/read budgets.
- Each section is internally consistent, not a single atomic snapshot of the whole dashboard. A payment or score saved while sections load can appear on the next refresh.

## Capacity safeguards

These are conservative evaluation limits, not promises of supported school size. Counts are checked inside the same transaction before loading detailed rows. Excess data fails explicitly; no partial totals are presented.

| Dashboard read | Main limits |
| --- | --- |
| Pulse | 200 classes; 5,000 active students; 20,000 published lesson rows; 50 publications in the review interval; 50,000 attendance rows in that interval |
| Finance | 10,000 bills; 50,000 bill lines; 20,000 guardian relationships, with at most 20 per billed student; 50,000 payments; 1,000 daily collection sessions and 20,000 entries for the day |
| Accountability | 500 teachers; 5,000 active students; 10,000 active published lessons; 20,000 obligations/escalations; 10,000 pending corrections/assignments/activities; 100,000 attendance, homework submission and CA score records |

Pulse and accountability also cap evaluated work at 2 million operations using conservative estimates. Large histories may reach a limit before student-count limits. Monitor this and move the expensive historical calculations to scoped aggregates or maintained read models after reconciliation tests; do not blindly raise limits or truncate data.

Prisma transaction timeouts and work budgets are not operating-system CPU deadlines or guaranteed SQL cancellation. Validate actual query cancellation and database statement limits on the production adapter. Request-local concurrency limits do not replace production connection-pool and traffic controls.

## Diagnostics

Server logs emit `admin_dashboard_unavailable`, `admin_dashboard_slow` (read or queue time at least 5 seconds), and `admin_dashboard_render_unavailable`. Loader metadata is JSON-serialized so development logs retain the section, read duration, queue duration, reason and recognized Prisma error code. No raw SQL/errors, recipient addresses, financial records or credentials are logged by these boundaries. These logs still need deployment monitoring and alert configuration.

## Verification and pilot gate

Local verification on 2026-10-15: 505 regression tests passed (including 18 reliability cases), TypeScript validation, scoped lint and the final production build passed. Headless Edge passed 24 actual-component recovery-layout checks at 320, 360, 390, 768, 1024 and 1440 pixels, including keyboard focus, minimum touch targets, long text and overlap checks. These isolated component checks are not an authenticated full-dashboard walkthrough. The final guardian fan-out assertion also passed in the focused suite.

Follow-up correction: development logs showed `admin_dashboard_busy` repeatedly for later sections. The original 10-second queue cutoff was cancelling healthy sections before querying their records. It has been removed, with regression coverage proving that all five sections run even after a wait exceeding 10 seconds, read current records when started, and continue after an earlier section fails. Hosting duration must accommodate queue time plus actual query time; this still needs production latency measurement.

Automated coverage includes independent failures, delayed queue completion, concurrency, tenant request isolation, authentication/setup gates, canonical pulse agreement, shared finance transaction use, unchanged fee calculations, read limits, recovery states and actual React streaming.

Before pilot, still test with authenticated admins and representative production-like data:

1. Concurrent payments, attendance edits and report changes while refreshing; compare each section with its authoritative detail page.
2. Two schools simultaneously, role/session changes, incomplete onboarding and revoked access.
3. Database disconnect, slow queries, pool exhaustion, recovery and failed-section refresh.
4. Query plans, indexes, p50/p95 latency and memory under expected concurrent users; confirm configured hosting duration and database timeouts.
5. Full dashboard, navigation, focus and recovery on phones/tablets, not only isolated rendered components.
6. Connect logs to monitoring and alert on sustained unavailable/limit states and excessive queue/read duration.

No live data, migrations or credentials are changed by this hardening. Passing code tests or a successful build is not production certification. Keep the broader go-live checks in `docs/production-readiness.md`, Point 5.
