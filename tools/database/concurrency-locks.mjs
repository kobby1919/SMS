// Row-update waiters can queue behind each other, not just the original holder.
export const blockedSessionCountSql = `WITH RECURSIVE blocked AS (
  SELECT pid FROM pg_stat_activity WHERE $1::int=ANY(pg_blocking_pids(pid))
  UNION SELECT activity.pid FROM pg_stat_activity activity JOIN blocked ON blocked.pid=ANY(pg_blocking_pids(activity.pid))
) SELECT count(DISTINCT pid)::int AS count FROM blocked`;

export function postgresErrorCode(error) {
  function visit(value, depth) {
    if (!value || typeof value !== "object" || depth > 5) return undefined;
    for (const key of ["originalCode", "code"]) if (/^[A-Z0-9]{5}$/.test(value[key] ?? "")) return value[key];
    for (const nested of Object.values(value)) {
      const found = visit(nested, depth + 1);
      if (found) return found;
    }
    return undefined;
  }
  return visit(error?.meta, 0);
}
