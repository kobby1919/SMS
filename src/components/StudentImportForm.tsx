"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, CheckCircle2, Upload } from "lucide-react";
import {
  importStudentsWithState,
  type StudentImportState,
} from "@/src/lib/actions/studentImportActions";

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 sm:w-auto"
    >
      <Upload size={15} />
      {pending ? "Importing..." : "Import students"}
    </button>
  );
}

export default function StudentImportForm() {
  const initialState: StudentImportState = { ok: false, message: null };
  const [state, formAction] = useActionState(importStudentsWithState, initialState);

  return (
    <form action={formAction} className="grid gap-4 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <div>
        <label className="text-xs font-black uppercase tracking-wide text-gray-500" htmlFor="student-import-file">
          CSV file
        </label>
        <input
          id="student-import-file"
          name="file"
          type="file"
          accept=".csv,text/csv"
          required
          className="mt-2 block w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 text-sm font-bold text-gray-700 file:mr-4 file:rounded-lg file:border-0 file:bg-slate-900 file:px-3 file:py-2 file:text-xs file:font-black file:text-white focus:border-indigo-400 focus:bg-white focus:outline-none"
        />
      </div>

      <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-800">
        Edujay imports the whole file only when every row is clean. No partial import, no student login account, no casual duplicate.
      </div>

      <SubmitButton />

      {state.message ? (
        <div
          className={`rounded-xl border px-4 py-3 text-sm font-bold ${
            state.ok
              ? "border-emerald-100 bg-emerald-50 text-emerald-700"
              : "border-rose-100 bg-rose-50 text-rose-700"
          }`}
        >
          <div className="flex items-start gap-2">
            {state.ok ? <CheckCircle2 size={16} className="mt-0.5 shrink-0" /> : <AlertCircle size={16} className="mt-0.5 shrink-0" />}
            <div>
              <p>{state.message}</p>
              {state.result ? (
                <p className="mt-1 text-xs opacity-80">
                  {state.result.parentsCreated} guardian record{state.result.parentsCreated === 1 ? "" : "s"} created · {state.result.parentsLinked} guardian link{state.result.parentsLinked === 1 ? "" : "s"} reused.
                </p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {state.errors?.length ? (
        <div className="rounded-xl border border-rose-100 bg-white p-4">
          <p className="text-xs font-black uppercase tracking-wide text-rose-600">Rows to fix</p>
          <ul className="mt-2 grid gap-1 text-xs font-semibold text-gray-600">
            {state.errors.map((error) => (
              <li key={error}>• {error}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </form>
  );
}
