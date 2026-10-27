# Platform-owned migration recovery

School administrators prepare inventory, validate files and approve reconciliation.
They see only Pending, On hold or Ready recovery status. They cannot submit recovery
attestations, even by calling the server action directly.

Platform administrators open School access requests and select Migration recovery
on a created school's request. The guarded page is
`/platform/onboarding/recovery/[schoolId]`. Saves use the explicit target school and
authenticated operator; existing append-only audit history, inventory version checks,
school-row locking and import/completion recovery gates remain unchanged.

## Read-only Neon catalog check

Configure these server-only environment variables in the correct deployment scope:

- `NEON_RECOVERY_PROJECT_ID`
- `NEON_RECOVERY_BRANCH_ID`
- `NEON_RECOVERY_API_KEY`

Use a narrowly scoped credential where supported. Never expose the key with a
NEXT_PUBLIC prefix, paste it into recovery fields, or log provider bodies.
`DATABASE_URL` supplies the expected database host; the check verifies it against
the configured branch's provider endpoint catalog, including pooled-host handling.
`MIGRATION_RECOVERY_DATABASE_REFERENCE` still binds saved evidence to the deployment.

Check Neon snapshots performs only authenticated GET requests to the fixed Neon
API origin. It never creates/deletes a branch or snapshot, restores production,
changes schedules, or modifies a recovery checkpoint. Missing configuration,
provider failures, invalid data and database-host mismatches cannot mark ready.

The catalog reports snapshot existence and creation dates, not independently verified
recovery cutoffs, retained PITR coverage, measured RPO/RTO, restore success or key
custody. Backdated snapshots may have different creation and recovery-cutoff times.
Operators must record the actual verified cutoff and successful drill evidence.
The manual path remains clearly labelled as operator attestation, not provider proof.

## Operations and limits

Routine school onboarding creates no Neon branches. Scheduled backups and routine
catalog verification are distinct from periodic isolated restore drills.
Configure backup schedules/retention separately; this change does not enable them.
Neon documents backup schedules at:
https://api-docs.neon.tech/reference/setsnapshotschedule
and snapshot catalog inspection at:
https://neon.com/docs/reference/api/snapshots/list-snapshots

Branch limits can still be reached by retained restore/test branches. Snapshot and
branch limits are separate; do not promise unlimited capacity or assume an account's
exact limit. Establish an approved retention/cleanup policy and capacity monitoring.
Never automatically delete arbitrary branches to free a slot. Check all deployment
connections, preserve required evidence, and obtain approval for cleanup.

## Remaining rollout work

This is an ownership split plus a read-only provider diagnostic, not a full automatic
checkpoint issuer. There is no scheduled refresh or automatic ready approval.
There is no per-school restore drill requirement: a current, applicable verified
drill can be referenced across schools, while school inventory/cutover decisions
and fresh backup checkpoints remain individually audited.

Provider configuration and authenticated verification, scheduled backup coverage,
independent encryption-key recovery and production restore evidence must still be
completed. Do not invent evidence or bypass the existing gates for synthetic data.
Return to docs/production-readiness.md Point 5 before real school admission; deployment
and passing tests are not production certification. Run post-deployment smoke tests
and an authenticated platform-admin/school-admin walkthrough before continuing EIS.
