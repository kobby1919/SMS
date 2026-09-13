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
export type TBPeriodTemplate = {
  id: string;
  name: string;
  type: "TEACHING" | "BREAK" | "ASSEMBLY" | "LUNCH" | "CLOSING" | "OTHER";
  startTime: string;
  endTime: string;
  order: number;
  isActive: boolean;
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
  periodTemplate: null | Pick<TBPeriodTemplate, "id" | "name" | "type" | "startTime" | "endTime" | "order">;
};

type Props = {
  classes:        TBClass[];
  subjects:       TBSubject[]; // kept for API compat but unused — teachers carry their own
  teachers:       TBTeacher[];
  initialLessons: TBLesson[];
  initialPeriodTemplates: TBPeriodTemplate[];
  operatingRules: {
    activeDays: string[];
    openingTime: string;
    closingTime: string;
    timezone: string;
    label: string;
  };
};

// ─── Constants ────────────────────────────────────────────────────────────────
const SCHOOL_WEEK_DAYS = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"] as const;
const DAY_LABELS: Record<string, string> = {
  MONDAY: "Mon", TUESDAY: "Tue", WEDNESDAY: "Wed", THURSDAY: "Thu", FRIDAY: "Fri",
};
const DAY_FULL: Record<string, string> = {
  MONDAY: "Monday", TUESDAY: "Tuesday", WEDNESDAY: "Wednesday",
  THURSDAY: "Thursday", FRIDAY: "Friday",
};

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

const timeStringToMinutes = (timeStr: string) => {
  const [h = 0, m = 0] = timeStr.split(":").map(Number);
  return h * 60 + m;
};

