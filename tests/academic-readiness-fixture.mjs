export function academicReadinessFixture(state = "ACTIVE") {
  const snapshot = { state: "AVAILABLE", period: { academicYear: "2026/2027", term: "TERM_1", classworkWeight: 30, examWeight: 70 }, issues: [],
    caRecording: { issues: [], totals: { scoresRemaining: 6, scoresRecorded: 4, scoresRequired: 10, overdueActivities: 1, subjectsWithoutActivities: 0, subjectsWithIncompleteAllocation: 1 } },
    examTracking: { issues: [], totals: { recorded: 8, openRemainingEntries: 2, openMissingEntries: 2, openInvalidEntries: 0, unresolvedAfterClose: 1, openClasses: 1, notOpenedClasses: 1, setupRequiredClasses: 0, windowReviewClasses: 0 } },
    finalReports: { totals: { awaitingReviewClasses: 1, readyToSubmitClasses: 1, publishedClasses: 2, completionPercent: 70, approachingReviewClasses: 2, blockedReviewClasses: 1, returnedClasses: 1, withdrawnClasses: 0 } },
    attention: { totalClasses: 7, rows: Array.from({ length: 5 }, (_, index) => ({ classId: index + 1,
      className: "Primary Six - Section A", title: "English Language and Written Expression · Spelling and Comprehension Activity",
      detail: index === 0 ? "6 scores overdue · Normal recording closed" : "6 scores remaining · Recording period open",
      teacherName: "Ms. Victoria Beatrice Mensah-Agyemang", lane: "CA Recording", action: index === 0 ? "Review follow-up" : "Review assessment",
      href: index === 0 ? "/admin/accountability/follow-up?teacherId=teacher-a" : `/list/ca?classId=${index + 1}&subjectId=2&year=2026%2F2027&term=TERM_1`,
    })) },
  };
  if (state === "SETUP_REQUIRED" || state === "UNAVAILABLE") Object.assign(snapshot, { state, period: null, caRecording: null, examTracking: null, finalReports: null, attention: null, issues: [state === "UNAVAILABLE" ? "Academic readiness could not be evaluated right now. No partial totals are shown." : "Activate a valid academic year and term."] });
  if (state === "EMPTY") snapshot.attention = { rows: [], totalClasses: 0 };
  if (state === "INVALID_EXAM") { snapshot.examTracking.totals.openInvalidEntries = 3; snapshot.examTracking.totals.openRemainingEntries = 5; }
  if (state === "CA_ONLY") { snapshot.period.examWeight = 0; snapshot.period.classworkWeight = 100; snapshot.finalReports.totals.completionPercent = null; }
  return snapshot;
}
