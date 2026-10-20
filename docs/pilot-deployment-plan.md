# Edujay funded pilot deployment

Company: Miqratech Consult.

Funding confirmed by the user on 2026-10-17: GHS 1,892.
Approved budget source: edujay-go-live-budget-source-verified-bank-margin-final.pptx.

## Approved allocations

These are management allocations from the approved deck, not new provider quotes or proof of purchase. The deck already includes its 10% bank/exchange margin. Do not add it a second time.

| Item | Pilot allocation | Treatment |
| --- | ---: | --- |
| Vercel hosting | GHS 330 | First month allowance |
| Neon database | GHS 550 | First month usage allowance, not a guaranteed fixed invoice |
| Resend | GHS 264 | First month allowance |
| edujay.app domain | GHS 198 | One year allowance, subject to availability and actual checkout |
| Contingency | GHS 550 | Keep reserved and record any authorized use |
| Total funding | GHS 1,892 | GHS 1,144 monthly allocations + GHS 198 annual domain + GHS 550 reserve |

Clerk and Sentry are budgeted at zero for the pilot; verify required features and current limits before enabling them. Payment processing fees are separate when live payments are enabled. Do not enable live money solely because hosting is funded.

Purchase control: confirm vendor, billing period, currency, tax, seats, usage terms, actual card deduction and receipt for each purchase. Retain unspent balances. Do not purchase annual hosting/email plans against a one-month allocation without an explicit decision.

Budget clarification: the deck describes Vercel's USD 20 base price, GHS 12/USD and a 10% margin, but allocates GHS 330. That arithmetic gives GHS 264 for the base subscription. Retain GHS 330 as the approved allowance and reconcile the actual deduction rather than present the whole allowance as a vendor charge. Domain pricing must be checked for the exact available name at checkout.

## Execution order

### 1. Establish company ownership

Company email confirmed by the user on 2026-10-18: miqratechc@gmail.com. Use the display name Miqratech Consult. The authorized company representative should control recovery and billing ownership. Enable MFA and retain recovery codes securely; completion of those security settings has not yet been confirmed. Invite named collaborators through provider teams where supported rather than sharing the owner password.

Use that email to register the company's service accounts. It is an infrastructure/account-ownership address; school users still join Edujay through their role-specific invitations. Buying edujay.app does not itself provision an email inbox. The app sender will use a separately verified domain address such as updates@mail.edujay.app.

### 2. Create Vercel account/team and obtain the domain

Create the company Vercel account/team, confirm Pro checkout and establish billing/spend alerts. Check edujay.app availability and the registration/renewal price, then purchase only within the agreed budget. Vercel will manage the DNS zone when configured as the DNS provider. Email/authentication providers' verification records still need to be added and verified.

Offer checked on 2026-10-18: eligible paid Pro teams can claim one first-year standard domain, including .app, when the exact search result shows Free With Pro. Premium domains and Pro trials are excluded. The user reported completing Vercel setup and purchasing edujay.app on 2026-10-19. Actual charges, plan activation, domain renewal price and any applied promotion still need reconciliation against the receipt. Official terms: https://vercel.com/docs/domains/free-domain-with-pro.

Connect the existing SMS repository through authorized company access. Review repository ownership separately if moving it into a company GitHub organization; do not recreate or transfer the repository automatically. Keep the first deployment restricted to the team.

### 3. Provision Neon and a disposable test environment

Create the company Neon project. Plan app/database regions together, configure suitable compute limits, usage alerts and backup/history retention. Prepare an empty production database and a separate disposable staging/test database with synthetic records. Verify that preview deployments cannot write to production. Review migrations before applying them; do not copy the local test school's records into production automatically.

This unlocks the deferred real-database payment/score load tests and migration concurrency checks. The monthly allowance is not a hard billing cap. Choose available cost controls deliberately and monitor them.

### 4. Configure the company Clerk application

Create the company application with separate development and production instances. Reapply the existing email, invitation, role, MFA, Google login and redirect configuration deliberately. Verify required plan features before charging for an upgrade. Production uses production-instance keys even if the chosen plan has no subscription charge.

Bootstrap the first authorized production admin through the established guarded process. Existing development Clerk identities and local role records must not be assumed to exist in the fresh production instance/database. Test registration, invite acceptance, password reset, MFA, role checks and school isolation together.

### 5. Configure Resend and domain authentication

Create the company Resend account. Add the chosen sending subdomain, obtain the exact provider-issued SPF/DKIM records and publish them in Vercel DNS. Set the intended DMARC policy after checking alignment and the domain's existing mail use. Confirm domain verification, sender, API key and webhook signing secret. Verify sending to the intended recipients, rather than assuming a paid plan alone resolves sender verification.

