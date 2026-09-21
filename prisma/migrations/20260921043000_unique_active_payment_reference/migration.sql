CREATE UNIQUE INDEX IF NOT EXISTS "Payment_school_method_reference_active_unique"
  ON "Payment" ("schoolId", "paymentMethod", lower("referenceNo"))
  WHERE "referenceNo" IS NOT NULL
    AND "status" IN ('PENDING', 'CONFIRMED');