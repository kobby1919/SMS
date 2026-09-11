"use client";

import { useActionState, useState } from "react";
import {
  closeParentTeacherContactRequestAsAdminWithState,
  escalateParentTeacherContactRequestAsAdminWithState,
  type ParentTeacherContactActionState,
} from "@/src/lib/actions/parentTeacherContactActions";

const initialState: ParentTeacherContactActionState = {
  status: "idle",
  message: "",
};

function ActionMessage({ state }: { state: ParentTeacherContactActionState }) {
  if (!state.message) return null;

  return (
    <p
      className={`rounded-md px-3 py-2 text-sm font-bold ${
        state.status === "success"
          ? "bg-emerald-50 text-emerald-700"
          : "bg-rose-50 text-rose-700"
      }`}
    >
      {state.message}
    </p>
  );
}

export default function AdminContactRequestActions({
  requestId,
  isEscalated,
}: {
  requestId: string;
  isEscalated: boolean;
}) {
  const [note, setNote] = useState("");
  const [escalateState, escalateAction, isEscalating] = useActionState(
    escalateParentTeacherContactRequestAsAdminWithState,
    initialState,
  );
  const [closeState, closeAction, isClosing] = useActionState(
    closeParentTeacherContactRequestAsAdminWithState,
    initialState,
  );
  const isPending = isEscalating || isClosing;

  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
      <label className="text-xs font-black uppercase tracking-[0.12em] text-gray-500" htmlFor={`note-${requestId}`}>
        Admin note
      </label>
      <textarea
        id={`note-${requestId}`}
        name="note"
        form={`escalate-${requestId}`}
        rows={3}
        value={note}
        onChange={(event) => setNote(event.target.value)}
        placeholder="Optional note for the parent and teacher..."
        className="mt-2 w-full resize-none rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-slate-900"
        maxLength={500}
      />
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <form id={`escalate-${requestId}`} action={escalateAction} className="flex-1">
          <input type="hidden" name="requestId" value={requestId} />
          <button
            type="submit"
            disabled={isPending || isEscalated}
            className="w-full rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-black text-white transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            {isEscalated ? "Already escalated" : isEscalating ? "Escalating..." : "Escalate"}
          </button>
        </form>
        <form action={closeAction} className="flex-1">
          <input type="hidden" name="requestId" value={requestId} />
          <input type="hidden" name="note" value={note} />
          <button
            type="submit"
            disabled={isPending}
            className="w-full rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            {isClosing ? "Closing..." : "Close request"}
          </button>
        </form>
      </div>
      <div className="mt-3 space-y-2">
        <ActionMessage state={escalateState} />
        <ActionMessage state={closeState} />
      </div>
    </div>
  );
}
