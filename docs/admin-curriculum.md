# Curriculum

Admin Curriculum at `/list/syllabus` separates teaching guide preparation from
teacher-recorded coverage. Filters are academic year, term, class and subject;
results are paginated at 25 records. Preparation is one guide per subject, grade,
year and term. Coverage is counted per topic and class, not per lesson slot.

## Workflow

1. Admin creates a draft, selecting a same-school subject and grade.
2. Admin saves topics, planned weeks, learning objectives and resources.
3. Publishing requires at least one valid saved topic. Topic editing requires draft state.
4. Teachers see only published guides for their published timetable assignments.
5. Active teachers record coverage only for the active school period, matching
   class grade and published subject/class assignment, within school operating hours.
6. Admin reviews recorded topics, recording teacher/date, missing records, missing
   guides and current timetable responsibility. Admin cannot record teacher coverage.

Coverage is teacher-reported, not independent proof. There is no real term-start
calendar in the current model, so the review does not invent overdue dates or
accuse teachers of being behind. Planned week numbers remain part of the guide.
Historical views do not attribute today's teachers to an earlier period.

## Safeguards

- All mutations use serializable transactions. Conflicts require review/retry.
- A guide with coverage cannot be unpublished, deleted or have its topic plan rewritten.
- Teachers cannot overwrite/remove another teacher's coverage. Editing a note
  preserves the original recording teacher/date; a teacher can undo their own
  current-period mark. This existing progress model is mutable, not an immutable
  event audit log or independently verified classroom observation.
- Drafts are protected on list, direct detail and PDF routes.
- Teacher detail/PDF coverage is restricted to available assigned classes. PDF
  cache keys include role and class scope; browser responses are private/no-store.
- Missing published assignments are shown honestly. No draft-timetable fallback.
- Grade membership is the current class structure. Full historical class/teacher
  assignment reconstruction needs versioned academic placement data, not guesses.
  Actual recorded coverage is retained in review, detail and PDF even when the
  class has since changed grade; it is not attributed to today's teacher assignment.

## Requirement Audit

The agreed flow remains: admin draft, saved topic plan, admin publication,
published-timetable-scoped teacher guide, teacher recording per class, admin review.
Preparation and coverage are separate. Year/term/class/subject filters, planned
topics, coverage gaps, responsible teachers and the teacher-recorded evidence
label are present. Admin cannot record teacher progress.

The follow-up audit corrected hidden recorded history after grade changes,
publication of older saved content while local edits were unsaved, and incomplete
validation of legacy saved topic records at publication. Existing-guide writes
and PDFs also validate that linked subject/grade references belong to the school.
PDFs now invalidate on class, subject and grade changes as well as coverage edits.

## Before Pilot

Run a real admin-to-teacher walkthrough: prepare/publish a guide, publish matching
timetable assignments, record coverage, edit a note, review each class separately,
verify the admin cannot mark coverage, verify draft/direct/PDF restrictions and
verify another school cannot access the guide. Exercise concurrent publish/edit/
coverage changes against the production-equivalent database. Unit fixtures and
responsive screenshots do not certify this end-to-end behavior.

## Verification

- 239 regression tests passed after the requirement audit; TypeScript, scoped lint
  and production build passed. The audit includes regressions for retained class
  history, unsaved editor content and invalid legacy topic publication.
- Actual component/font fixtures passed 320, 390, 768 and 1440px checks for
  coverage, guide preparation list, admin detail and teacher detail.
- A read-only Default School database query passed, showing five classes and no
  guides or configured academic year. No test curriculum records were inserted.
- The installed database adapter still emits a PostgreSQL query-concurrency
  deprecation warning during relational reads. Review adapter/driver compatibility
  before go-live dependency upgrades; sequential application queries do not
  eliminate internal adapter behavior. This is not production certification.
