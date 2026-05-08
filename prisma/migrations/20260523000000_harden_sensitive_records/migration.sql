-- Step 3: harden auditability for sensitive records.

-- Results and attendance records now carry timestamps so changes can be traced.
ALTER TABLE "Result" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Result" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "Attendance" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Attendance" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Payment reversals are sensitive audit records. Scope them directly to a school
-- instead of requiring every report to traverse Payment -> StudentBill.
ALTER TABLE "PaymentReversal" ADD COLUMN "schoolId" TEXT NOT NULL DEFAULT 'default-school';

ALTER TABLE "PaymentReversal"
ADD CONSTRAINT "PaymentReversal_schoolId_fkey"
FOREIGN KEY ("schoolId") REFERENCES "School"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "PaymentReversal_schoolId_reversedAt_idx"
ON "PaymentReversal"("schoolId", "reversedAt");