Keep provider-account ownership email separate from the automated sender address. Verify whether replies need an actual support inbox and configure Reply-To accordingly. Save secrets only in the appropriate local/private or hosting environment configuration.

### 6. Prepare and deploy the restricted pilot environment

Review dependency security findings and any required fixes. Rotate previously exposed test credentials. Configure Vercel production versus preview variables, durable migration staging encryption, cleanup authentication, recovery database reference and the chosen external providers. Configure Sentry with personal-data scrubbing and alerts. Confirm scheduled workers fit the selected hosting runtime and schedule limits.

Deploy the reviewed commit to a restricted environment. Complete production-domain HTTPS and Clerk redirect configuration, then register Resend webhooks against the actual deployed HTTPS endpoint. Start Paystack in test mode. Additional live payment activation requires its own authorization and verification.

### 7. Complete deferred checks before opening to a school

Return to docs/production-readiness.md, Point 5, and the register covering all five migration-safety parts. Complete real database concurrency, mixed admin/payment/score tests, desktop/mobile walkthroughs, staging encryption/redeploy/retention cleanup, backup and isolated restore, production tenant/role isolation, dependency fixes and enabled provider/webhook/worker tests. Retain results and resolve failures.

A real-data pilot requires these controls even if only one school participates. A private synthetic-data demonstration can precede them. Passing code tests does not certify production readiness.

### 8. Run immediate post-deployment smoke tests

Before inviting the pilot school, verify actual domain/HTTPS, login and role redirects, first-admin onboarding, import/approval, email delivery callbacks, scheduled jobs, alerts, receipt/report reconciliation and mobile navigation on the deployed commit. These checks follow deployment and precede opening the app to schools.

### 9. Admit the controlled pilot school

Agree the school's source inventory, cutoff, opening financial controls and recovery checkpoint. Invite the real admin, complete the chosen setup/migration path, reconcile records and obtain the required approval. Admit remaining roles in a controlled order. Monitor errors, finance integrity, deliveries, workers and costs daily. Review evidence before wider rollout.

## Current status

