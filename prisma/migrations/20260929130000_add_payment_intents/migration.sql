DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PaymentIntentStatus') THEN
    CREATE TYPE "PaymentIntentStatus" AS ENUM (
      'PENDING_PROVIDER',
      'CHECKOUT_CREATED',
      'PAID',
      'FAILED',
      'CANCELLED',
      'EXPIRED'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "PaymentIntent" (
  "id" TEXT NOT NULL,
  "reference" TEXT NOT NULL,
  "provider" "PaymentProvider" NOT NULL,
  "status" "PaymentIntentStatus" NOT NULL DEFAULT 'PENDING_PROVIDER',
  "amount" DECIMAL(10,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'GHS',
  "checkoutUrl" TEXT,
  "providerSessionId" TEXT,
  "providerAuthorization" TEXT,
  "idempotencyKey" TEXT NOT NULL,
  "payerEmail" TEXT,
  "payerName" TEXT,
  "lastError" TEXT,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "schoolId" TEXT NOT NULL,
  "parentId" TEXT NOT NULL,
  CONSTRAINT "PaymentIntent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PaymentIntentLine" (
  "id" TEXT NOT NULL,
  "amount" DECIMAL(10,2) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "paymentIntentId" TEXT NOT NULL,
  "studentBillId" INTEGER NOT NULL,
  CONSTRAINT "PaymentIntentLine_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PaymentIntent_schoolId_reference_key" ON "PaymentIntent"("schoolId", "reference");
CREATE UNIQUE INDEX IF NOT EXISTS "PaymentIntent_schoolId_idempotencyKey_key" ON "PaymentIntent"("schoolId", "idempotencyKey");
CREATE INDEX IF NOT EXISTS "PaymentIntent_schoolId_parentId_status_createdAt_idx" ON "PaymentIntent"("schoolId", "parentId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "PaymentIntent_schoolId_status_expiresAt_idx" ON "PaymentIntent"("schoolId", "status", "expiresAt");
CREATE INDEX IF NOT EXISTS "PaymentIntent_provider_providerSessionId_idx" ON "PaymentIntent"("provider", "providerSessionId");
CREATE UNIQUE INDEX IF NOT EXISTS "PaymentIntentLine_paymentIntentId_studentBillId_key" ON "PaymentIntentLine"("paymentIntentId", "studentBillId");
CREATE INDEX IF NOT EXISTS "PaymentIntentLine_studentBillId_idx" ON "PaymentIntentLine"("studentBillId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PaymentIntent_schoolId_fkey') THEN
    ALTER TABLE "PaymentIntent" ADD CONSTRAINT "PaymentIntent_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PaymentIntent_parentId_fkey') THEN
    ALTER TABLE "PaymentIntent" ADD CONSTRAINT "PaymentIntent_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Parent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PaymentIntentLine_paymentIntentId_fkey') THEN
    ALTER TABLE "PaymentIntentLine" ADD CONSTRAINT "PaymentIntentLine_paymentIntentId_fkey" FOREIGN KEY ("paymentIntentId") REFERENCES "PaymentIntent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PaymentIntentLine_studentBillId_fkey') THEN
    ALTER TABLE "PaymentIntentLine" ADD CONSTRAINT "PaymentIntentLine_studentBillId_fkey" FOREIGN KEY ("studentBillId") REFERENCES "StudentBill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;