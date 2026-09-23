// src/app/api/finance/reports/weekly/route.tsx

import { NextRequest, NextResponse } from "next/server";
import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";
import React from "react";
import { getAuthzContext } from "@/src/lib/authz";
import { documentTag } from "@/src/lib/cacheTags";
import { formatGHS } from "@/src/lib/constants/finance";
import { enforceRateLimit } from "@/src/lib/rate-limit";
import { getSchoolBranding } from "@/src/lib/services/school-branding";
import { getCachedDocument } from "@/src/lib/services/document-cache";
import {
  getWeeklyFinanceSummary,
  parseWeeklyReportDate,
  weeklyReportDateInputValue,
} from "@/src/lib/services/weekly-finance-report";

const WEEKLY_OWNER_SUMMARY_TEMPLATE_VERSION = "first-three-v1";

const S = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 8.5,
    paddingTop: 30,
    paddingBottom: 30,
    paddingLeft: 34,
    paddingRight: 34,
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
  headerSub: { fontSize: 8, color: "#e0e7ff", marginTop: 4, maxWidth: 330, lineHeight: 1.35 },
  headerRight: { alignItems: "flex-end" },
  headerDate: { fontSize: 10.5, fontFamily: "Helvetica-Bold", color: "#ffffff" },
  headerTag: { fontSize: 7, color: "#c7d2fe", marginTop: 4 },
  note: { borderWidth: 1, borderColor: "#e5e7eb", borderStyle: "solid", borderRadius: 8, padding: 10, marginBottom: 10 },
  noteTitle: { fontSize: 9, fontFamily: "Helvetica-Bold", color: "#111827", marginBottom: 5 },
  noteText: { fontSize: 7.3, color: "#6b7280", lineHeight: 1.35 },
  statGrid: { flexDirection: "row", gap: 8, marginBottom: 10 },
  statBox: { flex: 1, borderWidth: 1, borderStyle: "solid", borderColor: "#e5e7eb", borderRadius: 7, padding: 8, minHeight: 54 },
  statLabel: { fontSize: 6.2, color: "#6b7280", letterSpacing: 1, fontFamily: "Helvetica-Bold", marginBottom: 4 },
  statValue: { fontSize: 12, fontFamily: "Helvetica-Bold", color: "#111827" },
  statSub: { fontSize: 6.8, color: "#6b7280", marginTop: 3, lineHeight: 1.25 },
  section: { marginTop: 8, marginBottom: 10 },
  sectionKicker: { fontSize: 6.2, color: "#9ca3af", letterSpacing: 1.3, fontFamily: "Helvetica-Bold", marginBottom: 3 },
  sectionTitle: { fontSize: 9.5, color: "#111827", fontFamily: "Helvetica-Bold", marginBottom: 5 },
  helper: { fontSize: 7.2, color: "#6b7280", marginBottom: 6, lineHeight: 1.35 },
  twoCol: { flexDirection: "row", gap: 10, marginBottom: 9 },
  col: { flex: 1 },
  table: { borderWidth: 1, borderColor: "#e5e7eb", borderStyle: "solid", borderRadius: 6, overflow: "hidden" },
  tHead: { flexDirection: "row", backgroundColor: "#f3f4f6", paddingVertical: 5, paddingHorizontal: 6 },
  tRow: { flexDirection: "row", paddingVertical: 5, paddingHorizontal: 6, borderTopWidth: 0.5, borderTopColor: "#e5e7eb", borderTopStyle: "solid" },
  tRowAlt: { flexDirection: "row", paddingVertical: 5, paddingHorizontal: 6, borderTopWidth: 0.5, borderTopColor: "#e5e7eb", borderTopStyle: "solid", backgroundColor: "#fafafa" },
  th: { fontSize: 6.4, color: "#4b5563", fontFamily: "Helvetica-Bold" },
  td: { fontSize: 7.2, color: "#111827" },
  tdMuted: { fontSize: 7, color: "#6b7280" },
  tdMoney: { fontSize: 7.2, color: "#047857", textAlign: "right", fontFamily: "Helvetica-Bold" },
  issueLine: { borderWidth: 1, borderColor: "#e5e7eb", borderStyle: "solid", borderRadius: 6, padding: 7, marginBottom: 5 },
  issueTitle: { fontSize: 7.5, color: "#111827", fontFamily: "Helvetica-Bold" },
  issueDetail: { fontSize: 7, color: "#6b7280", marginTop: 2, lineHeight: 1.25 },
  footer: { borderTopWidth: 0.5, borderTopColor: "#e5e7eb", borderTopStyle: "solid", paddingTop: 7, flexDirection: "row", justifyContent: "space-between", marginTop: 10 },
  footerText: { fontSize: 6.2, color: "#9ca3af" },
});

