-- Parent-student access lifecycle for real parent onboarding.
-- Keeps the legacy Student.parentId field while adding auditable, status-based access.

DO $$ BEGIN
  CREATE TYPE "ParentStudentRelationshipStatus" AS ENUM ('ACTIVE', 'REMOVED', 'TRANSFERRED', 'REVOKED', 'GRADUATED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "ParentStudentRelationshipRole" AS ENUM ('PRIMARY_GUARDIAN', 'GUARDIAN', 'EMERGENCY_CONTACT', 'FINANCE_CONTACT', 'PICKUP_AUTHORIZED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "ParentStudentRelationship" (
  "id" TEXT PRIMARY KEY DEFAULT ('psr_' || replace(gen_random_uuid()::text, '-', '')),
  "status" "ParentStudentRelationshipStatus" NOT NULL DEFAULT 'ACTIVE',
  "role" "ParentStudentRelationshipRole" NOT NULL DEFAULT 'PRIMARY_GUARDIAN',
  "canViewFees" BOOLEAN NOT NULL DEFAULT true,
  "canViewReports" BOOLEAN NOT NULL DEFAULT true,
  "canMessageSchool" BOOLEAN NOT NULL DEFAULT true,
  "note" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "schoolId" TEXT NOT NULL,
  "parentId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "createdById" TEXT,
  "updatedById" TEXT,
  CONSTRAINT "ParentStudentRelationship_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ParentStudentRelationship_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Parent"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ParentStudentRelationship_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "ParentStudentRelationship_schoolId_parentId_studentId_key"
  ON "ParentStudentRelationship" ("schoolId", "parentId", "studentId");

CREATE INDEX IF NOT EXISTS "ParentStudentRelationship_schoolId_parentId_status_idx"
  ON "ParentStudentRelationship" ("schoolId", "parentId", "status");

CREATE INDEX IF NOT EXISTS "ParentStudentRelationship_schoolId_studentId_status_idx"
  ON "ParentStudentRelationship" ("schoolId", "studentId", "status");

CREATE INDEX IF NOT EXISTS "ParentStudentRelationship_schoolId_status_updatedAt_idx"
  ON "ParentStudentRelationship" ("schoolId", "status", "updatedAt");

INSERT INTO "ParentStudentRelationship" (
  "schoolId", "parentId", "studentId", "status", "role", "createdAt", "updatedAt", "startedAt"
)
SELECT s."schoolId", s."parentId", s."id", 'ACTIVE', 'PRIMARY_GUARDIAN', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Student" s
JOIN "Parent" p ON p."id" = s."parentId" AND p."schoolId" = s."schoolId"
ON CONFLICT ("schoolId", "parentId", "studentId") DO UPDATE SET
  "status" = 'ACTIVE',
  "endedAt" = NULL,
  "updatedAt" = CURRENT_TIMESTAMP;
