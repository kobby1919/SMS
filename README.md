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

## Onboarding Email Delivery

School onboarding invites are sent through a provider-ready email service. In local
development, invites are logged to the server console when no provider key is set.
For production email delivery, configure:

```bash
RESEND_API_KEY=...
EMAIL_FROM="Edujay <onboarding@yourdomain.com>"
NEXT_PUBLIC_APP_URL="https://your-edujay-domain.com"
```

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

For finance background job processing, also configure a strong secret:

```bash
FINANCE_WORKER_SECRET="generate-a-long-random-secret"
```

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
