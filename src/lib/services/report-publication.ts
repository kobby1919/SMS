import "server-only";
import prisma from "@/src/lib/prisma";
import type { AuthzContext } from "@/src/lib/authz";
import type { Prisma, Term } from "@/src/generated/prisma";
import { getClassReportReadiness } from "@/src/lib/services/report-card-readiness";
import { examEntryState } from "@/src/lib/academic-readiness-rules";

export type ReportActionInput = { classId: number; term: Term; academicYear: string; notes?: string; expectedUpdatedAt?: string };
export type ReportActionMode = "SUBMIT" | "PUBLISH" | "REJECT" | "UNPUBLISH";

export async function assertReportSetEditable(
  db: Pick<Prisma.TransactionClient, "reportCardPublication">,
  context: { schoolId: string; classId: number; term: Term; academicYear: string },
) {
  const publication = await db.reportCardPublication.findUnique({ where: { schoolId_classId_term_academicYear: context }, select: { status: true } });
  if (publication && ["SUBMITTED", "PUBLISHED"].includes(publication.status)) throw new Error("Return or withdraw this report set before approving score changes.");
}

export async function transitionClassReports(mode: ReportActionMode, input: ReportActionInput, actor: AuthzContext, now = new Date()) {
  if (actor.role !== (mode === "SUBMIT" ? "teacher" : "admin")) throw new Error("You cannot perform this report action.");
  try {
    return await prisma.$transaction(async (db) => {
      const { schoolId, userId } = actor;
      const context = { schoolId, classId: input.classId, term: input.term, academicYear: input.academicYear };
      const cls = await db.class.findFirst({ where: { id: input.classId, schoolId }, select: { id: true, name: true, supervisorId: true } });
      if (!cls) throw new Error("Class not found in your school.");
      if (mode === "SUBMIT") {
        const teacher = await db.teacher.findFirst({ where: { id: userId, schoolId, status: "ACTIVE" }, select: { id: true } });
        if (!teacher || cls.supervisorId !== userId) throw new Error("Only the active assigned class teacher can submit reports.");
      }
      const current = await db.reportCardPublication.findUnique({ where: { schoolId_classId_term_academicYear: context } });
      if (current && (!input.expectedUpdatedAt || current.updatedAt.toISOString() !== input.expectedUpdatedAt)) throw new Error("This report set changed. Refresh and review it before continuing.");
      if (mode === "PUBLISH" || mode === "REJECT") {
        if (current?.status !== "SUBMITTED") throw new Error("Only a submitted report set can be reviewed.");
      } else if (mode === "UNPUBLISH") {
        if (current?.status !== "PUBLISHED") throw new Error("Only published reports can be withdrawn.");
      } else if (current && !["UNPUBLISHED", "REJECTED"].includes(current.status)) throw new Error("This report set is already submitted or published.");
      if ((mode === "REJECT" || mode === "UNPUBLISH") && !input.notes?.trim()) throw new Error("Add a review reason before returning or withdrawing reports.");
      let readiness = null;
      if (mode === "SUBMIT" || mode === "PUBLISH") {
        readiness = await getClassReportReadiness(context, db, now);
        if (!readiness.currentPeriod) throw new Error("Reports can only be submitted or published for the active academic period.");
        if (!readiness.isReady) throw new Error(`Report set is incomplete. ${readiness.missingCount} entries need attention. ${readiness.issues.join(" ")}`);
        if (mode === "PUBLISH" && readiness.examRequired) {
          const window = await db.examEntryWindow.findUnique({ where: { schoolId_classId_term_academicYear: context }, select: { status: true, openedAt: true, closedAt: true } });
          if (!window || window.status === "LOCKED" || !["OPEN", "CLOSED"].includes(examEntryState(100, window))) throw new Error("Exam entry must have been validly opened for this class period before publication.");
        }
      }
      const changes = mode === "SUBMIT" ? { status: "SUBMITTED" as const, submittedAt: now, submittedBy: userId, notes: input.notes ?? null, reviewedAt: null, reviewedBy: null, reviewNote: null, unpublishedAt: null, unpublishedBy: null }
        : mode === "PUBLISH" ? { status: "PUBLISHED" as const, reviewedAt: now, reviewedBy: userId, reviewNote: input.notes ?? null, publishedAt: now, publishedBy: userId, unpublishedAt: null, unpublishedBy: null }
        : mode === "REJECT" ? { status: "REJECTED" as const, reviewedAt: now, reviewedBy: userId, reviewNote: input.notes! }
        : { status: "UNPUBLISHED" as const, unpublishedAt: now, unpublishedBy: userId, reviewNote: input.notes! };
      let id: number;
      if (current) {
        const claimed = await db.reportCardPublication.updateMany({ where: { id: current.id, ...context, status: current.status, updatedAt: current.updatedAt }, data: changes });
        if (claimed.count !== 1) throw new Error("Another reviewer changed this report set. Refresh before continuing.");
        id = current.id;
      } else {
        id = (await db.reportCardPublication.create({ data: { ...context, ...changes } })).id;
      }
      await db.cAAuditLog.create({ data: { schoolId, actorId: userId, action: ({ SUBMIT: "REPORT_CARDS_SUBMITTED_FOR_REVIEW", PUBLISH: "REPORT_CARDS_PUBLISHED", REJECT: "REPORT_CARDS_REJECTED", UNPUBLISH: "REPORT_CARDS_UNPUBLISHED" })[mode], entityType: "ReportCardPublication", entityId: String(id), message: `${cls.name}: ${mode.toLowerCase()} reports for ${input.academicYear} ${input.term}.`, metadata: { ...context, notes: input.notes ?? null, previousStatus: current?.status ?? "UNSUBMITTED", status: changes.status, studentCount: readiness?.studentCount ?? null, subjectCount: readiness?.subjectCount ?? null } } });
      return { id };
    }, { isolationLevel: "Serializable", timeout: 30000 });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && ["P2002", "P2034"].includes(String(error.code))) throw new Error("The report set changed during review. Refresh and review it again.");
    throw error;
  }
}
