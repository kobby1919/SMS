export type ParentEngagementIssue = { key: string; title: string; detail: string; action: string; href: string; rank: number; sortAt: number };

export function prioritiseParentEngagementIssues(issues: ParentEngagementIssue[]) {
  const unique = new Map(issues.map((row) => [row.key, row]));
  const sorted = [...unique.values()].sort((a, b) => a.rank - b.rank || a.sortAt - b.sortAt || a.key.localeCompare(b.key));
  return { total: sorted.length, rows: sorted.slice(0, 5).map(({ key, title, detail, action, href }) => ({ key, title, detail, action, href })) };
}
