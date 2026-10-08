# Edujay Production Preparation

## Point 5: Production DevOps And Live-Service Verification

This is the return checklist when paying for real services, configuring production credentials, or preparing Vercel deployment. Code checks do not replace live-service verification. Do not open the app to schools until the relevant pre-go-live gates pass.

### Pilot Versus Wider Production

A pilot with real school records, real users or real payments is already a production responsibility, even with one school. Complete the applicable security, recovery and correctness gates below before that pilot. A private demonstration using synthetic data in an isolated test environment can happen earlier; it must not be described as a completed live-service test.

Point 5 combines implementation and operations. Configuration validation, deployment automation, scheduled jobs, monitoring integrations and automated tests are engineering work. Service configuration, restoring a real backup, examining evidence, assigning incident owners and authorizing release are procedures. Neither code alone nor a written checklist completes it.

### Deferred Checks Register: All Five Parts

| Part | Required before a real-data migration pilot | Evidence to retain |
| --- | --- | --- |
| 1. Inventory and agreement | Representative confirms datasets, counts, source filenames, guardian scope and exact opening financial controls; explicitly agree excluded/deferred history. | Approved inventory revision, authorized representative, source controls and cutoff. |
| 2. Protected workspace | Configure persistent production encryption key and authenticated purge secret; prove decryption after redeploy; run scheduled cleanup with actual hosting limits; verify expired contents are cleared without deleting school records/audits. | Key-custody record without secret values, redeploy/decryption result, purge execution and retention evidence. |
| 3. Reconciliation and approval | Real database concurrency tests: duplicate import, scope change versus import, approval versus import, cancellation versus import and completion versus edits. Verify individual fee lines/discounts/ward links, resolve legacy evidence, and exercise desktop/mobile, large batches, stale tabs, errors and exports. | Test outcomes, source comparison, current approval fingerprint, held-row decisions and device walkthrough. |
| 4. Recovery and cutover | Configure provider backup/PITR retention; successful isolated restore with measured recovery targets; recover encryption keys/files; configure the deployment database reference; independently validate recent checkpoint evidence; test HOLD/import/setup races; prove operational write/worker fencing and external-payment reconciliation. | Completed backup identifier, restore logs/results, decision owner, deployment reference, checkpoint, cutoff and recovery/cutover sign-off. |
| 5. Production operations | Separate environments and credentials, least privilege, dependency security fixes, monitoring/alerts, scheduled worker recovery, valid HTTPS/auth redirects, verified delivery/payment integration for enabled channels, and deployed smoke tests. | Deployed commit, environment checklist, alert/worker tests, provider tests and documented go/no-go decision. |

This register does not claim these checks have passed. Each unchecked item below needs an owner, date, actual result and evidence before release. Revisit all five parts when services are configured, not just this document's heading.

### Order When Hosting Is Available

1. Prepare separate test and production environments; install reviewed migrations; configure secrets, durable staging encryption, the recovery database reference, TLS and restricted database access. Rotate exposed credentials.
2. Configure backups and monitoring immediately. Prove an isolated restore before importing real school data.
3. Run a controlled synthetic-data school migration and all concurrency, role, tenant, retention, redeploy and device checks. Fix failures; never use a customer school as the first recovery experiment.
4. Test workers and whichever delivery/payment providers the pilot actually enables. Disabled SMS/WhatsApp can remain deferred. Live money requires separate explicit authorization and verified provider integration.
5. Agree the pilot school's inventory and source cutoff, renew its recovery checkpoint, reconcile and approve its records, then authorize the controlled real-data pilot.
6. Review pilot results before wider rollout. Continue backups, monitoring and recurring restore drills throughout both phases.

### Where These Parts Operate

For an existing school bringing records to Edujay: school identity -> migration path -> inventory/recovery controls -> protected upload/map/validate/import -> reconciliation and school approval -> readiness -> completion. The migration workspace appears at `/onboarding/setup/migration` during initial setup; the protected workspace also exists at `/admin/data-migration` for authorized follow-up work, without requiring a management-menu link.

A brand-new school choosing Start Fresh and entering records manually does not need an artificial import inventory or reconciliation. Platform-wide backup, security, monitoring and deployment gates still apply. If it later imports existing records through the migration workspace, the migration controls apply to those imports too. Recovery HOLD only fences the migration/setup operations documented in Point 4; it is not a general school shutdown switch.

