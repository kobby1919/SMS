CREATE TYPE "ExamEntryStatus" AS ENUM ('LOCKED', 'OPEN', 'CLOSED');

CREATE TABLE "ExamEntryWindow" (
    "id" SERIAL NOT NULL,
    "academicYear" TEXT NOT NULL,
    "term" "Term" NOT NULL,
    "status" "ExamEntryStatus" NOT NULL DEFAULT 'LOCKED',
    "openedAt" TIMESTAMP(3),
    "openedBy" TEXT,
    "closedAt" TIMESTAMP(3),
    "closedBy" TEXT,
    "notes" TEXT,
    "schoolId" TEXT NOT NULL DEFAULT 'default-school',
    "classId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExamEntryWindow_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ExamEntryWindow_schoolId_classId_term_academicYear_key" ON "ExamEntryWindow"("schoolId", "classId", "term", "academicYear");
CREATE INDEX "ExamEntryWindow_schoolId_classId_status_idx" ON "ExamEntryWindow"("schoolId", "classId", "status");
CREATE INDEX "ExamEntryWindow_schoolId_status_updatedAt_idx" ON "ExamEntryWindow"("schoolId", "status", "updatedAt");

ALTER TABLE "ExamEntryWindow" ADD CONSTRAINT "ExamEntryWindow_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExamEntryWindow" ADD CONSTRAINT "ExamEntryWindow_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;
