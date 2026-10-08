import Link from "next/link";
import { ArrowRight, ClipboardCheck, MessageSquareWarning, PencilLine } from "lucide-react";
import type { AdminTeacherAccountabilitySnapshot } from "@/src/lib/services/admin-teacher-accountability";

export default function AdminTeacherAccountability({ snapshot }: { snapshot: AdminTeacherAccountabilitySnapshot }) {
  const metrics = [
    { label: "Overdue duties", value: snapshot.totals.overdue, icon: ClipboardCheck },
    { label: "Open escalations", value: snapshot.totals.escalations, icon: MessageSquareWarning },
    { label: "Correction requests", value: snapshot.totals.corrections, icon: PencilLine },
  ];
  return (
    <section aria-labelledby="teacher-follow-up-heading" className="min-w-0 border-t border-gray-200 bg-white p-4 sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h2 id="teacher-follow-up-heading" className="text-xl font-black text-gray-950">Teacher Accountability</h2>
          <p className="mt-2 text-sm font-medium leading-6 text-gray-600">Support and follow-up on outstanding work.</p>
        </div>
        <Link href="/admin/accountability/follow-up" className="inline-flex w-fit shrink-0 items-center justify-center gap-2 rounded-lg border border-gray-200 px-4 py-2.5 text-xs font-black text-gray-700 transition hover:bg-gray-50">
          View all follow-ups <ArrowRight size={14} aria-hidden="true" />
        </Link>
      </div>
      <div className="my-4 grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-3">
        {metrics.map(({ label, value, icon: Icon }) => (
          <div key={label} className="min-w-0 rounded-lg border border-gray-200 bg-gray-50 p-3">
            <div className="mb-2 flex items-start gap-2 text-[10px] font-black uppercase text-gray-500"><Icon className="shrink-0" size={14} aria-hidden="true" /><span className="break-words">{label}</span></div>
            <p className="break-all text-xl font-black leading-tight tabular-nums text-gray-950 sm:text-2xl">{value.toLocaleString("en-GH")}</p>
          </div>
        ))}
      </div>
      {snapshot.notes.length > 0 && <ul className="mb-4 space-y-1 border-l-2 border-amber-400 pl-3 text-xs font-semibold leading-5 text-gray-700">{snapshot.notes.map((note) => <li key={note}>{note}</li>)}</ul>}
      <h3 className="mb-2 text-sm font-black text-gray-950">Teachers Needing Follow-Up</h3>
      {snapshot.followUps.length === 0 ? (
        <p className="py-4 text-sm font-semibold leading-6 text-gray-600">{snapshot.notes.length ? "No follow-ups found in the records that can currently be evaluated." : "No overdue duties, open escalations or pending corrections."}</p>
      ) : (
        <ul className="divide-y divide-gray-200">
          {snapshot.followUps.map((teacher) => (
            <li key={teacher.teacherId} className="flex min-w-0 flex-wrap items-center justify-between gap-3 py-4">
              <div className="min-w-0 flex-1 basis-48">
                <p className="break-words text-sm font-black text-gray-950">{teacher.teacherName}</p>
                <p className="mt-1 break-words text-xs font-semibold leading-5 text-gray-600">
                  {[teacher.attendance && `${teacher.attendance} attendance`, teacher.homework && `${teacher.homework} homework checks`, teacher.ca && `${teacher.ca} CA publications`, teacher.escalations && `${teacher.escalations} open escalations`, teacher.corrections && `${teacher.corrections} corrections`].filter(Boolean).join(" · ")}
                </p>
                <p className="mt-1 text-xs font-semibold text-gray-500">Oldest follow-up: {new Date(teacher.oldestAt).toLocaleDateString("en-GH", { timeZone: "Africa/Accra", day: "numeric", month: "short", year: "numeric" })}</p>
              </div>
              <Link href={teacher.href} aria-label={`Review follow-ups for ${teacher.teacherName}`} className="inline-flex shrink-0 items-center gap-2 text-xs font-black text-blue-700">Review <ArrowRight size={14} aria-hidden="true" /></Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
