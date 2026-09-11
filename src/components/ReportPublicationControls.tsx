"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, CheckCircle2, Clock, Loader2, RotateCcw, Send, XCircle } from "lucide-react";
import type { ReportPublicationStatus, Term } from "@/src/generated/prisma";
import {
  publishClassReportCardsAction,
  rejectClassReportCardsReviewAction,
  submitClassReportCardsForReviewAction,
  unpublishClassReportCardsAction,
} from "@/src/lib/actions/caActions";
import { useRouter } from "next/navigation";

type Props = {
  classId: number;
  term: Term;
  academicYear: string;
  status: ReportPublicationStatus | "UNSUBMITTED";
  role: "admin" | "teacher";
  isClassTeacher?: boolean;
  canSubmit: boolean;
  missingCount: number;
  missingCACount: number;
  missingExamCount: number;
  studentCount: number;
  subjectCount: number;
  submittedAt?: Date | null;
  submittedBy?: string | null;
  reviewNote?: string | null;
};

export default function ReportPublicationControls({
  classId,
  term,
  academicYear,
  status,
  role,
  isClassTeacher = false,
  canSubmit,
  missingCount,
  missingCACount,
  missingExamCount,
  studentCount,
  subjectCount,
  submittedAt,
  submittedBy,
  reviewNote,
}: Props) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [isPending, startTransition] = useTransition();
  const isPublished = status === "PUBLISHED";
  const isSubmitted = status === "SUBMITTED";
  const canPublish = role === "admin" && isSubmitted && canSubmit;
  const canTeacherSubmit = role === "teacher" && isClassTeacher && canSubmit && !isPublished;

  const statusCopy = {
    PUBLISHED: {
      title: "Reports published",
      body: "Parents can view and download the final report cards.",
      icon: <CheckCircle2 size={17} />,
      tone: "bg-emerald-50 text-emerald-700",
    },
    SUBMITTED: {
      title: "Submitted for admin review",
      body: "The class teacher has completed checks. Admin must publish before parents receive final reports.",
      icon: <Clock size={17} />,
      tone: "bg-blue-50 text-blue-700",
    },
    REJECTED: {
      title: "Returned for correction",
      body: reviewNote || "Admin returned this report set for correction.",
      icon: <XCircle size={17} />,
      tone: "bg-rose-50 text-rose-700",
    },
    UNPUBLISHED: {
      title: "Reports not submitted",
      body: "Class teacher must submit this class for admin review after all report entries are complete.",
      icon: <AlertTriangle size={17} />,
      tone: "bg-amber-50 text-amber-700",
    },
    UNSUBMITTED: {
      title: "Reports not submitted",
      body: "Class teacher must submit this class for admin review after all report entries are complete.",
      icon: <AlertTriangle size={17} />,
      tone: "bg-amber-50 text-amber-700",
    },
  }[status];

  const run = (mode: "submit" | "publish" | "reject" | "unpublish") => {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      try {
        const payload = { classId, term, academicYear, notes: notes.trim() || undefined };
        if (mode === "submit") {
          await submitClassReportCardsForReviewAction(payload);
          setMessage("Class submitted for admin review.");
        } else if (mode === "publish") {
          await publishClassReportCardsAction(payload);
          setMessage("Report cards published. Parents can now view and download the final reports.");
        } else if (mode === "reject") {
          await rejectClassReportCardsReviewAction(payload);
          setMessage("Report cards returned to the class teacher for correction.");
        } else {
          await unpublishClassReportCardsAction(payload);
          setMessage("Report cards unpublished. Parents can no longer download this report set.");
        }
        setNotes("");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Report workflow failed.");
      }
    });
  };

  return (
    <div className="min-w-0 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="flex items-start gap-2">
            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${statusCopy.tone}`}>
              {statusCopy.icon}
            </span>
            <div className="min-w-0">
              <p className="break-words text-sm font-black text-gray-900">
                {statusCopy.title}
              </p>
              <p className="break-words text-xs font-semibold text-gray-400">
                {studentCount} students · {subjectCount} subjects · {missingCount} blocker{missingCount === 1 ? "" : "s"}
              </p>
            </div>
          </div>
          <p className="mt-3 text-xs font-semibold leading-relaxed text-gray-500">
            {statusCopy.body}
          </p>
          {submittedAt ? (
            <p className="mt-1 text-[11px] font-bold text-gray-400">
              Submitted {new Date(submittedAt).toLocaleString("en-GH", { dateStyle: "medium", timeStyle: "short" })}
              {submittedBy ? ` by ${submittedBy}` : ""}
            </p>
          ) : null}
          {missingCount > 0 ? (
            <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700">
              {missingCACount} missing CA · {missingExamCount} missing exam score{missingExamCount === 1 ? "" : "s"}
            </p>
          ) : null}
          {message && <p className="mt-3 text-xs font-bold text-emerald-700">{message}</p>}
          {error && <p className="mt-3 text-xs font-bold text-rose-600">{error}</p>}
        </div>

        <div className="flex w-full min-w-0 flex-col gap-2 lg:w-[300px]">
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={2}
            placeholder={role === "admin" ? "Admin review note" : "Optional note for admin"}
            className="w-full resize-none rounded-xl border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          />
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
        ) : role === "admin" ? (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-2">
            <button
              type="button"
              onClick={() => run("reject")}
              disabled={!isSubmitted || isPending}
              title={!isSubmitted ? "Only submitted report sets can be returned." : "Return to class teacher"}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-black text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isPending ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />}
              Return
            </button>
            <button
              type="button"
              onClick={() => run("publish")}
              disabled={!canPublish || isPending}
              title={!canPublish ? "Class teacher must submit a complete report set before publishing." : "Publish final report cards"}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isPending ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
              Publish
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => run("submit")}
            disabled={!canTeacherSubmit || isPending}
            title={!canTeacherSubmit ? "Only the class teacher can submit when every report entry is complete." : "Submit class for admin review"}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-black text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isPending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            Submit for review
          </button>
        )}
        </div>
      </div>
    </div>
  );
}
