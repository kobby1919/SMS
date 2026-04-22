"use client";

// src/components/LessonForm.tsx

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useEffect, useState } from "react";
import { z } from "zod";
import { AlertCircle, AlertTriangle, CheckCircle2, Clock } from "lucide-react";

// ─── Schema ───────────────────────────────────────────────────────────────────
const schema = z.object({
  name:      z.string().optional(),
  day:       z.enum(["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"]),
  startTime: z.string().min(1, "Required"),
  endTime:   z.string().min(1, "Required"),
  subjectId: z.string().min(1, "Subject is required"),
  classId:   z.string().min(1, "Class is required"),
  teacherId: z.string().min(1, "Teacher is required"),
});

type Inputs = z.infer<typeof schema>;

// ─── Types ────────────────────────────────────────────────────────────────────
type Subject = { id: number; name: string };
type Class   = { id: number; name: string; grade: { level: string } };
type Teacher = { id: string; name: string; surname: string; maxClasses: number };

// ─── Period presets ───────────────────────────────────────────────────────────
const PERIOD_PRESETS = [
  { label: "P1", start: "07:30", end: "08:10" },
  { label: "P2", start: "08:10", end: "08:50" },
  { label: "P3", start: "08:50", end: "09:30" },
  { label: "P4", start: "09:50", end: "10:30" },
  { label: "P5", start: "10:30", end: "11:10" },
  { label: "P6", start: "11:10", end: "11:50" },
  { label: "P7", start: "12:30", end: "13:10" },
  { label: "P8", start: "13:10", end: "13:50" },
];

const DAY_OPTIONS = [
  { value: "MONDAY",    label: "Monday"    },
  { value: "TUESDAY",   label: "Tuesday"   },
  { value: "WEDNESDAY", label: "Wednesday" },
  { value: "THURSDAY",  label: "Thursday"  },
  { value: "FRIDAY",    label: "Friday"    },
];

const timeToISO = (timeStr: string): string => {
  const [h, m] = timeStr.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toISOString();
};

const getDuration = (start: string, end: string): string => {
  if (!start || !end) return "";
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const mins = (eh * 60 + em) - (sh * 60 + sm);
  if (mins <= 0) return "";
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
};

