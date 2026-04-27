"use client";

// src/components/ExamForm.tsx

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AlertCircle, CheckCircle2, Clock, Loader2, Calendar } from "lucide-react";
import { createExam, updateExam } from "@/src/lib/actions/actions";

// ─── Schema ───────────────────────────────────────────────────────────────────
const schema = z.object({
  title:     z.string().min(1, "Title is required"),
  lessonId:  z.string().min(1, "Lesson is required"),
  startDate: z.string().min(1, "Start date is required"),
  startTime: z.string().min(1, "Start time is required"),
  endTime:   z.string().min(1, "End time is required"),
}).refine((d) => d.startTime < d.endTime, {
  message: "End time must be after start time",
  path: ["endTime"],
});

type Inputs = z.infer<typeof schema>;

type Lesson = {
  id:          number;
  name:        string;
  day:         string;
  subjectName: string;
  className:   string;
  teacherName: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const DAY_ORDER: Record<string, number> = {
  MONDAY: 1, TUESDAY: 2, WEDNESDAY: 3, THURSDAY: 4, FRIDAY: 5,
};

const toISO = (date: string, time: string): string =>
  new Date(`${date}T${time}:00`).toISOString();

const fromDate = (iso: string) =>
  new Date(iso).toISOString().split("T")[0];

const fromTime = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

// ─── Component ────────────────────────────────────────────────────────────────
const ExamForm = ({
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
    formState: { errors },
  } = useForm<Inputs>({
    resolver: zodResolver(schema),
    defaultValues: data
      ? {
          title:     data.title     ?? "",
          lessonId:  String(data.lessonId ?? data.lesson?.id ?? ""),
          startDate: data.startTime ? fromDate(data.startTime) : "",
          startTime: data.startTime ? fromTime(data.startTime) : "09:00",
          endTime:   data.endTime   ? fromTime(data.endTime)   : "11:00",
        }
      : { startTime: "09:00", endTime: "11:00" },
  });

  const selectedLessonId = watch("lessonId");
  const startTime        = watch("startTime");
  const endTime          = watch("endTime");

  // Duration display
  const durationMins = (() => {
    if (!startTime || !endTime) return 0;
    const [sh, sm] = startTime.split(":").map(Number);
    const [eh, em] = endTime.split(":").map(Number);
    return (eh * 60 + em) - (sh * 60 + sm);
  })();

  useEffect(() => {
    fetch("/api/form-data/lessons")
      .then((r) => r.json())
      .then((data) => setLessons(data))
      .catch(() => setApiError("Failed to load lessons."))
      .finally(() => setLoading(false));
  }, []);

  const filteredLessons = lessons.filter((l) =>
    `${l.subjectName} ${l.className} ${l.teacherName} ${l.name}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  const selectedLesson = lessons.find((l) => String(l.id) === selectedLessonId);

  const onSubmit = async (formData: Inputs) => {
    setApiError(null);
    setSubmitting(true);
    try {
      const payload = {
        ...(type === "update" && data?.id ? { id: data.id } : {}),
        title:     formData.title,
        lessonId:  parseInt(formData.lessonId),
        startTime: toISO(formData.startDate, formData.startTime),
        endTime:   toISO(formData.startDate, formData.endTime),
      };

      if (type === "create") await createExam(payload);
      else                   await updateExam(payload);

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
        {type === "create" ? "Schedule New Exam" : "Update Exam"}
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
          <p className="text-xs font-semibold text-emerald-700">
            Exam {type === "create" ? "scheduled" : "updated"} successfully!
          </p>
        </div>
      )}

      {/* Title */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Exam Title</label>
        <input
          {...register("title")}
          placeholder="e.g. Mid-Term Exam, End of Term Assessment"
          className="ring-[1.5px] ring-gray-200 p-2.5 rounded-xl text-sm focus:ring-indigo-500 outline-none transition-all"
        />
        {errors.title && <p className="text-[10px] text-red-500 font-medium">{errors.title.message}</p>}
      </div>

      {/* Lesson picker */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <label className="text-xs text-gray-500 font-semibold uppercase tracking-wider">
            Link to Lesson / Subject
          </label>
          {selectedLesson && (
            <span className="text-[11px] font-bold px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-lg">
              {selectedLesson.subjectName} · {selectedLesson.className}
            </span>
          )}
        </div>

        {/* Search */}
        <input
          type="text"
          placeholder="Search by subject, class or teacher…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="ring-[1.5px] ring-gray-200 p-2.5 rounded-xl text-sm focus:ring-indigo-500 outline-none transition-all"
        />

        {/* Lesson list */}
        <div className="max-h-[200px] overflow-y-auto border border-gray-200 rounded-xl divide-y divide-gray-50">
          {filteredLessons.length === 0 ? (
            <div className="py-6 text-center text-sm text-gray-400">No lessons found</div>
          ) : (
            filteredLessons
              .sort((a, b) => (DAY_ORDER[a.day] ?? 0) - (DAY_ORDER[b.day] ?? 0))
              .map((lesson) => {
                const isSelected = String(lesson.id) === selectedLessonId;
                return (
                  <label
                    key={lesson.id}
                    className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors
                      ${isSelected ? "bg-indigo-50" : "bg-white hover:bg-gray-50"}`}
                  >
                    <input
                      type="radio"
                      value={lesson.id}
                      {...register("lessonId")}
                      className="sr-only"
                    />
                    <div className="flex-1 min-w-0">
                      <p className={`font-bold text-sm ${isSelected ? "text-indigo-700" : "text-gray-800"}`}>
                        {lesson.subjectName}
                        <span className="font-semibold text-gray-400 ml-1.5">· {lesson.className}</span>
                      </p>
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        {lesson.day.charAt(0) + lesson.day.slice(1).toLowerCase()} · {lesson.teacherName}
                      </p>
                    </div>
                    {isSelected && <CheckCircle2 size={15} className="text-indigo-500 shrink-0" />}
                  </label>
                );
              })
          )}
        </div>
        {errors.lessonId && <p className="text-[10px] text-red-500 font-medium">{errors.lessonId.message}</p>}
      </div>

      {/* Date + Time */}
      <div className="flex flex-col gap-2">
        <label className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Date & Time</label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">

          {/* Date */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] text-gray-400 font-semibold flex items-center gap-1.5">
              <Calendar size={11} /> Exam Date
            </label>
            <input
              type="date"
              {...register("startDate")}
              className="ring-[1.5px] ring-gray-200 p-2.5 rounded-xl text-sm focus:ring-indigo-500 outline-none transition-all"
            />
            {errors.startDate && <p className="text-[10px] text-red-500 font-medium">{errors.startDate.message}</p>}
          </div>

          {/* Start time */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] text-gray-400 font-semibold flex items-center gap-1.5">
              <Clock size={11} /> Start Time
            </label>
            <input
              type="time"
              {...register("startTime")}
              className="ring-[1.5px] ring-gray-200 p-2.5 rounded-xl text-sm focus:ring-indigo-500 outline-none transition-all"
            />
            {errors.startTime && <p className="text-[10px] text-red-500 font-medium">{errors.startTime.message}</p>}
          </div>

          {/* End time */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] text-gray-400 font-semibold flex items-center gap-1.5">
              <Clock size={11} /> End Time
            </label>
            <input
              type="time"
              {...register("endTime")}
              className="ring-[1.5px] ring-gray-200 p-2.5 rounded-xl text-sm focus:ring-indigo-500 outline-none transition-all"
            />
            {errors.endTime && <p className="text-[10px] text-red-500 font-medium">{errors.endTime.message}</p>}
          </div>
        </div>

        {/* Duration badge */}
        {durationMins > 0 && (
          <div className="flex items-center gap-2 px-3 py-2 bg-indigo-50 border border-indigo-100 rounded-xl w-fit">
            <Clock size={13} className="text-indigo-500" />
            <span className="text-sm font-bold text-indigo-700">
              {durationMins < 60
                ? `${durationMins} min`
                : `${Math.floor(durationMins / 60)}h${durationMins % 60 > 0 ? ` ${durationMins % 60}m` : ""}`}
            </span>
            <span className="text-xs text-indigo-400">duration</span>
          </div>
        )}
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="bg-indigo-600 text-white py-3 rounded-xl font-bold shadow-lg hover:bg-indigo-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {submitting && <Loader2 size={16} className="animate-spin" />}
        {submitting ? "Saving…" : type === "create" ? "Schedule Exam" : "Update Exam"}
      </button>
    </form>
  );
};

export default ExamForm;
