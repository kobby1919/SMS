"use server";

// src/lib/actions/financeActions.ts
// ─────────────────────────────────────────────────────────────────────────────
// Finance foundation — the building blocks every other finance action depends on.
//
//  1. requireFinanceAccess()  — auth guard: admin or bursar only
//  2. generateReceiptNumber() — atomic RCP-YYYY-NNN generator
//  3. writeAuditLog()         — immutable finance audit trail writer
//  4. recomputeBillStatus()   — keeps bill.balance and bill.status in sync
//
// These are INTERNAL helpers. They are called by other finance server actions
// (fee structures, bill generation, payments, etc.) — not directly by the UI.
// ─────────────────────────────────────────────────────────────────────────────

import prisma from "@/src/lib/prisma";
import { requireFinanceAccess } from "@/src/lib/authz";

export { requireFinanceAccess };
import { Prisma } from "@/src/generated/prisma";                 // ← fix 1: Prisma namespace (gives us Decimal + InputJsonValue)
import type { AuditAction } from "@/src/generated/prisma";

// ─── Types ────────────────────────────────────────────────────────────────────

// ─── 1. Receipt number generator ─────────────────────────────────────────────
// Atomically increments the ReceiptCounter for the current calendar year
// and returns the next receipt number in format: RCP-YYYY-NNN (zero-padded to 3).
//
// Uses a Prisma $transaction with updateMany + findUnique to guarantee
// no two concurrent payments get the same number.
//
// Examples:
//   First payment of 2026  → RCP-2026-001
//   48th payment of 2026   → RCP-2026-048
//   First payment of 2027  → RCP-2027-001  (counter reset automatically)

export async function generateReceiptNumber(): Promise<string> {
  const { schoolId } = await requireFinanceAccess();
  const year = new Date().getFullYear();

  // Upsert the counter row for this year, then increment atomically
  const counter = await prisma.$transaction(async (tx) => {
    // Ensure the row exists for this year
    await tx.receiptCounter.upsert({
      where:  { schoolId_year: { schoolId, year } },
      create: { schoolId, year, lastCounter: 0 },
      update: {},                        // don't change it yet — increment below
    });

    // Increment and return the new value
    return tx.receiptCounter.update({
      where: { schoolId_year: { schoolId, year } },
      data:  { lastCounter: { increment: 1 } },
    });
  });

  // Zero-pad to at least 3 digits: 1 → "001", 48 → "048", 1000 → "1000"
  const padded = String(counter.lastCounter).padStart(3, "0");
  return `RCP-${year}-${padded}`;
}

// ─── 3. Audit log writer ──────────────────────────────────────────────────────
// Writes one immutable row to FinanceAuditLog.
// Called by every finance server action — never by the UI directly.
//
// entityType: "Payment" | "StudentBill" | "Discount" | "FeeStructure" | etc.
// entityId:   the primary key of the affected record (as string)
// metadata:   a plain object snapshot of the record at time of action —
//             keep it lean (no nested relations), just the key fields.

export async function writeAuditLog({
  schoolId,
  action,
  performedBy,
  entityType,
  entityId,
  metadata,
  ipAddress,
}: {
  schoolId:      string;
  action:      AuditAction;
  performedBy: string;
  entityType:  string;
  entityId:    string | number;
  metadata:    Record<string, unknown>;
  ipAddress?:  string;
}): Promise<void> {
  await prisma.financeAuditLog.create({
    data: {
      schoolId,
      action,
      performedBy,
      entityType,
      entityId:  String(entityId),
      metadata:  metadata as Prisma.InputJsonValue,  // ← fix 2: cast to Prisma's JSON input type
      ipAddress: ipAddress ?? null,
    },
  });
}

// ─── 4. Bill balance + status recomputer ─────────────────────────────────────
// Called after every payment, reversal, or discount change.
// Reads the bill's current amountPaid and discountAmount from the DB,
// recomputes the balance, and sets the correct BillStatus.
//
// Status rules:
//   balance <= 0 and total > 0  → PAID   (or OVERPAID if negative)
//   amountPaid > 0              → PARTIAL
//   otherwise                  → UNPAID
//   WAIVED is set explicitly — this function never sets WAIVED.

export async function recomputeBillStatus(billId: number, schoolId: string): Promise<void> {
  const bill = await prisma.studentBill.findFirst({
    where:  { id: billId, schoolId },
    select: {
      totalAmount:    true,
      amountPaid:     true,
      discountAmount: true,
      status:         true,
    },
  });

  if (!bill) throw new Error(`Bill #${billId} not found.`);

  // Skip WAIVED bills — they stay WAIVED regardless of payments
  if (bill.status === "WAIVED") return;

  const total    = new Prisma.Decimal(bill.totalAmount);
  const paid     = new Prisma.Decimal(bill.amountPaid);
  const discount = new Prisma.Decimal(bill.discountAmount);
  const balance  = total.sub(paid).sub(discount);

  let status: "UNPAID" | "PARTIAL" | "PAID" | "OVERPAID";

  if (balance.lessThan(0)) {
    status = "OVERPAID";
  } else if (balance.equals(0)) {
    status = "PAID";
  } else if (paid.greaterThan(0)) {
    status = "PARTIAL";
  } else {
    status = "UNPAID";
  }

  await prisma.studentBill.update({
    where: { id: billId },
    data:  {
      balance: balance.toDecimalPlaces(2),
      status,
    },
  });
}
