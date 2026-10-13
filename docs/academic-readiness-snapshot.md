# Academic readiness snapshot

`getAdminAcademicReadinessSnapshot` is a server-only, authenticated admin reader.
It derives school scope from the resolved session, not a request parameter. All
academic evidence is read in one RepeatableRead transaction with one evaluation
time. It performs no writes, default-setting creation, approval, or publication.

## Sources

- Shared academic rules establish the active period, published teaching scope,
  CA deadline policy, and exam window states.
- Canonical class report readiness supplies entry counts, placement review,
  missing evidence, invalid marks, stale totals, and correction blockers.
- Shared teacher accountability supplies CA follow-up, academic escalations,
  and pending score corrections. Attendance/homework are not re-read for this
  section. Open review queues retain school history; current CA duties use the
  active academic period and published assignments.
- Report publication records supply submitted/published status independently
  of present-day evidence completeness. A published status never certifies that
  today's evidence is still complete.

## Output and limits

School totals include every evaluated class, not just the five displayed
classes. Returned class blockers are aggregated by reason/subject; individual
student identities and complete student score lists are not returned. Each
class has at most five blocking subjects. There is no overall readiness
percentage or automatic assertion that a school is ready for release.

Classes with active students but no published teaching scope are explicitly
counted as needing setup, not silently certified. Missing period/publication,
empty teaching scope, and empty eligible rosters return null totals. Missing or
invalid deadline settings make CA accountability unavailable without replacing
it with zero overdue work. Database errors propagate; they are not converted
into a successful empty-school result.

Before loading evidence, same-snapshot counts cap synchronous work: 60 classes,
3,000 active students, 500 active teachers, 500 subjects, 10,000 active published
lessons, 5,000 buckets, 10,000 activities, 100,000 scores, 100,000 assessment
records, 20,000 CA obligations, 20,000 escalations, and 10,000 pending corrections.
Historical evidence is conservatively included in these record budgets.
Expected student/subject entries are capped at 30,000, with a separate density
guard against expensive in-memory canonical evaluation. Exceeding a limit returns
`UNAVAILABLE/EVALUATION_LIMIT`, never truncated totals. Larger schools/history
need a separately designed batch/materialized snapshot before raising limits.

## Before pilot

Run real authenticated multi-school tests, simultaneous assessment/import and
snapshot reads, and representative maximum-size latency tests against the actual
production database. Passing mocked tests, typecheck, or build is not production
certification. The service is the Step 2 foundation; CA/exam lane presentation and
dashboard integration follow in the subsequent steps.
