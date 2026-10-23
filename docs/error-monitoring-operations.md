# Error Monitoring Operations

## Scope And Privacy

The official Sentry Next.js SDK initializes in browser, Node and Edge runtimes.
Request errors, page/global error boundaries and caught finance-cron failures
are connected. Other intentionally caught operational errors require an explicit
capture call; this is not coverage of every business workflow or queue-age alert.

Monitoring remains disabled without both a DSN and a recognized environment.
No personal identifiers are attached by application code. SDK data collection
disables user info, cookies, headers, bodies, query parameters, database values,
queue arguments, frame variables and source context. Session tracking, console
integrations, logs, metrics, breadcrumbs, replay and performance tracing are
disabled or filtered. The outgoing error event is rebuilt from an allowlist.
Raw exception messages, request URLs, user details, arbitrary tags/context,
absolute paths, local variables and code snippets are withheld. Diagnostics
retain safe error types, bounded stack locations, selected component tags and
environment; withholding messages limits debugging detail intentionally.

Source-map upload and build-plugin telemetry are disabled. No Sentry auth token
is needed for this phase. Do not enable replay, request-body logging, extra PII
or source upload without reviewing student-data privacy and access controls.
Also configure Sentry's server-side data scrubbing and prevent IP storage; the
ingestion service necessarily sees network addresses even when events omit them.

## Deployment Configuration

Use the existing company organization `miqratech-consult` and Next.js project
`sms`. Find the DSN in Settings > Projects > sms > Client Keys (DSN). A DSN is a
public ingestion identifier, not an administrative auth token; do not confuse it
with `SENTRY_AUTH_TOKEN`. No new project or paid upgrade is assumed.

Set these Config variables in each project's Production environment:

- `NEXT_PUBLIC_SENTRY_DSN`: the intended project DSN.
- `NEXT_PUBLIC_SENTRY_ENVIRONMENT`: `staging` in edujay-staging and `production`
  in edujay-production. Vercel's Production environment label is not a substitute
  for this app-environment distinction.

Preview builds must not inherit the production DSN/environment. Leave monitoring
disabled there unless deliberately configuring `preview` against an appropriate
test destination. Redeploy after public variable changes because browser values
are baked into the build. Keep the existing deployment-access protections.

## End-To-End Acceptance Still Required

The platform-admin-only page `/platform/monitoring` reports configuration state
without displaying the DSN. Its server action independently checks the platform
role and sends only `Edujay monitoring verification`, then flushes the SDK. It
does not crash a page or write school records. Ordinary school roles must not
be permitted to open the page or trigger the action.

1. Sign in with the controlled platform operator on the intended deployment.
2. Open `/platform/monitoring`, confirm the correct environment, and click Send
   test alert once. A submitted response is not proof of Sentry ingestion.
3. Find the exact test event in Sentry. Confirm the environment, component and
   privacy tag, and inspect that request/user payloads and secrets are absent.
4. Configure an issue alert for a new error issue in the intended environment
   delivered to the responsible operator. Check notification preferences and
   quotas/plan. Confirm actual email/integration alert receipt; an SDK flush or
   visible issue alone does not prove alert delivery. If testing after the issue
   already exists, use an appropriate every-event rule or a reviewed new issue.
5. Verify controlled browser and server error capture as part of synthetic
   deployment smoke checks; the platform test validates server submission only.
6. Record date, deployed commit, event identifier, alert recipient/owner and
   outcome without secrets. Assign a response owner and review usage limits.

No live alert delivery has been proven merely by committing this integration.
Follow `production-readiness.md`, Point 5 before school admission. The next
production workflow must use a clearly labelled synthetic tenant, controlled
test identities and no real school records or live charges. Do not enable the
production payment provider or finance scheduler to conduct this monitoring test.

References:

- https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/
- https://docs.sentry.io/platforms/javascript/guides/nextjs/data-management/sensitive-data/
- https://docs.sentry.io/product/alerts/
