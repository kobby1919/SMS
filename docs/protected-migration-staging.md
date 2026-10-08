# Protected migration staging

## What is protected

The validation endpoint receives a bounded CSV and column mapping, parses the CSV
on the server, runs current validation, then stores an encrypted snapshot in
MigrationStagedUpload. It does not create students, users, bills or payments.
Raw files and import results use AES-256-GCM with separate authenticated contexts
bound to the school, upload ID and purpose. SHA-256 identifies the original CSV.
Metadata includes uploader, row count, size, agreed inventory revision and expiry.
No raw CSV or decrypted storage object is placed in public assets or audit logs.

Only authenticated school admins may list, resume or cancel their school's files.
Resume revalidates against current school records. Import accepts only an upload ID,
decrypts the server snapshot. Validation runs inside the serializable live import transaction,
it checks the current agreed inventory, locks the staging record, checks expiry and
state, writes clean rows, records the source checksum and marks the upload imported.
Successful repeats return the saved encrypted result instead of importing twice.
Concurrent imports may return a retryable conflict; no second live import is allowed.
Cancelled or expired uploads cannot import. Files from an older inventory revision
must be staged again after the scope is revised.

## Limits and retention

CSV: 1 MB, 2,000 rows, 120 columns, 2,000 characters per cell. JSON request bodies
are stream-bounded even without Content-Length. Twenty pending and 100 retained
encrypted source files per school; pending files are listed before recent history
so they cannot be hidden by newer imports or cancellations. The HTTP endpoints
are rate-limited. CSV files must use UTF-8; invalid bytes are rejected rather than
silently replacing names or identifiers. Checksums cover that original UTF-8 text,
including any BOM. Original source copies expire
after seven days. Cancellation clears encrypted source/result immediately and keeps
the metadata and audit trail. Expired files are cleared when validating another file
or when an admin selects Clear expired files. Expiry blocks access even before purge.
An authenticated cleanup job is available at POST /api/internal/migration-staging/purge.
Configure MIGRATION_STAGING_WORKER_SECRET (at least 32 random bytes) and send it as
a Bearer token. Each run clears up to 100 schools; schedule regular runs and retry
until a run reports zero processed schools. An unattended production cleanup
schedule is still required before go-live; database
backup retention must also follow the school's retention policy. Database snapshots
may retain encrypted copies after application purge.

## Local and production configuration

Development uses the dedicated, Git-ignored .private/migration-staging.key if no
environment key is configured. That file is not a production secret store.
Production MUST set MIGRATION_STAGING_ENCRYPTION_KEY to a cryptographically random
32-byte base64 key in the host's secret configuration. Missing configuration fails
closed. Never rotate/remove a key while files encrypted with it are retained. A
future key rotation rollout must migrate old ciphertext before retiring the old key.
The key must be stored separately from database backups and restored securely.

The current adapter is DATABASE_ENCRYPTED_V1. This works without object storage.
Provider-specific storage is isolated in migration-staging-storage.ts; private cloud
storage can be added behind that boundary. Existing ciphertext requires its original
adapter/key until migrated. Credentials alone are not a substitute for integration,
permission, restore, concurrency and retention tests before real school migration.

Apply the additive staging migration and regenerate Prisma before running.
Original CSV exports must remain with the school; staging is not a backup service.
School reconciliation/sign-off is the next part, not certified by a saved upload.
