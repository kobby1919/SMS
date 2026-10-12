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
Students added after a lesson starts are not retrospectively missing from it;
actual marks for such a student still count. A student added mid-day cannot be
labelled fully absent based only on later lessons. Detected roster changes or an
intraday timetable change show REVIEW rather than asserting completion.
The same enrollment eligibility helper is used by the review, duty synchronization,
admin teacher-accountability checks and the background worker, so later enrollment
cannot alone create a false attendance escalation for an earlier lesson.
An upcoming lesson is not a missed duty. Window closed uses the attendance policy,
including its established defaults when no setting record exists.
School Pulse uses the same review results, including unknown student positions;
only closed incomplete lessons drive overdue marking alerts.
Lesson totals are queried independently of the selected student's history. Past
lesson counts include same-school recorded students, including inactive students;
they still do not claim the original full roster was covered.

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
Without recorded historical placement, an operating day's position is UNKNOWN,
its expected lesson count is unavailable and the class is labelled Class not
recorded. Current-day class moves cannot turn old-class negative marks into a
confirmed absence or a complete lesson in the new roster.

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

## Presentation Guide

The page answers two separate questions: what is known about students' attendance,
and whether teachers have completed the required lesson marking.

Date and Class determine the review scope. Student position filters the student
list only; it does not shrink summary totals, lesson totals or recurring follow-up.
Summary categories are mutually exclusive and add up to the displayed cohort size.
The historical cohort is currently active students, not a certified old roster.

Present means at least one published lesson was marked present. Late means at
least one was marked late and takes precedence over present; this does not prove
late arrival at the school gate. Absent requires absent marks for every eligible
expected lesson and reliable negative evidence. Excused requires all those marks
to be excused. Missing marks, mixed absent/excused marks or uncertain placement
give Not confirmed. No scheduled lessons means no eligible published lessons,
not an absence finding.

For a student, 2/4 lesson marks means two of four eligible lesson positions have a
record. For a lesson, 18/20 students marked means 18 eligible roster students have
a record, regardless of whether those records say present or absent. It is not
18 present students. Duplicate records never fill another student's missing mark.

Complete means all eligible roster students have marks. Upcoming means marking
has not opened. Unmarked means no eligible marks during the open window. Partially
marked means some eligible marks exist. Marking window closed means the final
window ended while marks remain incomplete, not proof of student absence.
Review timetable / roster change means completion cannot be certified from the
current roster and snapshot. Historical marks counts recorded pupils but does not
invent a historical denominator. No eligible active students is not a failure.

Recurring absence flags currently active students with at least three confirmed
absent dates in the 30-calendar-day window ending on the selected date. Several
absent lessons on one day contribute one day. It is not a consecutive-day count.
Student history opens the selected pupil's daily positions for that same window.
Class not recorded and expected lessons unknown are explicit missing evidence,
not bad behavior by a student or teacher. Admins review; teachers record attendance.
