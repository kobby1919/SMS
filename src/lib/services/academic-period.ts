import type { Term } from "@/src/generated/prisma";
import prisma from "@/src/lib/prisma";

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
