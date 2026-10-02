"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Loader2, Mail, ShieldCheck, Users } from "lucide-react";

import type {
  PostImportInviteResult,
  PostImportInviteRole,
  PostImportInviteSummary,
} from "@/src/lib/services/post-import-invites";

type Props = {
  summary: PostImportInviteSummary;
};

export default function PostImportInvitePanel({ summary }: Props) {
  const [pendingRole, setPendingRole] = useState<PostImportInviteRole | null>(null);
  const [result, setResult] = useState<PostImportInviteResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const totalReady = useMemo(
    () => summary.items.reduce((total, item) => total + item.importedNeedsInvite, 0),
    [summary.items],
  );

  async function sendInvites(role: PostImportInviteRole) {
    if (pendingRole) return;

    setPendingRole(role);
    setResult(null);
    setError(null);

    try {
      const response = await fetch("/api/admin/data-migration/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      const payload = await response.json();

      if (!response.ok) {
        setError(payload?.error ?? "Bulk invites could not be sent.");
        return;
      }

      setResult(payload as PostImportInviteResult);
    } catch {
      setError("Bulk invites could not be sent. Check your connection and try again.");
    } finally {
      setPendingRole(null);
    }
  }

  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-black uppercase tracking-wide text-blue-700">
            <Mail size={14} />
            Post-import invite workflow
          </div>
          <h2 className="mt-3 text-lg font-black text-gray-950">Turn imported profiles into real Edujay accounts</h2>
          <p className="mt-1 text-sm font-semibold leading-6 text-gray-500">
            Imported teachers, parents, and bursars do not get login access automatically. Edujay sends secure invites first, then activates access only after each person accepts with the invited email.
          </p>
        </div>
        <div className="rounded-2xl bg-gray-50 px-4 py-3">
          <p className="text-2xl font-black text-gray-950">{totalReady}</p>
          <p className="mt-1 text-[10px] font-black uppercase tracking-wide text-gray-400">
            ready for invite
          </p>
        </div>
      </div>

      {error ? (
        <div className="mt-4 rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
          {error}
        </div>
      ) : null}

      {result ? (
        <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3">
          <div className="flex items-start gap-3">
            <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-emerald-700" />
            <div>
              <p className="text-sm font-black text-emerald-950">
                {result.created} {result.role} invite{result.created === 1 ? "" : "s"} prepared.
              </p>
              <p className="mt-1 text-xs font-semibold leading-5 text-emerald-800">
                {result.skipped} skipped, {result.failed} failed. Any email provider warnings are shown below.
              </p>
              {result.warnings.length > 0 ? (
                <div className="mt-2 space-y-1">
                  {result.warnings.slice(0, 5).map((warning) => (
                    <p key={warning} className="text-xs font-bold leading-5 text-amber-800">
                      {warning}
                    </p>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      <div className="mt-5 grid gap-3 lg:grid-cols-3">
        {summary.items.map((item) => {
          const isPending = pendingRole === item.role;
          return (
            <article key={item.role} className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-blue-700 ring-1 ring-gray-100">
                    <Users size={18} />
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-sm font-black text-gray-950">{item.label}</h3>
                    <p className="mt-1 text-xs font-semibold leading-5 text-gray-500">
                      Imported profiles move from needs invite to invited, then active after acceptance.
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                {[
                  ["Needs invite", item.importedNeedsInvite, "text-amber-700"],
                  ["Invited", item.invited, "text-blue-700"],
                  ["Active", item.active, "text-emerald-700"],
                  ["Blocked", item.blocked, "text-slate-700"],
                ].map(([label, value, color]) => (
                  <div key={label} className="rounded-xl bg-white p-3 ring-1 ring-gray-100">
                    <p className={`text-lg font-black ${color}`}>{value}</p>
                    <p className="mt-0.5 break-words text-[10px] font-black uppercase leading-snug text-gray-400">
                      {label}
                    </p>
                  </div>
                ))}
              </div>

              {item.blocked > 0 ? (
                <p className="mt-3 rounded-xl bg-white px-3 py-2 text-xs font-semibold leading-5 text-gray-500 ring-1 ring-gray-100">
                  {item.blockedReason}
                </p>
              ) : null}

              <button
                type="button"
                onClick={() => void sendInvites(item.role)}
                disabled={item.importedNeedsInvite === 0 || Boolean(pendingRole)}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-3 text-xs font-black text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-gray-300"
              >
                {isPending ? <Loader2 size={15} className="animate-spin" /> : <ShieldCheck size={15} />}
                Send {item.label.toLowerCase()} invites
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}
