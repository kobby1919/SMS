# Isolated Snapshot Schema Verification

## Verified On 2026-10-20

The operator created the staging snapshot shown as `staging at 2026-10-20 17:42:20 UTC (manual)`, then selected multi-step restore. The console reported a new branch, leaving staging unchanged. No connection migration or finalization was performed by these tools. The snapshot reference/time here comes from the supplied console screenshots, not a provider API attestation.

The private connection to restored branch `br-mute-smoke-bavqdjyg` was checked with verified TLS. Its endpoint differs from both pinned staging and production endpoints, and the server's `neon.branch_id` matched the operator-provided restored branch ID.

- Every read ran inside a repeatable-read READ ONLY transaction; no migrations, resets, data cleanup or switchover ran.
- All 91 application tables, columns/types/defaults/nullability, primary/foreign/unique/CHECK constraints, index definitions and enums matched the immutable reviewed fresh baseline, instantiated separately in memory.
- All 18 CHECK constraints were present. Index readiness/validity and constraint validation were checked separately.
- Prisma migration history contained the one expected completed baseline, its exact checksum, and no rollback marker.
- Every application table had zero rows, matching this checkpoint after synthetic rehearsal cleanup. The migration-history row is intentionally retained.
- Sanitized evidence is ignored by Git at `.private/database-evidence/restored-snapshot-schema.json`; connection credentials remain in `.private/neon-restore-verification.env` and are never printed.

The first comparison found PostgreSQL 18's additional table NOT NULL catalog entries, not lost constraints. The cross-version comparison now checks required/nullability through each column's `attnotnull`, compares the remaining constraint definitions explicitly, and checks validation across all public constraints. PostgreSQL documents these catalog entries in [pg_constraint](https://www.postgresql.org/docs/18/catalog-pg-constraint.html). No database objects were changed to obtain a pass.

## Repeat Read-Only Verification

```sh
node --test tests/restored-snapshot-verification.test.mjs
node tools/database/verify-restored-snapshot.mjs
```

The verifier requires explicit private restore settings, the pinned source/production hosts and the reviewed baseline bundle. It refuses the source staging or production endpoints, pooled URLs, wrong database/role, weak TLS, unreviewed connection options and a server branch identity mismatch when the setting is available. The evidence explicitly distinguishes a server-confirmed branch ID from an operator-only binding; this run confirmed it on the server.

No provider credentials are needed for this read-only database inspection. It cannot independently attest snapshot creation, provider retention, point-in-time coverage or routing configuration. No browser/desktop automation is used.

## Not A Completed Data-Recovery Drill

This snapshot contains schema and empty application tables. It does not prove recovery of school records, guardian links, placements, fee lines, discounts, bills, receipts, audits or encrypted uploads. No end-to-end RPO/RTO target was measured; delays between manual operator steps must not be reported as the provider's restore performance.

Before real school admission, perform an isolated, representative synthetic-data restore with recorded source controls, financial reconciliation and encrypted-upload/key recovery. Measure the recovered cutoff and end-to-end recovery duration against agreed targets. Keep restored workers/providers disabled, then separately authorize expiry/deletion of the recovery branch and snapshot after evidence retention is agreed. The console screenshot showed no expiry; do not leave unused recovery resources indefinitely or silently delete this evidence.

Keep `docs/production-readiness.md`, Point 5 open: durable encryption/redeploy/retention cleanup, other representative record-edit and financial workloads, authenticated tenant/role isolation, desktop/mobile checks, dependency security fixes and provider/webhook/worker verification remain pending. Perform Vercel smoke tests after deployment and before admitting schools. Neither this schema check nor passing code tests is production certification.
