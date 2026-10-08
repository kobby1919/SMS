"use client";

import type { AdminFinanceSnapshot as AdminFinanceSnapshotData } from "@/src/lib/services/admin-finance-snapshot";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  CheckCircle2,
  Clock3,
  ReceiptText,
  ShieldAlert,
  TrendingDown,
  Users,
  WalletCards,
} from "lucide-react";

type Props = {
  snapshot: AdminFinanceSnapshotData;
};

function formatGHS(amount: number) {
  return `GHS ${amount.toLocaleString("en-GH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatTime(value: Date | null) {
  if (!value) return "No payment yet";
  return new Intl.DateTimeFormat("en-GH", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function alertTone(tone: "ok" | "warning" | "risk") {
  if (tone === "risk") return "border-rose-200 bg-rose-50 text-rose-800";
  if (tone === "warning") return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-emerald-200 bg-emerald-50 text-emerald-800";
}

function priorityTone(priority: string) {
  if (priority === "Critical") return "bg-rose-100 text-rose-700";
  if (priority === "High") return "bg-orange-100 text-orange-700";
  if (priority === "Medium") return "bg-amber-100 text-amber-700";
  return "bg-slate-100 text-slate-700";
}

function MoneyCard({
  label,
  value,
  helper,
  icon,
}: {
  label: string;
  value: string | number;
  helper: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
      <div className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-wide text-gray-500">
        {icon}
        <span>{label}</span>
      </div>
      <p className="break-words text-xl font-black leading-tight text-gray-950 sm:text-2xl">
        {value}
      </p>
      <p className="mt-1 text-xs font-semibold leading-5 text-gray-500">
        {helper}
      </p>
    </div>
  );
}

function MiniMoney({
  label,
  value,
  tone = "text-gray-700",
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div>
      <p className="text-[10px] font-black uppercase tracking-wide text-gray-400 md:hidden">
        {label}
      </p>
      <p className={`text-sm font-black ${tone}`}>{value}</p>
    </div>
  );
}

export default function AdminFinanceSnapshot({ snapshot }: Props) {
  const money = snapshot.moneyPosition;
  const today = snapshot.todayActivity;

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-black text-gray-950">Finance Snapshot</h2>
            <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-black text-blue-700">
              Owner control view
            </span>
          </div>
          <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-gray-600">
            Real bill position from non-daily student bill items, confirmed payments, online payment attempts,
            receipts, corrections, and reversals. Daily collections are tracked separately.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row lg:justify-end">
          <Link
            href="/list/finance/bills"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 px-4 py-2.5 text-xs font-black text-gray-700 transition hover:bg-gray-50"
          >
            Review bills
            <ArrowRight size={14} />
          </Link>
        </div>
      </div>

      {!snapshot.hasBillPositionRecords ? (
        <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-600" />
            <div>
              <p className="text-sm font-black text-amber-950">No bill position records yet</p>
              <p className="mt-1 text-sm font-semibold leading-6 text-amber-800">
                Edujay cannot show bill expected, bill collected, bill outstanding,
                or bill collection rate until non-daily student bills are generated.
                Daily collections are handled separately.
              </p>
              <Link
                href="/list/finance/fee-structures"
                className="mt-3 inline-flex items-center gap-2 rounded-lg bg-amber-600 px-3 py-2 text-xs font-black text-white transition hover:bg-amber-700"
              >
                Set up fees
                <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        </div>
      ) : null}

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <MoneyCard
          label="Bill expected"
          value={formatGHS(money.expectedFees)}
          helper={`${money.billCount} generated bill${money.billCount === 1 ? "" : "s"} excluding daily collection lines.`}
          icon={<WalletCards size={14} />}
        />
        <MoneyCard
          label="Bill collected"
          value={formatGHS(money.collectedFees)}
          helper={
            typeof money.importedOrOpeningPaidAmount === "number" && money.importedOrOpeningPaidAmount > 0
              ? `${formatGHS(money.importedOrOpeningPaidAmount)} came from imported opening balances.`
              : money.dailyLineItemCountExcluded > 0
                ? "From bill line paid amounts. Confirmed payments are tracked separately for receipts."
                : `${money.confirmedPaymentCount} confirmed payment records.`
          }
          icon={<Banknote size={14} />}
        />
        <MoneyCard
          label="Bill outstanding"
          value={formatGHS(money.outstandingBalance)}
          helper={`${money.owingStudents} student${money.owingStudents === 1 ? "" : "s"} still owing.`}
          icon={<TrendingDown size={14} />}
        />
        <MoneyCard
          label="Collection rate"
          value={`${money.collectionRate}%`}
          helper="Collected bill line amounts against expected bill line amounts."
          icon={<CheckCircle2 size={14} />}
        />
        <MoneyCard
          label="Paid students"
          value={money.paidStudents}
          helper="Students with non-daily bills and no open bill balance."
          icon={<Users size={14} />}
        />
        <MoneyCard
          label="Owing students"
          value={money.owingStudents}
          helper="Students with unpaid or part-paid non-daily bill balances."
          icon={<ShieldAlert size={14} />}
        />
      </div>

      {money.dailyLineItemCountExcluded > 0 ? (
        <div className="mt-3 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs font-semibold leading-5 text-blue-800">
          {money.dailyLineItemCountExcluded} daily bill line{money.dailyLineItemCountExcluded === 1 ? "" : "s"} excluded from these cards.
          Daily collections will appear in their own collection section.
        </div>
      ) : null}

      <div className="mt-5 rounded-lg border border-gray-200 bg-white p-4">
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-black text-gray-950">Fee Item Breakdown</p>
            <p className="mt-1 text-xs font-semibold leading-5 text-gray-500">
              Shows which non-daily bill items make up the bill expected, collected, and outstanding figures.
            </p>
          </div>
        </div>
        {snapshot.feeItemBreakdown.length > 0 ? (
          <div className="overflow-hidden rounded-lg border border-gray-100">
            <div className="hidden grid-cols-[1.4fr_1fr_1fr_1fr_80px] gap-3 bg-gray-50 px-3 py-2 text-[10px] font-black uppercase tracking-wide text-gray-400 md:grid">
              <span>Fee item</span>
              <span>Expected</span>
              <span>Collected</span>
              <span>Outstanding</span>
              <span>Rate</span>
            </div>
            <div className="divide-y divide-gray-100">
              {snapshot.feeItemBreakdown.map((item) => (
                <div
                  key={`${item.category}:${item.name}:${item.billingFrequency}`}
                  className="grid gap-2 px-3 py-3 md:grid-cols-[1.4fr_1fr_1fr_1fr_80px] md:items-center"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-gray-950">{item.name}</p>
                    <p className="mt-1 text-[11px] font-semibold text-gray-400">
                      {item.category.toLowerCase().replaceAll("_", " ")} · {item.billingFrequency.toLowerCase().replaceAll("_", " ")} · {item.studentCount} student{item.studentCount === 1 ? "" : "s"} · {item.lineItemCount} line item{item.lineItemCount === 1 ? "" : "s"}
                    </p>
                  </div>
                  <MiniMoney label="Expected" value={formatGHS(item.expected)} />
                  <MiniMoney label="Collected" value={formatGHS(item.collected)} tone="text-emerald-700" />
                  <MiniMoney label="Outstanding" value={formatGHS(item.outstanding)} tone={item.outstanding > 0 ? "text-rose-700" : "text-gray-700"} />
                  <p className="text-sm font-black text-gray-950">{item.collectionRate}%</p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="rounded-lg bg-gray-50 p-3 text-sm font-semibold text-gray-500">
            No non-daily fee item breakdown yet. Generate student bills from term, monthly, weekly, or one-time fee items.
          </p>
        )}
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-black text-gray-950">Today&apos;s Collection Activity</p>
              <p className="mt-1 text-xs font-semibold leading-5 text-gray-500">
                Trusted money today combines confirmed bill payments and confirmed daily collections.
              </p>
            </div>
            <Clock3 size={18} className="shrink-0 text-gray-400" />
          </div>
          <p className="mt-4 text-2xl font-black text-gray-950">
            {formatGHS(today.trustedMoneyToday)}
          </p>
          <p className="mt-1 text-sm font-semibold leading-6 text-gray-600">
            {formatGHS(today.billPaymentAmountToday)} from bill payments and {formatGHS(today.dailyCollectionsConfirmedToday)} from confirmed daily collections.
          </p>
          <p className="mt-1 text-xs font-semibold leading-5 text-gray-500">
            {today.billPaymentsRecordedToday} bill payment{today.billPaymentsRecordedToday === 1 ? "" : "s"} recorded today.
            Last payment: {formatTime(today.lastPaymentRecordedAt)}
            {today.lastPaymentReceiptNumber ? ` · ${today.lastPaymentReceiptNumber}` : ""}.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-white p-3">
              <p className="text-[10px] font-black uppercase tracking-wide text-gray-400">Receipts</p>
              <p className="mt-1 text-lg font-black text-gray-900">{today.receiptsIssuedToday}</p>
            </div>
            <div className="rounded-lg bg-white p-3">
              <p className="text-[10px] font-black uppercase tracking-wide text-gray-400">Online confirmed</p>
              <p className="mt-1 text-lg font-black text-gray-900">{today.onlinePaymentsConfirmedToday}</p>
            </div>
            <div className="rounded-lg bg-white p-3">
              <p className="text-[10px] font-black uppercase tracking-wide text-gray-400">Pending online</p>
              <p className="mt-1 text-lg font-black text-gray-900">{today.pendingOnlinePayments}</p>
            </div>
            <div className="rounded-lg bg-white p-3">
              <p className="text-[10px] font-black uppercase tracking-wide text-gray-400">Daily confirmed</p>
              <p className="mt-1 text-lg font-black text-gray-900">{today.dailyCollectionConfirmedSessions}</p>
            </div>
            <div className="rounded-lg bg-white p-3">
              <p className="text-[10px] font-black uppercase tracking-wide text-gray-400">Daily pending</p>
              <p className="mt-1 text-lg font-black text-gray-900">{today.dailyCollectionPendingReviewSessions}</p>
            </div>
            <div className="rounded-lg bg-white p-3">
              <p className="text-[10px] font-black uppercase tracking-wide text-gray-400">Daily flagged</p>
              <p className="mt-1 text-lg font-black text-gray-900">{today.dailyCollectionFlaggedSessions}</p>
            </div>
          </div>
          {(today.dailyCollectionPendingReviewSessions > 0 || today.dailyCollectionFlaggedSessions > 0) && (
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold leading-5 text-amber-800">
              {formatGHS(today.dailyCollectionPendingReviewAmount + today.dailyCollectionFlaggedAmount)} in submitted or flagged daily collections is not counted as trusted money yet.
            </div>
          )}
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-black text-gray-950">Weak Collection Classes</p>
              <p className="mt-1 text-xs font-semibold text-gray-500">
                Lowest collection rates with open balances.
              </p>
            </div>
          </div>
          {snapshot.weakClasses.length > 0 ? (
            <div className="space-y-2">
              {snapshot.weakClasses.map((row) => (
                <div
                  key={row.classId}
                  className="grid gap-2 rounded-lg border border-gray-100 p-3 sm:grid-cols-[120px_1fr_auto] sm:items-center"
                >
                  <p className="truncate text-sm font-black text-gray-900">{row.className}</p>
                  <div>
                    <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                      <div
                        className={row.collectionRate < 40 ? "h-full rounded-full bg-rose-500" : "h-full rounded-full bg-amber-500"}
                        style={{ width: `${Math.min(Math.max(row.collectionRate, 0), 100)}%` }}
                      />
                    </div>
                    <p className="mt-1 text-[11px] font-semibold text-gray-500">
                      {formatGHS(row.outstanding)} outstanding · {row.unpaidBills + row.partialBills} owing bills
                    </p>
                  </div>
                  <p className="text-sm font-black text-gray-950">{row.collectionRate}%</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-lg bg-gray-50 p-3 text-sm font-semibold text-gray-500">
              No weak collection class yet. This will appear once bills and payments exist.
            </p>
          )}
        </div>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-2">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-black text-gray-950">High-Risk Owing Students</p>
              <p className="mt-1 text-xs font-semibold text-gray-500">
                Top 5 students by total outstanding balance. Open a student&apos;s priority bill for review.
              </p>
            </div>
            <Users size={17} className="text-gray-400" />
          </div>
          {snapshot.highRiskOwingStudents.length > 0 ? (
            <div className="space-y-2">
              {snapshot.highRiskOwingStudents.map((student) => (
                <Link
                  key={student.billId}
                  href={student.href}
                  className="block rounded-lg border border-gray-100 p-3 transition hover:border-blue-100 hover:bg-blue-50/40"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-gray-950">{student.studentName}</p>
                      <p className="mt-1 text-xs font-semibold text-gray-500">
                        {student.className} · {student.parentContactStatus}
                      </p>
                    </div>
                    <div className="shrink-0 text-left sm:text-right">
                      <p className="text-sm font-black text-gray-950">{formatGHS(student.amountOwed)}</p>
                      <span className={`mt-1 inline-flex rounded-full px-2 py-1 text-[10px] font-black ${priorityTone(student.priority)}`}>
                        {student.priority} · {student.daysOverdue} days overdue
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="rounded-lg bg-gray-50 p-3 text-sm font-semibold text-gray-500">
              No high-risk owing students yet.
            </p>
          )}
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-black text-gray-950">Finance Integrity Alerts</p>
              <p className="mt-1 text-xs font-semibold text-gray-500">
                Trust checks for corrections, receipts, references, and online payments.
              </p>
            </div>
            <ReceiptText size={17} className="text-gray-400" />
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {snapshot.integrityAlerts.map((alert) => (
              <Link
                key={alert.id}
                href={alert.href}
                className={`rounded-lg border p-3 transition hover:shadow-sm ${alertTone(alert.tone)}`}
              >
                <p className="text-lg font-black leading-none">{alert.value}</p>
                <p className="mt-1 text-xs font-black leading-5">{alert.label}</p>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
