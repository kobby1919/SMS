"use client";

// src/components/AssignmentForm.tsx

import { useEffect, useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  AlertCircle, CheckCircle2, Clock,
  Loader2, Calendar, Search, FileText,
} from "lucide-react";
import { createAssignment, updateAssignment } from "@/src/lib/actions/actions";

const schema = z.object({
  title:     z.string().min(1, "Title is required"),
  lessonId:  z.string().min(1, "Subject & class is required"),
  startDate: z.string().min(1, "Start date is required"),
  dueDate:   z.string().min(1, "Due date is required"),
}).refine((d) => new Date(d.dueDate) >= new Date(d.startDate), {
  message: "Due date must be on or after start date",
  path: ["dueDate"],
});

type Inputs = z.infer<typeof schema>;

type Lesson = {
  id:          number;
  day:         string;
  subjectName: string;
  className:   string;
  teacherName: string;
};

const DAY_ORDER: Record<string, number> = {
  MONDAY: 1, TUESDAY: 2, WEDNESDAY: 3, THURSDAY: 4, FRIDAY: 5,
};

const toDateInput = (val: any): string => {
  if (!val) return "";
  try { return new Date(val).toISOString().split("T")[0]; }
  catch { return ""; }
};

const extractLessonId = (data: any): string => {
  if (!data) return "";
  if (data.lessonId) return String(data.lessonId);
  if (data.lesson?.id) return String(data.lesson.id);
  return "";
};

