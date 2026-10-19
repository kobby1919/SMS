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
- Domain: edujay.app purchased by the user, reported on 2026-10-19; receipt amount and renewal details pending confirmation.
- Other provider accounts: pending; Neon is the next setup step.
- Spending ledger: retain the GHS 1,892 starting balance and record actual receipts before calculating remaining funds. Approved allowances are not deductions.
- Deployment and live checks: pending.
- Existing local school records: retained.

Live-service setup has now reached its first confirmed purchase milestone. Return to docs/production-readiness.md, Point 5: complete the applicable pre-pilot concurrency, recovery, retention, tenant/role, dependency and provider checks, then perform the immediate post-deployment smoke tests before admitting schools. A code-test pass or domain purchase does not certify production readiness.

## Official references checked on 2026-10-17

- Vercel plans: https://vercel.com/pricing
- Vercel domains: https://vercel.com/docs/domains
- Neon billing and recovery allowances: https://neon.com/pricing
- Clerk production instance configuration: https://clerk.com/docs/guides/development/deployment/production
- Resend transactional email plans: https://resend.com/pricing

Current published Vercel Pro base price is USD 20/month. Current published Resend Pro includes 50,000 emails/month at USD 20/month, with overage terms. These references do not establish the actual card exchange rate, taxes, final domain availability or every required account feature; confirm those at setup/checkout.
