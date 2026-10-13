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

Empty classes are reported separately and do not consume the five follow-up
slots or inflate incomplete counts. Classes without published subject scope do
contribute to the school's incomplete count, with their students shown separately.
An active student with an invalid/foreign class placement makes totals unavailable
instead of silently disappearing. Canonical current-period, roster, and subject
scope must agree before the snapshot can return any totals.

`completeEvidenceStudents` means all expected subject evidence is present; it is
not permission to release a report. Class-wide issues (including pending score
corrections) still block review/release. `evidenceComplete` follows canonical
class readiness, while `readyForReview` additionally excludes already submitted
or published sets. Completed published sets do not fill the follow-up list.
Published/submitted sets with incomplete evidence are explicitly marked
`NEEDS_RECONCILIATION`; the original publication status remains unchanged.

Classes with active students but no published teaching scope are explicitly
counted as needing setup, not silently certified. Missing period/publication,
empty teaching scope, and empty eligible rosters return null totals. Missing or
invalid deadline settings make CA accountability unavailable without replacing
it with zero overdue work. Known database connection/transaction interruptions
return `UNAVAILABLE/DATABASE_UNAVAILABLE` with null totals and a sanitized server
log. Unexpected errors propagate; authorization failures are never caught here.
Neither case is converted into a successful empty-school result.

Before loading evidence, same-snapshot counts cap synchronous work: 60 classes,
3,000 active students, 500 active teachers, 500 subjects, 10,000 active published
lessons, 5,000 buckets, 10,000 activities, 100,000 scores, 100,000 assessment
records, 20,000 CA obligations, 20,000 escalations, and 10,000 pending corrections.
Buckets, activities, scores, and assessment budgets cover only the active period.
Open correction/escalation review and CA obligation history still have separate
bounded workloads; unrelated earlier score history cannot disable current-term
readiness tracking.
Expected student/subject entries are capped at 30,000, with a separate density
guard against expensive in-memory canonical evaluation. Exceeding a limit returns
`UNAVAILABLE/EVALUATION_LIMIT`, never truncated totals. Larger schools/history
need a separately designed batch/materialized snapshot before raising limits.

## CA recording tracking (Step 3)

The snapshot's `caRecording` reader uses the same transaction, active period,
published class/subject/teacher scope, current active roster, and admission/class
join eligibility. It loads evidence in five batched queries, never per student.
Five activity/subject details are returned after full evaluated counts.

- No actual activity: **No CA activity recorded yet**, not an overdue duty.
- Missing eligible scores before/on the deadline: **Scores remaining**.
- Missing eligible scores after the deadline: **Scores overdue**, unless an
  accepted follow-up exception closes the duty.
- Every eligible score row is present and valid: **Activity scores complete**.

An explicit raw zero score row is recorded evidence. Invalid marks, duplicate
rows, premature future scores, locks with incomplete records, and stale completed
obligations require review rather than being silently certified. Future activities
do not count as today's required/overdue scores. Later joins do not inherit earlier
teacher duties; missing earlier academic evidence remains placement review.

`recordingPermittedNow` is independent of the score deadline. The shared teacher
lesson-window evaluator determines whether normal entry is currently open; activity,
bucket and submitted/published report locks still block entry. An overdue activity
may be entered late during a permitted lesson window. The reader never opens a
window, unlocks data, or grants authority to save marks.

Allocation uses `buildSubjectCAProgress` and `assessmentPosition`. Bucket totals
must fulfill the configured CA weight; SUM activities must fulfill their bucket
allocation. Complete existing activity scores do not prove term CA completion.
Term CA additionally requires complete canonical student CA evidence, no pending
CA score correction, no future/foreign/misfiled/invalid evidence, and no unresolved earlier
placement gap. Exam entry is deliberately not part of this CA-only measure. Final
report release still uses the report approval safeguards, including exam evidence.

Valid earlier teacher scores remain canonical academic evidence after assignment
or employment changes. `ignoredActivities` means not part of current teacher-duty
tracking, not erased from term marks. Such historical activities never become
overdue duties for the newly assigned teacher.

Missing/invalid deadlines leave recorded/remaining counts visible and overdue totals
null, never a fabricated healthy zero. A zero-CA-weight period is explicitly not
required. The dashboard presentation is reserved for the later UI integration step.

## Before pilot

### Step 3 hardening

Allocation validation is shared with report certification: SUM activities require
positive explicit allocations, cannot exceed their bucket, and cannot rely on
capped totals to conceal extra/unallocated activities. Invalid bucket modes,
negative/oversized allocations, null marks, and duplicate score evidence cannot
certify CA or reports. A null mark is never converted into a genuine zero.

Normal-recording permission is false for zero eligible rosters, invalid saved
marks, or invalid subject setup. Valid recorded activity scores can still be
complete while term allocation/evidence needs review; those remain separate axes.
Resolved/dismissed follow-ups must match both the teacher and obligation before
they suppress another overdue accusation.

Teacher status checks, snapshot permission, and transactional score saves share
the same school-clock lesson-window evaluator. The school timezone defaults to
Africa/Accra only when no stored timezone exists. Invalid policies/timezones fail
closed. Deployment host timezone cannot change CA window permission. Score saves
recheck the active published lessons, school policy/timezone, source scope,
allocation structure and publication lock inside their Serializable transaction;
an earlier page check is never sufficient authority to write.

Mixed invalid operating-day values make deadline tracking unavailable rather
than silently dropping the unknown days. Before pilot, test delayed entry with
the actual weekly timetable/deadline configuration and real simultaneous policy,
publication, roster and score changes.

Run real authenticated multi-school tests, simultaneous assessment/import and
snapshot reads, and representative maximum-size latency tests against the actual
production database. Passing mocked tests, typecheck, or build is not production
certification. The service is the Step 2 foundation; CA/exam lane presentation and
dashboard integration follow in the subsequent steps.
