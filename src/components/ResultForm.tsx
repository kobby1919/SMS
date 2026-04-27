"use client";

// src/components/ResultForm.tsx

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AlertCircle, CheckCircle2, Loader2, TrendingUp } from "lucide-react";
import { createResult, updateResult } from "@/src/lib/actions/actions";

// ─── Schema ───────────────────────────────────────────────────────────────────
const schema = z.object({
  studentId:    z.string().min(1, "Student is required"),
  assessmentId: z.string().min(1, "Exam or assignment is required"),
  assessmentType: z.enum(["exam", "assignment"]),
  score: z.coerce
    .number("Score must be a number")
    .int("Score must be a whole number")
    .min(0,   "Score cannot be below 0")
    .max(100, "Score cannot exceed 100"),
});

type Inputs = z.infer<typeof schema>;

type Student = { id: string; name: string; surname: string; className: string };
type ExamOption = {
  id: number; title: string; type: "exam" | "assignment";
  subjectName: string; className: string; date: string;
};

// ─── Grade band ───────────────────────────────────────────────────────────────
const getGrade = (score: number) => {
  if (score >= 80) return { grade: "A", label: "Excellent",     color: "text-emerald-700", bg: "bg-emerald-50", bar: "bg-emerald-400" };
  if (score >= 70) return { grade: "B", label: "Good",          color: "text-blue-700",    bg: "bg-blue-50",    bar: "bg-blue-400"    };
  if (score >= 60) return { grade: "C", label: "Average",       color: "text-amber-700",   bg: "bg-amber-50",   bar: "bg-amber-400"   };
  if (score >= 50) return { grade: "D", label: "Below Average", color: "text-orange-700",  bg: "bg-orange-50",  bar: "bg-orange-400"  };
  return               { grade: "F", label: "Fail",            color: "text-rose-700",    bg: "bg-rose-50",    bar: "bg-rose-400"    };
};

