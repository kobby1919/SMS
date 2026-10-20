# Restricted Staging Database Login

## Verified On 2026-10-20

The staging-only `edujay_app` login was created through SQL, not the Neon console's privileged role-creation workflow. Both direct and pooled connections passed verified-TLS authentication and actual PostgreSQL permission probes against the pinned staging endpoint.

- SELECT, INSERT, UPDATE and DELETE allowed on the reviewed 91 application tables.
- Sequence USAGE allowed; sequence UPDATE not granted.
- No superuser, database/role creation, replication, RLS bypass, inherited role memberships or object ownership.
- Schema creation, temporary tables, ALTER TABLE, TRUNCATE, Prisma migration-history reads/writes, role creation and switching to `neondb_owner` denied.
- Synthetic School CRUD probes were rolled back; zero probe rows remain.
- Production and existing school databases were not changed.

This is application-wide table access, not database-enforced tenant isolation. Application school/role guards still need production-like authorization tests. It does not establish database-enforced audit immutability.

## Private Configuration

The ignored `.private/neon-staging-runtime.env` contains the pooled `DATABASE_URL` and the direct `EDUJAY_STAGING_DIRECT_URL`. Never commit, print or screenshot its contents. Use the pooled runtime URL only for the staging/Preview environment; never assign it to Vercel Production. No Vercel variables or working local database connections were changed by this step.

The owner connection remains separately stored in `.private/neon-staging-migrations.env` for reviewed migrations. It must not become the application's runtime credential. Protect the private folder with the workstation's user-account permissions; the file mode requested by Node alone is not a Windows ACL guarantee.

Sanitized local evidence: `.private/database-evidence/staging-runtime-role.json`. It contains no passwords or connection URLs.

## Repeatable Checks

Run from the repository root:

```sh
node --test tests/database-runtime-role.test.mjs
node tools/database/staging-runtime-role.mjs
node tools/database/staging-runtime-role.mjs --verify
```

The default command is a read-only preflight. `--verify` performs synthetic CRUD inside rolled-back transactions using the existing private credentials. `--apply` is only for the initial authorized staging setup; it refuses an existing role or credential file and never silently rotates passwords. It requires recent matching fresh-install evidence and the reviewed schema/table allowlist. If setup fails, inspect the staging state privately before any retry; the credential file is deliberately retained and no automatic cleanup occurs.

PUBLIC schema CREATE and database CREATE/TEMP privileges were revoked on staging so the restricted role cannot gain them implicitly. Owner rights remain intact. This policy is appropriate to the isolated staging database; do not apply it blindly to a shared database.

Future tables are intentionally not auto-granted. Review runtime access after each migration and extend the explicit allowlist/grants through a reviewed change. The current one-baseline verifier intentionally stops once migration history changes until updated for that reviewed bundle.

## Remaining Gates

Return to `docs/production-readiness.md`, Point 5 before real school admission: real database concurrency, desktop/mobile workflows, encrypted staging retention/redeploy/cleanup, isolated backup/restore, tenant/role isolation, dependency security fixes and enabled provider/webhook/worker verification. Immediate Vercel smoke tests happen after deployment, before inviting schools. Passing code and permission tests alone is not production certification.
