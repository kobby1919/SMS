# Dashboard performance verification

## What can run now

From the repository root (Bash or PowerShell):

```sh
node tools/dashboard-performance/profile.mjs --rounds=2 --out=.private/dashboard-profile.json
node tools/dashboard-performance/profile.mjs --sections=finance,parents --concurrency=2 --compare-full --fault-check --out=.private/dashboard-recovery.json
```

The profiler uses DATABASE_URL from the local environment. With multiple schools, add `--school=ID`. It forces PostgreSQL read-only connections, bounds query/lock wait times, limits clients/rounds to three, and emits no SQL parameters, contacts or financial figures. It uses real services but a synthetic admin context; it does **not** verify HTTP/Clerk authorization. EXPLAIN ANALYZE is restricted to captured SELECT statements. Do not use this as a high-volume production load generator.

Fault checking cancels one read-only sleep using a statement timeout, asserts that the dashboard boundary returns unavailable without figures, then compares a fresh finance read. It separately exhausts a private one-connection pool and verifies recovery. It does not exhaust the application's pool or terminate other database sessions. Concurrent legitimate edits can invalidate the before/after equality check; repeat on a quiet fixture, never suppress the discrepancy.

Results are local diagnostic artifacts, not capacity certification. Few samples cannot establish production p95/p99. Academic `SETUP_REQUIRED` is not a fully populated academic benchmark.

## Prepared mixed-write rehearsal: NOT yet run

The user explicitly chose to keep current records read-only. No disposable database is configured. Do not run mixed writes until all the following are ready:

1. Provision a separate disposable PostgreSQL database/branch with synthetic data, never real parent contacts. Apply the actual schema/migrations. Use a separate checkout/build and local app on port 3100, not the running port 3000 or its `.next` directory.
2. Confirm that this isolated app actually uses that database, Clerk test instance and synthetic identities. URL comparison alone cannot prove database isolation, particularly with pooled/direct aliases. Stop scheduled workers and remove real email/SMS/payment credentials from this test deployment. Do not disable authorization, score deadlines or payment validation.
3. Prepare a completed-setup school with one active student and one unpaid non-daily bill, no discounts/opening balances, enough balance for the test amount, a published timetable, active CA setup and a genuinely open recording window. Give the student's full name and the activity title a unique `EDUJAY_LOADTEST_` token. The activity must have no existing scores. This small fixture establishes reconciliation; create representative-size fixtures in a separate capacity phase.
4. Sign in normally as two admins, a bursar and the assigned teacher. Store Playwright storage states under ignored `.private/`. Use `mixed-load.example.json` as the manifest structure, replacing identifiers and paths with the fixture's actual values. Keep the manifest under `.private/` too. Confirm each page/selector in one manual rehearsal. Browser cookies are secrets; never commit them.
5. Provide `DASHBOARD_TEST_DATABASE_URL` for read-only verification, leave `DATABASE_URL` pointing to the working database solely for the isolation comparison, and set `EDUJAY_DISPOSABLE_TEST_ACK=ISOLATED_APP_AND_SYNTHETIC_DATABASE`. These are environment variables for the runner, not for the isolated application. Install/use Playwright locally (`EDUJAY_PLAYWRIGHT_MODULE` can point to an existing module; `EDUJAY_BROWSER_PATH` can select Edge).
6. Validate without activity, then explicitly execute:

```sh
node tools/dashboard-performance/mixed-load.mjs .private/dashboard-load.json
node tools/dashboard-performance/mixed-load.mjs .private/dashboard-load.json --execute
```

The runner preflights synthetic identities/records, refreshes concurrent admin dashboards while recording one real cash payment and one real CA score, rejects redirects/unavailable figures, checks that expected = collected + outstanding throughout, and verifies exactly one confirmed payment/receipt, line allocations, bill balance and score ownership afterward. It also requires every admin to see the new money on refresh. Start with a genuine zero score. Recreate the disposable fixture between runs; no automatic rollback/deletion is attempted. Failure leaves evidence in the disposable database for investigation.

The example 15-second p95 is a test gate, not an advertised SLA. Agree a stricter pilot target, collect enough samples and run larger school sizes/concurrencies. The browser test is prepared but remains unvalidated until executed with the isolated app. It covers one school and must be followed by a two-school authenticated isolation test, duplicate-submit tests, production-like pool/timeout tests and parent/report reconciliation. It does not certify payment gateways or real provider delivery.

## Caching decision

No shared cache or summary table was added. The measured optimization removes unused queries while preserving the canonical calculations and transaction snapshot. Continue live reads on open/refresh, with the existing visible request/evaluation times. A refresh is not a continuous live feed.

Before adding a read model or cache: benchmark representative schools near the intended database region; define a freshness budget per section; key by school and active period; authenticate before lookup; atomically invalidate/version after payment, reversal, score, publication, guardian and preference changes; test concurrent writes, failed jobs and cross-school keys; show stale/unavailable rather than current-looking figures. Require reconciliation/backfill and monitoring for maintained summaries. Do not trade accurate money for a faster misleading dashboard.
