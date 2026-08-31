"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Lock, Loader2, RotateCcw } from "lucide-react";
import type { Term } from "@/src/generated/prisma";
import {
  publishClassReportCardsAction,
  unpublishClassReportCardsAction,
} from "@/src/lib/actions/caActions";
import { useRouter } from "next/navigation";

type Props = {
  classId: number;
  term: Term;
  academicYear: string;
  isPublished: boolean;
  canPublish: boolean;
  missingCount: number;
  studentCount: number;
  subjectCount: number;
};

export default function ReportPublicationControls({
  classId,
  term,
  academicYear,
  isPublished,
  canPublish,
  missingCount,
  studentCount,
  subjectCount,
}: Props) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const run = (mode: "publish" | "unpublish") => {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      try {
        if (mode === "publish") {
          await publishClassReportCardsAction({ classId, term, academicYear });
          setMessage("Report cards published. Parents can now view and download the final reports.");
        } else {
          await unpublishClassReportCardsAction({ classId, term, academicYear });
          setMessage("Report cards unpublished. Parents can no longer download this report set.");
        }
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Report publication failed.");
      }
    });
  };

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${isPublished ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"}`}>
              {isPublished ? <CheckCircle2 size={17} /> : <Lock size={17} />}
            </span>
            <div>
              <p className="text-sm font-black text-gray-900">
                {isPublished ? "Reports published" : "Reports awaiting admin approval"}
              </p>
              <p className="text-xs font-semibold text-gray-400">
                {studentCount} students · {subjectCount} timetable subjects · {missingCount} missing exam entries
              </p>
            </div>
          </div>
          {message && <p className="mt-3 text-xs font-bold text-emerald-700">{message}</p>}
          {error && <p className="mt-3 text-xs font-bold text-rose-600">{error}</p>}
        </div>

        {isPublished ? (
          <button
            type="button"
            onClick={() => run("unpublish")}
            disabled={isPending}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-xs font-black text-amber-700 transition hover:bg-amber-100 disabled:opacity-60"
          >
            {isPending ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
            Unpublish
          </button>
        ) : (
          <button
            type="button"
            onClick={() => run("publish")}
            disabled={!canPublish || isPending}
            title={!canPublish ? "Every student must have exam scores for every timetable subject before publishing." : "Publish final report cards"}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isPending ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
            Publish reports
          </button>
        )}
      </div>
    </div>
  );
}
