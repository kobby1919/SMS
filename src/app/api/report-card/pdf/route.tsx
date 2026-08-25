// src/app/api/report-card/pdf/route.tsx


import { NextRequest, NextResponse } from "next/server";
import { getAuthzContext } from "@/src/lib/authz";
import prisma from "@/src/lib/prisma";
import { getGradeLabel } from "@/src/lib/actions/caActions";
import { computeAggregate, ordinal, TERM_LABELS } from "@/src/lib/caGrades";
import { enforceRateLimit } from "@/src/lib/rate-limit";
import { reportCardPdfQuerySchema } from "@/src/lib/validation/academic";
import { parseSearchParams } from "@/src/lib/validation/parse";
import { documentTag } from "@/src/lib/cacheTags";
import { getCachedDocument } from "@/src/lib/services/document-cache";
import { getSchoolBranding } from "@/src/lib/services/school-branding";
import { getActiveAcademicPeriod } from "@/src/lib/services/academic-period";
import { formatMark } from "@/src/lib/formatters/marks";
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
    fontFamily:      "Helvetica",
    fontSize:        9,
    paddingTop:      28,
    paddingBottom:   28,
    paddingLeft:     32,
    paddingRight:    32,
    backgroundColor: "#ffffff",
    color:           "#1f2937",
  },

  // ── Header ──────────────────────────────────────────────────────────────
  header: {
    backgroundColor: "#1e1b4b",
    borderRadius:    8,
    padding:         20,
    marginBottom:    16,
    flexDirection:   "row",
    alignItems:      "center",
    justifyContent:  "space-between",
  },
  headerLeft:   { flex: 1 },
  headerTag:    { fontSize: 7,  color: "#a5b4fc", letterSpacing: 2, marginBottom: 4 },
  headerTitle:  { fontSize: 16, fontFamily: "Helvetica-Bold", color: "#ffffff" },
  headerSub:    { fontSize: 8,  color: "#c7d2fe", marginTop: 3 },
  headerAgg:    { alignItems: "center" },
  headerAggNum: { fontSize: 36, fontFamily: "Helvetica-Bold", color: "#ffffff" },
  headerAggLbl: { fontSize: 7,  color: "#a5b4fc", textAlign: "center" },

  // ── Info grid ────────────────────────────────────────────────────────────
  infoRow: { flexDirection: "row", gap: 10, marginBottom: 12 },
  infoBox: {
    flex: 1, backgroundColor: "#f9fafb", borderRadius: 6,
    padding: 10, borderWidth: 1, borderColor: "#f3f4f6", borderStyle: "solid",
  },
  infoLbl: { fontSize: 6.5, color: "#9ca3af", letterSpacing: 1.5, marginBottom: 3 },
  infoVal: { fontSize: 9,   fontFamily: "Helvetica-Bold", color: "#111827" },
  infoSub: { fontSize: 7.5, color: "#6b7280", marginTop: 1 },

  // ── Weight strip ─────────────────────────────────────────────────────────
  weightBox: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#eef2ff", borderRadius: 6,
    padding: 8, marginBottom: 12,
    borderWidth: 1, borderColor: "#e0e7ff", borderStyle: "solid",
  },
  weightText: { fontSize: 8, color: "#4338ca", fontFamily: "Helvetica-Bold" },

  // ── Section heading ───────────────────────────────────────────────────────
  sectionHd: {
    fontSize: 7, color: "#9ca3af", letterSpacing: 2,
    marginBottom: 6, fontFamily: "Helvetica-Bold",
  },

  // ── Subject table ─────────────────────────────────────────────────────────
  table:      { marginBottom: 14 },
  tHead:      { flexDirection: "row", backgroundColor: "#f9fafb", borderRadius: 4, paddingVertical: 5, paddingHorizontal: 4 },
  tRow:       { flexDirection: "row", paddingVertical: 4, paddingHorizontal: 4, borderBottomWidth: 0.5, borderBottomColor: "#f3f4f6", borderBottomStyle: "solid" },
  tRowAlt:    { flexDirection: "row", paddingVertical: 4, paddingHorizontal: 4, backgroundColor: "#fafafa", borderBottomWidth: 0.5, borderBottomColor: "#f3f4f6", borderBottomStyle: "solid" },
  tFoot:      { flexDirection: "row", backgroundColor: "#eef2ff", paddingVertical: 6, paddingHorizontal: 4, borderRadius: 4, marginTop: 2 },
  cSubject:   { flex: 3,   fontSize: 8.5, color: "#111827", fontFamily: "Helvetica-Bold" },
  cNum:       { flex: 1.2, fontSize: 8.5, color: "#374151", textAlign: "center" },
  cGrade:     { flex: 1,   fontSize: 8.5, textAlign: "center", fontFamily: "Helvetica-Bold" },
  cPos:       { flex: 1,   fontSize: 8,   color: "#6b7280",  textAlign: "center" },
  cRemark:    { flex: 2,   fontSize: 7.5, color: "#9ca3af",  textAlign: "left" },
  thText:     { fontSize: 7, color: "#6b7280", letterSpacing: 0.5, fontFamily: "Helvetica-Bold" },

  // ── Grade key ─────────────────────────────────────────────────────────────
  gradeKeyRow:  { flexDirection: "row", flexWrap: "wrap", gap: 4, marginBottom: 14 },
  gradeKeyItem: { backgroundColor: "#f3f4f6", borderRadius: 4, paddingHorizontal: 6, paddingVertical: 3 },
  gradeKeyText: { fontSize: 7, fontFamily: "Helvetica-Bold" },

  // ── Stats row ─────────────────────────────────────────────────────────────
  statsRow: { flexDirection: "row", gap: 8, marginBottom: 14 },
  statBox:  {
    flex: 1, backgroundColor: "#f9fafb", borderRadius: 6, padding: 8,
    alignItems: "center", borderWidth: 1, borderColor: "#f3f4f6", borderStyle: "solid",
  },
  statVal: { fontSize: 13, fontFamily: "Helvetica-Bold", color: "#111827" },
  statLbl: { fontSize: 6.5, color: "#9ca3af", letterSpacing: 1, marginTop: 2 },

  // ── Attendance ────────────────────────────────────────────────────────────
  attBox: {
    backgroundColor: "#f9fafb", borderRadius: 6, padding: 10, marginBottom: 14,
    borderWidth: 1, borderColor: "#f3f4f6", borderStyle: "solid",
  },
  attBarOuter: {
    height: 6, backgroundColor: "#e5e7eb", borderRadius: 3,
    marginTop: 4, marginBottom: 6, flexDirection: "row",
  },
  attPresent:  { backgroundColor: "#10b981", height: 6 },
  attLate:     { backgroundColor: "#f59e0b", height: 6 },
  attAbsent:   { backgroundColor: "#f87171", height: 6 },
  attRow:      { flexDirection: "row", gap: 12 },
  attItem:     { flexDirection: "row", alignItems: "center", gap: 3 },
  attDot:      { width: 6, height: 6, borderRadius: 3 },
  attText:     { fontSize: 7, color: "#6b7280" },

  // ── Evaluation ────────────────────────────────────────────────────────────
  evalBox: {
    backgroundColor: "#eef2ff", borderRadius: 6, padding: 12, marginBottom: 14,
    borderLeftWidth: 3, borderLeftColor: "#4f46e5", borderLeftStyle: "solid",
  },
  evalTag:   { fontSize: 6.5, color: "#818cf8", letterSpacing: 2, marginBottom: 4, fontFamily: "Helvetica-Bold" },
  evalTitle: { fontSize: 9.5, fontFamily: "Helvetica-Bold", color: "#1e1b4b", marginBottom: 4 },
  evalBody:  { fontSize: 8, color: "#374151", lineHeight: 1.6 },

  // ── Signatures ────────────────────────────────────────────────────────────
  sigRow:   { flexDirection: "row", gap: 16, marginTop: 8, marginBottom: 14 },
  sigBox:   { flex: 1, alignItems: "center" },
  sigLine:  { borderBottomWidth: 1, borderBottomColor: "#d1d5db", borderBottomStyle: "dashed", width: "100%", marginBottom: 4 },
  sigLabel: { fontSize: 6.5, color: "#9ca3af", letterSpacing: 1.5, textAlign: "center" },

  // ── Footer ────────────────────────────────────────────────────────────────
  footer:     { borderTopWidth: 0.5, borderTopColor: "#f3f4f6", borderTopStyle: "solid", paddingTop: 8, flexDirection: "row", justifyContent: "space-between" },
  footerText: { fontSize: 6.5, color: "#d1d5db" },
});

