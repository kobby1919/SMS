import { z } from "zod";

export const inventoryDatasets = [
  ["classes", "Classes", true], ["subjects", "Subjects", true],
  ["students", "Students", true], ["parents", "Parents and guardians", true],
  ["teachers", "Teachers", true], ["bursars", "Bursars", true],
  ["feeStructures", "Fee structures", true], ["fees", "Opening bills", true],
  ["discounts", "Discounts", true], ["paymentHistory", "Historical payments and receipts", false],
  ["academicHistory", "Historical attendance, assessments and reports", false],
  ["documents", "Documents and daily collection history", false],
] as const;

const money = z.string().regex(/^\d{1,8}(\.\d{1,2})?$/, "Enter a non-negative amount with at most two decimals.");
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((s) => {
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}, "Invalid calendar date.");
const cents = (s: string) => { const [whole, fraction = ""] = s.split("."); return Number(whole) * 100 + Number(fraction.padEnd(2, "0")); };

export const inventorySchema = z.object({
  version: z.number().int().nonnegative(),
  status: z.enum(["DRAFT", "CONFIRMED"]),
  source: z.string().trim().min(1).max(200),
  representative: z.string().trim().min(1).max(150),
  acknowledged: z.boolean(),
  rows: z.array(z.object({
    key: z.string().max(40), disposition: z.enum(["INCLUDE", "DEFER", "EXCLUDE"]),
    expectedRecords: z.number().int().min(0).max(10000000),
    files: z.string().trim().max(1000), reason: z.string().trim().max(1000),
    from: z.union([date, z.literal("")]), to: z.union([date, z.literal("")]),
  })).length(inventoryDatasets.length),
  finance: z.object({ gross: money, discounts: money, paid: money, outstanding: money }).nullable(),
}).strict().superRefine((value, ctx) => {
  const keys = new Set(value.rows.map((r) => r.key));
  if (keys.size !== inventoryDatasets.length || inventoryDatasets.some(([key]) => !keys.has(key))) ctx.addIssue({ code: "custom", message: "List each dataset exactly once." });
  for (const row of value.rows) {
    if (row.from && row.to && row.from > row.to) ctx.addIssue({ code: "custom", message: "Date range ends before it starts." });
    if (row.disposition === "INCLUDE" && !inventoryDatasets.find(([key]) => key === row.key)?.[2]) ctx.addIssue({ code: "custom", message: "Historical datasets need a separate migration process. Defer or exclude them explicitly." });
    if (value.status === "CONFIRMED" && (row.disposition === "INCLUDE" ? !row.files || row.expectedRecords === 0 : !row.reason)) ctx.addIssue({ code: "custom", message: "Included datasets need source filenames and expected counts; deferred/excluded datasets need a reason." });
  }
  if (value.finance && cents(value.finance.gross) - cents(value.finance.discounts) - cents(value.finance.paid) !== cents(value.finance.outstanding)) ctx.addIssue({ code: "custom", message: "Gross charges minus discounts and opening paid must equal outstanding." });
  if (value.status === "CONFIRMED") {
    if (!value.acknowledged || !value.rows.some((r) => r.disposition === "INCLUDE")) ctx.addIssue({ code: "custom", message: "Confirm the scope and include at least one dataset." });
    if (value.rows.some((r) => r.key === "fees" && r.disposition === "INCLUDE") && !value.finance) ctx.addIssue({ code: "custom", message: "Opening bill imports require declared financial control totals." });
  }
});
export type MigrationInventory = z.infer<typeof inventorySchema>;
