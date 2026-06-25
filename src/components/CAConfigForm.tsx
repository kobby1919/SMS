"use client";

// src/components/CAConfigForm.tsx
// Admin form to create / update CA weight configuration for an academic year.

import { useState, useTransition } from "react";
import { upsertCAConfig } from "@/src/lib/actions/caActions";
import { CheckCircle2, AlertCircle, Loader2, Plus } from "lucide-react";

type Config = {
  id:              number;
  academicYear:    string;
  classworkWeight: number;
  examWeight:      number;
};

type Props = {
  existingConfigs: Config[];
};

const CAConfigForm = ({ existingConfigs }: Props) => {
  const [academicYear,    setAcademicYear]    = useState("");
  const [classworkWeight, setClassworkWeight] = useState(30);
  const [examWeight,      setExamWeight]      = useState(70);
  const [error,           setError]           = useState<string | null>(null);
  const [success,         setSuccess]         = useState<string | null>(null);
  const [isPending,       startTransition]    = useTransition();

  // Keep exam = 100 - classwork
  const handleClassworkChange = (val: number) => {
    const clamped = Math.max(0, Math.min(100, val));
    setClassworkWeight(clamped);
    setExamWeight(100 - clamped);
  };

  // Load existing config for editing
  const loadExisting = (config: Config) => {
    setAcademicYear(config.academicYear);
    setClassworkWeight(config.classworkWeight);
    setExamWeight(config.examWeight);
  };

  const handleSubmit = () => {
    setError(null);
    setSuccess(null);

    if (!academicYear.trim()) {
      setError("Academic year is required (e.g. 2024/25).");
      return;
    }
    if (classworkWeight + examWeight !== 100) {
      setError("Classwork and exam weights must sum to 100.");
      return;
    }

    startTransition(async () => {
      try {
        await upsertCAConfig({ academicYear: academicYear.trim(), classworkWeight, examWeight });
        setSuccess(`Configuration for ${academicYear} saved successfully!`);
        setAcademicYear("");
        setClassworkWeight(30);
        setExamWeight(70);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Failed to save configuration.");
      }
    });
  };

  // Live preview
  const exampleCW   = 80;
  const exampleExam = 65;
  const preview     = Math.round((exampleCW * classworkWeight) / 100 + (exampleExam * examWeight) / 100);

  return (
    <div className="flex flex-col gap-5">
      <h2 className="text-lg font-black text-gray-800">
        {existingConfigs.length === 0 ? "Create First Configuration" : "Add / Update Configuration"}
      </h2>

      {error && (
        <div className="flex items-start gap-2.5 p-3.5 bg-rose-50 border border-rose-200 rounded-xl">
          <AlertCircle size={15} className="text-rose-500 shrink-0 mt-0.5" />
          <p className="text-xs font-semibold text-rose-700">{error}</p>
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2.5 p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl">
          <CheckCircle2 size={15} className="text-emerald-500" />
          <p className="text-xs font-semibold text-emerald-700">{success}</p>
        </div>
      )}

      {/* Quick-load existing */}
      {existingConfigs.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-black uppercase tracking-wider text-gray-400">
            Edit existing year
          </label>
          <div className="flex flex-wrap gap-2">
            {existingConfigs.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => loadExisting(c)}
                className="text-xs font-bold px-3 py-1.5 rounded-xl bg-gray-100 text-gray-600 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
              >
                {c.academicYear}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Academic year input */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-black uppercase tracking-wider text-gray-500">
          Academic Year
        </label>
        <input
          type="text"
          placeholder="e.g. 2025/26"
          value={academicYear}
          onChange={(e) => setAcademicYear(e.target.value)}
          className="ring-[1.5px] ring-gray-200 p-3 rounded-xl text-sm font-semibold text-gray-700 focus:ring-indigo-500 outline-none"
        />
      </div>

      {/* Classwork weight slider */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-black uppercase tracking-wider text-gray-500">
            Classwork Weight
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              max={100}
              value={classworkWeight}
              onChange={(e) => handleClassworkChange(parseInt(e.target.value) || 0)}
              className="w-16 text-center ring-[1.5px] ring-gray-200 py-1 rounded-xl text-sm font-black text-indigo-600 focus:ring-indigo-500 outline-none"
            />
            <span className="text-sm font-black text-gray-400">%</span>
          </div>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={classworkWeight}
          onChange={(e) => handleClassworkChange(parseInt(e.target.value))}
          className="w-full h-2 rounded-full accent-indigo-600 cursor-pointer"
        />
        <div className="flex justify-between text-[10px] text-gray-300 font-bold">
          <span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span>
        </div>
      </div>

      {/* Exam weight (auto-computed) */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-black uppercase tracking-wider text-gray-500">
            Exam Weight <span className="text-[10px] font-semibold text-gray-300 normal-case">(auto)</span>
          </label>
          <div className="flex items-center gap-2">
            <span className="w-16 text-center py-1 rounded-xl text-sm font-black text-emerald-600 bg-emerald-50 border border-emerald-100">
              {examWeight}
            </span>
            <span className="text-sm font-black text-gray-400">%</span>
          </div>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald-400 rounded-full transition-all"
            style={{ width: `${examWeight}%` }}
          />
        </div>
      </div>

      {/* Visual split */}
      <div className="flex flex-col gap-2">
        <p className="text-xs font-black uppercase tracking-wider text-gray-400">Split Preview</p>
        <div className="flex h-5 rounded-full overflow-hidden">
          <div
            className="bg-indigo-400 flex items-center justify-center transition-all"
            style={{ width: `${classworkWeight}%` }}
          >
            {classworkWeight >= 15 && (
              <span className="text-[9px] font-black text-white">{classworkWeight}%</span>
            )}
          </div>
          <div
            className="bg-emerald-400 flex items-center justify-center transition-all"
            style={{ width: `${examWeight}%` }}
          >
            {examWeight >= 15 && (
              <span className="text-[9px] font-black text-white">{examWeight}%</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 text-[10px] text-gray-400 font-semibold">
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-400 inline-block" />
            Classwork
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block" />
            Exam
          </span>
        </div>
      </div>

      {/* Live example */}
      <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
        <p className="text-xs font-black uppercase tracking-wider text-gray-400 mb-2">Live Example</p>
        <p className="text-xs text-gray-500 leading-relaxed">
          Classwork score: <span className="font-black text-gray-700">{exampleCW}</span> ·
          Exam score: <span className="font-black text-gray-700">{exampleExam}</span>
        </p>
        <p className="text-xs text-gray-500 mt-1">
          Total = ({exampleCW} × {classworkWeight}%) + ({exampleExam} × {examWeight}%) ={" "}
          <span className="font-black text-indigo-700 text-base">{preview}%</span>
        </p>
      </div>

      <button
        type="button"
        onClick={handleSubmit}
        disabled={isPending}
        className="bg-indigo-600 text-white py-3 rounded-xl font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {isPending ? (
          <><Loader2 size={15} className="animate-spin" /> Saving…</>
        ) : (
          <><Plus size={15} /> Save Configuration</>
        )}
      </button>
    </div>
  );
};

export default CAConfigForm;
