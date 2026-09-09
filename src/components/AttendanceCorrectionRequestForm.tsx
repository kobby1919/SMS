"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { AlertCircle, CheckCircle2, Loader2, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { requestAttendanceCorrection } from "@/src/lib/actions/actions";

type AttendanceStatus = "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";

type StudentOption = {
  id: string;
  name: string;
  surname: string;
};

type ExistingAttendanceRecord = {
  id: number;
  studentId: string;
  status: AttendanceStatus;
  note: string | null;
  arrivalTime: string | null;
};

const STATUS_LABELS: Record<AttendanceStatus, string> = {
  PRESENT: "Present",
  ABSENT: "Absent",
  LATE: "Late",
  EXCUSED: "Excused",
};

export default function AttendanceCorrectionRequestForm({
  students,
  existingAttendance,
  pendingAttendanceCorrectionIds,
}: {
  students: StudentOption[];
  existingAttendance: ExistingAttendanceRecord[];
  pendingAttendanceCorrectionIds?: number[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [studentId, setStudentId] = useState(existingAttendance[0]?.studentId ?? "");
  const [newStatus, setNewStatus] = useState<AttendanceStatus>("PRESENT");
  const [newNote, setNewNote] = useState("");
  const [newArrivalTime, setNewArrivalTime] = useState("");
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submittedAttendanceIds, setSubmittedAttendanceIds] = useState<Set<number>>(() => new Set());
  const [isPending, startTransition] = useTransition();

  const unavailableAttendanceIds = useMemo(
    () => new Set([...(pendingAttendanceCorrectionIds ?? []), ...submittedAttendanceIds]),
    [pendingAttendanceCorrectionIds, submittedAttendanceIds],
  );

  const availableAttendance = useMemo(
    () => existingAttendance.filter((record) => !unavailableAttendanceIds.has(record.id)),
    [existingAttendance, unavailableAttendanceIds],
  );

  const recordByStudentId = useMemo(
    () => new Map(availableAttendance.map((record) => [record.studentId, record])),
    [availableAttendance],
  );
  const selectedStudent = students.find((student) => student.id === studentId);
  const selectedRecord = recordByStudentId.get(studentId);

  useEffect(() => {
    if (availableAttendance.length === 0) {
      setStudentId("");
      setNewStatus("PRESENT");
      setNewNote("");
      setNewArrivalTime("");
      return;
    }
    if (!open) return;

    const currentRecord = recordByStudentId.get(studentId);
    const nextRecord = currentRecord ?? availableAttendance[0];
    if (!currentRecord) {
      setStudentId(nextRecord.studentId);
    }
    setNewStatus(nextRecord.status);
    setNewNote(nextRecord.note ?? "");
    setNewArrivalTime(nextRecord.arrivalTime ?? "");
  }, [availableAttendance, open, recordByStudentId, studentId]);

  const submit = () => {
    setMessage(null);
    setError(null);
    if (!selectedRecord) {
      setError("Choose the student whose attendance needs correction.");
      return;
    }

    startTransition(async () => {
      try {
        const result = await requestAttendanceCorrection({
          attendanceId: selectedRecord.id,
          newStatus,
          newNote: newNote.trim() || null,
          newArrivalTime: newStatus === "LATE" ? newArrivalTime : null,
          reason,
        });
        setMessage(result.message);
        setSubmittedAttendanceIds((current) => new Set(current).add(selectedRecord.id));
        setStudentId("");
        setNewStatus("PRESENT");
        setReason("");
        setNewNote("");
        setNewArrivalTime("");
        setOpen(false);
        router.refresh();
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Could not request attendance correction.");
      }
    });
  };

  if (existingAttendance.length === 0 && submittedAttendanceIds.size === 0) return null;

  return (
    <div className="rounded-2xl border border-amber-100 bg-amber-50/60 p-3 sm:p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-black text-amber-900">Need to fix a saved attendance record?</p>
          <p className="mt-1 text-xs font-semibold leading-relaxed text-amber-700">
            Send a correction request. Records already waiting for admin approval are hidden from this form.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            if (!open && !studentId && availableAttendance[0]) {
              setStudentId(availableAttendance[0].studentId);
            }
            setOpen((value) => !value);
          }}
          disabled={availableAttendance.length === 0}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-black text-white transition hover:bg-slate-800 sm:w-auto"
        >
          <RotateCcw size={15} />
          {availableAttendance.length === 0 ? "No request available" : open ? "Close request" : "Request correction"}
        </button>
      </div>

      {message ? (
        <p className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700">
          {message}
        </p>
      ) : null}

      {open && availableAttendance.length > 0 ? (
        <div className="mt-4 rounded-2xl border border-amber-100 bg-white p-3 sm:p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-black uppercase text-slate-400">
              Student affected
              <select
                value={studentId}
                onChange={(event) => setStudentId(event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-bold normal-case text-slate-700 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
              >
                {availableAttendance.map((record) => {
                  const student = students.find((item) => item.id === record.studentId);
                  return (
                    <option key={record.id} value={record.studentId}>
                      {student ? `${student.name} ${student.surname}` : record.studentId}
                    </option>
                  );
                })}
              </select>
            </label>

            <div className="rounded-xl bg-slate-50 px-3 py-2.5">
              <p className="text-xs font-black uppercase text-slate-400">Current saved record</p>
              <p className="mt-1 text-sm font-black text-slate-800">
                {selectedRecord ? STATUS_LABELS[selectedRecord.status] : "-"}
              </p>
              <p className="mt-1 text-xs font-semibold text-slate-500">
                {selectedStudent ? `${selectedStudent.name} ${selectedStudent.surname}` : "No student selected"}
                {selectedRecord?.arrivalTime ? ` · Arrival ${selectedRecord.arrivalTime}` : ""}
              </p>
            </div>

            <label className="text-xs font-black uppercase text-slate-400">
              Correct status
              <select
                value={newStatus}
                onChange={(event) => setNewStatus(event.target.value as AttendanceStatus)}
                className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-bold normal-case text-slate-700 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
              >
                {(["PRESENT", "ABSENT", "LATE", "EXCUSED"] as const).map((status) => (
                  <option key={status} value={status}>{STATUS_LABELS[status]}</option>
                ))}
              </select>
            </label>

            {newStatus === "LATE" ? (
              <label className="text-xs font-black uppercase text-slate-400">
                Arrival time
                <input
                  type="time"
                  value={newArrivalTime}
                  onChange={(event) => setNewArrivalTime(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-bold normal-case text-slate-700 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                />
              </label>
            ) : (
              <label className="text-xs font-black uppercase text-slate-400">
                Optional corrected note
                <input
                  type="text"
                  value={newNote}
                  onChange={(event) => setNewNote(event.target.value)}
                  placeholder="Example: Parent called, excused by office"
                  className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-bold normal-case text-slate-700 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                />
              </label>
            )}
          </div>

          {newStatus === "LATE" ? (
            <label className="mt-3 block text-xs font-black uppercase text-slate-400">
              Optional corrected note
              <input
                type="text"
                value={newNote}
                onChange={(event) => setNewNote(event.target.value)}
                placeholder="Example: Arrived after assembly"
                className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-bold normal-case text-slate-700 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
              />
            </label>
          ) : null}

          <label className="mt-3 block text-xs font-black uppercase text-slate-400">
            Reason for correction
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={3}
              placeholder="Explain why the saved attendance must be changed. This is sent to admin."
              className="mt-2 w-full resize-none rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold normal-case text-slate-700 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
            />
          </label>

          <button
            type="button"
            onClick={submit}
            disabled={isPending}
            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            {isPending ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
            Send request to admin
          </button>

          {error ? (
            <p className="mt-3 flex items-start gap-2 rounded-xl bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              {error}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