const minutesToTimeString = (minutes: number) => {
  const normalized = Math.max(0, Math.min(minutes, 23 * 60 + 59));
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

const getDefaultEndTime = (openingTime: string, closingTime: string) => {
  const opening = timeStringToMinutes(openingTime);
  const closing = timeStringToMinutes(closingTime);
  return minutesToTimeString(Math.min(opening + 40, closing));
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
  periodTemplateId: string;
};

// ─── SlotModal ────────────────────────────────────────────────────────────────
type SlotModalProps = {
  form:     SlotFormData;
  setForm:  (f: SlotFormData) => void;
  classes:  TBClass[];
  teachers: TBTeacher[];
  periodTemplates: TBPeriodTemplate[];
  days:     readonly string[];
  operatingRules: Props["operatingRules"];
  onSave:   () => void;
  onClose:  () => void;
  saving:   boolean;
  error:    string | null;
  isEdit:   boolean;
};

const SlotModal = ({
  form, setForm, classes, teachers,
  periodTemplates, days, operatingRules,
  onSave, onClose, saving, error, isEdit,
}: SlotModalProps) => {

  // ✅ Derive the subject list from the selected teacher — not a global list
  const selectedTeacher   = teachers.find((t) => t.id === form.teacherId);
  const availableSubjects = selectedTeacher?.subjects ?? [];
  const teachingPeriods = periodTemplates.filter((period) => period.isActive && period.type === "TEACHING");

  const durationMins =
    form.startTime && form.endTime
      ? (new Date(`1970-01-01T${form.endTime}`).getTime() -
         new Date(`1970-01-01T${form.startTime}`).getTime()) / 60000
      : 0;

  const applyPeriod = (periodId: string) => {
    const period = teachingPeriods.find((item) => item.id === periodId);
    if (!period) {
      setForm({
        ...form,
        periodTemplateId: "",
        startTime: operatingRules.openingTime,
        endTime: getDefaultEndTime(operatingRules.openingTime, operatingRules.closingTime),
      });
      return;
    }
    setForm({
      ...form,
      periodTemplateId: period.id,
      startTime: period.startTime,
      endTime: period.endTime,
    });
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
              {days.map((d) => (
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
            <p className="mt-2 rounded-lg bg-blue-50 px-3 py-2 text-xs font-semibold leading-5 text-blue-700">
              Timetable days follow this school&apos;s active days: {operatingRules.label}.
            </p>
          </div>

          {/* Period */}
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-gray-400 mb-2">
              Period
            </label>
            <div className="relative">
              <select
                value={form.periodTemplateId}
                onChange={(e) => applyPeriod(e.target.value)}
                className="w-full appearance-none rounded-xl border border-gray-200 bg-white px-3 py-2.5 pr-8 text-sm font-semibold text-gray-700 outline-none transition-all focus:ring-2 focus:ring-indigo-300"
              >
                <option value="">Select teaching period...</option>
                {teachingPeriods.map((period) => (
                  <option key={period.id} value={period.id}>
                    {period.name} ({period.startTime}-{period.endTime})
                  </option>
                ))}
              </select>
              <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
            </div>
            <p className="mt-2 text-xs font-semibold leading-5 text-gray-400">
              Period templates keep lessons consistent across classes. Break and lunch periods cannot be used for lesson slots.
            </p>
          </div>

          {/* Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-gray-400 mb-2">Start Time</label>
              <input
                type="time"
                min={operatingRules.openingTime}
                max={operatingRules.closingTime}
                value={form.startTime}
                onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-300 transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-gray-400 mb-2">End Time</label>
              <input
                type="time"
                min={operatingRules.openingTime}
                max={operatingRules.closingTime}
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

const periodTypeLabels: Record<TBPeriodTemplate["type"], string> = {
  TEACHING: "Teaching",
  BREAK: "Break",
  ASSEMBLY: "Assembly",
  LUNCH: "Lunch",
  CLOSING: "Closing",
  OTHER: "Other",
};

type PeriodTemplatePanelProps = {
  periods: TBPeriodTemplate[];
  setPeriods: (periods: TBPeriodTemplate[]) => void;
  operatingRules: Props["operatingRules"];
};

const emptyPeriodForm = {
  id: "",
  name: "",
  type: "TEACHING" as TBPeriodTemplate["type"],
  startTime: "07:30",
  endTime: "08:10",
  order: 1,
  isActive: true,
};

function PeriodTemplatePanel({ periods, setPeriods, operatingRules }: PeriodTemplatePanelProps) {
  const [form, setForm] = useState(emptyPeriodForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sortedPeriods = [...periods].sort((a, b) => a.order - b.order || a.startTime.localeCompare(b.startTime));

  const resetForm = () => {
    setEditingId(null);
    setError(null);
    const nextOrder = sortedPeriods.length > 0 ? Math.max(...sortedPeriods.map((period) => period.order)) + 1 : 1;
    setForm({
      ...emptyPeriodForm,
      startTime: operatingRules.openingTime,
      endTime: getDefaultEndTime(operatingRules.openingTime, operatingRules.closingTime),
      order: nextOrder,
    });
  };

  const editPeriod = (period: TBPeriodTemplate) => {
    setEditingId(period.id);
    setError(null);
    setForm({
      id: period.id,
      name: period.name,
      type: period.type,
      startTime: period.startTime,
      endTime: period.endTime,
      order: period.order,
      isActive: period.isActive,
    });
  };

  const savePeriod = async () => {
    setSaving(true);
    setError(null);
    try {
      const payload = {
        ...(editingId ? { id: editingId } : {}),
        name: form.name,
        type: form.type,
        startTime: form.startTime,
        endTime: form.endTime,
        order: form.order,
        isActive: form.isActive,
      };
      const res = await fetch("/api/timetable/periods", {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not save period.");
        return;
      }
      setPeriods(
        editingId
          ? periods.map((period) => (period.id === editingId ? data : period))
          : [...periods, data],
      );
      resetForm();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const deletePeriod = async (period: TBPeriodTemplate) => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/timetable/periods?id=${period.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not remove period.");
        return;
      }
      setPeriods(periods.filter((item) => item.id !== period.id));
      if (editingId === period.id) resetForm();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-gray-400">Period setup</p>
          <h2 className="mt-1 text-lg font-black text-gray-900">Build the school day once</h2>
          <p className="mt-1 max-w-3xl text-sm font-semibold leading-6 text-gray-500">
            Periods keep lesson times consistent. Admins pick teaching periods when creating lesson slots;
            break, assembly, and lunch periods structure the day but do not create lesson duties.
          </p>
        </div>
        <div className="rounded-xl bg-gray-50 px-3 py-2 text-sm font-black text-gray-700">
          {operatingRules.openingTime}-{operatingRules.closingTime}
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_340px]">
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {sortedPeriods.map((period) => (
            <div
              key={period.id}
              className={`rounded-xl border p-3 ${
                period.isActive ? "border-gray-100 bg-gray-50" : "border-gray-100 bg-gray-50/50 opacity-60"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-black text-gray-900">{period.name}</p>
                  <p className="mt-1 text-xs font-bold text-gray-500">
                    {period.startTime}-{period.endTime} · {periodTypeLabels[period.type]}
                  </p>
                </div>
                <span className="rounded-full bg-white px-2 py-1 text-[10px] font-black text-gray-400">
                  #{period.order}
                </span>
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => editPeriod(period)}
                  className="rounded-lg bg-white px-3 py-1.5 text-xs font-black text-gray-600 ring-1 ring-gray-100 hover:text-indigo-600"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => deletePeriod(period)}
                  className="rounded-lg bg-white px-3 py-1.5 text-xs font-black text-rose-600 ring-1 ring-gray-100"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-black text-gray-900">{editingId ? "Edit period" : "Add period"}</p>
            {editingId ? (
              <button type="button" onClick={resetForm} className="text-xs font-black text-gray-400 hover:text-gray-700">
                Cancel
              </button>
            ) : null}
          </div>
          {error ? (
            <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs font-bold leading-5 text-rose-700">{error}</p>
          ) : null}
          <div className="mt-3 space-y-3">
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Period name"
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold outline-none focus:ring-2 focus:ring-indigo-300"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="time"
                min={operatingRules.openingTime}
                max={operatingRules.closingTime}
                value={form.startTime}
                onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold outline-none focus:ring-2 focus:ring-indigo-300"
              />
              <input
                type="time"
                min={operatingRules.openingTime}
                max={operatingRules.closingTime}
                value={form.endTime}
                onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold outline-none focus:ring-2 focus:ring-indigo-300"
              />
            </div>
            <div className="grid grid-cols-[1fr_90px] gap-2">
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as TBPeriodTemplate["type"] })}
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold outline-none focus:ring-2 focus:ring-indigo-300"
              >
                {Object.entries(periodTypeLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
              <input
                type="number"
                min={1}
                value={form.order}
                onChange={(e) => setForm({ ...form, order: Number(e.target.value) })}
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold outline-none focus:ring-2 focus:ring-indigo-300"
              />
            </div>
            <label className="flex items-center gap-2 text-xs font-bold text-gray-500">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
              />
              Active period
            </label>
            <button
              type="button"
              disabled={saving || !form.name.trim()}
              onClick={savePeriod}
              className="w-full rounded-xl bg-gray-950 px-4 py-2.5 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Saving..." : editingId ? "Save period" : "Add period"}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
const TimetableBuilder = ({
  classes,
  teachers,
  initialLessons,
  initialPeriodTemplates,
  operatingRules,
}: Props) => {
  const timetableDays = SCHOOL_WEEK_DAYS.filter((day) => operatingRules.activeDays.includes(day));
  const defaultDay = timetableDays[0] ?? "MONDAY";
  const [lessons, setLessons]             = useState<TBLesson[]>(initialLessons);
  const [periodTemplates, setPeriodTemplates] = useState<TBPeriodTemplate[]>(initialPeriodTemplates);
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
  const defaultEndTime = getDefaultEndTime(operatingRules.openingTime, operatingRules.closingTime);

  const defaultForm: SlotFormData = {
    day: defaultDay, startTime: operatingRules.openingTime, endTime: defaultEndTime,
    subjectId: "", classId: "", teacherId: "", periodTemplateId: "",
  };
  const [form, setForm] = useState<SlotFormData>(defaultForm);

  const showToast = (msg: string, type: "success" | "error") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const openCreate = (prefillDay?: string, prefillClassId?: number) => {
    setEditTarget(null);
    setModalError(null);
    const day = prefillDay && (timetableDays as readonly string[]).includes(prefillDay) ? prefillDay : defaultDay;
    setForm({ ...defaultForm, day, classId: prefillClassId ?? "" });
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
      periodTemplateId: lesson.periodTemplate?.id ?? "",
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
        periodTemplateId: form.periodTemplateId || null,
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
      <PeriodTemplatePanel
        periods={periodTemplates}
        setPeriods={setPeriodTemplates}
        operatingRules={operatingRules}
      />

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
        <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
          <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 sm:items-center">
            <div className="flex items-center gap-1.5 text-gray-400">
              <Filter size={13} />
              <span className="text-xs font-bold uppercase tracking-wide">Filter</span>
            </div>
            <div className="relative">
              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value === "all" ? "all" : parseInt(e.target.value))}
                className="w-full sm:w-auto pl-3 pr-7 py-2 sm:py-1.5 rounded-lg border border-gray-200 text-xs font-bold text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-300 appearance-none bg-white"
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
                className="w-full sm:w-auto pl-3 pr-7 py-2 sm:py-1.5 rounded-lg border border-gray-200 text-xs font-bold text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-300 appearance-none bg-white"
              >
                <option value="all">All Days</option>
                {timetableDays.map((d) => <option key={d} value={d}>{DAY_FULL[d]}</option>)}
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
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <p className="lg:hidden rounded-xl bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-600">
              List view is used automatically on smaller screens.
            </p>
            <div className="hidden lg:flex bg-gray-100 p-1 rounded-xl gap-1">
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
              className="flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-all shadow-sm"
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
            className="hidden lg:block bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
          >
            <div className="w-full overflow-x-auto">
              <table className="w-full min-w-[700px]">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/60">
                    <th className="text-left px-4 py-3 text-xs font-black uppercase tracking-wider text-gray-400 w-32 sticky left-0 bg-gray-50/60">Class</th>
                    {timetableDays.map((day) => (
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
                      {timetableDays.map((day) => {
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
        {(viewMode === "list" || viewMode === "grid") && (
          <motion.div
            key="list"
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className={`${viewMode === "grid" ? "lg:hidden" : ""} bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden`}
          >
            <div className="md:hidden">
              {filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center px-4 py-14 text-center">
                  <Calendar size={32} className="text-gray-200 mb-3" />
                  <p className="text-gray-400 font-semibold text-sm">No lessons match your filters</p>
                  <button onClick={() => openCreate()} className="mt-3 text-xs text-indigo-500 font-bold hover:underline">
                    + Add a lesson slot
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {filtered.map((lesson) => {
                    const c = subjectColorMap[lesson.subject.id] ?? COLORS[0];
                    return (
                      <motion.div key={lesson.id} layout className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${c.dot}`} />
                              <h3 className="font-black text-sm text-gray-800 truncate">
                                {lesson.subject.name}
                              </h3>
                            </div>
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              <span className={`text-[11px] font-bold px-2 py-1 rounded-lg ${c.bg} ${c.text}`}>
                                {lesson.class.name}
                              </span>
                              <span className="text-[11px] font-bold px-2 py-1 rounded-lg bg-gray-100 text-gray-500">
                                {DAY_FULL[lesson.day]}
                              </span>
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center gap-1.5">
                            <button
                              onClick={() => openEdit(lesson)}
                              className="w-9 h-9 rounded-lg bg-amber-50 hover:bg-amber-100 flex items-center justify-center transition-colors"
                              title="Edit lesson"
                            >
                              <Pencil size={14} className="text-amber-600" />
                            </button>
                            <button
                              onClick={() => setDeleteTarget(lesson)}
                              className="w-9 h-9 rounded-lg bg-rose-50 hover:bg-rose-100 flex items-center justify-center transition-colors"
                              title="Delete lesson"
                            >
                              <Trash2 size={14} className="text-rose-500" />
                            </button>
                          </div>
                        </div>
                        <div className="mt-3 grid grid-cols-1 gap-2 text-xs text-gray-500">
                          <div className="flex items-center justify-between gap-3 rounded-xl bg-gray-50 px-3 py-2">
                            <span className="font-bold text-gray-400">Time</span>
                            <span className="font-mono font-bold text-gray-600">
                              {formatTime(lesson.startTime)} - {formatTime(lesson.endTime)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-3 rounded-xl bg-gray-50 px-3 py-2">
                            <span className="font-bold text-gray-400">Duration</span>
                            <span className="font-bold text-gray-600">
                              {getDuration(lesson.startTime, lesson.endTime)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-3 rounded-xl bg-gray-50 px-3 py-2">
                            <span className="font-bold text-gray-400">Teacher</span>
                            <span className="min-w-0 truncate text-right font-bold text-gray-600">
                              {lesson.teacher.name} {lesson.teacher.surname}
                            </span>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="hidden md:block w-full overflow-x-auto">
              <table className="w-full min-w-[780px]">
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
                            <div className="flex items-center gap-1.5 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
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
              <div className="px-4 py-3 border-t border-gray-100 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
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
            periodTemplates={periodTemplates}
            days={timetableDays}
            operatingRules={operatingRules}
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
