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
import {
  getWeeklyFinanceSummary,
  parseWeeklyReportDate,
  weeklyReportDateInputValue,
} from "@/src/lib/services/weekly-finance-report";
import { formatGHS } from "@/src/lib/constants/finance";
import { enforceActionRateLimit } from "@/src/lib/rate-limit";
import { revalidatePath } from "next/cache";
import { clerkClient } from "@clerk/nextjs/server";
import {
  createNotification,
  getAppNotificationSettings,
  notificationIdempotencyKeys,
} from "@/src/lib/services/app-notifications";

export { requireFinanceAccess };
import { Prisma } from "@/src/generated/prisma";                 // ← fix 1: Prisma namespace (gives us Decimal + InputJsonValue)
import type { AuditAction } from "@/src/generated/prisma";

// ─── Types ────────────────────────────────────────────────────────────────────


export type WeeklyFinanceSummaryPushPreview = {
  ok: true;
  weekStart: string;
  weekEnd: string;
  adminCount: number;
  pdfHref: string;
  message: string;
  summary: {
    totalCollected: string;
    paymentCount: number;
    totalDelta: string;
    criticalArrears: number;
    openFinanceQueries: number;
    pendingCorrections: number;
  };
};

function formatWeekLabel(start: Date, end: Date) {
  const formatter = new Intl.DateTimeFormat("en-GH", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  return `${formatter.format(start)} - ${formatter.format(end)}`;
}

export async function prepareWeeklyFinanceSummaryPush(input?: {
  date?: string | null;
}): Promise<WeeklyFinanceSummaryPushPreview> {
  const ctx = await requireFinanceAccess();
  await enforceActionRateLimit({
    key: `finance:weekly-summary-push-preview:${ctx.schoolId}:${ctx.userId}`,
    limit: 10,
    windowMs: 60_000,
  });
  const selectedDate = parseWeeklyReportDate(input?.date);
  const report = await getWeeklyFinanceSummary(ctx.schoolId, selectedDate);
  const admins = await prisma.admin.findMany({
    where: { schoolId: ctx.schoolId },
    select: { id: true },
  });

  if (admins.length === 0) {
    throw new Error("No active admin account was found for this school. Add an admin before pushing the weekly finance summary.");
  }

  const weekStart = weeklyReportDateInputValue(report.weekStart);
  const weekEnd = weeklyReportDateInputValue(report.weekEnd);
  const pdfHref = `/api/finance/reports/weekly?date=${weekStart}`;

  return {
    ok: true,
    weekStart,
    weekEnd,
    adminCount: admins.length,
    pdfHref,
    message: `Weekly finance summary is ready for ${admins.length} admin${admins.length === 1 ? "" : "s"} covering ${formatWeekLabel(report.weekStart, report.weekEnd)}.`,
    summary: {
      totalCollected: formatGHS(report.totalCollected),
      paymentCount: report.paymentCount,
      totalDelta: formatGHS(report.totalDelta),
      criticalArrears: report.arrears.summary.byPriority.Critical,
      openFinanceQueries: report.parentPaymentIssues.openQueries,
      pendingCorrections: report.correctionControl.stillPending,
    },
  };
}


function primaryEmailFromClerkUser(user: Awaited<ReturnType<Awaited<ReturnType<typeof clerkClient>>["users"]["getUser"]>>) {
  const primary = user.emailAddresses.find((email) => email.id === user.primaryEmailAddressId);
  return (primary ?? user.emailAddresses[0])?.emailAddress?.trim().toLowerCase() ?? null;
}

async function resolveAdminEmailDeliveries(admins: Array<{ id: string }>) {
  const client = await clerkClient();
  const entries = await Promise.all(
    admins.map(async (admin) => {
      try {
        const user = await client.users.getUser(admin.id);
        return [admin.id, primaryEmailFromClerkUser(user)] as const;
      } catch {
        return [admin.id, null] as const;
      }
    }),
  );

  return new Map(entries);
}
function buildWeeklyFinanceAdminMessage(report: Awaited<ReturnType<typeof getWeeklyFinanceSummary>>) {
  const lines = [
    `Weekly collections: ${formatGHS(report.totalCollected)} from ${report.paymentCount} confirmed payment${report.paymentCount === 1 ? "" : "s"}.`,
    `Change from last week: ${formatGHS(report.totalDelta)} and ${report.paymentDelta >= 0 ? "+" : ""}${report.paymentDelta} payment${Math.abs(report.paymentDelta) === 1 ? "" : "s"}.`,
    `Critical arrears: ${report.arrears.summary.byPriority.Critical} bill${report.arrears.summary.byPriority.Critical === 1 ? "" : "s"}.`,
    `Open finance queries: ${report.parentPaymentIssues.openQueries}. Pending corrections: ${report.correctionControl.stillPending}.`,
  ];

  const strongest = report.strongestCollectionDay;
  const weakest = report.weakestCollectionDay;
  if (strongest) lines.push(`Strongest day: ${strongest.label} with ${formatGHS(strongest.amount)}.`);
  if (weakest) lines.push(`Weakest day: ${weakest.label} with ${formatGHS(weakest.amount)}.`);

  lines.push("Open the weekly summary PDF for the full owner-ready report.");
  return lines.join("\n");
}

export type WeeklyFinanceSummaryPushResult = WeeklyFinanceSummaryPushPreview & {
  pushed: true;
  notificationCount: number;
  emailDeliveryCount: number;
  skippedEmailCount: number;
};

export async function pushWeeklyFinanceSummaryToAdmins(input?: {
  date?: string | null;
}): Promise<WeeklyFinanceSummaryPushResult> {
  const ctx = await requireFinanceAccess();
  await enforceActionRateLimit({
    key: `finance:weekly-summary-push:${ctx.schoolId}:${ctx.userId}`,
    limit: 5,
    windowMs: 60_000,
  });

  const selectedDate = parseWeeklyReportDate(input?.date);
  const report = await getWeeklyFinanceSummary(ctx.schoolId, selectedDate);
  const settings = await getAppNotificationSettings(ctx.schoolId);
  if (settings.sendWeeklyFinanceSummaryToAdmins === false) {
    throw new Error("Weekly finance summary notifications are disabled for this school.");
  }

  const admins = await prisma.admin.findMany({
    where: { schoolId: ctx.schoolId },
    select: { id: true, username: true },
    orderBy: { username: "asc" },
  });

  if (admins.length === 0) {
    throw new Error("No active admin account was found for this school. Add an admin before pushing the weekly finance summary.");
  }

  const weekStart = weeklyReportDateInputValue(report.weekStart);
  const weekEnd = weeklyReportDateInputValue(report.weekEnd);
  const pdfHref = `/api/finance/reports/weekly?date=${weekStart}`;
  const baseIdempotencyKey = notificationIdempotencyKeys.weeklyFinanceSummary(ctx.schoolId, weekStart);
  const recipientIdempotencyKeys = admins.map((admin) =>
    notificationIdempotencyKeys.forRecipient(baseIdempotencyKey, ctx.schoolId, "ADMIN", admin.id),
  );
  const existingPush = await prisma.appNotification.findFirst({
    where: {
      schoolId: ctx.schoolId,
      idempotencyKey: { in: recipientIdempotencyKeys },
    },
    select: { id: true, createdAt: true },
  });
  if (existingPush) {
    throw new Error("This weekly finance summary has already been pushed to admins. Use the resend workflow when we enable explicit resending.");
  }

  const body = buildWeeklyFinanceAdminMessage(report);
  const title = `Weekly finance summary: ${formatWeekLabel(report.weekStart, report.weekEnd)}`;


  const emailByAdminId = await resolveAdminEmailDeliveries(admins);
  const notifications = [];
  for (const admin of admins) {
    const adminEmail = emailByAdminId.get(admin.id);
    notifications.push(
      await createNotification({
        schoolId: ctx.schoolId,
        recipientType: "ADMIN",
        recipientId: admin.id,
        type: "WEEKLY_FINANCE_SUMMARY",
        category: "FINANCE",
        priority: report.arrears.summary.byPriority.Critical > 0 || report.correctionControl.stillPending > 0 ? "HIGH" : "NORMAL",
        title,
        body,
        href: pdfHref,
        sourceModel: "WeeklyFinanceSummary",
        sourceId: weekStart,
        idempotencyKey: baseIdempotencyKey,
        deliveries: adminEmail
          ? [
              {
                channel: "EMAIL",
                destination: adminEmail,
              },
            ]
          : [],
        payload: {
          weekStart,
          weekEnd,
          totalCollected: Number(report.totalCollected),
          paymentCount: report.paymentCount,
          totalDelta: Number(report.totalDelta),
          paymentDelta: report.paymentDelta,
          criticalArrears: report.arrears.summary.byPriority.Critical,
          openFinanceQueries: report.parentPaymentIssues.openQueries,
          pendingCorrections: report.correctionControl.stillPending,
          pdfHref,
          pushedBy: ctx.userId,
        },
      }),
    );
  }

  const emailDeliveryCount = Array.from(emailByAdminId.values()).filter(Boolean).length;

  revalidatePath("/");
  revalidatePath("/list/finance/reports");

  return {
    ok: true,
    pushed: true,
    weekStart,
    weekEnd,
    adminCount: admins.length,
    notificationCount: notifications.length,
    emailDeliveryCount,
    skippedEmailCount: admins.length - emailDeliveryCount,
    pdfHref,
    message: `Weekly finance summary was pushed to ${admins.length} admin${admins.length === 1 ? "" : "s"} for ${formatWeekLabel(report.weekStart, report.weekEnd)}.`,
    summary: {
      totalCollected: formatGHS(report.totalCollected),
      paymentCount: report.paymentCount,
      totalDelta: formatGHS(report.totalDelta),
      criticalArrears: report.arrears.summary.byPriority.Critical,
      openFinanceQueries: report.parentPaymentIssues.openQueries,
      pendingCorrections: report.correctionControl.stillPending,
    },
  };
}

export type WeeklyFinanceSummaryPushState = {
  ok: boolean;
  message: string | null;
  notificationCount?: number;
  emailDeliveryCount?: number;
  skippedEmailCount?: number;
};

export async function pushWeeklyFinanceSummaryToAdminsWithState(
  _previousState: WeeklyFinanceSummaryPushState,
  formData: FormData,
): Promise<WeeklyFinanceSummaryPushState> {
  try {
    const result = await pushWeeklyFinanceSummaryToAdmins({
      date: String(formData.get("date") ?? ""),
    });

    const emailText = result.emailDeliveryCount > 0
      ? `${result.emailDeliveryCount} email delivery${result.emailDeliveryCount === 1 ? "" : "ies"} queued.`
      : "No email delivery was queued because no admin email was available.";

    return {
      ok: true,
      message: `${result.message} ${emailText}`,
      notificationCount: result.notificationCount,
      emailDeliveryCount: result.emailDeliveryCount,
      skippedEmailCount: result.skippedEmailCount,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Weekly finance summary could not be pushed.",
    };
  }
}
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

export async function generateReceiptNumber(trustedSchoolId?: string): Promise<string> {
  const schoolId = trustedSchoolId ?? (await requireFinanceAccess()).schoolId;
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
