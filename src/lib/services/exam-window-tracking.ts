import "server-only";
import type { ExamSubjectEvidence } from "@/src/lib/services/report-card-readiness";

type ExamClassInput = {
  classId: number; className: string; studentCount: number; subjectCount: number;
  windowState: string; publicationStatus: string; evidence: ExamSubjectEvidence[];
};

const labels: Record<string, string> = {
  NOT_CONFIGURED: "Exam window setup required",
  NOT_OPENED: "Exam entry not started",
  OPEN: "Exam entry open",
  CLOSED: "Exam entry closed",
  NOT_REQUIRED: "Exam entry not required",
  NEEDS_REVIEW: "Exam window configuration requires review",
};

/** Adapts canonical counts only. Never opens windows, records marks, or releases reports. */
export function buildExamWindowTracking(examWeight: number, academicYear: string, term: string, classes: ExamClassInput[]) {
  const unavailable = () => ({ state: "UNAVAILABLE" as const, totals: null, classes: [], classListLimit: 5, issues: ["Exam evidence and teaching scope do not agree. No partial exam totals are shown."] });
  if (!Number.isFinite(examWeight) || examWeight < 0 || examWeight > 100 || new Set(classes.map((cls) => cls.classId)).size !== classes.length) return unavailable();
  if (!classes.length) return { ...unavailable(), state: "SETUP_REQUIRED" as const, issues: ["Publish subject assignments for active students before evaluating exam entry."] };
  const evaluated = [];
  for (const cls of classes) {
    const state = examWeight === 0 ? "NOT_REQUIRED" : cls.windowState;
    if (!Object.hasOwn(labels, state) || examWeight > 0 && state === "NOT_REQUIRED" || !["UNPUBLISHED", "SUBMITTED", "PUBLISHED", "REJECTED"].includes(cls.publicationStatus) ||
      !Number.isSafeInteger(cls.classId) || cls.classId <= 0 || !Number.isSafeInteger(cls.studentCount) || cls.studentCount <= 0 ||
      !Number.isSafeInteger(cls.subjectCount) || cls.subjectCount <= 0 || cls.evidence.length !== cls.subjectCount || new Set(cls.evidence.map((row) => row.subjectId)).size !== cls.evidence.length ||
      cls.evidence.some((row) => ![row.expected, row.recorded, row.missing, row.invalid].every((count) => Number.isSafeInteger(count) && count >= 0) ||
        !Number.isSafeInteger(row.subjectId) || row.subjectId <= 0 ||
        row.expected !== (examWeight === 0 ? 0 : cls.studentCount) || row.recorded + row.missing + row.invalid !== row.expected)) return unavailable();
    const recorded = cls.evidence.reduce((sum, row) => sum + row.recorded, 0);
    const missing = cls.evidence.reduce((sum, row) => sum + row.missing, 0);
    const invalid = cls.evidence.reduce((sum, row) => sum + row.invalid, 0);
    const reportLocked = ["SUBMITTED", "PUBLISHED"].includes(cls.publicationStatus);
    const remaining = missing + invalid;
    const label = state === "CLOSED" && remaining > 0 ? "Closed exam entries require review" : labels[state];
    const subjects = cls.evidence.map((row) => ({ ...row,
      reviewUrl: `/list/ca?${new URLSearchParams({ classId: String(cls.classId), subjectId: String(row.subjectId), year: academicYear, term })}`,
    })).sort((a, b) => (b.missing + b.invalid) - (a.missing + a.invalid) || a.subjectId - b.subjectId).slice(0, 5);
    evaluated.push({ classId: cls.classId, className: cls.className, state, label, expected: recorded + remaining, recorded, missing, invalid, remaining,
      unresolvedAfterClose: state === "CLOSED" ? remaining : 0,
      ordinaryEntryWindowOpen: state === "OPEN" && !reportLocked,
      reportLocked, subjects, subjectListLimit: 5,
    });
  }
  const setupRequired = evaluated.some((cls) => ["NOT_CONFIGURED", "NEEDS_REVIEW"].includes(cls.state));
  const totals = {
    expected: evaluated.reduce((sum, cls) => sum + cls.expected, 0), recorded: evaluated.reduce((sum, cls) => sum + cls.recorded, 0),
    remaining: evaluated.reduce((sum, cls) => sum + cls.remaining, 0), invalid: evaluated.reduce((sum, cls) => sum + cls.invalid, 0),
    unresolvedAfterClose: evaluated.reduce((sum, cls) => sum + cls.unresolvedAfterClose, 0),
    setupRequiredClasses: evaluated.filter((cls) => cls.state === "NOT_CONFIGURED").length,
    notOpenedClasses: evaluated.filter((cls) => cls.state === "NOT_OPENED").length,
    openClasses: evaluated.filter((cls) => cls.state === "OPEN").length,
    closedClasses: evaluated.filter((cls) => cls.state === "CLOSED").length,
    notRequiredClasses: evaluated.filter((cls) => cls.state === "NOT_REQUIRED").length,
    windowReviewClasses: evaluated.filter((cls) => cls.state === "NEEDS_REVIEW").length,
  };
  if (!Object.values(totals).every(Number.isSafeInteger)) return unavailable();
  const priority = (state: string) => state === "NEEDS_REVIEW" ? 3 : state === "NOT_CONFIGURED" ? 2 : state === "CLOSED" ? 1 : 0;
  return { state: setupRequired ? "SETUP_REQUIRED" as const : "AVAILABLE" as const, totals,
    classes: evaluated.sort((a, b) => priority(b.state) - priority(a.state) || b.unresolvedAfterClose - a.unresolvedAfterClose || b.invalid - a.invalid || b.remaining - a.remaining || a.classId - b.classId).slice(0, 5),
    classListLimit: 5, issues: [
      ...(setupRequired ? ["Configure exam entry windows for the listed classes. Entries are not overdue before a window has opened."] : []),
      ...(totals.windowReviewClasses ? ["Some exam window configurations require review. Ordinary entry remains locked for those classes."] : []),
    ],
  };
}
