import "server-only";
import type { ClassReportReadiness } from "@/src/lib/services/report-card-readiness";

type Evidence = Pick<ClassReportReadiness, "expectedEntryCount" | "readyEntryCount" | "studentCount" | "subjectCount" | "isReady" | "issues" | "examRequired" | "currentPeriod">;
export type ReportWorkflowState = "NOT_SUBMITTED" | "AWAITING_ADMIN_REVIEW" | "PUBLISHED" | "RETURNED" | "WITHDRAWN";

function completionPercent(ready: number, expected: number) {
  if (!expected) return null;
  return ready === expected ? 100 : Math.min(99.9, Math.round(ready / expected * 1000) / 10);
}

/** Canonical evidence and persisted workflow are independent; this grants no action permission. */
export function getFinalReportPosition(input: {
  readiness: Evidence; examState: string; publicationStatus: string; unpublishedAt?: Date | null;
}) {
  const { readiness, examState, publicationStatus, unpublishedAt } = input;
  const valid = [readiness.expectedEntryCount, readiness.readyEntryCount, readiness.studentCount, readiness.subjectCount].every((count) => Number.isSafeInteger(count) && count >= 0) &&
    typeof readiness.examRequired === "boolean" && typeof readiness.isReady === "boolean" && typeof readiness.currentPeriod === "boolean" &&
    ["NOT_REQUIRED", "NOT_CONFIGURED", "NOT_OPENED", "OPEN", "CLOSED", "NEEDS_REVIEW"].includes(examState) &&
    (readiness.examRequired ? examState !== "NOT_REQUIRED" : examState === "NOT_REQUIRED") &&
    readiness.readyEntryCount <= readiness.expectedEntryCount && readiness.expectedEntryCount === readiness.studentCount * readiness.subjectCount &&
    ["UNPUBLISHED", "SUBMITTED", "PUBLISHED", "REJECTED"].includes(publicationStatus) &&
    (!unpublishedAt || Number.isFinite(unpublishedAt.getTime())) &&
    readiness.isReady === (readiness.expectedEntryCount > 0 && readiness.readyEntryCount === readiness.expectedEntryCount && readiness.issues.length === 0);
  if (!valid) throw Object.assign(new Error("Report evidence or workflow is inconsistent with canonical readiness."), { code: "ACADEMIC_EVIDENCE_INCONSISTENT" });
  const workflowState: ReportWorkflowState = publicationStatus === "SUBMITTED" ? "AWAITING_ADMIN_REVIEW"
    : publicationStatus === "PUBLISHED" ? "PUBLISHED" : publicationStatus === "REJECTED" ? "RETURNED"
      : unpublishedAt ? "WITHDRAWN" : "NOT_SUBMITTED";
  const evidenceComplete = readiness.expectedEntryCount > 0 && readiness.readyEntryCount === readiness.expectedEntryCount;
  const examWindowReady = !readiness.examRequired || ["OPEN", "CLOSED"].includes(examState);
  const releaseBlockers = [...readiness.issues];
  if (!readiness.currentPeriod) releaseBlockers.push("New report submission and publication are restricted to the active academic period.");
  if (readiness.readyEntryCount < readiness.expectedEntryCount) releaseBlockers.push(`${readiness.expectedEntryCount - readiness.readyEntryCount} student-subject entries require complete, reconciled assessment evidence.`);
  if (!examWindowReady) releaseBlockers.push("A valid exam window must have opened before reports can be released.");
  if (!readiness.expectedEntryCount) releaseBlockers.push("Active students and published subjects are required before report review.");
  const approachingReview = workflowState !== "NOT_SUBMITTED" || (readiness.examRequired ? examWindowReady : evidenceComplete);
  const releaseReady = readiness.currentPeriod && readiness.isReady && examWindowReady && readiness.expectedEntryCount > 0;
  const canSubmitForReview = releaseReady && ["NOT_SUBMITTED", "RETURNED", "WITHDRAWN"].includes(workflowState);
  return {
    workflowState, evidenceComplete, releaseReady, canSubmitForReview,
    evidenceState: evidenceComplete ? "COMPLETE" as const : "INCOMPLETE" as const,
    phase: approachingReview ? "REPORT_REVIEW" as const : "PREPARATION" as const,
    completionPercent: approachingReview ? completionPercent(readiness.readyEntryCount, readiness.expectedEntryCount) : null,
    expectedEntries: readiness.expectedEntryCount, completeEntries: readiness.readyEntryCount,
    remainingEntries: readiness.expectedEntryCount - readiness.readyEntryCount,
    releaseBlockers: [...new Set(releaseBlockers)],
    needsReconciliation: ["AWAITING_ADMIN_REVIEW", "PUBLISHED"].includes(workflowState) && (!readiness.isReady || !examWindowReady),
  };
}

