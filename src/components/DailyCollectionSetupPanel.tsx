"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Loader2, Plus, RotateCcw, ShieldCheck, XCircle } from "lucide-react";
import {
  createDailyCollectionType,
  setDailyCollectionTypeActive,
} from "@/src/lib/actions/dailyCollectionSetupActions";
import DailyCollectionCollectorAssignments from "@/src/components/DailyCollectionCollectorAssignments";
import {
  FEE_CATEGORY_LABELS,
  formatGHS,
} from "@/src/lib/constants/finance";
import type { FeeCategory } from "@/src/generated/prisma";

type DailyCollectionTypeRow = {
  id: string;
  name: string;
  category: string;
  amount: number;
  description: string | null;
  isActive: boolean;
  requiresBursarConfirmation: boolean;
  collectors: Array<{
    collector: {
      id: string;
      name: string;
      surname: string;
      email: string | null;
      status: string;
    };
  }>;
};

type CollectorOption = {
  id: string;
  name: string;
  surname: string;
  email: string | null;
};

type Props = {
  collectionTypes: DailyCollectionTypeRow[];
  activeCollectorCount: number;
  collectorOptions: CollectorOption[];
};

const feeCategories = Object.entries(FEE_CATEGORY_LABELS).filter(([key]) =>
  ["FEEDING", "TRANSPORT", "LEVY", "OTHER"].includes(key),
) as Array<[FeeCategory, string]>;

const initialForm = {
  name: "",
  amount: "",
  category: "FEEDING" as FeeCategory,
  description: "",
  requiresBursarConfirmation: true,
};

