"use client";

// src/components/finance/FeeStructureCreateForm.tsx
// Form to create a new fee structure. Redirects to the detail page after creation.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createFeeStructure } from "@/src/lib/actions/feeStructureActions";
import type { Term } from "@/src/generated/prisma";
import { AlertCircle, Loader2, ChevronDown } from "lucide-react";

const TERM_LABELS: Record<string, string> = {
  TERM_1: "Term 1",
  TERM_2: "Term 2",
  TERM_3: "Term 3",
};

type Props = {
  grades:        { id: number; level: string }[];
  academicYears: string[];
};

const FeeStructureCreateForm = ({ grades, academicYears }: Props) => {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [title,        setTitle]        = useState("");
  const [description,  setDescription]  = useState("");
  const [gradeId,      setGradeId]      = useState<number | "">("");
  const [term,         setTerm]         = useState("TERM_1");
  const [academicYear, setAcademicYear] = useState(academicYears[0] ?? "");

  // Auto-generate a sensible title when grade/term/year are selected
  const autoTitle = () => {
    const grade = grades.find((g) => g.id === gradeId);
    if (grade && term && academicYear) {
      return `${grade.level} — ${TERM_LABELS[term]} ${academicYear} Fees`;
    }
    return "";
  };

  const handleGradeChange = (val: string) => {
    const id = Number(val) || "";
    setGradeId(id);
    if (!title) setTitle(autoTitle());
  };

  const handleSubmit = () => {
    setError(null);
    if (!gradeId)        { setError("Please select a grade.");          return; }
    if (!academicYear)   { setError("Please select an academic year."); return; }
    if (!title.trim())   { setError("Title is required.");              return; }

    startTransition(async () => {
      try {
        const structure = await createFeeStructure({
          title:        title.trim(),
          description:  description.trim() || undefined,
          gradeId:      gradeId as number,
          term:         term as Term,
          academicYear: academicYear.trim(),
        });
        router.push(`/list/finance/fee-structures/${structure.id}`);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Failed to create fee structure.");
      }
    });
  };

  return (
    <div className="flex flex-col gap-5">

      {error && (
        <div className="flex items-start gap-2.5 p-3.5 bg-rose-50 border border-rose-200 rounded-xl">
          <AlertCircle size={15} className="text-rose-500 shrink-0 mt-0.5" />
          <p className="text-xs font-semibold text-rose-700">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Grade */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-black uppercase tracking-wider text-gray-500">Grade Level *</label>
          <div className="relative">
            <select
              value={gradeId}
              onChange={(e) => handleGradeChange(e.target.value)}
              className="w-full appearance-none ring-[1.5px] ring-gray-200 px-3 py-3 rounded-xl text-sm font-semibold text-gray-700 focus:ring-violet-500 outline-none bg-white pr-8"
            >
              <option value="">Select grade…</option>
              {grades.map((g) => <option key={g.id} value={g.id}>{g.level}</option>)}
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
        </div>

        {/* Term */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-black uppercase tracking-wider text-gray-500">Term *</label>
          <div className="relative">
            <select
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              className="w-full appearance-none ring-[1.5px] ring-gray-200 px-3 py-3 rounded-xl text-sm font-semibold text-gray-700 focus:ring-violet-500 outline-none bg-white pr-8"
            >
              {Object.entries(TERM_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
        </div>

        {/* Academic year */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-black uppercase tracking-wider text-gray-500">Academic Year *</label>
          <div className="relative">
            <select
              value={academicYear}
              onChange={(e) => setAcademicYear(e.target.value)}
              className="w-full appearance-none ring-[1.5px] ring-gray-200 px-3 py-3 rounded-xl text-sm font-semibold text-gray-700 focus:ring-violet-500 outline-none bg-white pr-8"
            >
              {academicYears.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
        </div>

        {/* Title */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-black uppercase tracking-wider text-gray-500">Title *</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={autoTitle() || "e.g. JHS 2 — Term 1 2025/26 Fees"}
            className="ring-[1.5px] ring-gray-200 px-3 py-3 rounded-xl text-sm font-semibold text-gray-700 focus:ring-violet-500 outline-none"
          />
        </div>
      </div>

      {/* Description */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-black uppercase tracking-wider text-gray-500">
          Description <span className="font-normal normal-case text-gray-300">(optional)</span>
        </label>
        <textarea
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Any notes about this fee structure…"
          className="ring-[1.5px] ring-gray-200 px-3 py-3 rounded-xl text-sm text-gray-700 focus:ring-violet-500 outline-none resize-none"
        />
      </div>

      <button
        type="button"
        onClick={handleSubmit}
        disabled={isPending}
        className="bg-violet-600 text-white py-3 rounded-xl font-bold shadow-lg shadow-violet-100 hover:bg-violet-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {isPending
          ? <><Loader2 size={15} className="animate-spin" /> Creating…</>
          : "Create Structure & Add Fee Items →"
        }
      </button>
    </div>
  );
};

export default FeeStructureCreateForm;
