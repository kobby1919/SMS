-- Payment correction workflow: immutable request/review/apply trail for payment mistakes.

CREATE TYPE "PaymentCorrectionStatus" AS ENUM (
  'PENDING_REVIEW',
  'APPROVED',
  'REJECTED',
  'APPLIED',
  'CANCELLED'
);

CREATE TYPE "PaymentCorrectionType" AS ENUM (
  'WRONG_AMOUNT',
  'WRONG_STUDENT',
  'DUPLICATE_PAYMENT',
  'WRONG_METHOD',
  'WRONG_REFERENCE',
  'PAYMENT_BOUNCED',
  'RECEIPT_CANCELLATION',
  'OTHER'
);

CREATE TYPE "PaymentCorrectionRequestedAction" AS ENUM (
  'REVERSE_PAYMENT',
  'REPLACE_PAYMENT',
  'MOVE_PAYMENT',
  'MARK_DUPLICATE',
  'FIX_REFERENCE_OR_METHOD',
  'CANCEL_RECEIPT'
);

ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PAYMENT_CORRECTION_REQUESTED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PAYMENT_CORRECTION_APPROVED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PAYMENT_CORRECTION_REJECTED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PAYMENT_CORRECTION_APPLIED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PAYMENT_CORRECTION_CANCELLED';

CREATE TABLE "PaymentCorrectionRequest" (
  "id" SERIAL PRIMARY KEY,
  "type" "PaymentCorrectionType" NOT NULL,
  "requestedAction" "PaymentCorrectionRequestedAction" NOT NULL,
  "status" "PaymentCorrectionStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
  "reason" TEXT NOT NULL,
  "proposedChange" TEXT,
  "evidenceRef" TEXT,
  "requestedBy" TEXT NOT NULL,
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedBy" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "reviewNote" TEXT,
  "appliedBy" TEXT,
  "appliedAt" TIMESTAMP(3),
  "schoolId" TEXT NOT NULL DEFAULT 'default-school',
  "originalPaymentId" INTEGER NOT NULL,
  "studentBillId" INTEGER NOT NULL,
  "correctedPaymentId" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PaymentCorrectionRequest_schoolId_fkey"
    FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "PaymentCorrectionRequest_originalPaymentId_fkey"
    FOREIGN KEY ("originalPaymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "PaymentCorrectionRequest_studentBillId_fkey"
    FOREIGN KEY ("studentBillId") REFERENCES "StudentBill"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "PaymentCorrectionRequest_correctedPaymentId_fkey"
    FOREIGN KEY ("correctedPaymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "PaymentCorrectionRequest_schoolId_status_requestedAt_idx"
  ON "PaymentCorrectionRequest"("schoolId", "status", "requestedAt");

CREATE INDEX "PaymentCorrectionRequest_schoolId_requestedBy_requestedAt_idx"
  ON "PaymentCorrectionRequest"("schoolId", "requestedBy", "requestedAt");

CREATE INDEX "PaymentCorrectionRequest_schoolId_originalPaymentId_idx"
  ON "PaymentCorrectionRequest"("schoolId", "originalPaymentId");

CREATE INDEX "PaymentCorrectionRequest_schoolId_studentBillId_idx"
  ON "PaymentCorrectionRequest"("schoolId", "studentBillId");

-- Prevent two open review flows fighting over one receipt.
CREATE UNIQUE INDEX "PaymentCorrectionRequest_one_open_per_payment"
  ON "PaymentCorrectionRequest"("schoolId", "originalPaymentId")
  WHERE "status" IN ('PENDING_REVIEW', 'APPROVED');
