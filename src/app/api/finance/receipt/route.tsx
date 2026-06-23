// src/app/api/finance/receipt/route.tsx



import { NextRequest, NextResponse } from "next/server";
import { getAuthzContext } from "@/src/lib/authz";
import prisma from "@/src/lib/prisma";
import {
  formatGHS,
  PAYMENT_METHOD_LABELS,
  FEE_CATEGORY_LABELS,
} from "@/src/lib/constants/finance";
import { enforceRateLimit } from "@/src/lib/rate-limit";
import { receiptPdfQuerySchema } from "@/src/lib/validation/finance";
import { parseSearchParams } from "@/src/lib/validation/parse";
import { documentTag } from "@/src/lib/cacheTags";
import { getCachedDocument } from "@/src/lib/services/document-cache";
import {
  renderToBuffer,
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";
import React from "react";

// ─── Styles ───────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 9,
    paddingTop: 36,
    paddingBottom: 36,
    paddingLeft: 40,
    paddingRight: 40,
    backgroundColor: "#ffffff",
    color: "#1f2937",
  },

  // Header
  header: {
    backgroundColor: "#1e1b4b",
    borderRadius: 8,
    padding: 20,
    marginBottom: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerLeft: { flex: 1 },
  headerTag: {
    fontSize: 7,
    color: "#a5b4fc",
    letterSpacing: 2,
    marginBottom: 4,
  },
  headerTitle: { fontSize: 18, fontFamily: "Helvetica-Bold", color: "#ffffff" },
  headerSub: { fontSize: 8, color: "#c7d2fe", marginTop: 3 },
  receiptBadge: { alignItems: "flex-end" },
  receiptLabel: { fontSize: 7, color: "#a5b4fc", letterSpacing: 1.5 },
  receiptNumber: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    color: "#ffffff",
    marginTop: 3,
  },
  receiptDate: { fontSize: 7, color: "#c7d2fe", marginTop: 2 },

  // Status pill
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
  },
  statusPill: { borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 },
  statusText: { fontSize: 8, fontFamily: "Helvetica-Bold" },
  paidPill: { backgroundColor: "#d1fae5" },
  partialPill: { backgroundColor: "#fef3c7" },
  unpaidPill: { backgroundColor: "#fee2e2" },

  // Info grid
  infoRow: { flexDirection: "row", gap: 10, marginBottom: 16 },
  infoBox: {
    flex: 1,
    backgroundColor: "#f9fafb",
    borderRadius: 6,
    padding: 10,
    borderWidth: 1,
    borderColor: "#f3f4f6",
    borderStyle: "solid",
  },
  infoLbl: {
    fontSize: 6.5,
    color: "#9ca3af",
    letterSpacing: 1.5,
    marginBottom: 3,
  },
  infoVal: { fontSize: 9, fontFamily: "Helvetica-Bold", color: "#111827" },
  infoSub: { fontSize: 7.5, color: "#6b7280", marginTop: 1 },

  // Payment highlight box
  paymentBox: {
    backgroundColor: "#f0fdf4",
    borderRadius: 8,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#bbf7d0",
    borderStyle: "solid",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  paymentLbl: { fontSize: 8, color: "#166534", fontFamily: "Helvetica-Bold" },
  paymentMethod: { fontSize: 7, color: "#16a34a", marginTop: 2 },
  paymentRef: { fontSize: 7, color: "#16a34a", marginTop: 1 },
  paymentAmt: { fontSize: 22, fontFamily: "Helvetica-Bold", color: "#15803d" },

  // Section heading
  sectionHd: {
    fontSize: 7,
    color: "#9ca3af",
    letterSpacing: 2,
    marginBottom: 6,
    fontFamily: "Helvetica-Bold",
  },

  // Line items table
  table: { marginBottom: 14 },
  tHead: {
    flexDirection: "row",
    backgroundColor: "#f9fafb",
    borderRadius: 4,
    paddingVertical: 5,
    paddingHorizontal: 6,
  },
  tRow: {
    flexDirection: "row",
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: "#f3f4f6",
    borderBottomStyle: "solid",
  },
  tRowAlt: {
    flexDirection: "row",
    paddingVertical: 4,
    paddingHorizontal: 6,
    backgroundColor: "#fafafa",
    borderBottomWidth: 0.5,
    borderBottomColor: "#f3f4f6",
    borderBottomStyle: "solid",
  },
  tFoot: {
    flexDirection: "row",
    backgroundColor: "#ede9fe",
    paddingVertical: 6,
    paddingHorizontal: 6,
    borderRadius: 4,
    marginTop: 2,
  },
  cName: { flex: 3, fontSize: 8.5, color: "#111827" },
  cCat: { flex: 2, fontSize: 8, color: "#6b7280" },
  cAmt: { flex: 1.5, fontSize: 8.5, color: "#374151", textAlign: "right" },
  cPaid: { flex: 1.5, fontSize: 8.5, textAlign: "right" },
  cBal: { flex: 1.5, fontSize: 8.5, textAlign: "right" },
  thTxt: {
    fontSize: 7,
    color: "#6b7280",
    fontFamily: "Helvetica-Bold",
    letterSpacing: 0.5,
  },

  // Bill summary
  summaryBox: {
    backgroundColor: "#f9fafb",
    borderRadius: 6,
    padding: 12,
    borderWidth: 1,
    borderColor: "#f3f4f6",
    borderStyle: "solid",
    marginBottom: 14,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 3,
  },
  summaryLbl: { fontSize: 8.5, color: "#6b7280" },
  summaryVal: { fontSize: 8.5, color: "#111827", fontFamily: "Helvetica-Bold" },
  summaryTotal: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    borderTopStyle: "solid",
  },
  totalLbl: { fontSize: 10, color: "#111827", fontFamily: "Helvetica-Bold" },
  totalVal: { fontSize: 10, color: "#7c3aed", fontFamily: "Helvetica-Bold" },

  // Signatures
  sigRow: { flexDirection: "row", gap: 16, marginTop: 10, marginBottom: 14 },
  sigBox: { flex: 1, alignItems: "center" },
  sigLine: {
    borderBottomWidth: 1,
    borderBottomColor: "#d1d5db",
    borderBottomStyle: "dashed",
    width: "100%",
    marginBottom: 4,
  },
  sigLabel: {
    fontSize: 6.5,
    color: "#9ca3af",
    letterSpacing: 1.5,
    textAlign: "center",
  },

  // Footer
  footer: {
    borderTopWidth: 0.5,
    borderTopColor: "#f3f4f6",
    borderTopStyle: "solid",
    paddingTop: 8,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  footerText: { fontSize: 6.5, color: "#d1d5db" },

  // Thank you
  thankYou: {
    textAlign: "center",
    fontSize: 9,
    color: "#7c3aed",
    fontFamily: "Helvetica-Bold",
    marginBottom: 14,
  },
});

