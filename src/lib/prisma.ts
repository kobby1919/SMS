import "dotenv/config";
import { PrismaClient } from "../generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const prismaClientSingleton = () => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL!,
    max: 10,
    connectionTimeoutMillis: 15_000,
    idleTimeoutMillis: 30_000,
  });

  const adapter = new PrismaPg(pool);

  return new PrismaClient({
    adapter,
    transactionOptions: {
      timeout: 15_000,      // raise interactive transaction timeout to 15s
      maxWait: 10_000,      // max time to wait for a connection slot
    },
  });
};

interface CustomGlobal extends Global {
  prismaGlobal?: ReturnType<typeof prismaClientSingleton>;
}

const customGlobal = global as unknown as CustomGlobal;
const requiredDelegates = [
  "teacherAccountabilitySetting",
  "teacherObligation",
  "teacherReminder",
  "teacherEscalation",
  "teacherCorrectionRequest",
  "teacherAccountabilityAuditLog",
] as const;

function hasRequiredDelegates(client: ReturnType<typeof prismaClientSingleton>) {
  const hasDelegates = requiredDelegates.every((delegate) => delegate in client);
  const runtimeModels = (client as unknown as {
    _runtimeDataModel?: {
      models?: Record<string, { fields?: Array<{ name: string }> }>;
    };
  })._runtimeDataModel?.models;
  const reportFields = runtimeModels?.ReportCardPublication?.fields ?? [];
  const reportFieldNames = new Set(reportFields.map((field) => field.name));
  const hasReportWorkflowFields = [
    "submittedAt",
    "submittedBy",
    "reviewedAt",
    "reviewedBy",
    "reviewNote",
  ].every((field) => reportFieldNames.has(field));

  return hasDelegates && hasReportWorkflowFields;
}

let prismaClient = customGlobal.prismaGlobal;

if (!prismaClient || !hasRequiredDelegates(prismaClient)) {
  if (prismaClient && process.env.NODE_ENV !== "production") {
    void prismaClient.$disconnect().catch(() => undefined);
  }
  prismaClient = prismaClientSingleton();
}

const prisma = prismaClient;
export default prisma;

if (process.env.NODE_ENV !== "production") customGlobal.prismaGlobal = prisma;
