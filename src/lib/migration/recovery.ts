import { z } from "zod";

const text = z.string().trim().min(2).max(300).refine((value) => !/https?:\/\/|postgres(?:ql)?:\/\/|\b(?:re_|sk_live_|sk_test_)[A-Za-z0-9]/i.test(value), "Use an internal reference, not a URL, connection string or API key.");
const timestamp = z.iso.datetime({ offset: true });
const evidence = z.object({
  environment: z.literal("PRODUCTION"),
  databaseReference: text,
  backupReference: text,
  backupAt: timestamp,
  restoreDrillReference: text,
  restoreDrillAt: timestamp,
  verifiedBy: text,
  encryptedKeyRecoveryConfirmed: z.literal(true),
  isolatedRestoreConfirmed: z.literal(true),
}).strict();

export const recoveryInputSchema = z.object({
  version: z.number().int().nonnegative(),
  inventoryVersion: z.number().int().positive(),
  status: z.enum(["READY", "HOLD"]),
  decisionOwner: text,
  recoveryPointMinutes: z.number().int().min(1).max(1440),
  recoveryTimeMinutes: z.number().int().min(1).max(10080),
  cutoverNote: z.string().trim().min(20).max(2000),
  holdReason: z.string().trim().max(1000),
  evidence: evidence.nullable(),
  acknowledged: z.literal(true),
}).strict().superRefine((value, ctx) => {
  if (value.status === "HOLD" && value.holdReason.length < 10) ctx.addIssue({ code: "custom", path: ["holdReason"], message: "Explain why migration is on hold." });
});

export type RecoveryPlan = z.infer<typeof recoveryInputSchema>;

export function recoveryBlockers(plan: RecoveryPlan | null, inventoryVersion: number, production: boolean, now = new Date()): string[] {
  if (!plan) return production ? ["Record backup and restore-drill evidence before production migration."] : [];
  // A hold remains effective even after the inventory is revised.
  if (plan.status === "HOLD") return ["Migration is on hold. Review the recovery plan before continuing."];
  if (plan.inventoryVersion !== inventoryVersion) return ["The inventory changed. Review and renew the recovery checkpoint."];
  if (!plan.evidence) return production ? ["Production requires backup and isolated restore-drill evidence."] : [];
  const backupAge = now.getTime() - new Date(plan.evidence.backupAt).getTime();
  const drillAge = now.getTime() - new Date(plan.evidence.restoreDrillAt).getTime();
  const blockers: string[] = [];
  if (!Number.isFinite(backupAge) || backupAge < 0 || backupAge > 24 * 60 * 60 * 1000) blockers.push("Record a completed backup checkpoint from the last 24 hours.");
  if (!Number.isFinite(drillAge) || drillAge < 0 || drillAge > 30 * 24 * 60 * 60 * 1000) blockers.push("Record a successful isolated restore drill from the last 30 days.");
  return blockers;
}
