import { requirePageSession } from "@/src/lib/authz";
import prisma from "@/src/lib/prisma";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Clock,
  Download,
  ReceiptText,
  RotateCcw,
  Search,
} from "lucide-react";
import { formatGHS, PAYMENT_METHOD_LABELS } from "@/src/lib/constants/finance";
import { ITEM_PER_PAGE } from "@/src/lib/settings";
import Pagination from "@/src/components/pagination";
import { Prisma } from "@/src/generated/prisma";
import type { PaymentMethod, PaymentStatus } from "@/src/generated/prisma";

export const dynamic = "force-dynamic";

const PAYMENT_STATUSES = ["CONFIRMED", "REVERSED", "PENDING", "FAILED"] as const;
const PAYMENT_METHODS = [
  "CASH",
  "MTN_MOMO",
  "VODAFONE_CASH",
  "AIRTELTIGO_MONEY",
  "BANK_TRANSFER",
  "CHEQUE",
  "POS",
  "OTHER",
] as const;

const TERM_LABELS: Record<string, string> = {
  TERM_1: "Term 1",
  TERM_2: "Term 2",
  TERM_3: "Term 3",
};

const STATUS_META: Record<PaymentStatus, {
  label: string;
  tone: string;
  icon: "check" | "clock" | "x";
  note: string;
}> = {
  CONFIRMED: {
    label: "Official",
    tone: "bg-emerald-50 text-emerald-700 border-emerald-100",
    icon: "check",
    note: "Receipt can be downloaded and shared as payment proof.",
  },
  REVERSED: {
    label: "Voided",
    tone: "bg-rose-50 text-rose-700 border-rose-100",
    icon: "x",
    note: "This receipt is kept for history but is no longer valid proof.",
  },
  PENDING: {
    label: "Pending",
    tone: "bg-amber-50 text-amber-700 border-amber-100",
    icon: "clock",
    note: "Waiting for confirmation. No official receipt yet.",
  },
  FAILED: {
    label: "Failed",
    tone: "bg-gray-50 text-gray-600 border-gray-100",
    icon: "x",
    note: "Payment failed. No official receipt was issued.",
  },
};

