import Link from "next/link";
import type { getAdminReportReview } from "@/src/lib/queries/admin-report-review";
import ReportPublicationControls from "@/src/components/ReportPublicationControls";
import ExamEntryWindowControls from "@/src/components/ExamEntryWindowControls";
type Data = Awaited<ReturnType<typeof getAdminReportReview>>;

export default function AdminReportReview({ data }: { data: Data }) {
  const readiness = data.readiness;
  const publicationBlockReason = readiness?.examRequired && data.examStatus === "LOCKED" ? "Exam entry has not been opened for this class period. Configure the window before a new submission; return an already-submitted set if it needs changes." : null;
  const stage = data.publication?.status === "PUBLISHED" ? "Published" : data.publication?.status === "SUBMITTED" ? "Awaiting review" : readiness?.isReady ? "Ready" : "Incomplete";
  const field = "mt-1 min-h-11 w-full min-w-0 rounded-md border border-gray-200 bg-white px-3 text-sm font-semibold";
  function pageHref(page: number) { const q = new URLSearchParams({ year: data.year, term: data.term, page: String(page) }); if (data.classId !== undefined) q.set("classId", String(data.classId)); return `/list/report-cards?${q}`; }
  return <main className="m-3 mt-0 min-w-0 flex-1 space-y-5 bg-white p-4 font-nunito text-sm font-semibold text-gray-700 sm:m-4 sm:mt-0 sm:p-5">
    <header><h1 className="text-xl font-black text-gray-950">Reports &amp; Approval</h1><p className="mt-1 text-sm font-medium text-gray-600">Class readiness, assessment gaps and release decisions.</p></header>
    <form className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <label className="min-w-0 text-xs font-bold">Academic year<select name="year" defaultValue={data.year} className={field}><option value="" disabled>Select year</option>{data.configs.map((config) => <option key={config.academicYear} value={config.academicYear}>{config.academicYear}</option>)}</select></label>
      <label className="min-w-0 text-xs font-bold">Term<select name="term" defaultValue={data.term} className={field}>{["TERM_1", "TERM_2", "TERM_3"].map((term) => <option key={term} value={term}>{term.replace("TERM_", "Term ")}</option>)}</select></label>
      <label className="min-w-0 text-xs font-bold">Class<select name="classId" defaultValue={data.classId ?? ""} className={field}><option value="" disabled>Select class</option>{data.classes.map((cls) => <option key={cls.id} value={cls.id}>{cls.name}</option>)}</select></label>
      <button className="min-h-11 rounded-md bg-gray-900 px-4 font-bold text-white">Review</button>
    </form>
    {data.error ? <p role="alert" className="border-l-2 border-rose-300 pl-3 text-rose-800">{data.error}</p> : !readiness ? <section className="border-t border-gray-200 pt-4"><p>No class report records can be reviewed yet.</p><div className="mt-3 flex flex-wrap gap-4"><Link className="text-blue-800 underline" href="/list/classes">Review classes</Link><Link className="text-blue-800 underline" href="/admin/ca-config">Assessment settings</Link></div></section> : <>
      {!readiness.currentPeriod ? <p className="border-l-2 border-gray-200 pl-3 text-gray-600">Historical review uses recorded students and subjects, not today&apos;s timetable or a reconstructed original roster. New submission and publication are restricted to the active period.</p> : null}
      <section className="border-t border-gray-200 pt-4"><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-base font-black text-gray-950">{data.classes.find((cls) => cls.id === data.classId)?.name}</h2><span className="rounded bg-gray-100 px-3 py-1 text-xs font-bold">{stage}</span></div>
        <dl className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">{[["Students", readiness.studentCount], ["Subjects", readiness.subjectCount], ["Ready entries", `${readiness.readyEntryCount}/${readiness.expectedEntryCount}`], ["Ready students", `${readiness.readyStudentCount}/${readiness.studentCount}`]].map(([label, value]) => <div key={label} className="min-w-0 border-l-2 border-gray-200 pl-3"><dt className="break-words text-xs text-gray-500">{label}</dt><dd className="mt-1 break-words text-xl font-black text-gray-950">{value}</dd></div>)}</dl>
        {data.publication?.status === "PUBLISHED" && !readiness.isReady ? <p className="mt-3 text-amber-800">This report set is published, but its current evidence needs review. Publication status does not erase assessment gaps.</p> : null}
        {data.publication?.status === "SUBMITTED" && !readiness.isReady ? <p className="mt-3 text-amber-800">This set is awaiting review but has incomplete evidence. Publishing is blocked.</p> : null}
        {readiness.issues.map((issue) => <p key={issue} className="mt-2 text-amber-800">{issue}</p>)}
        {readiness.issues.length ? <div className="mt-3 flex flex-wrap gap-4"><Link className="text-blue-800 underline" href="/admin/timetable">Review timetable</Link><Link className="text-blue-800 underline" href="/admin/ca-config">Assessment settings</Link></div> : null}
      </section>
      {data.classId !== undefined ? <ReportPublicationControls classId={data.classId} term={data.term} academicYear={data.year} status={data.publication?.status ?? "UNSUBMITTED"} role="admin" canSubmit={readiness.currentPeriod && readiness.isReady} missingCount={readiness.missingCount} missingCACount={readiness.missingCACount} missingExamCount={readiness.missingExamCount} studentCount={readiness.studentCount} subjectCount={readiness.subjectCount} submittedAt={data.publication?.submittedAt} submittedBy={data.submittedByName} reviewNote={data.publication?.reviewNote} updatedAt={data.publication?.updatedAt} publicationBlockReason={data.publication?.status === "PUBLISHED" ? null : publicationBlockReason} /> : null}
      {data.classId !== undefined && readiness.currentPeriod && readiness.examRequired && !["SUBMITTED", "PUBLISHED"].includes(data.publication?.status ?? "") ? <ExamEntryWindowControls classId={data.classId} className={data.classes.find((cls) => cls.id === data.classId)?.name ?? "Class"} term={data.term} academicYear={data.year} status={data.examStatus} role="admin" /> : null}
      <section className="border-t border-gray-200 pt-4"><h2 className="text-base font-black text-gray-950">Entries needing attention</h2><p className="mt-1 text-xs text-gray-500">{readiness.missingCount} student-subject entries are blocked. Assessment links are read-only.</p>
        <div className="mt-3 divide-y divide-gray-100">{data.rows.map((row) => {
          const q = new URLSearchParams({ classId: String(data.classId), subjectId: String(row.subjectId), year: data.year, term: data.term, studentId: row.studentId, view: "summary" });
          return <div key={`${row.studentId}:${row.subjectId}`} className="grid min-w-0 gap-2 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"><div className="min-w-0"><p className="break-words font-bold text-gray-950">{row.studentName} · {row.subjectName}</p><p className="mt-1 break-words text-xs text-gray-600">{row.detail}</p></div><Link className="text-xs font-bold text-blue-800 underline" href={`/list/ca?${q}`}>Review assessment</Link></div>;
        })}</div>
        {!data.rows.length ? <p className="py-3 text-gray-500">{readiness.isReady ? "Every recorded student-subject entry is complete. Readiness does not mean reports have been published." : "Resolve the issues above before this report set can be released."}</p> : null}
        {data.pageCount > 1 ? <nav aria-label="Blocked entry pages" className="mt-3 flex flex-wrap gap-4 text-xs font-bold">{data.page > 1 ? <Link href={pageHref(data.page - 1)}>Previous</Link> : null}<span>Page {data.page} of {data.pageCount}</span>{data.page < data.pageCount ? <Link href={pageHref(data.page + 1)}>Next</Link> : null}</nav> : null}
      </section>
      <section className="border-t border-gray-200 pt-4"><h2 className="text-base font-black text-gray-950">Release history</h2><div className="mt-2 divide-y divide-gray-100">{data.audit.map((item) => <div key={item.id} className="py-2"><p className="break-words text-xs text-gray-700">{item.message}</p><p className="mt-1 text-xs text-gray-500">{item.createdAt.toLocaleString("en-GH", { timeZone: "Africa/Accra", dateStyle: "medium", timeStyle: "short" })}</p></div>)}</div>{!data.audit.length ? <p className="py-3 text-gray-500">No recorded release actions for this class period.</p> : <p className="mt-2 text-xs text-gray-500">Latest 10 recorded actions.</p>}</section>
    </>}
  </main>;
}
