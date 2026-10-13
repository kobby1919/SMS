# Admin Academic Review

The Academic menu has five destinations in this order: Timetable, Curriculum,
Attendance Review, Assessments, Reports & Approval. The dashboard links to the
same destinations. Homework remains available through class overview's Homework
evidence link and the accountability review; admins cannot create or check it.

## Reports & Approval

`/list/report-cards` is an admin review workspace, not an assessment entry form.
Year, term and class filters are validated and school-scoped. Blocker links include
the exact school-authorized class, subject, period and student ID in the read-only
assessment review. Blockers are paginated at 25 and release history at the latest
10 recorded actions. Submission actors are resolved to names, not raw Clerk IDs.

Ready means every eligible student-subject entry has complete valid CA evidence,
confirmed exam evidence where required and stored report totals matching the
canonical calculation. Incomplete explains the precise missing scores, incomplete
allocations, future activities, invalid raw marks or stale report totals.
Awaiting review means a class teacher has submitted the set. It does not prove
that later data changes left it complete. Published reflects the persisted release
state; changed/incomplete current evidence is flagged rather than disguised.

The canonical CA calculator is shared with assessment review. SUM_ACTIVITIES
contributions are recalculated from raw scores and activity allocations, not
trusted from cached normalized contributions. Explicit zero CA scores count as
recorded. Missing setup has no guessed 30/70 fallback in admin review.

## Approval Safeguards

Submission requires an active assigned class teacher and the active academic
period. Publication requires an admin, a submitted set, current complete readiness
and an exam window that has been opened where exam weight is positive. CA-only
reports do not require an irrelevant exam window. The admin review shows window
status as a publication blocker and exposes window settings before submission,
not teacher score-entry controls. Returning and withdrawing require notes;
withdrawal is allowed only from PUBLISHED and return only from SUBMITTED.

Readiness, state transition and required audit insertion use one serializable
transaction. Conditional updates include school, class, period, prior status and
updatedAt. The UI sends expectedUpdatedAt, so a stale screen must refresh rather
than silently approving a newer submission. Duplicate/serialization conflicts
require refresh and review, not an automatic second approval. Audit failure rolls
back the transition. Ordinary teacher entry actions using the active-period guard
reject changes to submitted/published sets until an admin returns/withdraws them.

## Limits And Pilot Checks

Pending score correction requests block readiness/release. Correction approvals
check report state inside serializable transactions and require a returned or
withdrawn set before changing submitted/published results. Exam corrections also
respect the configured maximum. Report page/PDF roles exclude finance-only staff.
The student report view and PDF both consult canonical readiness for the
authorized student and displayed subjects. A positive exam score alone cannot
certify an incomplete/stale report. Zero-exam-weight configurations use CA-only
completion rather than an irrelevant positive-exam requirement.

Historical review uses recorded students/subjects. Full old rosters and full
historical curricula are not versioned, so recorded coverage is not certification
of the complete original report set. New releases require the active period.

Exam entries now have `examRecordedAt`. A deliberately saved zero counts; an
untouched legacy default zero stays unconfirmed. Positive legacy marks retain
their evidence. Backfilled legacy timestamps use the last record update as known
evidence, not a reconstructed original entry time or proof of teacher lateness.
Exam saves use a serializable transaction, an open exam window,
published teacher scope, current active students, report locks and mandatory audit.
CA lesson windows are not an extra gate for exam-only entry.

`Student.classJoinedAt` tracks placement changes and reactivation. Existing
placements begin tracking at migration time, not an invented historical date.
Earlier activities do not create overdue duties for late admissions/transfers.
Missing earlier report evidence requires placement review, not automatic marks or
silent exemption. CA deadlines use the configured school days and timezone.

Before pilot, test authenticated admin/class-teacher/subject-teacher/parent flows,
same-school and cross-school denials, reject/resubmit, withdraw/release, real
PostgreSQL concurrency including overlapping legacy score/correction writes,
report PDF visibility and cache invalidation after withdrawal, and representative
class sizes. Code checks and fixture screenshots are not production certification.

## Local Checks

The regression suite includes tests for all academic review parts. New report tests
cover canonical scores, stale totals, incomplete allocations, historical evidence,
foreign/malformed selections, approval states, stale review tokens, failed audit
rollback, class-teacher submission and the exact five-link menu. Responsive fixtures
render the actual report component and controls at 320/390/768/1440 pixels in
submitted, published and empty states with the real Nunito font.
