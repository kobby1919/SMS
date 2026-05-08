-- Replace global school-local uniqueness with tenant-scoped uniqueness.

-- Drop old global unique indexes.
DROP INDEX IF EXISTS "Grade_level_key";
DROP INDEX IF EXISTS "Grade_order_key";
DROP INDEX IF EXISTS "Class_name_key";
DROP INDEX IF EXISTS "Subject_name_key";
DROP INDEX IF EXISTS "CAConfig_academicYear_key";
DROP INDEX IF EXISTS "Attendance_studentId_lessonId_date_key";
DROP INDEX IF EXISTS "ContinuousAssessment_studentId_subjectId_classId_term_academicYear_key";
DROP INDEX IF EXISTS "Syllabus_subjectId_gradeId_term_academicYear_key";
DROP INDEX IF EXISTS "SyllabusTopicProgress_syllabusTopicId_classId_key";
DROP INDEX IF EXISTS "FeeStructure_gradeId_term_academicYear_key";
DROP INDEX IF EXISTS "StudentBill_studentId_feeStructureId_key";
DROP INDEX IF EXISTS "Payment_receiptNumber_key";
DROP INDEX IF EXISTS "ReceiptCounter_year_key";

-- Create tenant-scoped unique indexes.
CREATE UNIQUE INDEX "Grade_schoolId_level_key" ON "Grade"("schoolId", "level");
CREATE UNIQUE INDEX "Grade_schoolId_order_key" ON "Grade"("schoolId", "order");
CREATE UNIQUE INDEX "Class_schoolId_name_key" ON "Class"("schoolId", "name");
CREATE UNIQUE INDEX "Subject_schoolId_name_key" ON "Subject"("schoolId", "name");
CREATE UNIQUE INDEX "CAConfig_schoolId_academicYear_key" ON "CAConfig"("schoolId", "academicYear");
CREATE UNIQUE INDEX "Attendance_schoolId_studentId_lessonId_date_key" ON "Attendance"("schoolId", "studentId", "lessonId", "date");
CREATE UNIQUE INDEX "ContinuousAssessment_schoolId_studentId_subjectId_classId_term_academicYear_key" ON "ContinuousAssessment"("schoolId", "studentId", "subjectId", "classId", "term", "academicYear");
CREATE UNIQUE INDEX "Syllabus_schoolId_subjectId_gradeId_term_academicYear_key" ON "Syllabus"("schoolId", "subjectId", "gradeId", "term", "academicYear");
CREATE UNIQUE INDEX "SyllabusTopicProgress_schoolId_syllabusTopicId_classId_key" ON "SyllabusTopicProgress"("schoolId", "syllabusTopicId", "classId");
CREATE UNIQUE INDEX "FeeStructure_schoolId_gradeId_term_academicYear_key" ON "FeeStructure"("schoolId", "gradeId", "term", "academicYear");
CREATE UNIQUE INDEX "StudentBill_schoolId_studentId_feeStructureId_key" ON "StudentBill"("schoolId", "studentId", "feeStructureId");
CREATE UNIQUE INDEX "Payment_schoolId_receiptNumber_key" ON "Payment"("schoolId", "receiptNumber");
CREATE UNIQUE INDEX "ReceiptCounter_schoolId_year_key" ON "ReceiptCounter"("schoolId", "year");
