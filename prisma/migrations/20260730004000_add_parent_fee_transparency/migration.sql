ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'FINANCE_QUERY_OPENED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'FINANCE_QUERY_RESOLVED';

CREATE TYPE "FinanceQueryReason" AS ENUM (
  'ALREADY_PAID',
  'WRONG_AMOUNT',
  'NEED_CLARIFICATION',
  'RECEIPT_ISSUE',
  'OTHER'
);

CREATE TYPE "FinanceQueryStatus" AS ENUM (
  'OPEN',
  'IN_REVIEW',
  'RESOLVED',
  'CLOSED'
);

ALTER TABLE "FeeStructure"
ADD COLUMN "dueDate" TIMESTAMP(3);

ALTER TABLE "StudentBill"
ADD COLUMN "dueDate" TIMESTAMP(3);

UPDATE "StudentBill" AS bill
SET "dueDate" = structure."dueDate"
FROM "FeeStructure" AS structure
WHERE bill."feeStructureId" = structure."id"
  AND bill."dueDate" IS NULL
  AND structure."dueDate" IS NOT NULL;

CREATE TABLE "FinanceQuery" (
  "id" SERIAL NOT NULL,
  "reason" "FinanceQueryReason" NOT NULL,
  "message" TEXT NOT NULL,
  "status" "FinanceQueryStatus" NOT NULL DEFAULT 'OPEN',
  "response" TEXT,
  "resolvedAt" TIMESTAMP(3),
  "resolvedBy" TEXT,
  "schoolId" TEXT NOT NULL,
  "parentId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "studentBillId" INTEGER NOT NULL,
  "paymentId" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "FinanceQuery_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "FinanceQuery"
ADD CONSTRAINT "FinanceQuery_schoolId_fkey"
FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "FinanceQuery"
ADD CONSTRAINT "FinanceQuery_parentId_fkey"
FOREIGN KEY ("parentId") REFERENCES "Parent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FinanceQuery"
ADD CONSTRAINT "FinanceQuery_studentId_fkey"
FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "FinanceQuery"
ADD CONSTRAINT "FinanceQuery_studentBillId_fkey"
FOREIGN KEY ("studentBillId") REFERENCES "StudentBill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "FinanceQuery"
ADD CONSTRAINT "FinanceQuery_paymentId_fkey"
FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "StudentBill_schoolId_dueDate_idx" ON "StudentBill"("schoolId", "dueDate");
CREATE INDEX "FinanceQuery_schoolId_status_createdAt_idx" ON "FinanceQuery"("schoolId", "status", "createdAt");
CREATE INDEX "FinanceQuery_schoolId_parentId_createdAt_idx" ON "FinanceQuery"("schoolId", "parentId", "createdAt");
CREATE INDEX "FinanceQuery_schoolId_studentBillId_status_idx" ON "FinanceQuery"("schoolId", "studentBillId", "status");
