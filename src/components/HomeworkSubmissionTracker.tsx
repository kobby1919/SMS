"use client";

import { useMemo, useState, useTransition } from "react";
import { CheckCircle2, Clock, Loader2, RotateCcw, XCircle } from "lucide-react";
import { updateHomeworkSubmission, updateHomeworkSubmissionsBulk } from "@/src/lib/actions/actions";

type HomeworkStatus = "PENDING" | "SUBMITTED" | "LATE" | "MISSING" | "EXCUSED";

type HomeworkSubmissionRow = {
  id: number;
  status: HomeworkStatus;
  studentId: string;
  studentName: string;
  checkedAt: string | null;
};

const statusLabel: Record<HomeworkStatus, string> = {
  PENDING: "Pending",
  SUBMITTED: "Submitted",
  LATE: "Late",
  MISSING: "Missing",
  EXCUSED: "Excused",
};

const statusTone: Record<HomeworkStatus, string> = {
  PENDING: "bg-slate-100 text-slate-600",
  SUBMITTED: "bg-emerald-50 text-emerald-700",
  LATE: "bg-amber-50 text-amber-700",
  MISSING: "bg-rose-50 text-rose-700",
  EXCUSED: "bg-blue-50 text-blue-700",
};

const finalStatuses = new Set<HomeworkStatus>(["SUBMITTED", "LATE", "MISSING", "EXCUSED"]);

function isPastDeadline(dueDate: string) {
  const end = new Date(dueDate);
  end.setHours(23, 59, 59, 999);
  return end < new Date();
}

