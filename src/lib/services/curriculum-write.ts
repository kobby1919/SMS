import "server-only";
import { Prisma } from "@/src/generated/prisma";
import prisma from "@/src/lib/prisma";

export async function withCurriculumWrite<T>(work: (db: Prisma.TransactionClient) => Promise<T>) {
  try {
    return await prisma.$transaction(work, { isolationLevel: "Serializable", timeout: 30000 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && ["P2034", "P2002"].includes(error.code)) throw new Error("Curriculum records changed. Refresh and review before trying again.");
    throw error;
  }
}
