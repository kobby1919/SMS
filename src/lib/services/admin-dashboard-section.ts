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
    if (active < 2) { active++; return true; }
    return new Promise<boolean>((resolve) => {
      const ready = () => { clearTimeout(timer); resolve(true); };
      const timer = setTimeout(() => {
        const index = waiting.indexOf(ready);
        if (index !== -1) waiting.splice(index, 1);
        resolve(false);
      }, 10000);
      waiting.push(ready);
    });
  }
  function release() {
    const next = waiting.shift();
    if (next) next(); else active--;
  }
  return async function read<T>(section: DashboardSectionId, load: () => Promise<T>) {
    if (!await acquire()) {
      console.warn("admin_dashboard_busy", { section });
      return { state: "UNAVAILABLE" as const, reason: "BUSY" as const };
    }
    const started = performance.now();
    try {
      const data = await load();
      const durationMs = Math.round(performance.now() - started);
      if (durationMs >= 5000) console.warn("admin_dashboard_slow", { section, durationMs });
      return { state: "READY" as const, data };
    } catch (error) {
      unstable_rethrow(error);
      if (error instanceof AuthorizationError) throw error;
      const reason = error instanceof DashboardReadLimitError ? "LIMIT" as const : "UNAVAILABLE" as const;
      // Do not log raw database errors, query arguments, recipient details or secrets.
      const code = error && typeof error === "object" && "code" in error && typeof error.code === "string" && /^P\d{4}$/.test(error.code) ? error.code : "UNEXPECTED";
      console.error("admin_dashboard_unavailable", { section, reason, code, durationMs: Math.round(performance.now() - started) });
      return { state: "UNAVAILABLE" as const, reason };
    } finally {
      release();
    }
  };
}

export type DashboardReader = ReturnType<typeof createDashboardReader>;
