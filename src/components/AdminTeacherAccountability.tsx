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
    <section aria-labelledby="teacher-follow-up-heading" className="min-w-0 border-t border-gray-200 pt-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="teacher-follow-up-heading" className="text-lg font-semibold text-gray-900">Teacher accountability</h2>
          <p className="mt-1 text-sm text-gray-600">Support and follow-up on outstanding work.</p>
        </div>
        <Link href="/admin/accountability/follow-up" className="inline-flex items-center gap-2 text-sm font-medium text-blue-800">
          View all follow-ups <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </div>
      <div className="my-4 grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-3">
        {metrics.map(({ label, value, icon: Icon }) => (
          <div key={label} className="min-w-0 rounded-lg border border-gray-200 bg-white p-4">
            <div className="flex items-start justify-between gap-2"><span className="break-words text-sm text-gray-600">{label}</span><Icon className="shrink-0 text-gray-500" size={18} aria-hidden="true" /></div>
            <p className="mt-2 break-all text-2xl font-semibold tabular-nums text-gray-900">{value.toLocaleString("en-GH")}</p>
          </div>
        ))}
      </div>
      {snapshot.notes.length > 0 && <ul className="mb-4 space-y-1 border-l-2 border-amber-400 pl-3 text-sm text-gray-700">{snapshot.notes.map((note) => <li key={note}>{note}</li>)}</ul>}
      <h3 className="mb-2 text-sm font-semibold text-gray-900">Teachers needing follow-up</h3>
      {snapshot.followUps.length === 0 ? (
        <p className="py-4 text-sm text-gray-600">{snapshot.notes.length ? "No follow-ups found in the records that can currently be evaluated." : "No overdue duties, open escalations or pending corrections."}</p>
      ) : (
        <ul className="divide-y divide-gray-200">
          {snapshot.followUps.map((teacher) => (
            <li key={teacher.teacherId} className="flex min-w-0 flex-wrap items-center justify-between gap-3 py-4">
              <div className="min-w-0 flex-1 basis-48">
                <p className="break-words font-medium text-gray-900">{teacher.teacherName}</p>
                <p className="mt-1 break-words text-sm text-gray-600">
                  {[teacher.attendance && `${teacher.attendance} attendance`, teacher.homework && `${teacher.homework} homework checks`, teacher.ca && `${teacher.ca} CA publications`, teacher.escalations && `${teacher.escalations} open escalations`, teacher.corrections && `${teacher.corrections} corrections`].filter(Boolean).join(" · ")}
                </p>
                <p className="mt-1 text-xs text-gray-500">Oldest follow-up: {new Date(teacher.oldestAt).toLocaleDateString("en-GH", { timeZone: "Africa/Accra", day: "numeric", month: "short", year: "numeric" })}</p>
              </div>
              <Link href={teacher.href} aria-label={`Review follow-ups for ${teacher.teacherName}`} className="inline-flex shrink-0 items-center gap-2 text-sm font-medium text-blue-800">Review <ArrowRight size={16} aria-hidden="true" /></Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
