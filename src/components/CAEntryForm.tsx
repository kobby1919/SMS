"use client";

// src/components/CAEntryForm.tsx
// Batch CA entry form — class supervisor enters scores for all students
// in their class for one subject in one go.

import { useState, useEffect, useMemo, useTransition } from "react";
import {
  CheckCircle2, AlertCircle, Loader2, ChevronDown,
  BookOpen, Users, TrendingUp, Save, RefreshCw,
} from "lucide-react";
import { bulkUpsertCA } from "@/src/lib/actions/caActions";
import { getGradeBand, TERM_LABELS } from "@/src/lib/caGrades";
import type { Term } from "@/src/generated/prisma";

// ─── Types ────────────────────────────────────────────────────────────────────

type Student = {
  id:      string;
  name:    string;
  surname: string;
};

type Subject = {
  id:   number;
  name: string;
};

type CARow = {
  studentId:      string;
  classworkScore: string; // string while editing, coerced on submit
  examScore:      string;
  remarks:        string;
};

type RowEdit = Partial<Pick<CARow, "classworkScore" | "examScore" | "remarks">>;

type ExistingCA = {
  studentId:      string;
  subjectId:      number;
  term:           Term;
  academicYear:   string;
  classworkScore: number;
  examScore:      number;
  remarks:        string;
};

type ActivityCAContext = {
  subjectId: number;
  term: Term;
  academicYear: string;
};

type Props = {
  classId:      number;
  className:    string;
  students:     Student[];
  subjects:     Subject[];
  academicYears: string[];
  existingCA?:  ExistingCA[]; // pre-loaded when editing
  activityCAContexts?: ActivityCAContext[];
  onSuccess?:   () => void;
};

const buildRows = (
  students: Student[],
  existingCA: ExistingCA[],
  selectedSubjectId: number | "",
  selectedTerm: Term,
  selectedYear: string,
): CARow[] =>
  students.map((student) => {
    const existing = existingCA.find(
      (entry) =>
        entry.studentId === student.id &&
        entry.subjectId === selectedSubjectId &&
        entry.term === selectedTerm &&
        entry.academicYear === selectedYear,
    );
    return {
      studentId:      student.id,
      classworkScore: existing ? String(existing.classworkScore) : "",
      examScore:      existing ? String(existing.examScore)      : "",
      remarks:        existing ? existing.remarks                : "",
    };
  });