function parsePositiveInt(value: string | undefined) {
  const parsed = Number.parseInt(value ?? "1", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function parseStatus(value: string | undefined): PaymentStatus | undefined {
  return PAYMENT_STATUSES.includes(value as PaymentStatus)
    ? (value as PaymentStatus)
    : undefined;
}

function parseMethod(value: string | undefined): PaymentMethod | undefined {
  return PAYMENT_METHODS.includes(value as PaymentMethod)
    ? (value as PaymentMethod)
    : undefined;
}

function parseDate(value: string | undefined, endOfDay = false) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const date = new Date(endOfDay ? `${value}T23:59:59.999` : `${value}T00:00:00.000`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function formatDateTime(date: Date) {
  return date.toLocaleString("en-GH", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusIcon(status: PaymentStatus) {
  const meta = STATUS_META[status];
  if (meta.icon === "check") return <CheckCircle2 size={16} />;
  if (meta.icon === "clock") return <Clock size={16} />;
  return <AlertTriangle size={16} />;
}

export default async function ReceiptsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const { schoolId } = await requirePageSession(["admin", "bursar"]);
  const sp = await searchParams;

  const page = parsePositiveInt(sp.page);
  const search = sp.search?.trim() || undefined;
  const filterStatus = parseStatus(sp.status);
  const filterMethod = parseMethod(sp.method);
  const dateFrom = parseDate(sp.from);
  const dateTo = parseDate(sp.to, true);

  const where: Prisma.PaymentWhereInput = { schoolId };
  if (filterStatus) where.status = filterStatus;
  if (filterMethod) where.paymentMethod = filterMethod;
  if (dateFrom || dateTo) {
    where.paymentDate = {};
    if (dateFrom) where.paymentDate.gte = dateFrom;
    if (dateTo) where.paymentDate.lte = dateTo;
  }
  if (search) {
    where.OR = [
      { receiptNumber: { contains: search, mode: "insensitive" } },
      { paidBy: { contains: search, mode: "insensitive" } },
      { referenceNo: { contains: search, mode: "insensitive" } },
      { studentBill: { student: { name: { contains: search, mode: "insensitive" } } } },
      { studentBill: { student: { surname: { contains: search, mode: "insensitive" } } } },
      { studentBill: { student: { class: { name: { contains: search, mode: "insensitive" } } } } },
    ];
  }

  const [receipts, count, confirmedSummary, statusCounts] = await Promise.all([
    prisma.payment.findMany({
      where,
      include: {
        studentBill: {
          include: {
            student: {
              select: {
                id: true,
                name: true,
                surname: true,
                class: { select: { name: true } },
              },
            },
            feeStructure: { select: { title: true, term: true, academicYear: true } },
          },
        },
        reversal: { select: { reason: true, reversedAt: true, reversedBy: true } },
      },
      orderBy: [{ paymentDate: "desc" }, { createdAt: "desc" }],
      take: ITEM_PER_PAGE,
      skip: ITEM_PER_PAGE * (page - 1),
    }),
    prisma.payment.count({ where }),
    prisma.payment.aggregate({
      where: { ...where, status: "CONFIRMED" },
      _count: { _all: true },
      _sum: { amount: true },
    }),
    prisma.payment.groupBy({
      by: ["status"],
      where,
      _count: { _all: true },
    }),
  ]);

  const recordedByIds = [...new Set(receipts.map((receipt) => receipt.recordedBy).filter((id): id is string => Boolean(id) && id !== "system:webhook"))];
  const [admins, bursars] = await Promise.all([
    recordedByIds.length > 0
      ? prisma.admin.findMany({
          where: { schoolId, id: { in: recordedByIds } },
          select: { id: true, username: true },
        })
      : [],
    recordedByIds.length > 0
      ? prisma.bursar.findMany({
          where: { schoolId, id: { in: recordedByIds } },
          select: { id: true, name: true, surname: true, username: true },
        })
      : [],
  ]);

  const adminNames = new Map(admins.map((admin) => [admin.id, admin.username]));
  const bursarNames = new Map(
    bursars.map((bursar) => [
      bursar.id,
      `${bursar.name ?? ""} ${bursar.surname ?? ""}`.trim() || bursar.username || "Finance office",
    ]),
  );

  const countByStatus = Object.fromEntries(
    statusCounts.map((item) => [item.status, item._count._all]),
  ) as Partial<Record<PaymentStatus, number>>;

  return (
    <div className="flex-1 m-4 mt-0 flex flex-col gap-4">
      <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
                <ReceiptText size={21} />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-600">Receipt register</p>
                <h1 className="text-xl font-black tracking-tight text-gray-900">Official payment proof</h1>
              </div>
            </div>
            <p className="mt-3 max-w-3xl text-sm font-semibold text-gray-500">
              Search, verify, print, and download confirmed receipts. Voided receipts remain visible for audit history but cannot be used as payment proof.
            </p>
          </div>
          <Link
            href="/list/finance/payments"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-black text-gray-700 transition hover:bg-gray-50"
          >
            Payments ledger <ChevronRight size={15} />
          </Link>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
            <p className="text-xs font-black uppercase tracking-wide text-emerald-600">Confirmed value</p>
            <p className="mt-2 text-2xl font-black text-emerald-800">{formatGHS(confirmedSummary._sum.amount ?? 0)}</p>
            <p className="mt-1 text-xs font-bold text-emerald-700">{confirmedSummary._count._all} official receipt{confirmedSummary._count._all === 1 ? "" : "s"}</p>
          </div>
          <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
            <p className="text-xs font-black uppercase tracking-wide text-blue-600">Visible records</p>
            <p className="mt-2 text-2xl font-black text-blue-800">{count}</p>
            <p className="mt-1 text-xs font-bold text-blue-700">Matching current filters</p>
          </div>
          <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4">
            <p className="text-xs font-black uppercase tracking-wide text-rose-600">Voided</p>
            <p className="mt-2 text-2xl font-black text-rose-800">{countByStatus.REVERSED ?? 0}</p>
            <p className="mt-1 text-xs font-bold text-rose-700">Kept for audit trail</p>
          </div>
          <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4">
            <p className="text-xs font-black uppercase tracking-wide text-amber-600">Not official yet</p>
            <p className="mt-2 text-2xl font-black text-amber-800">{(countByStatus.PENDING ?? 0) + (countByStatus.FAILED ?? 0)}</p>
            <p className="mt-1 text-xs font-bold text-amber-700">Pending or failed payments</p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
        <form className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-7">
          <div className="relative sm:col-span-2 xl:col-span-2">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              name="search"
              defaultValue={search ?? ""}
              placeholder="Receipt no., student, payer, class, reference"
              className="w-full rounded-xl border border-gray-200 py-2.5 pl-9 pr-3 text-sm font-semibold text-gray-700 outline-none focus:border-blue-500"
            />
          </div>
          <select name="status" defaultValue={filterStatus ?? ""} className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-bold text-gray-600 outline-none focus:border-blue-500">
            <option value="">All receipt states</option>
            <option value="CONFIRMED">Official receipts</option>
            <option value="REVERSED">Voided receipts</option>
            <option value="PENDING">Pending</option>
            <option value="FAILED">Failed</option>
          </select>
          <select name="method" defaultValue={filterMethod ?? ""} className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-bold text-gray-600 outline-none focus:border-blue-500">
            <option value="">All methods</option>
            {PAYMENT_METHODS.map((method) => (
              <option key={method} value={method}>{PAYMENT_METHOD_LABELS[method] ?? method}</option>
            ))}
          </select>
          <input type="date" name="from" defaultValue={sp.from ?? ""} className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-bold text-gray-600 outline-none focus:border-blue-500" />
          <input type="date" name="to" defaultValue={sp.to ?? ""} className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-bold text-gray-600 outline-none focus:border-blue-500" />
          <div className="grid grid-cols-2 gap-2">
            <button type="submit" className="rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-black text-white transition hover:bg-blue-800">Apply</button>
            <Link href="/list/finance/receipts" className="rounded-xl bg-gray-100 px-4 py-2.5 text-center text-sm font-black text-gray-600 transition hover:bg-gray-200">Clear</Link>
          </div>
        </form>
      </section>

      <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className="flex flex-col gap-1 border-b border-gray-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs font-black uppercase tracking-wider text-gray-400">{count} receipt record{count === 1 ? "" : "s"}</p>
          <p className="text-xs font-semibold text-gray-400">Official receipts are available only after payment confirmation.</p>
        </div>

        {receipts.length === 0 ? (
          <div className="py-16 text-center">
            <ReceiptText size={32} className="mx-auto text-gray-200" />
            <p className="mt-3 text-sm font-bold text-gray-400">No receipt record found</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {receipts.map((receipt) => {
              const meta = STATUS_META[receipt.status];
              const student = receipt.studentBill.student;
              const feeStructure = receipt.studentBill.feeStructure;
              const receivedBy = receipt.recordedBy === "system:webhook"
                ? "Online payment provider"
                : bursarNames.get(receipt.recordedBy) ?? adminNames.get(receipt.recordedBy) ?? "Finance office";
              const canDownload = receipt.status === "CONFIRMED";

              return (
                <article key={receipt.id} className="p-4 transition hover:bg-gray-50/70 sm:p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-black ${meta.tone}`}>
                          {statusIcon(receipt.status)} {meta.label}
                        </span>
                        <p className="text-sm font-black text-gray-900">{receipt.receiptNumber}</p>
                      </div>
                      <div className="mt-2 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2 xl:grid-cols-4">
                        <div>
                          <p className="text-[11px] font-black uppercase tracking-wide text-gray-400">Student</p>
                          <p className="font-black text-gray-800">{student.name} {student.surname}</p>
                          <p className="text-xs font-semibold text-gray-500">{student.class?.name ?? "No class"}</p>
                        </div>
                        <div>
                          <p className="text-[11px] font-black uppercase tracking-wide text-gray-400">Term / session</p>
                          <p className="font-bold text-gray-700">{TERM_LABELS[feeStructure.term] ?? feeStructure.term} {feeStructure.academicYear}</p>
                          <p className="text-xs font-semibold text-gray-500">{feeStructure.title}</p>
                        </div>
                        <div>
                          <p className="text-[11px] font-black uppercase tracking-wide text-gray-400">Paid by / method</p>
                          <p className="font-bold text-gray-700">{receipt.paidBy}</p>
                          <p className="text-xs font-semibold text-gray-500">{PAYMENT_METHOD_LABELS[receipt.paymentMethod] ?? receipt.paymentMethod}{receipt.referenceNo ? ` - Ref: ${receipt.referenceNo}` : ""}</p>
                        </div>
                        <div>
                          <p className="text-[11px] font-black uppercase tracking-wide text-gray-400">Received by / time</p>
                          <p className="font-bold text-gray-700">{receivedBy}</p>
                          <p className="text-xs font-semibold text-gray-500">{formatDateTime(receipt.paymentDate)}</p>
                        </div>
                      </div>
                      <p className="mt-3 rounded-xl bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-500">{meta.note}</p>
                      {receipt.status === "REVERSED" && receipt.reversal && (
                        <p className="mt-2 inline-flex items-center gap-2 rounded-xl bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">
                          <RotateCcw size={13} /> Reversed: {receipt.reversal.reason}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center lg:flex-col lg:items-end">
                      <p className={`text-2xl font-black ${receipt.status === "REVERSED" ? "text-rose-500 line-through" : "text-emerald-700"}`}>
                        {formatGHS(receipt.amount)}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {canDownload ? (
                          <a
                            href={`/api/finance/receipt?billId=${receipt.studentBillId}&receiptNumber=${encodeURIComponent(receipt.receiptNumber)}`}
                            target="_blank"
                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-black text-white transition hover:bg-blue-800"
                          >
                            <Download size={14} /> Receipt
                          </a>
                        ) : (
                          <span className="inline-flex items-center justify-center rounded-xl bg-gray-100 px-4 py-2.5 text-sm font-black text-gray-400">
                            No receipt PDF
                          </span>
                        )}
                        <Link
                          href={`/list/finance/bills/${receipt.studentBillId}`}
                          className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-black text-gray-700 transition hover:bg-gray-50"
                        >
                          Bill <ChevronRight size={14} />
                        </Link>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        <div className="border-t border-gray-100">
          <Pagination page={page} count={count} />
        </div>
      </section>
    </div>
  );
}