export default function DailyCollectionSetupPanel({ collectionTypes, activeCollectorCount, collectorOptions }: Props) {
  const [form, setForm] = useState(initialForm);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function resetFeedback() {
    setMessage(null);
    setError(null);
  }

  function handleCreate() {
    resetFeedback();
    startTransition(async () => {
      try {
        await createDailyCollectionType({
          name: form.name,
          amount: Number(form.amount),
          category: form.category,
          description: form.description,
          requiresBursarConfirmation: form.requiresBursarConfirmation,
        });
        setForm(initialForm);
        setMessage("Daily collection setup saved.");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not save daily collection setup.");
      }
    });
  }

  function handleToggle(id: string, isActive: boolean) {
    resetFeedback();
    startTransition(async () => {
      try {
        await setDailyCollectionTypeActive(id, isActive);
        setMessage(isActive ? "Daily collection setup reactivated." : "Daily collection setup deactivated.");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not update daily collection setup.");
      }
    });
  }

  const activeTypes = collectionTypes.filter((item) => item.isActive);
  const inactiveTypes = collectionTypes.filter((item) => !item.isActive);

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-wider text-blue-500">Daily Collection Setup</p>
            <h2 className="mt-1 text-lg font-black text-gray-900">Items collected outside term bills</h2>
            <p className="mt-1 max-w-2xl text-sm font-semibold leading-6 text-gray-500">
              Use this for daily feeding, gate payments, or other cash/mobile-money collections that happen outside generated student bills.
            </p>
          </div>
          <div className="rounded-2xl bg-blue-50 px-4 py-3 text-sm font-black text-blue-700">
            {activeTypes.length} active setup{activeTypes.length === 1 ? "" : "s"}
          </div>
        </div>

        {message && (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700">
            <CheckCircle2 size={14} /> {message}
          </div>
        )}
        {error && (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">
            <XCircle size={14} /> {error}
          </div>
        )}

        <div className="mt-5 grid gap-3">
          {collectionTypes.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-200 p-8 text-center">
              <p className="text-sm font-black text-gray-800">No daily collection setup yet.</p>
              <p className="mt-1 text-sm font-semibold text-gray-400">
                Add feeding or any other daily collection item before opening daily sessions.
              </p>
            </div>
          ) : (
            <>
              {activeTypes.map((item) => (
                <CollectionTypeCard
                  key={item.id}
                  item={item}
                  collectorOptions={collectorOptions}
                  onToggle={() => handleToggle(item.id, false)}
                  busy={isPending}
                />
              ))}
              {inactiveTypes.length > 0 && (
                <div className="pt-2">
                  <p className="mb-2 text-xs font-black uppercase tracking-wider text-gray-400">Inactive setup</p>
                  <div className="grid gap-3">
                    {inactiveTypes.map((item) => (
                      <CollectionTypeCard
                        key={item.id}
                        item={item}
                        collectorOptions={collectorOptions}
                        onToggle={() => handleToggle(item.id, true)}
                        busy={isPending}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </section>

      <aside className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:p-5">
        <div>
          <p className="text-xs font-black uppercase tracking-wider text-gray-400">Add Setup</p>
          <h3 className="mt-1 text-base font-black text-gray-900">New daily item</h3>
        </div>

        <div className="mt-4 grid gap-3">
          <label className="grid gap-1">
            <span className="text-[11px] font-black uppercase tracking-wider text-gray-400">Name</span>
            <input
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              placeholder="Feeding"
              className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-semibold outline-none focus:border-blue-400"
            />
          </label>

          <label className="grid gap-1">
            <span className="text-[11px] font-black uppercase tracking-wider text-gray-400">Amount per student</span>
            <input
              value={form.amount}
              onChange={(event) => setForm({ ...form, amount: event.target.value })}
              type="number"
              min="0"
              step="0.01"
              placeholder="10.00"
              className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-semibold outline-none focus:border-blue-400"
            />
          </label>

          <label className="grid gap-1">
            <span className="text-[11px] font-black uppercase tracking-wider text-gray-400">Category</span>
            <select
              value={form.category}
              onChange={(event) => setForm({ ...form, category: event.target.value as FeeCategory })}
              className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-semibold outline-none focus:border-blue-400"
            >
              {feeCategories.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>

          <label className="grid gap-1">
            <span className="text-[11px] font-black uppercase tracking-wider text-gray-400">Note</span>
            <textarea
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
              rows={3}
              placeholder="Collected at the gate each school day."
              className="resize-none rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-semibold outline-none focus:border-blue-400"
            />
          </label>

          <label className="flex items-start gap-3 rounded-xl border border-gray-100 bg-gray-50 px-3 py-3">
            <input
              type="checkbox"
              checked={form.requiresBursarConfirmation}
              onChange={(event) => setForm({ ...form, requiresBursarConfirmation: event.target.checked })}
              className="mt-1"
            />
            <span>
              <span className="block text-sm font-black text-gray-800">Require bursar confirmation</span>
              <span className="mt-0.5 block text-xs font-semibold leading-5 text-gray-400">
                Collector sessions will need bursar confirmation before they count as final finance records.
              </span>
            </span>
          </label>

          <button
            type="button"
            onClick={handleCreate}
            disabled={isPending}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 text-sm font-black text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
            Save setup
          </button>
        </div>

        <div className="mt-5 rounded-2xl border border-amber-100 bg-amber-50 p-4">
          <div className="flex gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <div>
              <p className="text-sm font-black text-amber-900">Finance safety rule</p>
              <p className="mt-1 text-xs font-semibold leading-5 text-amber-800">
                Daily collection setup does not create bills. Sessions and student entries start in the next step.
              </p>
              <p className="mt-2 text-xs font-bold text-amber-700">
                Active collectors: {activeCollectorCount}
              </p>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}

function CollectionTypeCard({
  item,
  busy,
  onToggle,
  collectorOptions,
}: {
  item: DailyCollectionTypeRow;
  busy: boolean;
  onToggle: () => void;
  collectorOptions: CollectorOption[];
}) {
  const assignedCollectors = item.collectors.filter((entry) => entry.collector.status === "ACTIVE");

  return (
    <article className={`rounded-2xl border p-4 ${item.isActive ? "border-gray-100 bg-white" : "border-gray-100 bg-gray-50 opacity-75"}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-sm font-black text-gray-900">{item.name}</h3>
            <span className={`rounded-lg px-2 py-0.5 text-[10px] font-black uppercase ${
              item.isActive ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"
            }`}>
              {item.isActive ? "Active" : "Inactive"}
            </span>
            <span className="rounded-lg bg-blue-50 px-2 py-0.5 text-[10px] font-black uppercase text-blue-700">
              {FEE_CATEGORY_LABELS[item.category] ?? item.category}
            </span>
          </div>
          <p className="mt-1 text-lg font-black text-gray-900">{formatGHS(item.amount)}</p>
          {item.description && (
            <p className="mt-1 text-sm font-semibold leading-5 text-gray-500">{item.description}</p>
          )}
          <p className="mt-2 text-xs font-semibold text-gray-400">
            {item.requiresBursarConfirmation
              ? "Bursar confirmation required before final posting."
              : "Bursar confirmation is not required for this setup."}
          </p>
          <p className="mt-1 text-xs font-semibold text-gray-400">
            {assignedCollectors.length} assigned collector{assignedCollectors.length === 1 ? "" : "s"}
          </p>
          {item.isActive && (
            <DailyCollectionCollectorAssignments
              collectionTypeId={item.id}
              assignedCollectors={assignedCollectors.map((entry) => entry.collector)}
              collectorOptions={collectorOptions}
            />
          )}
        </div>

        <button
          type="button"
          onClick={onToggle}
          disabled={busy}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-gray-200 px-3 text-xs font-black text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? <Loader2 size={13} className="animate-spin" /> : <RotateCcw size={13} />}
          {item.isActive ? "Deactivate" : "Reactivate"}
        </button>
      </div>
    </article>
  );
}
