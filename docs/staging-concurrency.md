# Staging Concurrency Evidence

## Verified On 2026-10-20

Four checks passed against the pinned Neon staging database using the restricted `edujay_app` login. The actual inventory service ran through Prisma and its PostgreSQL adapter against the pooled endpoint; separate direct PostgreSQL connections held and observed locks. No database calls in that service were mocked. Its TypeScript source was transpiled in memory using the same loading approach as existing service tests, with explicit imports; this was not an HTTP/authentication test.

| Check | Actual result |
| --- | --- |
| Two simultaneous saves of inventory revision zero | Both independent connections were observed waiting; exactly one save succeeded and the other raised the expected inventory conflict. Exactly one revision-one audit remained. |
| Locked school versus an independent school | The second school's service save committed while the first school's save remained blocked; each school's saved revision was checked. This checks transaction independence, not authenticated tenant isolation. |
| Old serializable import snapshot after a scope revision | The actual inventory service committed the scope change; the stale connection's importer-style shared School lock was rejected with PostgreSQL 40001. |
| Active import-style shared School lock versus a scope save | The service save was observed blocked until the shared lock was released; it then saved the expected next revision. |

Three uniquely named synthetic schools and their onboarding audits were created for inter-transaction visibility, then deleted by exact IDs in one cleanup transaction. Counts confirmed no fixtures/audits remained. Sequence counters were not reset. Production, local school data, Vercel settings and provider integrations were not changed.

Initial attempts stopped because the observer only counted direct blockers, missing a waiter queued behind another waiter. Cleanup succeeded after each attempt. The observer was corrected to traverse the blocking chain; application code was not changed to obtain a pass. A separate isolated PostgreSQL test now covers queued/duplicate/unrelated sessions. PostgreSQL documents hard and queued blocking through [pg_blocking_pids](https://www.postgresql.org/docs/current/functions-info.html).

## Safe Operation

```sh
node tools/database/staging-concurrency.mjs
node tools/database/staging-concurrency.mjs --execute
node --test tests/database-concurrency-observation.test.mjs
```

Default behavior is a read-only preflight. Execution requires pinned, distinct staging/production hosts, matching reviewed baseline and recent runtime-permission evidence, the saved staging runtime URLs, an available maintenance advisory lock, and empty staging schools/audits. No dotenv fallback or production execution mode exists. Credentials are never printed.

The ignored `.private/database-evidence/staging-concurrency.json` records results, scope and fixture IDs, not credentials. IDs are recorded before fixture creation so interruption can be investigated. Failed cleanup is a blocker: inspect those exact IDs privately, do not delete other records or reset the database, and do not treat a prior success as resolving a later failure.

## Still Required

This is a limited concurrency milestone, not completion of Point 5 or a load certification. Subsequent subject-only duplicate import, approval/import and cancellation/import checks are recorded in `docs/staging-workflow-concurrency.md`; HOLD and completion-versus-inventory-edit checks are recorded in `docs/staging-recovery-concurrency.md`. Mixed payment/score workloads, other representative edit/import races and report reconciliation remain pending. The import-lock probes in this initial suite exercise the database protocol but do not execute the full importer.

Also pending before school admission: isolated backup/restore, encrypted staging redeploy/retention/cleanup, production-like authentication and tenant/role isolation, desktop/mobile walkthroughs, dependency security fixes and enabled provider/webhook/worker tests. Perform deployed Vercel smoke tests immediately after deployment and before inviting schools. Passing code or these four checks alone is not production certification; return to `docs/production-readiness.md`, Point 5.
