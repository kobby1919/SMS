"use client";

import { useState, useTransition } from "react";
import { BadgePercent, Loader2, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { applyBillDiscount, removeBillDiscount } from "@/src/lib/actions/billActions";
import { DISCOUNT_TYPE_LABELS, formatGHS } from "@/src/lib/constants/finance";

const DISCOUNT_TYPES = ["SCHOLARSHIP", "SIBLING", "STAFF_CHILD", "BURSARY", "OTHER"] as const;

type DiscountRow = {
  id: number;
  type: string;
  status: string;
  description: string;
  amount: unknown;
  percentage: unknown;
  approvedBy: string;
  createdAt: Date;
};

type Props = {
  billId: number;
  currentBalance: number;
  discounts: DiscountRow[];
};

export default function BillDiscountPanel({ billId, currentBalance, discounts }: Props) {
  const router = useRouter();
  const [type, setType] = useState<(typeof DISCOUNT_TYPES)[number]>("SIBLING");
  const [mode, setMode] = useState<"amount" | "percentage">("amount");
  const [amount, setAmount] = useState("");
  const [percentage, setPercentage] = useState("");
  const [description, setDescription] = useState("");
  const [removeReasonById, setRemoveReasonById] = useState<Record<number, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const activeDiscounts = discounts.filter((discount) => discount.status === "ACTIVE");

  const handleApply = () => {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      try {
        const result = await applyBillDiscount({
          billId,
          type,
          description,
          amount: mode === "amount" ? amount : null,
          percentage: mode === "percentage" ? percentage : null,
        });
        setAmount("");
        setPercentage("");
        setDescription("");
        setMessage(`Discount applied: ${formatGHS(result.amount)}.`);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to apply discount.");
      }
    });
  };

  const handleRemove = (discountId: number) => {
    const reason = removeReasonById[discountId]?.trim();
    if (!reason) {
      setError("Enter a reason before removing a discount.");
      return;
    }

    setMessage(null);
    setError(null);
    startTransition(async () => {
      try {
        await removeBillDiscount({ discountId, reason });
        setRemoveReasonById((current) => ({ ...current, [discountId]: "" }));
        setMessage("Discount removed and bill balance recomputed.");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to remove discount.");
      }
    });
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-wider text-gray-400">Discounts</p>
          <p className="mt-1 text-xs font-semibold text-gray-400">Current balance: {formatGHS(currentBalance)}</p>
        </div>
        <BadgePercent size={18} className="text-emerald-600" />
      </div>

      <div className="p-5 space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">Type</span>
            <select value={type} onChange={(event) => setType(event.target.value as typeof type)} className="rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold outline-none focus:border-emerald-300">
              {DISCOUNT_TYPES.map((option) => (
                <option key={option} value={option}>{DISCOUNT_TYPE_LABELS[option]}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">Mode</span>
            <select value={mode} onChange={(event) => setMode(event.target.value as "amount" | "percentage")} className="rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold outline-none focus:border-emerald-300">
              <option value="amount">Fixed amount</option>
              <option value="percentage">Percentage</option>
            </select>
          </label>
        </div>

        <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
          <label className="flex flex-col gap-1.5">
            <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">
              {mode === "amount" ? "Amount" : "Percentage"}
            </span>
            <input
              type="number"
              min="0"
              step={mode === "amount" ? "0.01" : "0.1"}
              value={mode === "amount" ? amount : percentage}
              onChange={(event) => mode === "amount" ? setAmount(event.target.value) : setPercentage(event.target.value)}
              className="rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold outline-none focus:border-emerald-300"
              placeholder={mode === "amount" ? "100.00" : "10"}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">Reason</span>
            <input
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold outline-none focus:border-emerald-300"
              placeholder="e.g. Sibling discount approved by headmaster"
            />
          </label>
        </div>

        <button
          type="button"
          onClick={handleApply}
          disabled={isPending}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-black text-white transition hover:bg-emerald-700 disabled:opacity-60 sm:w-auto"
        >
          {isPending ? <Loader2 size={15} className="animate-spin" /> : <BadgePercent size={15} />}
          Apply Discount
        </button>

        {(message || error) && (
          <p className={`text-xs font-bold ${error ? "text-rose-600" : "text-emerald-700"}`}>
            {error ?? message}
          </p>
        )}

        {activeDiscounts.length > 0 && (
          <div className="space-y-3 border-t border-gray-100 pt-4">
            {activeDiscounts.map((discount) => (
              <div key={discount.id} className="rounded-xl bg-gray-50 p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-black text-gray-900">{DISCOUNT_TYPE_LABELS[discount.type] ?? discount.type}</p>
                    <p className="mt-0.5 text-xs font-semibold text-gray-500">{discount.description}</p>
                    <p className="mt-1 text-xs font-black text-emerald-700">
                      {discount.amount ? formatGHS(String(discount.amount)) : `${Number(discount.percentage)}%`}
                    </p>
                  </div>
                  <span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-black uppercase text-emerald-700">Active</span>
                </div>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <input
                    value={removeReasonById[discount.id] ?? ""}
                    onChange={(event) => setRemoveReasonById((current) => ({ ...current, [discount.id]: event.target.value }))}
                    className="min-w-0 flex-1 rounded-xl border border-gray-200 px-3 py-2 text-xs font-semibold outline-none focus:border-rose-300"
                    placeholder="Reason for removing this discount"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemove(discount.id)}
                    disabled={isPending}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-rose-50 px-3 py-2 text-xs font-black text-rose-700 transition hover:bg-rose-100 disabled:opacity-60"
                  >
                    <XCircle size={14} />
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
