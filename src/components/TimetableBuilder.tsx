"use client";

// src/components/TimetableBuilder.tsx

import { useState, useTransition } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Pencil, Trash2, X, BookOpen,
  ChevronDown, AlertCircle, CheckCircle2, Loader2,
  GraduationCap, Users, Calendar, Filter, Info,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
export type TBSubject = { id: number; name: string };
export type TBClass   = { id: number; name: string; grade: { level: string; order: number } };
export type TBTeacher = {
  id: string; name: string; surname: string; maxClasses: number;
  subjects: TBSubject[]; // ✅ each teacher now carries their own subject list
};
export type TBLesson  = {
  id:        number;
  name:      string;
  day:       string;
  startTime: string;
  endTime:   string;
  subject:   { id: number; name: string };
  class:     { id: number; name: string };
  teacher:   { id: string; name: string; surname: string };
};

type Props = {
  classes:        TBClass[];
  subjects:       TBSubject[]; // kept for API compat but unused — teachers carry their own
  teachers:       TBTeacher[];
  initialLessons: TBLesson[];
};

// ─── Constants ────────────────────────────────────────────────────────────────
const DAYS = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"] as const;
const DAY_LABELS: Record<string, string> = {
  MONDAY: "Mon", TUESDAY: "Tue", WEDNESDAY: "Wed", THURSDAY: "Thu", FRIDAY: "Fri",
};
const DAY_FULL: Record<string, string> = {
  MONDAY: "Monday", TUESDAY: "Tuesday", WEDNESDAY: "Wednesday",
  THURSDAY: "Thursday", FRIDAY: "Friday",
};

const PERIOD_PRESETS = [
  { label: "Period 1", start: "07:30", end: "08:10" },
  { label: "Period 2", start: "08:10", end: "08:50" },
  { label: "Period 3", start: "08:50", end: "09:30" },
  { label: "Period 4", start: "09:50", end: "10:30" },
  { label: "Period 5", start: "10:30", end: "11:10" },
  { label: "Period 6", start: "11:10", end: "11:50" },
  { label: "Period 7", start: "12:30", end: "13:10" },
  { label: "Period 8", start: "13:10", end: "13:50" },
];

