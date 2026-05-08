-- Step 4: index hot query paths for multi-school scale.

-- Students: list by class/parent, monthly stats
CREATE INDEX "Student_schoolId_idx" ON "Student"("schoolId");
CREATE INDEX "Student_schoolId_classId_idx" ON "Student"("schoolId", "classId");
CREATE INDEX "Student_parentId_idx" ON "Student"("parentId");
CREATE INDEX "Student_schoolId_createdAt_idx" ON "Student"("schoolId", "createdAt");

-- Lessons: timetable and teacher/class filters
CREATE INDEX "Lesson_schoolId_teacherId_idx" ON "Lesson"("schoolId", "teacherId");
CREATE INDEX "Lesson_schoolId_classId_idx" ON "Lesson"("schoolId", "classId");
CREATE INDEX "Lesson_teacherId_classId_day_idx" ON "Lesson"("teacherId", "classId", "day");
CREATE INDEX "Lesson_schoolId_day_idx" ON "Lesson"("schoolId", "day");

-- Attendance: daily rolls, dashboards, report cards
CREATE INDEX "Attendance_schoolId_lessonId_date_idx" ON "Attendance"("schoolId", "lessonId", "date");
CREATE INDEX "Attendance_schoolId_date_status_idx" ON "Attendance"("schoolId", "date", "status");
CREATE INDEX "Attendance_studentId_date_status_idx" ON "Attendance"("studentId", "date", "status");
CREATE INDEX "Attendance_schoolId_studentId_date_idx" ON "Attendance"("schoolId", "studentId", "date");

-- Continuous assessment: class/year reports
CREATE INDEX "ContinuousAssessment_schoolId_studentId_idx" ON "ContinuousAssessment"("schoolId", "studentId");
CREATE INDEX "ContinuousAssessment_schoolId_classId_term_academicYear_idx" ON "ContinuousAssessment"("schoolId", "classId", "term", "academicYear");

-- Fee structures and bills
CREATE INDEX "FeeStructure_schoolId_status_idx" ON "FeeStructure"("schoolId", "status");
CREATE INDEX "StudentBill_schoolId_status_idx" ON "StudentBill"("schoolId", "status");
CREATE INDEX "StudentBill_schoolId_feeStructureId_idx" ON "StudentBill"("schoolId", "feeStructureId");
CREATE INDEX "StudentBill_schoolId_studentId_idx" ON "StudentBill"("schoolId", "studentId");
CREATE INDEX "StudentBill_feeStructureId_idx" ON "StudentBill"("feeStructureId");

-- Payments: ledger filters and aggregates
CREATE INDEX "Payment_schoolId_paymentDate_idx" ON "Payment"("schoolId", "paymentDate");
CREATE INDEX "Payment_schoolId_status_idx" ON "Payment"("schoolId", "status");
CREATE INDEX "Payment_schoolId_paymentDate_status_idx" ON "Payment"("schoolId", "paymentDate", "status");
CREATE INDEX "Payment_studentBillId_idx" ON "Payment"("studentBillId");

-- Finance audit trail
CREATE INDEX "FinanceAuditLog_schoolId_createdAt_idx" ON "FinanceAuditLog"("schoolId", "createdAt");
CREATE INDEX "FinanceAuditLog_schoolId_action_idx" ON "FinanceAuditLog"("schoolId", "action");
