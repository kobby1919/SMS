-- Step 4: complete composite indexes for the exact dashboard and list hot paths.

-- Students by parent within a school.
CREATE INDEX "Student_schoolId_parentId_idx"
ON "Student"("schoolId", "parentId");

-- Timetable conflict checks and lesson filtering by teacher/class/day.
CREATE INDEX "Lesson_schoolId_teacherId_classId_day_idx"
ON "Lesson"("schoolId", "teacherId", "classId", "day");

-- Attendance summaries by student, date window, and status.
CREATE INDEX "Attendance_schoolId_studentId_date_status_idx"
ON "Attendance"("schoolId", "studentId", "date", "status");

-- Finance bill lists commonly filter status with student or fee structure.
CREATE INDEX "StudentBill_schoolId_status_studentId_idx"
ON "StudentBill"("schoolId", "status", "studentId");

CREATE INDEX "StudentBill_schoolId_status_feeStructureId_idx"
ON "StudentBill"("schoolId", "status", "feeStructureId");
