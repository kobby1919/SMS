"use client";

import { useMemo, useState, useTransition } from "react";
import { CheckCircle2, CircleDollarSign, Loader2, Play, Send, XCircle } from "lucide-react";
import {
  markDailyCollectionEntry,
  openDailyCollectionSession,
  submitDailyCollectionSession,
} from "@/src/lib/actions/dailyCollectionSessionActions";
import { FEE_CATEGORY_LABELS, formatGHS } from "@/src/lib/constants/finance";
import type { DailyCollectionEntryStatus, DailyCollectionSessionStatus } from "@/src/generated/prisma";

type CollectionTypeRow = {
  id: string;
  name: string;
  category: string;
  amount: number;
  requiresBursarConfirmation: boolean;
};

type EntryRow = {
  id: string;
  status: DailyCollectionEntryStatus;
  amountExpected: number;
  amountCollected: number;
  note: string | null;
  student: {
    id: string;
    name: string;
    surname: string;
    admissionNumber: string | null;
    class: { name: string };
  };
};

type SessionRow = {
  id: string;
  collectionDate: string;
  status: DailyCollectionSessionStatus;
  expectedAmount: number;
  reportedAmount: number;
  confirmedAmount: number | null;
  mismatchReason: string | null;
  collectionTypeId: string;
  entries: EntryRow[];
};

type Props = {
  collectionTypes: CollectionTypeRow[];
  sessions: SessionRow[];
};

const statusStyle: Record<DailyCollectionEntryStatus, string> = {
  PAID: "bg-emerald-50 text-emerald-700 border-emerald-100",
  UNPAID: "bg-rose-50 text-rose-700 border-rose-100",
  EXCUSED: "bg-gray-50 text-gray-600 border-gray-100",
};

