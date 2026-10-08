import { z } from "zod";

export const evidenceKeys = ["classes", "subjects", "students", "parents", "parentLinks", "teachers", "bursars", "feeStructures", "fees", "discounts"] as const;
export const evidenceSchema = z.object({
  records: z.object(Object.fromEntries(evidenceKeys.map((key) => [key, z.array(z.string().min(1).max(150)).max(4000)])) as Record<typeof evidenceKeys[number], z.ZodArray<z.ZodString>>).strict(),
  finance: z.object({ gross: z.string().regex(/^\d+$/), paid: z.string().regex(/^\d+$/), discounts: z.string().regex(/^\d+$/) }).strict(),
}).strict();
export type MigrationEvidence = z.infer<typeof evidenceSchema>;
export function newMigrationEvidence(): MigrationEvidence {
  return { records: { classes: [], subjects: [], students: [], parents: [], parentLinks: [], teachers: [], bursars: [], feeStructures: [], fees: [], discounts: [] }, finance: { gross: "0", paid: "0", discounts: "0" } };
}
export const approvalSchema = z.object({
  fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  representative: z.string().trim().min(2).max(150),
  reviewNote: z.string().trim().min(10).max(2000),
  checkedSamples: z.literal(true),
  acknowledged: z.literal(true),
}).strict();
export function moneyMinor(value: string): bigint {
  if (!/^\d+(\.\d{1,2})?$/.test(value)) throw new Error("Invalid monetary control value.");
  const [whole, fraction = ""] = value.split(".");
  return BigInt(whole) * BigInt(100) + BigInt(fraction.padEnd(2, "0"));
}
export function moneyDisplay(value: bigint): string {
  const sign = value < BigInt(0) ? "-" : "";
  const absolute = value < BigInt(0) ? -value : value;
  return `${sign}${absolute / BigInt(100)}.${String(absolute % BigInt(100)).padStart(2, "0")}`;
}