// ─── Component ────────────────────────────────────────────────────────────────
const LessonForm = ({
  type,
  data,
  onSuccess,
}: {
  type: "create" | "update";
  data?: any;
  onSuccess?: () => void;
}) => {
  const [subjects,  setSubjects]  = useState<Subject[]>([]);
  const [classes,   setClasses]   = useState<Class[]>([]);
  const [teachers,  setTeachers]  = useState<Teacher[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [apiError,  setApiError]  = useState<string | null>(null);
  const [success,   setSuccess]   = useState(false);

  // Teacher class-count warning
  const [teacherClassCount, setTeacherClassCount] = useState<number>(0);
  const [watchedTeacherId,  setWatchedTeacherId]  = useState<string>("");
  const [watchedClassId,    setWatchedClassId]    = useState<string>("");

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<Inputs>({
    resolver: zodResolver(schema),
    defaultValues: data
      ? {
          name:      data.name      ?? "",
          day:       data.day       ?? "MONDAY",
          startTime: data.startTime ? `${new Date(data.startTime).getHours().toString().padStart(2,"0")}:${new Date(data.startTime).getMinutes().toString().padStart(2,"0")}` : "07:30",
          endTime:   data.endTime   ? `${new Date(data.endTime).getHours().toString().padStart(2,"0")}:${new Date(data.endTime).getMinutes().toString().padStart(2,"0")}` : "08:10",
          subjectId: data.subjectId?.toString() ?? "",
          classId:   data.classId?.toString()   ?? "",
          teacherId: data.teacherId             ?? "",
        }
      : { day: "MONDAY", startTime: "07:30", endTime: "08:10" },
  });

  const startTime  = watch("startTime");
  const endTime    = watch("endTime");
  const teacherId  = watch("teacherId");
  const classId    = watch("classId");

  // ── Load dropdown data ─────────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      try {
        const [subRes, clsRes, tchRes] = await Promise.all([
          fetch("/api/form-data/subjects"),
          fetch("/api/form-data/classes"),
          fetch("/api/form-data/teachers"),
        ]);
        const [subs, clss, tchs] = await Promise.all([
          subRes.json(), clsRes.json(), tchRes.json(),
        ]);
        setSubjects(subs);
        setClasses(clss);
        setTeachers(tchs);
      } catch {
        setApiError("Failed to load form data. Please refresh.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // ── Check teacher class count when teacher or class changes ───────────────
  useEffect(() => {
    if (!teacherId) { setTeacherClassCount(0); return; }
    const check = async () => {
      try {
        const res  = await fetch(`/api/form-data/teacher-class-count?teacherId=${teacherId}&excludeClassId=${classId || ""}&excludeLessonId=${data?.id || ""}`);
        const json = await res.json();
        setTeacherClassCount(json.count ?? 0);
      } catch { /* silent */ }
    };
    check();
    setWatchedTeacherId(teacherId);
    setWatchedClassId(classId);
  }, [teacherId, classId]);

  // ── Apply period preset ────────────────────────────────────────────────────
  const applyPreset = (start: string, end: string) => {
    setValue("startTime", start);
    setValue("endTime",   end);
  };

  // ── Submit ─────────────────────────────────────────────────────────────────
  const onSubmit = async (formData: Inputs) => {
    setApiError(null);
    setSubmitting(true);
    try {
      const payload = {
        ...(type === "update" && data?.id ? { id: data.id } : {}),
        name:      formData.name || undefined,
        day:       formData.day,
        startTime: timeToISO(formData.startTime),
        endTime:   timeToISO(formData.endTime),
        subjectId: parseInt(formData.subjectId),
        classId:   parseInt(formData.classId),
        teacherId: formData.teacherId,
      };

      const res = await fetch("/api/timetable", {
        method:  type === "create" ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
      });

      const result = await res.json();
      if (!res.ok) {
        setApiError(result.error ?? "Something went wrong.");
        return;
      }

      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onSuccess?.();
      }, 1200);
    } catch {
      setApiError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Teacher warning level ──────────────────────────────────────────────────
  const selectedTeacher = teachers.find((t) => t.id === teacherId);
  const isNewClass      = classId && teacherId &&
    !subjects.find(() => false); // computed below via API
  const atLimit         = teacherClassCount >= 5;
  const nearLimit       = teacherClassCount === 4;

  const duration = getDuration(startTime, endTime);

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

      {/* Title */}
      <h1 className="text-2xl font-black text-gray-800 tracking-tight">
        {type === "create" ? "Add Lesson Slot" : "Update Lesson Slot"}
      </h1>

      {/* API error */}
      {apiError && (
        <div className="flex items-start gap-2.5 p-3.5 bg-rose-50 border border-rose-200 rounded-xl">
          <AlertCircle size={15} className="text-rose-500 shrink-0 mt-0.5" />
          <p className="text-xs font-semibold text-rose-700 leading-relaxed">{apiError}</p>
        </div>
      )}

      {/* Success */}
      {success && (
        <div className="flex items-center gap-2.5 p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl">
          <CheckCircle2 size={15} className="text-emerald-500" />
          <p className="text-xs font-semibold text-emerald-700">
            Lesson {type === "create" ? "created" : "updated"} successfully!
          </p>
        </div>
      )}

      {/* ── SECTION: Schedule ── */}
      <div className="flex flex-col gap-4">
        <span className="text-xs text-gray-400 font-bold uppercase tracking-widest">Schedule</span>

        {/* Day */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-gray-500 font-semibold">Day of Week</label>
          <div className="grid grid-cols-5 gap-2">
            {DAY_OPTIONS.map((d) => (
              <label key={d.value} className="cursor-pointer">
                <input type="radio" value={d.value} {...register("day")} className="sr-only peer" />
                <div className="text-center py-2 rounded-xl text-xs font-bold border border-gray-200 text-gray-500
                  peer-checked:bg-indigo-600 peer-checked:text-white peer-checked:border-indigo-600
                  hover:border-indigo-300 hover:text-indigo-600 transition-all cursor-pointer">
                  {d.label.slice(0, 3)}
                </div>
              </label>
            ))}
          </div>
          {errors.day && <p className="text-[10px] text-red-500 font-medium">{errors.day.message}</p>}
        </div>

        {/* Period presets */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-gray-500 font-semibold">Period Presets</label>
          <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5">
            {PERIOD_PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => applyPreset(p.start, p.end)}
                className={`py-1.5 rounded-lg text-[11px] font-bold text-center border transition-all
                  ${startTime === p.start && endTime === p.end
                    ? "bg-indigo-50 border-indigo-400 text-indigo-700"
                    : "bg-white border-gray-200 text-gray-500 hover:border-indigo-200 hover:text-indigo-600"}`}
              >
                <div className="font-black text-[9px] uppercase">{p.label}</div>
                <div className="opacity-70 text-[9px]">{p.start}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Time fields */}
        <div className="flex flex-wrap gap-4">
          <div className="flex flex-col gap-1 w-full md:w-[31%]">
            <label className="text-xs text-gray-500 font-semibold">Start Time</label>
            <input
              type="time"
              {...register("startTime")}
              className="ring-[1.5px] ring-gray-200 p-2.5 rounded-xl text-sm focus:ring-indigo-600 outline-none transition-all"
            />
            {errors.startTime && <p className="text-[10px] text-red-500 font-medium">{errors.startTime.message}</p>}
          </div>

          <div className="flex flex-col gap-1 w-full md:w-[31%]">
            <label className="text-xs text-gray-500 font-semibold">End Time</label>
            <input
              type="time"
              {...register("endTime")}
              className="ring-[1.5px] ring-gray-200 p-2.5 rounded-xl text-sm focus:ring-indigo-600 outline-none transition-all"
            />
            {errors.endTime && <p className="text-[10px] text-red-500 font-medium">{errors.endTime.message}</p>}
          </div>

          {/* Duration badge */}
          {duration && (
            <div className="flex flex-col gap-1 w-full md:w-[31%] justify-end">
              <label className="text-xs text-gray-500 font-semibold">Duration</label>
              <div className="flex items-center gap-2 h-[42px] px-3 bg-indigo-50 border border-indigo-100 rounded-xl">
                <Clock size={13} className="text-indigo-500" />
                <span className="text-sm font-bold text-indigo-700">{duration}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── SECTION: Assignment ── */}
      <div className="flex flex-col gap-4">
        <span className="text-xs text-gray-400 font-bold uppercase tracking-widest">Assignment</span>

        <div className="flex flex-wrap gap-4">
          {/* Subject */}
          <div className="flex flex-col gap-1 w-full md:w-[31%]">
            <label className="text-xs text-gray-500 font-semibold">Subject</label>
            <select
              {...register("subjectId")}
              className="ring-[1.5px] ring-gray-200 p-2.5 rounded-xl text-sm focus:ring-indigo-600 outline-none bg-white h-[42px]"
            >
              <option value="">Select subject…</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            {errors.subjectId && <p className="text-[10px] text-red-500 font-medium">{errors.subjectId.message}</p>}
          </div>

          {/* Class */}
          <div className="flex flex-col gap-1 w-full md:w-[31%]">
            <label className="text-xs text-gray-500 font-semibold">Class</label>
            <select
              {...register("classId")}
              className="ring-[1.5px] ring-gray-200 p-2.5 rounded-xl text-sm focus:ring-indigo-600 outline-none bg-white h-[42px]"
            >
              <option value="">Select class…</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.grade.level})
                </option>
              ))}
            </select>
            {errors.classId && <p className="text-[10px] text-red-500 font-medium">{errors.classId.message}</p>}
          </div>

          {/* Teacher */}
          <div className="flex flex-col gap-1 w-full md:w-[31%]">
            <label className="text-xs text-gray-500 font-semibold">Teacher</label>
            <select
              {...register("teacherId")}
              className="ring-[1.5px] ring-gray-200 p-2.5 rounded-xl text-sm focus:ring-indigo-600 outline-none bg-white h-[42px]"
            >
              <option value="">Select teacher…</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} {t.surname}
                </option>
              ))}
            </select>
            {errors.teacherId && <p className="text-[10px] text-red-500 font-medium">{errors.teacherId.message}</p>}
          </div>
        </div>

        {/* Teacher class-count guard */}
        {teacherId && (
          <div className={`flex items-start gap-2.5 p-3 rounded-xl border text-xs font-semibold
            ${atLimit
              ? "bg-rose-50 border-rose-200 text-rose-700"
              : nearLimit
              ? "bg-amber-50 border-amber-200 text-amber-700"
              : "bg-emerald-50 border-emerald-200 text-emerald-700"}`}
          >
            {atLimit
              ? <AlertCircle size={14} className="shrink-0 mt-0.5 text-rose-500" />
              : nearLimit
              ? <AlertTriangle size={14} className="shrink-0 mt-0.5 text-amber-500" />
              : <CheckCircle2 size={14} className="shrink-0 mt-0.5 text-emerald-500" />}
            <span>
              {selectedTeacher?.name} {selectedTeacher?.surname} is assigned to{" "}
              <strong>{teacherClassCount}</strong> / 5 classes
              {atLimit && " — cannot assign to more classes."}
              {nearLimit && " — one slot remaining."}
              {!atLimit && !nearLimit && " — available for assignment."}
            </span>
          </div>
        )}
      </div>

      {/* ── SECTION: Optional ── */}
      <div className="flex flex-col gap-4">
        <span className="text-xs text-gray-400 font-bold uppercase tracking-widest">
          Optional
        </span>
        <div className="flex flex-col gap-1 w-full">
          <label className="text-xs text-gray-500 font-semibold">
            Custom Lesson Name <span className="text-gray-300 font-normal">(auto-generated if blank)</span>
          </label>
          <input
            type="text"
            {...register("name")}
            placeholder="e.g. Core Mathematics — JHS 2A"
            className="ring-[1.5px] ring-gray-200 p-2.5 rounded-xl text-sm focus:ring-indigo-600 outline-none transition-all"
          />
        </div>
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={submitting || atLimit}
        className="bg-indigo-600 text-white py-3 rounded-xl font-bold shadow-lg hover:bg-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {submitting && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
        {submitting
          ? "Saving…"
          : atLimit
          ? "Teacher at class limit"
          : type === "create"
          ? "Create Lesson"
          : "Update Lesson"}
      </button>
    </form>
  );
};

export default LessonForm;