- Funding: received, GHS 1,892.
- Company email: miqratechc@gmail.com, creation confirmed on 2026-10-18; recovery/MFA completion not independently confirmed.
- Vercel account setup: completed by the user, reported on 2026-10-19; exact Pro/Pro Trial billing state and actual charge pending confirmation.
- Domain: edujay.app purchased by the user, reported on 2026-10-19; domain page shows expiration 2027-10-19 and renewal USD 15/year. Initial receipt amount remains pending confirmation.
- Neon: company project edujay and production branch created; Launch activation confirmed from the billing screen on 2026-10-19. Screenshot showed no charges to date at that time, not a guarantee of zero later usage charges.
- Neon production compute: edujay-production, saved autoscaling 0.25-0.5 CU confirmed in the compute summary; 5-minute scale-to-zero was enabled in the edit screen. This is the setup/test starting size, subject to load-test results before live pilot admission.
- Neon recovery: user confirmed changing the history window from 6 hours to 7 days on 2026-10-19. Actual restore drill remains pending.
- Neon region: staging connection hostname shown by the user confirms AWS eu-central-1 (Frankfurt); branches in the project share this region. Configure Vercel functions for fra1 when deploying.
- Neon staging: schema-only staging branch and edujay-staging compute at 0.25-0.5 CU confirmed by the branch/compute screenshots on 2026-10-19. Five-minute scale-to-zero was instructed; staging expiry still needs confirmation.
- Neon staging credentials: user confirmed resetting the staging role password on 2026-10-19. No credential values were requested, read or stored in this document. Retrieve fresh branch-specific connection strings privately when wiring environments; production and staging runtime roles/permissions still need verification.
- Neon outstanding: confirm USD 30 spending notification was saved, protect production and verify its default status, confirm staging has no automatic expiry, configure private environment connections and least-privilege app roles, apply reviewed migrations and complete concurrency/recovery tests. History storage and staging compute contribute to the same usage budget.
- Neon production protection: confirmed by the SQL Editor screenshot on 2026-10-19. Read-only query confirmed neondb_owner, zero public base tables and no edujay_app role at that time. Application role creation/password reset was subsequently instructed; permissions and login remain unverified.
- Clerk: company app and development/production instances created; user confirmed production edujay.app DNS/email records and SSL verified. Production Google credentials saved; Google OAuth remains External/Testing pending real public branding/privacy pages, publication and end-to-end access tests. App keys, invitation/role guards, redirects and any required webhooks remain pending integration/testing.
- Company Google account: accidental child supervision was stopped; Google's confirmation email was shown. Company Google Cloud Edujay project and OAuth client were subsequently created. Account MFA/recovery still needs explicit verification.
- Resend: mail.edujay.app verified in Ireland; restricted production sending API key saved privately by the user. User confirmed Transactional Pro payment and 50,000 emails/month at USD 20. Actual bank deduction/receipt amount has not been provided. Receiving remains off. User confirmed adding TXT _dmarc.mail = v=DMARC1; p=none in Vercel; actual authentication/header tests, reporting/enforcement review, worker integration and webhook verification remain pending.
- Sentry: company organization miqratech-consult and Next.js project sms created, screen showed a 14-day trial. SDK integration, privacy filtering, alerts, test event and ongoing free-plan/seat limits remain unverified.
- Vercel repository import: configuration screen for kobby1919/SMS main under Miqratech Consult reached; no deployment confirmed. Build command instructed: npx prisma generate && npm run build; install npm ci. Production and Preview secrets must remain separate.
- Fresh database blocker: isolated replay confirmed the legacy chain cannot initialize an empty database. A separate guarded fresh-install history was prepared without changing legacy migrations or working records; see docs/fresh-database-install.md and the staging rehearsal result below. Production initialization still requires separate authorization and its remaining gates.
- Neon staging rehearsal, 2026-10-20: the guarded fresh baseline was applied to the pinned staging endpoint only. Prisma migration history records it as finished, not rolled back, with the expected checksum. The first post-apply diff identified three deliberately preserved legacy indexes missing from the Prisma model; they were declared in the model without altering the applied baseline SQL. A verification-only rerun then passed the canonical schema diff, all 18 CHECK constraints and both financial partial unique indexes. Read-only counts confirmed 91 app tables, zero schools, zero students, zero payments and zero admins. Local sanitized evidence is in .private/database-evidence/staging-fresh-install.json. Restricted runtime-role grants/login, authenticated workflows, concurrency, restoration and other pre-pilot gates remain unverified; production and the working school database were not modified.
- Spending ledger: retain the GHS 1,892 starting balance and record actual receipts before calculating remaining funds. Approved allowances are not deductions.
- Neon staging runtime login, 2026-10-20: SQL-created edujay_app verified through direct and pooled TLS connections. Reviewed DML access covers 91 application tables; administrative/schema changes, TRUNCATE, migration-history access and switching to the owner role were denied. All synthetic probes rolled back, zero probe rows remain. Private runtime credentials and sanitized evidence stay under .private; no Vercel or production configuration changed. See docs/staging-runtime-role.md. This does not replace tenant/role, concurrency, recovery or other Point 5 gates.
- Deployment and live checks: pending.
- Staging subject workflow races, 2026-10-20: duplicate full import, cancellation-first, import-first and import-versus-stale-approval checks passed using actual encrypted CSV/service workflows and restricted runtime credentials. Exactly-once import/audit and idempotent replay were verified; stale approval was rejected and fresh review succeeded. All synthetic schools/subjects/uploads/audits were removed. Live execution found and corrected Prisma advisory-lock void-result handling; HTTP import conflicts now recognize raw serialization codes. An interrupted test-control lock was explicitly released and its journaled fixtures cleaned before the corrected suite passed. See docs/staging-workflow-concurrency.md for evidence scope, recovery procedure and remaining Point 5 gates.
- Staging concurrency, 2026-10-20: four real-connection checks passed for simultaneous inventory saves, per-school transaction independence, stale serializable snapshot rejection after scope edits, and shared-lock fencing of scope edits. Actual inventory service/Prisma calls used restricted staging credentials. Synthetic schools/audits were removed by exact IDs and verified absent. See docs/staging-concurrency.md for limited scope and pending full import/approval/cancellation/completion/HOLD races; no production or HTTP authorization certification is claimed.
- Existing local school records: retained.

Live-service setup has now reached its first confirmed purchase milestone. Return to docs/production-readiness.md, Point 5: complete the applicable pre-pilot concurrency, recovery, retention, tenant/role, dependency and provider checks, then perform the immediate post-deployment smoke tests before admitting schools. A code-test pass or domain purchase does not certify production readiness.

## Official references checked on 2026-10-17

- Vercel plans: https://vercel.com/pricing
- Vercel domains: https://vercel.com/docs/domains
- Neon billing and recovery allowances: https://neon.com/pricing
- Clerk production instance configuration: https://clerk.com/docs/guides/development/deployment/production
- Resend transactional email plans: https://resend.com/pricing

Current published Vercel Pro base price is USD 20/month. Current published Resend Pro includes 50,000 emails/month at USD 20/month, with overage terms. These references do not establish the actual card exchange rate, taxes, final domain availability or every required account feature; confirm those at setup/checkout.
