"use client";

// src/components/AttendanceTaker.tsx

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2, XCircle, Clock, FileCheck,
  ChevronRight, Loader2, AlertCircle, Users,
  CalendarDays, BookOpen, Save, CheckCheck,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
type TeacherLesson = {
  id:          number;
  subjectName: string;
  className:   string;
  classId:     number;
  startTime:   string;
  endTime:     string;
  day:         string;
};

type Student = {
  id:      string;
  name:    string;
  surname: string;
  img:     string | null;
};

type AttendanceRecord = {
  studentId: string;
  status:    "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";
  note?:     string;
  arrivalTime?: string;
};

type ExistingRecord = {
  studentId: string;
  status:    "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";
  note:      string | null;
  arrivalTime: string | null;
};

type Props = {
  teacherLessons:    TeacherLesson[];
  selectedLessonId:  number | null;
  selectedLesson:    { id: number; subjectName: string; className: string } | null;
  students:          Student[];
  existingAttendance: ExistingRecord[];
  dateStr:           string;
  todayStr:          string;
  role:              string;
};

// ─── Status config ────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  PRESENT: {
    label:  "Present",
    short:  "P",
    icon:   <CheckCircle2 size={15} />,
    bg:     "bg-emerald-500",
    text:   "text-white",
    ring:   "ring-emerald-400",
    light:  "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  ABSENT: {
    label:  "Absent",
    short:  "A",
    icon:   <XCircle size={15} />,
    bg:     "bg-rose-500",
    text:   "text-white",
    ring:   "ring-rose-400",
    light:  "bg-rose-50 text-rose-700 border-rose-200",
  },
  LATE: {
    label:  "Late",
    short:  "L",
    icon:   <Clock size={15} />,
    bg:     "bg-amber-500",
    text:   "text-white",
    ring:   "ring-amber-400",
    light:  "bg-amber-50 text-amber-700 border-amber-200",
  },
  EXCUSED: {
    label:  "Excused",
    short:  "E",
    icon:   <FileCheck size={15} />,
    bg:     "bg-indigo-500",
    text:   "text-white",
    ring:   "ring-indigo-400",
    light:  "bg-indigo-50 text-indigo-700 border-indigo-200",
  },
};

const formatTime = (iso: string) => {
  const d = new Date(iso);
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
};

const getApiErrorMessage = (data: unknown) => {
  if (!data || typeof data !== "object") return "Failed to save attendance.";
  const payload = data as { error?: unknown; issues?: unknown; issueDetails?: unknown };
  if (payload.issueDetails && typeof payload.issueDetails === "object") {
    const firstIssue = Object.values(payload.issueDetails as Record<string, unknown>)
      .flatMap((value) => Array.isArray(value) ? value : [])
      .find((value): value is string => typeof value === "string" && value.trim().length > 0);
    if (firstIssue) return firstIssue;
  }
  if (payload.issues && typeof payload.issues === "object") {
    const firstIssue = Object.values(payload.issues as Record<string, unknown>)
      .flatMap((value) => Array.isArray(value) ? value : [])
      .find((value): value is string => typeof value === "string" && value.trim().length > 0);
    if (firstIssue) return firstIssue;
  }
  return typeof payload.error === "string" ? payload.error : "Failed to save attendance.";
};

