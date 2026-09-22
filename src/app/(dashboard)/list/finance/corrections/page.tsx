import { revalidatePath } from "next/cache";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileWarning,
  ReceiptText,
  Search,
  XCircle,
} from "lucide-react";
import Pagination from "@/src/components/pagination";
import { formatGHS, PAYMENT_METHOD_LABELS } from "@/src/lib/constants/finance";
import { requirePageSession } from "@/src/lib/authz";
import prisma from "@/src/lib/prisma";
import { ITEM_PER_PAGE } from "@/src/lib/settings";
import { applyPaymentCorrection, reviewPaymentCorrection } from "@/src/lib/actions/paymentCorrectionActions";
import type { PaymentCorrectionStatus } from "@/src/generated/prisma";
import { Prisma } from "@/src/generated/prisma";

export const dynamic = "force-dynamic";

const STATUSES = ["PENDING_REVIEW", "APPROVED", "REJECTED", "APPLIED", "CANCELLED"] as const;

const STATUS_META: Record<PaymentCorrectionStatus, { label: string; tone: string; icon: "clock" | "check" | "x" }> = {
  PENDING_REVIEW: { label: "Pending review", tone: "bg-amber-50 text-amber-700 border-amber-100", icon: "clock" },
  APPROVED: { label: "Approved", tone: "bg-blue-50 text-blue-700 border-blue-100", icon: "check" },
  REJECTED: { label: "Rejected", tone: "bg-rose-50 text-rose-700 border-rose-100", icon: "x" },
  APPLIED: { label: "Applied", tone: "bg-emerald-50 text-emerald-700 border-emerald-100", icon: "check" },
  CANCELLED: { label: "Cancelled", tone: "bg-gray-50 text-gray-600 border-gray-100", icon: "x" },
};

