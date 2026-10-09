# Admin Timetable

Part 2 consolidates timetable planning and the published schedule at
`/admin/timetable`. Both views require an admin session. Existing admin links to
`/list/lessons` redirect to the published view, preserving recognized string
filters. The teacher lesson page remains available and teacher-scoped.

## Draft And Checks

The existing builder and publish actions remain in place. Draft checks report
clashes, operating-day/hour violations, subject-capability gaps, inactive teachers,
period mismatches, classes without lessons, and classes missing active days.
Student counts used for empty-class checks include only active same-school pupils.
An empty draft is not labelled healthy. The arbitrary health percentage is no
longer displayed; concrete issue counts remain visible.

These are draft checks, not certification of the currently published timetable.
Class-day gaps are warnings: the system does not invent subject-frequency or
curriculum requirements that the school has not configured.

## Published Schedule

- Reads lessons from one active same-school publication in a repeatable-read
  snapshot; it never falls back to draft lessons.
- Displays publication version/date, day/time, class, subject and teacher.
- Filters by class, teacher, day and search; pagination uses 30 lessons per page.
- Rejects foreign or malformed selections and repeated filter values.
- Shows classes with active pupils but no published lessons and published
  teachers whose current school profile is no longer active.
- Publication names/times remain the published snapshot, not renamed draft data.
- No editing or publishing controls appear in the published view.

## Hardening Follow-Up

- Draft class choices are read directly from the authorized school's database,
  avoiding stale cached empty lists after imports. Refreshed selections retain
  valid classes and reset removed classes; empty schools show an explicit state.
- Publishing validates draft lessons, teacher status and operating settings in
  the same serializable transaction that creates the publication. Concurrent
  conflicts return a refresh-and-review message rather than silently publishing
  an inconsistent draft.
- Missing teacher profiles remain visible as warnings without broken detail links.
- Assessment and timetable review use the app's Nunito typography. Fixture-based
  browser checks cover 320, 390, 768 and 1440px with the real font assets loaded.
- 226 regression tests, TypeScript, scoped lint and the production build passed.
  These checks do not replace authenticated, real-database pilot testing.

## Pilot Verification

Confirm with an authenticated admin that draft edits do not change the published
view, publishing switches the displayed version, archived lessons stay excluded,
old lesson links retain filters, and teachers still see only their own lessons.
Run these checks against a real database as well as the regression suite.
