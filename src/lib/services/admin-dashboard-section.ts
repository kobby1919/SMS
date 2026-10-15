import "server-only";
import { unstable_rethrow } from "next/navigation";
import { AuthorizationError } from "@/src/lib/authz";
import { DashboardReadLimitError } from "@/src/lib/dashboard-read-budget";

export type DashboardSectionId = "pulse" | "finance" | "accountability" | "academics" | "parents";

// Construct once per authenticated page request. Never shared between schools.
export function createDashboardReader() {
  let active = 0;
  const waiting: (() => void)[] = [];
  async function acquire() {
    if (active < 2) { active++; return; }
    // Waiting for another section is not a failed database read. Each service
    // keeps its own transaction timeout once it actually acquires a slot.
    await new Promise<void>((resolve) => waiting.push(resolve));
  }
  function release() {
    const next = waiting.shift();
    if (next) next(); else active--;
  }
  return async function read<T>(section: DashboardSectionId, load: () => Promise<T>) {
    const queued = performance.now();
    await acquire();
    const started = performance.now();
    const queueMs = Math.round(started - queued);
    try {
      const data = await load();
      const durationMs = Math.round(performance.now() - started);
      if (durationMs >= 5000 || queueMs >= 5000) console.warn("admin_dashboard_slow", JSON.stringify({ section, durationMs, queueMs }));
      return { state: "READY" as const, data };
    } catch (error) {
      unstable_rethrow(error);
      if (error instanceof AuthorizationError) throw error;
      const reason = error instanceof DashboardReadLimitError ? "LIMIT" as const : "UNAVAILABLE" as const;
      // Do not log raw database errors, query arguments, recipient details or secrets.
      const code = error && typeof error === "object" && "code" in error && typeof error.code === "string" && /^P\d{4}$/.test(error.code) ? error.code : "UNEXPECTED";
      console.error("admin_dashboard_unavailable", JSON.stringify({ section, reason, code, durationMs: Math.round(performance.now() - started), queueMs }));
      return { state: "UNAVAILABLE" as const, reason };
    } finally {
      release();
    }
  };
}

export type DashboardReader = ReturnType<typeof createDashboardReader>;
