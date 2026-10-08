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

## End-to-end hardening

- All three synchronizers use one serializable obligation store, with bounded
  conflict retries. Creation, status transitions, reminder suppression and audit
  writes commit together. Completed/cancelled work and closed reviews cannot reopen.
- Attendance generation requires an active teacher, a configured school day and a
  timetable publication preceding the lesson. CA requires a matching current-period
  bucket and published subject/class scope; homework requires the matching published
  lesson. Duplicate student records cannot substitute for another pupil's work.
- Teacher views refresh their own CA and homework duties as well as attendance.
  Finished/reviewed sources do not consume the synchronizers' pending batch limit.
- Before reminders or escalations, the worker re-reads the duty and source records
  inside a serializable transaction. Concurrent workers cannot double-escalate.
  Obsolete unreviewed duties are cancelled with an audit; source-confirmed completion
  settles stale pending duties. Open historical escalations remain review work.
- Escalation responses require a real open same-school escalation. A review that
  closes during submission cannot acquire a new pending response.
- Attendance, homework and academic corrections claim a pending request once and
  compare the source's update timestamp before applying changes. An invalid review
  action or changed source cannot silently overwrite the current record.
- Open marking windows and closed exceptions are excluded from reliability scoring.
  Completed-late history retains the existing 70% weighting; it is not a new overdue duty.
- The worker's production endpoint requires its dedicated
  `TEACHER_ACCOUNTABILITY_WORKER_SECRET`; the parent-worker fallback is development-only.
  Configure its scheduler and verify retries with real database contention before pilot.

Teacher reminders still use the existing in-app teacher reminder/history panel.
This audit does not claim email delivery or migrate teacher alerts to the central
notification system. That migration and authenticated delivery tests remain separate.

## Admin Navigation Responsibilities

| Group | Purpose |
| --- | --- |
| Management | School-scoped profile, access, lifecycle, class and subject setup. |
| Academic | Timetable publication, published lesson inspection, syllabus, homework review, attendance review, assessment summaries and report review/publication. |
| Communication | Events/notices, communication policy, parent contact oversight, parent delivery/school-hour settings and the central delivery monitor. |
| Finance | Bill/payment/receipt review, correction approval, daily collection results, fee setup and payment-provider settings. |
| Settings and follow-up | Assessment/accountability policies and the complete teacher follow-up queue. |

Legacy Results and Exams links are removed from the admin menu. Admins cannot use
direct attendance-entry URLs/APIs, ordinary homework marking actions, exam/result
writes or ordinary CA score actions. Approved correction workflows and report/window
controls remain available. Finance recording/collection remains bursar/collector work.

The contact review page has whole-school scoped counters and paginated history,
with the latest eight messages in each thread instead of the oldest eight. Menu
active states use path boundaries, and icon-only links have accessible names.

## Required Live Checks

1. Sign in as admin: every menu link opens its intended review/setup workspace;
   direct teacher entry and bursar payment-recording URLs/actions are denied.
2. Sign in as teacher: complete attendance, homework and CA; confirm admin and
   teacher counts agree, including the final marking-window boundary.
3. Run two workers together, then review/complete while a worker is running.
   Confirm one reminder/escalation/decision and its matching audit history.
4. Approve/reject corrections concurrently and change the source during review.
   Confirm the losing/stale action does not change marks or send a success update.
5. Replace the timetable, close an escalation, withdraw a pupil and add a later
   enrolment. Confirm history remains but no obsolete duty becomes a new accusation.
6. Test another school's IDs and another teacher's lesson/response IDs: deny access.
7. Test actual admin/teacher layouts and contact pagination on phone, tablet and desktop.

Automated coverage uses mocked transactions and interleaving simulations. It cannot
certify PostgreSQL contention, Clerk sessions, scheduled-job operation or live email delivery.
