"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Loader2, Lock, LockOpen } from "lucide-react";
import type { ExamEntryStatus, Term } from "@/src/generated/prisma";
import {
  closeExamEntryWindowAction,
  openExamEntryWindowAction,
} from "@/src/lib/actions/caActions";
import { TERM_LABELS } from "@/src/lib/caGrades";
import { useRouter } from "next/navigation";

type Props = {
  classId: number;
  className: string;
  term: Term;
  academicYear: string;
  status: ExamEntryStatus | "LOCKED";
  role: string;
};

export default function ExamEntryWindowControls({
  classId,
  className,
  term,
  academicYear,
  status,
  role,
}: Props) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const isOpen = status === "OPEN";
  const isClosed = status === "CLOSED";

  const run = (mode: "open" | "close") => {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      try {
        if (mode === "open") {
          await openExamEntryWindowAction({ classId, term, academicYear });
          setMessage("Exam entry opened. Teachers can now enter exam scores for this class.");
        } else {
          await closeExamEntryWindowAction({ classId, term, academicYear });
          setMessage("Exam entry closed. Teachers can no longer enter exam scores.");
        }
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not update exam entry.");
      }
    });
  };

  return (
    <div className={`rounded-2xl border p-4 ${
      isOpen
        ? "border-emerald-100 bg-emerald-50"
        : isClosed
          ? "border-slate-200 bg-slate-50"
          : "border-amber-100 bg-amber-50"
    }`}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
            isOpen ? "bg-emerald-600 text-white" : "bg-white text-amber-600"
          }`}>
            {isOpen ? <LockOpen size={18} /> : <Lock size={18} />}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-black text-gray-900">
              {isOpen ? "Exam entry is open" : isClosed ? "Exam entry is closed" : "Exam entry is locked"}
            </p>
            <p className="mt-0.5 text-xs font-semibold text-gray-500">
              {className} · {TERM_LABELS[term]} · {academicYear}
            </p>
            <p className="mt-1 text-xs font-semibold text-gray-500">
              {isOpen
                ? "Teachers can enter exam scores now. CA remains computed from recorded activities."
                : "Teachers can record CA activities, but exam score fields stay locked until admin opens entry."}
            </p>
            {message && <p className="mt-2 text-xs font-bold text-emerald-700">{message}</p>}
            {error && <p className="mt-2 text-xs font-bold text-rose-600">{error}</p>}
          </div>
        </div>

        {role === "admin" && (
          <button
            type="button"
            onClick={() => run(isOpen ? "close" : "open")}
            disabled={isPending}
            className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-xs font-black transition disabled:opacity-60 ${
              isOpen
                ? "border border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                : "bg-slate-900 text-white hover:bg-slate-800"
            }`}
          >
            {isPending ? (
              <Loader2 size={14} className="animate-spin" />
            ) : isOpen ? (
              <Lock size={14} />
            ) : (
              <CheckCircle2 size={14} />
            )}
            {isOpen ? "Close exam entry" : "Open exam entry"}
          </button>
        )}
      </div>
    </div>
  );
}