const COLORS = [
  { bg: "bg-blue-50",    text: "text-blue-700",    border: "border-blue-200",    dot: "bg-blue-400",    ring: "ring-blue-300"    },
  { bg: "bg-violet-50",  text: "text-violet-700",  border: "border-violet-200",  dot: "bg-violet-400",  ring: "ring-violet-300"  },
  { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", dot: "bg-emerald-400", ring: "ring-emerald-300" },
  { bg: "bg-amber-50",   text: "text-amber-700",   border: "border-amber-200",   dot: "bg-amber-400",   ring: "ring-amber-300"   },
  { bg: "bg-rose-50",    text: "text-rose-700",    border: "border-rose-200",    dot: "bg-rose-400",    ring: "ring-rose-300"    },
  { bg: "bg-teal-50",    text: "text-teal-700",    border: "border-teal-200",    dot: "bg-teal-400",    ring: "ring-teal-300"    },
  { bg: "bg-orange-50",  text: "text-orange-700",  border: "border-orange-200",  dot: "bg-orange-400",  ring: "ring-orange-300"  },
  { bg: "bg-pink-50",    text: "text-pink-700",    border: "border-pink-200",    dot: "bg-pink-400",    ring: "ring-pink-300"    },
  { bg: "bg-cyan-50",    text: "text-cyan-700",    border: "border-cyan-200",    dot: "bg-cyan-400",    ring: "ring-cyan-300"    },
  { bg: "bg-lime-50",    text: "text-lime-700",    border: "border-lime-200",    dot: "bg-lime-400",    ring: "ring-lime-300"    },
];

const getColor = (index: number) => COLORS[index % COLORS.length];

const formatTime = (iso: string) => {
  const d = new Date(iso);
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
};

const getDuration = (start: string, end: string) => {
  const mins = (new Date(end).getTime() - new Date(start).getTime()) / 60000;
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
};

const timeToDateTime = (timeStr: string): string => {
  const [h, m] = timeStr.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toISOString();
};

// ─── Slot Form Types ──────────────────────────────────────────────────────────
type SlotFormData = {
  id?:       number;
  day:       string;
  startTime: string;
  endTime:   string;
  subjectId: number | "";
  classId:   number | "";
  teacherId: string;
};

// ─── SlotModal ────────────────────────────────────────────────────────────────
type SlotModalProps = {
  form:     SlotFormData;
  setForm:  (f: SlotFormData) => void;
  classes:  TBClass[];
  teachers: TBTeacher[];
  onSave:   () => void;
  onClose:  () => void;
  saving:   boolean;
  error:    string | null;
  isEdit:   boolean;
};

const SlotModal = ({
  form, setForm, classes, teachers,
  onSave, onClose, saving, error, isEdit,
}: SlotModalProps) => {

  // ✅ Derive the subject list from the selected teacher — not a global list
  const selectedTeacher   = teachers.find((t) => t.id === form.teacherId);
  const availableSubjects = selectedTeacher?.subjects ?? [];

  const durationMins =
    form.startTime && form.endTime
      ? (new Date(`1970-01-01T${form.endTime}`).getTime() -
         new Date(`1970-01-01T${form.startTime}`).getTime()) / 60000
      : 0;

  const applyPreset = (preset: { start: string; end: string }) => {
    setForm({ ...form, startTime: preset.start, endTime: preset.end });
  };

  const applyDuration = (mins: number) => {
    if (!form.startTime) return;
    const [h, m] = form.startTime.split(":").map(Number);
    const total  = h * 60 + m + mins;
    const endH   = Math.floor(total / 60) % 24;
    const endM   = total % 60;
    setForm({
      ...form,
      endTime: `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`,
    });
  };

  // ✅ When teacher changes, reset subject (can't keep a subject from another teacher)
  const handleTeacherChange = (teacherId: string) => {
    setForm({ ...form, teacherId, subjectId: "" });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${isEdit ? "bg-amber-50" : "bg-indigo-50"}`}>
              {isEdit
                ? <Pencil size={16} className="text-amber-600" />
                : <Plus   size={16} className="text-indigo-600" />}
            </div>
            <div>
              <h2 className="font-black text-gray-800 text-sm">
                {isEdit ? "Edit Lesson Slot" : "Add Lesson Slot"}
              </h2>
              <p className="text-[11px] text-gray-400 font-medium">
                {DAY_FULL[form.day] || "Select a day"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center transition-colors"
          >
            <X size={16} className="text-gray-400" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5 max-h-[70vh] overflow-y-auto">

          {/* Error */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="flex items-start gap-2.5 p-3 bg-rose-50 border border-rose-200 rounded-xl"
              >
                <AlertCircle size={15} className="text-rose-500 shrink-0 mt-0.5" />
                <p className="text-xs font-semibold text-rose-700 leading-relaxed">{error}</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Day */}
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-gray-400 mb-2">Day</label>
            <div className="grid grid-cols-5 gap-1.5">
              {DAYS.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setForm({ ...form, day: d })}
                  className={`py-2 rounded-xl text-xs font-bold transition-all
                    ${form.day === d
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "bg-gray-100 text-gray-500 hover:bg-indigo-50 hover:text-indigo-600"}`}
                >
                  {DAY_LABELS[d]}
                </button>
              ))}
            </div>
          </div>

          {/* Period presets */}
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-gray-400 mb-2">
              Period Presets
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {PERIOD_PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => applyPreset(p)}
                  className={`py-1.5 px-1 rounded-lg text-[10px] font-bold text-center transition-all border
                    ${form.startTime === p.start && form.endTime === p.end
                      ? "bg-indigo-50 border-indigo-300 text-indigo-700"
                      : "bg-white border-gray-200 text-gray-500 hover:border-indigo-200 hover:text-indigo-600"}`}
                >
                  <div className="font-black text-[9px] uppercase">{p.label}</div>
                  <div className="opacity-70">{p.start}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-gray-400 mb-2">Start Time</label>
              <input
                type="time"
                value={form.startTime}
                onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-300 transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-gray-400 mb-2">End Time</label>
              <input
                type="time"
                value={form.endTime}
                onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-300 transition-all"
              />
            </div>
          </div>

          {/* Quick duration */}
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-gray-400 mb-2">Quick Duration</label>
            <div className="flex gap-2 flex-wrap">
              {[30, 40, 45, 60, 80, 90].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => applyDuration(m)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border
                    ${durationMins === m
                      ? "bg-indigo-600 text-white border-indigo-600"
                      : "bg-white border-gray-200 text-gray-500 hover:border-indigo-200 hover:text-indigo-600"}`}
                >
                  {m}m
                </button>
              ))}
              {durationMins > 0 && (
                <span className="px-3 py-1.5 rounded-lg text-xs font-bold bg-gray-50 text-gray-400 border border-gray-100">
                  = {getDuration(`1970-01-01T${form.startTime}`, `1970-01-01T${form.endTime}`)}
                </span>
              )}
            </div>
          </div>

          {/* ── Teacher (FIRST — drives subject list) ── */}
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-gray-400 mb-2">
              Teacher <span className="text-gray-300 font-normal normal-case">(select first)</span>
            </label>
            <div className="relative">
              <Users size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <select
                value={form.teacherId}
                onChange={(e) => handleTeacherChange(e.target.value)}
                className="w-full pl-9 pr-8 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-300 appearance-none bg-white transition-all"
              >
                <option value="">Select teacher…</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} {t.surname}
                    {t.subjects.length > 0 ? ` (${t.subjects.map(s => s.name).join(", ")})` : " — no subjects"}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {/* ── Subject (filtered by selected teacher) ── */}
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-gray-400 mb-2">
              Subject{" "}
              {form.teacherId && (
                <span className="text-indigo-400 font-normal normal-case">
                  — {availableSubjects.length} available for this teacher
                </span>
              )}
            </label>
            <div className="relative">
              <BookOpen size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <select
                value={form.subjectId}
                disabled={!form.teacherId}
                onChange={(e) => setForm({ ...form, subjectId: e.target.value ? parseInt(e.target.value) : "" })}
                className="w-full pl-9 pr-8 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-300 appearance-none bg-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {!form.teacherId ? (
                  <option value="">Select a teacher first…</option>
                ) : availableSubjects.length === 0 ? (
                  <option value="">No subjects assigned to this teacher</option>
                ) : (
                  <>
                    <option value="">Select subject…</option>
                    {availableSubjects.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </>
                )}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>

            {/* Warning if teacher has no subjects */}
            {form.teacherId && availableSubjects.length === 0 && (
              <div className="flex items-center gap-1.5 mt-2">
                <Info size={11} className="text-amber-500 shrink-0" />
                <p className="text-[10px] text-amber-600 font-semibold">
                  Assign subjects to this teacher in the Subjects list first.
                </p>
              </div>
            )}
          </div>

          {/* Class */}
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-gray-400 mb-2">Class</label>
            <div className="relative">
              <GraduationCap size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <select
                value={form.classId}
                onChange={(e) => setForm({ ...form, classId: e.target.value ? parseInt(e.target.value) : "" })}
                className="w-full pl-9 pr-8 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-300 appearance-none bg-white transition-all"
              >
                <option value="">Select class…</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between bg-gray-50/50">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-bold text-gray-500 hover:bg-gray-100 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60 transition-all shadow-sm"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
            {saving ? "Saving…" : isEdit ? "Update Slot" : "Add Slot"}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

