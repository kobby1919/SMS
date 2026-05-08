-- CreateTable
CREATE TABLE "School" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "School_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "School_slug_key" ON "School"("slug");

-- Seed the existing single-school data into one explicit tenant.
INSERT INTO "School" ("id", "name", "slug", "createdAt", "updatedAt")
VALUES ('default-school', 'Default School', 'default-school', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

-- Add tenant ownership columns with a default for existing data.
ALTER TABLE "Admin" ADD COLUMN "schoolId" TEXT NOT NULL DEFAULT 'default-school';
ALTER TABLE "Student" ADD COLUMN "schoolId" TEXT NOT NULL DEFAULT 'default-school';
ALTER TABLE "Teacher" ADD COLUMN "schoolId" TEXT NOT NULL DEFAULT 'default-school';
ALTER TABLE "Parent" ADD COLUMN "schoolId" TEXT NOT NULL DEFAULT 'default-school';
ALTER TABLE "Grade" ADD COLUMN "schoolId" TEXT NOT NULL DEFAULT 'default-school';
ALTER TABLE "Class" ADD COLUMN "schoolId" TEXT NOT NULL DEFAULT 'default-school';
ALTER TABLE "Subject" ADD COLUMN "schoolId" TEXT NOT NULL DEFAULT 'default-school';
ALTER TABLE "Lesson" ADD COLUMN "schoolId" TEXT NOT NULL DEFAULT 'default-school';
ALTER TABLE "Exam" ADD COLUMN "schoolId" TEXT NOT NULL DEFAULT 'default-school';
ALTER TABLE "Assignment" ADD COLUMN "schoolId" TEXT NOT NULL DEFAULT 'default-school';
ALTER TABLE "Result" ADD COLUMN "schoolId" TEXT NOT NULL DEFAULT 'default-school';
ALTER TABLE "Attendance" ADD COLUMN "schoolId" TEXT NOT NULL DEFAULT 'default-school';
ALTER TABLE "Event" ADD COLUMN "schoolId" TEXT NOT NULL DEFAULT 'default-school';
ALTER TABLE "Announcement" ADD COLUMN "schoolId" TEXT NOT NULL DEFAULT 'default-school';
ALTER TABLE "CAConfig" ADD COLUMN "schoolId" TEXT NOT NULL DEFAULT 'default-school';
ALTER TABLE "ContinuousAssessment" ADD COLUMN "schoolId" TEXT NOT NULL DEFAULT 'default-school';
ALTER TABLE "Syllabus" ADD COLUMN "schoolId" TEXT NOT NULL DEFAULT 'default-school';
ALTER TABLE "SyllabusTopicProgress" ADD COLUMN "schoolId" TEXT NOT NULL DEFAULT 'default-school';
ALTER TABLE "FeeStructure" ADD COLUMN "schoolId" TEXT NOT NULL DEFAULT 'default-school';
ALTER TABLE "StudentBill" ADD COLUMN "schoolId" TEXT NOT NULL DEFAULT 'default-school';
ALTER TABLE "Payment" ADD COLUMN "schoolId" TEXT NOT NULL DEFAULT 'default-school';
ALTER TABLE "Discount" ADD COLUMN "schoolId" TEXT NOT NULL DEFAULT 'default-school';
ALTER TABLE "ReceiptCounter" ADD COLUMN "schoolId" TEXT NOT NULL DEFAULT 'default-school';
ALTER TABLE "FinanceAuditLog" ADD COLUMN "schoolId" TEXT NOT NULL DEFAULT 'default-school';

-- AddForeignKey
ALTER TABLE "Admin" ADD CONSTRAINT "Admin_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Student" ADD CONSTRAINT "Student_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Teacher" ADD CONSTRAINT "Teacher_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Parent" ADD CONSTRAINT "Parent_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Grade" ADD CONSTRAINT "Grade_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Class" ADD CONSTRAINT "Class_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Subject" ADD CONSTRAINT "Subject_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Exam" ADD CONSTRAINT "Exam_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Result" ADD CONSTRAINT "Result_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Event" ADD CONSTRAINT "Event_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CAConfig" ADD CONSTRAINT "CAConfig_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ContinuousAssessment" ADD CONSTRAINT "ContinuousAssessment_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Syllabus" ADD CONSTRAINT "Syllabus_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SyllabusTopicProgress" ADD CONSTRAINT "SyllabusTopicProgress_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FeeStructure" ADD CONSTRAINT "FeeStructure_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StudentBill" ADD CONSTRAINT "StudentBill_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Discount" ADD CONSTRAINT "Discount_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReceiptCounter" ADD CONSTRAINT "ReceiptCounter_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FinanceAuditLog" ADD CONSTRAINT "FinanceAuditLog_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
