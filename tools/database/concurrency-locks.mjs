// Row-update waiters can queue behind each other, not just the original holder.
export const blockedSessionCountSql = `WITH RECURSIVE blocked AS (
  SELECT pid FROM pg_stat_activity WHERE $1::int=ANY(pg_blocking_pids(pid))
  UNION SELECT activity.pid FROM pg_stat_activity activity JOIN blocked ON blocked.pid=ANY(pg_blocking_pids(activity.pid))
) SELECT count(DISTINCT pid)::int AS count FROM blocked`;
