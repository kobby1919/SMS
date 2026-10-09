import Link from "next/link";
import { Fragment } from "react";
import { ChevronLeft, ChevronRight, Search, SlidersHorizontal } from "lucide-react";
import { getAdminAssessmentReview } from "@/src/lib/queries/admin-assessment-review";
import AssessmentReviewFilters from "@/src/components/AssessmentReviewFilters";

const mark = (value: number | null | undefined) => value == null ? "Not recorded" : !Number.isFinite(value) ? "Needs review" : value.toLocaleString("en-GH", { maximumFractionDigits: 2 });
const termLabel = (value: string) => value.replace("TERM_", "Term ");
const dateLabel = (value: Date | null) => value ? value.toLocaleString("en-GH", { timeZone: "Africa/Accra", dateStyle: "medium", timeStyle: "short" }) : "No score recorded";
type Row = Awaited<ReturnType<typeof getAdminAssessmentReview>>["rows"][number];

function Evidence({ row }: { row: Row }) {
  if (row.position.status === "Needs review") return <p className="mt-3 text-sm text-amber-800">Score data requires review before this result can be used.</p>;
  return <details className="mt-3 border-t border-gray-100 pt-3">
    <summary className="cursor-pointer text-sm font-semibold text-blue-800">Activity scores</summary>
    <div className="mt-3 space-y-4">
      {row.progress.buckets.length === 0 && <p className="text-sm text-gray-500">No CA structure has been recorded for this subject.</p>}
      {row.progress.buckets.map((bucket) => <section key={bucket.bucketId}>
        <h3 className="break-words text-sm font-semibold text-gray-900">{bucket.name}</h3>
        <p className="mt-1 text-xs text-gray-600">{mark(bucket.earnedMarks)} / {mark(bucket.allocationMarks)} CA marks · {bucket.aggregationMode === "AVERAGE_TO_BUCKET" ? "Average of recorded activities" : "Sum of activity contributions"}</p>
        {bucket.activities.length === 0 && <p className="mt-2 text-sm text-gray-500">No activities have taken place yet.</p>}
        <ul className="mt-2 divide-y divide-gray-100">
          {bucket.activities.map((activity) => <li key={activity.id} className="flex flex-col gap-1 py-2 text-sm sm:flex-row sm:justify-between sm:gap-4">
            <div className="min-w-0"><p className="break-words font-medium">{activity.title}</p><p className="break-words text-xs text-gray-500">{activity.teacherName} · {activity.activityDate.toLocaleDateString("en-GH", { timeZone: "Africa/Accra" })}</p></div>
            <div className="shrink-0 text-gray-700 sm:text-right"><p>{activity.rawScore === null ? "Not recorded" : `${mark(activity.rawScore)} / ${mark(activity.rawMaxScore)}`}</p><p className="text-xs text-gray-500">{activity.earnedMarks === null ? "Contribution pending" : `${mark(activity.earnedMarks)} ${bucket.aggregationMode === "AVERAGE_TO_BUCKET" ? "before bucket averaging" : "CA contribution"}`}</p></div>
          </li>)}
        </ul>
      </section>)}
    </div>
  </details>;
}

