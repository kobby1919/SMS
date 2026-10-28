# Edujay End-to-End Product Testing

Prepared 2026-10-28 for the EIS internal synthetic-data pilot on edujay.app.
This is an execution order, not a statement that every feature has passed.

## Safety And Evidence

- Keep platform admin, school admin, teacher, parent and bursar sessions isolated. Chrome and Edge can hold different roles; use separate profiles/private sessions for further accounts.
- Use synthetic pupils and inboxes controlled by the tester. No real charges or live payment activation.
- Run permission-tampering, concurrency, destructive lifecycle, intentional delivery failures and load tests in staging using disposable records.
- Preserve the EIS opening baseline: 2 classes, 3 subjects, 6 students, 6 parents/links, 2 teachers, 1 bursar, 4 fee items, 12 opening bill lines and 2 discounts. Financial baseline before new test activity: gross GHS 7,200; discount GHS 230; historical paid credits GHS 3,500; balance GHS 3,470.
- Log test ID, build, role, device/browser, exact steps, expected/actual result, screenshot and retest outcome. Use Not run, In progress, Pass, Fail, Blocked or Not applicable with a reason. Never record passwords, invite tokens or database URLs.
- Stop on identity leakage, unauthorized money recording, missing audit history, duplicate imports/payments or incorrect balances. Do not reduce expected counts or bypass gates to make a test pass.

## Execution Order

### 01. Mobile Shell And Account Access

First retest the navbar as school admin and teacher at 320, 390, 768, 1024 and 1440px. Check long school/user names, search open/filter/navigation, Escape, keyboard focus, notification read state and the real Clerk account popup. Test portrait/landscape and 200% zoom. Check sign-in/out, recovery and invite wrong-email/expired/revoked/reused states. Complete required teacher contact fields through the authorized profile editor; missing phone must not be bypassed.

### 02. School Records And People

Verify dashboard totals and school context. Review grades/classes/capacity, subjects, all imported students and guardian links. Configure the teacher's class and subject responsibilities. Test supported profile editing, duplicate protection and lifecycle changes on disposable records. Exercise secondary-admin and bursar invitations and permissions.

### 03. Timetable And Curriculum

Confirm active academic period, timezone, operating days and hours through the build's available controls. Create and validate a small timetable, check clashes and publish it. Compare teacher lessons and repeat with a stale tab. Create curriculum/topics, record authorized progress and compare oversight views. Missing required controls are findings; do not invent routes.

### 04. Attendance And Homework

Record attendance for an actual eligible published test lesson; verify admin review, guardian views, retries, explicit attendance states and roster/date boundaries. Test homework creation/editing, due dates, authorized audience and any submission controls that are actually implemented.

### 05. Assessment And Report Cards

Review CA settings and scope. Enter known marks including explicit zero versus blank; verify valid ranges, corrections, exam windows, calculations and incomplete-subject behavior. Review and release a report through the correct roles, then check guardian access and PDF/print output. An unreleased report must remain private.

### 06. Teacher Accountability

Test duty generation and exact action links, on-time versus overdue work, closed school days, reminders/escalation, teacher explanation, admin follow-up/closure and persistent history. Use staging for clock-boundary and worker cases. Completed work must not remain falsely escalated.

### 07. Bills, Payments And Receipts

Reconcile imported fees, opening credits, discounts and balances. On disposable staging students, test published fee structures, repeated bill generation, bursar-only payment recording, receipts, corrections and required approvals. Compare filtered registers, reports, exports and audit evidence. Test enabled providers in test mode only; verify signatures, cancellation/failure, amount/currency scope and idempotent callbacks. Do not regenerate EIS opening bills.

### 08. Daily Collections

As bursar, configure a disposable collection and controlled collector. Test collector scope, entries, repeated saves, handover, discrepancies, settlement and admin reporting. Prevent double collection or duplicate settlement; preserve evidence rather than delete history.

### 09. Communication And Notifications

Test events and audience-targeted announcements, communication policy, guardian contact requests, teacher contacts, parent preferences and daily summaries. Inspect delivery monitoring and retry behavior. Prepared invitations, provider acceptance and confirmed delivery are separate outcomes. No arbitrary production recipient or intentional production bounce tests.

### 10. Parent And Student Journeys

Accept a controlled guardian invite, confirm the existing imported guardian and ward links survive, and inspect daily updates, attendance/homework/results and fees/receipts/queries. Test revocation and direct-URL isolation in staging. Exercise student login and self-scoped views only if enabled for this pilot; otherwise explicitly record Not applicable.

### 11. Platform, Security And Migration

Test request approval/rejection and admin invite lifecycle, platform-only recovery controls, server-side tenant and role permissions and protected exports. Retest migration reconciliation after teacher/parent/bursar account acceptance. Exercise cancellation, expiry, HOLD, stale scope and approval invalidation. Run real-database concurrency races in staging. Test Start Fresh on a separate disposable school, not by resetting EIS.

### 12. Operations And Final Release Gate

Return to production-readiness.md, Point 5: verify independent backup/restore and key custody evidence, measured recovery targets where claimed, encrypted staging retention/cleanup, least privilege, environment separation, dependency fixes, provider/webhook verification, worker authentication/retry/scheduling and monitoring. Test slow reads, errors, stale tabs, larger lists, pagination and exports in staging.

Immediately after deployment, hard-refresh and smoke-test the real domain, sign-in, protected routes and one authorized journey per enabled role. Before a real-data school pilot, resolve critical security/data-integrity/authentication/payment defects and document go/no-go. Code tests, an internal synthetic pilot and a successful deployment are not production certification.

## Current First Actions

1. Verify the mobile navbar fix locally, deploy only when authorized, then retest in the real admin and teacher sessions.
2. Check that the accepted teacher has valid required contact details and reaches the correct dashboard.
3. Verify class/subject responsibility and the active academic period before testing timetable, attendance or grading.
4. Execute the ordered checklist and retain evidence. Retest a complete affected journey after each fix, not just the individual button.

The interactive companion is edujay-product-qa.canvas.tsx in this workspace's managed canvases directory. It contains per-case steps, expected results, constraints, persistent result selections and evidence notes. The public feature basis is the current role navigation and implemented dashboard routes, not a marketing claim that every possible school feature exists.
