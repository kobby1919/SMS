-- CreateEnum
DO $$
BEGIN
  CREATE TYPE "PaymentFeePayerRule" AS ENUM ('SCHOOL_ABSORBS', 'PARENT_PAYS');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "SchoolPaymentSetting" (
    "id" TEXT NOT NULL,
    "onlinePaymentsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "provider" "PaymentProvider" NOT NULL DEFAULT 'PAYSTACK',
    "publicKey" TEXT,
    "encryptedSecretKey" TEXT,
    "encryptedWebhookSecret" TEXT,
    "acceptedPaymentMethods" "PaymentMethod"[] NOT NULL DEFAULT ARRAY[]::"PaymentMethod"[],
    "settlementAccountReference" TEXT,
    "feePayerRule" "PaymentFeePayerRule" NOT NULL DEFAULT 'SCHOOL_ABSORBS',
    "configuredBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "schoolId" TEXT NOT NULL,

    CONSTRAINT "SchoolPaymentSetting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "SchoolPaymentSetting_schoolId_key" ON "SchoolPaymentSetting"("schoolId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SchoolPaymentSetting_schoolId_onlinePaymentsEnabled_idx" ON "SchoolPaymentSetting"("schoolId", "onlinePaymentsEnabled");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SchoolPaymentSetting_provider_idx" ON "SchoolPaymentSetting"("provider");

-- AddForeignKey
DO $$
BEGIN
  ALTER TABLE "SchoolPaymentSetting" ADD CONSTRAINT "SchoolPaymentSetting_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;