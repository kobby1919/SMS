"use client";

import { useMemo, useState, useTransition } from "react";
import { CheckCircle2, Clock, Loader2, XCircle } from "lucide-react";
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
  const [correctionDraft, setCorrectionDraft] = useState<{
    studentId: string;
    status: HomeworkStatus;
    reason: string;
    mode: "CORRECTION" | "EXCUSE";
  } | null>(null);
  const [isPending, startTransition] = useTransition();
  const deadlinePassed = isPastDeadline(dueDate);
  const canCheckHomework = deadlinePassed;

  const counts = useMemo(() => {
    return submissions.reduce(
      (acc, submission) => {
        acc[submission.status] += 1;
        return acc;
      },
      { PENDING: 0, SUBMITTED: 0, LATE: 0, MISSING: 0, EXCUSED: 0 } satisfies Record<HomeworkStatus, number>,
    );
  }, [submissions]);

  const submitMark = (studentId: string, nextStatus: HomeworkStatus, note: string | null = null) => {
    setActiveStudentId(studentId);
    setMessage(null);
    setError(null);

    startTransition(async () => {
      try {
        const result = await updateHomeworkSubmission({
          assignmentId,
          studentId,
          status: nextStatus,
          submittedAt: nextStatus === "SUBMITTED" || nextStatus === "LATE"
            ? new Date().toISOString()
            : null,
          note,
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
        setCorrectionDraft(null);
        setMessage(result.message);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Could not save homework status.");
      } finally {
        setActiveStudentId(null);
      }
    });
  };

  const mark = (studentId: string, nextStatus: HomeworkStatus) => {
    if (!canCheckHomework) {
      setError("Homework is still open. Check submissions after the due date so the record stays fair.");
      setMessage(null);
      return;
    }

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
    const needsExcuseNote = statusToSave === "EXCUSED";

    if (needsReason || needsExcuseNote) {
      setCorrectionDraft({
        studentId,
        status: statusToSave,
        reason: "",
        mode: needsReason ? "CORRECTION" : "EXCUSE",
      });
      setMessage(null);
      setError(null);
      return;
    }

    submitMark(studentId, statusToSave);
  };

  const markPending = (nextStatus: HomeworkStatus) => {
    if (!canCheckHomework) {
      setError("Homework is still open. Bulk checks are available after the due date.");
      setMessage(null);
      return;
    }

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
          {!deadlinePassed && (
            <p className="mt-1 text-[11px] font-semibold text-indigo-600">
              Homework is still open. Submission checks unlock after the due date.
            </p>
          )}
        </div>
        <div className="grid grid-cols-1 gap-1 sm:flex sm:flex-wrap">
          <button
            type="button"
            disabled={isPending || counts.PENDING === 0 || !canCheckHomework}
            onClick={() => markPending("SUBMITTED")}
            className="rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-black text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {bulkStatus === "SUBMITTED" || bulkStatus === "LATE"
              ? "Saving..."
              : "Mark pending submitted"}
          </button>
          <button
            type="button"
            disabled={isPending || counts.PENDING === 0 || !canCheckHomework}
            onClick={() => markPending("MISSING")}
            className="rounded-xl bg-rose-50 px-4 py-2.5 text-xs font-black text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
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
          const buttonDisabled = (status: HomeworkStatus) => saving || !canCheckHomework || submission.status === status;
          const submittedTitle = deadlinePassed ? "Mark late submission" : "Mark submitted";
          return (
            <div
              key={submission.id}
              className="rounded-xl bg-white px-4 py-3"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="break-words text-sm font-black text-slate-800">{submission.studentName}</p>
                  <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-black ${statusTone[submission.status]}`}>
                    {statusLabel[submission.status]}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 sm:flex sm:items-center">
                  <button
                    type="button"
                    disabled={buttonDisabled(deadlinePassed ? "LATE" : "SUBMITTED")}
                    onClick={() => mark(submission.studentId, "SUBMITTED")}
                    className="inline-flex h-10 min-w-10 items-center justify-center rounded-xl bg-emerald-50 px-3 text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                    title={submittedTitle}
                  >
                    {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                  </button>
                  <button
                    type="button"
                    disabled={buttonDisabled("MISSING")}
                    onClick={() => mark(submission.studentId, "MISSING")}
                    className="inline-flex h-10 min-w-10 items-center justify-center rounded-xl bg-rose-50 px-3 text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
                    title="Mark missing"
                  >
                    <XCircle size={14} />
                  </button>
                  <button
                    type="button"
                    disabled={buttonDisabled("EXCUSED")}
                    onClick={() => mark(submission.studentId, "EXCUSED")}
                    className="inline-flex h-10 min-w-10 items-center justify-center rounded-xl bg-blue-50 px-3 text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
                    title="Mark excused"
                  >
                    <Clock size={14} />
                  </button>
                </div>
              </div>
              {correctionDraft?.studentId === submission.studentId ? (
                <div className="mt-3 rounded-xl border border-amber-100 bg-amber-50 p-3">
                  <p className="text-xs font-black uppercase text-amber-700">
                    {correctionDraft.mode === "CORRECTION"
                      ? "Request admin approval"
                      : "Excuse reason required"}
                  </p>
                  <p className="mt-1 text-xs font-semibold leading-relaxed text-amber-700">
                    {correctionDraft.mode === "CORRECTION"
                      ? "This homework was already checked. Edujay will send this change to admin first and keep the saved status unchanged until approval."
                      : "Explain why this homework is excused before saving."}
                  </p>
                  <textarea
                    value={correctionDraft.reason}
                    onChange={(event) =>
                      setCorrectionDraft({ ...correctionDraft, reason: event.target.value })
                    }
                    rows={3}
                    placeholder="Type the reason clearly..."
                    className="mt-2 w-full resize-none rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                  />
                  <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => setCorrectionDraft(null)}
                      className="rounded-xl bg-white px-3 py-2.5 text-xs font-black text-slate-600 ring-1 ring-slate-200 transition hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={saving || correctionDraft.reason.trim().length < 5}
                      onClick={() => submitMark(submission.studentId, correctionDraft.status, correctionDraft.reason.trim())}
                      className="rounded-xl bg-slate-950 px-3 py-2.5 text-xs font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {correctionDraft.mode === "CORRECTION" ? "Send to admin" : "Save excused"}
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
