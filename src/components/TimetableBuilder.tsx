"use client";

// src/components/TimetableBuilder.tsx

import { useEffect, useState, useTransition } from "react";
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
  lockDay:  boolean;
};

const SlotModal = ({
  form, setForm, classes, teachers,
  periodTemplates, days, operatingRules,
  onSave, onClose, saving, error, isEdit, lockDay,
}: SlotModalProps) => {

  // ✅ Derive the subject list from the selected teacher — not a global list
  const selectedTeacher   = teachers.find((t) => t.id === form.teacherId);
  const availableSubjects = selectedTeacher?.subjects ?? [];
  const teachingPeriods = periodTemplates.filter((period) => period.isActive && period.type === "TEACHING");
  const selectedPeriod = teachingPeriods.find((period) => period.id === form.periodTemplateId);
  const selectedClass = classes.find((item) => item.id === form.classId);

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
            {lockDay ? (
              <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-2.5">
                <p className="text-sm font-black text-indigo-700">{DAY_FULL[form.day]}</p>
                <p className="mt-1 text-xs font-semibold leading-5 text-indigo-600">
                  This lesson is managed from Build by Class, so it follows the selected timetable day.
                </p>
              </div>
            ) : (
              <>
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
              </>
            )}
          </div>

          {/* Period */}
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-gray-400 mb-2">
              Period
            </label>
            {lockDay ? (
              <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5">
                <p className="text-sm font-black text-gray-800">
                  {selectedPeriod ? selectedPeriod.name : "Selected teaching period"}
                </p>
                <p className="mt-1 text-xs font-semibold leading-5 text-gray-500">
                  {form.startTime}-{form.endTime} · fixed from the period row.
                </p>
              </div>
            ) : (
              <>
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
              </>
            )}
          </div>

          {/* Time */}
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-gray-400 mb-2">Time</label>
            {lockDay ? (
              <div className="grid gap-2 sm:grid-cols-3">
                <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5">
                  <p className="text-[10px] font-black uppercase tracking-wide text-gray-400">Start</p>
                  <p className="mt-1 text-sm font-black text-gray-800">{form.startTime}</p>
                </div>
                <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5">
                  <p className="text-[10px] font-black uppercase tracking-wide text-gray-400">End</p>
                  <p className="mt-1 text-sm font-black text-gray-800">{form.endTime}</p>
                </div>
                <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5">
                  <p className="text-[10px] font-black uppercase tracking-wide text-gray-400">Duration</p>
                  <p className="mt-1 text-sm font-black text-gray-800">
                    {durationMins > 0 ? getDuration(`1970-01-01T${form.startTime}`, `1970-01-01T${form.endTime}`) : "Fixed"}
                  </p>
                </div>
              </div>
            ) : (
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
            )}
          </div>

          {/* Quick duration */}
          {!lockDay && (
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
          )}

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
            {lockDay ? (
              <div className="flex items-center gap-2 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5">
                <GraduationCap size={14} className="text-gray-400" />
                <div>
                  <p className="text-sm font-black text-gray-800">{selectedClass?.name ?? "Selected class"}</p>
                  <p className="mt-0.5 text-xs font-semibold text-gray-400">Fixed from Build by Class.</p>
                </div>
              </div>
            ) : (
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
            )}
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
  lessonCountsByPeriod: Map<string, number>;
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

function PeriodTemplatePanel({
  periods,
  setPeriods,
  operatingRules,
  lessonCountsByPeriod,
}: PeriodTemplatePanelProps) {
  const [form, setForm] = useState(emptyPeriodForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sortedPeriods = [...periods].sort((a, b) => a.order - b.order || a.startTime.localeCompare(b.startTime));
  const linkedLessonCount = editingId ? lessonCountsByPeriod.get(editingId) ?? 0 : 0;
  const isEditingLinkedPeriod = linkedLessonCount > 0;

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
    if (editingId && isEditingLinkedPeriod) {
      const existing = periods.find((period) => period.id === editingId);
      const changedProtectedFields =
        existing &&
        (existing.type !== form.type ||
          existing.startTime !== form.startTime ||
          existing.endTime !== form.endTime ||
          existing.isActive !== form.isActive);
      if (changedProtectedFields) {
        setSaving(false);
        setError(
          "This period already has lessons. You can rename or reorder it, but time, type, and active status are locked until those lessons are moved or removed.",
        );
        return;
      }
    }
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
    const linkedLessons = lessonCountsByPeriod.get(period.id) ?? 0;
    if (linkedLessons > 0) {
      setError(
        `${period.name} has ${linkedLessons} lesson${linkedLessons === 1 ? "" : "s"}. Move or delete those lessons before removing the period.`,
      );
      return;
    }
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
          {sortedPeriods.map((period) => {
            const linkedLessons = lessonCountsByPeriod.get(period.id) ?? 0;
            return (
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
                    {linkedLessons > 0 ? (
                      <p className="mt-2 inline-flex rounded-full bg-amber-50 px-2 py-1 text-[10px] font-black text-amber-700">
                        {linkedLessons} linked lesson{linkedLessons === 1 ? "" : "s"}
                      </p>
                    ) : null}
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
                    className={`rounded-lg bg-white px-3 py-1.5 text-xs font-black ring-1 ring-gray-100 ${
                      linkedLessons > 0 ? "text-gray-400" : "text-rose-600"
                    }`}
                  >
                    {linkedLessons > 0 ? "Protected" : "Remove"}
                  </button>
                </div>
              </div>
            );
          })}
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
          {isEditingLinkedPeriod ? (
            <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs font-bold leading-5 text-amber-700">
              This period has {linkedLessonCount} linked lesson{linkedLessonCount === 1 ? "" : "s"}. Time, type, and active status are locked to protect the timetable.
            </p>
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
                disabled={isEditingLinkedPeriod}
                onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold outline-none focus:ring-2 focus:ring-indigo-300 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400"
              />
              <input
                type="time"
                min={operatingRules.openingTime}
                max={operatingRules.closingTime}
                value={form.endTime}
                disabled={isEditingLinkedPeriod}
                onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold outline-none focus:ring-2 focus:ring-indigo-300 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400"
              />
            </div>
            <div className="grid grid-cols-[1fr_90px] gap-2">
              <select
                value={form.type}
                disabled={isEditingLinkedPeriod}
                onChange={(e) => setForm({ ...form, type: e.target.value as TBPeriodTemplate["type"] })}
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold outline-none focus:ring-2 focus:ring-indigo-300 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400"
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
                disabled={isEditingLinkedPeriod}
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
  const [builderMode, setBuilderMode]   = useState<"build" | "review">("build");
  const [buildClassId, setBuildClassId] = useState<number | "">(classes[0]?.id ?? "");
  const [buildDay, setBuildDay]         = useState<string>(defaultDay);
  const [selectedClass, setSelectedClass] = useState<number | "all">("all");
  const [selectedDay, setSelectedDay]     = useState<string>("all");
  const [viewMode, setViewMode]           = useState<"grid" | "list">("grid");
  const [isCompactReview, setIsCompactReview] = useState(true);
  const [modalOpen, setModalOpen]         = useState(false);
  const [modalDayLocked, setModalDayLocked] = useState(false);
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
  const sortedActivePeriods = [...periodTemplates]
    .filter((period) => period.isActive)
    .sort((a, b) => a.order - b.order || a.startTime.localeCompare(b.startTime));
  const selectedBuildClass = classes.find((item) => item.id === buildClassId);
  const lessonCountsByPeriod = new Map<string, number>();
  for (const lesson of lessons) {
    const periodId = lesson.periodTemplate?.id;
    if (!periodId) continue;
    lessonCountsByPeriod.set(periodId, (lessonCountsByPeriod.get(periodId) ?? 0) + 1);
  }

  const showToast = (msg: string, type: "success" | "error") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    const query = window.matchMedia("(max-width: 1023px)");
    const updateCompactView = () => setIsCompactReview(query.matches);

    updateCompactView();
    query.addEventListener("change", updateCompactView);
    return () => query.removeEventListener("change", updateCompactView);
  }, []);

  const openCreateForPeriod = (period: TBPeriodTemplate) => {
    if (!buildClassId || period.type !== "TEACHING") return;
    setEditTarget(null);
    setModalError(null);
    setModalDayLocked(true);
    setForm({
      ...defaultForm,
      day: buildDay,
      classId: buildClassId,
      periodTemplateId: period.id,
      startTime: period.startTime,
      endTime: period.endTime,
    });
    setModalOpen(true);
  };

  const openEdit = (lesson: TBLesson, lockContext = false) => {
    setEditTarget(lesson);
    setModalError(null);
    setModalDayLocked(lockContext);
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
    if (!form.periodTemplateId) {
      setModalError("Select a teaching period before saving this lesson.");
      return;
    }
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
        periodTemplateId: form.periodTemplateId,
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

  const gridClasses = selectedClass === "all"
    ? classes
    : classes.filter((c) => c.id === selectedClass);

  const reviewDays = selectedDay === "all" ? timetableDays : timetableDays.filter((day) => day === selectedDay);
  const reviewClasses = gridClasses;
  const reviewLessonCount = lessons.filter((lesson) => {
    const classMatch = selectedClass === "all" || lesson.class.id === selectedClass;
    const dayMatch = selectedDay === "all" || lesson.day === selectedDay;
    return classMatch && dayMatch;
  }).length;
  const reviewNonTeachingPeriods = sortedActivePeriods.filter((period) => period.type !== "TEACHING").length;
  const reviewDayClassCount = reviewDays.length * reviewClasses.length;
  const reviewDisplayMode = isCompactReview ? "list" : viewMode;

  const getLessonForReviewPeriod = (classId: number, day: string, period: TBPeriodTemplate) =>
    lessons.find((lesson) => {
      const sameClassAndDay = lesson.class.id === classId && lesson.day === day;
      if (!sameClassAndDay) return false;
      const sameTemplate = lesson.periodTemplate?.id === period.id;
      const sameTime =
        formatTime(lesson.startTime) === period.startTime &&
        formatTime(lesson.endTime) === period.endTime;
      return sameTemplate || sameTime;
    });

  const getPeriodStyle = (type: TBPeriodTemplate["type"]) => {
    switch (type) {
      case "BREAK":
        return {
          wrap: "border-sky-100 bg-sky-50 text-sky-700",
          dot: "bg-sky-400",
          label: "Break",
        };
      case "LUNCH":
        return {
          wrap: "border-amber-100 bg-amber-50 text-amber-700",
          dot: "bg-amber-400",
          label: "Lunch",
        };
      case "ASSEMBLY":
        return {
          wrap: "border-violet-100 bg-violet-50 text-violet-700",
          dot: "bg-violet-400",
          label: "Assembly",
        };
      case "CLOSING":
        return {
          wrap: "border-slate-200 bg-slate-50 text-slate-600",
          dot: "bg-slate-400",
          label: "Closing",
        };
      case "OTHER":
        return {
          wrap: "border-gray-200 bg-gray-50 text-gray-600",
          dot: "bg-gray-400",
          label: "School activity",
        };
      default:
        return {
          wrap: "border-gray-100 bg-white text-gray-700",
          dot: "bg-gray-300",
          label: "Lesson",
        };
    }
  };

  const getLessonsForPeriod = (period: TBPeriodTemplate) => {
    if (!buildClassId) return [];
    return lessons.filter((lesson) => {
      const sameClassAndDay = lesson.class.id === buildClassId && lesson.day === buildDay;
      if (!sameClassAndDay) return false;
      const sameTemplate = lesson.periodTemplate?.id === period.id;
      const sameTime =
        formatTime(lesson.startTime) === period.startTime &&
        formatTime(lesson.endTime) === period.endTime;
      return sameTemplate || sameTime;
    });
  };

  return (
    <div className="flex flex-col gap-5">
      <PeriodTemplatePanel
        periods={periodTemplates}
        setPeriods={setPeriodTemplates}
        operatingRules={operatingRules}
        lessonCountsByPeriod={lessonCountsByPeriod}
      />

      <div className="rounded-2xl border border-gray-100 bg-white p-3 shadow-sm">
        <div className="grid gap-2 sm:grid-cols-2">
          {[
            {
              value: "build" as const,
              title: "Build by Class",
              text: "Choose a class and fill the day period by period.",
            },
            {
              value: "review" as const,
              title: "Review All",
              text: "Inspect the full timetable across classes and days.",
            },
          ].map((mode) => (
            <button
              key={mode.value}
              type="button"
              onClick={() => setBuilderMode(mode.value)}
              className={`rounded-xl border px-4 py-3 text-left transition-all ${
                builderMode === mode.value
                  ? "border-gray-900 bg-gray-950 text-white shadow-sm"
                  : "border-gray-100 bg-gray-50 text-gray-600 hover:border-gray-200"
              }`}
            >
              <span className="block text-sm font-black">{mode.title}</span>
              <span className={`mt-1 block text-xs font-semibold leading-5 ${
                builderMode === mode.value ? "text-gray-300" : "text-gray-400"
              }`}>
                {mode.text}
              </span>
            </button>
          ))}
        </div>
      </div>

      {builderMode === "build" && (
        <section className="rounded-2xl border border-gray-100 bg-white shadow-sm">
          <div className="border-b border-gray-100 p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-gray-400">Build by class</p>
                <h2 className="mt-1 text-lg font-black text-gray-900">
                  {selectedBuildClass ? `${selectedBuildClass.name} - ${DAY_FULL[buildDay]}` : "Select a class"}
                </h2>
                <p className="mt-1 text-sm font-semibold leading-6 text-gray-500">
                  Fill teaching periods only. Break, assembly, lunch, and closing periods structure the day.
                </p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:min-w-[420px]">
                <div className="relative">
                  <select
                    value={buildClassId}
                    onChange={(e) => setBuildClassId(e.target.value ? parseInt(e.target.value) : "")}
                    className="w-full appearance-none rounded-xl border border-gray-200 bg-white px-3 py-2.5 pr-8 text-sm font-black text-gray-700 outline-none focus:ring-2 focus:ring-indigo-300"
                  >
                    <option value="">Choose class</option>
                    {classes.map((cls) => (
                      <option key={cls.id} value={cls.id}>{cls.name}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
                </div>
                <div className="relative">
                  <select
                    value={buildDay}
                    onChange={(e) => setBuildDay(e.target.value)}
                    className="w-full appearance-none rounded-xl border border-gray-200 bg-white px-3 py-2.5 pr-8 text-sm font-black text-gray-700 outline-none focus:ring-2 focus:ring-indigo-300"
                  >
                    {timetableDays.map((day) => (
                      <option key={day} value={day}>{DAY_FULL[day]}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
                </div>
              </div>
            </div>
          </div>

          {!buildClassId ? (
            <div className="flex flex-col items-center justify-center px-4 py-14 text-center">
              <Calendar size={32} className="mb-3 text-gray-200" />
              <p className="text-sm font-bold text-gray-400">Choose a class to start building the timetable.</p>
            </div>
          ) : sortedActivePeriods.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-4 py-14 text-center">
              <Calendar size={32} className="mb-3 text-gray-200" />
              <p className="text-sm font-bold text-gray-400">Set up active periods before adding lessons.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {sortedActivePeriods.map((period) => {
                const periodLessons = getLessonsForPeriod(period);
                const isTeachingPeriod = period.type === "TEACHING";
                return (
                  <div key={period.id} className="grid gap-3 p-4 lg:grid-cols-[220px_1fr] lg:items-start">
                    <div className="flex items-start justify-between gap-3 lg:block">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-gray-100 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-gray-500">
                            #{period.order}
                          </span>
                          <span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-wide ${
                            isTeachingPeriod ? "bg-emerald-50 text-emerald-700" : "bg-blue-50 text-blue-700"
                          }`}>
                            {periodTypeLabels[period.type]}
                          </span>
                        </div>
                        <p className="mt-2 text-sm font-black text-gray-900">{period.name}</p>
                        <p className="mt-1 text-xs font-bold text-gray-400">
                          {period.startTime}-{period.endTime}
                        </p>
                      </div>
                    </div>

                    {isTeachingPeriod ? (
                      <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                        {periodLessons.length === 0 ? (
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <p className="text-sm font-black text-gray-700">No lesson added</p>
                              <p className="mt-1 text-xs font-semibold text-gray-400">
                                Add the subject and teacher for this period.
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => openCreateForPeriod(period)}
                              className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-black text-white hover:bg-indigo-700"
                            >
                              <Plus size={13} /> Add lesson
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {periodLessons.length > 1 ? (
                              <div className="rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-xs font-bold leading-5 text-rose-700">
                                This period has more than one lesson. Edit or remove the duplicate so this class has one clear lesson for the period.
                              </div>
                            ) : (
                              <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs font-bold leading-5 text-emerald-700">
                                This period is occupied. Use Edit to correct it, or delete it before adding a replacement.
                              </div>
                            )}
                            {periodLessons.map((lesson) => {
                              const c = subjectColorMap[lesson.subject.id] ?? COLORS[0];
                              return (
                                <div
                                  key={lesson.id}
                                  className="flex flex-col gap-3 rounded-xl border border-gray-100 bg-white p-3 sm:flex-row sm:items-center sm:justify-between"
                                >
                                  <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className={`h-2.5 w-2.5 rounded-full ${c.dot}`} />
                                      <p className="font-black text-gray-900">{lesson.subject.name}</p>
                                      <span className={`rounded-lg px-2 py-1 text-[11px] font-black ${c.bg} ${c.text}`}>
                                        {lesson.teacher.name} {lesson.teacher.surname}
                                      </span>
                                    </div>
                                    <p className="mt-1 text-xs font-semibold text-gray-400">
                                      {formatTime(lesson.startTime)}-{formatTime(lesson.endTime)}
                                      {lesson.periodTemplate?.id ? " - linked to period" : " - matched by time"}
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => openEdit(lesson, true)}
                                      className="flex h-9 items-center justify-center gap-2 rounded-lg bg-amber-50 px-3 text-xs font-black text-amber-700 hover:bg-amber-100"
                                    >
                                      <Pencil size={13} /> Edit
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setDeleteTarget(lesson)}
                                      className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100"
                                      title="Delete lesson"
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3">
                        <p className="text-sm font-black text-blue-800">{periodTypeLabels[period.type]} period</p>
                        <p className="mt-1 text-xs font-semibold leading-5 text-blue-700">
                          This period is part of the school day structure and does not need a subject or teacher.
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {builderMode === "review" && (
        <>
      {/* Toolbar */}
      <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700">
                Final timetable view only
              </span>
              <span className="rounded-xl bg-gray-50 px-3 py-2 text-xs font-bold text-gray-500">
                Includes lessons, breaks, lunch, assembly and closing periods
              </span>
            </div>
            <p className="mt-2 text-xs font-semibold leading-5 text-gray-400">
              Review the complete school day here. Use Build by Class when a lesson needs to be changed.
            </p>
          </div>

          <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
              <div className="flex items-center gap-1.5 text-gray-400">
                <Filter size={13} />
                <span className="text-xs font-bold uppercase tracking-wide">Filter</span>
              </div>
              <div className="relative">
                <select
                  value={selectedClass}
                  onChange={(e) => setSelectedClass(e.target.value === "all" ? "all" : parseInt(e.target.value))}
                  className="w-full min-w-40 appearance-none rounded-xl border border-gray-200 bg-white py-2 pl-3 pr-8 text-xs font-bold text-gray-600 outline-none focus:ring-2 focus:ring-indigo-300"
                >
                  <option value="all">All Classes</option>
                  {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <ChevronDown size={11} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
              </div>
              <div className="relative">
                <select
                  value={selectedDay}
                  onChange={(e) => setSelectedDay(e.target.value)}
                  className="w-full min-w-36 appearance-none rounded-xl border border-gray-200 bg-white py-2 pl-3 pr-8 text-xs font-bold text-gray-600 outline-none focus:ring-2 focus:ring-indigo-300"
                >
                  <option value="all">All Days</option>
                  {timetableDays.map((d) => <option key={d} value={d}>{DAY_FULL[d]}</option>)}
                </select>
                <ChevronDown size={11} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
              </div>
              {(selectedClass !== "all" || selectedDay !== "all") && (
                <button
                  onClick={() => { setSelectedClass("all"); setSelectedDay("all"); }}
                  className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-bold text-rose-500 transition-colors hover:bg-rose-100"
                >Clear</button>
              )}
            </div>
            <div className="hidden bg-gray-100 p-1 rounded-xl gap-1 lg:flex">
              {(["grid", "list"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setViewMode(v)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all capitalize
                    ${viewMode === v ? "bg-white text-indigo-600 shadow-sm" : "text-gray-400 hover:text-gray-600"}`}
                >{v}</button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Classes shown", value: reviewClasses.length },
            { label: "Days shown", value: reviewDays.length },
            { label: "Teaching lessons", value: reviewLessonCount },
            { label: "Non-teaching periods", value: reviewNonTeachingPeriods },
          ].map((item) => (
            <div key={item.label} className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2">
              <p className="text-[11px] font-black uppercase tracking-wide text-gray-400">{item.label}</p>
              <p className="mt-1 text-lg font-black text-gray-900">{item.value}</p>
            </div>
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait">

        {/* GRID VIEW */}
        {reviewDisplayMode === "grid" && (
          <motion.div
            key="grid"
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
          >
            <div className="w-full overflow-x-auto">
              <table className="w-full min-w-[900px]">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/60">
                    <th className="sticky left-0 w-36 bg-gray-50/95 px-4 py-3 text-left text-xs font-black uppercase tracking-wider text-gray-400">Class</th>
                    {reviewDays.map((day) => (
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
                  {reviewClasses.map((cls) => (
                    <tr key={cls.id} className="hover:bg-gray-50/40 transition-colors group">
                      <td className="sticky left-0 bg-white px-4 py-3 group-hover:bg-gray-50/95">
                        <div className="flex flex-col">
                          <span className="text-sm font-black text-gray-900">{cls.name}</span>
                          <span className="text-[10px] text-gray-400 font-medium">{cls.grade.level}</span>
                        </div>
                      </td>
                      {reviewDays.map((day) => {
                        return (
                          <td key={day} className="align-top px-2 py-2">
                            <div className="flex min-h-[90px] flex-col gap-1.5">
                              {sortedActivePeriods.map((period) => {
                                const lesson = period.type === "TEACHING"
                                  ? getLessonForReviewPeriod(cls.id, day, period)
                                  : null;

                                if (!lesson) {
                                  const style = getPeriodStyle(period.type);
                                  return (
                                    <div
                                      key={period.id}
                                      className={`rounded-xl border px-2.5 py-2 ${style.wrap}`}
                                    >
                                      <div className="flex items-center justify-between gap-2">
                                        <span className="text-[10px] font-black uppercase tracking-wide">
                                          {period.type === "TEACHING" ? "Open teaching slot" : style.label}
                                        </span>
                                        <span className="whitespace-nowrap font-mono text-[10px] font-bold opacity-70">
                                          {period.startTime}-{period.endTime}
                                        </span>
                                      </div>
                                      <p className="mt-1 truncate text-[11px] font-black">
                                        {period.type === "TEACHING" ? "No lesson assigned" : period.name}
                                      </p>
                                    </div>
                                  );
                                }

                                const c = subjectColorMap[lesson.subject.id] ?? COLORS[0];
                                return (
                                  <motion.div
                                    key={`${period.id}-${lesson.id}`}
                                    layout
                                    className={`rounded-xl border-l-[3px] px-2.5 py-2 ${c.bg} ${c.border.replace("border-", "border-l-")}`}
                                  >
                                    <div className="flex items-center justify-between gap-2">
                                      <p className={`truncate text-xs font-black ${c.text}`}>{lesson.subject.name}</p>
                                      <span className={`whitespace-nowrap font-mono text-[10px] font-bold opacity-70 ${c.text}`}>
                                        {period.startTime}-{period.endTime}
                                      </span>
                                    </div>
                                    <p className={`mt-1 truncate text-[10px] font-semibold opacity-70 ${c.text}`}>
                                      {lesson.teacher.name} {lesson.teacher.surname}
                                    </p>
                                  </motion.div>
                                );
                              })}
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
        {reviewDisplayMode === "list" && (
          <motion.div
            key="list"
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
          >
            <div className="divide-y divide-gray-100">
              {reviewDayClassCount === 0 ? (
                <div className="flex flex-col items-center justify-center px-4 py-14 text-center">
                  <Calendar size={32} className="mb-3 text-gray-200" />
                  <p className="text-sm font-semibold text-gray-400">No timetable records match your filters</p>
                </div>
              ) : (
                reviewDays.map((day) => (
                  <section key={day} className="p-4">
                    <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                      <div>
                        <p className="text-[11px] font-black uppercase tracking-wider text-gray-400">School day</p>
                        <h3 className="text-base font-black text-gray-900">{DAY_FULL[day]}</h3>
                      </div>
                      <p className="text-xs font-bold text-gray-400">
                        {reviewClasses.length} classes · {sortedActivePeriods.length} periods
                      </p>
                    </div>

                    <div className="grid gap-3 xl:grid-cols-2">
                      {reviewClasses.map((cls) => (
                        <motion.div
                          key={`${day}-${cls.id}`}
                          layout
                          className="rounded-2xl border border-gray-100 bg-white p-3 shadow-sm"
                        >
                          <div className="mb-3 flex items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-black text-gray-900">{cls.name}</p>
                              <p className="text-xs font-semibold text-gray-400">{cls.grade.level}</p>
                            </div>
                            <span className="rounded-full bg-gray-50 px-2.5 py-1 text-[11px] font-black text-gray-500">
                              {lessons.filter((lesson) => lesson.class.id === cls.id && lesson.day === day).length} lessons
                            </span>
                          </div>

                          <div className="space-y-2">
                            {sortedActivePeriods.map((period) => {
                              const lesson = period.type === "TEACHING"
                                ? getLessonForReviewPeriod(cls.id, day, period)
                                : null;
                              const periodStyle = getPeriodStyle(period.type);

                              if (!lesson) {
                                return (
                                  <div
                                    key={period.id}
                                    className={`rounded-xl border px-3 py-2 ${periodStyle.wrap}`}
                                  >
                                    <div className="flex items-start justify-between gap-3">
                                      <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                          <span className={`h-2 w-2 rounded-full ${periodStyle.dot}`} />
                                          <p className="truncate text-sm font-black">
                                            {period.type === "TEACHING" ? "No lesson assigned" : period.name}
                                          </p>
                                        </div>
                                        <p className="mt-1 text-[11px] font-bold opacity-70">
                                          {period.type === "TEACHING" ? "Open teaching slot" : periodStyle.label}
                                        </p>
                                      </div>
                                      <span className="whitespace-nowrap font-mono text-[11px] font-black opacity-70">
                                        {period.startTime}-{period.endTime}
                                      </span>
                                    </div>
                                  </div>
                                );
                              }

                              const c = subjectColorMap[lesson.subject.id] ?? COLORS[0];
                              return (
                                <div
                                  key={`${period.id}-${lesson.id}`}
                                  className={`rounded-xl border px-3 py-2 ${c.bg} ${c.border}`}
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-2">
                                        <span className={`h-2 w-2 rounded-full ${c.dot}`} />
                                        <p className={`truncate text-sm font-black ${c.text}`}>
                                          {lesson.subject.name}
                                        </p>
                                      </div>
                                      <p className={`mt-1 truncate text-[11px] font-bold opacity-70 ${c.text}`}>
                                        {lesson.teacher.name} {lesson.teacher.surname}
                                      </p>
                                    </div>
                                    <span className={`whitespace-nowrap font-mono text-[11px] font-black opacity-70 ${c.text}`}>
                                      {period.startTime}-{period.endTime}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </section>
                ))
              )}
            </div>
            {reviewDayClassCount > 0 && (
              <div className="px-4 py-3 border-t border-gray-100 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-gray-400 font-medium">
                  Showing {reviewLessonCount} teaching lessons across {reviewDayClassCount} class-day views
                </p>
                <p className="text-xs font-bold text-gray-400">Use Build by Class to make changes.</p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
        </>
      )}

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
            lockDay={modalDayLocked}
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