const TYPE_LABELS: Record<string, string> = {
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

  const correctionId = Number(formData.get("correctionId"));
  const decision = String(formData.get("decision"));
  const reviewNote = String(formData.get("reviewNote") ?? "");

  await reviewPaymentCorrection({
    correctionId,
    decision: decision === "APPROVE" ? "APPROVE" : "REJECT",
    reviewNote,
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
  const search = sp.search?.trim();

  const where: Prisma.PaymentCorrectionRequestWhereInput = { schoolId, status };
  if (search) {
    where.OR = [
      { reason: { contains: search, mode: "insensitive" } },
      { proposedChange: { contains: search, mode: "insensitive" } },
      { originalPayment: { receiptNumber: { contains: search, mode: "insensitive" } } },
      { originalPayment: { paidBy: { contains: search, mode: "insensitive" } } },
      { originalPayment: { studentBill: { student: { name: { contains: search, mode: "insensitive" } } } } },
      { originalPayment: { studentBill: { student: { surname: { contains: search, mode: "insensitive" } } } } },
    ];
  }

  const [corrections, count, pendingCount] = await Promise.all([
    prisma.paymentCorrectionRequest.findMany({
      where,
      include: {
        originalPayment: {
          include: {
            studentBill: {
              include: {
                student: { select: { name: true, surname: true, class: { select: { name: true } } } },
                feeStructure: { select: { title: true, term: true, academicYear: true } },
              },
            },
            reversal: { select: { id: true, reason: true, reversedAt: true } },
          },
        },
        correctedPayment: { select: { id: true, receiptNumber: true, status: true } },
      },
      orderBy: [{ requestedAt: "desc" }, { id: "desc" }],
      take: ITEM_PER_PAGE,
      skip: ITEM_PER_PAGE * (page - 1),
    }),
    prisma.paymentCorrectionRequest.count({ where }),
    prisma.paymentCorrectionRequest.count({ where: { schoolId, status: "PENDING_REVIEW" } }),
  ]);

  return (
    <main className="space-y-5 p-4 sm:p-5 lg:p-6">
      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-blue-700">
              <FileWarning size={18} />
              Finance control
            </div>
            <h1 className="text-2xl font-semibold text-slate-950">Payment correction queue</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Review money mistakes without deleting receipts. The original payment stays in history, the affected bill remains traceable, and approved corrections are applied in the next controlled step.
            </p>
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <span className="font-semibold">{pendingCount}</span> pending correction{pendingCount === 1 ? "" : "s"}
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <form className="grid gap-3 lg:grid-cols-[1fr_220px_auto]" action="/list/finance/corrections">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
            <input
              name="search"
              defaultValue={search ?? ""}
              placeholder="Search receipt, student, payer, reason"
              className="h-11 w-full rounded-md border border-slate-200 bg-white pl-10 pr-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </label>
          <select
            name="status"
            defaultValue={status}
            className="h-11 rounded-md border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          >
            {STATUSES.map((item) => (
              <option key={item} value={item}>{STATUS_META[item].label}</option>
            ))}
          </select>
          <button className="h-11 rounded-md bg-blue-700 px-5 text-sm font-semibold text-white transition hover:bg-blue-800">
            Apply
          </button>
        </form>
      </section>

      <section className="space-y-3">
        {corrections.length === 0 ? (
          <div className="rounded-lg border border-slate-200 bg-white p-8 text-center shadow-sm">
            <ReceiptText className="mx-auto mb-3 text-slate-300" size={34} />
            <p className="text-sm font-semibold text-slate-800">No correction requests found</p>
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
          const sourceMismatch = item.studentBillId !== payment.studentBillId || payment.schoolId !== schoolId;

          return (
            <article key={item.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div className="min-w-0 flex-1 space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${meta.tone}`}>
                      {statusIcon(item.status)}
                      {meta.label}
                    </span>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                      {TYPE_LABELS[item.type] ?? item.type}
                    </span>
                    <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                      {ACTION_LABELS[item.requestedAction] ?? item.requestedAction}
                    </span>
                    {sourceMismatch && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700">
                        <AlertTriangle size={14} /> Source mismatch
                      </span>
                    )}
                  </div>

                  <div>
                    <h2 className="text-lg font-semibold text-slate-950">
                      {payment.receiptNumber} · {student.name} {student.surname}
                    </h2>
                    <p className="mt-1 text-sm text-slate-600">
                      {student.class?.name ?? "No class"} · {formatGHS(payment.amount)} · {PAYMENT_METHOD_LABELS[payment.paymentMethod] ?? payment.paymentMethod} · paid by {payment.paidBy}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Requested {formatDateTime(item.requestedAt)} · Bill #{bill.id} · {bill.feeStructure.title} · {bill.feeStructure.academicYear}
                    </p>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-md bg-slate-50 p-3">
                      <p className="text-xs font-semibold uppercase text-slate-500">Reason</p>
                      <p className="mt-1 text-sm text-slate-800">{item.reason}</p>
                    </div>
                    <div className="rounded-md bg-slate-50 p-3">
                      <p className="text-xs font-semibold uppercase text-slate-500">Proposed change</p>
                      <p className="mt-1 text-sm text-slate-800">{item.proposedChange || "No extra change note provided."}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 text-xs">
                    <Link href={`/list/finance/receipts?search=${encodeURIComponent(payment.receiptNumber)}`} className="rounded-md border border-slate-200 px-3 py-2 font-semibold text-slate-700 hover:bg-slate-50">
                      View receipt
                    </Link>
                    <Link href={`/list/finance/bills/${bill.id}`} className="rounded-md border border-slate-200 px-3 py-2 font-semibold text-slate-700 hover:bg-slate-50">
                      View bill
                    </Link>
                  </div>
                </div>

                {canReview ? (
                  <form action={reviewCorrectionForm} className="w-full max-w-xl rounded-lg border border-slate-200 bg-slate-50 p-3 xl:w-[420px]">
                    <input type="hidden" name="correctionId" value={item.id} />
                    <label className="block text-xs font-semibold uppercase text-slate-500" htmlFor={`review-note-${item.id}`}>
                      Review note
                    </label>
                    <textarea
                      id={`review-note-${item.id}`}
                      name="reviewNote"
                      minLength={10}
                      maxLength={1000}
                      required
                      rows={4}
                      placeholder="Explain why this request is approved or rejected."
                      className="mt-2 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      <button name="decision" value="APPROVE" className="rounded-md bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800">
                        Approve
                      </button>
                      <button name="decision" value="REJECT" className="rounded-md border border-rose-200 bg-white px-4 py-2.5 text-sm font-semibold text-rose-700 hover:bg-rose-50">
                        Reject
                      </button>
                    </div>
                  </form>
                ) : canApply ? (
                  <form action={applyCorrectionForm} className="w-full max-w-xl rounded-lg border border-blue-100 bg-blue-50/60 p-3 xl:w-[420px]">
                    <input type="hidden" name="correctionId" value={item.id} />
                    <p className="text-sm font-semibold text-blue-950">Apply approved correction</p>
                    <p className="mt-1 text-xs leading-5 text-blue-800">
                      This will void the original receipt and {needsCorrectedPayment ? "create a corrected receipt." : "keep the receipt cancelled/reversed."}
                    </p>

                    <label className="mt-3 block text-xs font-semibold uppercase text-slate-500" htmlFor={`application-note-${item.id}`}>
                      Application note
                    </label>
                    <textarea
                      id={`application-note-${item.id}`}
                      name="applicationNote"
                      minLength={10}
                      maxLength={1000}
                      required
                      rows={3}
                      placeholder="State exactly what is being applied."
                      className="mt-2 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />

                    {item.requestedAction === "REPLACE_PAYMENT" && (
                      <label className="mt-3 block text-xs font-semibold uppercase text-slate-500">
                        Corrected amount
                        <input
                          name="correctedAmount"
                          type="number"
                          min="0.01"
                          step="0.01"
                          required
                          className="mt-2 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        />
                      </label>
                    )}

                    {item.requestedAction === "MOVE_PAYMENT" && (
                      <label className="mt-3 block text-xs font-semibold uppercase text-slate-500">
                        Target bill ID
                        <input
                          name="targetStudentBillId"
                          type="number"
                          min="1"
                          required
                          placeholder="Enter the bill ID receiving this payment"
                          className="mt-2 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        />
                      </label>
                    )}

                    {item.requestedAction === "FIX_REFERENCE_OR_METHOD" && (
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        <label className="block text-xs font-semibold uppercase text-slate-500">
                          Method
                          <select name="paymentMethod" defaultValue={payment.paymentMethod} className="mt-2 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100">
                            {PAYMENT_METHODS.map((method) => (
                              <option key={method} value={method}>{PAYMENT_METHOD_LABELS[method] ?? method}</option>
                            ))}
                          </select>
                        </label>
                        <label className="block text-xs font-semibold uppercase text-slate-500">
                          Reference
                          <input
                            name="referenceNo"
                            defaultValue={payment.referenceNo ?? ""}
                            className="mt-2 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                          />
                        </label>
                      </div>
                    )}

                    {needsCorrectedPayment && (
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        <label className="block text-xs font-semibold uppercase text-slate-500">
                          Paid by
                          <input
                            name="paidBy"
                            defaultValue={payment.paidBy}
                            className="mt-2 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                          />
                        </label>
                        <label className="block text-xs font-semibold uppercase text-slate-500">
                          Payment date
                          <input
                            name="paymentDate"
                            type="date"
                            defaultValue={payment.paymentDate.toISOString().slice(0, 10)}
                            className="mt-2 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                          />
                        </label>
                      </div>
                    )}

                    <button className="mt-3 w-full rounded-md bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800">
                      Apply correction
                    </button>
                  </form>
                ) : (
                  <div className="w-full rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600 xl:w-[360px]">
                    <p className="font-semibold text-slate-800">Review status</p>
                    <p className="mt-1">{item.reviewNote || "No admin review note yet."}</p>
                    {item.reviewedAt && <p className="mt-2 text-xs text-slate-500">Reviewed {formatDateTime(item.reviewedAt)}</p>}
                    {item.appliedAt && <p className="mt-2 text-xs text-slate-500">Applied {formatDateTime(item.appliedAt)}</p>}
                    {item.correctedPayment && <p className="mt-2 text-xs font-semibold text-slate-700">Corrected receipt: {item.correctedPayment.receiptNumber}</p>}
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