function dateLabel(date: Date) {
  return date.toLocaleDateString("en-GH", { day: "numeric", month: "short", year: "numeric" });
}

function weekLabel(start: Date, end: Date) {
  return `${dateLabel(start)} - ${dateLabel(end)}`;
}

function deltaText(value: number, money = false) {
  if (value === 0) return "No change from last week";
  const direction = value > 0 ? "up" : "down";
  const display = money ? formatGHS(Math.abs(value)) : Math.abs(value).toLocaleString("en-GH");
  return `${display} ${direction} from last week`;
}

function pct(value: number) {
  return `${Math.round(value)}%`;
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
      scope: "finance:weekly-report",
      actorId: ctx.userId,
      limit: 8,
      windowMs: 10 * 60_000,
    });
    if (limited) return limited;

    const date = parseWeeklyReportDate(req.nextUrl.searchParams.get("date"));
    const [branding, report] = await Promise.all([
      getSchoolBranding(ctx.schoolId),
      getWeeklyFinanceSummary(ctx.schoolId, date),
    ]);
    const selectedDate = weeklyReportDateInputValue(report.weekStart);
    const label = weekLabel(report.weekStart, report.weekEnd);

    const pdfBuffer = await getCachedDocument({
      keyParts: [
        ctx.schoolId,
        "weekly-owner-summary",
        WEEKLY_OWNER_SUMMARY_TEMPLATE_VERSION,
        selectedDate,
        branding.displayName,
        branding.primaryColor,
      ],
      tags: [
        documentTag(ctx.schoolId, "daily-finance"),
        documentTag(ctx.schoolId, "daily-finance", selectedDate),
        documentTag(ctx.schoolId, "receipt"),
      ],
      generate: () => renderToBuffer(
        <Document title={`${branding.displayName} Weekly Owner Summary - ${label}`}>
          <Page size="A4" style={S.page} wrap>
            <View style={[S.header, { backgroundColor: branding.primaryColor }]} fixed>
              <View>
                <Text style={S.headerKicker}>{branding.displayName.toUpperCase()} - FINANCE OFFICE</Text>
                <Text style={S.headerTitle}>Weekly Owner Summary</Text>
                <Text style={S.headerSub}>First three trusted sections: weekly money position, class collection performance, and arrears pressure.</Text>
              </View>
              <View style={S.headerRight}>
                <Text style={S.headerDate}>{label}</Text>
                <Text style={S.headerTag}>Generated {new Date().toLocaleString("en-GH")}</Text>
              </View>
            </View>

            <View style={S.note}>
              <Text style={S.noteTitle}>Report source rules</Text>
              <Text style={S.noteText}>Weekly collections use confirmed payment records only. Class collection rates and outstanding balances use StudentBill records. Arrears pressure uses unpaid and part-paid bills with balance above zero.</Text>
            </View>

            <View style={S.statGrid}>
              <SummaryBox label="Collected this week" value={formatGHS(report.totalCollected)} sub={`${report.paymentCount} confirmed payment${report.paymentCount === 1 ? "" : "s"}. ${deltaText(report.totalDelta, true)}.`} color="#047857" borderColor="#bbf7d0" />
              <SummaryBox label="Last week" value={formatGHS(report.previousTotalCollected)} sub={`${report.previousPaymentCount} confirmed payment${report.previousPaymentCount === 1 ? "" : "s"}.`} color="#1f2937" />
              <SummaryBox label="Strongest day" value={report.strongestCollectionDay ? formatGHS(report.strongestCollectionDay.amount) : "None"} sub={report.strongestCollectionDay ? `${report.strongestCollectionDay.label} - ${report.strongestCollectionDay.paymentCount} payment${report.strongestCollectionDay.paymentCount === 1 ? "" : "s"}` : "No confirmed payment this week"} color="#1d4ed8" borderColor="#bfdbfe" />
              <SummaryBox label="Weakest active day" value={report.weakestCollectionDay ? formatGHS(report.weakestCollectionDay.amount) : "None"} sub={report.weakestCollectionDay ? `${report.weakestCollectionDay.label} - ${report.weakestCollectionDay.paymentCount} payment${report.weakestCollectionDay.paymentCount === 1 ? "" : "s"}` : "No confirmed payment this week"} color="#b45309" borderColor="#fde68a" />
            </View>

            <View style={S.section}>
              <Text style={S.sectionKicker}>WEEKLY MONEY POSITION</Text>
              <Text style={S.sectionTitle}>Daily collection pattern</Text>
              <Text style={S.helper}>This shows which days actually brought in confirmed money during the selected week. Zero days remain visible so the owner sees the full weekly pattern.</Text>
              <View style={S.table}>
                <View style={S.tHead}>
                  <Text style={[S.th, { flex: 1.5 }]}>DAY</Text>
                  <Text style={[S.th, { flex: 1, textAlign: "right" }]}>PAYMENTS</Text>
                  <Text style={[S.th, { flex: 1.4, textAlign: "right" }]}>COLLECTED</Text>
                </View>
                {report.dailyBreakdown.map((day, index) => (
                  <View key={day.label} style={index % 2 === 0 ? S.tRow : S.tRowAlt}>
                    <Text style={[S.td, { flex: 1.5 }]}>{day.label}</Text>
                    <Text style={[S.tdMuted, { flex: 1, textAlign: "right" }]}>{day.paymentCount}</Text>
                    <Text style={[S.tdMoney, { flex: 1.4 }]}>{formatGHS(day.amount)}</Text>
                  </View>
                ))}
              </View>
            </View>

            <View style={S.section}>
              <Text style={S.sectionKicker}>CLASS COLLECTION PERFORMANCE</Text>
              <Text style={S.sectionTitle}>Which classes are strong and which need follow-up</Text>
              <Text style={S.helper}>Weekly collected is money received during this week. Expected, collected, outstanding, and collection rate show the wider bill position for each class.</Text>
              <View style={S.table}>
                <View style={S.tHead}>
                  <Text style={[S.th, { flex: 1.5 }]}>CLASS</Text>
                  <Text style={[S.th, { flex: 1.2, textAlign: "right" }]}>WEEK</Text>
                  <Text style={[S.th, { flex: 1.2, textAlign: "right" }]}>COLLECTED</Text>
                  <Text style={[S.th, { flex: 1.2, textAlign: "right" }]}>OUTSTANDING</Text>
                  <Text style={[S.th, { flex: 0.8, textAlign: "right" }]}>RATE</Text>
                  <Text style={[S.th, { flex: 0.9 }]}>STATUS</Text>
                </View>
                {report.classPerformance.length === 0 ? <EmptyText text="No class finance records available yet." /> : report.classPerformance.slice(0, 14).map((row, index) => (
                  <View key={row.classId} style={index % 2 === 0 ? S.tRow : S.tRowAlt}>
                    <Text style={[S.td, { flex: 1.5 }]}>{row.className}</Text>
                    <Text style={[S.tdMoney, { flex: 1.2 }]}>{formatGHS(row.weeklyCollected)}</Text>
                    <Text style={[S.tdMuted, { flex: 1.2, textAlign: "right" }]}>{formatGHS(row.collected)}</Text>
                    <Text style={[S.tdMuted, { flex: 1.2, textAlign: "right" }]}>{formatGHS(row.outstanding)}</Text>
                    <Text style={[S.td, { flex: 0.8, textAlign: "right", fontFamily: "Helvetica-Bold" }]}>{pct(row.collectionRate)}</Text>
                    <Text style={[S.tdMuted, { flex: 0.9 }]}>{row.status}</Text>
                  </View>
                ))}
              </View>
            </View>

            <View style={S.twoCol}>
              <View style={S.col}>
                <Text style={S.sectionKicker}>TOP AND WEAK CLASSES</Text>
                <Text style={S.sectionTitle}>Owner class signals</Text>
                {(report.topCollectingClasses.length === 0 && report.weakCollectionClasses.length === 0) ? <EmptyText text="No class signal found for this week." /> : null}
                {report.topCollectingClasses.slice(0, 3).map((row) => (
                  <View key={`top-${row.classId}`} style={S.issueLine}>
                    <Text style={S.issueTitle}>{row.className} collected most this week</Text>
                    <Text style={S.issueDetail}>{formatGHS(row.weeklyCollected)} from {row.weeklyPaymentCount} confirmed payment{row.weeklyPaymentCount === 1 ? "" : "s"}. Overall collection rate: {pct(row.collectionRate)}.</Text>
                  </View>
                ))}
                {report.weakCollectionClasses.slice(0, 3).map((row) => (
                  <View key={`weak-${row.classId}`} style={S.issueLine}>
                    <Text style={S.issueTitle}>{row.className} needs collection follow-up</Text>
                    <Text style={S.issueDetail}>{formatGHS(row.outstanding)} outstanding. Overall collection rate: {pct(row.collectionRate)}.</Text>
                  </View>
                ))}
              </View>
              <View style={S.col}>
                <Text style={S.sectionKicker}>ARREARS PRESSURE</Text>
                <Text style={S.sectionTitle}>Fees still owing</Text>
                <View style={S.issueLine}>
                  <Text style={S.issueTitle}>Current arrears position</Text>
                  <Text style={S.issueDetail}>{formatGHS(report.arrears.summary.totalOwed)} still owed by {report.arrears.summary.totalStudents} student{report.arrears.summary.totalStudents === 1 ? "" : "s"}.</Text>
                  <Text style={S.issueDetail}>{report.arrears.summary.overdueStudents} overdue student{report.arrears.summary.overdueStudents === 1 ? "" : "s"}; {report.arrears.summary.byPriority.Critical} critical bill{report.arrears.summary.byPriority.Critical === 1 ? "" : "s"}; {report.arrears.summary.noParentContact} without parent contact.</Text>
                </View>
                {report.arrears.items.slice(0, 6).map((item) => (
                  <View key={item.billId} style={S.issueLine}>
                    <Text style={S.issueTitle}>{item.studentName} - {item.className ?? "No class"}</Text>
                    <Text style={S.issueDetail}>{formatGHS(item.amountOwed)} owed - {item.priority} - {item.daysOverdue} day{item.daysOverdue === 1 ? "" : "s"} overdue.</Text>
                    <Text style={S.issueDetail}>Contact: {item.parentContact ? `${item.parentContact.name}${item.parentContact.phone ? ` - ${item.parentContact.phone}` : item.parentContact.email ? ` - ${item.parentContact.email}` : ""}` : "No contact saved"}</Text>
                  </View>
                ))}
              </View>
            </View>

            <View style={S.footer} fixed>
              <Text style={S.footerText}>{branding.shortName} - Weekly Owner Summary - {label}</Text>
              <Text style={S.footerText}>Generated from Edujay finance records</Text>
            </View>
          </Page>
        </Document>
      ),
    });

    const filename = `weekly-owner-summary-${selectedDate}.pdf`;
    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(pdfBuffer.byteLength),
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (err: unknown) {
    console.error("[finance/reports/weekly]", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return new NextResponse(`Weekly report generation failed: ${message}`, { status: 500 });
  }
}
