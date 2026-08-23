-- CreateEnum
CREATE TYPE "HomeworkSubmissionStatus" AS ENUM ('PENDING', 'SUBMITTED', 'LATE', 'MISSING', 'EXCUSED');

-- CreateTable
CREATE TABLE "HomeworkSubmission" (
    "id" SERIAL NOT NULL,
    "status" "HomeworkSubmissionStatus" NOT NULL DEFAULT 'PENDING',
    "submittedAt" TIMESTAMP(3),
    "checkedAt" TIMESTAMP(3),
    "note" TEXT,
    "schoolId" TEXT NOT NULL DEFAULT 'default-school',
    "assignmentId" INTEGER NOT NULL,
    "studentId" TEXT NOT NULL,
    "checkedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HomeworkSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "HomeworkSubmission_schoolId_assignmentId_studentId_key" ON "HomeworkSubmission"("schoolId", "assignmentId", "studentId");

-- CreateIndex
CREATE INDEX "HomeworkSubmission_schoolId_studentId_status_idx" ON "HomeworkSubmission"("schoolId", "studentId", "status");

-- CreateIndex
CREATE INDEX "HomeworkSubmission_schoolId_assignmentId_status_idx" ON "HomeworkSubmission"("schoolId", "assignmentId", "status");

-- CreateIndex
CREATE INDEX "HomeworkSubmission_schoolId_checkedAt_idx" ON "HomeworkSubmission"("schoolId", "checkedAt");

-- CreateIndex
CREATE INDEX "HomeworkSubmission_schoolId_checkedById_idx" ON "HomeworkSubmission"("schoolId", "checkedById");

-- AddForeignKey
ALTER TABLE "HomeworkSubmission" ADD CONSTRAINT "HomeworkSubmission_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomeworkSubmission" ADD CONSTRAINT "HomeworkSubmission_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomeworkSubmission" ADD CONSTRAINT "HomeworkSubmission_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomeworkSubmission" ADD CONSTRAINT "HomeworkSubmission_checkedById_fkey" FOREIGN KEY ("checkedById") REFERENCES "Teacher"("id") ON DELETE SET NULL ON UPDATE CASCADE;
