import "server-only";
import { z } from "zod";
import prisma from "@/src/lib/prisma";
import { requireRole } from "@/src/lib/authz";
import { getClassReportReadiness } from "@/src/lib/services/report-card-readiness";
import { examEntryState } from "@/src/lib/academic-readiness-rules";
import { getFinalReportPosition } from "@/src/lib/services/final-report-readiness";

const id = z.string().regex(/^[1-9]\d*$/).transform(Number).pipe(z.number().int().max(2147483647));
const filters = z.object({ classId: id.optional(), year: z.string().trim().min(1).max(30).optional(), term: z.enum(["TERM_1", "TERM_2", "TERM_3"]).optional(), page: id.pipe(z.number().max(100000)).optional() });
export async function getAdminReportReview(params: Record<string, string | string[] | undefined>, now = new Date()) {
  const { schoolId } = await requireRole(["admin"]);
  const parsed = filters.safeParse(Object.fromEntries(Object.entries(params).filter(([key, value]) => Object.hasOwn(filters.shape, key) && value !== undefined && value !== "")));
  return prisma.$transaction(async (db) => {
    const classes = await db.class.findMany({ where: { schoolId }, select: { id: true, name: true }, orderBy: { name: "asc" } });
    const configs = await db.cAConfig.findMany({ where: { schoolId }, select: { academicYear: true, currentTerm: true, isActive: true }, orderBy: [{ updatedAt: "desc" }, { id: "desc" }] });
    const active = configs.find((config) => config.isActive);
    const selection = parsed.success ? parsed.data : {};
    const year = selection.year ?? active?.academicYear ?? configs[0]?.academicYear ?? "";
    const term = selection.term ?? active?.currentTerm ?? "TERM_1";
    const classId = selection.classId ?? classes[0]?.id;
    const base = { classes, configs, year, term, classId, examStatus: "LOCKED" as "LOCKED" | "OPEN" | "CLOSED", reportPosition: null as ReturnType<typeof getFinalReportPosition> | null, readiness: null as Awaited<ReturnType<typeof getClassReportReadiness>> | null, publication: null as Awaited<ReturnType<typeof db.reportCardPublication.findUnique>>, audit: [] as { id: number; action: string; message: string; createdAt: Date }[], submittedByName: null as string | null, rows: [] as Awaited<ReturnType<typeof getClassReportReadiness>>["blockers"], page: 1, pageCount: 1, error: null as string | null };
    if (!parsed.success) return { ...base, error: "Some report filters are invalid." };
    if (classId !== undefined && !classes.some((cls) => cls.id === classId)) return { ...base, error: "This class is not available in your school." };
    if (!year) return base;
    if (!configs.some((config) => config.academicYear === year)) return { ...base, error: "Assessment configuration is unavailable for this academic year." };
    if (classId === undefined) return base;
    const readiness = await getClassReportReadiness({ schoolId, classId, term, academicYear: year }, db, now);
    const publication = await db.reportCardPublication.findUnique({ where: { schoolId_classId_term_academicYear: { schoolId, classId, term, academicYear: year } } });
    const examWindow = await db.examEntryWindow.findUnique({ where: { schoolId_classId_term_academicYear: { schoolId, classId, term, academicYear: year } }, select: { status: true, openedAt: true, closedAt: true } });
    const examState = examEntryState(readiness.examRequired ? 100 : 0, examWindow);
    const examStatus = examState === "OPEN" ? "OPEN" : examState === "CLOSED" ? "CLOSED" : "LOCKED";
    let reportPosition: ReturnType<typeof getFinalReportPosition>;
    try {
      reportPosition = getFinalReportPosition({ readiness, examState, publicationStatus: publication?.status ?? "UNPUBLISHED", unpublishedAt: publication?.unpublishedAt });
    } catch (error) {
      if (!error || typeof error !== "object" || !("code" in error) || error.code !== "ACADEMIC_EVIDENCE_INCONSISTENT") throw error;
      console.error("Report review evidence requires reconciliation", { code: error.code });
      return { ...base, error: "Report evidence requires reconciliation. No release decision is available." };
    }
    const audit = publication ? await db.cAAuditLog.findMany({ where: { schoolId, entityType: "ReportCardPublication", entityId: String(publication.id) }, select: { id: true, action: true, message: true, createdAt: true }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 10 }) : [];
    const submitter = publication?.submittedBy ? await db.teacher.findFirst({ where: { schoolId, id: publication.submittedBy }, select: { name: true, surname: true } }) : null;
    const pageCount = Math.max(1, Math.ceil(readiness.blockers.length / 25));
    const page = Math.min(selection.page ?? 1, pageCount);
    return { ...base, examStatus: examStatus as typeof base.examStatus, reportPosition, readiness, publication, audit, submittedByName: submitter ? `${submitter.name} ${submitter.surname}` : null, page, pageCount, rows: readiness.blockers.slice((page - 1) * 25, page * 25) };
  }, { isolationLevel: "RepeatableRead", timeout: 30000 });
}