// ─── Delete Confirm Modal ─────────────────────────────────────────────────────
const DeleteModal = ({
  lesson, onConfirm, onClose, deleting,
}: {
  lesson: TBLesson;
  onConfirm: () => void;
  onClose: () => void;
  deleting: boolean;
}) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm"
      onClick={onClose}
    />
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
      className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden"
    >
      <div className="p-6 text-center">
        <div className="w-14 h-14 bg-rose-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Trash2 size={22} className="text-rose-500" />
        </div>
        <h3 className="font-black text-gray-800 text-base mb-1">Delete Lesson Slot?</h3>
        <p className="text-sm text-gray-400 mb-1 font-medium">
          {lesson.subject.name} · {lesson.class.name}
        </p>
        <p className="text-xs text-gray-300 mb-6">
          {DAY_FULL[lesson.day]} · {formatTime(lesson.startTime)} – {formatTime(lesson.endTime)}
        </p>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-gray-500 bg-gray-100 hover:bg-gray-200 transition-colors">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={deleting}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-rose-500 hover:bg-rose-600 disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
          >
            {deleting ? <Loader2 size={14} className="animate-spin" /> : null}
            {deleting ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </motion.div>
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────
const TimetableBuilder = ({ classes, teachers, initialLessons }: Props) => {
  const [lessons, setLessons]             = useState<TBLesson[]>(initialLessons);
  const [selectedClass, setSelectedClass] = useState<number | "all">("all");
  const [selectedDay, setSelectedDay]     = useState<string>("all");
  const [viewMode, setViewMode]           = useState<"grid" | "list">("grid");
  const [modalOpen, setModalOpen]         = useState(false);
  const [deleteTarget, setDeleteTarget]   = useState<TBLesson | null>(null);
  const [editTarget, setEditTarget]       = useState<TBLesson | null>(null);
  const [saving, setSaving]               = useState(false);
  const [deleting, setDeleting]           = useState(false);
  const [modalError, setModalError]       = useState<string | null>(null);
  const [toast, setToast]                 = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [, startTransition]               = useTransition();

  // Build subject color map from all subjects across all teachers (deduplicated)
  const allSubjects = Array.from(
    new Map(teachers.flatMap((t) => t.subjects).map((s) => [s.id, s])).values()
  );
  const subjectColorMap = Object.fromEntries(allSubjects.map((s, i) => [s.id, getColor(i)]));

  const defaultForm: SlotFormData = {
    day: "MONDAY", startTime: "07:30", endTime: "08:10",
    subjectId: "", classId: "", teacherId: "",
  };
  const [form, setForm] = useState<SlotFormData>(defaultForm);

  const showToast = (msg: string, type: "success" | "error") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const openCreate = (prefillDay?: string, prefillClassId?: number) => {
    setEditTarget(null);
    setModalError(null);
    setForm({ ...defaultForm, day: prefillDay ?? "MONDAY", classId: prefillClassId ?? "" });
    setModalOpen(true);
  };

  const openEdit = (lesson: TBLesson) => {
    setEditTarget(lesson);
    setModalError(null);
    setForm({
      id:        lesson.id,
      day:       lesson.day,
      startTime: formatTime(lesson.startTime),
      endTime:   formatTime(lesson.endTime),
      subjectId: lesson.subject.id,
      classId:   lesson.class.id,
      teacherId: lesson.teacher.id,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    setModalError(null);
    if (!form.subjectId || !form.classId || !form.teacherId || !form.startTime || !form.endTime) {
      setModalError("Please fill in all fields.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...(form.id ? { id: form.id } : {}),
        day:       form.day,
        startTime: timeToDateTime(form.startTime),
        endTime:   timeToDateTime(form.endTime),
        subjectId: form.subjectId,
        classId:   form.classId,
        teacherId: form.teacherId,
      };
      const res  = await fetch("/api/timetable", {
        method:  form.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) { setModalError(data.error ?? "Something went wrong."); return; }
      startTransition(() => {
        if (form.id) {
          setLessons((prev) => prev.map((l) => (l.id === form.id ? data : l)));
        } else {
          setLessons((prev) => [...prev, data]);
        }
      });
      setModalOpen(false);
      showToast(form.id ? "Lesson updated!" : "Lesson added!", "success");
    } catch {
      setModalError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/timetable?id=${deleteTarget.id}`, { method: "DELETE" });
      if (!res.ok) { showToast("Failed to delete lesson.", "error"); return; }
      startTransition(() => {
        setLessons((prev) => prev.filter((l) => l.id !== deleteTarget.id));
      });
      setDeleteTarget(null);
      showToast("Lesson deleted.", "success");
    } catch {
      showToast("Network error.", "error");
    } finally {
      setDeleting(false);
    }
  };

  const filtered = lessons.filter((l) => {
    const classMatch = selectedClass === "all" || l.class.id === selectedClass;
    const dayMatch   = selectedDay   === "all" || l.day === selectedDay;
    return classMatch && dayMatch;
  });

  const totalLessons  = lessons.length;
  const totalClasses  = new Set(lessons.map((l) => l.class.id)).size;
  const totalTeachers = new Set(lessons.map((l) => l.teacher.id)).size;

  const gridClasses = selectedClass === "all"
    ? classes
    : classes.filter((c) => c.id === selectedClass);

  const getLessonsForCell = (classId: number, day: string) =>
    lessons.filter((l) => l.class.id === classId && l.day === day);

  return (
    <div className="flex flex-col gap-5">

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Lessons",   value: totalLessons,  icon: "📋", color: "bg-indigo-50 text-indigo-600"   },
          { label: "Classes Covered", value: totalClasses,  icon: "🏫", color: "bg-emerald-50 text-emerald-600" },
          { label: "Teachers Active", value: totalTeachers, icon: "👩‍🏫", color: "bg-violet-50 text-violet-600"   },
          { label: "Days Scheduled",  value: new Set(lessons.map((l) => l.day)).size, icon: "📅", color: "bg-amber-50 text-amber-600" },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-lg ${s.color}`}>{s.icon}</div>
            <div>
              <p className="text-xl font-black text-gray-800 leading-none">{s.value}</p>
              <p className="text-xs text-gray-400 font-medium mt-0.5">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="flex flex-wrap gap-2 items-center">
            <div className="flex items-center gap-1.5 text-gray-400">
              <Filter size={13} />
              <span className="text-xs font-bold uppercase tracking-wide">Filter</span>
            </div>
            <div className="relative">
              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value === "all" ? "all" : parseInt(e.target.value))}
                className="pl-3 pr-7 py-1.5 rounded-lg border border-gray-200 text-xs font-bold text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-300 appearance-none bg-white"
              >
                <option value="all">All Classes</option>
                {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
            <div className="relative">
              <select
                value={selectedDay}
                onChange={(e) => setSelectedDay(e.target.value)}
                className="pl-3 pr-7 py-1.5 rounded-lg border border-gray-200 text-xs font-bold text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-300 appearance-none bg-white"
              >
                <option value="all">All Days</option>
                {DAYS.map((d) => <option key={d} value={d}>{DAY_FULL[d]}</option>)}
              </select>
              <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
            {(selectedClass !== "all" || selectedDay !== "all") && (
              <button
                onClick={() => { setSelectedClass("all"); setSelectedDay("all"); }}
                className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-rose-500 bg-rose-50 hover:bg-rose-100 transition-colors"
              >Clear</button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="flex bg-gray-100 p-1 rounded-xl gap-1">
              {(["grid", "list"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setViewMode(v)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all capitalize
                    ${viewMode === v ? "bg-white text-indigo-600 shadow-sm" : "text-gray-400 hover:text-gray-600"}`}
                >{v}</button>
              ))}
            </div>
            <button
              onClick={() => openCreate()}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-all shadow-sm"
            >
              <Plus size={13} />Add Slot
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence mode="wait">

        {/* GRID VIEW */}
        {viewMode === "grid" && (
          <motion.div
            key="grid"
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
          >
            <div className="w-full overflow-x-auto">
              <table className="w-full min-w-[700px]">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/60">
                    <th className="text-left px-4 py-3 text-xs font-black uppercase tracking-wider text-gray-400 w-32 sticky left-0 bg-gray-50/60">Class</th>
                    {DAYS.map((day) => (
                      <th key={day} className="text-center px-2 py-3 text-xs font-black uppercase tracking-wider text-gray-400">
                        <div>{DAY_FULL[day]}</div>
                        <div className="text-[10px] font-medium text-gray-300 normal-case mt-0.5">
                          {lessons.filter((l) => l.day === day).length} slots
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {gridClasses.map((cls) => (
                    <tr key={cls.id} className="hover:bg-gray-50/40 transition-colors group">
                      <td className="px-4 py-2 sticky left-0 bg-white group-hover:bg-gray-50/40">
                        <div className="flex flex-col">
                          <span className="font-black text-sm text-gray-800">{cls.name}</span>
                          <span className="text-[10px] text-gray-400 font-medium">{cls.grade.level}</span>
                        </div>
                      </td>
                      {DAYS.map((day) => {
                        const cellLessons = getLessonsForCell(cls.id, day);
                        return (
                          <td key={day} className="px-1.5 py-1.5 align-top">
                            <div className="flex flex-col gap-1 min-h-[56px]">
                              {cellLessons.map((lesson) => {
                                const c = subjectColorMap[lesson.subject.id] ?? COLORS[0];
                                return (
                                  <motion.div
                                    key={lesson.id}
                                    layout
                                    className={`rounded-lg px-2 py-1.5 border-l-[3px] ${c.bg} ${c.border.replace("border-", "border-l-")} group/slot relative`}
                                  >
                                    <p className={`text-[11px] font-bold leading-tight ${c.text}`}>{lesson.subject.name}</p>
                                    <p className={`text-[9px] font-semibold opacity-60 ${c.text}`}>
                                      {formatTime(lesson.startTime)}–{formatTime(lesson.endTime)}
                                    </p>
                                    <p className={`text-[9px] font-medium opacity-50 ${c.text} truncate`}>
                                      {lesson.teacher.name} {lesson.teacher.surname}
                                    </p>
                                    <div className="absolute top-0.5 right-0.5 hidden group-hover/slot:flex gap-0.5">
                                      <button
                                        onClick={() => openEdit(lesson)}
                                        className="w-5 h-5 rounded bg-white/80 backdrop-blur flex items-center justify-center hover:bg-white shadow-sm transition-all"
                                      >
                                        <Pencil size={9} className="text-gray-600" />
                                      </button>
                                      <button
                                        onClick={() => setDeleteTarget(lesson)}
                                        className="w-5 h-5 rounded bg-white/80 backdrop-blur flex items-center justify-center hover:bg-rose-50 shadow-sm transition-all"
                                      >
                                        <Trash2 size={9} className="text-rose-500" />
                                      </button>
                                    </div>
                                  </motion.div>
                                );
                              })}
                              <button
                                onClick={() => openCreate(day, cls.id)}
                                className="w-full min-h-[28px] rounded-lg border border-dashed border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/50 flex items-center justify-center transition-all opacity-0 hover:opacity-100 focus:opacity-100 group-hover:opacity-100"
                              >
                                <Plus size={11} className="text-indigo-400" />
                              </button>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {gridClasses.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16">
                <Calendar size={32} className="text-gray-200 mb-3" />
                <p className="text-gray-400 font-semibold text-sm">No classes found</p>
              </div>
            )}
          </motion.div>
        )}

        {/* LIST VIEW */}
        {viewMode === "list" && (
          <motion.div
            key="list"
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
          >
            <div className="w-full overflow-x-auto">
              <table className="w-full min-w-full">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/60">
                    {["Subject", "Class", "Day", "Time", "Duration", "Teacher", "Actions"].map((h) => (
                      <th key={h} className="text-left px-4 py-3.5 text-xs font-black uppercase tracking-wider text-gray-400">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-16">
                        <Calendar size={32} className="text-gray-200 mx-auto mb-3" />
                        <p className="text-gray-400 font-semibold text-sm">No lessons match your filters</p>
                        <button onClick={() => openCreate()} className="mt-3 text-xs text-indigo-500 font-bold hover:underline">
                          + Add a lesson slot
                        </button>
                      </td>
                    </tr>
                  ) : (
                    filtered.map((lesson) => {
                      const c = subjectColorMap[lesson.subject.id] ?? COLORS[0];
                      return (
                        <motion.tr key={lesson.id} layout className="hover:bg-indigo-50/20 transition-colors group">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span className={`w-2 h-2 rounded-full shrink-0 ${c.dot}`} />
                              <span className="font-bold text-sm text-gray-800">{lesson.subject.name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-xs font-bold px-2 py-1 rounded-lg ${c.bg} ${c.text}`}>{lesson.class.name}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-sm text-gray-500 font-semibold">{DAY_FULL[lesson.day]}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-sm text-gray-500 font-mono font-semibold">
                              {formatTime(lesson.startTime)} – {formatTime(lesson.endTime)}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-xs font-bold px-2 py-1 rounded-lg bg-gray-100 text-gray-500">
                              {getDuration(lesson.startTime, lesson.endTime)}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-sm text-gray-500 font-medium">
                              {lesson.teacher.name} {lesson.teacher.surname}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => openEdit(lesson)}
                                className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-amber-50 flex items-center justify-center transition-colors"
                              >
                                <Pencil size={13} className="text-amber-600" />
                              </button>
                              <button
                                onClick={() => setDeleteTarget(lesson)}
                                className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-rose-50 flex items-center justify-center transition-colors"
                              >
                                <Trash2 size={13} className="text-rose-500" />
                              </button>
                            </div>
                          </td>
                        </motion.tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            {filtered.length > 0 && (
              <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
                <p className="text-xs text-gray-400 font-medium">Showing {filtered.length} of {lessons.length} lessons</p>
                <button onClick={() => openCreate()} className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-700">
                  <Plus size={12} />Add slot
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modals */}
      <AnimatePresence>
        {modalOpen && (
          <SlotModal
            form={form}
            setForm={setForm}
            classes={classes}
            teachers={teachers}
            onSave={handleSave}
            onClose={() => setModalOpen(false)}
            saving={saving}
            error={modalError}
            isEdit={!!editTarget}
          />
        )}
        {deleteTarget && (
          <DeleteModal
            lesson={deleteTarget}
            onConfirm={handleDelete}
            onClose={() => setDeleteTarget(null)}
            deleting={deleting}
          />
        )}
      </AnimatePresence>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className={`fixed bottom-6 right-6 z-[60] flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg border text-sm font-bold
              ${toast.type === "success"
                ? "bg-white border-emerald-200 text-emerald-700"
                : "bg-white border-rose-200 text-rose-700"}`}
          >
            {toast.type === "success"
              ? <CheckCircle2 size={16} className="text-emerald-500" />
              : <AlertCircle  size={16} className="text-rose-500"    />}
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TimetableBuilder;
