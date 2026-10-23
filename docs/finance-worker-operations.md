# Finance Worker Operations

## Staging Activation

The payment webhook verifies the provider signature and stores an event plus a
deduplicated processing job. A 202 response means queued, not applied to a bill.
Only the worker verifies the transaction with Paystack and applies its result.

The Vercel cron in `vercel.json` calls GET `/api/internal/finance/jobs/run` each
minute on the project's production deployment. In the edujay-staging project,
that is the staging deployment; it is not the edujay-production project.

Configure these variables in edujay-staging's Production environment:

- `FINANCE_SCHEDULE_ENABLED=true` (Config): explicit opt-in for scheduled work.
- `CRON_SECRET` (Secret): independent random value sent by Vercel as a bearer
  authorization header. Do not use Paystack credentials or an encryption key.
- Preserve `FINANCE_WORKER_SECRET` for separately authorized manual POST runs.
- Preserve `PAYMENT_SETTINGS_ENCRYPTION_KEY`; rotating it without a migration
  makes existing provider credentials unreadable.

Redeploy the reviewed code after configuring variables. Confirm the cron appears
in Settings > Cron Jobs and observe actual scheduled GET invocations. Verify
that Vercel Deployment Protection permits them; do not disable protection to
make the test pass. Never commit bypass tokens in a cron path or URL.

Minute-frequency scheduling requires a supporting Vercel plan; Hobby allows
daily cron only. Confirm the team's plan/trial and billing before relying on it.
This schedule invokes each deployed project once per minute, even if its handler
is disabled; review staging compute costs and disable its cron when paused.

The edujay-production project must leave `FINANCE_SCHEDULE_ENABLED` unset or
false during this staging exercise. Its handler returns a no-store skipped
response without reading the queue. Do not enable production payments or its
worker until Point 5 of `production-readiness.md` and live-service checks pass.

## Processing And Recovery

Each cron call processes at most five jobs and stops starting new jobs after
30 seconds. Paystack verification requests time out after 15 seconds. A
conditional pending-to-processing database update prevents two workers claiming
the same job. This is not a blanket cross-school concurrency certification.

Failed processing uses the existing five-minute retry delay and maximum attempts;
cron returns HTTP 500 with failure counts, not provider payloads or credentials.
Use Vercel logs to investigate and monitor `FinanceJob` failures and queue age.
Alert delivery and operational ownership still require deployed verification.

An interrupted function can leave a job PROCESSING. This change does not add
automatic stale-lock recovery. Before any manual requeue, confirm no worker is
active and reconcile the provider reference, webhook status, payment, bill and
receipt. Never pay again to work around a stuck job or reset every queue row.

The manual POST endpoint still accepts only `FINANCE_WORKER_SECRET` via bearer
or the existing worker header; cron GET accepts only `CRON_SECRET` when enabled.
Neither endpoint is a substitute for scheduled execution evidence.

## Hosted Verification Still Required

1. Confirm an unauthenticated enabled cron GET is rejected and scheduled GETs
   succeed through Deployment Protection without an operator call.
2. Submit one distinct synthetic test-mode payment; record the prior balance.
   Wait for a scheduled invocation and verify one payment, one receipt and the
   exact balance deduction. No manual POST during this check.
3. Replay the signed webhook for the existing reference (not a new charge) and
   verify no second payment, receipt or balance deduction occurs.
4. Exercise provider failure/retry handling and review queue age, failed jobs and
   interrupted-worker recovery with the responsible operator.

Successful unit tests, one manual run and a Ready deployment do not certify
production. School fees are to settle to each school's own verified Paystack
account; Edujay subscriptions are separate. MiqraTech test credentials must not
be substituted for a school's live collection account.

References:

- https://vercel.com/docs/cron-jobs
- https://vercel.com/docs/cron-jobs/manage-cron-jobs
- https://paystack.com/docs/payments/webhooks/
