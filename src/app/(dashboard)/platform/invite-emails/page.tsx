import Link from "next/link";
import { Search } from "lucide-react";
import prisma from "@/src/lib/prisma";
import { requirePageSession } from "@/src/lib/authz";
import { listInviteEmailAttempts } from "@/src/lib/services/invite-email-tracking";
import InviteEmailActivity from "@/src/components/InviteEmailActivity";
import InviteEmailRefresh from "@/src/components/InviteEmailRefresh";

export const dynamic = "force-dynamic";
export default async function PlatformInviteEmailPage({ searchParams }: { searchParams: Promise<{ schoolId?: string }> }) {
  await requirePageSession(["platform_admin"]);
  const params = await searchParams;
  const schools = await prisma.school.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" }, take: 200 });
  const school = schools.find((item) => item.id === params.schoolId);
  const rows = school ? await listInviteEmailAttempts(school.id) : [];
  return <main className="min-w-0 space-y-4 p-4 sm:p-6">
    <Link href="/platform/onboarding" className="text-sm text-gray-600">School access requests</Link>
    <header className="flex items-center justify-between gap-3"><h1 className="text-xl font-bold">Invitation email activity</h1><InviteEmailRefresh /></header>
    {!process.env.RESEND_WEBHOOK_SECRET && <p className="border-l-2 border-amber-500 pl-3 text-sm text-amber-800">Delivery callbacks are not configured. Delivery and bounce status cannot be confirmed.</p>}
    <form className="flex flex-wrap items-end gap-3">
      <label className="grid min-w-0 gap-1 text-sm font-semibold">School<select name="schoolId" defaultValue={school?.id || ""} className="h-11 max-w-full rounded-md border border-gray-300 bg-white px-3"><option value="">Select school</option>{schools.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <button type="submit" aria-label="View email activity" title="View email activity" className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-gray-300"><Search size={18} /></button>
    </form>
    {school ? <InviteEmailActivity rows={rows} /> : <p className="text-sm text-gray-600">Select a school to review its invitation emails.</p>}
  </main>;
}