// ─── Component ────────────────────────────────────────────────────────────────
const AttendanceTaker = ({
  teacherLessons,
  selectedLessonId,
  selectedLesson,
  students,
  existingAttendance,
  dateStr,
  todayStr,
}: Props) => {
  const router = useRouter();
  const [, startTransition] = useTransition();

  // Build initial attendance state from existing records or default to PRESENT
  const buildInitialState = (): Record<string, AttendanceRecord> => {
    const state: Record<string, AttendanceRecord> = {};
    students.forEach((s) => {
      const existing = existingAttendance.find((e) => e.studentId === s.id);
      state[s.id] = {
        studentId: s.id,
        status:    existing?.status ?? "PRESENT",
        note:      existing?.note   ?? "",
        arrivalTime: existing?.arrivalTime ?? "",
      };
    });
    return state;
  };

  const [attendance, setAttendance] = useState<Record<string, AttendanceRecord>>(buildInitialState);
  const [noteTarget, setNoteTarget] = useState<string | null>(null);
  const [saving,     setSaving]     = useState(false);
  const [saved,      setSaved]      = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  const isToday    = dateStr === todayStr;
  const isPastDate = dateStr < todayStr;

  const defaultRecordFor = (studentId: string): AttendanceRecord => ({
    studentId,
    status: "PRESENT",
    note: "",
    arrivalTime: "",
  });

  // ── Mark single student ──────────────────────────────────────────────────
  const markStudent = (studentId: string, status: AttendanceRecord["status"]) => {
    setAttendance((prev) => ({
      ...prev,
      [studentId]: {
        ...(prev[studentId] ?? defaultRecordFor(studentId)),
        studentId,
        status,
        arrivalTime: status === "LATE" ? prev[studentId]?.arrivalTime ?? "" : "",
      },
    }));
    if (status === "LATE") {
      setNoteTarget(studentId);
    }
  };

  const setNote = (studentId: string, note: string) => {
    setAttendance((prev) => ({
      ...prev,
      [studentId]: { ...(prev[studentId] ?? defaultRecordFor(studentId)), studentId, note },
    }));
  };

  const setArrivalTime = (studentId: string, arrivalTime: string) => {
    setAttendance((prev) => ({
      ...prev,
      [studentId]: { ...(prev[studentId] ?? defaultRecordFor(studentId)), studentId, arrivalTime },
    }));
  };

  // ── Bulk mark all ────────────────────────────────────────────────────────
  const markAll = (status: AttendanceRecord["status"]) => {
    const updated: Record<string, AttendanceRecord> = {};
    students.forEach((s) => {
      updated[s.id] = {
        studentId: s.id,
        status,
        note: attendance[s.id]?.note ?? "",
        arrivalTime: status === "LATE" ? attendance[s.id]?.arrivalTime ?? "" : "",
      };
    });
    setAttendance(updated);
    if (status === "LATE" && students[0]) {
      setNoteTarget(students[0].id);
    }
  };

  // ── Stats ────────────────────────────────────────────────────────────────
  const counts = Object.values(attendance).reduce(
    (acc, r) => { acc[r.status] = (acc[r.status] ?? 0) + 1; return acc; },
    {} as Record<string, number>
  );

  // ── Submit ───────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!selectedLessonId) return;
    const records = students.map((student) => {
      const record = attendance[student.id] ?? defaultRecordFor(student.id);
      return {
        studentId: student.id,
        status: record.status ?? "PRESENT",
        note: record.note?.trim() || null,
        arrivalTime: record.status === "LATE" ? record.arrivalTime?.trim() || null : null,
      };
    });

    const lateWithoutNote = records.find(
      (record) => record.status === "LATE" && !record.note?.trim(),
    );
    if (lateWithoutNote) {
      setError("Add a note for every late student before saving attendance.");
      setNoteTarget(lateWithoutNote.studentId);
      return;
    }
    const lateWithoutArrivalTime = records.find(
      (record) => record.status === "LATE" && !record.arrivalTime?.trim(),
    );
    if (lateWithoutArrivalTime) {
      setError("Add arrival time for every late student before saving attendance.");
      setNoteTarget(lateWithoutArrivalTime.studentId);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/attendance", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lessonId: selectedLessonId,
          date:     dateStr,
          records,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(getApiErrorMessage(data)); return; }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // ── Navigate to lesson ───────────────────────────────────────────────────
  const goToLesson = (lessonId: number) => {
    startTransition(() => {
      router.push(`/list/attendance/take?lessonId=${lessonId}&date=${dateStr}`);
    });
  };

  return (
    <div className="flex flex-col gap-5">

      {/* ── Page header ── */}
      <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 bg-emerald-50 rounded-2xl flex items-center justify-center shrink-0">
              <CalendarDays size={20} className="text-emerald-600" />
            </div>
            <div>
              <h1 className="text-xl font-black text-gray-800 tracking-tight">Take Attendance</h1>
              <p className="text-sm text-gray-400 mt-0.5 font-medium">
                {new Date(dateStr).toLocaleDateString("en-GH", {
                  weekday: "long", day: "numeric", month: "long", year: "numeric",
                })}
                {isToday && <span className="ml-2 text-emerald-500 font-bold">· Today</span>}
                {isPastDate && <span className="ml-2 text-amber-500 font-bold">· Past date</span>}
              </p>
            </div>
          </div>

          {/* Date picker */}
          <input
            type="date"
            value={dateStr}
            max={todayStr}
            onChange={(e) => {
              startTransition(() => {
                const url = selectedLessonId
                  ? `/list/attendance/take?lessonId=${selectedLessonId}&date=${e.target.value}`
                  : `/list/attendance/take?date=${e.target.value}`;
                router.push(url);
              });
            }}
            className="px-3 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-300 transition-all"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">

        {/* ── LEFT: Lesson selector ── */}
        <div className="xl:col-span-1">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-4 py-3.5 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-black text-gray-800 text-sm">Today&apos;s Lessons</h2>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                {teacherLessons.length} periods
              </span>
            </div>

            {teacherLessons.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                <BookOpen size={28} className="text-gray-200 mb-3" />
                <p className="text-sm text-gray-400 font-semibold">No lessons scheduled</p>
                <p className="text-xs text-gray-300 mt-1">for this day</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {teacherLessons.map((lesson) => {
                  const isSelected = selectedLessonId === lesson.id;
                  return (
                    <button
                      key={lesson.id}
                      onClick={() => goToLesson(lesson.id)}
                      className={`w-full flex items-center gap-3 px-4 py-3.5 text-left transition-all
                        ${isSelected
                          ? "bg-emerald-50 border-l-4 border-emerald-500"
                          : "hover:bg-gray-50 border-l-4 border-transparent"}`}
                    >
                      <div className="flex-1 min-w-0">
                        <p className={`font-bold text-sm truncate ${isSelected ? "text-emerald-700" : "text-gray-800"}`}>
                          {lesson.subjectName}
                        </p>
                        <p className={`text-xs font-semibold mt-0.5 ${isSelected ? "text-emerald-600" : "text-gray-400"}`}>
                          {lesson.className} · {formatTime(lesson.startTime)}–{formatTime(lesson.endTime)}
                        </p>
                      </div>
                      <ChevronRight size={14} className={isSelected ? "text-emerald-500" : "text-gray-300"} />
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT: Student roster ── */}
        <div className="xl:col-span-2">
          {!selectedLesson ? (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mb-4">
                <Users size={28} className="text-gray-300" />
              </div>
              <p className="text-gray-500 font-bold text-base">Select a lesson</p>
              <p className="text-gray-400 text-sm mt-1">to start taking attendance</p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">

              {/* Lesson info + bulk actions */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="font-black text-gray-800 text-base">
                      {selectedLesson.subjectName}
                      <span className="text-gray-400 font-semibold ml-2 text-sm">· {selectedLesson.className}</span>
                    </h2>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {students.length} student{students.length !== 1 ? "s" : ""} · Mark all at once or individually
                    </p>
                  </div>

                  {/* Bulk mark buttons */}
                  <div className="flex gap-2 flex-wrap">
                    {(["PRESENT", "ABSENT", "LATE", "EXCUSED"] as const).map((status) => {
                      const cfg = STATUS_CONFIG[status];
                      return (
                        <button
                          key={status}
                          onClick={() => markAll(status)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${cfg.bg} ${cfg.text} hover:opacity-90`}
                        >
                          {cfg.icon}
                          All {cfg.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Live stats bar */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
                  {(["PRESENT", "ABSENT", "LATE", "EXCUSED"] as const).map((status) => {
                    const cfg = STATUS_CONFIG[status];
                    const count = counts[status] ?? 0;
                    const pct   = students.length > 0 ? Math.round((count / students.length) * 100) : 0;
                    return (
                      <div key={status} className={`rounded-xl p-2.5 border ${cfg.light}`}>
                        <p className="text-xl font-black leading-none">{count}</p>
                        <p className="text-[10px] font-bold uppercase tracking-wide opacity-70 mt-0.5">{cfg.label}</p>
                        <p className="text-[10px] font-semibold opacity-50">{pct}%</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Error */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center gap-2.5 p-3.5 bg-rose-50 border border-rose-200 rounded-xl"
                  >
                    <AlertCircle size={15} className="text-rose-500 shrink-0" />
                    <p className="text-xs font-semibold text-rose-700">{error}</p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Student list */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="divide-y divide-gray-50">
                  {students.map((student, idx) => {
                    const record  = attendance[student.id];
                    const status  = record?.status ?? "PRESENT";
                    const cfg     = STATUS_CONFIG[status];
                    const isNoting = noteTarget === student.id;
                    const lateNeedsNote = status === "LATE" && !record?.note?.trim();
                    const lateNeedsArrivalTime = status === "LATE" && !record?.arrivalTime?.trim();

                    return (
                      <motion.div
                        key={student.id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.02 }}
                      >
                        <div className={`flex flex-col gap-3 px-4 py-3 transition-all sm:flex-row sm:items-center
                          ${status === "ABSENT" ? "bg-rose-50/30" : status === "LATE" ? "bg-amber-50/30" : ""}`}
                        >
                          {/* Avatar */}
                          <div className="relative shrink-0">
                            <Image
                              src={student.img || "/noAvatar.png"}
                              alt={student.name}
                              width={36} height={36}
                              className="w-9 h-9 rounded-xl object-cover ring-2 ring-gray-100"
                            />
                            {/* Status dot */}
                            <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${cfg.bg}`} />
                          </div>

                          {/* Name */}
                          <div className="flex-1 min-w-0 self-stretch sm:self-auto">
                            <p className="font-bold text-sm text-gray-800 truncate">
                              {student.name} {student.surname}
                            </p>
                            {record?.note && (
                              <p className="text-[11px] text-gray-400 truncate italic">
                                &quot;{record.note}&quot;
                              </p>
                            )}
                            {lateNeedsNote && (
                              <p className="text-[11px] font-bold text-amber-600">
                                Late note required before saving.
                              </p>
                            )}
                            {lateNeedsArrivalTime && (
                              <p className="text-[11px] font-bold text-amber-600">
                                Arrival time required for late attendance.
                              </p>
                            )}
                          </div>

                          {/* Status buttons */}
                          <div className="flex gap-1.5 shrink-0 self-stretch sm:self-auto justify-between sm:justify-start">
                            {(["PRESENT", "ABSENT", "LATE", "EXCUSED"] as const).map((s) => {
                              const c      = STATUS_CONFIG[s];
                              const active = status === s;
                              return (
                                <button
                                  key={s}
                                  onClick={() => markStudent(student.id, s)}
                                  title={c.label}
                                  className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black transition-all
                                    ${active
                                      ? `${c.bg} ${c.text} ring-2 ${c.ring} shadow-sm`
                                      : "bg-gray-100 text-gray-400 hover:bg-gray-200"}`}
                                >
                                  {c.short}
                                </button>
                              );
                            })}

                            {/* Note button */}
                            <button
                              onClick={() => setNoteTarget(isNoting ? null : student.id)}
                              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all
                                ${isNoting ? "bg-indigo-100 text-indigo-600" : "bg-gray-100 text-gray-400 hover:bg-gray-200"}`}
                              title="Add note"
                            >
                              <span className="text-xs">📝</span>
                            </button>
                          </div>
                        </div>

                        {/* Note input (expandable) */}
                        <AnimatePresence>
                          {(isNoting || lateNeedsNote || lateNeedsArrivalTime) && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="overflow-hidden"
                            >
                              <div className="grid gap-2 px-4 pb-3 pt-1 sm:grid-cols-[140px_1fr]">
                                {status === "LATE" && (
                                  <input
                                    type="time"
                                    value={record?.arrivalTime ?? ""}
                                    onChange={(e) => setArrivalTime(student.id, e.target.value)}
                                    className="w-full px-3 py-2 text-xs rounded-lg border border-amber-200 bg-amber-50 focus:outline-none focus:ring-2 focus:ring-amber-300 text-gray-700"
                                    aria-label={`Arrival time for ${student.name} ${student.surname}`}
                                  />
                                )}
                                <input
                                  type="text"
                                  placeholder={status === "LATE" ? "Reason for lateness" : "Add a note (e.g. sick, left early, parent called)"}
                                  value={record?.note ?? ""}
                                  onChange={(e) => setNote(student.id, e.target.value)}
                                  className="w-full px-3 py-2 text-xs rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-300 text-gray-700"
                                  autoFocus
                                />
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    );
                  })}
                </div>
              </div>

              {/* Submit button */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <p className="text-xs text-gray-400 font-medium">
                  {Object.values(attendance).filter((r) => r.status !== "PRESENT").length} exception{Object.values(attendance).filter((r) => r.status !== "PRESENT").length !== 1 ? "s" : ""} marked
                </p>
                <button
                  onClick={handleSubmit}
                  disabled={saving || students.length === 0}
                  className={`w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all shadow-sm
                    ${saved
                      ? "bg-emerald-500 text-white"
                      : "bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"}`}
                >
                  {saving ? (
                    <><Loader2 size={15} className="animate-spin" /> Saving…</>
                  ) : saved ? (
                    <><CheckCheck size={15} /> Saved!</>
                  ) : (
                    <><Save size={15} /> Save Attendance</>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AttendanceTaker;
