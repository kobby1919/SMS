"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  acknowledgeParentTeacherContactRequestWithState,
  closeParentTeacherContactRequestWithState,
  respondToParentTeacherContactRequestWithState,
  type ParentTeacherContactActionState,
} from "@/src/lib/actions/parentTeacherContactActions";

const initialState: ParentTeacherContactActionState = {
  status: "idle",
  message: "",
};

function SubmitButton({
  label,
  pendingLabel,
  variant = "dark",
}: {
  label: string;
  pendingLabel: string;
  variant?: "dark" | "light";
}) {
  const { pending } = useFormStatus();

  return (
    <button
      disabled={pending}
      className={`rounded-xl px-4 py-2 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-60 ${
        variant === "dark"
          ? "bg-slate-950 text-white hover:bg-slate-800"
          : "bg-white text-slate-800 ring-1 ring-slate-200 hover:bg-slate-50"
      }`}
    >
      {pending ? pendingLabel : label}
    </button>
  );
}

function StatusMessage({ state }: { state: ParentTeacherContactActionState }) {
  if (state.status === "idle") return null;

  return (
    <p
      role="status"
      className={`rounded-xl px-3 py-2 text-xs font-black ${
        state.status === "success" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
      }`}
    >
      {state.message}
    </p>
  );
}

export default function TeacherContactRequestActions({
  requestId,
  canAcknowledge,
  canClose,
}: {
  requestId: string;
  canAcknowledge: boolean;
  canClose: boolean;
}) {
  const [ackState, ackAction] = useActionState(acknowledgeParentTeacherContactRequestWithState, initialState);
  const [respondState, respondAction] = useActionState(respondToParentTeacherContactRequestWithState, initialState);
  const [closeState, closeAction] = useActionState(closeParentTeacherContactRequestWithState, initialState);

  return (
    <div className="mt-4 space-y-3">
      <div className="flex flex-wrap gap-2">
        {canAcknowledge && (
          <form action={ackAction}>
            <input type="hidden" name="requestId" value={requestId} />
            <SubmitButton label="Acknowledge" pendingLabel="Acknowledging..." variant="light" />
          </form>
        )}
        {canClose && (
          <form action={closeAction}>
            <input type="hidden" name="requestId" value={requestId} />
            <SubmitButton label="Close" pendingLabel="Closing..." variant="light" />
          </form>
        )}
      </div>
      <div className="flex flex-col gap-2">
        <StatusMessage state={ackState} />
        <StatusMessage state={closeState} />
      </div>
      <form action={respondAction} className="rounded-2xl border border-slate-100 bg-white p-3">
        <input type="hidden" name="requestId" value={requestId} />
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-black uppercase tracking-wide text-gray-400">Teacher response</span>
          <textarea
            name="response"
            rows={3}
            maxLength={1000}
            placeholder="Write a clear response parents can understand."
            className="resize-none rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold outline-none focus:border-sky-400"
          />
        </label>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <StatusMessage state={respondState} />
          <SubmitButton label="Send response" pendingLabel="Sending..." />
        </div>
      </form>
    </div>
  );
}
