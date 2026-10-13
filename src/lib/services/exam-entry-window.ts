import "server-only";
import prisma from "@/src/lib/prisma";
import type { Term } from "@/src/generated/prisma";
import type { AuthzContext } from "@/src/lib/authz";
import { requireActiveAcademicConfig } from "@/src/lib/services/academic-period";
import { assertReportSetEditable } from "@/src/lib/services/report-publication";
import { examEntryState } from "@/src/lib/academic-readiness-rules";

export async function transitionExamEntryWindow(mode: "OPEN" | "CLOSE", input: { classId: number; term: Term; academicYear: string; notes?: string }, actor: AuthzContext) {
  if (actor.role !== "admin" || !actor.schoolId) throw new Error("Only a school admin can manage exam entry windows.");
  const { schoolId, userId } = actor;
  const context = { schoolId, classId: input.classId, term: input.term, academicYear: input.academicYear };
  try {
    return await prisma.$transaction(async (tx) => {
      const config = await requireActiveAcademicConfig(schoolId, tx);
      if (config.academicYear !== input.academicYear || config.currentTerm !== input.term || config.examWeight <= 0) throw new Error("Exam windows must use the active period with exams required.");
      const cls = await tx.class.findFirst({ where: { id: input.classId, schoolId }, select: { name: true } });
      if (!cls) throw new Error("Class not found in your school.");
      if (mode === "OPEN") await assertReportSetEditable(tx, context);
      const current = await tx.examEntryWindow.findUnique({ where: { schoolId_classId_term_academicYear: context } });
      const state = examEntryState(config.examWeight, current);
      if (mode === "OPEN" && state === "OPEN") return { id: current!.id };
      if (mode === "CLOSE" && state === "CLOSED" && current?.status === "CLOSED") return { id: current.id };
      if (mode === "CLOSE" && state !== "OPEN") throw new Error("Only an open exam window can be closed.");
      const now = new Date();
      const data = mode === "OPEN"
        ? { status: "OPEN" as const, openedAt: now, openedBy: userId, closedAt: null, closedBy: null, notes: input.notes }
        : { status: "CLOSED" as const, closedAt: now, closedBy: userId, notes: input.notes };
      let id: number;
      if (current) {
        const changed = await tx.examEntryWindow.updateMany({ where: { id: current.id, schoolId, status: current.status, updatedAt: current.updatedAt }, data });
        if (changed.count !== 1) throw new Error("Exam window changed. Refresh and try again.");
        id = current.id;
      } else {
        const created = await tx.examEntryWindow.create({ data: { ...context, ...data } });
        id = created.id;
      }
      await tx.cAAuditLog.create({ data: { schoolId, actorId: userId, action: mode === "OPEN" ? "EXAM_ENTRY_OPENED" : "EXAM_ENTRY_CLOSED",
        entityType: "ExamEntryWindow", entityId: String(id), message: `${cls.name} exam entry was ${mode === "OPEN" ? "opened" : "closed"} for ${input.academicYear} ${input.term.replace("_", " ")}.`, metadata: input } });
      return { id };
    }, { isolationLevel: "Serializable", timeout: 30000 });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && ["P2034", "P2002"].includes(String(error.code))) throw new Error("Exam window changed. Refresh and try again.");
    throw error;
  }
}
