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
import {
  renderToBuffer, Document, Page, Text, View, StyleSheet,
} from "@react-pdf/renderer";
import React from "react";

const S = StyleSheet.create({
  page: {
    fontFamily: "Helvetica", fontSize: 9,
    paddingTop: 32, paddingBottom: 32,
    paddingLeft: 36, paddingRight: 36,
    backgroundColor: "#ffffff", color: "#1f2937",
  },
  header: {
    backgroundColor: "#1e1b4b", borderRadius: 8,
    padding: 18, marginBottom: 16,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
  },
  headerTitle: { fontSize: 15, fontFamily: "Helvetica-Bold", color: "#ffffff" },
  headerSub:   { fontSize: 8,  color: "#c7d2fe", marginTop: 3 },
  headerRight: { alignItems: "flex-end" },
  headerDate:  { fontSize: 11, fontFamily: "Helvetica-Bold", color: "#ffffff" },
  headerTag:   { fontSize: 7,  color: "#a5b4fc", marginTop: 3 },

  summaryRow: { flexDirection: "row", gap: 10, marginBottom: 16 },
  summaryBox: {
    flex: 1, backgroundColor: "#f9fafb", borderRadius: 6, padding: 10,
    borderWidth: 1, borderColor: "#f3f4f6", borderStyle: "solid",
    alignItems: "center",
  },
  summaryLbl: { fontSize: 6.5, color: "#9ca3af", letterSpacing: 1.5, marginBottom: 3 },
  summaryVal: { fontSize: 13, fontFamily: "Helvetica-Bold", color: "#111827" },
  summarySub: { fontSize: 7,  color: "#6b7280", marginTop: 1 },

  sectionHd: {
    fontSize: 7, color: "#9ca3af", letterSpacing: 2,
    marginBottom: 6, fontFamily: "Helvetica-Bold",
  },

  tHead: {
    flexDirection: "row", backgroundColor: "#f9fafb",
    borderRadius: 4, paddingVertical: 5, paddingHorizontal: 6,
  },
  tRow: {
    flexDirection: "row", paddingVertical: 4, paddingHorizontal: 6,
    borderBottomWidth: 0.5, borderBottomColor: "#f3f4f6", borderBottomStyle: "solid",
  },
  tRowAlt: {
    flexDirection: "row", paddingVertical: 4, paddingHorizontal: 6,
    backgroundColor: "#fafafa",
    borderBottomWidth: 0.5, borderBottomColor: "#f3f4f6", borderBottomStyle: "solid",
  },
  tFoot: {
    flexDirection: "row", backgroundColor: "#eef2ff",
    paddingVertical: 6, paddingHorizontal: 6,
    borderRadius: 4, marginTop: 2,
  },
  cReceipt:  { flex: 2,   fontSize: 8.5, color: "#111827", fontFamily: "Helvetica-Bold" },
  cStudent:  { flex: 2.5, fontSize: 8.5, color: "#111827" },
  cClass:    { flex: 1.5, fontSize: 8,   color: "#6b7280" },
  cMethod:   { flex: 2,   fontSize: 8,   color: "#6b7280" },
  cRef:      { flex: 2,   fontSize: 7.5, color: "#9ca3af" },
  cAmount:   { flex: 1.5, fontSize: 8.5, textAlign: "right", fontFamily: "Helvetica-Bold" },
  thTxt:     { fontSize: 7, color: "#6b7280", fontFamily: "Helvetica-Bold", letterSpacing: 0.5 },

  methodRow:  { flexDirection: "row", gap: 10, marginBottom: 16 },
  methodBox:  {
    flex: 1, borderRadius: 6, padding: 8, alignItems: "center",
    borderWidth: 1, borderStyle: "solid",
  },
  methodLbl: { fontSize: 7, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  methodVal: { fontSize: 11, fontFamily: "Helvetica-Bold" },

  footer:     { borderTopWidth: 0.5, borderTopColor: "#f3f4f6", borderTopStyle: "solid", paddingTop: 8, flexDirection: "row", justifyContent: "space-between", marginTop: 10 },
  footerText: { fontSize: 6.5, color: "#d1d5db" },

  sigRow:   { flexDirection: "row", gap: 20, marginTop: 16 },
  sigBox:   { flex: 1 },
  sigLine:  { borderBottomWidth: 1, borderBottomColor: "#d1d5db", borderBottomStyle: "dashed", marginBottom: 4 },
  sigLabel: { fontSize: 6.5, color: "#9ca3af", letterSpacing: 1.5 },
});

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

    const dayStart = new Date(dateStr); dayStart.setHours(0, 0, 0, 0);
    const dayEnd   = new Date(dateStr); dayEnd.setHours(23, 59, 59, 999);

    // All confirmed payments for the day
    const payments = await prisma.payment.findMany({
      where: {
        schoolId: ctx.schoolId,
        status:      "CONFIRMED",
        paymentDate: { gte: dayStart, lte: dayEnd },
      },
      include: {
        studentBill: {
          include: {
            student: {
              select: {
                name:    true,
                surname: true,
                class:   { select: { name: true } },
              },
            },
            feeStructure: { select: { term: true, academicYear: true } },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    // Aggregates
    const totalCollected = payments.reduce((s, p) => s + Number(p.amount), 0);

    const byMethod: Record<string, number> = {};
    for (const p of payments) {
      const m = p.paymentMethod;
      byMethod[m] = (byMethod[m] ?? 0) + Number(p.amount);
    }

    const cashTotal = byMethod["CASH"] ?? 0;
    const momoTotal = (byMethod["MTN_MOMO"] ?? 0) + (byMethod["VODAFONE_CASH"] ?? 0) + (byMethod["AIRTELTIGO_MONEY"] ?? 0);
    const bankTotal = (byMethod["BANK_TRANSFER"] ?? 0) + (byMethod["CHEQUE"] ?? 0);

    const dateLabel = new Date(dateStr).toLocaleDateString("en-GH", {
      weekday: "long", day: "numeric", month: "long", year: "numeric",
    });
    const branding = await getSchoolBranding(ctx.schoolId);

    const pdfBuffer = await getCachedDocument({
      keyParts: [
        ctx.schoolId,
        "daily-finance",
        dateStr,
        branding.displayName,
        branding.primaryColor,
      ],
      tags: [
        documentTag(ctx.schoolId, "daily-finance"),
        documentTag(ctx.schoolId, "daily-finance", dateStr),
      ],
      generate: () => renderToBuffer(
      <Document title={`${branding.displayName} Daily Collection Report - ${dateLabel}`}>
        <Page size="A4" style={S.page}>

          {/* Header */}
          <View style={[S.header, { backgroundColor: branding.primaryColor }]}>
            <View>
              <Text style={{ fontSize: 7, color: "#a5b4fc", letterSpacing: 2, marginBottom: 4 }}>
                {branding.displayName.toUpperCase()} - DAILY COLLECTION REPORT
              </Text>
              <Text style={S.headerTitle}>Daily Collection Report</Text>
              <Text style={S.headerSub}>All confirmed payments received on this date</Text>
            </View>
            <View style={S.headerRight}>
              <Text style={S.headerDate}>{dateLabel}</Text>
              <Text style={S.headerTag}>
                Generated: {new Date().toLocaleDateString("en-GH", { day: "numeric", month: "short", year: "numeric" })}
              </Text>
            </View>
          </View>

          {/* Summary */}
          <View style={S.summaryRow}>
            <View style={[S.summaryBox, { borderColor: "#d1fae5" }]}>
              <Text style={S.summaryLbl}>TOTAL COLLECTED</Text>
              <Text style={[S.summaryVal, { color: "#059669" }]}>{formatGHS(totalCollected)}</Text>
              <Text style={S.summarySub}>{payments.length} payment{payments.length !== 1 ? "s" : ""}</Text>
            </View>
            <View style={[S.summaryBox, { borderColor: "#f3f4f6" }]}>
              <Text style={S.summaryLbl}>CASH</Text>
              <Text style={[S.summaryVal, { color: "#111827" }]}>{formatGHS(cashTotal)}</Text>
              <Text style={S.summarySub}>
                {payments.filter((p) => p.paymentMethod === "CASH").length} payments
              </Text>
            </View>
            <View style={[S.summaryBox, { borderColor: "#fef3c7" }]}>
              <Text style={S.summaryLbl}>MOBILE MONEY</Text>
              <Text style={[S.summaryVal, { color: "#d97706" }]}>{formatGHS(momoTotal)}</Text>
              <Text style={S.summarySub}>
                {payments.filter((p) => ["MTN_MOMO","VODAFONE_CASH","AIRTELTIGO_MONEY"].includes(p.paymentMethod)).length} payments
              </Text>
            </View>
            <View style={[S.summaryBox, { borderColor: "#e0e7ff" }]}>
              <Text style={S.summaryLbl}>BANK / CHEQUE</Text>
              <Text style={[S.summaryVal, { color: "#4338ca" }]}>{formatGHS(bankTotal)}</Text>
              <Text style={S.summarySub}>
                {payments.filter((p) => ["BANK_TRANSFER","CHEQUE"].includes(p.paymentMethod)).length} payments
              </Text>
            </View>
          </View>

          {/* Payments table */}
          <Text style={S.sectionHd}>PAYMENT DETAILS</Text>
          {payments.length === 0 ? (
            <Text style={{ fontSize: 9, color: "#9ca3af", textAlign: "center", marginTop: 20 }}>
              No payments recorded for this date.
            </Text>
          ) : (
            <View>
              <View style={S.tHead}>
                <Text style={[S.cReceipt, S.thTxt]}>RECEIPT</Text>
                <Text style={[S.cStudent, S.thTxt]}>STUDENT</Text>
                <Text style={[S.cClass,   S.thTxt]}>CLASS</Text>
                <Text style={[S.cMethod,  S.thTxt]}>METHOD</Text>
                <Text style={[S.cRef,     S.thTxt]}>REFERENCE</Text>
                <Text style={[S.cAmount,  S.thTxt]}>AMOUNT</Text>
              </View>
              {payments.map((p, i) => (
                <View key={p.id} style={i % 2 === 0 ? S.tRow : S.tRowAlt}>
                  <Text style={S.cReceipt}>{p.receiptNumber}</Text>
                  <Text style={S.cStudent}>
                    {p.studentBill.student?.surname} {p.studentBill.student?.name}
                  </Text>
                  <Text style={S.cClass}>{p.studentBill.student?.class?.name ?? "—"}</Text>
                  <Text style={S.cMethod}>
                    {PAYMENT_METHOD_LABELS[p.paymentMethod] ?? p.paymentMethod}
                  </Text>
                  <Text style={S.cRef}>{p.referenceNo ?? "—"}</Text>
                  <Text style={[S.cAmount, { color: "#059669" }]}>{formatGHS(p.amount)}</Text>
                </View>
              ))}
              <View style={S.tFoot}>
                <Text style={[S.cReceipt, { fontFamily: "Helvetica-Bold", color: "#1e1b4b" }]}>
                  TOTAL ({payments.length} payments)
                </Text>
                <Text style={S.cStudent} />
                <Text style={S.cClass} />
                <Text style={S.cMethod} />
                <Text style={S.cRef} />
                <Text style={[S.cAmount, { color: "#059669", fontSize: 10 }]}>
                  {formatGHS(totalCollected)}
                </Text>
              </View>
            </View>
          )}

          {/* Signatures */}
          <View style={S.sigRow}>
            {["Prepared by (Bursar)", "Verified by", "Approved by"].map((label) => (
              <View key={label} style={S.sigBox}>
                <View style={{ height: 28 }} />
                <View style={S.sigLine} />
                <Text style={S.sigLabel}>{label.toUpperCase()}</Text>
              </View>
            ))}
          </View>

          {/* Footer */}
          <View style={S.footer}>
            <Text style={S.footerText}>
              Generated: {new Date().toLocaleString("en-GH")}
            </Text>
            <Text style={S.footerText}>
              {branding.shortName} - Daily Collection Report - {dateLabel}
            </Text>
          </View>

        </Page>
      </Document>
      ),
    });

    const filename = `daily-collection-${dateStr}.pdf`;
    const responseBuffer = new Uint8Array(pdfBuffer)
    return new NextResponse(responseBuffer, {
      status: 200,
      headers: {
        "Content-Type":        "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length":      String(pdfBuffer.byteLength),
      },
    });

  } catch (err: unknown) {
    console.error("[finance/reports/daily]", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return new NextResponse(`Report generation failed: ${message}`, { status: 500 });
  }
}
