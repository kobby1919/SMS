import InviteEmailRefresh from "@/src/components/InviteEmailRefresh";
import { requirePageSession } from "@/src/lib/authz";
import { listInviteEmailAttempts } from "@/src/lib/services/invite-email-tracking";
import InviteEmailActivity from "@/src/components/InviteEmailActivity";

export const dynamic = "force-dynamic";
export default async function InviteEmailPage() {
  const { schoolId } = await requirePageSession(["admin"]);
  const rows = await listInviteEmailAttempts(schoolId);
  return <main className="min-w-0 space-y-4 p-4 sm:p-6">
    <header className="flex items-center justify-between gap-4"><h1 className="text-xl font-bold">Invitation email activity</h1>
      <InviteEmailRefresh />
    </header>
    {!process.env.RESEND_WEBHOOK_SECRET && <p className="border-l-2 border-amber-500 pl-3 text-sm text-amber-800">Delivery callbacks are not configured. Delivery and bounce status cannot be confirmed.</p>}
    <InviteEmailActivity rows={rows} />
  </main>;
}
