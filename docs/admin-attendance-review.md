# Attendance Review

Management uses `/list/attendance` to review; teachers are redirected to their
attendance-taking workspace. This page has no recording or correction controls.
Server authorization derives the school from the authenticated admin, not filters.
The older statistics endpoint now also checks the actor's scope: parents can read
only active linked wards, students only themselves, and teachers only classes in
their published teaching scope or assigned class-teacher responsibility. Non-admin
school-wide statistics requests are denied. This legacy endpoint's lesson-record
statistics are not used as daily positions in the management review.

## Daily positions

- One student contributes one position per date, not one per lesson.
- A late lesson gives a late position; otherwise a present lesson gives present.
  These are lesson-based observations, not proof of full-day presence or gate arrival.
- Absence is confirmed only if every distinct expected published lesson is marked
  absent. All excused marks give excused. Missing or conflicting negative evidence
  gives not confirmed. Missing data is never absence.
- No scheduled published lessons gives a separate position, not absence.
- Duplicate marks use the latest correction per student/lesson/date.
- Recurring absence means at least three confirmed absent dates in the selected
  30-calendar-day window, not three lesson marks or consecutive days.

## Lesson completion

Current-day marking compares distinct student IDs with the active class roster.
An upcoming lesson is not a missed duty. Window closed uses the attendance policy,
including its established defaults when no setting record exists.
School Pulse uses the same review results, including unknown student positions;
only closed incomplete lessons drive overdue marking alerts.

## Historical limitations

The selected date uses effective published timetable snapshots, never draft lessons.
Dates and boundaries follow the school timezone. Intraday timetable changes make
full-day negative evidence uncertain. Historical marking totals do not claim
complete coverage because immutable historical class rosters are not stored.

The roster list and follow-up list use currently active students. An authorized
student history request also supports inactive students. Students' recorded class
is inferred from matching published lesson marks where unambiguous, not replaced
silently by today's placement. Unmatched legacy lesson records are identified in
history and cannot create confirmed absence.

Operating weekdays are current settings, not a historical holiday calendar. This
review is not certified school-day attendance or a substitute for versioned
enrollment/closure records. Before live use, perform real admin/teacher walkthroughs,
historical placement checks and representative-volume database tests. Unit tests,
responsive fixtures and a successful build are not production certification.

## Verification

`node --test tests/attendance-review.test.mjs` checks distinct daily positions,
duplicate corrections, missing evidence, timezone boundaries, publication changes,
recurring day counts, school-scoped queries, invalid filters, historical uncertainty,
dashboard consistency and read-only management routing.

`tests/attendance-review-preview.mjs` renders the actual component using fixtures,
Nunito and Playwright at 320/390/768/1440 pixels. It is not an authenticated user test.