export function buildFinalReportTracking(classes: ({ classId: number; className: string; position: ReturnType<typeof getFinalReportPosition>;
  blockingSubjects: { subjectId: number; subjectName: string; affectedEntries: number; reasons: string[] }[];
})[], academicYear: string, term: string) {
  if (new Set(classes.map((cls) => cls.classId)).size !== classes.length || classes.some((cls) => !Number.isSafeInteger(cls.classId) || cls.classId <= 0)) throw Object.assign(new Error("Report class scope is inconsistent."), { code: "ACADEMIC_EVIDENCE_INCONSISTENT" });
  const reviewClasses = classes.filter((cls) => cls.position.phase === "REPORT_REVIEW");
  const expectedEntries = reviewClasses.reduce((sum, cls) => sum + cls.position.expectedEntries, 0);
  const completeEntries = reviewClasses.reduce((sum, cls) => sum + cls.position.completeEntries, 0);
  if (!Number.isSafeInteger(expectedEntries) || !Number.isSafeInteger(completeEntries)) throw Object.assign(new Error("Report count limits were exceeded."), { code: "ACADEMIC_EVIDENCE_INCONSISTENT" });
  const actionableClasses = classes.filter((cls) => cls.position.workflowState !== "PUBLISHED" || cls.position.needsReconciliation);
  const priority = (position: ReturnType<typeof getFinalReportPosition>) => position.needsReconciliation ? 4 : position.workflowState === "AWAITING_ADMIN_REVIEW" ? 3 : position.canSubmitForReview ? 2 : position.phase === "REPORT_REVIEW" ? 1 : 0;
  return {
    attentionClasses: actionableClasses,
    totals: {
      trackedClasses: classes.length, preparingClasses: classes.length - reviewClasses.length, approachingReviewClasses: reviewClasses.length,
      evidenceCompleteClasses: classes.filter((cls) => cls.position.evidenceComplete).length,
      readyToSubmitClasses: classes.filter((cls) => cls.position.canSubmitForReview).length,
      awaitingReviewClasses: classes.filter((cls) => cls.position.workflowState === "AWAITING_ADMIN_REVIEW").length,
      publishedClasses: classes.filter((cls) => cls.position.workflowState === "PUBLISHED").length,
      returnedClasses: classes.filter((cls) => cls.position.workflowState === "RETURNED").length,
      withdrawnClasses: classes.filter((cls) => cls.position.workflowState === "WITHDRAWN").length,
      blockedReviewClasses: reviewClasses.filter((cls) => !cls.position.releaseReady).length,
      needsReconciliationClasses: classes.filter((cls) => cls.position.needsReconciliation).length,
      reviewExpectedEntries: expectedEntries, reviewCompleteEntries: completeEntries,
      completionPercent: completionPercent(completeEntries, expectedEntries),
    },
    classes: [...actionableClasses].sort((a, b) => priority(b.position) - priority(a.position) ||
      b.position.remainingEntries - a.position.remainingEntries || a.classId - b.classId).slice(0, 5).map((cls) => ({ ...cls,
      reviewUrl: `/list/report-cards?${new URLSearchParams({ classId: String(cls.classId), year: academicYear, term })}`,
      blockingSubjects: cls.blockingSubjects.slice(0, 5).map((subject) => ({ ...subject,
        assessmentUrl: `/list/ca?${new URLSearchParams({ classId: String(cls.classId), subjectId: String(subject.subjectId), year: academicYear, term })}`,
      })),
    })), classListLimit: 5, classListTotal: actionableClasses.length,
  };
}
