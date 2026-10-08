# Migration inventory and agreement

Before importing, an admin declares the source, school representative, datasets,
source filenames, expected counts, optional periods and opening bill controls.
Every dataset is explicitly included, deferred or excluded. Historical records
without an importer must be deferred or excluded with a reason, not silently lost.

Confirmed inventory is a scope agreement, not proof of a completed migration.
Financial control totals are school-declared opening balances, not new payments.
Import reconciliation, school sign-off, protected file storage and restore testing
are separate upcoming work. This inventory does not guarantee complete migration.

Inventory versions are append-only onboarding audit snapshots, scoped to the school
and authenticated admin. Saving checks the expected version while updating and
locking the school row. Imports share-lock that row; older serializable snapshots
fail rather than import against a scope that was reopened concurrently.
New imports require the latest confirmed inventory to include
their dataset. Each new batch records the agreed inventory version. Earlier batches
are unchanged. Revising scope reopens it as a draft and blocks imports until confirmed.

Apply the additive Prisma migration before enabling the feature. No data reset is
needed. Uploaded files themselves are not stored by the inventory form.

Student files create or link guardians, so both datasets must be included in the
agreement. The same student file may be listed as the guardian source. Editing a
draft or reopening scope clears acknowledgement; confirmation requires it again.
