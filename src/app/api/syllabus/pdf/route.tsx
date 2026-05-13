// src/app/api/syllabus/pdf/route.tsx
// ⚠️  Must be .tsx — contains JSX for @react-pdf/renderer
// GET /api/syllabus/pdf?syllabusId=xxx
// Generates a clean A4 PDF of the full syllabus including all topics,
// subtopics, objectives, core competencies, and class progress summary.

import { NextRequest, NextResponse } from "next/server";
import { getAuthzContext } from "@/src/lib/authz";
import prisma from "@/src/lib/prisma";
import { TERM_LABELS } from "@/src/lib/caGrades";
import { enforceRateLimit } from "@/src/lib/rate-limit";
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
    paddingTop:      32,
    paddingBottom:   32,
    paddingLeft:     36,
    paddingRight:    36,
    backgroundColor: "#ffffff",
    color:           "#1f2937",
  },

  // Header
  header: {
    backgroundColor: "#1e1b4b",
    borderRadius:    8,
    padding:         18,
    marginBottom:    16,
    flexDirection:   "row",
    alignItems:      "center",
    justifyContent:  "space-between",
  },
  headerLeft:  { flex: 1 },
  headerTag:   { fontSize: 6.5, color: "#a5b4fc", letterSpacing: 2, marginBottom: 3 },
  headerTitle: { fontSize: 15, fontFamily: "Helvetica-Bold", color: "#ffffff" },
  headerSub:   { fontSize: 8,  color: "#c7d2fe", marginTop: 3 },
  headerBadge: {
    backgroundColor: "#312e81", borderRadius: 6,
    paddingHorizontal: 10, paddingVertical: 6,
  },
  headerBadgeText: { fontSize: 8, fontFamily: "Helvetica-Bold", color: "#a5b4fc", textAlign: "center" },
  headerBadgeVal:  { fontSize: 13, fontFamily: "Helvetica-Bold", color: "#ffffff", textAlign: "center", marginTop: 2 },

  // Meta row
  metaRow: { flexDirection: "row", gap: 10, marginBottom: 14 },
  metaBox: {
    flex: 1, backgroundColor: "#f9fafb", borderRadius: 6, padding: 10,
    borderWidth: 1, borderColor: "#f3f4f6", borderStyle: "solid",
  },
  metaLbl: { fontSize: 6.5, color: "#9ca3af", letterSpacing: 1.5, marginBottom: 2 },
  metaVal: { fontSize: 9,   fontFamily: "Helvetica-Bold", color: "#111827" },

  // Description
  descBox: {
    backgroundColor: "#f5f3ff", borderRadius: 6, padding: 10, marginBottom: 14,
    borderWidth: 1, borderColor: "#ede9fe", borderStyle: "solid",
    borderLeftWidth: 3, borderLeftColor: "#7c3aed", borderLeftStyle: "solid",
  },
  descText: { fontSize: 8.5, color: "#4c1d95", lineHeight: 1.5 },

  // Section heading
  sectionHd: {
    fontSize: 7, color: "#9ca3af", letterSpacing: 2,
    marginBottom: 6, fontFamily: "Helvetica-Bold",
  },

  // Topic card
  topicCard: {
    marginBottom: 10, borderRadius: 6,
    borderWidth: 1, borderColor: "#e5e7eb", borderStyle: "solid",
  },
  topicHeader: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#f9fafb", padding: 8,
    borderBottomWidth: 1, borderBottomColor: "#e5e7eb", borderBottomStyle: "solid",
    borderTopLeftRadius: 6, borderTopRightRadius: 6,
  },
  weekBadge: {
    backgroundColor: "#ede9fe", borderRadius: 4,
    paddingHorizontal: 7, paddingVertical: 3,
  },
  weekText:  { fontSize: 7.5, fontFamily: "Helvetica-Bold", color: "#5b21b6" },
  topicTitle:{ fontSize: 9.5, fontFamily: "Helvetica-Bold", color: "#111827", flex: 1 },
  durationBadge: {
    backgroundColor: "#e0e7ff", borderRadius: 4,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  durationText: { fontSize: 7, color: "#3730a3" },

  topicBody: { padding: 8 },

  // Sub-section label
  subLabel: { fontSize: 6.5, color: "#9ca3af", letterSpacing: 1.5, fontFamily: "Helvetica-Bold", marginBottom: 3, marginTop: 5 },

  // Tags row
  tagsRow:  { flexDirection: "row", flexWrap: "wrap", gap: 3 },
  tag:      { backgroundColor: "#f3f4f6", borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  tagText:  { fontSize: 7.5, color: "#374151" },

  // Objectives list
  objRow:   { flexDirection: "row", gap: 5, marginBottom: 2, alignItems: "flex-start" },
  objNum:   { fontSize: 7, color: "#7c3aed", fontFamily: "Helvetica-Bold", width: 12 },
  objText:  { fontSize: 8, color: "#374151", flex: 1, lineHeight: 1.4 },

  // Resources
  resText:  { fontSize: 7.5, color: "#6b7280", lineHeight: 1.4, fontStyle: "italic" },

  // Progress table
  progTable:  { marginBottom: 10 },
  progHeader: {
    flexDirection: "row", backgroundColor: "#f9fafb", padding: 6,
    borderRadius: 4,
  },
  progRow:    { flexDirection: "row", padding: 5, borderBottomWidth: 0.5, borderBottomColor: "#f3f4f6", borderBottomStyle: "solid" },
  progClass:  { flex: 2, fontSize: 8.5, color: "#111827", fontFamily: "Helvetica-Bold" },
  progCovered:{ flex: 1, fontSize: 8.5, textAlign: "center" },
  progPct:    { flex: 1, fontSize: 8.5, textAlign: "center" },
  thText:     { fontSize: 7, color: "#6b7280", fontFamily: "Helvetica-Bold" },

  // Status strip
  statusRow:  { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 14 },
  statusDot:  { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 8, fontFamily: "Helvetica-Bold" },

  // Footer
  footer:     { borderTopWidth: 0.5, borderTopColor: "#f3f4f6", borderTopStyle: "solid", paddingTop: 8, flexDirection: "row", justifyContent: "space-between", marginTop: 10 },
  footerText: { fontSize: 6.5, color: "#d1d5db" },
});

