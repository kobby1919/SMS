"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Copy, Loader2, RotateCcw, XCircle } from "lucide-react";
import {
  resendCurrentSchoolAdminInviteAction,
  revokeCurrentSchoolAdminInviteAction,
  type OnboardingActionResult,
} from "@/src/lib/actions/onboardingActions";

export default function AdminInviteActions({ inviteId }: { inviteId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function handleResult(result: OnboardingActionResult, fallback: string) {
    if (!result.ok) {
      setMessage(result.message);
      return;
    }

    const nextInviteUrl = result.invite
      ? `${window.location.origin}${result.invite.invitePath}`
      : null;

    setInviteUrl(nextInviteUrl);
    setMessage(fallback);
    router.refresh();
  }

  function resend() {
    setMessage(null);
    setInviteUrl(null);
    setCopied(false);

    startTransition(async () => {
      const result = await resendCurrentSchoolAdminInviteAction({ inviteId });
      handleResult(result, "Invite resent. Copy the new local test link if needed.");
    });
  }

  function revoke() {
    if (!window.confirm("Revoke this admin invite? The current invite link will stop working.")) {
      return;
    }

    setMessage(null);
    setInviteUrl(null);
    setCopied(false);

    startTransition(async () => {
      const result = await revokeCurrentSchoolAdminInviteAction({ inviteId });
      handleResult(result, "Invite revoked.");
    });
  }

  async function copyInvite() {
    if (!inviteUrl) return;
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={resend}
          disabled={isPending}
          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-indigo-50 px-3 text-xs font-black text-indigo-700 transition hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
          Resend
        </button>
        <button
          type="button"
          onClick={revoke}
          disabled={isPending}
          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-rose-50 px-3 text-xs font-black text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <XCircle size={14} />
          Revoke
        </button>
      </div>

      {message && (
        <p className="max-w-[240px] text-right text-[11px] font-bold text-gray-500">
          {message}
        </p>
      )}

      {inviteUrl && (
        <button
          type="button"
          onClick={copyInvite}
          className="inline-flex items-center gap-1.5 rounded-lg bg-gray-950 px-3 py-2 text-[11px] font-black text-white"
        >
          <Copy size={13} />
          {copied ? "Copied" : "Copy new link"}
        </button>
      )}
    </div>
  );
}
