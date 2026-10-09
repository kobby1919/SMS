# Admin Assessment Review

The admin's Academic > Assessments link opens `/list/ca`. Admins receive a
dedicated read-only view; teachers retain their existing assessment workspace.
No score-entry, score-deletion, or correction-approval action is exposed by this
view. Assessment configuration remains a separate admin setting.

## Sources And Scope

- Authorization comes from the signed-in admin's school, never a query parameter.
- Filters are academic year, term, class, subject, and student/admission search.
- Current-period subjects come only from the published timetable.
- Historical subjects come from same-school assessment/bucket records.
- Current-period students must be active. The view uses current class placement;
  it is not a historical enrolment snapshot.
- Results are paginated at 25 students, ordered deterministically.
- CA marks use `getSubjectCAProgress`, the existing scoring implementation.
- Admin review supplies an as-of cutoff; future activities do not inflate marks
  or expected-so-far activity counts. Other callers retain their existing behavior.
- Future activities, incomplete allocations, missing activities, unscored
  activities, or unconfirmed exam entries prevent an overall result being shown.
- Activity completeness is not a teacher lateness/escalation calculation.

## Known Exam Limitation

`ContinuousAssessment.examScore` defaults to zero and has no explicit entered flag.
It cannot distinguish a genuine recorded zero from an exam not yet entered. The
view deliberately labels it unconfirmed and withholds an overall result. Resolving
this requires a separate exam-entry tracking change and historical-data policy;
do not backfill every default zero as a confirmed mark.

## Verification

- Regression tests cover same-school filtering, malformed/foreign selections,
  recorded-zero CA, missing scores, partial allocations, and future activities.
- `tests/admin-assessment-preview.mjs` renders a fixture of the real components
  in Playwright with application CSS. Screenshots at 320, 390, 768, and 1440 pixels
  check horizontal overflow and clipped controls. This is component layout QA,
  not an authenticated end-to-end test.
- Before pilot, verify real admin filters against known database scores, teacher
  entry remains unchanged, and historical class placement limitations are understood.

Example local layout check (PowerShell, with installed Playwright):

```powershell
node node_modules/tailwindcss/lib/cli.js -i src/app/globals.css -o tmp/admin-assessment-review/preview.css
$env:EDUJAY_PLAYWRIGHT_PATH = "path/to/playwright"
$env:EDUJAY_BROWSER_CHANNEL = "msedge"
node tests/admin-assessment-preview.mjs
```
