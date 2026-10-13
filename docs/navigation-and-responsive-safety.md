# Navigation And Responsive Safety

## Recovery Rules

Root and dashboard not-found boundaries show an Edujay recovery page instead of
the framework's generic 404 screen. Missing records and unknown URLs must remain
unavailable; do not turn authorization failures into success or expose another
school's data to make a link work. HTTP 404 remains appropriate for unknown URLs.

Bill pages validate positive PostgreSQL Int IDs before querying. Malformed IDs,
missing bills and bills outside the current school use the same neutral recovery
message. Bill detail and payment entry also validate the student and fee structure
tenant. Parent pages retain their linked-child authorization service.

Bill 26 was checked read-only on 12 October 2026 and belongs to default-school.
An admin in a different school must not be granted access to that bill.

Error boundaries use Next.js 16.2's unstable_retry to refetch the failed segment.
They do not show database errors, stack traces, credentials or record details.

## Prevention

tests/navigation-safety.test.mjs inspects page/API routes and literal/template
hrefs throughout source files, including menu objects, public links and feature
links. It runs through npm run test:onboarding. New unresolved destinations fail
the check. Arbitrary runtime-built URLs and old persisted notification links still
need authenticated integration testing; static checks cannot certify those.

Unfinished public footer destinations were removed. The contact route leads to the
existing school enquiry form. Approved privacy/terms/cookie documents still need
to be published before go-live; placeholder policies are not a substitute.

## Mobile Coverage

Shared record tables have a keyboard-accessible horizontal scroll region. The
dashboard no longer hides horizontal content overflow; scoped content wrapping
and min-width rules prevent long names/references expanding the layout.
Bill detail stacks panels through tablet widths and wraps balances and controls.

The recovery preview renders the real bill page and dashboard shell with synthetic
long references/large amounts at 320, 390, 768, 1024 and 1440 pixels. Reports
previews include sidebar width, not just isolated page markup.

Before pilot, authenticate each real role and walk all reachable pages, tabs,
dialogs, filters, pagination, browser zoom, touch and keyboard interactions.
Test deleted records, wrong-school links, refresh, provider downtime and report
download/withdrawal. Fixture screenshots and code tests cannot certify every
screen, device or live session.
