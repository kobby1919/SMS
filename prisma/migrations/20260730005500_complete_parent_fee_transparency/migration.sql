ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'PENDING';
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'FAILED';

CREATE TYPE "DiscountStatus" AS ENUM ('ACTIVE', 'REMOVED');

ALTER TABLE "Discount"
  ADD COLUMN "status" "DiscountStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "removedBy" TEXT,
  ADD COLUMN "removeReason" TEXT,
  ADD COLUMN "removedAt" TIMESTAMP(3);

CREATE INDEX "Discount_schoolId_status_createdAt_idx"
  ON "Discount"("schoolId", "status", "createdAt");

CREATE INDEX "Discount_schoolId_studentBillId_status_idx"
  ON "Discount"("schoolId", "studentBillId", "status");
