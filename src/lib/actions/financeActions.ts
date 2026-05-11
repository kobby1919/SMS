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
import { auth } from "@clerk/nextjs/server";
import { Prisma } from "@/src/generated/prisma";                 // ← fix 1: Prisma namespace (gives us Decimal + InputJsonValue)
import type { AuditAction } from "@/src/generated/prisma";

// ─── Types ────────────────────────────────────────────────────────────────────

export type FinanceRole = "admin" | "bursar";

export type AuthContext = {
  userId: string;
  role:   FinanceRole;
};

// ─── 1. Auth guard ────────────────────────────────────────────────────────────
// Call at the top of every finance server action.
// Throws if the caller is not admin or bursar.
// Returns { userId, role } so callers can record who performed the action.

export async function requireFinanceAccess(): Promise<AuthContext> {
  const { userId, sessionClaims } = await auth();
  const role = (sessionClaims?.metadata as { role?: string })?.role;

  if (!userId) {
    throw new Error("You must be signed in to perform this action.");
  }

  if (role !== "admin" && role !== "bursar") {
    throw new Error("Only admin or bursar accounts can manage finance records.");
  }

  return { userId, role: role as FinanceRole };
}

// ─── 2. Receipt number generator ─────────────────────────────────────────────
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
  const year = new Date().getFullYear();

  // Upsert the counter row for this year, then increment atomically
  const counter = await prisma.$transaction(async (tx) => {
    // Ensure the row exists for this year
    await tx.receiptCounter.upsert({
      where:  { year },
      create: { year, lastCounter: 0 },
      update: {},                        // don't change it yet — increment below
    });

    // Increment and return the new value
    return tx.receiptCounter.update({
      where: { year },
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
  action,
  performedBy,
  entityType,
  entityId,
  metadata,
  ipAddress,
}: {
  action:      AuditAction;
  performedBy: string;
  entityType:  string;
  entityId:    string | number;
  metadata:    Record<string, unknown>;
  ipAddress?:  string;
}): Promise<void> {
  await prisma.financeAuditLog.create({
    data: {
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

export async function recomputeBillStatus(billId: number): Promise<void> {
  const bill = await prisma.studentBill.findUnique({
    where:  { id: billId },
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

// ─── 5. Format currency helper ────────────────────────────────────────────────
// Formats a Decimal or number as GH₵ currency string.
// Used in server-rendered pages and PDF generators.
// e.g. formatGHS(1200.5) → "GH₵ 1,200.50"

export function formatGHS(amount: Prisma.Decimal | number | string): string {
  const num = typeof amount === "object" ? amount.toNumber() : Number(amount);
  return `GH₵ ${num.toLocaleString("en-GH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

// ─── 6. Payment method labels ─────────────────────────────────────────────────
// Human-readable labels for PaymentMethod enum values.

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CASH:             "Cash",
  MTN_MOMO:         "MTN Mobile Money",
  VODAFONE_CASH:    "Vodafone Cash",
  AIRTELTIGO_MONEY: "AirtelTigo Money",
  BANK_TRANSFER:    "Bank Transfer",
  CHEQUE:           "Cheque",
  OTHER:            "Other",
};

// ─── 7. Fee category labels ───────────────────────────────────────────────────

export const FEE_CATEGORY_LABELS: Record<string, string> = {
  TUITION:   "Tuition",
  LEVY:      "Levy",
  EXAM:      "Exam Fee",
  FEEDING:   "Feeding",
  TRANSPORT: "Transport",
  UNIFORM:   "Uniform",
  LIBRARY:   "Library",
  SPORTS:    "Sports",
  OTHER:     "Other",
};

// ─── 8. Discount type labels ──────────────────────────────────────────────────

export const DISCOUNT_TYPE_LABELS: Record<string, string> = {
  SCHOLARSHIP: "Scholarship",
  SIBLING:     "Sibling Discount",
  STAFF_CHILD: "Staff Child",
  BURSARY:     "Bursary",
  OTHER:       "Other",
};

// ─── 9. Bill status colours (Tailwind classes) ────────────────────────────────
// Used consistently across all finance pages and PDFs.

export const BILL_STATUS_STYLES: Record<string, { bg: string; text: string; border: string; label: string }> = {
  UNPAID:   { bg: "bg-rose-50",    text: "text-rose-700",    border: "border-rose-200",    label: "Unpaid"   },
  PARTIAL:  { bg: "bg-amber-50",   text: "text-amber-700",   border: "border-amber-200",   label: "Partial"  },
  PAID:     { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", label: "Paid"     },
  OVERPAID: { bg: "bg-blue-50",    text: "text-blue-700",    border: "border-blue-200",    label: "Overpaid" },
  WAIVED:   { bg: "bg-gray-50",    text: "text-gray-600",    border: "border-gray-200",    label: "Waived"   },
};