// ─── Component ────────────────────────────────────────────────────────────────
const ResultForm = ({
  type,
  data,
  onSuccess,
}: {
  type:       "create" | "update";
  data?:      any;
  onSuccess?: () => void;
}) => {
  const [students,    setStudents]    = useState<Student[]>([]);
  const [assessments, setAssessments] = useState<ExamOption[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [submitting,  setSubmitting]  = useState(false);
  const [apiError,    setApiError]    = useState<string | null>(null);
  const [success,     setSuccess]     = useState(false);
  const [studentSearch, setStudentSearch] = useState("");
  const [assessSearch,  setAssessSearch]  = useState("");

  // Determine initial assessment type + id from existing data
  const initType = data?.examId ? "exam" : data?.assignmentId ? "assignment" : "exam";
  const initId   = String(data?.examId ?? data?.assignmentId ?? "");

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<Inputs>({
    resolver: zodResolver(schema) as any,
    defaultValues: {
      studentId:      data?.studentId     ?? "",
      assessmentId:   initId,
      assessmentType: initType,
      score:          data?.score         ?? (undefined as any),
    },
  });

  const score          = watch("score");
  const assessmentType = watch("assessmentType");
  const studentId      = watch("studentId");
  const assessmentId   = watch("assessmentId");

  const grade = score >= 0 && score <= 100 ? getGrade(Number(score)) : null;

  useEffect(() => {
    const load = async () => {
      try {
        const [stuRes, examRes, assignRes] = await Promise.all([
          fetch("/api/form-data/students"),
          fetch("/api/form-data/exams"),
          fetch("/api/form-data/assignments"),
        ]);
        const [stus, exams, assigns] = await Promise.all([
          stuRes.json(), examRes.json(), assignRes.json(),
        ]);
        setStudents(stus);
        setAssessments([
          ...exams.map((e: any)   => ({ ...e, type: "exam"       as const })),
          ...assigns.map((a: any) => ({ ...a, type: "assignment" as const })),
        ]);
      } catch {
        setApiError("Failed to load form data. Please refresh.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filteredStudents = students.filter((s) =>
    `${s.name} ${s.surname} ${s.className}`.toLowerCase().includes(studentSearch.toLowerCase())
  );

  const filteredAssessments = assessments.filter(
    (a) =>
      a.type === assessmentType &&
      `${a.title} ${a.subjectName} ${a.className}`.toLowerCase().includes(assessSearch.toLowerCase())
  );

  const selectedStudent   = students.find((s) => s.id === studentId);
  const selectedAssessment = assessments.find(
    (a) => String(a.id) === assessmentId && a.type === assessmentType
  );

  const onSubmit = async (formData: Inputs) => {
    setApiError(null);
    setSubmitting(true);
    try {
      const payload = {
        ...(type === "update" && data?.id ? { id: data.id } : {}),
        score:        formData.score,
        studentId:    formData.studentId,
        examId:       formData.assessmentType === "exam"       ? parseInt(formData.assessmentId) : null,
        assignmentId: formData.assessmentType === "assignment" ? parseInt(formData.assessmentId) : null,
      };

      if (type === "create") await createResult(payload);
      else                   await updateResult(payload);

      setSuccess(true);
      setTimeout(() => { setSuccess(false); onSuccess?.(); }, 1200);
    } catch (e: any) {
      setApiError(e?.message ?? "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3">
        <div className="w-8 h-8 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
        <p className="text-sm text-gray-400 font-medium">Loading form data…</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">

      <h1 className="text-2xl font-black text-gray-800 tracking-tight">
        {type === "create" ? "Record New Result" : "Update Result"}
      </h1>

      {apiError && (
        <div className="flex items-start gap-2.5 p-3.5 bg-rose-50 border border-rose-200 rounded-xl">
          <AlertCircle size={15} className="text-rose-500 shrink-0 mt-0.5" />
          <p className="text-xs font-semibold text-rose-700">{apiError}</p>
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2.5 p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl">
          <CheckCircle2 size={15} className="text-emerald-500" />
          <p className="text-xs font-semibold text-emerald-700">Result {type === "create" ? "recorded" : "updated"}!</p>
        </div>
      )}

      {/* Assessment type toggle */}
      <div className="flex flex-col gap-2">
        <label className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Assessment Type</label>
        <div className="flex bg-gray-100 p-1 rounded-xl gap-1 w-fit">
          {(["exam", "assignment"] as const).map((t) => (
            <label key={t} className="cursor-pointer">
              <input type="radio" value={t} {...register("assessmentType")} className="sr-only peer" />
              <div className="px-5 py-2 rounded-lg text-sm font-bold capitalize transition-all cursor-pointer
                peer-checked:bg-white peer-checked:text-indigo-600 peer-checked:shadow-sm text-gray-400 hover:text-gray-600">
                {t}
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Assessment picker */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <label className="text-xs text-gray-500 font-semibold uppercase tracking-wider">
            Select {assessmentType === "exam" ? "Exam" : "Assignment"}
          </label>
          {selectedAssessment && (
            <span className="text-[11px] font-bold px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-lg">
              {selectedAssessment.subjectName} · {selectedAssessment.className}
            </span>
          )}
        </div>
        <input
          type="text"
          placeholder={`Search ${assessmentType}s…`}
          value={assessSearch}
          onChange={(e) => setAssessSearch(e.target.value)}
          className="ring-[1.5px] ring-gray-200 p-2.5 rounded-xl text-sm focus:ring-indigo-500 outline-none"
        />
        <div className="max-h-[180px] overflow-y-auto border border-gray-200 rounded-xl divide-y divide-gray-50">
          {filteredAssessments.length === 0 ? (
            <div className="py-6 text-center text-sm text-gray-400">
              No {assessmentType}s found
            </div>
          ) : (
            filteredAssessments.map((a) => {
              const isSelected = String(a.id) === assessmentId && a.type === assessmentType;
              return (
                <label
                  key={`${a.type}-${a.id}`}
                  className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors
                    ${isSelected ? "bg-indigo-50" : "bg-white hover:bg-gray-50"}`}
                >
                  <input
                    type="radio"
                    value={a.id}
                    {...register("assessmentId")}
                    className="sr-only"
                  />
                  <div className="flex-1 min-w-0">
                    <p className={`font-bold text-sm ${isSelected ? "text-indigo-700" : "text-gray-800"}`}>
                      {a.title}
                    </p>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      {a.subjectName} · {a.className} ·{" "}
                      {new Date(a.date).toLocaleDateString("en-GH", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                  </div>
                  {isSelected && <CheckCircle2 size={14} className="text-indigo-500 shrink-0" />}
                </label>
              );
            })
          )}
        </div>
        {errors.assessmentId && <p className="text-[10px] text-red-500 font-medium">{errors.assessmentId.message}</p>}
      </div>

      {/* Student picker */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <label className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Student</label>
          {selectedStudent && (
            <span className="text-[11px] font-bold px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded-lg">
              {selectedStudent.name} {selectedStudent.surname} · {selectedStudent.className}
            </span>
          )}
        </div>
        <input
          type="text"
          placeholder="Search student by name or class…"
          value={studentSearch}
          onChange={(e) => setStudentSearch(e.target.value)}
          className="ring-[1.5px] ring-gray-200 p-2.5 rounded-xl text-sm focus:ring-indigo-500 outline-none"
        />
        <div className="max-h-[180px] overflow-y-auto border border-gray-200 rounded-xl divide-y divide-gray-50">
          {filteredStudents.length === 0 ? (
            <div className="py-6 text-center text-sm text-gray-400">No students found</div>
          ) : (
            filteredStudents.map((s) => {
              const isSelected = s.id === studentId;
              return (
                <label
                  key={s.id}
                  className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors
                    ${isSelected ? "bg-emerald-50" : "bg-white hover:bg-gray-50"}`}
                >
                  <input
                    type="radio"
                    value={s.id}
                    {...register("studentId")}
                    className="sr-only"
                  />
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black shrink-0
                    ${isSelected ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
                    {s.name[0]}{s.surname[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`font-bold text-sm ${isSelected ? "text-emerald-700" : "text-gray-800"}`}>
                      {s.name} {s.surname}
                    </p>
                    <p className="text-[11px] text-gray-400">{s.className}</p>
                  </div>
                  {isSelected && <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />}
                </label>
              );
            })
          )}
        </div>
        {errors.studentId && <p className="text-[10px] text-red-500 font-medium">{errors.studentId.message}</p>}
      </div>

      {/* Score input with live grade preview */}
      <div className="flex flex-col gap-2">
        <label className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Score (0–100)</label>
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-[160px]">
            <input
              type="number"
              min={0}
              max={100}
              {...register("score")}
              placeholder="e.g. 78"
              className="w-full ring-[1.5px] ring-gray-200 p-2.5 rounded-xl text-2xl font-black text-gray-800 focus:ring-indigo-500 outline-none transition-all text-center"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 font-bold text-sm">/100</span>
          </div>

          {/* Live grade badge */}
          {grade && score >= 0 && score <= 100 && (
            <div className={`flex flex-col items-center px-5 py-3 rounded-2xl ${grade.bg}`}>
              <span className={`text-3xl font-black ${grade.color}`}>{grade.grade}</span>
              <span className={`text-[10px] font-bold uppercase tracking-wide ${grade.color} opacity-70`}>
                {grade.label}
              </span>
            </div>
          )}
        </div>

        {/* Score bar */}
        {grade && score >= 0 && score <= 100 && (
          <div className="flex items-center gap-3">
            <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${grade.bar}`}
                style={{ width: `${score}%` }}
              />
            </div>
            <div className="flex items-center gap-1">
              <TrendingUp size={11} className="text-gray-400" />
              <span className="text-[11px] font-bold text-gray-400">{score}%</span>
            </div>
          </div>
        )}

        {/* Grade scale reference */}
        <div className="flex gap-1.5 flex-wrap mt-1">
          {[
            { g: "A", range: "80–100", color: "bg-emerald-50 text-emerald-600" },
            { g: "B", range: "70–79",  color: "bg-blue-50 text-blue-600"       },
            { g: "C", range: "60–69",  color: "bg-amber-50 text-amber-600"     },
            { g: "D", range: "50–59",  color: "bg-orange-50 text-orange-600"   },
            { g: "F", range: "0–49",   color: "bg-rose-50 text-rose-600"       },
          ].map((b) => (
            <span key={b.g} className={`text-[10px] font-bold px-2 py-0.5 rounded-lg ${b.color}`}>
              {b.g}: {b.range}
            </span>
          ))}
        </div>

        {errors.score && <p className="text-[10px] text-red-500 font-medium">{errors.score.message}</p>}
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="bg-indigo-600 text-white py-3 rounded-xl font-bold shadow-lg hover:bg-indigo-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {submitting && <Loader2 size={16} className="animate-spin" />}
        {submitting ? "Saving…" : type === "create" ? "Record Result" : "Update Result"}
      </button>
    </form>
  );
};

export default ResultForm;
