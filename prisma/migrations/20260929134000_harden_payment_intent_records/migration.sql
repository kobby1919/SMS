ALTER TABLE "PaymentIntent"
  ALTER COLUMN "status" SET DEFAULT 'PENDING';

ALTER TABLE "PaymentIntent"
  ADD COLUMN IF NOT EXISTS "studentId" TEXT;

UPDATE "PaymentIntent" AS intent
SET "studentId" = bill."studentId"
FROM "PaymentIntentLine" AS line
JOIN "StudentBill" AS bill ON bill."id" = line."studentBillId"
WHERE line."paymentIntentId" = intent."id"
  AND intent."studentId" IS NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "PaymentIntent" WHERE "studentId" IS NULL) THEN
    RAISE EXCEPTION 'Cannot make PaymentIntent.studentId required while records without bill-backed student exist.';
  END IF;
END $$;

ALTER TABLE "PaymentIntent"
  ALTER COLUMN "studentId" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "PaymentIntent_schoolId_studentId_status_createdAt_idx"
  ON "PaymentIntent"("schoolId", "studentId", "status", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PaymentIntent_studentId_fkey') THEN
    ALTER TABLE "PaymentIntent"
      ADD CONSTRAINT "PaymentIntent_studentId_fkey"
      FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;