// ─── PDF Component ────────────────────────────────────────────────────────────
type LineItem = {
  name: string;
  category: string;
  amount: number;
  amountPaid: number;
  balance: number;
  isPaid: boolean;
};

type ReceiptPDFProps = {
  receiptNumber: string;
  paymentAmount: number;
  paymentMethod: string;
  paymentDate: string; // ← ISO string; avoids Date serialisation issues across the render boundary
  paidBy: string;
  referenceNo: string;
  notes: string;
  studentName: string;
  studentId: string;
  className: string;
  gradeLevel: string;
  parentName: string;
  billTotal: number;
  billPaid: number;
  billBalance: number;
  billStatus: string;
  feeStructure: string;
  term: string;
  academicYear: string;
  lineItems: LineItem[];
  recordedBy: string;
};

function ReceiptPDF(p: ReceiptPDFProps) {
  const TERM_LABELS: Record<string, string> = {
    TERM_1: "Term 1",
    TERM_2: "Term 2",
    TERM_3: "Term 3",
  };

  const statusColors: Record<string, { bg: string; text: string }> = {
    PAID: { bg: "#d1fae5", text: "#065f46" },
    PARTIAL: { bg: "#fef3c7", text: "#92400e" },
    UNPAID: { bg: "#fee2e2", text: "#991b1b" },
    OVERPAID: { bg: "#dbeafe", text: "#1e40af" },
    WAIVED: { bg: "#f3f4f6", text: "#374151" },
  };

  const sc = statusColors[p.billStatus] ?? statusColors.UNPAID;

  const STATUS_LABELS: Record<string, string> = {
    PAID: "FULLY PAID",
    PARTIAL: "PARTIALLY PAID",
    UNPAID: "UNPAID",
    OVERPAID: "OVERPAID",
    WAIVED: "WAIVED",
  };

  const formattedPaymentDate = new Date(p.paymentDate).toLocaleDateString(
    "en-GH",
    {
      day: "numeric",
      month: "long",
      year: "numeric",
    },
  );

  const formattedToday = new Date().toLocaleDateString("en-GH", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <Document title={`Receipt ${p.receiptNumber}`}>
      <Page size="A4" style={S.page}>
        {/* Header */}
        <View style={S.header}>
          <View style={S.headerLeft}>
            <Text style={S.headerTag}>OFFICIAL PAYMENT RECEIPT</Text>
            <Text style={S.headerTitle}>School Finance</Text>
            <Text style={S.headerSub}>
              Ghana Basic Education Management System
            </Text>
          </View>
          <View style={S.receiptBadge}>
            <Text style={S.receiptLabel}>RECEIPT NO.</Text>
            <Text style={S.receiptNumber}>{p.receiptNumber}</Text>
            <Text style={S.receiptDate}>{formattedPaymentDate}</Text>
          </View>
        </View>

        {/* Bill status pill */}
        <View style={S.statusRow}>
          <View style={[S.statusPill, { backgroundColor: sc.bg }]}>
            <Text style={[S.statusText, { color: sc.text }]}>
              {STATUS_LABELS[p.billStatus] ?? p.billStatus}
            </Text>
          </View>
          <Text style={{ fontSize: 8, color: "#9ca3af" }}>
            {p.feeStructure} · {TERM_LABELS[p.term] ?? p.term} {p.academicYear}
          </Text>
        </View>

        {/* Student + payment info */}
        <View style={S.infoRow}>
          <View style={S.infoBox}>
            <Text style={S.infoLbl}>STUDENT</Text>
            <Text style={S.infoVal}>{p.studentName}</Text>
            <Text style={S.infoSub}>
              {p.gradeLevel} · {p.className}
            </Text>
            <Text style={S.infoSub}>
              ID: {p.studentId.slice(0, 10).toUpperCase()}
            </Text>
          </View>
          <View style={S.infoBox}>
            <Text style={S.infoLbl}>PARENT / GUARDIAN</Text>
            <Text style={S.infoVal}>{p.parentName || "—"}</Text>
            <Text style={S.infoSub}>Paid by: {p.paidBy}</Text>
          </View>
          <View style={S.infoBox}>
            <Text style={S.infoLbl}>RECORDED BY</Text>
            <Text style={S.infoVal}>{p.recordedBy}</Text>
            <Text style={S.infoSub}>{formattedToday}</Text>
          </View>
        </View>

        {/* Payment highlight */}
        <View style={S.paymentBox}>
          <View>
            <Text style={S.paymentLbl}>Amount Received</Text>
            <Text style={S.paymentMethod}>
              {PAYMENT_METHOD_LABELS[p.paymentMethod] ?? p.paymentMethod}
            </Text>
            {p.referenceNo ? (
              <Text style={S.paymentRef}>Ref: {p.referenceNo}</Text>
            ) : null}
          </View>
          <Text style={S.paymentAmt}>{formatGHS(p.paymentAmount)}</Text>
        </View>

        {/* Fee breakdown table */}
        <Text style={S.sectionHd}>FEE BREAKDOWN</Text>
        <View style={S.table}>
          <View style={S.tHead}>
            <Text style={[S.cName, S.thTxt]}>FEE ITEM</Text>
            <Text style={[S.cCat, S.thTxt]}>CATEGORY</Text>
            <Text style={[S.cAmt, S.thTxt]}>AMOUNT</Text>
            <Text style={[S.cPaid, S.thTxt]}>PAID</Text>
            <Text style={[S.cBal, S.thTxt]}>BALANCE</Text>
          </View>
          {p.lineItems.map((item, i) => (
            <View key={i} style={i % 2 === 0 ? S.tRow : S.tRowAlt}>
              <Text style={S.cName}>{item.name}</Text>
              <Text style={S.cCat}>
                {FEE_CATEGORY_LABELS[item.category] ?? item.category}
              </Text>
              <Text style={S.cAmt}>{formatGHS(item.amount)}</Text>
              <Text
                style={[
                  S.cPaid,
                  {
                    color: item.isPaid ? "#059669" : "#374151",
                    fontFamily: item.isPaid ? "Helvetica-Bold" : "Helvetica",
                  },
                ]}
              >
                {formatGHS(item.amountPaid)}
              </Text>
              <Text
                style={[
                  S.cBal,
                  { color: item.balance > 0 ? "#dc2626" : "#059669" },
                ]}
              >
                {formatGHS(item.balance)}
              </Text>
            </View>
          ))}
          <View style={S.tFoot}>
            <Text
              style={[
                S.cName,
                { fontFamily: "Helvetica-Bold", color: "#1e1b4b" },
              ]}
            >
              TOTAL
            </Text>
            <Text style={S.cCat} />
            <Text
              style={[
                S.cAmt,
                { fontFamily: "Helvetica-Bold", color: "#1e1b4b" },
              ]}
            >
              {formatGHS(p.billTotal)}
            </Text>
            <Text
              style={[
                S.cPaid,
                { fontFamily: "Helvetica-Bold", color: "#059669" },
              ]}
            >
              {formatGHS(p.billPaid)}
            </Text>
            <Text
              style={[
                S.cBal,
                {
                  fontFamily: "Helvetica-Bold",
                  color: p.billBalance > 0 ? "#dc2626" : "#059669",
                },
              ]}
            >
              {formatGHS(p.billBalance)}
            </Text>
          </View>
        </View>

        {/* Bill summary box */}
        <View style={S.summaryBox}>
          <View style={S.summaryRow}>
            <Text style={S.summaryLbl}>Total Bill Amount</Text>
            <Text style={S.summaryVal}>{formatGHS(p.billTotal)}</Text>
          </View>
          <View style={S.summaryRow}>
            <Text style={S.summaryLbl}>This Payment</Text>
            <Text style={[S.summaryVal, { color: "#059669" }]}>
              {formatGHS(p.paymentAmount)}
            </Text>
          </View>
          <View style={S.summaryRow}>
            <Text style={S.summaryLbl}>Total Paid To Date</Text>
            <Text style={[S.summaryVal, { color: "#059669" }]}>
              {formatGHS(p.billPaid)}
            </Text>
          </View>
          {p.notes ? (
            <View style={S.summaryRow}>
              <Text style={S.summaryLbl}>Notes</Text>
              <Text style={[S.summaryVal, { color: "#6b7280" }]}>
                {p.notes}
              </Text>
            </View>
          ) : null}
          <View style={S.summaryTotal}>
            <Text style={S.totalLbl}>Outstanding Balance</Text>
            <Text
              style={[
                S.totalVal,
                { color: p.billBalance > 0 ? "#dc2626" : "#059669" },
              ]}
            >
              {formatGHS(p.billBalance)}
            </Text>
          </View>
        </View>

        {/* Thank you */}
        <Text style={S.thankYou}>
          {p.billBalance <= 0
            ? " Account fully settled. Thank you!"
            : `Thank you for your payment. Outstanding balance: ${formatGHS(p.billBalance)}`}
        </Text>

        {/* Signatures */}
        <Text style={S.sectionHd}>AUTHORISATION</Text>
        <View style={S.sigRow}>
          {["Received by (Bursar)", "Verified by", "Parent / Guardian"].map(
            (label) => (
              <View key={label} style={S.sigBox}>
                <View style={{ height: 28 }} />
                <View style={S.sigLine} />
                <Text style={S.sigLabel}>{label.toUpperCase()}</Text>
              </View>
            ),
          )}
        </View>

        {/* Footer */}
        <View style={S.footer}>
          <Text style={S.footerText}>
            Generated:{" "}
            {new Date().toLocaleDateString("en-GH", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </Text>
          <Text style={S.footerText}>
            {p.receiptNumber} · {p.studentName} ·{" "}
            {TERM_LABELS[p.term] ?? p.term} {p.academicYear}
          </Text>
        </View>
      </Page>
    </Document>
  );
}

// ─── Route handler ────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const ctx = await getAuthzContext();
    const role = ctx?.role;
    const userId = ctx?.userId;
    const schoolId = ctx?.schoolId;

    const allowed = ["admin", "bursar", "parent", "student"];
    if (!ctx || !userId || !schoolId || !allowed.includes(role ?? "")) {
      return new NextResponse("Unauthorized", { status: 401 });
    }
    const limited = await enforceRateLimit(req, {
      scope: "finance:receipt-pdf",
      actorId: userId,
      limit: 20,
      windowMs: 10 * 60_000,
    });
    if (limited) return limited;

    const parsed = parseSearchParams(receiptPdfQuerySchema, req.nextUrl.searchParams);
    if (!parsed.ok) return parsed.response;
    const { billId, receiptNumber } = parsed.data;

    // Load bill with all relations
    const bill = await prisma.studentBill.findFirst({
      where: { id: billId, schoolId },
      include: {
        student: {
          select: {
            id: true,
            name: true,
            surname: true,
            parentId: true, // ← required for parent auth check
            class: { select: { name: true } },
            grade: { select: { level: true } },
            parent: { select: { name: true, surname: true } },
          },
        },
        feeStructure: {
          select: { title: true, term: true, academicYear: true },
        },
        lineItems: {
          include: { feeItem: { select: { name: true, category: true } } },
          orderBy: { createdAt: "asc" },
        },
        payments: {
          where: { schoolId, receiptNumber },
          include: { reversal: true },
        },
      },
    });

    if (!bill) return new NextResponse("Bill not found", { status: 404 });

    const payment = bill.payments[0];
    if (!payment) return new NextResponse("Payment not found", { status: 404 });

    if (payment.status === "REVERSED") {
      return new NextResponse(
        "This payment has been reversed and the receipt is void.",
        { status: 410 },
      );
    }

    // Auth: parents can only view their own child's receipt
    if (role === "parent" && bill.student.parentId !== userId) {
      return new NextResponse("Forbidden", { status: 403 });
    }
    if (role === "student" && bill.student.id !== userId) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    // Load who recorded the payment (bursar/admin username)
    let recordedByName = "Bursar";
    try {
      const admin = await prisma.admin.findFirst({
        where: { id: payment.recordedBy, schoolId },
        select: { username: true },
      });
      if (admin) recordedByName = admin.username;
    } catch {
      // recordedBy may not correspond to an Admin row — silently fall back
    }

    const pdfBuffer = await getCachedDocument({
      keyParts: [ctx.schoolId, "receipt", payment.id],
      tags: [
        documentTag(ctx.schoolId, "receipt"),
        documentTag(ctx.schoolId, "receipt", payment.id),
      ],
      generate: () => renderToBuffer(
      <ReceiptPDF
        receiptNumber={payment.receiptNumber}
        paymentAmount={Number(payment.amount)}
        paymentMethod={payment.paymentMethod}
        paymentDate={payment.paymentDate.toISOString()} // ← Date → ISO string
        paidBy={payment.paidBy}
        referenceNo={payment.referenceNo ?? ""}
        notes={payment.notes ?? ""}
        studentName={`${bill.student.surname} ${bill.student.name}`}
        studentId={bill.student.id}
        className={bill.student.class?.name ?? ""}
        gradeLevel={bill.student.grade?.level ?? ""}
        parentName={
          bill.student.parent
            ? `${bill.student.parent.name} ${bill.student.parent.surname}`
            : ""
        }
        billTotal={Number(bill.totalAmount)}
        billPaid={Number(bill.amountPaid)}
        billBalance={Number(bill.balance)}
        billStatus={bill.status}
        feeStructure={bill.feeStructure.title}
        term={bill.feeStructure.term}
        academicYear={bill.feeStructure.academicYear}
        lineItems={bill.lineItems.map((l) => ({
          name: l.feeItem.name,
          category: l.feeItem.category,
          amount: Number(l.amount),
          amountPaid: Number(l.amountPaid),
          balance: Number(l.balance),
          isPaid: l.isPaid,
        }))}
        recordedBy={recordedByName}
      />,
      ),
    });

    const filename =
      `receipt-${payment.receiptNumber}-${bill.student.surname}.pdf`
        .toLowerCase()
        .replace(/\s+/g, "-");

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`,
        "Content-Length": String(pdfBuffer.byteLength),
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[finance/receipt]", err);
    return new NextResponse(`Receipt generation failed: ${message}`, {
      status: 500,
    });
  }
}
