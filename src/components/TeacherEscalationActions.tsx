"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  reviewTeacherEscalationWithState,
  type TeacherEscalationActionState,
} from "@/src/lib/actions/teacherEscalationActions";

const initialState: TeacherEscalationActionState = {
  status: "idle",
  message: "",
};

function EscalationButton({
  value,
  label,
  tone,
}: {
  value: "ACKNOWLEDGE" | "RESOLVE" | "DISMISS";
  label: string;
  tone: "slate" | "green" | "amber";
}) {
  const { pending } = useFormStatus();
  const toneClass = {
    slate: "border-slate-200 bg-slate-950 text-white hover:bg-slate-800",
    green: "border-emerald-200 bg-emerald-600 text-white hover:bg-emerald-700",
    amber: "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100",
  }[tone];

  return (
    <button
      type="submit"
      name="action"
      value={value}
      disabled={pending}
      className={`rounded-lg border px-3 py-2 text-xs font-black transition disabled:cursor-not-allowed disabled:opacity-60 ${toneClass}`}
    >
      {pending ? "Saving..." : label}
    </button>
  );
}

export default function TeacherEscalationActions({
  escalationId,
}: {
  escalationId: string;
}) {
  const [state, formAction] = useActionState(
    reviewTeacherEscalationWithState,
    initialState,
  );

  return (
    <form action={formAction} className="mt-4 rounded-lg border border-slate-100 bg-slate-50 p-3">
      <input type="hidden" name="escalationId" value={escalationId} />
      <label className="block">
        <span className="text-xs font-black uppercase tracking-wide text-slate-400">
          Management note
        </span>
        <textarea
          name="note"
          rows={2}
          required
          minLength={5}
          maxLength={500}
          placeholder="Example: Called teacher and confirmed attendance will be corrected by admin."
          className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none transition focus:border-sky-400"
        />
      </label>
      <div className="mt-3 flex flex-wrap gap-2">
        <EscalationButton value="ACKNOWLEDGE" label="Acknowledge" tone="slate" />
        <EscalationButton value="RESOLVE" label="Resolve" tone="green" />
        <EscalationButton value="DISMISS" label="Dismiss" tone="amber" />
      </div>
      {state.message ? (
        <p
          className={`mt-2 text-xs font-bold ${
            state.status === "error" ? "text-rose-600" : "text-emerald-700"
          }`}
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
