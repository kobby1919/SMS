# Staging Migration Workflow Races

## Verified On 2026-10-20

Four subject-only workflow checks passed against the pinned Neon staging endpoint using the restricted runtime login and real pooled Prisma transactions. The actual CSV parser, AES-GCM storage adapter, validation, staging, importer, cancellation and reconciliation services were loaded from source. Direct connections coordinated the contests and observed the blocking chain before releasing it.

| Check | Verified outcome |
| --- | --- |
| Two imports of the same encrypted upload | Exactly one import committed, creating one subject and one import audit. The losing transaction conflicted. Retrying returned the identical decrypted saved result without another import audit. |
| Cancellation commits before a waiting import | Cancellation cleared both encrypted fields. The import was rejected, with no subject and no import audit; one cancellation audit remained. |
| Import commits before a waiting cancellation | The import committed one subject/audit and retained its encrypted result. Cancellation was rejected and did not add a cancellation audit for the imported upload. |
| Import versus stale approval | The waiting import committed; the stale approval was rejected and created no approval audit. A fresh reconciliation had a new fingerprint, passed its checks and was successfully approved once. |

Synthetic schools, subjects, uploads and audits were deleted by journaled school IDs and verified absent. Production, working school records, Vercel settings and live providers were not modified. Sequence counters were not reset.

## Failures Found And Addressed

- Real staging exposed an unsupported PostgreSQL `void` result from Prisma `$queryRaw` advisory-lock calls. The three affected lock sites now use `$executeRaw`; transaction lock keys and locking behavior are unchanged. The real staging quota lock passed afterward. Finance/discount sites received the same compatibility correction, but financial workflow concurrency is not certified by this subject-only run.
- Raw serialization failures can arrive as Prisma P2010 with PostgreSQL 40001 rather than P2034. The import endpoint now recognizes the explicit serialization/deadlock codes and returns its safe HTTP 409 review/retry response. Unrelated raw errors are not reclassified. An isolated endpoint test verifies the response and preserves server-derived school/admin scope; it is not live HTTP authentication evidence.
- One rehearsal control lock accidentally also blocked cancellation's foreign-key audit insert. The identified test-only control session was terminated to release its lock. Its three journaled fixtures were cleaned through explicit interrupted-run recovery, then the corrected suite passed. The control lock now uses NO KEY UPDATE for School, allowing audit KEY SHARE locks while fencing the import's SHARE lock. Controls have a database-side 20-second idle-transaction timeout and connection-error handlers; cleanup still runs after a control connection fails.

The harness disables only Next cache invalidation and blocks unused people/finance helpers. Services run with an isolated test environment and an ephemeral encryption key, without changing process.env. This deliberately does not claim production backup evidence, durable key recovery across deployment, cache invalidation, HTTP/Clerk authentication, people imports, financial imports or load certification. The production recovery gate remains unchanged.

During contended transactions the PostgreSQL driver emitted a deprecation warning about overlapping queries, unsupported in a future pg 9 release. The current pg 8 run passed; retain driver/Prisma version compatibility and this warning in the pre-pilot dependency review rather than assuming a future major upgrade is safe.

## Run Safely

```sh
node tools/database/staging-concurrency.mjs --workflow
node tools/database/staging-concurrency.mjs --workflow --execute
node --test tests/migration-service-harness.test.mjs
```

Default is a read-only preflight. Execution retains the staging-only endpoint pins, reviewed baseline/runtime evidence, maintenance lock, empty-school/audit requirements and explicit write authorization of the inventory rehearsal. Sanitized results and pre-recorded fixture IDs are kept in ignored `.private/database-evidence/staging-workflow-concurrency.json`; no credentials or CSV contents are printed.

If interrupted, inspect that journal and staging state first. Only after explicit authorization, `--workflow --cleanup-interrupted --execute` validates matching failed-run evidence and synthetic identities, deletes those exact fixtures and records cleanup without claiming the rehearsal passed. Never reset the database or delete unrelated records to make a check pass.

## Remaining Release Gates

Completion/edit and recovery-HOLD races, full importer versus inventory edits, mixed financial/score workload races, isolated backup/restore, durable encryption/redeploy/retention cleanup, desktop/mobile walkthroughs, authenticated tenant/role isolation, dependency fixes and enabled provider/webhook/worker verification remain pending under `docs/production-readiness.md`, Point 5. Run Vercel smoke tests immediately after deployment and before admitting schools. Passing this suite or code tests does not certify production readiness.
