// src/app/api/finance/reports/daily/route.tsx

import { NextRequest, NextResponse } from "next/server";
import { getAuthzContext } from "@/src/lib/authz";
import prisma from "@/src/lib/prisma";
import { formatGHS, PAYMENT_METHOD_LABELS } from "@/src/lib/constants/finance";
import { enforceRateLimit } from "@/src/lib/rate-limit";
import { dailyFinanceReportQuerySchema } from "@/src/lib/validation/finance";
import { parseSearchParams } from "@/src/lib/validation/parse";
import { documentTag } from "@/src/lib/cacheTags";
import { getCachedDocument } from "@/src/lib/services/document-cache";
import { getSchoolBranding } from "@/src/lib/services/school-branding";
import { getDailyFinanceReport } from "@/src/lib/services/daily-finance-report";
import { getBursarArrearsFollowUp } from "@/src/lib/services/bursar-arrears";
import { getClassCollectionReport } from "@/src/lib/services/class-collection-report";
import { getReceiptIntegrityReport } from "@/src/lib/services/receipt-integrity-report";
import { getCorrectionReversalReport } from "@/src/lib/services/correction-reversal-report";
import {
  renderToBuffer, Document, Page, Text, View, StyleSheet,
} from "@react-pdf/renderer";
import React from "react";

const S = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 8.5,
    paddingTop: 28,
    paddingBottom: 28,
    paddingLeft: 32,
    paddingRight: 32,
    backgroundColor: "#ffffff",
    color: "#111827",
  },
  header: {
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerKicker: { fontSize: 7, color: "#dbeafe", letterSpacing: 1.5, marginBottom: 4, fontFamily: "Helvetica-Bold" },
  headerTitle: { fontSize: 16, fontFamily: "Helvetica-Bold", color: "#ffffff" },
  headerSub: { fontSize: 8, color: "#e0e7ff", marginTop: 4, maxWidth: 320 },
  headerRight: { alignItems: "flex-end" },
  headerDate: { fontSize: 11, fontFamily: "Helvetica-Bold", color: "#ffffff" },
  headerTag: { fontSize: 7, color: "#c7d2fe", marginTop: 4 },

  band: { borderWidth: 1, borderColor: "#e5e7eb", borderStyle: "solid", borderRadius: 8, padding: 10, marginBottom: 10 },
  bandTitle: { fontSize: 9, fontFamily: "Helvetica-Bold", color: "#111827", marginBottom: 6 },
  bandNote: { fontSize: 7.2, color: "#6b7280", lineHeight: 1.35 },

  statGrid: { flexDirection: "row", gap: 8, marginBottom: 10 },
  statBox: { flex: 1, borderWidth: 1, borderStyle: "solid", borderColor: "#e5e7eb", borderRadius: 7, padding: 8, minHeight: 54 },
  statLabel: { fontSize: 6.2, color: "#6b7280", letterSpacing: 1, fontFamily: "Helvetica-Bold", marginBottom: 4 },
  statValue: { fontSize: 12, fontFamily: "Helvetica-Bold", color: "#111827" },
  statSub: { fontSize: 6.7, color: "#6b7280", marginTop: 3, lineHeight: 1.25 },

  section: { marginTop: 7, marginBottom: 9 },
  sectionTitle: { fontSize: 9, color: "#111827", fontFamily: "Helvetica-Bold", marginBottom: 5 },
  sectionKicker: { fontSize: 6.2, color: "#9ca3af", letterSpacing: 1.3, fontFamily: "Helvetica-Bold", marginBottom: 3 },

  row: { flexDirection: "row" },
  col: { flex: 1 },
  twoCol: { flexDirection: "row", gap: 10, marginBottom: 9 },

  table: { borderWidth: 1, borderColor: "#e5e7eb", borderStyle: "solid", borderRadius: 6, overflow: "hidden" },
  tHead: { flexDirection: "row", backgroundColor: "#f3f4f6", paddingVertical: 5, paddingHorizontal: 6 },
  tRow: { flexDirection: "row", paddingVertical: 5, paddingHorizontal: 6, borderTopWidth: 0.5, borderTopColor: "#e5e7eb", borderTopStyle: "solid" },
  tRowAlt: { flexDirection: "row", paddingVertical: 5, paddingHorizontal: 6, borderTopWidth: 0.5, borderTopColor: "#e5e7eb", borderTopStyle: "solid", backgroundColor: "#fafafa" },
  th: { fontSize: 6.4, color: "#4b5563", fontFamily: "Helvetica-Bold" },
  td: { fontSize: 7.3, color: "#111827" },
  tdMuted: { fontSize: 7, color: "#6b7280" },
  tdMoney: { fontSize: 7.3, color: "#047857", textAlign: "right", fontFamily: "Helvetica-Bold" },

  bullet: { flexDirection: "row", marginBottom: 4 },
  bulletDot: { width: 5, height: 5, borderRadius: 3, marginTop: 3, marginRight: 6, backgroundColor: "#111827" },
  bulletText: { flex: 1, fontSize: 7.5, color: "#374151", lineHeight: 1.35 },
  issueLine: { borderWidth: 1, borderColor: "#e5e7eb", borderStyle: "solid", borderRadius: 6, padding: 7, marginBottom: 5 },
  issueTitle: { fontSize: 7.5, color: "#111827", fontFamily: "Helvetica-Bold" },
  issueDetail: { fontSize: 7, color: "#6b7280", marginTop: 2, lineHeight: 1.25 },

  footer: { borderTopWidth: 0.5, borderTopColor: "#e5e7eb", borderTopStyle: "solid", paddingTop: 7, flexDirection: "row", justifyContent: "space-between", marginTop: 10 },
  footerText: { fontSize: 6.2, color: "#9ca3af" },
  sigRow: { flexDirection: "row", gap: 18, marginTop: 16 },
  sigBox: { flex: 1 },
  sigLine: { borderBottomWidth: 1, borderBottomColor: "#d1d5db", borderBottomStyle: "dashed", marginBottom: 4 },
  sigLabel: { fontSize: 6.4, color: "#6b7280", letterSpacing: 1, fontFamily: "Helvetica-Bold" },
});