export default async function AdminAssessmentReview({ params }: { params: Record<string, string | string[] | undefined> }) {
  const data = await getAdminAssessmentReview(params);
  const selectedSubject = data.subjects.find((subject) => subject.id === data.subjectId);
  const inputClass = "min-h-11 w-full min-w-0 rounded-lg border border-gray-300 bg-white px-3 text-sm font-semibold text-gray-900";
  function pageHref(page: number) {
    const query = new URLSearchParams({ year: data.year, term: data.term, page: String(page) });
    if (data.classId !== undefined) query.set("classId", String(data.classId));
    if (data.subjectId !== undefined) query.set("subjectId", String(data.subjectId));
    if (data.search) query.set("search", data.search);
    return `/list/ca?${query}`;
  }
  return <main className="m-3 mt-0 min-w-0 flex-1 bg-white p-4 font-nunito text-sm font-semibold text-gray-700 sm:m-4 sm:mt-0 sm:p-5">
    <header className="border-b border-gray-200 pb-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h1 className="text-xl font-black text-gray-950">Assessments</h1><p className="mt-2 text-sm font-medium leading-6 text-gray-600">{termLabel(data.term)} · {data.year}</p></div>
        <Link href="/admin/ca-config" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-blue-800"><SlidersHorizontal size={16} /> Assessment settings</Link>
      </div>
      <AssessmentReviewFilters>
        <label className="min-w-0 text-xs font-semibold text-gray-600">Academic year<select name="year" defaultValue={data.year} className={`${inputClass} mt-1`}>
          {[...new Set([data.year, ...data.configs.map((config) => config.academicYear)])].map((year) => <option key={year}>{year}</option>)}
        </select></label>
        <label className="min-w-0 text-xs font-semibold text-gray-600">Term<select name="term" defaultValue={data.term} className={`${inputClass} mt-1`}>{["TERM_1", "TERM_2", "TERM_3"].map((term) => <option key={term} value={term}>{termLabel(term)}</option>)}</select></label>
        <label className="min-w-0 text-xs font-semibold text-gray-600">Class<select name="classId" defaultValue={data.classId ?? ""} className={`${inputClass} mt-1`}><option value="">Select class</option>{data.classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label className="min-w-0 text-xs font-semibold text-gray-600">Subject<select name="subjectId" defaultValue={data.subjectId ?? ""} className={`${inputClass} mt-1`}><option value="">Select subject</option>{data.subjects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label className="min-w-0 text-xs font-semibold text-gray-600">Student or admission number<input name="search" defaultValue={data.search} maxLength={100} className={`${inputClass} mt-1`} /></label>
        <div className="flex items-end"><button type="submit" className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-blue-900 px-4 text-sm font-semibold text-white"><Search size={16} /> Review</button></div>
      </AssessmentReviewFilters>
    </header>
    {data.error ? <p role="alert" className="my-5 border-l-4 border-amber-500 bg-amber-50 p-4 text-sm text-amber-900">{data.error}</p> : data.classes.length === 0 ? <p className="py-8 text-sm text-gray-600">No classes have been created yet.</p> : !selectedSubject ? <p className="py-8 text-sm text-gray-600">No subjects are available for this class and period. Current-term subjects appear after the timetable is published.</p> : <>
      <section className="border-b border-gray-200 py-4">
        <h2 className="break-words text-sm font-black text-gray-950">{data.classes.find((item) => item.id === data.classId)?.name} · {selectedSubject.name}</h2>
        <p className="mt-1 break-words text-sm text-gray-600">{data.teacherNames.length ? `Assigned teacher: ${data.teacherNames.join(", ")}` : "Teacher names appear in the activity history."}</p>
        <p className="mt-2 text-xs text-gray-500">CA maximum: {mark(data.config?.classworkWeight)} · Exam maximum: {mark(data.config?.examWeight)} · {data.count} matching students</p>
        <p className="mt-2 text-xs text-gray-500">{data.config?.examWeight === 0 ? "No exam component is required." : "Exam zero: entry not confirmed. Partial totals are not final results."} Future activities are excluded.</p>
        <p className="mt-1 text-xs text-gray-500">{data.currentPeriod ? "Active students in this class." : "Students with assessment records for this class and period, including those who have moved class."} Activity completeness is not an overdue-duty count.</p>
      </section>
      {data.rows.length === 0 ? <p className="py-8 text-sm text-gray-600">No students match this selection.</p> : <>
        <div className="hidden xl:block">
          <table className="w-full table-fixed text-left text-sm"><thead className="border-b border-gray-200 text-xs text-gray-600"><tr>{["Student", "CA", "Scored / expected so far", "Exam", "Overall", "Status", "Last update"].map((heading) => <th key={heading} className={`py-3 pr-3 ${heading === "Student" ? "w-1/4" : ""}`}>{heading}</th>)}</tr></thead>
            <tbody>{data.rows.map((row) => <Fragment key={row.student.id}><tr className="align-top">
              <td className="py-4 pr-3"><p className="break-words font-semibold">{row.student.name} {row.student.surname}</p><p className="mt-1 break-words text-xs text-gray-500">{row.student.admissionNumber ?? "No admission number"}</p></td>
              <td className="py-4 pr-3">{row.position.ca === null ? "Not recorded" : `${mark(row.position.ca)} / ${mark(data.config?.classworkWeight)}`}</td>
              <td className="py-4 pr-3">{row.position.scored} / {row.position.expected}</td>
              <td className="py-4 pr-3">{data.config?.examWeight === 0 ? "Not required" : row.position.examConfirmed ? mark(row.examScore) : "Unconfirmed"}</td>
              <td className="py-4 pr-3">{row.position.total === null ? "Incomplete" : mark(row.position.total)}</td>
              <td className="py-4 pr-3"><span className={row.position.status === "Complete" ? "font-medium text-emerald-800" : "font-medium text-amber-800"}>{row.position.status}</span></td>
              <td className="break-words py-4 text-xs text-gray-500">{dateLabel(row.updatedAt)}</td>
            </tr><tr className="border-b border-gray-100"><td colSpan={7} className="pb-4"><Evidence row={row} /></td></tr></Fragment>)}</tbody>
          </table>
        </div>
        <div className="divide-y divide-gray-200 xl:hidden">{data.rows.map((row) => <section key={row.student.id} className="py-5">
          <h3 className="break-words text-sm font-semibold text-gray-900">{row.student.name} {row.student.surname}</h3><p className="mt-1 break-words text-xs text-gray-500">{row.student.admissionNumber ?? "No admission number"} · {row.position.status}</p>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">{[
            ["CA", row.position.ca === null ? "Not recorded" : `${mark(row.position.ca)} / ${mark(data.config?.classworkWeight)}`],
            ["Activities scored", `${row.position.scored} / ${row.position.expected}`],
            ["Exam", data.config?.examWeight === 0 ? "Not required" : row.position.examConfirmed ? mark(row.examScore) : "Unconfirmed"],
            ["Overall", row.position.total === null ? "Incomplete" : mark(row.position.total)],
          ].map(([label, value]) => <div key={label} className="min-w-0"><dt className="text-xs text-gray-500">{label}</dt><dd className="mt-1 break-words font-medium">{value}</dd></div>)}</dl>
          <p className="mt-3 text-xs text-gray-500">Last update: {dateLabel(row.updatedAt)}</p><Evidence row={row} />
        </section>)}</div>
      </>}
      <nav aria-label="Assessment pages" className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 py-4 text-sm">
        <span className="text-gray-600">Page {data.page} of {data.pageCount}</span><div className="flex gap-4">
          {data.page > 1 && <Link className="inline-flex min-h-11 items-center gap-1 text-blue-800" href={pageHref(data.page - 1)}><ChevronLeft size={16} /> Previous</Link>}
          {data.page < data.pageCount && <Link className="inline-flex min-h-11 items-center gap-1 text-blue-800" href={pageHref(data.page + 1)}>Next <ChevronRight size={16} /></Link>}
        </div>
      </nav>
    </>}
  </main>;
}
