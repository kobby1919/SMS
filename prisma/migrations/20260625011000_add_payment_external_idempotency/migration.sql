-- Add structured external payment identity so webhook retries and provider callbacks
-- can be matched to one payment per school without relying on free-form notes.
ALTER TABLE "Payment"
  ADD COLUMN "externalProvider" "PaymentProvider",
  ADD COLUMN "externalReference" TEXT,
  ADD COLUMN "idempotencyKey" TEXT;

CREATE UNIQUE INDEX "Payment_schoolId_externalProvider_externalReference_key"
  ON "Payment"("schoolId", "externalProvider", "externalReference");

CREATE UNIQUE INDEX "Payment_schoolId_idempotencyKey_key"
  ON "Payment"("schoolId", "idempotencyKey");

CREATE INDEX "Payment_schoolId_externalProvider_idx"
  ON "Payment"("schoolId", "externalProvider");
