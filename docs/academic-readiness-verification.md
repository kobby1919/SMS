# Academic Readiness Verification

## Code-Level Acceptance Matrix

These checks use controlled fixtures; they are not live database certification.

Verification run on 2026-10-14:

- 414 regression tests passed.
- Standalone TypeScript and scoped ESLint passed.
- Next.js production build passed, including TypeScript and route generation.
- 44 headless Edge fixture layouts passed at 320, 390, 768 and 1440 pixels:
  24 readiness states, 4 focused assessment layouts and 16 report-review states.
- Long-name desktop readiness and focused phone assessment screenshots inspected.
- No live authenticated or real concurrent database test was performed in this run.

| Case | Regression coverage |
| --- | --- |
| Missing published timetable/configuration | admin-academic-readiness, academic-readiness-rules |
| No CA activities | ca-recording-tracking |
| Partial scores within deadline and genuine overdue | ca-recording-tracking, academic-readiness-navigation |
| Scored activities but incomplete CA allocation | ca-recording-tracking, final-report-readiness |
| Exam not opened/open/closed and zero-weight exam | exam-window-tracking, exam-entry-window |
| Explicit zero versus untouched exam default | academic-readiness-rules, admin-report-review |
| Late admissions, transfers, inactive students | academic-readiness-rules, ca-recording-tracking, admin-report-review |
| Pending corrections and stale totals | admin-report-review, final-report-readiness, admin-academic-readiness |
| School isolation and role rejection | admin-academic-readiness, admin-assessment-review, admin-report-review |
| Dashboard/detail agreement | ca-recording-tracking integration test, canonical exam/report evidence tests |
| Stale/competing review, score locks and failed audits | admin-report-review, academic-readiness-rules, exam-entry-window |
| Exact links and invalid/stale selections | academic-readiness-navigation, admin-assessment-review |
| Empty states, long names, phone/tablet layouts | academic-readiness-preview, admin-assessment-preview, admin-reports-preview |

## Required Authenticated Pilot Checks

Use two isolated test schools and admin/teacher accounts, not production pupils.
Record school, period, class, activity, eligibility and expected counts for each case.

1. Repeat the matrix using real authenticated routes. Compare all dashboard counts
   with the corresponding source review in the same period and unchanged data.
2. Test direct foreign-school class, activity, teacher and report URLs, including
   repeated/oversized parameters. No foreign names, scores or actions may appear.
3. Open two independent sessions. Save scores while refreshing readiness/review.
   A page may show its earlier snapshot, but must not mix old and new evidence.
4. Race score saving against report submission/approval and window closing. Either
   transaction must serialize/retry/reject safely; no partial marks, stale published
   total, unauthorized edit or duplicate audit may survive.
5. Race two administrators reviewing the same report. Only one matching-version
   transition may succeed. Test failed audit rollback using an isolated test database.
6. Confirm late admissions/transfers do not inherit earlier activity duties. Check
   inactive pupils are excluded from current counts but historical evidence remains.
7. Navigate dashboard actions on phones/tablets with the real sidebar, login and
   long school/class/student names. Check empty and unavailable states, filter
   changes, pagination, refresh and stale links. Admin assessment must stay read-only.

Mocks verify transaction contracts and conflict guards, not PostgreSQL isolation
under real concurrent connections. Passing tests, lint, typecheck or build is not
production certification. Finish these authenticated/concurrency checks before pilot.
