"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Copy, Loader2, RotateCcw, XCircle } from "lucide-react";
import {
  resendParentInviteAction,
  revokeParentInviteAction,
  type ParentInviteActionResult,
} from "@/src/lib/actions/parentInviteActions";

export default function ParentInviteActions({ inviteId }: { inviteId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function handleResult(result: ParentInviteActionResult, fallback: string) {
    if (!result.ok) {
      setMessage(result.message);
      return;
    }

    const nextInviteUrl =
      result.invite && "inviteUrl" in result.invite ? result.invite.inviteUrl : null;
    setInviteUrl(nextInviteUrl);
    setMessage(nextInviteUrl ? "Invite resent. Copy the new link below." : fallback);
    router.refresh();
  }

  function resend() {
    setMessage(null);
    setInviteUrl(null);
    setCopied(false);

    startTransition(async () => {
      const result = await resendParentInviteAction({ inviteId });
      handleResult(result, "Invite resent.");
    });
  }

  function revoke() {
    if (!window.confirm("Revoke this parent invite? The current invite link will stop working.")) {
      return;
    }

    setMessage(null);
    setInviteUrl(null);
    setCopied(false);

    startTransition(async () => {
      const result = await revokeParentInviteAction({ inviteId });
      handleResult(result, "Invite revoked.");
    });
  }

  async function copyLink() {
    if (!inviteUrl) return;
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div className="flex flex-col items-start gap-2 sm:items-end">
      <div className="flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={resend}
          disabled={isPending}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-blue-50 px-3 py-2 text-xs font-black text-edujay-primary transition hover:bg-blue-100 disabled:opacity-60"
        >
          {isPending ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
          Resend
        </button>
        <button
          type="button"
          onClick={revoke}
          disabled={isPending}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-rose-50 px-3 py-2 text-xs font-black text-rose-600 transition hover:bg-rose-100 disabled:opacity-60"
        >
          <XCircle size={14} />
          Revoke
        </button>
      </div>
      {message && (
        <p className="max-w-[260px] text-xs font-semibold text-gray-500 sm:text-right">
          {message}
        </p>
      )}
      {inviteUrl && (
        <button
          type="button"
          onClick={copyLink}
          className="inline-flex max-w-full items-center gap-2 rounded-lg bg-gray-950 px-3 py-2 text-xs font-black text-white"
        >
          <Copy size={14} />
          {copied ? "Copied" : "Copy new link"}
        </button>
      )}
    </div>
  );
}