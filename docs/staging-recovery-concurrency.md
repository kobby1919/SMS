# Staging HOLD And Completion Races

## Verified On 2026-10-20

Five checks passed using the actual recovery, inventory, CSV staging/import, reconciliation and onboarding completion services against the pinned Neon staging database. Prisma used the restricted pooled runtime login; separate direct connections coordinated and observed contending transactions. No database calls inside these services were mocked.

| Check | Verified outcome |
| --- | --- |
| HOLD commits before waiting import | HOLD was saved; the import was rejected without a subject or import audit. A fresh retry was also rejected as on hold and the upload stayed VALIDATED. |
| Active import before HOLD | The contending import committed one subject/import audit. HOLD was then confirmed saved, with its audit after the import audit. A new upload could be staged but could not be imported; the import count stayed one. |
| Inventory edit before completion | Reopening the confirmed scope invalidated its previous approval. Contending completion was rejected; school status/timestamp and completion audit were unchanged. A fresh completion retry remained blocked. |
| HOLD before completion | With imported subjects, academic foundations and valid reconciliation approval already in place, HOLD blocked both contending completion and a fresh retry. No completion timestamp or audit was written. |
| Concurrent completion requests | After explicitly clearing the synthetic HOLD, exactly one request completed onboarding and created one completion audit. The other conflicted; a later retry returned the completed school without a second audit. |

A rejected serializable HOLD is not an effective HOLD. The rehearsal allows only that specific conflict, checks that the prior revision remains current, and explicitly records HOLD again after refresh when needed. It does not silently label a failed save active. HOLD fences the migration/setup operations documented in Point 4; it is not a general school shutdown switch or a promise to undo work that already committed.

The three synthetic schools and their subjects, uploads, grades, classes and onboarding audits were deleted by exact journaled IDs and verified absent. Production, local school records, hosting configuration, live providers and credentials were not modified. Application code was unchanged in this milestone.

## Safety And Scope

```sh
node tools/database/staging-concurrency.mjs --recovery
node tools/database/staging-concurrency.mjs --recovery --execute
```

Default is a read-only preflight. All earlier guards remain: distinct pinned staging/production hosts, exact saved runtime URLs, reviewed baseline and recent permission evidence, maintenance advisory lock, empty staging schools/audits, pre-recorded fixture IDs, explicit execution authorization, bounded control-transaction lifetime and scoped cleanup. Only one suite may be selected at a time.

Sanitized local evidence: `.private/database-evidence/staging-recovery-concurrency.json`. No credentials or CSV contents are printed. Interrupted cleanup requires separate explicit authorization with `--recovery --cleanup-interrupted --execute`, matching failed-run evidence and verified synthetic identities; it never marks the interrupted checks passed.

The shared contest helper now waits for all started requests even if its control rollback fails. Local regression tests cover that behavior and exact-ID cleanup ordering, including deleting classes before grades.

The harness uses an isolated test environment and ephemeral encryption key. Synthetic READY plans have no production evidence, and no backup/restore claim is fabricated. Clerk, invitations, notification delivery and unused people/finance paths throw if invoked; cache invalidation is disabled. These checks therefore do not certify HTTP authentication, authorization, cache behavior, people/financial imports, production recovery attestations, durable key recovery or load capacity. The previously recorded pg driver deprecation warning remains for dependency review.

## Still Required Before Schools

Return to `docs/production-readiness.md`, Point 5: complete the isolated backup/restore drill, encrypted staging redeploy/retention/cleanup, mixed financial/score workloads, other representative record-edit/import races, authenticated tenant/role isolation, desktop/mobile walkthroughs, dependency security fixes and enabled provider/webhook/worker tests. These tests cover inventory edits versus completion, not every possible school-record edit path. Run Vercel smoke tests immediately after deployment and before inviting schools. Code tests and successful deployment alone are not production certification.
