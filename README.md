This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Email Provider And Notification Webhooks

Edujay sends production notification email through one provider adapter first: Resend.
Local development safely logs email to the server console when no provider key is set.

Before using a real sending address in production, verify the sending domain inside
Resend and add the DNS records it gives you:

- SPF
- DKIM
- DMARC

Then configure:

```bash
EMAIL_PROVIDER="resend"
RESEND_API_KEY="..."
EMAIL_FROM="Edujay <updates@yourdomain.com>"
RESEND_WEBHOOK_SECRET="whsec_..."
NEXT_PUBLIC_APP_URL="https://your-edujay-domain.com"
```

Use this webhook URL in Resend after deployment:

```text
https://your-edujay-domain.com/api/webhooks/notifications/resend
```

The webhook updates Edujay delivery records for provider events such as sent,
delivered, bounced, and complained. SMS and WhatsApp providers are intentionally
left unconfigured until the school chooses paid delivery channels.

## Production Redis

Edujay can use Redis for shared rate limiting across all deployed app instances.
This protects sign-in, webhooks, finance exports, attendance submission, and
form-data APIs without putting that fast-changing traffic on the main database.

The app supports Upstash Redis over REST and safely falls back to PostgreSQL in
local development when these values are not set:

```bash
UPSTASH_REDIS_REST_URL="https://your-redis.upstash.io"
UPSTASH_REDIS_REST_TOKEN="..."
```

For finance and notification background job processing, configure strong secrets:

```bash
FINANCE_WORKER_SECRET="generate-a-long-random-secret"
NOTIFICATION_WORKER_SECRET="generate-a-long-random-secret"
PARENT_SUMMARY_WORKER_SECRET="generate-a-long-random-secret"
PARENT_CONTACT_WORKER_SECRET="generate-a-long-random-secret"
TEACHER_ACCOUNTABILITY_WORKER_SECRET="generate-a-long-random-secret"
```

## Production Readiness Checklist

Before Edujay goes live, complete these items in order:

1. Provision production infrastructure:
   - Production PostgreSQL database.
   - Production Clerk instance.
   - Production hosting target.
   - Production Redis or equivalent shared rate limiter.
   - Production domain.

2. Configure required environment variables:
   - `DATABASE_URL`
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
   - `CLERK_SECRET_KEY`
   - `NEXT_PUBLIC_APP_URL`
   - `APP_URL`
   - `EMAIL_PROVIDER`
   - `RESEND_API_KEY`
   - `EMAIL_FROM`
   - `RESEND_WEBHOOK_SECRET`
   - Worker secrets listed above.
   - Payment webhook secrets when online payments are enabled.

3. Run database deployment safely:
   - Apply Prisma migrations against production.
   - Do not run seed scripts against production unless the script is explicitly production-safe.
   - Keep demo cleanup scripts away from production data.

4. Verify role onboarding:
   - Create the first school admin through the invite/onboarding flow.
   - Invite teacher, parent, and bursar accounts using real email addresses.
   - Confirm each role lands on the correct dashboard.
   - Confirm suspended or left-school users cannot operate.

5. Verify source-of-truth rules:
   - Runtime teacher, parent, attendance, homework, CA, syllabus, and report pages use published timetable data only.
   - Draft timetable data must not create live obligations or parent updates.
   - Finance records must never be casually deleted; use correction/reversal workflows.

6. Verify notification delivery:
   - In-app bell works and unread counts remain stable after refresh/navigation.
   - Email delivery worker processes queued deliveries.
   - Resend webhook updates sent/delivered/failed status.
   - Notification monitor shows created notifications, delivery jobs, and failed/retrying states.

7. Verify finance trust controls:
   - Receipt numbers are unique.
   - Duplicate payment references are blocked or flagged.
   - Corrections require admin/owner approval.
   - Reversed/voided receipts are visible as history, not proof of payment.
   - Daily and weekly finance reports match database totals.

8. Configure backups and recovery:
   - Automated database backups.
   - Manual pre-release backup before major migrations.
   - Restore test on a non-production database.
   - Document who can access backups.

9. Configure monitoring:
   - App uptime monitoring.
   - Error tracking.
   - Failed worker job monitoring.
   - Failed notification delivery monitoring.
   - Payment webhook failure monitoring.

10. Run final smoke tests:
    - Admin onboarding.
    - Teacher invite and login.
    - Parent invite and ward access.
    - Bursar invite and finance dashboard.
    - Published timetable flow.
    - Attendance save and correction request.
    - Homework creation/check/correction.
    - CA entry rules.
    - Report card readiness and submission.
    - Fee payment, receipt, correction, and reports.
    - Parent daily/weekly summary notifications.

## Demo And Production Data Rule

Local and demo data can use `default-school`, fake students, and test scripts. Production must use real school onboarding, real Clerk users, and production-safe migrations only. Do not use demo cleanup scripts on production.