function dateLabel(date: Date) {
  return date.toLocaleDateString("en-GH", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function deltaText(value: number, money = false) {
  if (value === 0) return "No change from yesterday";
  const direction = value > 0 ? "up" : "down";
  const display = money ? formatGHS(Math.abs(value)) : Math.abs(value).toLocaleString("en-GH");
  return `${display} ${direction} from yesterday`;
}

function pct(value: number) {
  return `${Math.round(value)}%`;
}

type PaymentRegisterRow = {
  id: number;
  receiptNumber: string;
  amount: unknown;
  paymentMethod: string;
  referenceNo: string | null;
  paidBy: string;
  studentBill: {
    student: { name: string; surname: string; class: { name: string } | null };
    feeStructure: { title: string; term: string; academicYear: string };
  };
};

function studentName(student: { name: string; surname: string }) {
  return `${student.name} ${student.surname}`.trim();
}

function SummaryBox({ label, value, sub, color = "#111827", borderColor = "#e5e7eb" }: {
  label: string;
  value: string;
  sub: string;
  color?: string;
  borderColor?: string;
}) {
  return (
    <View style={[S.statBox, { borderColor }]}>
      <Text style={S.statLabel}>{label.toUpperCase()}</Text>
      <Text style={[S.statValue, { color }]}>{value}</Text>
      <Text style={S.statSub}>{sub}</Text>
    </View>
  );
}

function EmptyText({ text }: { text: string }) {
  return <Text style={{ fontSize: 7.5, color: "#9ca3af", padding: 8 }}>{text}</Text>;
}

export async function GET(req: NextRequest) {
  try {
    const ctx = await getAuthzContext();
    if (!ctx || (ctx.role !== "admin" && ctx.role !== "bursar")) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const limited = await enforceRateLimit(req, {
      scope: "finance:daily-report",
      actorId: ctx.userId,
      limit: 10,
      windowMs: 10 * 60_000,
    });
    if (limited) return limited;

    const parsed = parseSearchParams(dailyFinanceReportQuerySchema, req.nextUrl.searchParams);
    if (!parsed.ok) return parsed.response;
    const dateStr = parsed.data.date ?? new Date().toISOString().split("T")[0];
    const reportDate = new Date(dateStr);
    reportDate.setHours(0, 0, 0, 0);

    const [
      branding,
      report,
      arrearsReport,
      classCollectionReport,
      receiptIntegrityReport,
      correctionReversalReport,
      paymentRegister,
    ] = await Promise.all([
      getSchoolBranding(ctx.schoolId),
      getDailyFinanceReport(ctx.schoolId, reportDate),
      getBursarArrearsFollowUp(ctx.schoolId, { asOf: reportDate, limit: 10 }),
      getClassCollectionReport(ctx.schoolId),
      getReceiptIntegrityReport(ctx.schoolId),
      getCorrectionReversalReport(ctx.schoolId),
      prisma.payment.findMany({
        where: {
          schoolId: ctx.schoolId,
          status: "CONFIRMED",
          paymentDate: { gte: reportDate, lte: new Date(new Date(reportDate).setHours(23, 59, 59, 999)) },
        },
        select: {
          id: true,
          receiptNumber: true,
          amount: true,
          paymentMethod: true,
          referenceNo: true,
          paidBy: true,
          studentBill: {
            select: {
              student: { select: { name: true, surname: true, class: { select: { name: true } } } },
              feeStructure: { select: { title: true, term: true, academicYear: true } },
            },
          },
        },
        orderBy: [{ paymentDate: "asc" }, { id: "asc" }],
      }) as Promise<PaymentRegisterRow[]>,
    ]);

    const label = dateLabel(report.date);
    const topWeakClasses = classCollectionReport.rows
      .filter((row) => row.outstanding > 0)
      .sort((a, b) => a.collectionRate - b.collectionRate || b.outstanding - a.outstanding)
      .slice(0, 5);
    const topArrears = arrearsReport.items.slice(0, 8);
    const receiptFlagCount = receiptIntegrityReport.duplicateReferenceCount
      + receiptIntegrityReport.receiptGapCount
      + receiptIntegrityReport.pendingReceipts
      + receiptIntegrityReport.failedReceipts;
    const controlExceptionCount = report.pendingConfirmationCount
      + correctionReversalReport.pendingReview
      + correctionReversalReport.approvedWaitingApplication
      + receiptFlagCount;
    const actionPoints = [
      report.pendingConfirmationCount > 0 ? `${report.pendingConfirmationCount} pending payment confirmation${report.pendingConfirmationCount === 1 ? "" : "s"} must be reviewed before today is closed.` : null,
      correctionReversalReport.pendingReview > 0 ? `${correctionReversalReport.pendingReview} correction request${correctionReversalReport.pendingReview === 1 ? "" : "s"} need school head decision.` : null,
      correctionReversalReport.approvedWaitingApplication > 0 ? `${correctionReversalReport.approvedWaitingApplication} approved correction${correctionReversalReport.approvedWaitingApplication === 1 ? "" : "s"} still need to be applied.` : null,
      arrearsReport.summary.byPriority.Critical > 0 ? `${arrearsReport.summary.byPriority.Critical} critical arrears bill${arrearsReport.summary.byPriority.Critical === 1 ? "" : "s"} worth ${formatGHS(arrearsReport.summary.criticalAmount)} need follow-up.` : null,
      receiptFlagCount > 0 ? `${receiptFlagCount} receipt trust flag${receiptFlagCount === 1 ? "" : "s"} need checking.` : null,
      topWeakClasses[0] ? `${topWeakClasses[0].className} is the weakest collection class at ${pct(topWeakClasses[0].collectionRate)}.` : null,
    ].filter((item): item is string => Boolean(item));

    const pdfBuffer = await getCachedDocument({
      keyParts: [
        ctx.schoolId,
        "daily-money-report",
        dateStr,
        branding.displayName,
        branding.primaryColor,
      ],
      tags: [
        documentTag(ctx.schoolId, "daily-finance"),
        documentTag(ctx.schoolId, "daily-finance", dateStr),
        documentTag(ctx.schoolId, "receipt"),
      ],
      generate: () => renderToBuffer(
        <Document title={`${branding.displayName} Daily Money Report - ${label}`}>
          <Page size="A4" style={S.page} wrap>
            <View style={[S.header, { backgroundColor: branding.primaryColor }]} fixed>
              <View>
                <Text style={S.headerKicker}>{branding.displayName.toUpperCase()} - FINANCE OFFICE</Text>
                <Text style={S.headerTitle}>Daily Money Report</Text>
                <Text style={S.headerSub}>Bursar daily closeout: collections, arrears, receipt trust, corrections, and follow-up pressure.</Text>
              </View>
              <View style={S.headerRight}>
                <Text style={S.headerDate}>{label}</Text>
                <Text style={S.headerTag}>Generated {new Date().toLocaleString("en-GH")}</Text>
              </View>
            </View>

            <View style={S.band}>
              <Text style={S.bandTitle}>Management summary</Text>
              <Text style={S.bandNote}>
                This report uses confirmed payment records for collections, StudentBill for arrears, receipt records for trust checks, and correction/reversal records for control exceptions. It is meant to answer what happened today and what needs finance follow-up next.
              </Text>
            </View>

            <View style={S.statGrid}>
              <SummaryBox label="Collected today" value={formatGHS(report.totalReceived)} sub={`${report.paymentCount} confirmed payment${report.paymentCount === 1 ? "" : "s"}. ${deltaText(report.totalDelta, true)}.`} color="#047857" borderColor="#bbf7d0" />
              <SummaryBox label="Arrears pressure" value={formatGHS(arrearsReport.summary.totalOwed)} sub={`${arrearsReport.summary.overdueStudents} overdue student${arrearsReport.summary.overdueStudents === 1 ? "" : "s"}. ${arrearsReport.summary.byPriority.Critical} critical bill${arrearsReport.summary.byPriority.Critical === 1 ? "" : "s"}.`} color="#be123c" borderColor="#fecdd3" />
              <SummaryBox label="Receipt flags" value={receiptFlagCount.toLocaleString("en-GH")} sub={`${receiptIntegrityReport.voidedReceipts} voided, ${receiptIntegrityReport.pendingReceipts} pending, ${receiptIntegrityReport.failedReceipts} failed, ${receiptIntegrityReport.receiptGapCount} gap${receiptIntegrityReport.receiptGapCount === 1 ? "" : "s"}.`} color="#b45309" borderColor="#fde68a" />
              <SummaryBox label="Control exceptions" value={controlExceptionCount.toLocaleString("en-GH")} sub={`${correctionReversalReport.pendingReview} pending correction review, ${correctionReversalReport.approvedWaitingApplication} approved not applied.`} color="#1d4ed8" borderColor="#bfdbfe" />
            </View>

            <View style={S.twoCol}>
              <View style={S.col}>
                <Text style={S.sectionKicker}>OWNER ANSWERS</Text>
                <Text style={S.sectionTitle}>What needs attention</Text>
                {actionPoints.length === 0 ? <EmptyText text="No urgent finance exception for this date." /> : actionPoints.map((point) => (
                  <View key={point} style={S.bullet}>
                    <View style={S.bulletDot} />
                    <Text style={S.bulletText}>{point}</Text>
                  </View>
                ))}
              </View>
              <View style={S.col}>
                <Text style={S.sectionKicker}>METHOD BREAKDOWN</Text>
                <Text style={S.sectionTitle}>How money came in</Text>
                {report.methodBreakdown.length === 0 ? <EmptyText text="No confirmed payment method for this date." /> : (
                  <View style={S.table}>
                    <View style={S.tHead}>
                      <Text style={[S.th, { flex: 2 }]}>METHOD</Text>
                      <Text style={[S.th, { flex: 1, textAlign: "right" }]}>COUNT</Text>
                      <Text style={[S.th, { flex: 1.6, textAlign: "right" }]}>AMOUNT</Text>
                    </View>
                    {report.methodBreakdown.map((method, index) => (
                      <View key={method.method} style={index % 2 === 0 ? S.tRow : S.tRowAlt}>
                        <Text style={[S.td, { flex: 2 }]}>{method.label}</Text>
                        <Text style={[S.tdMuted, { flex: 1, textAlign: "right" }]}>{method.count}</Text>
                        <Text style={[S.tdMoney, { flex: 1.6 }]}>{formatGHS(method.amount)}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </View>

            <View style={S.section}>
              <Text style={S.sectionKicker}>CLASS COLLECTION</Text>
              <Text style={S.sectionTitle}>Collection health by class</Text>
              <View style={S.table}>
                <View style={S.tHead}>
                  <Text style={[S.th, { flex: 1.7 }]}>CLASS</Text>
                  <Text style={[S.th, { flex: 1.3, textAlign: "right" }]}>EXPECTED</Text>
                  <Text style={[S.th, { flex: 1.3, textAlign: "right" }]}>COLLECTED</Text>
                  <Text style={[S.th, { flex: 1.3, textAlign: "right" }]}>OUTSTANDING</Text>
                  <Text style={[S.th, { flex: 0.8, textAlign: "right" }]}>RATE</Text>
                  <Text style={[S.th, { flex: 1 }]}>RISK</Text>
                </View>
                {classCollectionReport.rows.length === 0 ? <EmptyText text="No class finance records available yet." /> : classCollectionReport.rows.slice(0, 12).map((row, index) => (
                  <View key={row.classId} style={index % 2 === 0 ? S.tRow : S.tRowAlt}>
                    <Text style={[S.td, { flex: 1.7 }]}>{row.className}</Text>
                    <Text style={[S.tdMuted, { flex: 1.3, textAlign: "right" }]}>{formatGHS(row.expected)}</Text>
                    <Text style={[S.tdMuted, { flex: 1.3, textAlign: "right" }]}>{formatGHS(row.collected)}</Text>
                    <Text style={[S.tdMuted, { flex: 1.3, textAlign: "right" }]}>{formatGHS(row.outstanding)}</Text>
                    <Text style={[S.td, { flex: 0.8, textAlign: "right", fontFamily: "Helvetica-Bold" }]}>{pct(row.collectionRate)}</Text>
                    <Text style={[S.tdMuted, { flex: 1 }]}>{row.risk}</Text>
                  </View>
                ))}
              </View>
            </View>

            <View style={S.twoCol}>
              <View style={S.col}>
                <Text style={S.sectionKicker}>ARREARS</Text>
                <Text style={S.sectionTitle}>Highest priority follow-up</Text>
                {topArrears.length === 0 ? <EmptyText text="No arrears follow-up item found." /> : topArrears.map((item) => (
                  <View key={item.billId} style={S.issueLine}>
                    <Text style={S.issueTitle}>{item.studentName} - {item.className ?? "No class"}</Text>
                    <Text style={S.issueDetail}>{formatGHS(item.amountOwed)} owed - {item.priority} - {item.daysOverdue} day{item.daysOverdue === 1 ? "" : "s"} overdue</Text>
                    <Text style={S.issueDetail}>Contact: {item.parentContact ? `${item.parentContact.name}${item.parentContact.phone ? ` - ${item.parentContact.phone}` : item.parentContact.email ? ` - ${item.parentContact.email}` : ""}` : "No contact saved"}</Text>
                  </View>
                ))}
              </View>
              <View style={S.col}>
                <Text style={S.sectionKicker}>RECEIPTS AND CORRECTIONS</Text>
                <Text style={S.sectionTitle}>Finance control checks</Text>
                <View style={S.issueLine}>
                  <Text style={S.issueTitle}>Receipt trust</Text>
                  <Text style={S.issueDetail}>{receiptIntegrityReport.confirmedReceipts} confirmed, {receiptIntegrityReport.voidedReceipts} voided, {receiptIntegrityReport.pendingReceipts} pending, {receiptIntegrityReport.failedReceipts} failed.</Text>
                  <Text style={S.issueDetail}>{receiptIntegrityReport.duplicateReferenceCount} duplicate reference group{receiptIntegrityReport.duplicateReferenceCount === 1 ? "" : "s"}, {receiptIntegrityReport.receiptGapCount} numbering gap{receiptIntegrityReport.receiptGapCount === 1 ? "" : "s"}.</Text>
                </View>
                <View style={S.issueLine}>
                  <Text style={S.issueTitle}>Corrections and reversals</Text>
                  <Text style={S.issueDetail}>{correctionReversalReport.pendingReview} pending review, {correctionReversalReport.approvedWaitingApplication} approved not applied, {correctionReversalReport.reversedPayments} reversed payment{correctionReversalReport.reversedPayments === 1 ? "" : "s"}.</Text>
                  <Text style={S.issueDetail}>Affected amount: {formatGHS(correctionReversalReport.totalAffectedAmount)}. Oldest pending: {correctionReversalReport.oldestPendingDays} day{correctionReversalReport.oldestPendingDays === 1 ? "" : "s"}.</Text>
                </View>
                {receiptIntegrityReport.issues.slice(0, 4).map((issue) => (
                  <View key={issue.id} style={S.issueLine}>
                    <Text style={S.issueTitle}>{issue.title}</Text>
                    <Text style={S.issueDetail}>{issue.detail}{issue.amount !== null ? ` - ${formatGHS(issue.amount)}` : ""}</Text>
                  </View>
                ))}
              </View>
            </View>

            <View style={S.section} break>
              <Text style={S.sectionKicker}>PAYMENT REGISTER</Text>
              <Text style={S.sectionTitle}>Confirmed receipts for the day</Text>
              {paymentRegister.length === 0 ? <EmptyText text="No confirmed receipts for this date." /> : (
                <View style={S.table}>
                  <View style={S.tHead} fixed>
                    <Text style={[S.th, { flex: 1.6 }]}>RECEIPT</Text>
                    <Text style={[S.th, { flex: 2.2 }]}>STUDENT</Text>
                    <Text style={[S.th, { flex: 1.2 }]}>CLASS</Text>
                    <Text style={[S.th, { flex: 1.6 }]}>METHOD</Text>
                    <Text style={[S.th, { flex: 1.6 }]}>REFERENCE</Text>
                    <Text style={[S.th, { flex: 1.3, textAlign: "right" }]}>AMOUNT</Text>
                  </View>
                  {paymentRegister.map((payment, index) => (
                    <View key={payment.id} style={index % 2 === 0 ? S.tRow : S.tRowAlt} wrap={false}>
                      <Text style={[S.td, { flex: 1.6, fontFamily: "Helvetica-Bold" }]}>{payment.receiptNumber}</Text>
                      <Text style={[S.td, { flex: 2.2 }]}>{studentName(payment.studentBill.student)}</Text>
                      <Text style={[S.tdMuted, { flex: 1.2 }]}>{payment.studentBill.student.class?.name ?? "No class"}</Text>
                      <Text style={[S.tdMuted, { flex: 1.6 }]}>{PAYMENT_METHOD_LABELS[payment.paymentMethod] ?? payment.paymentMethod}</Text>
                      <Text style={[S.tdMuted, { flex: 1.6 }]}>{payment.referenceNo ?? payment.paidBy}</Text>
                      <Text style={[S.tdMoney, { flex: 1.3 }]}>{formatGHS(payment.amount as number)}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>

            <View style={S.sigRow}>
              {["Prepared by bursar", "Checked by school head", "Approved by owner"].map((name) => (
                <View key={name} style={S.sigBox}>
                  <View style={{ height: 28 }} />
                  <View style={S.sigLine} />
                  <Text style={S.sigLabel}>{name.toUpperCase()}</Text>
                </View>
              ))}
            </View>

            <View style={S.footer} fixed>
              <Text style={S.footerText}>{branding.shortName} - Daily Money Report - {label}</Text>
              <Text style={S.footerText}>Generated from Edujay finance source-of-truth records</Text>
            </View>
          </Page>
        </Document>
      ),
    });

    const filename = `daily-money-report-${dateStr}.pdf`;
    const responseBuffer = new Uint8Array(pdfBuffer);
    return new NextResponse(responseBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(pdfBuffer.byteLength),
      },
    });
  } catch (err: unknown) {
    console.error("[finance/reports/daily]", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return new NextResponse(`Report generation failed: ${message}`, { status: 500 });
  }
}