// ─── PDF Document ─────────────────────────────────────────────────────────────
type TopicData = {
  id:                number;
  weekNumber:        number;
  durationWeeks:     number;
  order:             number;
  title:             string;
  subtopics:         string[];
  objectives:        string[];
  coreCompetencies:  string[];
  teachingResources: string | null;
  coveredByClasses:  string[];
};

type ProgressRow = {
  className: string;
  covered:   number;
  total:     number;
  pct:       number;
};

function SyllabusPDF({
  subjectName, gradeLevel, term, academicYear,
  description, status, topics, progressRows,
}: {
  subjectName:  string;
  gradeLevel:   string;
  term:         string;
  academicYear: string;
  description:  string;
  status:       string;
  topics:       TopicData[];
  progressRows: ProgressRow[];
}) {
  const isPublished = status === "PUBLISHED";

  return (
    <Document title={`Syllabus — ${subjectName} ${gradeLevel} ${TERM_LABELS[term] ?? term} ${academicYear}`}>
      <Page size="A4" style={S.page}>

        {/* Header */}
        <View style={S.header}>
          <View style={S.headerLeft}>
            <Text style={S.headerTag}>GHANA BASIC EDUCATION · COURSE SYLLABUS</Text>
            <Text style={S.headerTitle}>{subjectName}</Text>
            <Text style={S.headerSub}>{gradeLevel} · {TERM_LABELS[term] ?? term} · {academicYear}</Text>
          </View>
          <View style={S.headerBadge}>
            <Text style={S.headerBadgeText}>TOPICS</Text>
            <Text style={S.headerBadgeVal}>{topics.length}</Text>
          </View>
        </View>

        {/* Meta */}
        <View style={S.metaRow}>
          <View style={S.metaBox}>
            <Text style={S.metaLbl}>SUBJECT</Text>
            <Text style={S.metaVal}>{subjectName}</Text>
          </View>
          <View style={S.metaBox}>
            <Text style={S.metaLbl}>GRADE LEVEL</Text>
            <Text style={S.metaVal}>{gradeLevel}</Text>
          </View>
          <View style={S.metaBox}>
            <Text style={S.metaLbl}>TERM</Text>
            <Text style={S.metaVal}>{TERM_LABELS[term] ?? term}</Text>
          </View>
          <View style={S.metaBox}>
            <Text style={S.metaLbl}>ACADEMIC YEAR</Text>
            <Text style={S.metaVal}>{academicYear}</Text>
          </View>
          <View style={S.metaBox}>
            <Text style={S.metaLbl}>STATUS</Text>
            <Text style={[S.metaVal, { color: isPublished ? "#059669" : "#d97706" }]}>
              {isPublished ? "Published" : "Draft"}
            </Text>
          </View>
        </View>

        {/* Description */}
        {description && (
          <View style={S.descBox}>
            <Text style={S.descText}>{description}</Text>
          </View>
        )}

        {/* Topics */}
        <Text style={S.sectionHd}>TOPICS & CONTENT</Text>
        {topics.map((topic, i) => (
          <View key={topic.id} style={S.topicCard} wrap={false}>
            {/* Topic header */}
            <View style={S.topicHeader}>
              <View style={S.weekBadge}>
                <Text style={S.weekText}>Week {topic.weekNumber}</Text>
              </View>
              <Text style={S.topicTitle}>{topic.title}</Text>
              {topic.durationWeeks > 1 && (
                <View style={S.durationBadge}>
                  <Text style={S.durationText}>{topic.durationWeeks} weeks</Text>
                </View>
              )}
              {topic.coveredByClasses.length > 0 && (
                <Text style={{ fontSize: 7, color: "#059669", fontFamily: "Helvetica-Bold" }}>
                  ✓ {topic.coveredByClasses.join(", ")}
                </Text>
              )}
            </View>

            <View style={S.topicBody}>
              {/* Subtopics */}
              {topic.subtopics.length > 0 && (
                <>
                  <Text style={S.subLabel}>SUBTOPICS</Text>
                  <View style={S.tagsRow}>
                    {topic.subtopics.map((st, j) => (
                      <View key={j} style={S.tag}>
                        <Text style={S.tagText}>{st}</Text>
                      </View>
                    ))}
                  </View>
                </>
              )}

              {/* Objectives */}
              {topic.objectives.length > 0 && (
                <>
                  <Text style={S.subLabel}>LEARNING OBJECTIVES</Text>
                  {topic.objectives.map((obj, j) => (
                    <View key={j} style={S.objRow}>
                      <Text style={S.objNum}>{j + 1}.</Text>
                      <Text style={S.objText}>{obj}</Text>
                    </View>
                  ))}
                </>
              )}

              {/* Core competencies */}
              {topic.coreCompetencies.length > 0 && (
                <>
                  <Text style={S.subLabel}>CORE COMPETENCIES</Text>
                  <View style={S.tagsRow}>
                    {topic.coreCompetencies.map((cc, j) => (
                      <View key={j} style={[S.tag, { backgroundColor: "#e0e7ff" }]}>
                        <Text style={[S.tagText, { color: "#3730a3" }]}>{cc}</Text>
                      </View>
                    ))}
                  </View>
                </>
              )}

              {/* Resources */}
              {topic.teachingResources && (
                <>
                  <Text style={S.subLabel}>TEACHING RESOURCES</Text>
                  <Text style={S.resText}>{topic.teachingResources}</Text>
                </>
              )}
            </View>
          </View>
        ))}

        {/* Class progress table */}
        {progressRows.length > 0 && (
          <>
            <Text style={[S.sectionHd, { marginTop: 10 }]}>CLASS PROGRESS SUMMARY</Text>
            <View style={S.progTable}>
              <View style={S.progHeader}>
                <Text style={[S.progClass,   S.thText]}>CLASS</Text>
                <Text style={[S.progCovered, S.thText]}>COVERED</Text>
                <Text style={[S.progPct,     S.thText]}>% COMPLETE</Text>
              </View>
              {progressRows.map((row, i) => (
                <View key={row.className} style={S.progRow}>
                  <Text style={S.progClass}>{row.className}</Text>
                  <Text style={[S.progCovered, { color: row.covered > 0 ? "#059669" : "#9ca3af" }]}>
                    {row.covered} / {row.total}
                  </Text>
                  <Text style={[S.progPct, {
                    color: row.pct === 100 ? "#059669" : row.pct >= 50 ? "#d97706" : "#6b7280",
                    fontFamily: "Helvetica-Bold",
                  }]}>
                    {row.pct}%
                  </Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* Footer */}
        <View style={S.footer}>
          <Text style={S.footerText}>
            Generated: {new Date().toLocaleDateString("en-GH", { day: "numeric", month: "long", year: "numeric" })}
          </Text>
          <Text style={S.footerText}>
            {subjectName} · {gradeLevel} · {TERM_LABELS[term] ?? term} {academicYear}
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
    if (!ctx || (ctx.role !== "admin" && ctx.role !== "teacher")) {
      return new NextResponse("Unauthorized", { status: 401 });
    }
    const { userId, role, schoolId } = ctx;
    const limited = enforceRateLimit(req, {
      scope: "academic:syllabus-pdf",
      actorId: userId,
      limit: 20,
      windowMs: 10 * 60_000,
    });
    if (limited) return limited;

    const syllabusId = parseInt(req.nextUrl.searchParams.get("syllabusId") ?? "");
    if (isNaN(syllabusId)) return new NextResponse("syllabusId required", { status: 400 });

    const syllabus = await prisma.syllabus.findFirst({
      where:   { id: syllabusId, schoolId },
      include: {
        subject: { select: { name: true } },
        grade:   { select: { level: true } },
        topics: {
          include: {
            progress: {
              include: { class: { select: { name: true } } },
            },
          },
          orderBy: { order: "asc" },
        },
      },
    });

    if (!syllabus) return new NextResponse("Syllabus not found", { status: 404 });

    // For teachers: verify they teach this subject
    if (role === "teacher") {
      const teacher = await prisma.teacher.findFirst({
        where:  { id: userId, schoolId },
        select: { subjects: { select: { id: true } } },
      });
      const teachesSubject = teacher?.subjects.some((s) => s.id === syllabus.subjectId);
      if (!teachesSubject) return new NextResponse("Forbidden", { status: 403 });
    }

    // Grade classes for progress summary
    const gradeClasses = await prisma.class.findMany({
      where:  { schoolId, gradeId: syllabus.gradeId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });

    const totalTopics = syllabus.topics.length;

    const progressRows = gradeClasses.map((cls) => {
      const covered = syllabus.topics.filter((t) =>
        t.progress.some((p) => p.classId === cls.id)
      ).length;
      return {
        className: cls.name,
        covered,
        total: totalTopics,
        pct:   totalTopics > 0 ? Math.round((covered / totalTopics) * 100) : 0,
      };
    });

    const topicData: TopicData[] = syllabus.topics.map((t) => ({
      id:                t.id,
      weekNumber:        t.weekNumber,
      durationWeeks:     t.durationWeeks,
      order:             t.order,
      title:             t.title,
      subtopics:         t.subtopics,
      objectives:        t.objectives,
      coreCompetencies:  t.coreCompetencies,
      teachingResources: t.teachingResources,
      coveredByClasses:  t.progress.map((p) => p.class.name),
    }));

    const pdfBuffer = await renderToBuffer(
      <SyllabusPDF
        subjectName={syllabus.subject.name}
        gradeLevel={syllabus.grade.level}
        term={syllabus.term}
        academicYear={syllabus.academicYear}
        description={syllabus.description ?? ""}
        status={syllabus.status}
        topics={topicData}
        progressRows={progressRows}
      />
    );

    const filename = `syllabus-${syllabus.subject.name}-${syllabus.grade.level}-${syllabus.term}-${syllabus.academicYear.replace("/", "-")}.pdf`
      .toLowerCase().replace(/\s+/g, "-");

    return new NextResponse(pdfBuffer as any, {
      status: 200,
      headers: {
        "Content-Type":        "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length":      pdfBuffer.byteLength.toString(),
      },
    });

  } catch (err: any) {
    console.error("[syllabus/pdf]", err);
    return new NextResponse(`PDF generation failed: ${err.message}`, { status: 500 });
  }
}
