"use client";

// src/components/SyllabusProgressCard.tsx


import { useState, useTransition } from "react";
import { CheckCircle2, Clock, Loader2, MessageSquare } from "lucide-react";
import { markTopicCovered, unmarkTopicCovered } from "@/src/lib/actions/syllabusActions";

type TeacherClass = { id: number; name: string };

type ExistingProgress = {
  classId:     number;
  notes:       string;
  coveredDate: string;
};

type Props = {
  topicId:          number;
  topicTitle:       string;
  teacherClasses:   TeacherClass[];
  coveredClassIds:  number[];
  existingProgress: ExistingProgress[];
};

const SyllabusProgressCard = ({
  topicId,
  topicTitle,
  teacherClasses,
  coveredClassIds: initialCovered,
  existingProgress,
}: Props) => {
  const [coveredIds, setCoveredIds] = useState<number[]>(initialCovered);
  const [notes,      setNotes]      = useState<Record<number, string>>(
    Object.fromEntries(existingProgress.map((p) => [p.classId, p.notes]))
  );
  const [showNotes,  setShowNotes]  = useState<Record<number, boolean>>({});
  const [error,      setError]      = useState<string | null>(null);
  const [isPending,  startTransition] = useTransition();

  const isCovered = (classId: number) => coveredIds.includes(classId);

  const toggle = (classId: number) => {
    setError(null);
    startTransition(async () => {
      try {
        if (isCovered(classId)) {
          await unmarkTopicCovered(topicId, classId);
          setCoveredIds((prev) => prev.filter((id) => id !== classId));
        } else {
          await markTopicCovered(topicId, classId, notes[classId] ?? "");
          setCoveredIds((prev) => [...prev, classId]);
        }
      } catch (e: any) {
        setError(e?.message ?? "Failed to update progress.");
      }
    });
  };

  const saveNote = (classId: number) => {
    startTransition(async () => {
      try {
        await markTopicCovered(topicId, classId, notes[classId] ?? "");
        setShowNotes((prev) => ({ ...prev, [classId]: false }));
      } catch (e: any) {
        setError(e?.message ?? "Failed to save note.");
      }
    });
  };

  return (
    <div className="border-t border-gray-100 pt-4">
      <p className="text-[10px] font-black uppercase tracking-wider text-gray-400 mb-3">
        Mark as Covered — Your Classes
      </p>

      {error && (
        <p className="text-xs text-rose-500 font-semibold mb-2">{error}</p>
      )}

      <div className="flex flex-col gap-2">
        {teacherClasses.map((cls) => {
          const covered  = isCovered(cls.id);
          const noteOpen = showNotes[cls.id] ?? false;
          const existing = existingProgress.find((p) => p.classId === cls.id);

          return (
            <div key={cls.id} className={`rounded-xl border transition-colors ${covered ? "bg-emerald-50 border-emerald-200" : "bg-gray-50 border-gray-200"}`}>
              <div className="flex items-center gap-3 px-4 py-3">
                {/* Toggle button */}
                <button
                  type="button"
                  onClick={() => toggle(cls.id)}
                  disabled={isPending}
                  className={`flex items-center gap-2 flex-1 text-left transition-colors disabled:opacity-60`}
                >
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors
                    ${covered ? "bg-emerald-500" : "bg-white border-2 border-gray-200"}`}>
                    {isPending
                      ? <Loader2 size={12} className="animate-spin text-gray-400" />
                      : covered
                      ? <CheckCircle2 size={14} className="text-white" />
                      : <Clock size={12} className="text-gray-300" />}
                  </div>
                  <div>
                    <p className={`text-sm font-bold ${covered ? "text-emerald-800" : "text-gray-700"}`}>
                      {cls.name}
                    </p>
                    {covered && existing && (
                      <p className="text-[10px] text-emerald-600 font-semibold">
                        Covered {new Date(existing.coveredDate).toLocaleDateString("en-GH", { day: "numeric", month: "short", year: "numeric" })}
                      </p>
                    )}
                  </div>
                </button>

                {/* Note toggle */}
                <button
                  type="button"
                  onClick={() => setShowNotes((prev) => ({ ...prev, [cls.id]: !noteOpen }))}
                  className={`w-7 h-7 flex items-center justify-center rounded-lg transition-colors
                    ${noteOpen ? "bg-indigo-100 text-indigo-600" : "bg-white border border-gray-200 text-gray-400 hover:bg-gray-100"}`}
                  title="Add note"
                >
                  <MessageSquare size={12} />
                </button>
              </div>

              {/* Note input */}
              {noteOpen && (
                <div className="px-4 pb-3 flex gap-2">
                  <input
                    type="text"
                    value={notes[cls.id] ?? ""}
                    onChange={(e) => setNotes((prev) => ({ ...prev, [cls.id]: e.target.value }))}
                    placeholder="Optional note e.g. 'Completed with extra exercises'"
                    className="flex-1 ring-[1.5px] ring-gray-200 px-3 py-2 rounded-xl text-xs text-gray-700 focus:ring-violet-500 outline-none"
                  />
                  {covered && (
                    <button
                      type="button"
                      onClick={() => saveNote(cls.id)}
                      disabled={isPending}
                      className="px-3 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-colors disabled:opacity-50"
                    >
                      Save
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SyllabusProgressCard;