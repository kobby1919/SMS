"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Send } from "lucide-react";
import {
  submitTeacherEscalationResponseWithState,
  type TeacherEscalationActionState,
} from "@/src/lib/actions/teacherEscalationActions";

const initialState: TeacherEscalationActionState = {
  status: "idle",
  message: "",
};

function statusCopy(status: string | null) {
  if (status === "PENDING") return "Your response is waiting for management review.";
  if (status === "APPROVED") return "Management approved this response.";
  if (status === "REJECTED") return "Management rejected this response.";
  if (status === "NEEDS_MORE_INFO") return "Management needs more information.";
  if (status === "CANCELLED") return "This response was cancelled.";
  return null;
}

export default function TeacherEscalationResponseForm({
  obligationId,
  existingStatus,
  existingReason,
  closeHref = "/teacher/accountability",
}: {
  obligationId: string;
  existingStatus: string | null;
  existingReason: string | null;
  closeHref?: string;
}) {
  const [state, formAction, pending] = useActionState(
    submitTeacherEscalationResponseWithState,
    initialState,
  );
  const isLocked =
    existingStatus === "PENDING" ||
    existingStatus === "APPROVED" ||
    existingStatus === "REJECTED" ||
    existingStatus === "CANCELLED";
  const copy = statusCopy(existingStatus);

  return (
    <div className="mt-4 min-w-0 rounded-xl border border-edujay-ring bg-white p-3 shadow-sm sm:p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <h3 className="text-sm font-black text-edujay-ink">
            Respond to management
          </h3>
          <p className="text-xs font-semibold leading-relaxed text-slate-500">
            Tell management what happened and what action you need next.
          </p>
        </div>
        <Link
          href={closeHref}
          className="inline-flex w-fit rounded-lg bg-slate-100 px-3 py-2 text-xs font-black text-slate-600 transition hover:bg-slate-200"
        >
          Close
        </Link>
      </div>

      {copy ? (
        <div
          className={`mt-3 rounded-lg px-3 py-2 text-xs font-bold ${
            existingStatus === "NEEDS_MORE_INFO"
              ? "bg-amber-50 text-amber-700"
              : "bg-slate-50 text-slate-600"
          }`}
        >
          {copy}
          {existingReason ? (
            <span className="mt-1 block font-semibold text-slate-500">
              Last note: {existingReason}
            </span>
          ) : null}
        </div>
      ) : null}

      {isLocked ? null : (
        <form action={formAction} className="mt-4 grid min-w-0 gap-3">
          <input type="hidden" name="obligationId" value={obligationId} />

          <div className="grid min-w-0 gap-3 lg:grid-cols-2">
            <label className="grid min-w-0 gap-1 text-xs font-black uppercase tracking-wide text-slate-500">
              Response type
              <select
                name="responseType"
                className="h-11 min-w-0 rounded-lg border border-edujay-border bg-white px-3 text-sm font-semibold normal-case tracking-normal text-edujay-ink outline-none focus:border-edujay-primary"
                defaultValue="EXPLANATION"
              >
                <option value="EXPLANATION">Explanation only</option>
                <option value="CORRECTION_REQUEST">Request correction</option>
              </select>
              <span className="max-w-full whitespace-normal break-words normal-case tracking-normal text-[11px] font-semibold leading-relaxed text-slate-400">
                Pick explanation when you only need to account for the issue. Pick correction when a record must be reopened.
              </span>
            </label>

            <label className="grid min-w-0 gap-1 text-xs font-black uppercase tracking-wide text-slate-500">
              Requested action
              <select
                name="requestedAction"
                className="h-11 min-w-0 rounded-lg border border-edujay-border bg-white px-3 text-sm font-semibold normal-case tracking-normal text-edujay-ink outline-none focus:border-edujay-primary"
                defaultValue="ADMIN_REVIEW"
              >
                <option value="ADMIN_REVIEW">Review explanation</option>
                <option value="ALLOW_LATE_ENTRY">Allow late entry</option>
                <option value="MARK_AS_RESOLVED">Close as fixed</option>
                <option value="OTHER">Other support</option>
              </select>
              <span className="max-w-full whitespace-normal break-words normal-case tracking-normal text-[11px] font-semibold leading-relaxed text-slate-400">
                Choose the exact decision you want the headmaster, owner, or admin to make.
              </span>
            </label>
          </div>

          <label className="grid min-w-0 gap-1 text-xs font-black uppercase tracking-wide text-slate-500">
            Explanation
            <textarea
              name="reason"
              rows={4}
              className="resize-none rounded-lg border border-edujay-border bg-white px-3 py-2 text-sm font-semibold normal-case leading-relaxed tracking-normal text-edujay-ink outline-none focus:border-edujay-primary"
              placeholder="Example: I was unable to mark attendance because the timetable was changed after the lesson started."
              defaultValue={existingStatus === "NEEDS_MORE_INFO" ? existingReason ?? "" : ""}
              required
            />
          </label>

          <label className="grid min-w-0 gap-1 text-xs font-black uppercase tracking-wide text-slate-500">
            Evidence link
            <input
              name="evidenceUrl"
              type="url"
              className="h-11 min-w-0 rounded-lg border border-edujay-border bg-white px-3 text-sm font-semibold normal-case tracking-normal text-edujay-ink outline-none focus:border-edujay-primary"
              placeholder="Optional link to proof or document"
            />
            <span className="max-w-full whitespace-normal break-words normal-case tracking-normal text-[11px] font-semibold leading-relaxed text-slate-400">
              Optional. Add only when there is a photo, document, or shared file that supports your explanation.
            </span>
          </label>

          {state.message ? (
            <p
              className={`rounded-lg px-3 py-2 text-xs font-bold ${
                state.status === "success"
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-rose-50 text-rose-700"
              }`}
            >
              {state.message}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={pending}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-edujay-ink px-4 py-3 text-sm font-black text-white transition hover:bg-edujay-primaryDark disabled:cursor-not-allowed disabled:opacity-60 sm:w-fit"
          >
            <Send size={14} />
            {pending ? "Sending..." : "Send to management"}
          </button>
        </form>
      )}
    </div>
  );
}
