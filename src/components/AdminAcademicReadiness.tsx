import Link from "next/link";
import { ArrowRight, BookOpenCheck, ClipboardList, FileCheck2 } from "lucide-react";
import type { getAdminAcademicReadinessSnapshot } from "@/src/lib/services/admin-academic-readiness";

type Snapshot = Awaited<ReturnType<typeof getAdminAcademicReadinessSnapshot>>;
const number = (value: number) => value.toLocaleString("en-GH");

export default function AdminAcademicReadiness({ snapshot }: { snapshot: Snapshot }) {
  const ca = snapshot.caRecording?.totals;
  const exams = snapshot.examTracking?.totals;
  const reports = snapshot.finalReports?.totals;
  const setupIssues = [...new Set([...snapshot.issues, ...(snapshot.caRecording?.issues ?? []), ...(snapshot.examTracking?.issues ?? [])])];
  const setupHref = snapshot.code === "NO_ELIGIBLE_STUDENTS" ? "/list/students" : snapshot.period ? "/admin/timetable" : "/admin/ca-config";
  return <section aria-labelledby="academic-readiness-heading" className="min-w-0 border-t border-gray-200 bg-white p-4 font-inter sm:p-5">
    <header className="flex min-w-0 flex-col gap-2">
      <h2 id="academic-readiness-heading" className="text-xl font-black text-gray-950">Academic Readiness</h2>
      <p className="break-words text-sm font-semibold text-gray-700">{snapshot.period ? `${snapshot.period.academicYear} · ${snapshot.period.term.replace("TERM_", "Term ")}` : snapshot.state === "UNAVAILABLE" ? "Academic period unavailable" : "Active academic period not configured"}</p>
      <p className="break-words text-xs font-medium leading-5 text-gray-600" role="status">{setupIssues.length ? setupIssues[0] : "Published teaching scope and academic tracking configured."}</p>
      {snapshot.state === "SETUP_REQUIRED" && <Link className="inline-flex min-h-10 w-fit items-center gap-2 text-xs font-black text-blue-700" href={setupHref}>Review setup <ArrowRight size={14} aria-hidden="true" /></Link>}
    </header>
    <div className="my-5 grid min-w-0 grid-cols-1 gap-5 lg:grid-cols-3">
      <div className="min-w-0 border-l-2 border-blue-200 pl-3">
        <h3 className="flex items-center gap-2 text-sm font-black text-gray-950"><BookOpenCheck size={16} aria-hidden="true" /> CA Recording</h3>
        {snapshot.period?.classworkWeight === 0 ? <p className="mt-3 text-sm text-gray-600">CA not required for this period.</p> : !ca ? <p className="mt-3 text-sm text-gray-600">CA tracking unavailable.</p> : <>
          <p className="mt-3 break-words text-xl font-black tabular-nums text-gray-950">{number(ca.scoresRemaining)} <span className="text-sm font-semibold text-gray-600">scores remaining</span></p>
          <p className="mt-2 break-words text-xs font-semibold leading-5 text-gray-600">{number(ca.scoresRecorded)} / {number(ca.scoresRequired)} required activity scores recorded</p>
          <p className="mt-1 break-words text-xs font-semibold leading-5 text-gray-600">{ca.overdueActivities === null ? "Overdue tracking unavailable" : `${number(ca.overdueActivities)} activities with overdue scores`}</p>
          {ca.subjectsWithoutActivities > 0 && <p className="mt-1 text-xs leading-5 text-gray-600">{number(ca.subjectsWithoutActivities)} subjects have no CA activity yet</p>}
          {ca.subjectsWithIncompleteAllocation > 0 && <p className="mt-1 text-xs leading-5 text-gray-600">{number(ca.subjectsWithIncompleteAllocation)} subject allocations not yet fulfilled</p>}
          {ca.pendingScoreCorrections > 0 && <p className="mt-1 text-xs leading-5 text-gray-600">Score corrections awaiting review: {number(ca.pendingScoreCorrections)}</p>}
        </>}
      </div>
      <div className="min-w-0 border-l-2 border-teal-200 pl-3">
        <h3 className="flex items-center gap-2 text-sm font-black text-gray-950"><ClipboardList size={16} aria-hidden="true" /> Exam Entry</h3>
        {snapshot.period?.examWeight === 0 ? <p className="mt-3 text-sm text-gray-600">Exam entry not required for this period.</p> : !exams ? <p className="mt-3 text-sm text-gray-600">Exam tracking unavailable.</p> : <>
          <p className="mt-3 break-words text-xl font-black tabular-nums text-gray-950">{number(exams.recorded)} <span className="text-sm font-semibold text-gray-600">entries recorded</span></p>
          <p className="mt-2 text-xs font-semibold leading-5 text-gray-600">Open-window entries still to record: {number(exams.openMissingEntries)}</p>
          {exams.openInvalidEntries > 0 && <p className="mt-1 text-xs font-semibold leading-5 text-amber-800">Open-window invalid entries requiring review: {number(exams.openInvalidEntries)}</p>}
          {exams.unresolvedAfterClose > 0 && <p className="mt-1 text-xs font-semibold leading-5 text-amber-800">{number(exams.unresolvedAfterClose)} entries require review after closure</p>}
          <p className="mt-1 text-xs leading-5 text-gray-600">{number(exams.openClasses)} classes open · {number(exams.notOpenedClasses)} not started</p>
          {(exams.setupRequiredClasses > 0 || exams.windowReviewClasses > 0) && <p className="mt-1 text-xs leading-5 text-gray-600">{number(exams.setupRequiredClasses)} windows need setup · {number(exams.windowReviewClasses)} need review</p>}
        </>}
      </div>
      <div className="min-w-0 border-l-2 border-violet-200 pl-3">
        <h3 className="flex items-center gap-2 text-sm font-black text-gray-950"><FileCheck2 size={16} aria-hidden="true" /> Report Release</h3>
        {!reports ? <p className="mt-3 text-sm text-gray-600">Report readiness unavailable.</p> : <>
          <p className="mt-3 break-words text-xl font-black tabular-nums text-gray-950">{number(reports.awaitingReviewClasses)} <span className="text-sm font-semibold text-gray-600">awaiting admin review</span></p>
          <p className="mt-2 text-xs font-semibold leading-5 text-gray-600">{number(reports.readyToSubmitClasses)} ready for submission · {number(reports.publishedClasses)} published</p>
          <p className="mt-1 text-xs leading-5 text-gray-600">{reports.completionPercent === null ? "Report preparation in progress" : `${reports.completionPercent}% of evidence entries complete across ${number(reports.approachingReviewClasses)} classes approaching review`}</p>
          {reports.blockedReviewClasses > 0 && <p className="mt-1 text-xs font-semibold leading-5 text-amber-800">{number(reports.blockedReviewClasses)} review-stage classes have unresolved release checks</p>}
          {(reports.returnedClasses > 0 || reports.withdrawnClasses > 0) && <p className="mt-1 text-xs leading-5 text-gray-600">{number(reports.returnedClasses)} returned · {number(reports.withdrawnClasses)} withdrawn</p>}
        </>}
      </div>
    </div>
    <h3 className="text-sm font-black text-gray-950">Classes Needing Attention</h3>
    {!snapshot.attention?.rows.length ? <p className="py-4 text-sm font-medium leading-6 text-gray-600">{snapshot.attention ? "No outstanding class issues found in the academic records currently evaluated." : snapshot.state === "UNAVAILABLE" ? "Academic tracking is unavailable. Try refreshing shortly." : "Resolve academic setup to identify classes needing attention."}</p> : <>
      <ul className="mt-2 divide-y divide-gray-200">
        {snapshot.attention.rows.map((row) => <li key={row.classId} className="flex min-w-0 flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 flex-1">
            <p className="mb-1 text-xs font-semibold text-gray-500">{row.lane}</p>
            <h4 className="break-words text-sm font-black text-gray-950">{row.className} · {row.title}</h4>
            <p className="mt-1 break-words text-xs font-semibold leading-5 text-gray-600">{row.detail}</p>
            {row.teacherName && <p className="mt-1 break-words text-xs leading-5 text-gray-500">Assigned: {row.teacherName}</p>}
          </div>
          <Link href={row.href} aria-label={`${row.action}: ${row.className}, ${row.title}`} className="inline-flex min-h-10 w-fit max-w-full items-center gap-2 text-xs font-black text-blue-700 sm:shrink-0"><span className="break-words">{row.action}</span><ArrowRight size={14} className="shrink-0" aria-hidden="true" /></Link>
        </li>)}
      </ul>
      {snapshot.attention.totalClasses > 5 && <p className="mt-2 text-xs text-gray-500">Showing the highest-priority 5 of {number(snapshot.attention.totalClasses)} classes needing attention.</p>}
    </>}
  </section>;
}
