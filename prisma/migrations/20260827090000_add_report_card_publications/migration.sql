CREATE TYPE "ReportPublicationStatus" AS ENUM ('PUBLISHED', 'UNPUBLISHED');

CREATE TABLE "ReportCardPublication" (
    "id" SERIAL NOT NULL,
    "academicYear" TEXT NOT NULL,
    "term" "Term" NOT NULL,
    "status" "ReportPublicationStatus" NOT NULL DEFAULT 'PUBLISHED',
    "notes" TEXT,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedBy" TEXT NOT NULL,
    "unpublishedAt" TIMESTAMP(3),
    "unpublishedBy" TEXT,
    "schoolId" TEXT NOT NULL DEFAULT 'default-school',
    "classId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReportCardPublication_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReportCardPublication_schoolId_classId_term_academicYear_key" ON "ReportCardPublication"("schoolId", "classId", "term", "academicYear");
CREATE INDEX "ReportCardPublication_schoolId_status_publishedAt_idx" ON "ReportCardPublication"("schoolId", "status", "publishedAt");
CREATE INDEX "ReportCardPublication_schoolId_classId_status_idx" ON "ReportCardPublication"("schoolId", "classId", "status");

ALTER TABLE "ReportCardPublication" ADD CONSTRAINT "ReportCardPublication_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReportCardPublication" ADD CONSTRAINT "ReportCardPublication_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;
