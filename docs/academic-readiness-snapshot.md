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

### Step 6: Compact admin dashboard

Step 6 hardening separates missing open-window exam entries from invalid stored
marks requiring review. Open score issues link to read-only assessment review;
window setup/closure issues link to guarded report/window controls. Invalid marks
remain reviewable before opening, without being labelled overdue or closed.
Attention subject/teacher evidence must match published scope, future work and
healthy publications cannot create follow-up rows, and student setup directs to
student management. Pending CA corrections remain visible when scores are filled.

The authenticated `/admin` page now reads the academic snapshot and renders three
lanes: CA Recording, Exam Entry and Report Release. Period and setup status are
explicit; database unavailability is not presented as a configuration failure or
healthy zero. Exam remaining counts in the lane cover open windows only; closed
unresolved entries and windows not started remain separate.

Attention candidates are selected per class before source-list truncation, then
merged into at most five distinct classes. Each representative issue states its
activity/subject/class count scope, current assigned teacher where applicable and
one action. Only genuinely overdue CA work with outstanding scores and no closed
follow-up exception links to teacher follow-up. Missing activities, setup gaps,
placement reviews, pending scores and exam/report issues use read-only academic
or guarded report-review destinations instead. Section 3 retains its full teacher
accountability list; this section does not reproduce it.

SSR fixture checks and headless browser previews cover populated, empty, setup,
unavailable and CA-only states at 320, 390, 768 and 1440 pixels with real application
CSS and Nunito. These synthetic layout checks are not live authenticated testing;
verify actual school data, clicks, role isolation and maximum-size latency before
pilot. No new score entry or report-release permission is granted by this UI.

### Step 5: Final report readiness

Hardening: report scope/count inconsistencies fail closed with an explicit
unavailable school snapshot. Historical complete publications retain their
workflow without being offered for new release or falsely marked for correction
solely because their period ended. Locked windows with prior opening metadata
require review, not release. Direct submission and publication both verify genuine
exam opening history. Reports & Approval uses the same workflow/evidence adapter
as the dashboard. Healthy published classes remain in totals but do not displace
actionable review/resubmission classes from the bounded list. Duplicate class
scope and unsafe aggregate counts cannot certify readiness.

Final reports reuse canonical readiness inside the same school snapshot: required
CA allocations/scores, genuine exam evidence, reconciled totals/grades, placement
gaps and pending corrections. Evidence completion is separate from release
readiness and does not imply approval or publication. A pending correction can
block release even at 100% complete evidence.

Workflow remains a persisted fact: NOT_SUBMITTED, AWAITING_ADMIN_REVIEW,
PUBLISHED, RETURNED or WITHDRAWN (UNPUBLISHED with a withdrawal timestamp).
Stale submitted/published evidence requires reconciliation without rewriting
publication history. No dashboard indicator grants authority to release reports.

Percentages describe complete student-subject evidence entries, not teacher
duties. They remain null before exams open unless report review has already
started. CA-only classes show percentages once evidence is complete or review is
underway. School percentages include only review-stage classes, exposing their
denominator separately. Incomplete evidence cannot round to 100%.

Full tracked-scope counts precede five-class/subject limits. Review URLs preserve
class, subject, year and term; assessment views remain read-only for admins.
Visible dashboard presentation remains the next UI step. Live submission,
return, withdrawal, correction and tenant-isolation tests remain required.

### Step 4: Exam window tracking

`examTracking` adapts `getClassReportReadiness` exam evidence in the same
school-scoped RepeatableRead snapshot, without new per-student database reads.
The roster is active students currently placed in a published class; subjects are
deduplicated active published timetable subjects. Exam eligibility is current
term/class eligibility, not retroactive CA activity eligibility. Late admissions
are included in current exam counts, never accused of earlier missed CA duties.

Exam counts are evaluated independently of CA and final-report blocker precedence:
a valid recorded exam still counts when CA is incomplete. Genuine zero requires
the explicit recording marker; legacy positive marks remain supported. Default
zero is missing. Invalid/out-of-range and duplicate evidence requires review,
never counts as recorded. Expected = recorded + missing + invalid.

- No window: setup required, no overdue accusation.
- Locked/closed without an opening: entry not started, no overdue accusation.
- Open: recorded and remaining counts.
- Closed after opening: remaining entries require review, not an overdue teacher
  accusation or automatic reopening.
- Zero exam weight: no exams required and no fabricated required counts.
- Unknown/invalid window evidence: review required; normal entry stays locked.

Full tracked-scope totals are computed before returning at most five classes and
five subjects per class. Missing timetable scope remains explicitly reported by
the school snapshot. Review links use the exact class/subject/year/term filters on
the read-only admin assessment page. `ordinaryEntryWindowOpen` is only a
window/report-lock indicator, not authority to edit an existing mark, bypass
teacher authorization, or release a report. Actual writes retain Serializable
window checks, published teacher scope, active roster, report locks and saved-mark
correction safeguards. Pending corrections still block report release without
erasing recorded exam evidence. No window or mark is changed by the reader.

Dashboard presentation remains in the later UI step. Before pilot, verify actual
authenticated open/close/reopen transitions, simultaneous close/save requests,
explicit zero saves, report submission locks, and tenant isolation.

### Step 4 hardening

Exam window state requires a valid opening timestamp before OPEN is trusted.
Unknown status, invalid timestamps, contradictory open/closed metadata and invalid
weights fail closed. Reports cannot be published using an unaudited/unopened
window. An admin must explicitly repair/reopen a malformed window; tracking never
repairs it silently. A positive-weight term cannot be labelled NOT_REQUIRED, and
an empty tracking scope is setup-required rather than a healthy zero. Setup and
window-review classes remain visible before dashboard list truncation.

One shared exam evidence classifier handles legacy positive marks, explicit
zeros, invalid timestamps and mark limits across recording, assessment position
and report tracking. Invalid existing marks cannot be overwritten as if missing;
zero-weight exams are consistently not required. Class overview uses canonical
exam counts and says entries recorded, not reports ready.

Admin window transitions use a Serializable transaction with compare-and-set
updates and atomic audit writes. Only the active exam-required period can be
opened; submitted/published report sets cannot be reopened. Repeated open/close
clicks are idempotent and preserve opening history. Failed audit writes roll back
window changes. Live concurrent close/save/reopen and tenant tests remain required.

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
certification.

### Step 7: exact read-only navigation

Activity review includes classId, subjectId, activityId, year and term. The
authorized admin assessment query validates the activity against its school,
class, subject and period inside the read transaction, excludes future activity,
and refuses missing context or stale sources without loading student scores.
Both desktop and mobile evidence focus on that activity; subject totals remain
canonical, not recalculated from one activity. Pagination retains the selection,
and changing the class, subject or period clears it.

Genuine overdue CA work links to the exact teacher/activity duty in the
school-scoped accountability review. Resolved or unavailable duties show an
empty state; they never substitute another activity. Missing deadline setup goes
to accountability settings. Exam windows needing setup/review go to the existing
guarded Reports & Approval window controls; open exam gaps go to read-only
assessment review. Report blockers go to Reports & Approval with class/year/term
filters; its missing-entry links retain the specific subject and student.

Route-contract and service tests cover route existence, exact parameters,
invalid/repeated identifiers, foreign/missing source rejection, stale duties,
canonical totals and separation from teacher grading controls. Real authenticated
navigation and cross-school testing remain required before pilot.