const AssignmentForm = ({
  type,
  data,
  onSuccess,
}: {
  type:       "create" | "update";
  data?:      any;
  onSuccess?: () => void;
}) => {
  const [lessons,    setLessons]    = useState<Lesson[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [apiError,   setApiError]   = useState<string | null>(null);
  const [success,    setSuccess]    = useState(false);
  const [search,     setSearch]     = useState("");

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<Inputs>({
    resolver: zodResolver(schema),
    defaultValues: {
      title:     data?.title     ?? "",
      lessonId:  extractLessonId(data),
      startDate: toDateInput(data?.startDate),
      dueDate:   toDateInput(data?.dueDate),
    },
  });

  const selectedLessonId = watch("lessonId");
  const startDate        = watch("startDate");
  const dueDate          = watch("dueDate");

  const daysLeft = (() => {
    if (!startDate || !dueDate) return 0;
    return Math.ceil(
      (new Date(dueDate).getTime() - new Date(startDate).getTime()) / 86400000
    );
  })();

  // Fetch once on mount — never re-fetches on re-render
  useEffect(() => {
    let cancelled = false;
    fetch("/api/form-data/lessons")
      .then((r) => r.json())
      .then((d: Lesson[]) => {
        if (cancelled) return;
        setLessons(d);
        // Restore selected lessonId for update mode
        const lid = extractLessonId(data);
        if (lid) setValue("lessonId", lid, { shouldValidate: false });
      })
      .catch(() => {
        if (!cancelled) setApiError("Failed to load lessons.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  // Only run once — data is stable
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Stable handler — does NOT cause re-renders of the lesson list
  const handleLessonSelect = useCallback((id: string) => {
    setValue("lessonId", id, { shouldValidate: true });
  }, [setValue]);

  // Deduplicate by subjectId+classId (same subject may have multiple lesson slots)
  const deduped = lessons.reduce<Lesson[]>((acc, l) => {
    const key = `${l.subjectName}||${l.className}`;
    if (!acc.find((x) => `${x.subjectName}||${x.className}` === key)) acc.push(l);
    return acc;
  }, []);

  const filtered = deduped
    .filter((l) =>
      `${l.subjectName} ${l.className}`
        .toLowerCase()
        .includes(search.toLowerCase())
    )
    .sort((a, b) => {
      const cc = a.className.localeCompare(b.className);
      return cc !== 0 ? cc : (DAY_ORDER[a.day] ?? 0) - (DAY_ORDER[b.day] ?? 0);
    });

  const grouped = filtered.reduce<Record<string, Lesson[]>>((acc, l) => {
    if (!acc[l.className]) acc[l.className] = [];
    acc[l.className].push(l);
    return acc;
  }, {});

  const selectedLesson = deduped.find((l) => String(l.id) === selectedLessonId);

  const onSubmit = async (formData: Inputs) => {
    setApiError(null);
    setSubmitting(true);
    try {
      const payload = {
        ...(type === "update" && data?.id ? { id: data.id } : {}),
        title:     formData.title,
        lessonId:  parseInt(formData.lessonId),
        startDate: new Date(formData.startDate).toISOString(),
        dueDate:   new Date(formData.dueDate).toISOString(),
      };
      if (type === "create") await createAssignment(payload);
      else                   await updateAssignment(payload);
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
        <p className="text-sm text-gray-400 font-medium">Loading…</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">

      <div>
        <h1 className="text-2xl font-black text-gray-800 tracking-tight">
          {type === "create" ? "Give New Assignment" : "Update Assignment"}
        </h1>
        <p className="text-sm text-gray-400 mt-1">
          Pick the subject and class, set the title and due date.
        </p>
      </div>

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
            Assignment {type === "create" ? "created" : "updated"} successfully!
          </p>
        </div>
      )}

      {/* Title */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs text-gray-500 font-semibold uppercase tracking-wider flex items-center gap-1.5">
          <FileText size={12} /> Assignment Title
        </label>
        <input
          {...register("title")}
          placeholder="e.g. Chapter 5 Exercise, Essay on Independence"
          className="ring-[1.5px] ring-gray-200 p-2.5 rounded-xl text-sm focus:ring-indigo-500 outline-none transition-all"
        />
        {errors.title && (
          <p className="text-[10px] text-red-500 font-medium">{errors.title.message}</p>
        )}
      </div>

      {/* Subject & Class picker ── KEY FIX: no react-hook-form register on radio,
          instead use a plain controlled list + setValue to avoid re-render blanking */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <label className="text-xs text-gray-500 font-semibold uppercase tracking-wider">
            Subject & Class
          </label>
          {selectedLesson && (
            <span className="text-[11px] font-bold px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-lg">
              ✓ {selectedLesson.subjectName} · {selectedLesson.className}
            </span>
          )}
        </div>

        {/* Hidden input that react-hook-form tracks */}
        <input type="hidden" {...register("lessonId")} />

        {/* Search — controlled state, isolated from RHF */}
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by subject or class…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 ring-[1.5px] ring-gray-200 p-2.5 rounded-xl text-sm focus:ring-indigo-500 outline-none transition-all"
          />
        </div>

        {/* Lesson list — plain buttons, NOT radio inputs */}
        <div className="max-h-[220px] overflow-y-auto border border-gray-200 rounded-xl">
          {Object.keys(grouped).length === 0 ? (
            <div className="py-6 text-center text-sm text-gray-400">No subjects found</div>
          ) : (
            Object.entries(grouped).map(([className, classLessons]) => (
              <div key={className}>
                <div className="px-4 py-1.5 bg-gray-50 border-b border-gray-100 sticky top-0 z-10">
                  <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">
                    {className}
                  </p>
                </div>
                {classLessons.map((lesson) => {
                  const isSelected = String(lesson.id) === selectedLessonId;
                  return (
                    <button
                      key={lesson.id}
                      type="button"          // ← critical: prevents form submit
                      onClick={() => handleLessonSelect(String(lesson.id))}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors border-b border-gray-50 last:border-0
                        ${isSelected ? "bg-indigo-50" : "bg-white hover:bg-gray-50"}`}
                    >
                      <div className="flex-1 min-w-0">
                        <p className={`font-bold text-sm ${isSelected ? "text-indigo-700" : "text-gray-800"}`}>
                          {lesson.subjectName}
                        </p>
                        <p className="text-[11px] text-gray-400 mt-0.5">
                          Taught by {lesson.teacherName}
                        </p>
                      </div>
                      {isSelected && (
                        <CheckCircle2 size={15} className="text-indigo-500 shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
        {errors.lessonId && (
          <p className="text-[10px] text-red-500 font-medium">{errors.lessonId.message}</p>
        )}
      </div>

      {/* Dates */}
      <div className="flex flex-col gap-2">
        <label className="text-xs text-gray-500 font-semibold uppercase tracking-wider">
          Start & Due Date
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-[11px] text-gray-400 font-semibold flex items-center gap-1.5">
              <Calendar size={11} /> Assigned Date
            </label>
            <input
              type="date"
              {...register("startDate")}
              className="ring-[1.5px] ring-gray-200 p-2.5 rounded-xl text-sm focus:ring-indigo-500 outline-none transition-all"
            />
            {errors.startDate && (
              <p className="text-[10px] text-red-500 font-medium">{errors.startDate.message}</p>
            )}
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] text-gray-400 font-semibold flex items-center gap-1.5">
              <Clock size={11} /> Due Date
            </label>
            <input
              type="date"
              {...register("dueDate")}
              className="ring-[1.5px] ring-gray-200 p-2.5 rounded-xl text-sm focus:ring-indigo-500 outline-none transition-all"
            />
            {errors.dueDate && (
              <p className="text-[10px] text-red-500 font-medium">{errors.dueDate.message}</p>
            )}
          </div>
        </div>

        {daysLeft > 0 && (
          <div className={`flex items-center gap-2 px-3 py-2 rounded-xl w-fit mt-1 border
            ${daysLeft <= 2 ? "bg-rose-50 border-rose-100" :
              daysLeft <= 5 ? "bg-amber-50 border-amber-100" :
              "bg-emerald-50 border-emerald-100"}`}
          >
            <Clock size={13} className={
              daysLeft <= 2 ? "text-rose-500" :
              daysLeft <= 5 ? "text-amber-500" : "text-emerald-500"
            } />
            <span className={`text-sm font-black ${
              daysLeft <= 2 ? "text-rose-700" :
              daysLeft <= 5 ? "text-amber-700" : "text-emerald-700"
            }`}>
              {daysLeft} day{daysLeft !== 1 ? "s" : ""} to complete
            </span>
          </div>
        )}
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="bg-indigo-600 text-white py-3 rounded-xl font-bold shadow-lg hover:bg-indigo-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2 active:scale-[0.98]"
      >
        {submitting && <Loader2 size={16} className="animate-spin" />}
        {submitting ? "Saving…" : type === "create" ? "Create Assignment" : "Update Assignment"}
      </button>
    </form>
  );
};

export default AssignmentForm;
