import type { SchoolPeriodType } from "@/src/generated/prisma";
import prisma from "@/src/lib/prisma";
import { revalidateReferenceData } from "@/src/lib/cacheTags";
import {
  getSchoolOperatingWindowStatus,
  isTimeRangeWithinWindow,
  timeToMinutes,
} from "@/src/lib/services/school-operating-hours";

export class PeriodTemplateServiceError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 404 | 409,
  ) {
    super(message);
    this.name = "PeriodTemplateServiceError";
  }
}

export type PeriodTemplateInput = {
  name: string;
  type: SchoolPeriodType;
  startTime: string;
  endTime: string;
  order: number;
  isActive: boolean;
};

const DEFAULT_PERIODS: PeriodTemplateInput[] = [
  { name: "Period 1", type: "TEACHING", startTime: "07:30", endTime: "08:10", order: 1, isActive: true },
  { name: "Period 2", type: "TEACHING", startTime: "08:10", endTime: "08:50", order: 2, isActive: true },
  { name: "Period 3", type: "TEACHING", startTime: "08:50", endTime: "09:30", order: 3, isActive: true },
  { name: "Break", type: "BREAK", startTime: "09:30", endTime: "09:50", order: 4, isActive: true },
  { name: "Period 4", type: "TEACHING", startTime: "09:50", endTime: "10:30", order: 5, isActive: true },
  { name: "Period 5", type: "TEACHING", startTime: "10:30", endTime: "11:10", order: 6, isActive: true },
  { name: "Period 6", type: "TEACHING", startTime: "11:10", endTime: "11:50", order: 7, isActive: true },
  { name: "Lunch", type: "LUNCH", startTime: "11:50", endTime: "12:30", order: 8, isActive: true },
  { name: "Period 7", type: "TEACHING", startTime: "12:30", endTime: "13:10", order: 9, isActive: true },
  { name: "Period 8", type: "TEACHING", startTime: "13:10", endTime: "13:50", order: 10, isActive: true },
];

function validatePeriodTimeRange(input: PeriodTemplateInput) {
  if (timeToMinutes(input.endTime) <= timeToMinutes(input.startTime)) {
    throw new PeriodTemplateServiceError("Period end time must be after start time.", 400);
  }
}

async function validateAgainstSchoolHours(schoolId: string, input: PeriodTemplateInput) {
  const operatingRules = await getSchoolOperatingWindowStatus(schoolId);
  if (
    !isTimeRangeWithinWindow(
      input.startTime,
      input.endTime,
      operatingRules.openingTime,
      operatingRules.closingTime,
    )
  ) {
    throw new PeriodTemplateServiceError(
      `Period must stay within school hours (${operatingRules.openingTime}-${operatingRules.closingTime}, ${operatingRules.timezone}).`,
      400,
    );
  }
}

async function validatePeriodConflicts(
  schoolId: string,
  input: PeriodTemplateInput,
  excludeId?: string,
) {
  if (!input.isActive) return;

  const periods = await prisma.schoolPeriodTemplate.findMany({
    where: {
      schoolId,
      isActive: true,
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
    select: { name: true, startTime: true, endTime: true, order: true },
  });

  const start = timeToMinutes(input.startTime);
  const end = timeToMinutes(input.endTime);
  const sameOrder = periods.find((period) => period.order === input.order);
  if (sameOrder) {
    throw new PeriodTemplateServiceError(
      `${input.name} uses order #${input.order}, but ${sameOrder.name} already uses that order.`,
      409,
    );
  }

  const conflict = periods.find((period) => {
    const periodStart = timeToMinutes(period.startTime);
    const periodEnd = timeToMinutes(period.endTime);
    return start < periodEnd && end > periodStart;
  });

  if (conflict) {
    throw new PeriodTemplateServiceError(
      `${input.name} overlaps with ${conflict.name}. Period templates should not overlap.`,
      409,
    );
  }
}

function invalidatePeriodTemplates(schoolId: string) {
  revalidateReferenceData(schoolId, "timetable");
}

export async function ensureDefaultPeriodTemplates(schoolId: string) {
  const count = await prisma.schoolPeriodTemplate.count({ where: { schoolId } });
  if (count > 0) return;

  const operatingRules = await getSchoolOperatingWindowStatus(schoolId);
  const defaults = DEFAULT_PERIODS.filter((period) =>
    isTimeRangeWithinWindow(
      period.startTime,
      period.endTime,
      operatingRules.openingTime,
      operatingRules.closingTime,
    ),
  );

  await prisma.schoolPeriodTemplate.createMany({
    data: defaults.map((period) => ({ ...period, schoolId })),
    skipDuplicates: true,
  });
  invalidatePeriodTemplates(schoolId);
}

export async function listPeriodTemplates(schoolId: string) {
  await ensureDefaultPeriodTemplates(schoolId);
  return prisma.schoolPeriodTemplate.findMany({
    where: { schoolId },
    orderBy: [{ order: "asc" }, { startTime: "asc" }],
  });
}

export async function createPeriodTemplate(schoolId: string, input: PeriodTemplateInput) {
  validatePeriodTimeRange(input);
  await validateAgainstSchoolHours(schoolId, input);
  await validatePeriodConflicts(schoolId, input);

  const period = await prisma.schoolPeriodTemplate.create({
    data: { ...input, schoolId },
  });
  invalidatePeriodTemplates(schoolId);
  return period;
}

export async function updatePeriodTemplate(
  schoolId: string,
  id: string,
  input: PeriodTemplateInput,
) {
  const existing = await prisma.schoolPeriodTemplate.findFirst({
    where: { id, schoolId },
    select: {
      id: true,
      type: true,
      startTime: true,
      endTime: true,
      isActive: true,
      _count: { select: { lessons: true } },
    },
  });
  if (!existing) throw new PeriodTemplateServiceError("Period template not found.", 404);

  if (existing._count.lessons > 0) {
    const changedTiming =
      existing.startTime !== input.startTime || existing.endTime !== input.endTime;
    const changedType = existing.type !== input.type;
    const deactivated = existing.isActive && !input.isActive;
    if (changedTiming || changedType || deactivated) {
      throw new PeriodTemplateServiceError(
        "This period already has lessons. You can rename or reorder it, but you cannot change its time, type, or active status until those lessons are moved or removed.",
        409,
      );
    }
  }

  validatePeriodTimeRange(input);
  await validateAgainstSchoolHours(schoolId, input);
  await validatePeriodConflicts(schoolId, input, id);

  const period = await prisma.schoolPeriodTemplate.update({
    where: { id },
    data: input,
  });
  invalidatePeriodTemplates(schoolId);
  return period;
}

export async function deletePeriodTemplate(schoolId: string, id: string) {
  const existing = await prisma.schoolPeriodTemplate.findFirst({
    where: { id, schoolId },
    select: { id: true, _count: { select: { lessons: true } } },
  });
  if (!existing) throw new PeriodTemplateServiceError("Period template not found.", 404);

  if (existing._count.lessons > 0) {
    throw new PeriodTemplateServiceError(
      "This period has lessons. Move or delete those lessons before removing the period.",
      409,
    );
  }

  await prisma.schoolPeriodTemplate.delete({ where: { id } });
  invalidatePeriodTemplates(schoolId);
  return null;
}
