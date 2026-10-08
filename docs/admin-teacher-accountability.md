# Admin teacher follow-up snapshot

The admin landing page retains School Pulse and Finance Snapshot, followed by
Teacher Accountability. Legacy chart, count, calendar and setup cards are removed.

The snapshot is a server-only, read-only repeatable-read transaction. Totals cover
the evaluated backlog; only the five highest-priority teacher groups appear on the
landing page. The detail route is admin-only and paginated, with exact-record links
to existing escalation and correction review actions. It contains no teacher-entry
or payment-recording controls.

## Counting rules

- Teaching scope comes from the latest active published timetable, not draft lessons.
- Attendance becomes overdue after the final marking window, not when a lesson starts.
- Attendance is not expected on days outside the school's configured active days.
- Homework and CA use the same school-day deadline helpers as obligation generation.
- Only active students in the relevant class are counted; later enrolments do not
  create missing work against an earlier activity or attendance day.
- Distinct student records determine completion, not raw row counts.
- Actual completed work, saved completion, cancelled duties and resolved/dismissed
  escalation exceptions are excluded from overdue totals.
- An open escalation remains management review work even after the duty is complete.
- Escalation review survives timetable changes, empty rosters, inactive teachers and
  missing setup. History is not a new teaching duty; cancelled duties remain excluded.
- Escalation decisions claim the current status atomically; competing reviewers cannot
  overwrite a closed decision or create misleading duplicate audit entries.
- Corrections are separate review work, not evidence of teacher misconduct.
- Missing policy, timetable or active academic period is shown as incomplete evaluation,
  not an assurance that all teaching work is healthy.

Historical attendance is evaluated only where a persisted obligation supplies a
valid date and matches the current published lesson scope. Today's published lessons
can be evaluated without waiting for the obligation worker, provided publication
preceded the lesson. Class placement is current-state because historical enrolment
snapshots do not exist; transferred pupils are not attributed to their former class.

Before rollout, exercise real overdue/completed duties, exact correction review and
mobile layouts with an authenticated school admin. Code tests are not production
certification.
