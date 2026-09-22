import { revalidatePath } from "next/cache";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileWarning,
  Filter,
  ReceiptText,
  Search,
  ShieldAlert,
  UserRound,
  XCircle,
} from "lucide-react";
import Pagination from "@/src/components/pagination";
import { formatGHS, PAYMENT_METHOD_LABELS } from "@/src/lib/constants/finance";
import { TERM_LABELS } from "@/src/lib/caGrades";
import { requirePageSession } from "@/src/lib/authz";
import prisma from "@/src/lib/prisma";
import { ITEM_PER_PAGE } from "@/src/lib/settings";
import { applyPaymentCorrection, reviewPaymentCorrection } from "@/src/lib/actions/paymentCorrectionActions";
import type { PaymentCorrectionStatus, PaymentCorrectionType } from "@/src/generated/prisma";
import { Prisma } from "@/src/generated/prisma";

export const dynamic = "force-dynamic";

const STATUSES = ["PENDING_REVIEW", "APPROVED", "REJECTED", "APPLIED", "CANCELLED"] as const;
const TYPES = ["WRONG_AMOUNT", "WRONG_STUDENT", "DUPLICATE_PAYMENT", "WRONG_METHOD", "WRONG_REFERENCE", "PAYMENT_BOUNCED", "RECEIPT_CANCELLATION", "OTHER"] as const;

const STATUS_META: Record<PaymentCorrectionStatus, { label: string; tone: string; icon: "clock" | "check" | "x" }> = {
  PENDING_REVIEW: { label: "Pending review", tone: "bg-amber-50 text-amber-700 border-amber-100", icon: "clock" },
  APPROVED: { label: "Approved", tone: "bg-blue-50 text-blue-700 border-blue-100", icon: "check" },
  REJECTED: { label: "Rejected", tone: "bg-rose-50 text-rose-700 border-rose-100", icon: "x" },
  APPLIED: { label: "Applied", tone: "bg-emerald-50 text-emerald-700 border-emerald-100", icon: "check" },
  CANCELLED: { label: "Cancelled", tone: "bg-gray-50 text-gray-600 border-gray-100", icon: "x" },
};

const TYPE_LABELS: Record<PaymentCorrectionType, string> = {
  WRONG_AMOUNT: "Wrong amount",
  WRONG_STUDENT: "Wrong student",
  DUPLICATE_PAYMENT: "Duplicate payment",
  WRONG_METHOD: "Wrong method",
  WRONG_REFERENCE: "Wrong reference",
  PAYMENT_BOUNCED: "Payment bounced",
  RECEIPT_CANCELLATION: "Receipt cancellation",
  OTHER: "Other",
};

const ACTION_LABELS: Record<string, string> = {
  REVERSE_PAYMENT: "Reverse payment",
  REPLACE_PAYMENT: "Replace payment",
  MOVE_PAYMENT: "Move payment",
  MARK_DUPLICATE: "Mark duplicate",
  FIX_REFERENCE_OR_METHOD: "Fix reference or method",
  CANCEL_RECEIPT: "Cancel receipt",
};

