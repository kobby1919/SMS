CREATE TYPE "TeacherStatus" AS ENUM ('INVITED', 'ACTIVE', 'INCOMPLETE_SETUP', 'SUSPENDED', 'LEFT_SCHOOL');

ALTER TABLE "Teacher"
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "status" "TeacherStatus" NOT NULL DEFAULT 'ACTIVE';

CREATE INDEX "Teacher_schoolId_status_idx" ON "Teacher"("schoolId", "status");
