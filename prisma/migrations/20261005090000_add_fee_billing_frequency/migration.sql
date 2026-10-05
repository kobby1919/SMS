-- Add billing frequency to fee items so daily collections can be separated
-- from term/monthly/one-time student bills.
CREATE TYPE "FeeBillingFrequency" AS ENUM ('TERM', 'MONTHLY', 'WEEKLY', 'DAILY', 'ONE_TIME');

ALTER TABLE "FeeItem"
ADD COLUMN "billingFrequency" "FeeBillingFrequency" NOT NULL DEFAULT 'TERM';

CREATE INDEX "FeeItem_feeStructureId_billingFrequency_idx"
ON "FeeItem"("feeStructureId", "billingFrequency");
