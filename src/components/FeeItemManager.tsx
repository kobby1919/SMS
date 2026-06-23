"use client";

// src/components/finance/FeeItemManager.tsx
// Manages fee items within a fee structure.
// Draft: full add/edit/delete. Published: read-only display.

import { useState, useTransition } from "react";
import {
  Plus, Trash2, Edit, Save, X,
  CheckCircle2, AlertCircle, Loader2, ChevronDown,
} from "lucide-react";
import {
  addFeeItem,
  updateFeeItem,
  deleteFeeItem,
} from "@/src/lib/actions/feeStructureActions";
import { FEE_CATEGORY_LABELS, formatGHS } from "@/src/lib/constants/finance";
import type { FeeCategory } from "@/src/generated/prisma";

type FeeItem = {
  id:          number;
  name:        string;
  amount:      number;
  category:    string;
  isOptional:  boolean;
  description: string;
};

type Props = {
  feeStructureId: number;
  isPublished:    boolean;
  feeItems:       FeeItem[];
};

const CATEGORIES = Object.entries(FEE_CATEGORY_LABELS);

// ─── Inline row form ──────────────────────────────────────────────────────────
type FormState = {
  name:        string;
  amount:      string;
  category:    string;
  isOptional:  boolean;
  description: string;
};

const emptyForm = (): FormState => ({
  name: "", amount: "", category: "TUITION", isOptional: false, description: "",
});

