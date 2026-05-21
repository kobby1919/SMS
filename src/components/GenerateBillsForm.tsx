"use client";

// src/components/finance/GenerateBillsForm.tsx
// Two-step bill generation:
//   Step 1: Bursar selects classes + optional items toggle → sees live preview
//   Step 2: Confirms → bills generated → success screen with counts

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Users, CheckCircle2, AlertCircle,
  Loader2, ArrowRight, ChevronRight,
} from "lucide-react";
import { generateBills } from "@/src/lib/actions/billActions";
import { formatGHS } from "@/src/lib/constants/finance";

type ClassData = {
  id:            number;
  name:          string;
  studentCount:  number;
  alreadyBilled: number;
  newCount:      number;
};

type Props = {
  feeStructureId:  number;
  classes:         ClassData[];
  mandatoryTotal:  number;
  optionalTotal:   number;
  hasOptionalItems: boolean;
};

type Step = "select" | "confirm" | "done";

const GenerateBillsForm = ({
  feeStructureId,
  classes,
  mandatoryTotal,
  optionalTotal,
  hasOptionalItems,
}: Props) => {
  const router = useRouter();
  const [step,            setStep]            = useState<Step>("select");
  const [selectedClasses, setSelectedClasses] = useState<number[]>([]);
  const [includeOptional, setIncludeOptional] = useState(false);
  const [error,           setError]           = useState<string | null>(null);
  const [result,          setResult]          = useState<{ created: number; skipped: number } | null>(null);
  const [isPending,       startTransition]    = useTransition();

  const toggleClass = (id: number) => {
    setSelectedClasses((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  const selectAll = () => setSelectedClasses(classes.map((c) => c.id));
  const clearAll  = () => setSelectedClasses([]);

  // Live preview calculations
  const selectedData    = classes.filter((c) => selectedClasses.includes(c.id));
  const totalNewBills   = selectedData.reduce((s, c) => s + c.newCount, 0);
  const totalSkipped    = selectedData.reduce((s, c) => s + c.alreadyBilled, 0);
  const perStudentTotal = mandatoryTotal + (includeOptional ? optionalTotal : 0);
  const grandTotal      = totalNewBills * perStudentTotal;

  const handleConfirm = () => {
    setError(null);
    if (selectedClasses.length === 0) {
      setError("Please select at least one class.");
      return;
    }
    if (totalNewBills === 0) {
      setError("All students in the selected classes already have bills for this structure.");
      return;
    }
    setStep("confirm");
  };

  const handleGenerate = () => {
    setError(null);
    startTransition(async () => {
      try {
        const res = await generateBills({
          feeStructureId,
          classIds:             selectedClasses,
          includeOptionalItems: includeOptional,
        });
        setResult(res);
        setStep("done");
      } catch (e: any) {
        setError(e?.message ?? "Failed to generate bills.");
        setStep("select");
      }
    });
  };

  // ── Done screen ────────────────────────────────────────────────────────────
  if (step === "done" && result) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 flex flex-col items-center text-center gap-4">
        <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center">
          <CheckCircle2 size={32} className="text-emerald-500" />
        </div>
        <div>
          <h2 className="text-xl font-black text-gray-800">Bills Generated Successfully</h2>
          <p className="text-sm text-gray-400 mt-1">
            {result.created} bill{result.created !== 1 ? "s" : ""} created
            {result.skipped > 0 && ` · ${result.skipped} skipped (already existed)`}
          </p>
        </div>
        <div className="flex items-center gap-3 mt-2">
          <button
            type="button"
            onClick={() => router.push("/list/finance/bills")}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-colors shadow-sm"
          >
            View All Bills <ChevronRight size={14} />
          </button>
          <button
            type="button"
            onClick={() => router.push(`/list/finance/fee-structures/${feeStructureId}`)}
            className="px-5 py-2.5 bg-gray-100 text-gray-600 rounded-xl text-sm font-bold hover:bg-gray-200 transition-colors"
          >
            Back to Structure
          </button>
        </div>
      </div>
    );
  }

  // ── Confirm screen ─────────────────────────────────────────────────────────
  if (step === "confirm") {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col gap-5">
        <h2 className="text-lg font-black text-gray-800">Confirm Bill Generation</h2>

        {error && (
          <div className="flex items-start gap-2.5 p-3.5 bg-rose-50 border border-rose-200 rounded-xl">
            <AlertCircle size={15} className="text-rose-500 shrink-0 mt-0.5" />
            <p className="text-xs font-semibold text-rose-700">{error}</p>
          </div>
        )}

        {/* Summary table */}
        <div className="rounded-2xl border border-gray-100 overflow-hidden">
          <div className="grid grid-cols-4 gap-2 px-4 py-3 bg-gray-50 border-b border-gray-100">
            {["Class", "Students", "Already Billed", "New Bills"].map((h) => (
              <p key={h} className="text-[10px] font-black uppercase tracking-wider text-gray-400">{h}</p>
            ))}
          </div>
          <div className="divide-y divide-gray-50">
            {selectedData.map((cls) => (
              <div key={cls.id} className="grid grid-cols-4 gap-2 px-4 py-3">
                <p className="text-sm font-bold text-gray-800">{cls.name}</p>
                <p className="text-sm text-gray-600">{cls.studentCount}</p>
                <p className="text-sm text-amber-600 font-semibold">{cls.alreadyBilled}</p>
                <p className="text-sm text-emerald-600 font-black">{cls.newCount}</p>
              </div>
            ))}
          </div>
          {/* Totals */}
          <div className="grid grid-cols-4 gap-2 px-4 py-3 bg-indigo-50 border-t border-indigo-100">
            <p className="text-sm font-black text-indigo-900">Total</p>
            <p className="text-sm font-black text-indigo-900">
              {selectedData.reduce((s, c) => s + c.studentCount, 0)}
            </p>
            <p className="text-sm font-black text-indigo-900">{totalSkipped}</p>
            <p className="text-sm font-black text-indigo-900">{totalNewBills}</p>
          </div>
        </div>

        {/* Financial summary */}
        <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-2xl">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-bold text-indigo-800">Amount per student</p>
            <p className="text-sm font-black text-indigo-900">{formatGHS(perStudentTotal)}</p>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-base font-black text-indigo-900">Total amount to be billed</p>
            <p className="text-xl font-black text-indigo-700">{formatGHS(grandTotal)}</p>
          </div>
          {includeOptional && (
            <p className="text-[10px] text-indigo-500 mt-1.5 font-semibold">
              Includes optional fee items ({formatGHS(optionalTotal)} per student)
            </p>
          )}
        </div>

        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
          <p className="text-xs text-amber-700 font-semibold">
            ⚠️ Once generated, bills cannot be deleted. Students with existing bills for this
            structure will be skipped automatically.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setStep("select")}
            disabled={isPending}
            className="flex-1 py-3 bg-gray-100 text-gray-600 font-bold rounded-xl hover:bg-gray-200 transition-colors disabled:opacity-50 text-sm"
          >
            Back
          </button>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={isPending}
            className="flex-1 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2 text-sm shadow-lg shadow-indigo-100"
          >
            {isPending
              ? <><Loader2 size={15} className="animate-spin" /> Generating…</>
              : <><CheckCircle2 size={15} /> Generate {totalNewBills} Bill{totalNewBills !== 1 ? "s" : ""}</>
            }
          </button>
        </div>
      </div>
    );
  }

  // ── Select screen (default) ────────────────────────────────────────────────
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-black text-gray-800">Select Classes to Bill</h2>
        <div className="flex gap-2">
          <button type="button" onClick={selectAll} className="text-xs font-bold text-indigo-600 hover:text-indigo-700">
            Select all
          </button>
          <span className="text-gray-300">·</span>
          <button type="button" onClick={clearAll} className="text-xs font-bold text-gray-400 hover:text-gray-600">
            Clear
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2.5 p-3.5 bg-rose-50 border border-rose-200 rounded-xl">
          <AlertCircle size={15} className="text-rose-500 shrink-0 mt-0.5" />
          <p className="text-xs font-semibold text-rose-700">{error}</p>
        </div>
      )}

      {/* Class checkboxes */}
      <div className="flex flex-col gap-2">
        {classes.map((cls) => {
          const isSelected = selectedClasses.includes(cls.id);
          const allBilled  = cls.newCount === 0;

          return (
            <button
              key={cls.id}
              type="button"
              onClick={() => !allBilled && toggleClass(cls.id)}
              disabled={allBilled}
              className={`flex items-center gap-4 p-4 rounded-2xl border-2 transition-all text-left
                ${isSelected && !allBilled
                  ? "border-indigo-500 bg-indigo-50"
                  : allBilled
                  ? "border-gray-100 bg-gray-50 opacity-60 cursor-not-allowed"
                  : "border-gray-200 hover:border-indigo-300 bg-white"}`}
            >
              {/* Checkbox */}
              <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors
                ${isSelected && !allBilled ? "border-indigo-600 bg-indigo-600" : "border-gray-300 bg-white"}`}>
                {isSelected && !allBilled && (
                  <CheckCircle2 size={12} className="text-white" />
                )}
              </div>

              {/* Class icon */}
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black shrink-0
                ${isSelected && !allBilled ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-500"}`}>
                {cls.name.slice(0, 2).toUpperCase()}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-black text-gray-800">{cls.name}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">
                  {cls.studentCount} students total
                  {cls.alreadyBilled > 0 && ` · ${cls.alreadyBilled} already billed`}
                  {allBilled && " · All students already billed"}
                </p>
              </div>

              {/* New bill count */}
              {!allBilled && (
                <div className="text-right shrink-0">
                  <p className="text-lg font-black text-indigo-700">{cls.newCount}</p>
                  <p className="text-[10px] text-gray-400">new bills</p>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Optional items toggle */}
      {hasOptionalItems && (
        <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl">
          <label className="flex items-start gap-3 cursor-pointer">
            <div
              onClick={() => setIncludeOptional(!includeOptional)}
              className={`w-10 h-5 rounded-full transition-colors relative cursor-pointer shrink-0 mt-0.5
                ${includeOptional ? "bg-amber-500" : "bg-gray-200"}`}
            >
              <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all
                ${includeOptional ? "left-5" : "left-0.5"}`} />
            </div>
            <div>
              <p className="text-sm font-black text-amber-800">Include optional fee items</p>
              <p className="text-xs text-amber-700 mt-0.5">
                Adds optional fees (e.g. transport, feeding) to every student's bill in the
                selected classes. This adds {formatGHS(optionalTotal)} per student.
              </p>
            </div>
          </label>
        </div>
      )}

      {/* Live preview */}
      {selectedClasses.length > 0 && totalNewBills > 0 && (
        <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-2xl">
          <p className="text-xs font-black uppercase tracking-wider text-indigo-400 mb-2">Preview</p>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-indigo-700 font-semibold">
                <span className="font-black text-indigo-900 text-lg">{totalNewBills}</span> new bill{totalNewBills !== 1 ? "s" : ""} will be created
              </p>
              <p className="text-xs text-indigo-500 mt-0.5">
                {formatGHS(perStudentTotal)} per student
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-indigo-500">Total amount</p>
              <p className="text-xl font-black text-indigo-700">{formatGHS(grandTotal)}</p>
            </div>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={handleConfirm}
        disabled={selectedClasses.length === 0 || totalNewBills === 0}
        className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm shadow-lg shadow-indigo-100"
      >
        Preview & Confirm <ArrowRight size={15} />
      </button>
    </div>
  );
};

export default GenerateBillsForm;