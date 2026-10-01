DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'StudentStatus') THEN
    CREATE TYPE "StudentStatus" AS ENUM (
      'INCOMPLETE_SETUP',
      'ACTIVE',
      'TRANSFERRED',
      'GRADUATED',
      'WITHDRAWN'
    );
  END IF;
END $$;

ALTER TABLE "Student"
  ADD COLUMN IF NOT EXISTS "admissionNumber" TEXT,
  ADD COLUMN IF NOT EXISTS "status" "StudentStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS "Student_schoolId_status_idx" ON "Student"("schoolId", "status");
CREATE UNIQUE INDEX IF NOT EXISTS "Student_schoolId_admissionNumber_key" ON "Student"("schoolId", "admissionNumber");
