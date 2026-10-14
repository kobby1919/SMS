import "server-only";
import type { getCARecordingTracking } from "@/src/lib/services/ca-recording-tracking";
import type { buildExamWindowTracking } from "@/src/lib/services/exam-window-tracking";
import type { buildFinalReportTracking } from "@/src/lib/services/final-report-readiness";

export type AcademicAttentionRow = {
  classId: number; className: string; title: string; detail: string; teacherName: string | null;
  lane: "CA Recording" | "Exam Entry" | "Report Release"; priority: number; action: string; href: string;
};

export function buildAcademicAttention(input: {
  period: { academicYear: string; term: string };
  classes: { classId: number; className: string }[];
  scope: { classId: number; subjectId: number; teacherId: string; teacherName: string; subjectName: string }[];
  ca: Awaited<ReturnType<typeof getCARecordingTracking>>;
  exams: ReturnType<typeof buildExamWindowTracking>;
  reports: ReturnType<typeof buildFinalReportTracking>;
}) {
  const rows: AcademicAttentionRow[] = [];
  const classNames = new Map(input.classes.map((cls) => [cls.classId, cls.className]));
  const checkScope = (classId: number, subjectId: number, teacherId?: string) => {
    if (!classNames.has(classId)) return false;
    if (!input.scope.some((scope) => scope.classId === classId && scope.subjectId === subjectId && (teacherId === undefined || scope.teacherId === teacherId))) throw Object.assign(new Error("Academic attention evidence does not match published scope."), { code: "ACADEMIC_EVIDENCE_INCONSISTENT" });
    return true;
  };
  const subjectName = (classId: number, subjectId: number) => input.scope.find((scope) => scope.classId === classId && scope.subjectId === subjectId)?.subjectName ?? "Subject";
  const teacherName = (classId: number, subjectId: number) => [...new Set(input.scope.filter((scope) => scope.classId === classId && scope.subjectId === subjectId).map((scope) => scope.teacherName).filter(Boolean))].join("; ") || null;
  const assessment = (classId: number, subjectId: number, activityId?: number) => `/list/ca?${new URLSearchParams({ classId: String(classId), subjectId: String(subjectId), year: input.period.academicYear, term: input.period.term, ...(activityId === undefined ? {} : { activityId: String(activityId) }) })}`;
  const add = (row: Omit<AcademicAttentionRow, "className">) => { if (classNames.has(row.classId)) rows.push({ ...row, className: classNames.get(row.classId)! }); };
  for (const row of input.ca.attentionActivities ?? []) {
    if (!checkScope(row.classId, row.subjectId, row.teacherId) || row.hasTakenPlace === false || ["PLANNED", "COMPLETE", "NO_ELIGIBLE_STUDENTS"].includes(row.state)) continue;
    const overdue = row.state === "OVERDUE" && !row.followUpClosed && row.scoresRemaining > 0;
    const count = row.state === "PLACEMENT_REVIEW" ? `${row.placementUnknownStudents} student placements require review`
      : row.invalidScores ? `${row.invalidScores} invalid score records require review`
        : `${row.scoresRemaining} scores ${overdue ? "overdue" : "remaining"}`;
    const window = row.recordingPermittedNow === true ? "Recording period open" : row.recordingPermittedNow === null ? "Recording permission unavailable" : "Normal recording closed";
    const review = row.state === "NEEDS_REVIEW" ? " · Activity records need review" : row.state === "DEADLINE_UNAVAILABLE" ? " · Deadline unavailable" : "";
    const needsDeadlineSetup = row.state === "DEADLINE_UNAVAILABLE";
    add({ classId: row.classId, title: `${subjectName(row.classId, row.subjectId)} · ${row.title}`, detail: `${count}${review} · ${window}`, teacherName: row.teacherName,
      lane: "CA Recording", priority: ["NEEDS_REVIEW", "PLACEMENT_REVIEW"].includes(row.state) ? 0 : overdue ? 1 : 4,
      action: needsDeadlineSetup ? "Review deadline settings" : overdue ? "Review follow-up" : "Review assessment", href: needsDeadlineSetup ? "/admin/accountability-settings" : overdue ? `/admin/accountability/follow-up?${new URLSearchParams({ teacherId: row.teacherId, activityId: String(row.activityId) })}` : assessment(row.classId, row.subjectId, row.activityId) });
  }
  for (const row of input.ca.attentionSubjects ?? []) { if (!checkScope(row.classId, row.subjectId)) continue; add({ classId: row.classId, title: `${subjectName(row.classId, row.subjectId)} · CA setup`,
    detail: row.label, teacherName: teacherName(row.classId, row.subjectId), lane: "CA Recording", priority: row.state === "NEEDS_REVIEW" ? 2 : 7,
    action: "Review assessment", href: assessment(row.classId, row.subjectId) }); }
  for (const cls of input.exams.attentionClasses ?? []) {
    const subject = cls.subjects[0];
    if (!subject || !checkScope(cls.classId, subject.subjectId)) continue;
    const reviewWindow = ["NOT_CONFIGURED", "NEEDS_REVIEW", "CLOSED"].includes(cls.state);
    const detail = ["NOT_CONFIGURED", "NEEDS_REVIEW"].includes(cls.state) ? cls.label
      : `${subject.missing} exam entries remaining${subject.invalid ? ` · ${subject.invalid} invalid entries` : ""} · ${cls.state === "OPEN" ? "Entry window open" : cls.state === "CLOSED" ? "Closed; review required" : "Exam entry not started"}`;
    add({ classId: cls.classId, title: `${subject.subjectName} · Exam entry`, detail, teacherName: teacherName(cls.classId, subject.subjectId),
      lane: "Exam Entry", priority: cls.state === "NEEDS_REVIEW" || subject.invalid > 0 ? 0 : cls.state === "CLOSED" ? 2 : cls.state === "NOT_CONFIGURED" ? 3 : 5,
      action: reviewWindow ? "Review reports" : "Review assessment", href: reviewWindow ? `/list/report-cards?${new URLSearchParams({ classId: String(cls.classId), year: input.period.academicYear, term: input.period.term })}` : assessment(cls.classId, subject.subjectId) });
  }
  for (const cls of input.reports.attentionClasses) {
    const position = cls.position;
    if (position.phase === "PREPARATION" || position.workflowState === "PUBLISHED" && !position.needsReconciliation) continue;
    const subject = cls.blockingSubjects[0];
    if (subject && !checkScope(cls.classId, subject.subjectId)) continue;
    add({ classId: cls.classId, title: subject ? `${subject.subjectName} · Report evidence` : "Class reports",
      detail: position.workflowState === "AWAITING_ADMIN_REVIEW" && position.releaseReady ? "Complete evidence · Awaiting admin review"
        : position.canSubmitForReview ? "Complete evidence · Not submitted for review"
          : subject ? `${subject.affectedEntries} subject entries require complete evidence`
            : position.remainingEntries ? `${position.remainingEntries} class report entries require complete evidence` : position.releaseBlockers[0] ?? "Report release requires review",
      teacherName: subject ? teacherName(cls.classId, subject.subjectId) : null, lane: "Report Release",
      priority: position.needsReconciliation ? 0 : position.workflowState === "AWAITING_ADMIN_REVIEW" ? 2 : position.canSubmitForReview ? 3 : 6,
      action: "Review reports",
      href: `/list/report-cards?${new URLSearchParams({ classId: String(cls.classId), year: input.period.academicYear, term: input.period.term })}` });
  }
  rows.sort((a, b) => a.priority - b.priority || a.classId - b.classId || a.title.localeCompare(b.title));
  const uniqueClasses = new Map<number, AcademicAttentionRow>();
  for (const row of rows) if (!uniqueClasses.has(row.classId)) uniqueClasses.set(row.classId, row);
  return { rows: [...uniqueClasses.values()].slice(0, 5), totalClasses: uniqueClasses.size, listLimit: 5 };
}
