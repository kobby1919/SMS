import prisma from "@/src/lib/prisma";
import { Prisma } from "@/src/generated/prisma";
import type { FinanceJobType, JobStatus } from "@/src/generated/prisma";

export type EnqueueFinanceJobInput = {
  schoolId: string;
  type: FinanceJobType;
  payload: Record<string, unknown>;
  idempotencyKey?: string;
  createdBy?: string;
  runAfter?: Date;
  maxAttempts?: number;
};

export async function enqueueFinanceJob(input: EnqueueFinanceJobInput) {
  const data = {
    schoolId: input.schoolId,
    type: input.type,
    payload: input.payload as Prisma.InputJsonValue,
    idempotencyKey: input.idempotencyKey,
    createdBy: input.createdBy,
    runAfter: input.runAfter ?? new Date(),
    maxAttempts: input.maxAttempts ?? 3,
  };

  if (input.idempotencyKey) {
    return prisma.financeJob.upsert({
      where: { idempotencyKey: input.idempotencyKey },
      update: {},
      create: data,
    });
  }

  return prisma.financeJob.create({ data });
}

export async function claimNextFinanceJob(workerId: string) {
  const job = await prisma.financeJob.findFirst({
    where: {
      status: "PENDING",
      runAfter: { lte: new Date() },
      attempts: { lt: 3 },
    },
    orderBy: [{ runAfter: "asc" }, { createdAt: "asc" }],
  });

  if (!job) return null;

  return prisma.financeJob.update({
    where: { id: job.id },
    data: {
      status: "PROCESSING",
      lockedAt: new Date(),
      lockedBy: workerId,
      attempts: { increment: 1 },
    },
  });
}

export async function completeFinanceJob(jobId: string) {
  return prisma.financeJob.update({
    where: { id: jobId },
    data: {
      status: "COMPLETED",
      completedAt: new Date(),
      lockedAt: null,
      lockedBy: null,
      lastError: null,
    },
  });
}

export async function failFinanceJob(
  jobId: string,
  error: unknown,
  nextStatus: JobStatus = "FAILED",
) {
  const message = error instanceof Error ? error.message : String(error);
  return prisma.financeJob.update({
    where: { id: jobId },
    data: {
      status: nextStatus,
      lastError: message.slice(0, 1000),
      lockedAt: null,
      lockedBy: null,
      runAfter: new Date(Date.now() + 5 * 60_000),
    },
  });
}
