# Point 4: Backup, Recovery And Cutover Safety

## What Edujay Enforces

- Recovery controls are append-only school-scoped audit records, written by an authenticated admin. The server chooses the school and actor; client input cannot choose either.
- Each new import audit links to the recovery checkpoint used inside its transaction. Development imports without a live checkpoint are explicitly recorded with a null checkpoint, not invented evidence.
- A version check rejects stale saves. School-row locking serializes recovery changes with imports and setup transitions.
- A HOLD stops new migration writes and setup progression in every environment. It does not delete data, undo payments, revoke existing accounts or pause the entire application.
- Production imports and migration setup progression require a READY checkpoint for the current inventory revision, a completed backup recorded within 24 hours and a successful isolated restore drill recorded within 30 days. Future dates are rejected.
- Development does not require live provider evidence. A locally recorded checkpoint without that evidence cannot pass the production gate.
- Checkpoint evidence is an operator attestation, not provider verification or an automatic backup. A checkbox cannot prove a restore. The deployment team must inspect the referenced evidence independently before go-live.
- Recovery targets are requirements chosen by the school and deployment team, not guarantees. The 24-hour checkpoint limit does not prove a shorter agreed recovery-point target is met; the actual backup/PITR schedule and measured restore duration must meet those targets.
- Restores, destructive rollback and provider credentials are deliberately absent from the school-admin UI.

## Before An Import Window

1. Assign a recovery decision owner and a deployment operator. Agree maximum acceptable data loss and recovery duration, downtime, source-data cutoff and who records changes during the migration window.
2. Confirm Point 1 inventory and preserve the original files outside Edujay in access-controlled storage. Compare checksum, row counts and opening balances. Uploaded copies expire; they are not archival backups.
3. Confirm the actual target database/environment. Enable the selected provider's appropriate backup/PITR retention and monitor successful backup activity. Record a completed checkpoint identifier and UTC timestamp, not merely "backups enabled".
4. Store staging-encryption key recovery material separately in a restricted secret manager. Preserve the matching key versions until encrypted backups expire. Never commit keys or place credentials in checkpoint references, screenshots or source files.
5. Complete an isolated restore drill and record its evidence. Confirm that backup retention and the measured restore outcome meet the agreed targets.
6. In Recovery and cutover, record the decision owner, targets, cutover plan and evidence references. Use HOLD if evidence, reconciliation or source ownership is uncertain. Renew the checkpoint when its evidence expires or the inventory changes.

## Isolated Restore Drill

Only an authorized deployment operator performs this procedure. Do not restore into the active Edujay database.

1. Provision a separate recovery database/project. Independently compare provider project IDs, database names and credentials with production. Different URL strings alone do not prove different databases.
2. Restrict network access and create credentials limited to the isolated recovery target. Disable all application workers, email, payment/webhook handlers and outgoing delivery on the restored environment; it must never connect to live providers.
3. Use the provider's documented restore workflow or an encrypted, complete PostgreSQL backup with a compatible PostgreSQL tool version. Keep TLS, integrity checks, access controls and retention enabled. Document whether schema, records and required database objects are included. Do not treat a browser CSV export as a database backup.
4. Restore into the isolated target, capturing exit status, backup identifier, restore start/end, operator and sanitized logs. Restore staging keys separately using restricted access; never print them.
5. Verify school counts, imported record identities, guardian links, placements, fee lines, discounts, bill balances, audit logs and staging-file decryption. Run reconciliation against the approved source controls. Confirm no external notifications or payments occurred.
6. Record measured recovery time and the recovered cutoff. Compare actual results with the agreed targets. Failed checks mean HOLD, not READY.
7. Record the successful drill reference and date. Securely expire the recovery copy after the agreed retention period. It contains sensitive data from every included school.

## Cutover / Go-No-Go

- Agree the final source-system cutoff; prevent parallel uncontrolled edits and payments across old and new systems. Pause relevant workers/delivery during the controlled cutover using the deployment platform's operational controls. The migration HOLD is not a global write freeze.
- Take and verify a final backup checkpoint. Import only validated staged rows; inspect held/skipped rows instead of claiming complete migration.
- Complete Point 3 reconciliation, representative approval and the production-readiness checklist. Test roles, links, bills and reports before enabling live payments or sending production invites.
- Record the deployed commit, environment, checkpoint, source cutoff, approval evidence, decision owner and release time in the operational change record.
- Keep the old source read-only for the agreed retention window. The owner signs go/no-go only after evidence is reviewed. Setup completion alone does not certify production readiness.

## If Migration Goes Wrong

1. Record HOLD immediately and pause affected operations externally where necessary. Preserve the source, staging metadata, audit logs, provider references and failure evidence.
2. Identify the affected school, batch and records. Decide whether scoped corrections can fix the problem without losing valid post-cutover work. Never casually delete an import batch or clear audit evidence.
3. Restore a backup to an isolated database first. Compare pre/post-cutover changes, including successful payments, receipts, reversals and invitations. Reconcile provider-side transactions before deciding on recovery.
4. Never roll back the shared production database just to undo one school's import: that would also overwrite other schools' valid activity. Prefer reviewed, school-scoped correction plans. Automated selective rollback is not implemented.
5. If whole-database recovery is necessary, the deployment decision owner explicitly authorizes downtime and the recovery point, coordinates every affected school, fences all writers/workers/webhooks and preserves subsequent financial/provider events for verified replay. Restoring rows cannot undo a real bank transaction or remove a Clerk account.
6. Reconcile records, financial controls and external references after recovery. Record what changed, who approved it and when. Renew checkpoint evidence before releasing HOLD and reopening operations.

## Deferred Until Real Services

Return to all five migration-safety points before opening to schools. Point 5 tracks this return.

- Configure actual provider backups/PITR, retention, encryption-key custody and alerts.
- Execute a real isolated restore and document measured data-loss/recovery targets.
- Exercise recovery holds/import races against the real database and test the UI on mobile/desktop.
- Prove cutover worker/write fencing and recovery of provider events without duplicate financial posting or delivery.
- Have the deployment operator independently validate checkpoint references. Provider API attestation and automatic restore verification are not implemented.
