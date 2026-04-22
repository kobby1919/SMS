"use client";

// src/components/FormModal.tsx

import { X, AlertTriangle, Trash2, Edit, Plus, Loader2 } from "lucide-react";
import { useState, useTransition } from "react";
import dynamic from "next/dynamic";
import { deleteLesson } from "@/src/lib/actions/lesson.actions";

// ─── Dynamically imported forms ───────────────────────────────────────────────
const TeacherForm = dynamic(() => import("./TeacherForm"), {
  loading: () => (
    <div className="py-10 text-center text-gray-400 animate-pulse font-medium">
      Loading form…
    </div>
  ),
});

const StudentForm = dynamic(() => import("./StudentForm"), {
  loading: () => (
    <div className="py-10 text-center text-gray-400 animate-pulse font-medium">
      Loading form…
    </div>
  ),
});

const LessonForm = dynamic(() => import("./LessonForm"), {
  loading: () => (
    <div className="py-10 text-center text-gray-400 animate-pulse font-medium">
      Loading form…
    </div>
  ),
});

// ─── Form registry ────────────────────────────────────────────────────────────
const forms: Record<
  string,
  (type: "create" | "update", data: any, onSuccess: () => void) => React.ReactNode
> = {
  teacher: (type, data, onSuccess) => <TeacherForm type={type} data={data} />,
  student: (type, data, onSuccess) => <StudentForm type={type} data={data} />,
  lesson:  (type, data, onSuccess) => (
    <LessonForm type={type} data={data} onSuccess={onSuccess} />
  ),
};

// ─── Delete action registry ───────────────────────────────────────────────────
// Add more tables here as you build their delete actions
const deleteActions: Partial<Record<string, (id: number) => Promise<void>>> = {
  lesson: deleteLesson,
};

// ─── Types ────────────────────────────────────────────────────────────────────
type TableName =
  | "teacher" | "student" | "parent"  | "subject"
  | "class"   | "lesson"  | "exam"    | "assignment"
  | "result"  | "attendance" | "event" | "announcement";

type Props = {
  table: TableName;
  type:  "create" | "update" | "delete";
  data?: any;
  id?:   number | string;
};

// ─── Component ────────────────────────────────────────────────────────────────
const FormModal = ({ table, type, data, id }: Props) => {
  const [open, setOpen]         = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isPending, startTransition]  = useTransition();

  const close = () => {
    setOpen(false);
    setDeleteError(null);
  };

  // ── Button styles ────────────────────────────────────────────────────────
  const buttonStyles = {
    create: "bg-indigo-600 text-white hover:bg-indigo-700 px-4 py-2 rounded-xl flex items-center gap-2 shadow-sm shadow-indigo-100 transition-all active:scale-95",
    update: "w-8 h-8 flex items-center justify-center rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors active:scale-90",
    delete: "w-8 h-8 flex items-center justify-center rounded-full bg-rose-50 text-rose-600 hover:bg-rose-100 transition-colors active:scale-90",
  };

  // ── Handle delete ────────────────────────────────────────────────────────
  const handleDelete = () => {
    if (!id) return;
    const action = deleteActions[table];
    if (!action) {
      setDeleteError(`Delete not yet implemented for ${table}.`);
      return;
    }
    setDeleteError(null);
    startTransition(async () => {
      try {
        await action(Number(id));
        close();
      } catch (e: any) {
        setDeleteError(e?.message ?? "Failed to delete. Please try again.");
      }
    });
  };

  // ── Inner form ───────────────────────────────────────────────────────────
  const Form = () => {
    // Delete confirmation
    if (type === "delete" && id) {
      return (
        <div className="flex flex-col items-center text-center py-4">
          <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center mb-4">
            <AlertTriangle className="text-rose-600" size={32} />
          </div>
          <h2 className="text-xl font-bold text-gray-800">Confirm Deletion</h2>
          <p className="text-gray-500 mt-2 max-w-[300px]">
            Are you sure you want to delete this{" "}
            <span className="font-semibold text-gray-700">{table}</span>?
            <br />
            <span className="text-xs text-gray-400 mt-1 block">
              This action cannot be undone.
            </span>
          </p>

          {deleteError && (
            <div className="mt-4 w-full p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-semibold text-rose-700 text-left">
              {deleteError}
            </div>
          )}

          <div className="flex items-center gap-3 mt-8 w-full">
            <button
              type="button"
              onClick={close}
              disabled={isPending}
              className="flex-1 py-2.5 bg-gray-100 text-gray-600 font-semibold rounded-xl hover:bg-gray-200 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={isPending}
              className="flex-1 py-2.5 bg-rose-600 text-white font-semibold rounded-xl shadow-lg shadow-rose-100 hover:bg-rose-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {isPending && <Loader2 size={14} className="animate-spin" />}
              {isPending ? "Deleting…" : "Delete"}
            </button>
          </div>
        </div>
      );
    }

    // Create / Update
    if (type === "create" || type === "update") {
      const FormComponent = forms[table];
      if (FormComponent) {
        return <>{FormComponent(type, data, close)}</>;
      }
      return (
        <div className="py-10 text-center text-gray-400 italic font-medium">
          {type.charAt(0).toUpperCase() + type.slice(1)} form for{" "}
          <span className="font-bold text-gray-500">{table}</span> coming soon…
        </div>
      );
    }

    return null;
  };

  // ── Modal width ───────────────────────────────────────────────────────────
  const modalWidth =
    type === "delete"
      ? "max-w-md"
      : table === "lesson"
      ? "max-w-[95%] md:max-w-[680px]"
      : "max-w-[90%] md:max-w-[70%] lg:max-w-[60%] xl:max-w-[50%]";

  return (
    <>
      {/* Trigger button */}
      <button
        className={buttonStyles[type]}
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
      >
        {type === "create" && (
          <>
            <Plus size={18} strokeWidth={3} />
            <span className="hidden sm:inline font-bold text-sm tracking-tight uppercase">
              Add {table}
            </span>
          </>
        )}
        {type === "update" && <Edit   size={16} />}
        {type === "delete" && <Trash2 size={16} />}
      </button>

      {/* Modal overlay */}
      {open && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div
            className={`bg-white rounded-3xl relative w-full ${modalWidth} shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300`}
          >
            {/* Close button */}
            <button
              className="absolute top-5 right-5 text-gray-400 hover:text-gray-600 p-1 hover:bg-gray-100 rounded-lg z-10 transition-colors"
              onClick={close}
            >
              <X size={20} />
            </button>

            <div className="p-8 max-h-[90vh] overflow-y-auto">
              <Form />
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default FormModal;
