import type { Prisma, Term } from "@/src/generated/prisma";
import prisma from "@/src/lib/prisma";
import { validAssessmentWeights } from "@/src/lib/academic-readiness-rules";

export async function requireActiveAcademicConfig(schoolId: string, db: Pick<Prisma.TransactionClient, "cAConfig"> = prisma) {
  const configs = await db.cAConfig.findMany({ where: { schoolId, isActive: true }, take: 2 });
  const config = configs.length === 1 ? configs[0] : null;
  if (!config || !validAssessmentWeights(config)) throw new Error("Activate one valid academic year and term before recording scores.");
  return config;
}

export type ActiveAcademicPeriod = {
  academicYear: string;
  currentTerm: Term;
  classworkWeight: number;
  examWeight: number;
  configId: number | null;
};

export async function getActiveAcademicPeriod(schoolId: string): Promise<ActiveAcademicPeriod> {
  const activeConfig = await prisma.cAConfig.findFirst({
    where: { schoolId, isActive: true },
    orderBy: [{ updatedAt: "desc" }, { academicYear: "desc" }],
  });

  const fallbackConfig = activeConfig ?? await prisma.cAConfig.findFirst({
    where: { schoolId },
    orderBy: [{ academicYear: "desc" }, { id: "desc" }],
  });

  return {
    academicYear: fallbackConfig?.academicYear ?? "2025/26",
    currentTerm: fallbackConfig?.currentTerm ?? "TERM_1",
    classworkWeight: fallbackConfig?.classworkWeight ?? 30,
    examWeight: fallbackConfig?.examWeight ?? 70,
    configId: fallbackConfig?.id ?? null,
  };
}
