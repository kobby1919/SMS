import { CheckCircle2, Copy, TriangleAlert } from "lucide-react";

type Props = {
  invite: {
    email: string;
    emailStatus: "SENT" | "FAILED" | "NOT_SENT";
    inviteUrl: string;
    emailWarning?: string;
  };
  copied: boolean;
  onCopy: (url: string) => void;
};

export default function TeacherInviteResult({ invite, copied, onCopy }: Props) {
  const sent = invite.emailStatus === "SENT";
  const Icon = sent ? CheckCircle2 : TriangleAlert;

  return (
    <div role="status" className={`mb-5 rounded-lg border p-4 ${sent
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : "border-amber-200 bg-amber-50 text-amber-900"}`}>
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 shrink-0" size={18} />
        <div className="min-w-0 flex-1 [overflow-wrap:anywhere]">
          <p className="text-sm font-bold">
            {sent ? "Invitation email sent" : invite.emailStatus === "NOT_SENT"
              ? "Invitation created. Email not sent."
              : "Invitation created. Email sending could not be confirmed."}
          </p>
          <p className="mt-1 text-sm font-medium">
            {sent ? `The email service accepted the invitation for ${invite.email}. Inbox delivery is not yet confirmed.`
              : invite.emailWarning || "Review the email address and resend the existing invitation from the teacher list."}
          </p>
          {!sent && <p className="mt-2 text-xs font-medium">The invitation is saved. Resend it from the teacher list rather than creating a duplicate.</p>}
          {sent && invite.emailWarning && <p className="mt-2 text-xs font-medium text-amber-800">{invite.emailWarning}</p>}
        </div>
      </div>
      <details className="mt-3 text-sm">
        <summary className="cursor-pointer font-semibold">Share invitation manually</summary>
        <p className="mt-2 text-xs">Share this private link only with the invited teacher.</p>
        <div className="mt-2 flex min-w-0 flex-col gap-2 rounded-lg bg-white p-3 sm:flex-row sm:items-center">
          <code className="min-w-0 flex-1 break-all text-xs text-gray-600">{invite.inviteUrl}</code>
          <button type="button" onClick={() => onCopy(invite.inviteUrl)} className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-gray-950 px-3 py-2 text-xs font-bold text-white">
            <Copy size={14} />{copied ? "Copied" : "Copy invitation link"}
          </button>
        </div>
      </details>
      <a href="/admin/invite-emails" className="mt-3 inline-block text-sm font-semibold underline underline-offset-4">View email activity</a>
    </div>
  );
}