const FeeItemManager = ({ feeStructureId, isPublished, feeItems: initial }: Props) => {
  const [items,     setItems]     = useState<FeeItem[]>(initial);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [adding,    setAdding]    = useState(false);
  const [form,      setForm]      = useState<FormState>(emptyForm());
  const [error,     setError]     = useState<string | null>(null);
  const [toast,     setToast]     = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const resetForm = () => { setForm(emptyForm()); setError(null); };

  const startEdit = (item: FeeItem) => {
    setEditingId(item.id);
    setAdding(false);
    setForm({
      name:        item.name,
      amount:      String(item.amount),
      category:    item.category,
      isOptional:  item.isOptional,
      description: item.description,
    });
    setError(null);
  };

  const cancelEdit = () => { setEditingId(null); setAdding(false); resetForm(); };

  // ── Add ────────────────────────────────────────────────────────────────────
  const handleAdd = () => {
    setError(null);
    if (!form.name.trim())    { setError("Name is required.");                     return; }
    if (!form.amount)         { setError("Amount is required.");                   return; }
    if (isNaN(Number(form.amount)) || Number(form.amount) <= 0) {
      setError("Amount must be a positive number."); return;
    }

    startTransition(async () => {
      try {
        const item = await addFeeItem(feeStructureId, {
          name:        form.name.trim(),
          amount:      Number(form.amount),
          category:    form.category as FeeCategory,
          isOptional:  form.isOptional,
          description: form.description.trim() || undefined,
        });
        setItems((prev) => [...prev, {
          id:          item.id,
          name:        item.name,
          amount:      Number(item.amount),
          category:    item.category,
          isOptional:  item.isOptional,
          description: item.description ?? "",
        }]);
        setAdding(false);
        resetForm();
        showToast("Fee item added ✓");
      } catch (e: unknown) { setError(e instanceof Error ? e.message : "Failed to add item."); }
    });
  };

  // ── Update ─────────────────────────────────────────────────────────────────
  const handleUpdate = (id: number) => {
    setError(null);
    if (!form.name.trim()) { setError("Name is required."); return; }
    if (isNaN(Number(form.amount)) || Number(form.amount) <= 0) {
      setError("Amount must be a positive number."); return;
    }

    startTransition(async () => {
      try {
        await updateFeeItem(id, {
          name:        form.name.trim(),
          amount:      Number(form.amount),
          category:    form.category as FeeCategory,
          isOptional:  form.isOptional,
          description: form.description.trim() || undefined,
        });
        setItems((prev) => prev.map((item) =>
          item.id === id
            ? { ...item, name: form.name.trim(), amount: Number(form.amount), category: form.category, isOptional: form.isOptional, description: form.description }
            : item
        ));
        setEditingId(null);
        resetForm();
        showToast("Fee item updated ✓");
      } catch (e: unknown) { setError(e instanceof Error ? e.message : "Failed to update item."); }
    });
  };

  // ── Delete ─────────────────────────────────────────────────────────────────
  const handleDelete = (id: number) => {
    startTransition(async () => {
      try {
        await deleteFeeItem(id);
        setItems((prev) => prev.filter((item) => item.id !== id));
        showToast("Item removed");
      } catch (e: unknown) { setError(e instanceof Error ? e.message : "Failed to delete item."); }
    });
  };

  // ── Shared form fields ─────────────────────────────────────────────────────
  const FormFields = ({ onSave, onCancel, saveLabel }: { onSave: () => void; onCancel: () => void; saveLabel: string }) => (
    <div className="flex flex-col gap-3 p-4 bg-violet-50/60 border border-violet-100 rounded-2xl">
      {error && (
        <div className="flex items-start gap-2 p-3 bg-rose-50 border border-rose-200 rounded-xl">
          <AlertCircle size={13} className="text-rose-500 shrink-0 mt-0.5" />
          <p className="text-xs font-semibold text-rose-700">{error}</p>
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Name */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-black uppercase tracking-wider text-gray-400">Fee Name *</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g. Tuition Fee"
            className="ring-[1.5px] ring-gray-200 px-3 py-2.5 rounded-xl text-sm font-semibold text-gray-700 focus:ring-violet-500 outline-none bg-white"
          />
        </div>
        {/* Amount */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-black uppercase tracking-wider text-gray-400">Amount (GH₵) *</label>
          <input
            type="number"
            min={0}
            step={0.01}
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
            placeholder="e.g. 800.00"
            className="ring-[1.5px] ring-gray-200 px-3 py-2.5 rounded-xl text-sm font-semibold text-gray-700 focus:ring-violet-500 outline-none bg-white"
          />
        </div>
        {/* Category */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-black uppercase tracking-wider text-gray-400">Category *</label>
          <div className="relative">
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="w-full appearance-none ring-[1.5px] ring-gray-200 px-3 py-2.5 rounded-xl text-sm font-semibold text-gray-700 focus:ring-violet-500 outline-none bg-white pr-8"
            >
              {CATEGORIES.map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
            <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
        </div>
        {/* Description */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-black uppercase tracking-wider text-gray-400">
            Description <span className="font-normal normal-case text-gray-300">(optional)</span>
          </label>
          <input
            type="text"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Brief note about this fee"
            className="ring-[1.5px] ring-gray-200 px-3 py-2.5 rounded-xl text-sm text-gray-700 focus:ring-violet-500 outline-none bg-white"
          />
        </div>
      </div>
      {/* Optional toggle */}
      <label className="flex items-center gap-3 cursor-pointer w-fit">
        <div
          onClick={() => setForm({ ...form, isOptional: !form.isOptional })}
          className={`w-10 h-5 rounded-full transition-colors relative cursor-pointer
            ${form.isOptional ? "bg-amber-400" : "bg-gray-200"}`}
        >
          <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all
            ${form.isOptional ? "left-5" : "left-0.5"}`} />
        </div>
        <div>
          <p className="text-xs font-bold text-gray-700">Optional fee</p>
          <p className="text-[10px] text-gray-400">Not automatically added to all student bills (e.g. bus fee)</p>
        </div>
      </label>

      {/* Buttons */}
      <div className="flex gap-2 justify-end pt-1">
        <button type="button" onClick={onCancel} disabled={isPending}
          className="flex items-center gap-1.5 px-4 py-2 bg-gray-100 text-gray-600 rounded-xl text-xs font-bold hover:bg-gray-200 transition-colors disabled:opacity-50">
          <X size={13} /> Cancel
        </button>
        <button type="button" onClick={onSave} disabled={isPending}
          className="flex items-center gap-1.5 px-4 py-2 bg-violet-600 text-white rounded-xl text-xs font-bold hover:bg-violet-700 transition-colors disabled:opacity-50 shadow-sm">
          {isPending ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
          {isPending ? "Saving…" : saveLabel}
        </button>
      </div>
    </div>
  );

  const mandatoryTotal = items.filter((i) => !i.isOptional).reduce((s, i) => s + i.amount, 0);

  return (
    <div className="flex flex-col gap-4">

      {/* Header */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-black text-gray-800">Fee Items</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {items.length} item{items.length !== 1 ? "s" : ""} · mandatory total:{" "}
              <span className="font-black text-violet-700">{formatGHS(mandatoryTotal)}</span>
            </p>
          </div>
          {!isPublished && (
            <button
              type="button"
              onClick={() => { setAdding(true); setEditingId(null); resetForm(); }}
              className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-xl text-sm font-bold hover:bg-violet-700 transition-colors shadow-sm"
            >
              <Plus size={14} /> Add Fee Item
            </button>
          )}
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className="flex items-center gap-2 p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl">
          <CheckCircle2 size={14} className="text-emerald-500" />
          <p className="text-xs font-semibold text-emerald-700">{toast}</p>
        </div>
      )}

      {/* Add form */}
      {adding && (
        FormFields({ onSave: handleAdd, onCancel: cancelEdit, saveLabel: "Add Item" })
      )}

      {/* Items list */}
      {items.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-12 text-center">
          <p className="text-sm font-bold text-gray-400 mb-2">No fee items yet</p>
          {!isPublished && (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-violet-600 hover:text-violet-700"
            >
              <Plus size={13} /> Add the first fee item
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((item) => (
            <div key={item.id}>
              {editingId === item.id ? (
                FormFields({
                  onSave: () => handleUpdate(item.id),
                  onCancel: cancelEdit,
                  saveLabel: "Save Changes",
                })
              ) : (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-4">
                  {/* Optional badge */}
                  <div className={`w-2 h-10 rounded-full shrink-0 ${item.isOptional ? "bg-amber-300" : "bg-violet-500"}`} />

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-black text-gray-800">{item.name}</p>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-gray-100 text-gray-500">
                        {FEE_CATEGORY_LABELS[item.category] ?? item.category}
                      </span>
                      {item.isOptional && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-amber-50 text-amber-600">
                          Optional
                        </span>
                      )}
                    </div>
                    {item.description && (
                      <p className="text-xs text-gray-400 mt-0.5">{item.description}</p>
                    )}
                  </div>

                  {/* Amount */}
                  <p className="text-base font-black text-gray-800 shrink-0">
                    {formatGHS(item.amount)}
                  </p>

                  {/* Actions (hidden when published) */}
                  {!isPublished && (
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => startEdit(item)}
                        className="w-8 h-8 flex items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors"
                      >
                        <Edit size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(item.id)}
                        disabled={isPending}
                        className="w-8 h-8 flex items-center justify-center rounded-xl bg-rose-50 text-rose-500 hover:bg-rose-100 transition-colors disabled:opacity-50"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Mandatory / optional legend */}
      {items.length > 0 && (
        <div className="flex items-center gap-4 text-[10px] font-bold text-gray-400">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-violet-500 inline-block" />
            Mandatory (auto-added to all bills)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-300 inline-block" />
            Optional (selected per student)
          </span>
        </div>
      )}
    </div>
  );
};

export default FeeItemManager;