function parsePositiveInt(value: string | undefined) {
  const parsed = Number.parseInt(value ?? "1", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function parseStatus(value: string | undefined): PaymentCorrectionStatus | undefined {
  return STATUSES.includes(value as PaymentCorrectionStatus)
    ? (value as PaymentCorrectionStatus)
    : undefined;
}

function parseType(value: string | undefined): PaymentCorrectionType | undefined {
  return TYPES.includes(value as PaymentCorrectionType)
    ? (value as PaymentCorrectionType)
    : undefined;
}

function parseDateStart(value: string | undefined) {
  if (!value) return undefined;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function parseDateEnd(value: string | undefined) {
  if (!value) return undefined;
  const date = new Date(`${value}T23:59:59.999Z`);
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

function statusIcon(status: PaymentCorrectionStatus) {
  const meta = STATUS_META[status];
  if (meta.icon === "check") return <CheckCircle2 size={15} />;
  if (meta.icon === "x") return <XCircle size={15} />;
  return <Clock size={15} />;
}

async function reviewCorrectionForm(formData: FormData) {
  "use server";

  await reviewPaymentCorrection({
    correctionId: Number(formData.get("correctionId")),
    decision: String(formData.get("decision")) === "APPROVE" ? "APPROVE" : "REJECT",
    reviewNote: String(formData.get("reviewNote") ?? ""),
  });

  revalidatePath("/list/finance/corrections");
}

async function applyCorrectionForm(formData: FormData) {
  "use server";

  const correctedAmountValue = String(formData.get("correctedAmount") ?? "").trim();
  const targetStudentBillIdValue = String(formData.get("targetStudentBillId") ?? "").trim();
  const paymentMethodValue = String(formData.get("paymentMethod") ?? "").trim();
  const referenceNoValue = String(formData.get("referenceNo") ?? "").trim();
  const paidByValue = String(formData.get("paidBy") ?? "").trim();
  const paymentDateValue = String(formData.get("paymentDate") ?? "").trim();

  await applyPaymentCorrection({
    correctionId: Number(formData.get("correctionId")),
    applicationNote: String(formData.get("applicationNote") ?? ""),
    correctedAmount: correctedAmountValue ? Number(correctedAmountValue) : null,
    targetStudentBillId: targetStudentBillIdValue ? Number(targetStudentBillIdValue) : null,
    paymentMethod: paymentMethodValue ? paymentMethodValue as never : null,
    referenceNo: referenceNoValue || null,
    paidBy: paidByValue || null,
    paymentDate: paymentDateValue || null,
  });

  revalidatePath("/list/finance/corrections");
}

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

export default async function PaymentCorrectionsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const { schoolId, role } = await requirePageSession(["admin", "bursar"]);
  const sp = await searchParams;
  const page = parsePositiveInt(sp.page);
  const status = parseStatus(sp.status) ?? "PENDING_REVIEW";
  const type = parseType(sp.type);
  const search = sp.search?.trim();
  const bursarId = sp.bursarId?.trim();
  const from = sp.from?.trim();
  const to = sp.to?.trim();
  const fromDate = parseDateStart(from);
  const toDate = parseDateEnd(to);

  const where: Prisma.PaymentCorrectionRequestWhereInput = { schoolId, status };
  if (type) where.type = type;
  if (bursarId) where.requestedBy = bursarId;
  if (fromDate || toDate) {
    where.requestedAt = {};
    if (fromDate) where.requestedAt.gte = fromDate;
    if (toDate) where.requestedAt.lte = toDate;
  }
  if (search) {
    where.OR = [
      { reason: { contains: search, mode: "insensitive" } },
      { proposedChange: { contains: search, mode: "insensitive" } },
      { evidenceRef: { contains: search, mode: "insensitive" } },
      { originalPayment: { receiptNumber: { contains: search, mode: "insensitive" } } },
      { originalPayment: { paidBy: { contains: search, mode: "insensitive" } } },
      { originalPayment: { studentBill: { student: { name: { contains: search, mode: "insensitive" } } } } },
      { originalPayment: { studentBill: { student: { surname: { contains: search, mode: "insensitive" } } } } },
    ];
  }

  const [corrections, count, statusCounts, bursars] = await Promise.all([
    prisma.paymentCorrectionRequest.findMany({
      where,
      include: {
        originalPayment: {
          include: {
            studentBill: {
              include: {
                student: { select: { id: true, name: true, surname: true, class: { select: { name: true } } } },
                feeStructure: { select: { title: true, term: true, academicYear: true } },
              },
            },
            reversal: { select: { id: true, reason: true, reversedAt: true } },
          },
        },
        correctedPayment: { select: { id: true, receiptNumber: true, status: true, studentBillId: true } },
      },
      orderBy: [{ requestedAt: "desc" }, { id: "desc" }],
      take: ITEM_PER_PAGE,
      skip: ITEM_PER_PAGE * (page - 1),
    }),
    prisma.paymentCorrectionRequest.count({ where }),
    prisma.paymentCorrectionRequest.groupBy({
      by: ["status"],
      where: { schoolId },
      _count: { _all: true },
    }),
    prisma.bursar.findMany({
      where: { schoolId },
      select: { id: true, name: true, surname: true, username: true },
      orderBy: [{ surname: "asc" }, { name: "asc" }],
    }),
  ]);

  const statusTotal = (item: PaymentCorrectionStatus) => statusCounts.find((row) => row.status === item)?._count._all ?? 0;
  const bursarNames = new Map(
    bursars.map((bursar) => [
      bursar.id,
      `${bursar.name ?? ""} ${bursar.surname ?? ""}`.trim() || bursar.username || "Bursar",
    ]),
  );

  return (
    <main className="space-y-5 p-3 sm:p-5 lg:p-6">
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-blue-700">
              <FileWarning size={18} />
              Finance control
            </div>
            <h1 className="text-2xl font-black tracking-tight text-slate-950">Payment correction queue</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Review money mistakes without deleting receipts. Parents are only notified after an approved correction is applied, and every receipt remains traceable.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:w-[520px]">
            {STATUSES.slice(0, 4).map((item) => (
              <div key={item} className={`rounded-xl border px-3 py-2 ${STATUS_META[item].tone}`}>
                <p className="text-lg font-black">{statusTotal(item)}</p>
                <p className="text-[10px] font-black uppercase tracking-wide">{STATUS_META[item].label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-3 flex items-center gap-2 text-sm font-black text-slate-800">
          <Filter size={16} /> Review filters
        </div>
        <form className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-8" action="/list/finance/corrections">
          <label className="relative block md:col-span-2 xl:col-span-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
            <input
              name="search"
              defaultValue={search ?? ""}
              placeholder="Search receipt, student, payer, reason"
              className="h-11 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-3 text-sm font-semibold outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </label>
          <select name="status" defaultValue={status} className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100">
            {STATUSES.map((item) => <option key={item} value={item}>{STATUS_META[item].label}</option>)}
          </select>
          <select name="type" defaultValue={type ?? ""} className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100">
            <option value="">All correction types</option>
            {TYPES.map((item) => <option key={item} value={item}>{TYPE_LABELS[item]}</option>)}
          </select>
          <select name="bursarId" defaultValue={bursarId ?? ""} className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100">
            <option value="">All bursars</option>
            {bursars.map((bursar) => <option key={bursar.id} value={bursar.id}>{bursarNames.get(bursar.id)}</option>)}
          </select>
          <input type="date" name="from" defaultValue={from ?? ""} className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
          <input type="date" name="to" defaultValue={to ?? ""} className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
          <div className="grid grid-cols-2 gap-2">
            <button className="h-11 rounded-lg bg-blue-700 px-4 text-sm font-black text-white transition hover:bg-blue-800">Apply</button>
            <Link href="/list/finance/corrections" className="flex h-11 items-center justify-center rounded-lg bg-slate-100 px-4 text-sm font-black text-slate-600 transition hover:bg-slate-200">Clear</Link>
          </div>
        </form>
      </section>

      <section className="space-y-3">
        {corrections.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <ReceiptText className="mx-auto mb-3 text-slate-300" size={34} />
            <p className="text-sm font-black text-slate-800">No correction requests found</p>
            <p className="mt-1 text-sm text-slate-500">Change the filters or wait for bursars to submit correction requests.</p>
          </div>
        ) : corrections.map((item) => {
          const payment = item.originalPayment;
          const bill = payment.studentBill;
          const student = bill.student;
          const meta = STATUS_META[item.status];
          const canReview = role === "admin" && item.status === "PENDING_REVIEW";
          const canApply = role === "admin" && item.status === "APPROVED";
          const needsCorrectedPayment = ["REPLACE_PAYMENT", "MOVE_PAYMENT", "FIX_REFERENCE_OR_METHOD"].includes(item.requestedAction);
          const sourceMismatch = item.studentBillId !== payment.studentBillId || payment.schoolId !== schoolId || bill.schoolId !== schoolId;
          const requestBursar = bursarNames.get(item.requestedBy) ?? "Unknown bursar";
          const riskWarnings = [
            sourceMismatch ? "Source records do not line up. Do not approve until finance records are checked." : null,
            payment.status !== "CONFIRMED" ? "Original payment is no longer confirmed. This request cannot safely be approved or applied." : null,
            payment.reversal ? "Original receipt is already voided. Reject this request and review the reversal history." : null,
            item.requestedAction === "MOVE_PAYMENT" ? "Moving payment can notify a different family only after the correction is applied." : null,
            item.requestedAction === "REPLACE_PAYMENT" ? "Replacement creates a new official receipt and voids the original." : null,
            item.requestedAction === "CANCEL_RECEIPT" || item.requestedAction === "REVERSE_PAYMENT" || item.requestedAction === "MARK_DUPLICATE" ? "This action voids the receipt and restores the bill balance." : null,
            item.status === "APPLIED" ? "Applied corrections are final history. Do not create manual edits around this record." : null,
          ].filter(Boolean) as string[];

          return (
            <article key={item.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <div className="flex flex-col gap-4 2xl:flex-row 2xl:items-start 2xl:justify-between">
                <div className="min-w-0 flex-1 space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-black ${meta.tone}`}>
                      {statusIcon(item.status)} {meta.label}
                    </span>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-700">{TYPE_LABELS[item.type]}</span>
                    <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-black text-blue-700">{ACTION_LABELS[item.requestedAction] ?? item.requestedAction}</span>
                    {sourceMismatch && <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-1 text-xs font-black text-rose-700"><AlertTriangle size={14} /> Source mismatch</span>}
                  </div>

                  <div>
                    <h2 className="break-words text-lg font-black text-slate-950 sm:text-xl">{payment.receiptNumber} · {student.name} {student.surname}</h2>
                    <p className="mt-1 text-sm font-semibold text-slate-600">Requested by {requestBursar} · {formatDateTime(item.requestedAt)}</p>
                  </div>

                  <div className="grid gap-3 lg:grid-cols-3">
                    <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                      <p className="flex items-center gap-1 text-xs font-black uppercase tracking-wide text-slate-500"><ReceiptText size={13} /> Original payment</p>
                      <p className="mt-2 text-sm font-black text-slate-900">{formatGHS(payment.amount)}</p>
                      <p className="mt-1 text-xs font-semibold text-slate-600">{PAYMENT_METHOD_LABELS[payment.paymentMethod] ?? payment.paymentMethod} · paid by {payment.paidBy}</p>
                      <p className="mt-1 text-xs text-slate-500">Ref: {payment.referenceNo || "Not provided"}</p>
                      <p className="mt-1 text-xs text-slate-500">Paid: {formatDateTime(payment.paymentDate)}</p>
                    </div>
                    <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                      <p className="flex items-center gap-1 text-xs font-black uppercase tracking-wide text-slate-500"><UserRound size={13} /> Affected student / bill</p>
                      <p className="mt-2 text-sm font-black text-slate-900">{student.name} {student.surname}</p>
                      <p className="mt-1 text-xs font-semibold text-slate-600">{student.class?.name ?? "No class"} · Bill #{bill.id}</p>
                      <p className="mt-1 text-xs text-slate-500">{bill.feeStructure.title} · {TERM_LABELS[bill.feeStructure.term] ?? bill.feeStructure.term} · {bill.feeStructure.academicYear}</p>
                      <p className="mt-1 text-xs text-slate-500">Bill balance: {formatGHS(bill.balance)}</p>
                    </div>
                    <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-3">
                      <p className="flex items-center gap-1 text-xs font-black uppercase tracking-wide text-blue-700"><ShieldAlert size={13} /> Requested correction</p>
                      <p className="mt-2 text-sm font-black text-blue-950">{ACTION_LABELS[item.requestedAction] ?? item.requestedAction}</p>
                      <p className="mt-1 text-xs font-semibold text-blue-800">{item.reason}</p>
                      <p className="mt-1 text-xs text-blue-700">{item.proposedChange || "No extra change note provided."}</p>
                      {item.evidenceRef && <p className="mt-1 break-words text-xs text-blue-700">Evidence: {item.evidenceRef}</p>}
                    </div>
                  </div>

                  <div className="rounded-xl border border-amber-100 bg-amber-50 p-3">
                    <p className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-amber-800"><AlertTriangle size={14} /> Risk check</p>
                    <ul className="mt-2 space-y-1 text-xs font-semibold text-amber-800">
                      {riskWarnings.length > 0 ? riskWarnings.map((warning) => <li key={warning}>- {warning}</li>) : <li>- No blocking risk detected by Edujay. Admin note is still required before approval or rejection.</li>}
                    </ul>
                  </div>

                  <div className="flex flex-wrap gap-2 text-xs">
                    <Link href={`/list/finance/receipts?search=${encodeURIComponent(payment.receiptNumber)}`} className="rounded-lg border border-slate-200 px-3 py-2 font-black text-slate-700 hover:bg-slate-50">View receipt</Link>
                    <Link href={`/list/finance/bills/${bill.id}`} className="rounded-lg border border-slate-200 px-3 py-2 font-black text-slate-700 hover:bg-slate-50">View bill</Link>
                    {item.correctedPayment && <Link href={`/list/finance/receipts?search=${encodeURIComponent(item.correctedPayment.receiptNumber)}`} className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 font-black text-emerald-700 hover:bg-emerald-100">Corrected receipt</Link>}
                  </div>
                </div>

                {canReview ? (
                  <form action={reviewCorrectionForm} className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 2xl:w-[430px]">
                    <input type="hidden" name="correctionId" value={item.id} />
                    <p className="text-sm font-black text-slate-900">Admin review</p>
                    <p className="mt-1 text-xs font-semibold leading-5 text-slate-600">Approve only when the original receipt, affected bill, and requested action all make sense. Parents are not notified at this stage.</p>
                    <label className="mt-3 block text-xs font-black uppercase text-slate-500" htmlFor={`review-note-${item.id}`}>Admin note</label>
                    <textarea id={`review-note-${item.id}`} name="reviewNote" minLength={10} maxLength={1000} required rows={4} placeholder="Explain why this request is approved or rejected." className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      <button name="decision" value="APPROVE" className="rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-black text-white hover:bg-blue-800">Approve</button>
                      <button name="decision" value="REJECT" className="rounded-lg border border-rose-200 bg-white px-4 py-2.5 text-sm font-black text-rose-700 hover:bg-rose-50">Reject</button>
                    </div>
                  </form>
                ) : canApply ? (
                  <form action={applyCorrectionForm} className="w-full rounded-xl border border-blue-100 bg-blue-50/60 p-3 2xl:w-[430px]">
                    <input type="hidden" name="correctionId" value={item.id} />
                    <p className="text-sm font-black text-blue-950">Apply approved correction</p>
                    <p className="mt-1 text-xs font-semibold leading-5 text-blue-800">This voids the original receipt and {needsCorrectedPayment ? "creates a corrected receipt." : "keeps the receipt cancelled/voided."} Parents are notified only after this step succeeds.</p>

                    <label className="mt-3 block text-xs font-black uppercase text-slate-500" htmlFor={`application-note-${item.id}`}>Application note</label>
                    <textarea id={`application-note-${item.id}`} name="applicationNote" minLength={10} maxLength={1000} required rows={3} placeholder="State exactly what is being applied." className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />

                    {item.requestedAction === "REPLACE_PAYMENT" && (
                      <label className="mt-3 block text-xs font-black uppercase text-slate-500">Corrected amount
                        <input name="correctedAmount" type="number" min="0.01" step="0.01" required className="mt-2 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
                      </label>
                    )}

                    {item.requestedAction === "MOVE_PAYMENT" && (
                      <label className="mt-3 block text-xs font-black uppercase text-slate-500">Target bill ID
                        <input name="targetStudentBillId" type="number" min="1" required placeholder="Bill ID receiving this payment" className="mt-2 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
                      </label>
                    )}

                    {item.requestedAction === "FIX_REFERENCE_OR_METHOD" && (
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        <label className="block text-xs font-black uppercase text-slate-500">Method
                          <select name="paymentMethod" defaultValue={payment.paymentMethod} className="mt-2 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100">
                            {PAYMENT_METHODS.map((method) => <option key={method} value={method}>{PAYMENT_METHOD_LABELS[method] ?? method}</option>)}
                          </select>
                        </label>
                        <label className="block text-xs font-black uppercase text-slate-500">Reference
                          <input name="referenceNo" defaultValue={payment.referenceNo ?? ""} className="mt-2 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
                        </label>
                      </div>
                    )}

                    {needsCorrectedPayment && (
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        <label className="block text-xs font-black uppercase text-slate-500">Paid by
                          <input name="paidBy" defaultValue={payment.paidBy} className="mt-2 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
                        </label>
                        <label className="block text-xs font-black uppercase text-slate-500">Payment date
                          <input name="paymentDate" type="date" defaultValue={payment.paymentDate.toISOString().slice(0, 10)} className="mt-2 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
                        </label>
                      </div>
                    )}

                    <button className="mt-3 w-full rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-black text-white hover:bg-blue-800">Apply correction</button>
                  </form>
                ) : (
                  <div className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600 2xl:w-[380px]">
                    <p className="font-black text-slate-800">Review status</p>
                    <p className="mt-1 text-sm">{item.reviewNote || "No admin review note yet."}</p>
                    {item.reviewedAt && <p className="mt-2 text-xs font-semibold text-slate-500">Reviewed {formatDateTime(item.reviewedAt)}</p>}
                    {item.appliedAt && <p className="mt-2 text-xs font-semibold text-slate-500">Applied {formatDateTime(item.appliedAt)}</p>}
                    {item.correctedPayment && <p className="mt-2 text-xs font-black text-emerald-700">Corrected receipt: {item.correctedPayment.receiptNumber}</p>}
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </section>

      <Pagination page={page} count={count} />
    </main>
  );
}