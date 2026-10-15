export class DashboardReadLimitError extends Error {
  constructor() {
    super("Dashboard evaluation limit reached.");
    this.name = "DashboardReadLimitError";
  }
}

// Run counts and subsequent reads in the same repeatable-read transaction.
// Exceeding a budget must never return truncated financial or attendance totals.
export async function assertDashboardReadBudget(checks: readonly (readonly [PromiseLike<number>, number])[]) {
  const counts = await Promise.all(checks.map(([count]) => count));
  counts.forEach((count, index) => {
    if (!Number.isSafeInteger(count) || count < 0 || count > checks[index][1]) throw new DashboardReadLimitError();
  });
}

export function assertDashboardWorkBudget(work: number, limit = 2_000_000) {
  if (!Number.isSafeInteger(work) || work < 0 || work > limit) throw new DashboardReadLimitError();
}
