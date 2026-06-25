-- Finance webhook inbox and DB-backed job queue foundation.

CREATE TYPE "FinanceJobType" AS ENUM (
  'GENERATE_BILLS',
  'GENERATE_RECEIPT_PDF',
  'GENERATE_DAILY_REPORT',
  'SEND_PAYMENT_RECEIPT',
  'SEND_PAYMENT_REMINDER',
  'RECOMPUTE_FINANCE_SUMMARY',
  'PROCESS_PAYMENT_WEBHOOK'
);

CREATE TYPE "JobStatus" AS ENUM (
  'PENDING',
  'PROCESSING',
  'COMPLETED',
  'FAILED',
  'CANCELLED'
);

CREATE TYPE "PaymentProvider" AS ENUM (
  'PAYSTACK',
  'STRIPE',
  'MANUAL',
  'OTHER'
);

CREATE TYPE "WebhookEventStatus" AS ENUM (
  'RECEIVED',
  'VERIFIED',
  'PROCESSING',
  'PROCESSED',
  'FAILED',
  'IGNORED'
);

CREATE TABLE "FinanceJob" (
  "id" TEXT NOT NULL,
  "type" "FinanceJobType" NOT NULL,
  "status" "JobStatus" NOT NULL DEFAULT 'PENDING',
  "payload" JSONB NOT NULL,
  "idempotencyKey" TEXT,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 3,
  "runAfter" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lockedAt" TIMESTAMP(3),
  "lockedBy" TEXT,
  "lastError" TEXT,
  "completedAt" TIMESTAMP(3),
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "schoolId" TEXT NOT NULL,

  CONSTRAINT "FinanceJob_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PaymentWebhookEvent" (
  "id" TEXT NOT NULL,
  "provider" "PaymentProvider" NOT NULL,
  "providerEventId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "status" "WebhookEventStatus" NOT NULL DEFAULT 'RECEIVED',
  "payload" JSONB NOT NULL,
  "signature" TEXT,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMP(3),
  "lastError" TEXT,
  "schoolId" TEXT,
  "paymentId" INTEGER,

  CONSTRAINT "PaymentWebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FinanceJob_idempotencyKey_key" ON "FinanceJob"("idempotencyKey");
CREATE INDEX "FinanceJob_schoolId_status_runAfter_idx" ON "FinanceJob"("schoolId", "status", "runAfter");
CREATE INDEX "FinanceJob_type_status_idx" ON "FinanceJob"("type", "status");

CREATE UNIQUE INDEX "PaymentWebhookEvent_provider_providerEventId_key" ON "PaymentWebhookEvent"("provider", "providerEventId");
CREATE INDEX "PaymentWebhookEvent_schoolId_status_receivedAt_idx" ON "PaymentWebhookEvent"("schoolId", "status", "receivedAt");
CREATE INDEX "PaymentWebhookEvent_provider_status_idx" ON "PaymentWebhookEvent"("provider", "status");

ALTER TABLE "FinanceJob"
ADD CONSTRAINT "FinanceJob_schoolId_fkey"
FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PaymentWebhookEvent"
ADD CONSTRAINT "PaymentWebhookEvent_schoolId_fkey"
FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PaymentWebhookEvent"
ADD CONSTRAINT "PaymentWebhookEvent_paymentId_fkey"
FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
