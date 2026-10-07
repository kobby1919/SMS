"use client";

import { useState, useTransition } from "react";
import { Loader2, Plus, XCircle } from "lucide-react";
import {
  assignCollectorToDailyCollectionType,
  unassignCollectorFromDailyCollectionType,
} from "@/src/lib/actions/dailyCollectionSetupActions";

type CollectorOption = {
  id: string;
  name: string;
  surname: string;
  email: string | null;
};

type Props = {
  collectionTypeId: string;
  assignedCollectors: CollectorOption[];
  collectorOptions: CollectorOption[];
};

function fullName(collector: CollectorOption) {
  return `${collector.name} ${collector.surname}`.trim();
}

export default function DailyCollectionCollectorAssignments({
  collectionTypeId,
  assignedCollectors,
  collectorOptions,
}: Props) {
  const [collectorId, setCollectorId] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const assignedIds = new Set(assignedCollectors.map((collector) => collector.id));
  const availableCollectors = collectorOptions.filter((collector) => !assignedIds.has(collector.id));

  function assign() {
    if (!collectorId) {
      setError("Select an active collector first.");
      return;
    }

    setMessage(null);
    setError(null);
    setBusyKey("assign");
    startTransition(async () => {
      try {
        await assignCollectorToDailyCollectionType({ collectorId, collectionTypeId });
        setCollectorId("");
        setMessage("Collector assigned.");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not assign collector.");
      } finally {
        setBusyKey(null);
      }
    });
  }

  function unassign(nextCollectorId: string) {
    setMessage(null);
    setError(null);
    setBusyKey(`unassign:${nextCollectorId}`);
    startTransition(async () => {
      try {
        await unassignCollectorFromDailyCollectionType({ collectorId: nextCollectorId, collectionTypeId });
        setMessage("Collector assignment removed.");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not remove collector assignment.");
      } finally {
        setBusyKey(null);
      }
    });
  }

  return (
    <div className="mt-4 rounded-2xl border border-gray-100 bg-gray-50/70 p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <label className="grid flex-1 gap-1">
          <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">Assign collector</span>
          <select
            value={collectorId}
            onChange={(event) => setCollectorId(event.target.value)}
            disabled={isPending || availableCollectors.length === 0}
            className="h-9 rounded-xl border border-gray-200 bg-white px-3 text-xs font-bold text-gray-700 outline-none focus:border-blue-400 disabled:cursor-not-allowed disabled:bg-gray-100"
          >
            <option value="">
              {availableCollectors.length === 0 ? "No unassigned active collector" : "Select active collector"}
            </option>
            {availableCollectors.map((collector) => (
              <option key={collector.id} value={collector.id}>
                {fullName(collector)}{collector.email ? ` - ${collector.email}` : ""}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={assign}
          disabled={isPending || !collectorId}
          className="inline-flex h-9 items-center justify-center gap-1 rounded-xl bg-blue-700 px-3 text-xs font-black text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busyKey === "assign" ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
          Assign
        </button>
      </div>

      {message && <p className="mt-2 rounded-lg bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700">{message}</p>}
      {error && <p className="mt-2 rounded-lg bg-rose-50 px-2 py-1 text-xs font-bold text-rose-700">{error}</p>}

      <div className="mt-3 flex flex-wrap gap-2">
        {assignedCollectors.length === 0 ? (
          <p className="text-xs font-semibold text-gray-400">No collector assigned yet.</p>
        ) : (
          assignedCollectors.map((collector) => (
            <span key={collector.id} className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-bold text-gray-600 ring-1 ring-gray-100">
              {fullName(collector)}
              <button
                type="button"
                onClick={() => unassign(collector.id)}
                disabled={isPending}
                className="text-rose-500 transition hover:text-rose-700 disabled:opacity-50"
                aria-label={`Remove ${fullName(collector)}`}
              >
                {busyKey === `unassign:${collector.id}` ? <Loader2 size={12} className="animate-spin" /> : <XCircle size={12} />}
              </button>
            </span>
          ))
        )}
      </div>
    </div>
  );
}
