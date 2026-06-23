"use client";

// src/components/finance/PublishFeeStructureButton.tsx
// Confirm-then-publish button for a fee structure.
// Once published, the structure is locked — this is clearly communicated.

import { useState, useTransition } from "react";
import { Globe, Loader2, X, Lock } from "lucide-react";
import { publishFeeStructure } from "@/src/lib/actions/feeStructureActions";
import { useRouter } from "next/navigation";

type Props = {
  id:           number;
  hasItems:     boolean;
  hasMandatory: boolean;
};

const PublishFeeStructureButton = ({ id, hasItems, hasMandatory }: Props) => {
  const router = useRouter();
  const [open,      setOpen]      = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const canPublish = hasItems && hasMandatory;

  const handlePublish = () => {
    setError(null);
    startTransition(async () => {
      try {
        await publishFeeStructure(id);
        setOpen(false);
        router.refresh();
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Failed to publish. Please try again.");
      }
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={!canPublish}
        title={!canPublish ? "Add at least one mandatory fee item before publishing" : "Publish this fee structure"}
        className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <Globe size={15} /> Publish Structure
      </button>

      {open && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-8 flex flex-col items-center text-center">

              <button
                type="button"
                onClick={() => setOpen(false)}
                className="absolute top-5 right-5 text-gray-400 hover:text-gray-600 p-1 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X size={18} />
              </button>

              <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center mb-4">
                <Lock size={28} className="text-emerald-600" />
              </div>

              <h2 className="text-xl font-black text-gray-800 mb-2">Publish Fee Structure?</h2>

              <div className="text-left w-full space-y-2 mb-5">
                <p className="text-sm text-gray-500 text-center">Once published, this structure will be:</p>
                <div className="bg-gray-50 rounded-xl p-4 flex flex-col gap-2 text-xs text-gray-600">
                  <p className="flex items-start gap-2">
                    <span className="text-emerald-500 font-black mt-0.5">✓</span>
                    <span><strong>Locked</strong> — fee items cannot be added, edited, or removed</span>
                  </p>
                  <p className="flex items-start gap-2">
                    <span className="text-emerald-500 font-black mt-0.5">✓</span>
                    <span><strong>Ready for billing</strong> — you can generate student bills from it</span>
                  </p>
                  <p className="flex items-start gap-2">
                    <span className="text-amber-500 font-black mt-0.5">!</span>
                    <span>If you need to change a fee item after publishing, you will need to create a new fee structure</span>
                  </p>
                </div>
              </div>

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
                  onClick={handlePublish}
                  disabled={isPending}
                  className="flex-1 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2 text-sm shadow-lg shadow-emerald-100"
                >
                  {isPending
                    ? <><Loader2 size={14} className="animate-spin" /> Publishing…</>
                    : <><Globe size={14} /> Publish</>
                  }
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default PublishFeeStructureButton;
