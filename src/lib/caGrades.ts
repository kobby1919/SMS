// src/lib/caGrades.ts
// Shared grade utilities for the CA feature (safe to import in both server and client)

export type GradeBand = {
  grade:      string;  // A1, B2, … F9
  gradePoint: number;  // 1–9
  label:      string;  // Excellent, Very Good, …
  color:      string;  // Tailwind text color
  bg:         string;  // Tailwind bg color
  border:     string;  // Tailwind border color
  bar:        string;  // Tailwind progress bar color
};

const BANDS: GradeBand[] = [
  { grade: "A1", gradePoint: 1, label: "Excellent",  color: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200", bar: "bg-emerald-500" },
  { grade: "B2", gradePoint: 2, label: "Very Good",  color: "text-teal-700",    bg: "bg-teal-50",    border: "border-teal-200",    bar: "bg-teal-500"    },
  { grade: "B3", gradePoint: 3, label: "Good",       color: "text-blue-700",    bg: "bg-blue-50",    border: "border-blue-200",    bar: "bg-blue-500"    },
  { grade: "C4", gradePoint: 4, label: "Credit",     color: "text-sky-700",     bg: "bg-sky-50",     border: "border-sky-200",     bar: "bg-sky-500"     },
  { grade: "C5", gradePoint: 5, label: "Credit",     color: "text-amber-700",   bg: "bg-amber-50",   border: "border-amber-200",   bar: "bg-amber-500"   },
  { grade: "C6", gradePoint: 6, label: "Credit",     color: "text-yellow-700",  bg: "bg-yellow-50",  border: "border-yellow-200",  bar: "bg-yellow-500"  },
  { grade: "D7", gradePoint: 7, label: "Pass",       color: "text-orange-700",  bg: "bg-orange-50",  border: "border-orange-200",  bar: "bg-orange-500"  },
  { grade: "E8", gradePoint: 8, label: "Pass",       color: "text-red-700",     bg: "bg-red-50",     border: "border-red-200",     bar: "bg-red-500"     },
  { grade: "F9", gradePoint: 9, label: "Fail",       color: "text-rose-700",    bg: "bg-rose-50",    border: "border-rose-200",    bar: "bg-rose-500"    },
];

export function getGradeBand(score: number): GradeBand {
  if (score >= 90) return BANDS[0];
  if (score >= 80) return BANDS[1];
  if (score >= 75) return BANDS[2];
  if (score >= 70) return BANDS[3];
  if (score >= 65) return BANDS[4];
  if (score >= 60) return BANDS[5];
  if (score >= 55) return BANDS[6];
  if (score >= 50) return BANDS[7];
  return BANDS[8];
}

export function getGradeBandByGrade(grade: string): GradeBand {
  return BANDS.find((b) => b.grade === grade) ?? BANDS[8];
}

/** Ghana BECE aggregate = sum of best 6 gradePoints (lower = better) */
export function computeAggregate(gradePoints: number[]): number {
  const sorted = [...gradePoints].sort((a, b) => a - b);
  return sorted.slice(0, 6).reduce((acc, gp) => acc + gp, 0);
}

/** Ordinal position string: 1 → "1st", 2 → "2nd" etc. */
export function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export const TERM_LABELS: Record<string, string> = {
  TERM_1: "Term 1",
  TERM_2: "Term 2",
  TERM_3: "Term 3",
};

export const ALL_GRADES = BANDS;