// ─── Live score preview (weighted total + grade) ──────────────────────────────
function ScorePreview({
  classwork, exam, cwWeight, exWeight,
}: {
  classwork: number; exam: number; cwWeight: number; exWeight: number;
}) {
  const total = (classwork * cwWeight) / 100 + (exam * exWeight) / 100;
  const band  = getGradeBand(total);
  return (
    <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border ${band.bg} ${band.border}`}>
      <span className={`text-xs font-black ${band.color}`}>{band.grade}</span>
      <span className={`text-[10px] font-semibold ${band.color} opacity-70`}>
        {Math.round(total * 10) / 10}
      </span>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
const CAEntryForm = ({
  classId, className, students, subjects, academicYears, existingCA = [], activityCAContexts = [], onSuccess,
}: Props) => {
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | "">("");
  const [selectedTerm,      setSelectedTerm]      = useState<Term>("TERM_2");
  const [selectedYear,      setSelectedYear]      = useState(academicYears[0] ?? "2024/25");
  const [caConfig,          setCAConfig]          = useState<{ classworkWeight: number; examWeight: number } | null>(null);
  const [configLoading,     setConfigLoading]     = useState(true);
  const [rowEdits,          setRowEdits]          = useState<Record<string, RowEdit>>({});
  const [apiError,          setApiError]          = useState<string | null>(null);
  const [success,           setSuccess]           = useState(false);
  const [isPending,         startTransition]      = useTransition();

  // Load CA config when year changes
  useEffect(() => {
    if (!selectedYear) return;
    fetch(`/api/ca/config?year=${encodeURIComponent(selectedYear)}`)
      .then((r) => r.json())
      .then((data) => {
        setCAConfig(
          data?.classworkWeight != null
            ? { classworkWeight: data.classworkWeight, examWeight: data.examWeight }
            : { classworkWeight: 30, examWeight: 70 } // fallback default
        );
      })
      .catch(() => setCAConfig({ classworkWeight: 30, examWeight: 70 }))
      .finally(() => setConfigLoading(false));
  }, [selectedYear]);

  const baseRows = useMemo(
    () => buildRows(students, existingCA, selectedSubjectId, selectedTerm, selectedYear),
    [students, existingCA, selectedSubjectId, selectedTerm, selectedYear]
  );

  const rows = useMemo(
    () => baseRows.map((row) => ({ ...row, ...rowEdits[row.studentId] })),
    [baseRows, rowEdits]
  );

  const updateRow = (idx: number, field: keyof CARow, value: string) => {
    if (activityCAEnabled && field === "classworkScore") return;
    const studentId = rows[idx]?.studentId;
    if (!studentId) return;
    setRowEdits((prev) => ({
      ...prev,
      [studentId]: { ...prev[studentId], [field]: value },
    }));
  };

  const handleSubmit = () => {
    setApiError(null);

    if (!selectedSubjectId) {
      setApiError("Please select a subject before saving.");
      return;
    }
    if (!caConfig) {
      setApiError("CA configuration not loaded. Please wait or refresh.");
      return;
    }

    // Validate all rows have valid numbers
    for (const row of rows) {
      const cw = parseFloat(row.classworkScore);
      const ex = parseFloat(row.examScore);
      if (row.classworkScore !== "" && (isNaN(cw) || cw < 0 || cw > (activityCAEnabled ? cwWeight : 100))) {
        setApiError(activityCAEnabled ? `Auto CA marks must be between 0 and ${cwWeight}.` : "All classwork scores must be between 0 and 100.");
        return;
      }
      if (row.examScore !== "" && (isNaN(ex) || ex < 0 || ex > (activityCAEnabled ? exWeight : 100))) {
        setApiError(activityCAEnabled ? `Exam scores must be between 0 and ${exWeight}.` : "All exam scores must be between 0 and 100.");
        return;
      }
    }

    // Only submit rows that have at least one score entered
    const filledRows = rows
      .filter((r) => activityCAEnabled ? r.examScore !== "" : r.classworkScore !== "" || r.examScore !== "")
      .map((r) => ({
        studentId:      r.studentId,
        classworkScore: parseFloat(r.classworkScore) || 0,
        examScore:      parseFloat(r.examScore)      || 0,
        remarks:        r.remarks,
      }));

    if (filledRows.length === 0) {
      setApiError(activityCAEnabled ? "Please enter at least one exam score before saving." : "Please enter at least one score before saving.");
      return;
    }

    startTransition(async () => {
      try {
        await bulkUpsertCA(
          filledRows,
          selectedSubjectId as number,
          classId,
          selectedTerm,
          selectedYear
        );
        setSuccess(true);
        setTimeout(() => { setSuccess(false); onSuccess?.(); }, 1800);
      } catch (e: unknown) {
        setApiError(e instanceof Error ? e.message : "Failed to save CA records.");
      }
    });
  };

  const cwWeight = caConfig?.classworkWeight ?? 30;
  const exWeight = caConfig?.examWeight      ?? 70;
  const activityCAEnabled = activityCAContexts.some(
    (context) =>
      context.subjectId === selectedSubjectId &&
      context.term === selectedTerm &&
      context.academicYear === selectedYear,
  );

  const filledCount = rows.filter((r) =>
    activityCAEnabled ? r.examScore !== "" : r.classworkScore !== "" && r.examScore !== "",
  ).length;

  const classAvg = (() => {
    const filled = rows.filter((r) =>
      activityCAEnabled ? r.classworkScore !== "" : r.classworkScore !== "" && r.examScore !== "",
    );
    if (filled.length === 0) return null;
    const total = filled.reduce((sum, r) => {
      const cw = parseFloat(r.classworkScore) || 0;
      const ex = parseFloat(r.examScore)      || 0;
      return sum + (activityCAEnabled ? cw + ex : (cw * cwWeight) / 100 + (ex * exWeight) / 100);
    }, 0);
    return Math.round((total / filled.length) * 10) / 10;
  })();

  return (
    <div className="flex flex-col gap-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-800 tracking-tight">CA Entry</h1>
          <p className="text-sm text-gray-400 mt-0.5 font-medium">
            {className} · {students.length} student{students.length !== 1 ? "s" : ""}
          </p>
        </div>
        {/* Live class average preview */}
        {classAvg !== null && (
          <div className={`px-4 py-2.5 rounded-2xl border ${getGradeBand(classAvg).bg} ${getGradeBand(classAvg).border}`}>
            <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">Class Avg</p>
            <p className={`text-2xl font-black leading-none mt-0.5 ${getGradeBand(classAvg).color}`}>
              {classAvg}%
            </p>
            <p className={`text-[10px] font-bold ${getGradeBand(classAvg).color} opacity-70`}>
              {getGradeBand(classAvg).grade} · {getGradeBand(classAvg).label}
            </p>
          </div>
        )}
      </div>

      {/* Status messages */}
      {apiError && (
        <div className="flex items-start gap-2.5 p-3.5 bg-rose-50 border border-rose-200 rounded-xl">
          <AlertCircle size={15} className="text-rose-500 shrink-0 mt-0.5" />
          <p className="text-xs font-semibold text-rose-700">{apiError}</p>
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2.5 p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl">
          <CheckCircle2 size={15} className="text-emerald-500" />
          <p className="text-xs font-semibold text-emerald-700">
            CA records saved successfully!
          </p>
        </div>
      )}

      {/* Context selectors */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">

        {/* Subject */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-gray-500 font-black uppercase tracking-wider flex items-center gap-1.5">
            <BookOpen size={11} /> Subject
          </label>
          <div className="relative">
            <select
              value={selectedSubjectId}
              onChange={(e) => {
                setSelectedSubjectId(Number(e.target.value) || "");
                setRowEdits({});
              }}
              className="w-full appearance-none ring-[1.5px] ring-gray-200 px-3 py-2.5 rounded-xl text-sm font-semibold text-gray-700 focus:ring-indigo-500 outline-none bg-white pr-8"
            >
              <option value="">Select subject…</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
        </div>

        {/* Term */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-gray-500 font-black uppercase tracking-wider">Term</label>
          <div className="relative">
            <select
              value={selectedTerm}
              onChange={(e) => {
                setSelectedTerm(e.target.value as Term);
                setRowEdits({});
              }}
              className="w-full appearance-none ring-[1.5px] ring-gray-200 px-3 py-2.5 rounded-xl text-sm font-semibold text-gray-700 focus:ring-indigo-500 outline-none bg-white pr-8"
            >
              {Object.entries(TERM_LABELS).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
        </div>

        {/* Academic year */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-gray-500 font-black uppercase tracking-wider">Academic Year</label>
          <div className="relative">
            <select
              value={selectedYear}
              onChange={(e) => {
                setSelectedYear(e.target.value);
                setConfigLoading(true);
              }}
              className="w-full appearance-none ring-[1.5px] ring-gray-200 px-3 py-2.5 rounded-xl text-sm font-semibold text-gray-700 focus:ring-indigo-500 outline-none bg-white pr-8"
            >
              {academicYears.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* CA weight config info pill */}
      {caConfig && (
        <div className={`flex items-center gap-3 p-3 border rounded-xl ${activityCAEnabled ? "bg-emerald-50 border-emerald-100" : "bg-indigo-50 border-indigo-100"}`}>
          <TrendingUp size={14} className={`${activityCAEnabled ? "text-emerald-500" : "text-indigo-500"} shrink-0`} />
          {configLoading ? (
            <p className="text-xs text-indigo-600 font-semibold">Loading weights…</p>
          ) : (
            <p className="text-xs text-indigo-700 font-semibold">
              CA Weights for <span className="font-black">{selectedYear}</span>:&nbsp;
              Classwork = <span className="font-black">{cwWeight}%</span> &nbsp;·&nbsp;
              Exam = <span className="font-black">{exWeight}%</span>
            </p>
          )}
        </div>
      )}

      {activityCAEnabled && (
        <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
          Activity-based CA is active for this subject. Edujay has locked manual CA entry here. The CA values below are computed from recorded activities; teachers should enter only exam scores on this screen.
        </div>
      )}

      {/* Progress indicator */}
      <div className="flex items-center gap-3">
        <Users size={13} className="text-gray-400" />
        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-indigo-400 rounded-full transition-all duration-300"
            style={{ width: students.length > 0 ? `${(filledCount / students.length) * 100}%` : "0%" }}
          />
        </div>
        <span className="text-xs font-bold text-gray-400">{filledCount}/{students.length}</span>
      </div>

      {/* Score table */}
      {students.length === 0 ? (
        <div className="py-10 text-center text-gray-300 font-semibold text-sm">
          No students in this class.
        </div>
      ) : (
        <div className="border border-gray-100 rounded-2xl overflow-hidden">
          <div className="w-full overflow-x-auto">
          {/* Table header */}
          <div className="grid min-w-[720px] grid-cols-[2fr_1fr_1fr_1fr_2fr] gap-2 px-4 py-3 bg-gray-50 border-b border-gray-100">
            <span className="text-xs font-black uppercase tracking-wider text-gray-400">Student</span>
            <span className="text-xs font-black uppercase tracking-wider text-gray-400">
              {activityCAEnabled ? `Auto CA (${cwWeight})` : `Classwork (${cwWeight}%)`}
            </span>
            <span className="text-xs font-black uppercase tracking-wider text-gray-400">
              Exam ({exWeight}%)
            </span>
            <span className="text-xs font-black uppercase tracking-wider text-gray-400">Total / Grade</span>
            <span className="text-xs font-black uppercase tracking-wider text-gray-400">Remarks</span>
          </div>

          {/* Rows */}
          <div className="min-w-[720px] divide-y divide-gray-50 max-h-[420px] overflow-y-auto">
            {rows.map((row, idx) => {
              const student = students[idx];
              const cw = parseFloat(row.classworkScore);
              const ex = parseFloat(row.examScore);
              const bothValid = !isNaN(cw) && !isNaN(ex) && cw >= 0 && cw <= (activityCAEnabled ? cwWeight : 100) && ex >= 0 && ex <= (activityCAEnabled ? exWeight : 100);

              return (
                <div
                  key={row.studentId}
                  className="grid grid-cols-[2fr_1fr_1fr_1fr_2fr] gap-2 px-4 py-3 items-center hover:bg-gray-50/50 transition-colors"
                >
                  {/* Student name */}
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center text-[10px] font-black text-indigo-600 shrink-0">
                      {student.name[0]}{student.surname[0]}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-gray-800 truncate">
                        {student.name} {student.surname}
                      </p>
                    </div>
                  </div>

                  {/* Classwork score */}
                  <input
                    type="number"
                    min={0}
                    max={activityCAEnabled ? cwWeight : 100}
                    step={0.5}
                    placeholder="—"
                    value={row.classworkScore}
                    onChange={(e) => updateRow(idx, "classworkScore", e.target.value)}
                    disabled={activityCAEnabled}
                    className={`ring-[1.5px] p-2 rounded-xl text-sm font-bold text-center outline-none transition-all w-full ${
                      activityCAEnabled
                        ? "ring-emerald-100 bg-emerald-50 text-emerald-700"
                        : "ring-gray-200 text-gray-800 focus:ring-indigo-500"
                    }`}
                  />

                  {/* Exam score */}
                  <input
                    type="number"
                    min={0}
                    max={activityCAEnabled ? exWeight : 100}
                    step={0.5}
                    placeholder="—"
                    value={row.examScore}
                    onChange={(e) => updateRow(idx, "examScore", e.target.value)}
                    className="ring-[1.5px] ring-gray-200 p-2 rounded-xl text-sm font-bold text-gray-800 text-center focus:ring-indigo-500 outline-none transition-all w-full"
                  />

                  {/* Live grade preview */}
                  <div className="flex justify-center">
                    {bothValid && caConfig ? (
                      <ScorePreview
                        classwork={cw} exam={ex}
                        cwWeight={activityCAEnabled ? 100 : cwWeight}
                        exWeight={activityCAEnabled ? 100 : exWeight}
                      />
                    ) : (
                      <span className="text-xs text-gray-300 font-bold">—</span>
                    )}
                  </div>

                  {/* Remarks */}
                  <input
                    type="text"
                    placeholder="Optional note…"
                    value={row.remarks}
                    maxLength={120}
                    onChange={(e) => updateRow(idx, "remarks", e.target.value)}
                    className="ring-[1.5px] ring-gray-100 p-2 rounded-xl text-xs text-gray-600 focus:ring-indigo-500 outline-none transition-all w-full"
                  />
                </div>
              );
            })}
          </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3 pt-2">
        <button
          type="button"
          onClick={() =>
            setRowEdits(
              Object.fromEntries(
                rows.map((row) => [
                  row.studentId,
                  activityCAEnabled
                    ? { examScore: "", remarks: "" }
                    : { classworkScore: "", examScore: "", remarks: "" },
                ])
              )
            )
          }
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-100 text-gray-600 text-sm font-bold hover:bg-gray-200 transition-colors"
        >
          <RefreshCw size={13} /> Clear
        </button>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={isPending || !selectedSubjectId}
          className="flex-1 bg-indigo-600 text-white py-2.5 rounded-xl font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isPending ? (
            <><Loader2 size={15} className="animate-spin" /> Saving…</>
          ) : (
            <><Save size={15} /> Save {filledCount > 0 ? `${filledCount} Record${filledCount !== 1 ? "s" : ""}` : "Records"}</>
          )}
        </button>
      </div>
    </div>
  );
};

export default CAEntryForm;
