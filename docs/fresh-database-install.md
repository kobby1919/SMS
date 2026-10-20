# Fresh database installation

## Why this path exists

Replaying `prisma/migrations` on an empty PostgreSQL database fails at
`20260520000000_add_school_tenancy`: CAConfig and other pre-tenancy CA,
curriculum and finance tables were added to the historical Prisma schema without
matching committed creation migrations. This was reproduced in isolated PostgreSQL
using PGlite. A separate replay starting from the schema at commit `593a38c`
successfully applied the later legacy SQL. Comparing that replay against today's
model also identified the missing ParentTeacherContactMessage.studentId column/FK
and historical default/index naming differences.

Do not edit applied historical migrations, reset an existing database, use db push
as the deployment plan, or falsely mark the legacy chain applied.

## New installations versus existing records

- `prisma.config.ts` and `prisma/migrations` remain unchanged for existing local records.
- `prisma.fresh.config.ts` explicitly selects `prisma/fresh-migrations` and only
  reads `EDUJAY_MIGRATION_DATABASE_URL`. It does not load the working `.env`.
- The fresh baseline uses today's canonical Prisma schema, retaining 18 SQL-only
  CHECK constraints and five additional legacy indexes, including both payment
  reference and open correction partial unique indexes.
- The baseline is one transaction and seeds no school, account, balance or payment.
  Bootstrap the first company-authorized admin separately through the guarded app flow.
- Existing database histories must not be switched to this chain. Any adoption
  requires independent schema/history reconciliation and a reviewed transition.
- New production and staging databases must use this fresh history consistently.
  After its first application, never regenerate or edit the baseline. Append future
  migrations to this history, update the reviewed schema/bundle guard deliberately,
  and replay the complete fresh history in tests. Do not run the legacy chain against it.

The generated provenance records the original migration checksums and source schema
commit. `tools/database/reconstruct-fresh-install.mjs` is an offline investigation
tool, not a deployment command. Its `--write-baseline` mode refuses to overwrite
existing generated artifacts. Do not use it to regenerate an already applied baseline.

## Staging connection preparation

Use a Git-ignored file `.private/neon-staging-migrations.env`:

```dotenv
EDUJAY_MIGRATION_DATABASE_URL=
EDUJAY_EXPECTED_DATABASE_HOST=
EDUJAY_PRODUCTION_DATABASE_HOST=
```

Fill these privately, not in chat:

1. Neon staging -> Connect -> neondb / neondb_owner -> pooling OFF.
2. Copy the direct staging URL into EDUJAY_MIGRATION_DATABASE_URL, retaining TLS.
3. Copy its hostname only into EDUJAY_EXPECTED_DATABASE_HOST.
4. Obtain the production direct hostname only and put it in
   EDUJAY_PRODUCTION_DATABASE_HOST. Never put the production password in this file.
5. Independently confirm the endpoint-to-branch mapping in Neon. Host pinning prevents
   accidental URL substitution; it cannot prove an operator labelled a branch correctly.

Do not change the app's existing DATABASE_URL. Owner credentials are for controlled
migrations only, never the final app runtime role. Staging and production use distinct
endpoints, passwords and runtime credentials.

## Read-only staging preflight

From the repository root (works in Bash or PowerShell):

```bash
node tools/database/fresh-install.mjs --environment staging --env-file .private/neon-staging-migrations.env
```

This does not run migrations. It checks the pinned direct endpoint, migration role,
TLS, reviewed schema checksum and absence of user relations/enums. A session advisory
lock coordinates this runner; all operators must still avoid concurrent manual DDL.
No default `.env` connection is used and raw database/provider errors are not printed.

## Explicit staging initialization

After reviewing the preflight target and confirming it is the disposable empty branch:

```bash
node tools/database/fresh-install.mjs --environment staging --env-file .private/neon-staging-migrations.env --execute
```

The runner invokes Prisma 7 migrate deploy with the fresh config, then migrate diff
against the canonical model. It verifies Prisma's recorded checksum, the 18 check
constraints and the valid financial partial indexes. Successful evidence is written
to `.private/database-evidence/staging-fresh-install.json` without a password or URL.
It refuses an already initialized database rather than reset it. On failure, inspect
the state and recover deliberately; do not delete migration bookkeeping or repeatedly retry.

If schema creation completed but subsequent verification stopped, use the read-only
verification mode after investigating the failure. This mode does not run migrate deploy:

```bash
node tools/database/fresh-install.mjs --environment staging --env-file .private/neon-staging-migrations.env --verify-only
```

The first Neon staging rehearsal exposed three preserved historical indexes absent
from the Prisma model. These are now explicitly represented in schema.prisma (the
legacy CA unique index and two report-submission indexes). The applied baseline SQL
and its checksum were not edited; the reviewed schema fingerprint was updated.
The two financial partial indexes remain SQL-only and are checked separately.

## Production remains separately gated

Only after staging initialization, runtime-grant tests and authenticated app review:

1. Prepare a separate `.private/neon-production-migrations.env` with production
   owner credentials and explicitly pinned production hostname.
2. Confirm backup/recovery arrangements and that the production target is still empty.
3. Review the exact baseline and the recent distinct-staging evidence.
4. Run the production preflight with --environment production, --approve-production
   and --staging-evidence .private/database-evidence/staging-fresh-install.json.
5. Only add --execute after that read-only preflight is reviewed.

The same runner validates environment/endpoint separation, a matching baseline and
staging evidence no older than seven days. This local evidence is an operator record,
not a cryptographic attestation or production certification. Do not put migration
owner credentials or this command in the Vercel build. Runtime roles/grants and their
pooled URLs are configured separately after tables exist; exclude migration-history
access and database/schema administration privileges.

## Verification and remaining gates

```bash
node --test tests/fresh-database-install.test.mjs
```

Tests exercise actual isolated PostgreSQL DDL/catalogs and financial duplicate
constraints, schema parity, zero seeded records, preserved legacy checksums, target
guards, production-evidence checks and refusal to overwrite an installation.
They do not connect to Neon or certify its runtime permissions, TLS/network behaviour,
concurrency, restoration or the authenticated application. Complete those on staging
and return to `docs/production-readiness.md`, Point 5, before opening the pilot.

Live staging rehearsal on 2026-10-20 subsequently passed initialization and read-only
verification: 91 application tables (plus Prisma history), no canonical schema diff,
matching applied checksum, 18 CHECK constraints and both valid financial partial
unique indexes. School/student/payment/admin counts were zero. The SQL baseline was
not edited or reapplied when correcting the three Prisma index declarations. This
does not certify runtime-role permissions or any authenticated business workflow.

Dependencies reported security advisories during the pinned test-dependency install.
Review and resolve exploitable runtime findings before deployment; do not run an
unreviewed `npm audit fix --force` as part of database setup.
