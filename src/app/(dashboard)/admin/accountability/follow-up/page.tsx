import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { z } from "zod";
import { requireCompletedAdminSchoolSetup, requirePageSession } from "@/src/lib/authz";
import { getAdminTeacherAccountability } from "@/src/lib/services/admin-teacher-accountability";

export const dynamic = "force-dynamic";
const paramsSchema = z.object({
  teacherId: z.string().trim().min(1).max(128).optional(),
  page: z.string().regex(/^[1-9]\d{0,5}$/).transform(Number).optional(),
});
const labels = { ATTENDANCE: "Overdue attendance", HOMEWORK_CHECKING: "Overdue homework checks", CA_SCORE_PUBLISHING: "Overdue CA publication", ESCALATION: "Escalation review", CORRECTION: "Correction review" };

export default async function TeacherFollowUpPage({ searchParams }: { searchParams: Promise<{ teacherId?: string; page?: string }> }) {
  const session = await requirePageSession(["admin"]);
  await requireCompletedAdminSchoolSetup(session);
  const parsed = paramsSchema.safeParse(await searchParams);
  if (!parsed.success) notFound();
  const { teacherId } = parsed.data;
  const snapshot = await getAdminTeacherAccountability(session.schoolId, new Date(), teacherId, true);
  const pageCount = Math.max(1, Math.ceil(snapshot.details.length / 50));
  const page = Math.min(parsed.data.page ?? 1, pageCount);
  const entries = snapshot.details.slice((page - 1) * 50, page * 50);
  const pageHref = (number: number) => `/admin/accountability/follow-up?${new URLSearchParams({ ...(teacherId ? { teacherId } : {}), page: String(number) })}`;
  return (
    <main className="min-w-0 space-y-5 p-4 md:p-6">
      <Link href="/admin" className="inline-flex items-center gap-2 text-sm font-medium text-blue-800"><ArrowLeft size={16} aria-hidden="true" /> Admin dashboard</Link>
      <div>
        <h1 className="break-words text-xl font-semibold text-gray-900">Teacher follow-ups</h1>
        <p className="mt-1 break-words text-sm text-gray-600">{entries[0]?.teacherName && teacherId ? entries[0].teacherName : "Outstanding duties and requests awaiting management review."}</p>
      </div>
      {snapshot.notes.length > 0 && <ul className="space-y-1 border-l-2 border-amber-400 pl-3 text-sm text-gray-700">{snapshot.notes.map((note) => <li key={note}>{note}</li>)}</ul>}
      {entries.length === 0 ? <p className="py-6 text-sm text-gray-600">No follow-ups are currently available for this selection.</p> : (
        <ul className="divide-y divide-gray-200">
          {entries.map((item) => (
            <li key={item.id} className="min-w-0 space-y-2 py-4">
              <p className="text-xs font-medium text-gray-500">{labels[item.kind]}</p>
              <h2 className="break-words font-semibold text-gray-900">{item.title}</h2>
              {!teacherId && <p className="break-words text-sm text-gray-700">{item.teacherName}</p>}
              <p className="whitespace-pre-wrap break-words text-sm text-gray-600">{item.detail}</p>
              <p className="text-xs text-gray-500">{item.kind === "ESCALATION" || item.kind === "CORRECTION" ? "Raised" : "Deadline"}: {new Date(item.at).toLocaleString("en-GH", { timeZone: "Africa/Accra", dateStyle: "medium", timeStyle: "short" })}</p>
              {item.reviewId && (item.kind === "ESCALATION" || item.kind === "CORRECTION") && (
                <Link href={`/admin/accountability?${item.kind === "ESCALATION" ? "escalationId" : "correctionId"}=${encodeURIComponent(item.reviewId)}${item.kind === "ESCALATION" ? `#escalation-${encodeURIComponent(item.reviewId)}` : ""}`} className="inline-flex items-center gap-2 text-sm font-medium text-blue-800">Review {item.kind === "ESCALATION" ? "escalation" : "correction"} <ArrowRight size={16} aria-hidden="true" /></Link>
              )}
            </li>
          ))}
        </ul>
      )}
      {pageCount > 1 && <nav aria-label="Follow-up pages" className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 pt-4 text-sm">
        <span>Page {page} of {pageCount}</span>
        <div className="flex gap-4">{page > 1 && <Link href={pageHref(page - 1)} className="text-blue-800">Previous</Link>}{page < pageCount && <Link href={pageHref(page + 1)} className="text-blue-800">Next</Link>}</div>
      </nav>}
    </main>
  );
}
