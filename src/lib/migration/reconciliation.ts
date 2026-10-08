import { z } from "zod";

export const evidenceKeys = ["classes", "subjects", "students", "parents", "parentLinks", "teachers", "bursars", "feeStructures", "fees", "discounts"] as const;
const minorAmount = z.string().max(24).regex(/^\d+$/);
const recordId = z.string().min(1).max(150);
const numericId = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
export const evidenceSchema = z.object({
  records: z.object(Object.fromEntries(evidenceKeys.map((key) => [key, z.array(z.string().min(1).max(150)).max(4000)])) as Record<typeof evidenceKeys[number], z.ZodArray<z.ZodString>>).strict(),
  finance: z.object({ gross: minorAmount, paid: minorAmount, discounts: minorAmount }).strict(),
  controls: z.object({
    feeLines: z.array(z.object({ id: recordId, billId: numericId, studentId: recordId, feeItemId: numericId, amount: minorAmount, paid: minorAmount }).strict()).max(4000),
    discounts: z.array(z.object({ id: recordId, billId: numericId, studentId: recordId, amount: minorAmount }).strict()).max(4000),
    guardianLinks: z.array(z.object({ id: recordId, parentId: recordId, studentId: recordId, role: z.string().min(1).max(40) }).strict()).max(4000),
    studentPlacements: z.array(z.object({ id: recordId, classId: numericId, gradeId: numericId, parentId: recordId }).strict()).max(4000),
  }).strict().optional(),
}).strict();
export type MigrationEvidence = z.infer<typeof evidenceSchema>;
export function newMigrationEvidence(): MigrationEvidence {
  return { records: { classes: [], subjects: [], students: [], parents: [], parentLinks: [], teachers: [], bursars: [], feeStructures: [], fees: [], discounts: [] }, finance: { gross: "0", paid: "0", discounts: "0" }, controls: { feeLines: [], discounts: [], guardianLinks: [], studentPlacements: [] } };
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