### When Service Setup Starts

- [ ] Confirm the paid-service budget, billing owners and spending alerts; record decisions without storing secrets here.
- [ ] Separate development, staging and production databases, Clerk instances, payment keys, email settings and webhook secrets.
- [ ] Configure Vercel environment scopes deliberately; previews must not write to the production database or use live payment credentials.
- [ ] Purchase the chosen domain and verify the actual provider-issued email DNS records before sending production invites.
- [ ] Replace or rotate previously shared test secrets. Keep credentials out of Git, screenshots and command output.

### Migration Gates Before Go-Live

- [ ] Point 1: verify inventory counts and financial controls with an authorized school representative; document deferred/excluded records.
- [ ] Point 2: configure a durable production staging encryption key and separate authenticated cleanup secret. Prove encrypted files can be opened after restart/deployment; never rely on the local development key file in production.
- [ ] Point 2: configure the scheduled retention cleanup on the selected hosting platform. Verify expiry deletes protected file contents, not imported live records or audit history.
- [ ] Point 3: run real database concurrency tests with two admins: duplicate import, import versus scope change, approval versus import, cancellation versus import, and setup completion versus record edits. Verify no double writes, stale approval, missing audit or partial financial changes.
- [ ] Point 3: test desktop and mobile migration/review screens, including long names, larger batches, stale browser tabs, held rows, downloads and the strict setup order.
- [ ] Point 3: verify per-student/per-fee opening balances, discounts and guardian links against source files, not aggregate totals alone. Resolve legacy batches without complete evidence through a separately verified process; never fabricate evidence or silently remove a problematic flag.
- [ ] Point 4: complete backup, restore drill, recovery/cutover procedure and a rollback decision owner. Restoring a backup must be tested, not merely enabled.
- [ ] Point 4: follow `docs/migration-recovery.md`. Independently validate recovery evidence, meet the agreed data-loss/recovery targets, renew the production checkpoint and prove HOLD blocks imports/setup. A recorded attestation is not a provider-verified backup. Never restore the shared database to undo one school's migration.
- [ ] Point 4: configure `MIGRATION_RECOVERY_DATABASE_REFERENCE` to identify the actual deployment database and independently confirm every checkpoint refers to its backup/restore evidence. Replacing the database requires a new reference and renewed evidence.
- [ ] Re-run cross-school and role authorization tests against the production-like environment. No admin can bypass bursar money-recording permissions.
- [ ] Review dependency advisories and patch exploitable runtime findings. Run regression tests, typecheck, lint and a production build on the deployed commit.

### Provider And Worker Gates

- [ ] Verify actual email acceptance, delivery/bounce callbacks, webhook signatures, retries, deduplication and notification monitoring. Provider acceptance is not proof of delivery.
- [ ] Confirm scheduler/worker authentication, locking, expiry, failure recovery and monitoring with the hosting platform's actual runtime limits.
- [ ] Test payment provider signatures, independent verification, amount/currency/reference matching, retries, receipts and reversals before enabling live online payments. Start in provider test mode; any live-money test requires explicit authorization.
- [ ] Treat SMS/WhatsApp as unavailable until their providers, consent rules and delivery callbacks are configured and tested. Do not label an unconnected channel delivered.

### Immediately After Vercel Deployment, Before Opening To Schools

- [ ] Verify HTTPS, production domain, Clerk redirect URLs, school onboarding and every role's route guard.
- [ ] Run a controlled import/reconciliation/approval walkthrough in a dedicated test school, without editing customer records.
- [ ] Verify scheduler executions, notification monitoring, sanitized error monitoring, backups and alerts.
- [ ] Verify production receipts/reports agree with the underlying bills and confirmed payments.
- [ ] Record evidence, date, deployed commit, remaining issues and go/no-go approval. A successful deployment alone does not authorize go-live.

### After Go-Live

- [ ] Monitor delivery failures, finance integrity, failed jobs, database usage and spending.
- [ ] Schedule recurring restore drills and security review. Keep the unresolved-items list explicit and assign owners.

The thread's deployment reminder should stay quiet until service payment/setup or Vercel deployment begins, then direct us back to this checklist. Revisit the deferred checks in `docs/protected-migration-staging.md` and `docs/migration-reconciliation.md` at that point.