export default function HomeworkSubmissionTracker({
  assignmentId,
  dueDate,
  initialSubmissions,
}: {
  assignmentId: number;
  dueDate: string;
  initialSubmissions: HomeworkSubmissionRow[];
}) {
  const [submissions, setSubmissions] = useState(initialSubmissions);
  const [activeStudentId, setActiveStudentId] = useState<string | null>(null);
  const [bulkStatus, setBulkStatus] = useState<HomeworkStatus | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const deadlinePassed = isPastDeadline(dueDate);

  const counts = useMemo(() => {
    return submissions.reduce(
      (acc, submission) => {
        acc[submission.status] += 1;
        return acc;
      },
      { PENDING: 0, SUBMITTED: 0, LATE: 0, MISSING: 0, EXCUSED: 0 } satisfies Record<HomeworkStatus, number>,
    );
  }, [submissions]);

  const mark = (studentId: string, nextStatus: HomeworkStatus) => {
    const currentSubmission = submissions.find((submission) => submission.studentId === studentId);
    if (!currentSubmission || currentSubmission.status === nextStatus) {
      setMessage("No change detected. This record already has that status.");
      setError(null);
      return;
    }

    const statusToSave =
      nextStatus === "SUBMITTED" && deadlinePassed
        ? "LATE"
        : nextStatus;
    const needsReason =
      currentSubmission.checkedAt !== null &&
      finalStatuses.has(currentSubmission.status) &&
      currentSubmission.status !== statusToSave;
    const note = needsReason
      ? window.prompt("Give a short reason for correcting this homework record.")?.trim()
      : "";

    if (needsReason && !note) {
      setError("A reason is required before correcting an already checked homework record.");
      setMessage(null);
      return;
    }

    setActiveStudentId(studentId);
    setMessage(null);
    setError(null);

    startTransition(async () => {
      try {
        const result = await updateHomeworkSubmission({
          assignmentId,
          studentId,
          status: statusToSave,
          submittedAt: statusToSave === "SUBMITTED" || statusToSave === "LATE"
            ? new Date().toISOString()
            : null,
          note: note || null,
        });
        setSubmissions((current) =>
          current.map((submission) =>
            submission.studentId === studentId
              ? result.changed
                ? { ...submission, status: result.status, checkedAt: new Date().toISOString() }
                : submission
              : submission,
          ),
        );
        setMessage(result.message);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Could not save homework status.");
      } finally {
        setActiveStudentId(null);
      }
    });
  };

  const markPending = (nextStatus: HomeworkStatus) => {
    const statusToSave =
      nextStatus === "SUBMITTED" && deadlinePassed
        ? "LATE"
        : nextStatus;

    setBulkStatus(statusToSave);
    setActiveStudentId(null);
    setMessage(null);
    setError(null);

    startTransition(async () => {
      try {
        const result = await updateHomeworkSubmissionsBulk({
          assignmentId,
          status: statusToSave,
          onlyPending: true,
        });
        setSubmissions((current) =>
          current.map((submission) =>
            submission.status === "PENDING"
              ? { ...submission, status: statusToSave, checkedAt: new Date().toISOString() }
              : submission,
          ),
        );
        setMessage(
          result.updated > 0
            ? `${result.updated} pending record${result.updated === 1 ? "" : "s"} updated.`
            : "No pending homework records to update.",
        );
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Could not update homework records.");
      } finally {
        setBulkStatus(null);
      }
    });
  };

  if (submissions.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-3 text-xs font-semibold text-slate-400">
        No students found for this assignment yet.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase text-slate-400">Homework check</p>
          <p className="text-xs font-semibold text-slate-500">
            {counts.SUBMITTED + counts.LATE} submitted · {counts.MISSING} missing · {counts.PENDING} pending
          </p>
          {deadlinePassed && (
            <p className="mt-1 text-[11px] font-semibold text-amber-600">
              Deadline passed. New submissions are saved as late.
            </p>
          )}
        </div>
        <div className="grid grid-cols-1 gap-1 sm:flex sm:flex-wrap">
          <button
            type="button"
            disabled={isPending || counts.PENDING === 0}
            onClick={() => markPending("SUBMITTED")}
            className="rounded-lg bg-emerald-600 px-2.5 py-1.5 text-[11px] font-black text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {bulkStatus === "SUBMITTED" || bulkStatus === "LATE"
              ? "Saving..."
              : deadlinePassed
                ? "Mark pending late"
                : "Mark pending submitted"}
          </button>
          <button
            type="button"
            disabled={isPending || counts.PENDING === 0}
            onClick={() => markPending("MISSING")}
            className="rounded-lg bg-rose-50 px-2.5 py-1.5 text-[11px] font-black text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {bulkStatus === "MISSING" ? "Saving..." : "Mark pending missing"}
          </button>
        </div>
        {(message || error) && (
          <p className={`text-xs font-bold ${error ? "text-rose-600" : "text-emerald-600"}`}>
            {error ?? message}
          </p>
        )}
      </div>

      <div className="mt-3 grid gap-2">
        {submissions.map((submission) => {
          const saving = isPending && activeStudentId === submission.studentId;
          const buttonDisabled = (status: HomeworkStatus) => saving || submission.status === status;
          const submittedTitle = deadlinePassed ? "Mark late submission" : "Mark submitted";
          return (
            <div
              key={submission.id}
              className="flex flex-col gap-2 rounded-lg bg-white px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-slate-800">{submission.studentName}</p>
                <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-black ${statusTone[submission.status]}`}>
                  {statusLabel[submission.status]}
                </span>
              </div>
              <div className="grid grid-cols-4 gap-1 sm:flex sm:items-center">
                <button
                  type="button"
                  disabled={buttonDisabled(deadlinePassed ? "LATE" : "SUBMITTED")}
                  onClick={() => mark(submission.studentId, "SUBMITTED")}
                  className="inline-flex h-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50"
                  title={submittedTitle}
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                </button>
                <button
                  type="button"
                  disabled={buttonDisabled("MISSING")}
                  onClick={() => mark(submission.studentId, "MISSING")}
                  className="inline-flex h-8 items-center justify-center rounded-lg bg-rose-50 text-rose-700 transition hover:bg-rose-100 disabled:opacity-50"
                  title="Mark missing"
                >
                  <XCircle size={14} />
                </button>
                <button
                  type="button"
                  disabled={buttonDisabled("EXCUSED")}
                  onClick={() => mark(submission.studentId, "EXCUSED")}
                  className="inline-flex h-8 items-center justify-center rounded-lg bg-blue-50 text-blue-700 transition hover:bg-blue-100 disabled:opacity-50"
                  title="Mark excused"
                >
                  <Clock size={14} />
                </button>
                <button
                  type="button"
                  disabled={buttonDisabled("PENDING")}
                  onClick={() => mark(submission.studentId, "PENDING")}
                  className="inline-flex h-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600 transition hover:bg-slate-200 disabled:opacity-50"
                  title="Reset to pending"
                >
                  <RotateCcw size={14} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
