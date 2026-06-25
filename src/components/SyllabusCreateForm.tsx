"use client";

// src/components/SyllabusCreateForm.tsx

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSyllabus } from "@/src/lib/actions/syllabusActions";
import { TERM_LABELS } from "@/src/lib/caGrades";
import { AlertCircle, Loader2, BookMarked, ChevronDown } from "lucide-react";
import type { Term } from "@/src/generated/prisma";

type Props = {
  subjects:      { id: number; name: string }[];
  grades:        { id: number; level: string }[];
  academicYears: string[];
};

const SelectField = ({
  label, value, onChange, children,
}: {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) => (
  <div className="flex flex-col gap-1.5">
    <label className="text-xs font-black uppercase tracking-wider text-gray-500">{label}</label>
    <div className="relative">
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full appearance-none ring-[1.5px] ring-gray-200 px-3 py-3 rounded-xl text-sm font-semibold text-gray-700 focus:ring-violet-500 outline-none bg-white pr-8"
      >
        {children}
      </select>
      <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
    </div>
  </div>
);

const SyllabusCreateForm = ({ subjects, grades, academicYears }: Props) => {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [subjectId,    setSubjectId]    = useState<number | "">("");
  const [gradeId,      setGradeId]      = useState<number | "">("");
  const [term,         setTerm]         = useState("TERM_1");
  const [academicYear, setAcademicYear] = useState(academicYears[0] ?? "");
  const [description,  setDescription]  = useState("");

  const handleSubmit = () => {
    setError(null);
    if (!subjectId)    { setError("Please select a subject.");       return; }
    if (!gradeId)      { setError("Please select a grade.");         return; }
    if (!academicYear) { setError("Please select an academic year."); return; }

    startTransition(async () => {
      try {
        const s = await createSyllabus({
          subjectId:    subjectId as number,
          gradeId:      gradeId   as number,
          term:         term as Term,
          academicYear,
          description,
        });
        router.push(`/list/syllabus/${s.id}/edit`);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Failed to create syllabus.");
      }
    });
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3 p-4 bg-violet-50 border border-violet-100 rounded-xl">
        <BookMarked size={16} className="text-violet-500 shrink-0" />
        <p className="text-xs text-violet-700 font-semibold leading-relaxed">
          After creating the syllabus you&apos;ll be taken straight to the editor to add topics. 
          The syllabus starts as a <strong>Draft</strong> — publish it when all topics are ready.
        </p>
      </div>

      {error && (
        <div className="flex items-start gap-2.5 p-3.5 bg-rose-50 border border-rose-200 rounded-xl">
          <AlertCircle size={15} className="text-rose-500 shrink-0 mt-0.5" />
          <p className="text-xs font-semibold text-rose-700">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <SelectField label="Subject" value={subjectId} onChange={(v) => setSubjectId(Number(v) || "")}>
          <option value="">Select subject…</option>
          {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </SelectField>

        <SelectField label="Grade Level" value={gradeId} onChange={(v) => setGradeId(Number(v) || "")}>
          <option value="">Select grade…</option>
          {grades.map((g) => <option key={g.id} value={g.id}>{g.level}</option>)}
        </SelectField>

        <SelectField label="Term" value={term} onChange={setTerm}>
          {Object.entries(TERM_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </SelectField>

        <SelectField label="Academic Year" value={academicYear} onChange={setAcademicYear}>
          {academicYears.map((y) => <option key={y} value={y}>{y}</option>)}
        </SelectField>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-black uppercase tracking-wider text-gray-500">
          Overview / Description <span className="font-normal normal-case text-gray-300">(optional)</span>
        </label>
        <textarea
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Brief description of what this syllabus covers…"
          className="ring-[1.5px] ring-gray-200 p-3 rounded-xl text-sm text-gray-700 focus:ring-violet-500 outline-none resize-none"
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
          : "Create Syllabus & Add Topics →"
        }
      </button>
    </div>
  );
};

export default SyllabusCreateForm;
