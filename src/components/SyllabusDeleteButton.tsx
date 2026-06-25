"use client";

// src/components/SyllabusDeleteButton.tsx


import { useState, useTransition } from "react";
import { Trash2, AlertTriangle, Loader2, X } from "lucide-react";
import { deleteSyllabus } from "@/src/lib/actions/syllabusActions";
import { useRouter } from "next/navigation";

type Props = {
  id:   number;
  name: string; // e.g. "Mathematics — JHS 2"
};

const SyllabusDeleteButton = ({ id, name }: Props) => {
  const router                       = useRouter();
  const [open,      setOpen]         = useState(false);
  const [error,     setError]        = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleDelete = () => {
    setError(null);
    startTransition(async () => {
      try {
        await deleteSyllabus(id);
        setOpen(false);
        router.refresh();
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Failed to delete. Please try again.");
      }
    });
  };

  return (
    <>
      {/* Trigger */}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        className="w-8 h-8 flex items-center justify-center rounded-xl bg-rose-50 text-rose-500 hover:bg-rose-100 transition-colors"
        title="Delete syllabus"
      >
        <Trash2 size={14} />
      </button>

      {/* Confirmation modal */}
      {open && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-8 flex flex-col items-center text-center">

              {/* Close */}
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="absolute top-5 right-5 text-gray-400 hover:text-gray-600 p-1 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X size={18} />
              </button>

              {/* Icon */}
              <div className="w-16 h-16 bg-rose-50 rounded-2xl flex items-center justify-center mb-4">
                <AlertTriangle size={28} className="text-rose-500" />
              </div>

              <h2 className="text-xl font-black text-gray-800 mb-2">Delete Syllabus?</h2>
              <p className="text-sm text-gray-500 leading-relaxed mb-1">
                You are about to permanently delete:
              </p>
              <p className="text-sm font-black text-gray-800 mb-4">&quot;{name}&quot;</p>
              <p className="text-xs text-gray-400 mb-6">
                This will also delete all <strong>topics</strong> and <strong>progress records</strong> associated with this syllabus. This action cannot be undone.
              </p>

              {error && (
                <div className="w-full p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-semibold text-rose-700 text-left mb-4">
                  {error}
                </div>
              )}

              <div className="flex gap-3 w-full">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  disabled={isPending}
                  className="flex-1 py-3 bg-gray-100 text-gray-600 font-bold rounded-xl hover:bg-gray-200 transition-colors disabled:opacity-50 text-sm"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={isPending}
                  className="flex-1 py-3 bg-rose-600 text-white font-bold rounded-xl hover:bg-rose-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2 text-sm shadow-lg shadow-rose-100"
                >
                  {isPending ? (
                    <><Loader2 size={14} className="animate-spin" /> Deleting…</>
                  ) : (
                    <><Trash2 size={14} /> Delete</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default SyllabusDeleteButton;
