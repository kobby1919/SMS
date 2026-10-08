# Edujay Production Preparation

## Point 5: Production DevOps And Live-Service Verification

This is the return checklist when paying for real services, configuring production credentials, or preparing Vercel deployment. Code checks do not replace live-service verification. Do not open the app to schools until the relevant pre-go-live gates pass.

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