// ─── Helpers ──────────────────────────────────────────────────────────────────
function gradeColor(grade: string): string {
  if (grade === "A1")                                      return "#059669";
  if (grade === "B2" || grade === "B3")                    return "#2563eb";
  if (grade === "C4" || grade === "C5" || grade === "C6") return "#d97706";
  if (grade === "D7" || grade === "E8")                    return "#ea580c";
  return "#dc2626";
}

function getNarrative(aggregate: number, avg: number, pos: number, size: number) {
  if (aggregate <= 6  && avg >= 80) return { title: "Outstanding Performance",     body: `${pos === 1 ? "Top of the class" : `Ranked ${ordinal(pos)}`} with an exceptional aggregate of ${aggregate}. This student demonstrates mastery across all subjects and shows remarkable dedication.` };
  if (aggregate <= 12 && avg >= 65) return { title: "Commendable Performance",     body: `Ranked ${ordinal(pos)} out of ${size} with an aggregate of ${aggregate}. Strong understanding across most subjects, performing above average.` };
  if (aggregate <= 18 && avg >= 55) return { title: "Satisfactory Performance",    body: `Ranked ${ordinal(pos)} with an aggregate of ${aggregate}. A reasonable grasp of content. Consistent effort will lead to further improvement next term.` };
  if (aggregate <= 24)              return { title: "Needs Improvement",            body: `Ranked ${ordinal(pos)} with an aggregate of ${aggregate}. Additional support and focused study are recommended. Parental involvement will be key.` };
  return                                   { title: "Requires Urgent Attention",   body: `Aggregate of ${aggregate} indicates significant academic challenges. Immediate intervention including additional tutoring is strongly recommended.` };
}

