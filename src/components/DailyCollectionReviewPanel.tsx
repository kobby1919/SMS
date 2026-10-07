"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, CheckCircle2, Loader2, ShieldCheck, XCircle } from "lucide-react";
import {
  confirmDailyCollectionSession,
  flagDailyCollectionSession,
} from "@/src/lib/actions/dailyCollectionSessionActions";
import { FEE_CATEGORY_LABELS, formatGHS } from "@/src/lib/constants/finance";
import type { DailyCollectionSessionStatus } from "@/src/generated/prisma";

type ReviewSession = {
  id: string;
  collectionDate: string;
  status: DailyCollectionSessionStatus;
  expectedAmount: number;
  reportedAmount: number;
  confirmedAmount: number | null;
  mismatchReason: string | null;
  collectionType: { name: string; category: string };
  collector: { name: string; surname: string };
  counts: { entries: number };
};

type Props = {
  sessions: ReviewSession[];
  canConfirmSessions: boolean;
};

const sessionStatusStyle: Record<string, string> = {
  OPEN: "bg-blue-50 text-blue-700 border-blue-100",
  SUBMITTED: "bg-amber-50 text-amber-700 border-amber-100",
  CONFIRMED: "bg-emerald-50 text-emerald-700 border-emerald-100",
  FLAGGED: "bg-rose-50 text-rose-700 border-rose-100",
  CANCELLED: "bg-gray-50 text-gray-600 border-gray-100",
};

export default function DailyCollectionReviewPanel({ sessions, canConfirmSessions }: Props) {
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function amountFor(session: ReviewSession) {
    return amounts[session.id] ?? String(session.reportedAmount);
  }

  function run(key: string, task: () => Promise<unknown>, success: string) {
    setMessage(null);
    setError(null);
    setBusyKey(key);
    startTransition(async () => {
      try {
        await task();
        setMessage(success);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Daily collection review failed.");
      } finally {
        setBusyKey(null);
      }
    });
  }

  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-wider text-gray-400">Bursar Confirmation</p>
          <h2 className="mt-1 text-lg font-black text-gray-900">Daily collection sessions</h2>
          <p className="mt-1 max-w-3xl text-sm font-semibold leading-6 text-gray-500">
            {canConfirmSessions
              ? "Confirm submitted collector totals only when the physical cash/mobile-money settlement matches the reported amount. Flag mismatches instead of editing them silently."
              : "Review submitted collector totals, confirmation status, and mismatch history. Bursars confirm or flag the physical settlement."}
          </p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-xl bg-gray-50 px-3 py-2 text-xs font-black text-gray-500">
          <ShieldCheck size={14} />
          {sessions.length} recent session{sessions.length === 1 ? "" : "s"}
        </div>
      </div>

      {message && (
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700">
          <CheckCircle2 size={14} /> {message}
        </div>
      )}
      {error && (
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">
          <XCircle size={14} /> {error}
        </div>
      )}

      <div className="mt-5 grid gap-3">
        {sessions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-200 p-8 text-center">
            <p className="text-sm font-black text-gray-800">No daily collection sessions yet.</p>
            <p className="mt-1 text-sm font-semibold text-gray-400">
              Submitted collector sessions will appear here for bursar confirmation.
            </p>
          </div>
        ) : (
          sessions.map((session) => {
            const canReview = canConfirmSessions && session.status === "SUBMITTED";
            return (
              <article key={session.id} className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-black text-gray-900">{session.collectionType.name}</h3>
                      <span className={`rounded-lg border px-2 py-0.5 text-[10px] font-black uppercase ${sessionStatusStyle[session.status]}`}>
                        {session.status}
                      </span>
                      <span className="rounded-lg bg-blue-50 px-2 py-0.5 text-[10px] font-black uppercase text-blue-700">
                        {FEE_CATEGORY_LABELS[session.collectionType.category] ?? session.collectionType.category}
                      </span>
                    </div>
                    <p className="mt-1 text-xs font-semibold text-gray-400">
                      {new Date(session.collectionDate).toLocaleDateString("en-GB")} - {session.collector.name} {session.collector.surname} - {session.counts.entries} entries
                    </p>
                    {session.mismatchReason && (
                      <p className="mt-2 rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">
                        <AlertTriangle size={13} className="mr-1 inline" />
                        {session.mismatchReason}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-2 lg:min-w-[360px]">
                    <MiniStat label="Expected" value={formatGHS(session.expectedAmount)} />
                    <MiniStat label="Reported" value={formatGHS(session.reportedAmount)} />
                    <MiniStat label="Received" value={session.confirmedAmount === null ? "-" : formatGHS(session.confirmedAmount)} />
                  </div>
                </div>

                {canReview && (
                  <div className="mt-4 grid gap-3 lg:grid-cols-[180px_minmax(0,1fr)_auto_auto] lg:items-end">
                    <label className="grid gap-1">
                      <span className="text-[11px] font-black uppercase tracking-wider text-gray-400">Amount received</span>
                      <input
                        value={amountFor(session)}
                        onChange={(event) => setAmounts({ ...amounts, [session.id]: event.target.value })}
                        type="number"
                        min="0"
                        step="0.01"
                        className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold outline-none focus:border-blue-400"
                      />
                    </label>
                    <label className="grid gap-1">
                      <span className="text-[11px] font-black uppercase tracking-wider text-gray-400">Mismatch reason</span>
                      <input
                        value={reasons[session.id] ?? ""}
                        onChange={(event) => setReasons({ ...reasons, [session.id]: event.target.value })}
                        placeholder="Required only when flagging a mismatch"
                        className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold outline-none focus:border-blue-400"
                      />
                    </label>
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => run(
                        `confirm:${session.id}`,
                        () => confirmDailyCollectionSession({
                          sessionId: session.id,
                          amountReceived: Number(amountFor(session)),
                        }),
                        "Daily collection session confirmed.",
                      )}
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 text-xs font-black text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {busyKey === `confirm:${session.id}` ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                      Confirm
                    </button>
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => run(
                        `flag:${session.id}`,
                        () => flagDailyCollectionSession({
                          sessionId: session.id,
                          amountReceived: Number(amountFor(session)),
                          reason: reasons[session.id] ?? "",
                        }),
                        "Daily collection mismatch flagged.",
                      )}
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-rose-200 bg-white px-4 text-xs font-black text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {busyKey === `flag:${session.id}` ? <Loader2 size={13} className="animate-spin" /> : <AlertTriangle size={13} />}
                      Flag
                    </button>
                  </div>
                )}
                {!canConfirmSessions && session.status === "SUBMITTED" && (
                  <div className="mt-4 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">
                    Submitted for bursar confirmation. Admin view is review-only here.
                  </div>
                )}
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white px-3 py-2">
      <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">{label}</p>
      <p className="mt-1 text-sm font-black text-gray-900">{value}</p>
    </div>
  );
}