export default function DailyCollectionCollectorPanel({ collectionTypes, sessions }: Props) {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const sessionsByType = useMemo(() => {
    const map = new Map<string, SessionRow>();
    for (const session of sessions) map.set(session.collectionTypeId, session);
    return map;
  }, [sessions]);

  function run(key: string, task: () => Promise<unknown>, success: string) {
    setMessage(null);
    setError(null);
    setBusyKey(key);
    startTransition(async () => {
      try {
        await task();
        setMessage(success);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Daily collection action failed.");
      } finally {
        setBusyKey(null);
      }
    });
  }

  return (
    <div className="grid gap-4">
      {message && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700">
          <CheckCircle2 size={14} /> {message}
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">
          <XCircle size={14} /> {error}
        </div>
      )}

      {collectionTypes.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-8 text-center">
          <p className="text-sm font-black text-gray-800">No daily collection setup assigned yet.</p>
          <p className="mt-1 text-sm font-semibold text-gray-400">
            When the bursar assigns feeding or another daily collection type to you, it will appear here.
          </p>
        </div>
      ) : (
        collectionTypes.map((collectionType) => {
          const session = sessionsByType.get(collectionType.id);
          return (
            <section key={collectionType.id} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:p-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base font-black text-gray-900">{collectionType.name}</h2>
                    <span className="rounded-lg bg-blue-50 px-2 py-0.5 text-[10px] font-black uppercase text-blue-700">
                      {FEE_CATEGORY_LABELS[collectionType.category] ?? collectionType.category}
                    </span>
                    {session && (
                      <span className="rounded-lg bg-gray-100 px-2 py-0.5 text-[10px] font-black uppercase text-gray-600">
                        {session.status}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xl font-black text-gray-900">{formatGHS(collectionType.amount)}</p>
                  <p className="mt-1 text-xs font-semibold text-gray-400">
                    {collectionType.requiresBursarConfirmation
                      ? "Submit your total for bursar confirmation."
                      : "Submit your total for finance review."}
                  </p>
                </div>

                {!session ? (
                  <button
                    type="button"
                    onClick={() => run(
                      `open:${collectionType.id}`,
                      () => openDailyCollectionSession({ collectionTypeId: collectionType.id }),
                      "Daily collection session opened.",
                    )}
                    disabled={isPending}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 text-sm font-black text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {busyKey === `open:${collectionType.id}` ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
                    Open today
                  </button>
                ) : (
                  <div className="grid grid-cols-2 gap-2 text-right sm:grid-cols-3">
                    <MiniStat label="Expected" value={formatGHS(session.expectedAmount)} />
                    <MiniStat label="Reported" value={formatGHS(session.reportedAmount)} />
                    <MiniStat label="Entries" value={String(session.entries.length)} />
                  </div>
                )}
              </div>

              {session && (
                <SessionEntries
                  session={session}
                  busyKey={busyKey}
                  isPending={isPending}
                  run={run}
                />
              )}
            </section>
          );
        })
      )}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-gray-50 px-3 py-2">
      <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">{label}</p>
      <p className="mt-1 text-sm font-black text-gray-900">{value}</p>
    </div>
  );
}

function SessionEntries({
  session,
  busyKey,
  isPending,
  run,
}: {
  session: SessionRow;
  busyKey: string | null;
  isPending: boolean;
  run: (key: string, task: () => Promise<unknown>, success: string) => void;
}) {
  const locked = session.status !== "OPEN";
  const paid = session.entries.filter((entry) => entry.status === "PAID").length;
  const unpaid = session.entries.filter((entry) => entry.status === "UNPAID").length;
  const excused = session.entries.filter((entry) => entry.status === "EXCUSED").length;

  return (
    <div className="mt-4 grid gap-4">
      <div className="grid grid-cols-3 gap-2">
        <MiniStat label="Paid" value={String(paid)} />
        <MiniStat label="Unpaid" value={String(unpaid)} />
        <MiniStat label="Excused" value={String(excused)} />
      </div>

      <div className="grid gap-2">
        {session.entries.map((entry) => (
          <article key={entry.id} className="rounded-2xl border border-gray-100 bg-gray-50 p-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-black text-gray-900">
                    {entry.student.name} {entry.student.surname}
                  </p>
                  <span className={`rounded-lg border px-2 py-0.5 text-[10px] font-black uppercase ${statusStyle[entry.status]}`}>
                    {entry.status}
                  </span>
                </div>
                <p className="mt-1 text-xs font-semibold text-gray-400">
                  {entry.student.class.name}
                  {entry.student.admissionNumber ? ` - ${entry.student.admissionNumber}` : ""}
                  {" - "}
                  {formatGHS(entry.amountExpected)}
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2 sm:w-[300px]">
                {(["PAID", "UNPAID", "EXCUSED"] as DailyCollectionEntryStatus[]).map((status) => (
                  <button
                    key={status}
                    type="button"
                    disabled={locked || isPending || entry.status === status}
                    onClick={() => run(
                      `mark:${entry.id}:${status}`,
                      () => markDailyCollectionEntry({ entryId: entry.id, status }),
                      `${entry.student.name} marked ${status.toLowerCase()}.`,
                    )}
                    className="inline-flex h-9 items-center justify-center rounded-xl border border-gray-200 bg-white px-2 text-[11px] font-black text-gray-600 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {busyKey === `mark:${entry.id}:${status}` ? <Loader2 size={12} className="animate-spin" /> : status}
                  </button>
                ))}
              </div>
            </div>
          </article>
        ))}
      </div>

      {session.status === "OPEN" && (
        <button
          type="button"
          onClick={() => run(
            `submit:${session.id}`,
            () => submitDailyCollectionSession({ sessionId: session.id }),
            "Daily collection session submitted for bursar confirmation.",
          )}
          disabled={isPending}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 text-sm font-black text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busyKey === `submit:${session.id}` ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
          Submit session
        </button>
      )}

      {session.status !== "OPEN" && (
        <div className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-800">
          <CircleDollarSign size={14} className="mr-1 inline" />
          This session is locked for collector edits.
        </div>
      )}
    </div>
  );
}