// ─── Types ────────────────────────────────────────────────────────────────────
type SubjectRow = {
  name: string; classworkScore: number; examScore: number;
  totalScore: number; grade: string; position: number; remarks: string;
};

type PDFProps = {
  schoolName: string; schoolShortName: string; schoolPrimaryColor: string;
  studentName: string; studentSurname: string; studentId: string; sex: string;
  className: string; gradeLevel: string; supervisor: string; classSize: number;
  parentName: string; parentPhone: string;
  term: string; academicYear: string; cwWeight: number; exWeight: number;
  subjectRows: SubjectRow[];
  aggregate: number; avgScore: number; totalRaw: number; totalPossible: number;
  overallPosition: number;
  attendPresent: number; attendAbsent: number; attendLate: number; attendTotal: number;
};

// ─── PDF Document ─────────────────────────────────────────────────────────────
function ReportCardPDF(p: PDFProps) {
  const attendRate = p.attendTotal > 0 ? Math.round((p.attendPresent / p.attendTotal) * 100) : 0;
  const presentFlex = p.attendTotal > 0 ? p.attendPresent / p.attendTotal : 0;
  const lateFlex    = p.attendTotal > 0 ? p.attendLate    / p.attendTotal : 0;
  const absentFlex  = p.attendTotal > 0 ? p.attendAbsent  / p.attendTotal : 0;
  const ev          = getNarrative(p.aggregate, p.avgScore, p.overallPosition, p.classSize);

  const gradeKey = [
    { g: "A1", r: "≥90" }, { g: "B2", r: "≥80" }, { g: "B3", r: "≥75" },
    { g: "C4", r: "≥70" }, { g: "C5", r: "≥65" }, { g: "C6", r: "≥60" },
    { g: "D7", r: "≥55" }, { g: "E8", r: "≥50" }, { g: "F9", r: "<50"  },
  ];

  return (
    <Document title={`Report Card — ${p.studentSurname} ${p.studentName}`}>
      <Page size="A4" style={S.page}>

        {/* Header */}
        <View style={[S.header, { backgroundColor: p.schoolPrimaryColor }]}>
          <View style={S.headerLeft}>
            <Text style={S.headerTag}>{p.schoolName.toUpperCase()} - ACADEMIC REPORT</Text>
            <Text style={S.headerTitle}>STUDENT REPORT CARD</Text>
            <Text style={S.headerSub}>{TERM_LABELS[p.term] ?? p.term} · {p.academicYear} Academic Year</Text>
          </View>
          <View style={S.headerAgg}>
            <Text style={S.headerAggNum}>{p.aggregate}</Text>
            <Text style={S.headerAggLbl}>AGGREGATE</Text>
            <Text style={S.headerAggLbl}>{ordinal(p.overallPosition)} of {p.classSize}</Text>
          </View>
        </View>

        {/* Info grid */}
        <View style={S.infoRow}>
          <View style={S.infoBox}>
            <Text style={S.infoLbl}>STUDENT</Text>
            <Text style={S.infoVal}>{p.studentSurname.toUpperCase()}, {p.studentName}</Text>
            <Text style={S.infoSub}>{p.gradeLevel} · {p.className} · {p.sex === "MALE" ? "Male" : "Female"}</Text>
            <Text style={S.infoSub}>ID: {p.studentId.slice(0, 10).toUpperCase()}</Text>
          </View>
          <View style={S.infoBox}>
            <Text style={S.infoLbl}>CLASS INFORMATION</Text>
            <Text style={S.infoVal}>{p.className}</Text>
            <Text style={S.infoSub}>Class Teacher: {p.supervisor}</Text>
            <Text style={S.infoSub}>Class Size: {p.classSize} students</Text>
          </View>
          <View style={S.infoBox}>
            <Text style={S.infoLbl}>PARENT / GUARDIAN</Text>
            <Text style={S.infoVal}>{p.parentName || "—"}</Text>
            <Text style={S.infoSub}>{p.parentPhone || "—"}</Text>
          </View>
        </View>

        {/* Weight strip */}
        <View style={S.weightBox}>
          <Text style={S.weightText}>
            Scoring Weights:  Classwork Activities = {p.cwWeight}%   ·   End-of-Term Exam = {p.exWeight}%
          </Text>
        </View>

        {/* Subject table */}
        <Text style={S.sectionHd}>SUBJECT RESULTS</Text>
        <View style={S.table}>
          <View style={S.tHead}>
            <Text style={[S.cSubject, S.thText]}>SUBJECT</Text>
            <Text style={[S.cNum,     S.thText]}>CW ({p.cwWeight}%)</Text>
            <Text style={[S.cNum,     S.thText]}>EXAM ({p.exWeight}%)</Text>
            <Text style={[S.cNum,     S.thText]}>TOTAL</Text>
            <Text style={[S.cGrade,   S.thText]}>GRADE</Text>
            <Text style={[S.cPos,     S.thText]}>POS</Text>
            <Text style={[S.cRemark,  S.thText]}>REMARK</Text>
          </View>

          {p.subjectRows.map((row, i) => (
            <View key={row.name} style={i % 2 === 0 ? S.tRow : S.tRowAlt}>
              <Text style={S.cSubject}>{row.name}</Text>
              <Text style={S.cNum}>{formatMark(row.classworkScore)}</Text>
              <Text style={S.cNum}>{row.examScore.toFixed(1)}</Text>
              <Text style={[S.cNum,   { color: gradeColor(row.grade), fontFamily: "Helvetica-Bold" }]}>{row.totalScore.toFixed(1)}</Text>
              <Text style={[S.cGrade, { color: gradeColor(row.grade) }]}>{row.grade}</Text>
              <Text style={S.cPos}>{row.position > 0 ? ordinal(row.position) : "—"}</Text>
              <Text style={S.cRemark}>{row.remarks || getGradeLabel(row.grade)}</Text>
            </View>
          ))}

          <View style={S.tFoot}>
            <Text style={[S.cSubject, { color: "#1e1b4b", fontFamily: "Helvetica-Bold" }]}>TOTAL / AVERAGE</Text>
            <Text style={[S.cNum,     { color: "#6b7280" }]}>—</Text>
            <Text style={[S.cNum,     { color: "#6b7280" }]}>—</Text>
            <Text style={[S.cNum,     { fontFamily: "Helvetica-Bold", color: "#1e1b4b" }]}>{p.totalRaw.toFixed(1)} / {p.totalPossible}</Text>
            <Text style={[S.cGrade,   { fontFamily: "Helvetica-Bold", color: "#1e1b4b" }]}>{p.avgScore.toFixed(1)}%</Text>
            <Text style={[S.cPos,     { fontFamily: "Helvetica-Bold", color: "#1e1b4b" }]}>Agg: {p.aggregate}</Text>
            <Text style={S.cRemark} />
          </View>
        </View>

        {/* Grade key */}
        <View style={S.gradeKeyRow}>
          {gradeKey.map((g) => (
            <View key={g.g} style={S.gradeKeyItem}>
              <Text style={[S.gradeKeyText, { color: gradeColor(g.g) }]}>{g.g}: {g.r}</Text>
            </View>
          ))}
        </View>

        {/* Stats */}
        <View style={S.statsRow}>
          {[
            { label: "OVERALL AVG",    value: `${p.avgScore.toFixed(1)}%`  },
            { label: "AGGREGATE",      value: String(p.aggregate)          },
            { label: "CLASS POSITION", value: ordinal(p.overallPosition)   },
            { label: "ATTENDANCE",     value: `${attendRate}%`             },
            { label: "SUBJECTS",       value: String(p.subjectRows.length) },
          ].map((s) => (
            <View key={s.label} style={S.statBox}>
              <Text style={S.statVal}>{s.value}</Text>
              <Text style={S.statLbl}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* Attendance */}
        <View style={S.attBox}>
          <Text style={[S.sectionHd, { marginBottom: 2 }]}>ATTENDANCE SUMMARY</Text>
          <View style={S.attBarOuter}>
            {presentFlex > 0 && <View style={[S.attPresent, { flex: presentFlex }]} />}
            {lateFlex    > 0 && <View style={[S.attLate,    { flex: lateFlex    }]} />}
            {absentFlex  > 0 && <View style={[S.attAbsent,  { flex: absentFlex  }]} />}
            {/* Always render at least a tiny filler so the bar isn't empty */}
            {p.attendTotal === 0 && <View style={[S.attPresent, { flex: 1, backgroundColor: "#e5e7eb" }]} />}
          </View>
          <View style={S.attRow}>
            {[
              { label: `Present: ${p.attendPresent}`, color: "#10b981" },
              { label: `Late: ${p.attendLate}`,       color: "#f59e0b" },
              { label: `Absent: ${p.attendAbsent}`,   color: "#f87171" },
              { label: `Total: ${p.attendTotal}`,     color: "#9ca3af" },
              { label: `Rate: ${attendRate}%`,        color: "#6b7280" },
            ].map((a) => (
              <View key={a.label} style={S.attItem}>
                <View style={[S.attDot, { backgroundColor: a.color }]} />
                <Text style={S.attText}>{a.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Evaluation */}
        <View style={S.evalBox}>
          <Text style={S.evalTag}>PERFORMANCE EVALUATION</Text>
          <Text style={S.evalTitle}>{ev.title}</Text>
          <Text style={S.evalBody}>{ev.body}</Text>
        </View>

        {/* Signatures */}
        <Text style={S.sectionHd}>SIGNATURES</Text>
        <View style={S.sigRow}>
          {["Class Teacher", "Head Teacher / Principal", "Parent / Guardian"].map((label) => (
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
            Generated: {new Date().toLocaleDateString("en-GH", { day: "numeric", month: "long", year: "numeric" })}
          </Text>
          <Text style={S.footerText}>
            {p.schoolShortName} - {p.studentSurname.toUpperCase()}, {p.studentName} - {p.className} - {TERM_LABELS[p.term] ?? p.term} {p.academicYear}
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
    if (!ctx) return new NextResponse("Unauthorized", { status: 401 });
    const { userId, role, schoolId } = ctx;
    const limited = await enforceRateLimit(req, {
      scope: "academic:report-card-pdf",
      actorId: userId,
      limit: 20,
      windowMs: 10 * 60_000,
    });
    if (limited) return limited;

    const parsed = parseSearchParams(reportCardPdfQuerySchema, req.nextUrl.searchParams);
    if (!parsed.ok) return parsed.response;
    const { studentId, year: academicYear } = parsed.data;

    // Load student
    const student = await prisma.student.findFirst({
      where:   { id: studentId, schoolId },
      include: {
        class: {
          include: {
            grade:      true,
            supervisor: { select: { name: true, surname: true } },
          },
        },
        parent:      { select: { name: true, surname: true, phone: true } },
        attendances: { select: { status: true } },
      },
    });
    if (!student) return new NextResponse("Student not found", { status: 404 });

    // Auth guard
    if (role === "student" && userId !== studentId)
      return new NextResponse("Forbidden", { status: 403 });
    if (role === "parent" && student.parentId !== userId)
      return new NextResponse("Forbidden", { status: 403 });
    if (role === "teacher") {
      const cls = await prisma.class.findFirst({ where: { id: student.classId, schoolId }, select: { supervisorId: true } });
      if (cls?.supervisorId !== userId) return new NextResponse("Forbidden", { status: 403 });
    }

    // Config
    const [configs, activePeriod] = await Promise.all([
      prisma.cAConfig.findMany({ where: { schoolId }, orderBy: [{ isActive: "desc" }, { academicYear: "desc" }] }),
      getActiveAcademicPeriod(schoolId),
    ]);
    const term = parsed.data.term ?? activePeriod.currentTerm;
    const activeYear = academicYear || activePeriod.academicYear || configs[0]?.academicYear || "2025/26";
    const config     = configs.find((c) => c.academicYear === activeYear);
    const cwWeight   = config?.classworkWeight ?? 30;
    const exWeight   = config?.examWeight      ?? 70;

    // CA records for this student
    const caRecords = await prisma.continuousAssessment.findMany({
      where: { schoolId, studentId, classId: student.classId, term, academicYear: activeYear },
      include: { subject: { select: { name: true } } },
      orderBy: { subject: { name: "asc" } },
    });

    // All class CA records (for positions)
    const classCA = await prisma.continuousAssessment.findMany({
      where:  { schoolId, classId: student.classId, term, academicYear: activeYear },
      select: { studentId: true, subjectId: true, totalScore: true, gradePoint: true },
    });

    // Per-subject position
    const subjectPositions: Record<number, number> = {};
    for (const sid of [...new Set(classCA.map((r) => r.subjectId))]) {
      const sorted = classCA.filter((r) => r.subjectId === sid).sort((a, b) => b.totalScore - a.totalScore);
      const idx    = sorted.findIndex((r) => r.studentId === studentId);
      subjectPositions[sid] = idx >= 0 ? idx + 1 : 0;
    }

    // Overall class position
    const gpMap: Record<string, number[]> = {};
    for (const r of classCA) {
      if (!gpMap[r.studentId]) gpMap[r.studentId] = [];
      gpMap[r.studentId].push(r.gradePoint);
    }
    const sorted          = Object.entries(gpMap).map(([sid, gps]) => ({ sid, agg: computeAggregate(gps) })).sort((a, b) => a.agg - b.agg);
    const overallPosition = sorted.findIndex((c) => c.sid === studentId) + 1;
    const classSize       = await prisma.student.count({ where: { schoolId, classId: student.classId } });

    // Build subject rows
    const subjectRows: SubjectRow[] = caRecords.map((ca) => ({
      name:           ca.subject.name,
      classworkScore: ca.classworkScore,
      examScore:      ca.examScore,
      totalScore:     ca.totalScore,
      grade:          ca.grade,
      position:       subjectPositions[ca.subjectId] ?? 0,
      remarks:        ca.remarks,
    }));

    // Stats
    const gps         = caRecords.map((r) => r.gradePoint);
    const scores      = caRecords.map((r) => r.totalScore);
    const aggregate   = computeAggregate(gps);
    const avgScore    = scores.length > 0 ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : 0;
    const totalRaw    = scores.reduce((a, b) => a + b, 0);
    const totalPossible = scores.length * 100;

    // Attendance
    const attendPresent = student.attendances.filter((a) => a.status === "PRESENT").length;
    const attendAbsent  = student.attendances.filter((a) => a.status === "ABSENT").length;
    const attendLate    = student.attendances.filter((a) => a.status === "LATE").length;
    const attendTotal   = student.attendances.length;
    const branding = await getSchoolBranding(schoolId);

    // Generate PDF buffer
    const pdfBuffer = await getCachedDocument({
      keyParts: [
        ctx.schoolId,
        "report-card",
        student.id,
        term,
        activeYear,
        branding.displayName,
        branding.primaryColor,
      ],
      tags: [
        documentTag(ctx.schoolId, "report-card"),
        documentTag(ctx.schoolId, "report-card", student.id),
      ],
      generate: () => renderToBuffer(
      <ReportCardPDF
        schoolName={branding.displayName}
        schoolShortName={branding.shortName}
        schoolPrimaryColor={branding.primaryColor}
        studentName={student.name}
        studentSurname={student.surname}
        studentId={student.id}
        sex={student.sex}
        className={student.class.name}
        gradeLevel={student.class.grade.level}
        supervisor={student.class.supervisor ? `${student.class.supervisor.name} ${student.class.supervisor.surname}` : "—"}
        classSize={classSize}
        parentName={student.parent ? `${student.parent.name} ${student.parent.surname}` : ""}
        parentPhone={student.parent?.phone ?? ""}
        term={term}
        academicYear={activeYear}
        cwWeight={cwWeight}
        exWeight={exWeight}
        subjectRows={subjectRows}
        aggregate={aggregate}
        avgScore={avgScore}
        totalRaw={totalRaw}
        totalPossible={totalPossible}
        overallPosition={overallPosition}
        attendPresent={attendPresent}
        attendAbsent={attendAbsent}
        attendLate={attendLate}
        attendTotal={attendTotal}
      />
      ),
    });

    const filename = `report-card-${student.surname}-${student.name}-${term}-${activeYear.replace("/", "-")}.pdf`
      .toLowerCase().replace(/\s+/g, "-");

      const responseBody = new Uint8Array(pdfBuffer);

    return new NextResponse(responseBody, {
      status:  200,
      headers: {
        "Content-Type":        "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length":      String(pdfBuffer.byteLength),
      },
    });

  } catch (err: unknown) {
    console.error("[report-card/pdf]", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return new NextResponse(`PDF generation failed: ${message}`, { status: 500 });
  }
}
