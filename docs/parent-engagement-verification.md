# Parent Engagement Verification

## Automated Coverage

| Area | Evidence checked | Regression files |
| --- | --- | --- |
| Counts and retries | One summary per parent/period; all email buckets reconcile; resends and late webhooks cannot inflate or overwrite the newest state | `tests/parent-engagement-rules.test.mjs`, `tests/admin-parent-engagement.test.mjs` |
| Preferences and policy | Opt-outs, disabled channels, unsupported providers and simulations stay separate from failures; policy changes preserve history and outstanding requests | Same rule/snapshot tests |
| Response follow-up | Acknowledgement is not a reply; renewed requests need another response; old deadlines cannot create false overdue accusations; answered escalations stay visible | Rule, snapshot and `tests/parent-engagement-destinations.test.mjs` |
| Guardians and activation | All authorised guardians considered; siblings deduplicated for parent counts; revoked/inactive links excluded; imported placeholders need setup; unknown live access stays unknown | Rule/snapshot tests |
| School and role isolation | Admin authentication before database reads; school-bound relationships and delivery evidence; exact review destinations remain scoped; malformed filters cannot widen request scope | Snapshot/destination tests |
| Dashboard and navigation | Rendered values equal snapshot values; priority order stable; five actions maximum; exact request/delivery/guardian destinations; private details absent; names HTML-escaped | Snapshot and `tests/parent-engagement-ui.test.mjs` |
| Failure states | Missing setup, disabled policies, invalid evidence, query limits and database interruptions never become healthy zeroes | Rule/snapshot/UI tests |

The database and authentication dependencies in these regression tests are mocked.
They exercise the real rule, snapshot and page-rendering code, but do not certify
PostgreSQL concurrency, live Clerk sessions or provider credentials.

## Responsive Verification

Render the actual component with compiled application CSS in a browser. Check
320, 360, 390, 768, 1024 and 1440 px widths, plus narrow/wide empty, disabled,
unavailable, partial-data, calendar-warning and long-name states. Verify no
horizontal overflow or label/count overlap; five actions maximum; minimum 40 px
action height; keyboard focusability. Inspect phone and desktop screenshots.
This is component-level verification, not an authenticated full-dashboard walkthrough.

Local verification artifacts are in `tmp/parent-engagement-preview/` and are not
production data or committed application assets.

## Before Pilot

- Sign in as admins from two separate schools and as a non-admin. Test dashboard and direct request, delivery and student links, including foreign and stale IDs.
- Reconcile actual summaries, delivery records, requests and guardian records with the three dashboard areas. Exercise changed preferences, renewed requests and revocation.
- Verify PostgreSQL snapshot behavior during concurrent request/delivery updates and measure latency with representative school data and near-limit histories.
- Test real provider acceptance, delivery, bounce/failure and retry callbacks. Do not equate sent/delivered with read.
- Verify live account access separately. Recorded invitation acceptance is historical evidence; the dashboard does not claim a live Clerk activation check.
- Use compatible school/runtime calendars. Reconcile the legacy weekly generator before enabling non-UTC calendars; CALENDAR_MISMATCH deliberately suppresses unreliable totals and next-send promises.
- Walk through the authenticated dashboard and every linked review destination on phone, tablet and desktop, including keyboard navigation.

Passing regression tests, typecheck, scoped lint and build is not production certification.

## Local Verification Result

- Full regression suite: 487 tests passed.
- Parent Engagement source, integration routes and tests: scoped lint passed.
- TypeScript and production build: passed.
- Browser component checks: 18 viewport/state combinations passed, including keyboard focus and minimum action height. Phone and desktop screenshots inspected.
- No new production-code defect surfaced in this final pass; five additional regression scenarios were added. Live checks listed above remain outstanding.
