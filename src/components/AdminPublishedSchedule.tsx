import Link from "next/link";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";
import { getAdminPublishedSchedule } from "@/src/lib/queries/admin-published-schedule";
import { dateTimeToTimeString } from "@/src/lib/services/school-operating-hours";

const dayLabel = (day: string) => day.charAt(0) + day.slice(1).toLowerCase();

export default async function AdminPublishedSchedule({ params }: { params: Record<string, string | string[] | undefined> }) {
  const data = await getAdminPublishedSchedule(params);
  const field = "mt-1 min-h-11 w-full min-w-0 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900";
  const href = (page: number) => {
    const query = new URLSearchParams({ view: "published", page: String(page) });
    for (const [key, value] of Object.entries(data.selection)) if (key !== "page" && value !== undefined) query.set(key, String(value));
    return `/admin/timetable?${query}`;
  };
  return <section className="min-w-0 bg-white p-4 sm:p-6">
    <header className="border-b border-gray-200 pb-4"><h2 className="text-lg font-bold text-gray-900">Published schedule</h2>
      <p className="mt-1 text-sm text-gray-600">{data.publication ? `Version ${data.publication.version} · Published ${data.publication.publishedAt.toLocaleString("en-GH", { timeZone: "Africa/Accra", dateStyle: "medium", timeStyle: "short" })} · ${data.totalLessons} lesson slots` : "No timetable has been published."}</p>
    </header>
    {!data.publication ? <div className="py-8"><p className="text-sm text-gray-600">Published lessons are not available yet.</p><Link href="/admin/timetable" className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-blue-800">Open draft timetable</Link></div> : <>
      {(data.uncoveredClasses.length > 0 || data.unavailableTeachers.length > 0) && <div className="space-y-3 border-b border-gray-200 py-4">
        {data.uncoveredClasses.length > 0 && <div><h3 className="text-sm font-semibold text-amber-900">Classes with active students but no published lessons ({data.uncoveredClasses.length})</h3><p className="mt-1 break-words text-sm text-gray-600">{data.uncoveredClasses.map((cls) => cls.name).join(", ")}</p></div>}
        {data.unavailableTeachers.length > 0 && <div><h3 className="text-sm font-semibold text-rose-800">Published teachers without active access ({data.unavailableTeachers.length})</h3><ul className="mt-1 flex flex-wrap gap-x-4 gap-y-2 text-sm text-blue-800">{data.unavailableTeachers.map((teacher) => <li key={teacher.id}><Link href={`/list/teachers/${encodeURIComponent(teacher.id)}`}>{teacher.name}</Link></li>)}</ul></div>}
      </div>}
      <form action="/admin/timetable" className="grid min-w-0 grid-cols-1 gap-3 border-b border-gray-200 py-4 sm:grid-cols-2 xl:grid-cols-5">
        <input type="hidden" name="view" value="published" />
        <label className="min-w-0 text-xs font-semibold text-gray-600">Class<select name="classId" defaultValue={data.selection.classId ?? ""} className={field}><option value="">All classes</option>{data.classes.map((cls) => <option key={cls.id} value={cls.id}>{cls.name}</option>)}</select></label>
        <label className="min-w-0 text-xs font-semibold text-gray-600">Teacher<select name="teacherId" defaultValue={data.selection.teacherId ?? ""} className={field}><option value="">All teachers</option>{data.teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.name}</option>)}</select></label>
        <label className="min-w-0 text-xs font-semibold text-gray-600">Day<select name="day" defaultValue={data.selection.day ?? ""} className={field}><option value="">All days</option>{data.days.map((day) => <option key={day} value={day}>{dayLabel(day)}</option>)}</select></label>
        <label className="min-w-0 text-xs font-semibold text-gray-600">Search<input name="search" maxLength={100} defaultValue={data.selection.search ?? ""} className={field} /></label>
        <div className="flex items-end"><button className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-blue-900 px-3 text-sm font-semibold text-white"><Search size={16} /> Review</button></div>
      </form>
      {data.error && <p role="alert" className="py-4 text-sm text-amber-900">{data.error}</p>}
      {!data.error && data.lessons.length === 0 && <p className="py-8 text-sm text-gray-600">No published lessons match these filters.</p>}
      <div className="hidden xl:block"><table className="w-full table-fixed text-left text-sm"><thead className="border-b border-gray-200 text-xs text-gray-600"><tr>{["Day", "Time", "Class", "Subject", "Teacher"].map((label) => <th className="py-3 pr-3" key={label}>{label}</th>)}</tr></thead><tbody>{data.lessons.map((lesson) => <tr key={lesson.id} className="border-b border-gray-100"><td className="py-4 pr-3">{dayLabel(lesson.day)}</td><td className="py-4 pr-3">{dateTimeToTimeString(lesson.startTime)} - {dateTimeToTimeString(lesson.endTime)}</td><td className="break-words py-4 pr-3">{lesson.className}</td><td className="break-words py-4 pr-3">{lesson.subjectName}</td><td className="break-words py-4">{lesson.teacherName}</td></tr>)}</tbody></table></div>
      <div className="divide-y divide-gray-200 xl:hidden">{data.lessons.map((lesson) => <article key={lesson.id} className="py-4"><h3 className="break-words text-sm font-semibold text-gray-900">{lesson.className} · {lesson.subjectName}</h3><p className="mt-1 text-sm text-gray-600">{dayLabel(lesson.day)} · {dateTimeToTimeString(lesson.startTime)} - {dateTimeToTimeString(lesson.endTime)}</p><p className="mt-1 break-words text-sm text-gray-600">{lesson.teacherName}</p></article>)}</div>
      <nav aria-label="Published schedule pages" className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 py-4 text-sm"><span className="text-gray-600">{data.count} matching lessons · Page {data.page} of {data.pageCount}</span><div className="flex gap-4">{data.page > 1 && <Link className="inline-flex min-h-11 items-center gap-1 text-blue-800" href={href(data.page - 1)}><ChevronLeft size={16} /> Previous</Link>}{data.page < data.pageCount && <Link className="inline-flex min-h-11 items-center gap-1 text-blue-800" href={href(data.page + 1)}>Next <ChevronRight size={16} /></Link>}</div></nav>
    </>}
  </section>;
}
