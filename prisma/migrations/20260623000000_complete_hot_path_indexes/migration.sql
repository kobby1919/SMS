-- Complete Step 4 indexes for tenant-scoped list, dashboard, and report queries.

CREATE INDEX "Admin_schoolId_idx" ON "Admin"("schoolId");
CREATE INDEX "Teacher_schoolId_idx" ON "Teacher"("schoolId");
CREATE INDEX "Teacher_schoolId_createdAt_idx" ON "Teacher"("schoolId", "createdAt");
CREATE INDEX "Parent_schoolId_idx" ON "Parent"("schoolId");
CREATE INDEX "Parent_schoolId_createdAt_idx" ON "Parent"("schoolId", "createdAt");
CREATE INDEX "Exam_schoolId_startTime_idx" ON "Exam"("schoolId", "startTime");
CREATE INDEX "Exam_schoolId_lessonId_idx" ON "Exam"("schoolId", "lessonId");
CREATE INDEX "Assignment_schoolId_dueDate_idx" ON "Assignment"("schoolId", "dueDate");
CREATE INDEX "Assignment_schoolId_lessonId_idx" ON "Assignment"("schoolId", "lessonId");
CREATE INDEX "Result_schoolId_studentId_idx" ON "Result"("schoolId", "studentId");
CREATE INDEX "Result_schoolId_examId_idx" ON "Result"("schoolId", "examId");
CREATE INDEX "Result_schoolId_assignmentId_idx" ON "Result"("schoolId", "assignmentId");
CREATE INDEX "Result_schoolId_createdAt_idx" ON "Result"("schoolId", "createdAt");
CREATE INDEX "Event_schoolId_startTime_idx" ON "Event"("schoolId", "startTime");
CREATE INDEX "Event_schoolId_classId_idx" ON "Event"("schoolId", "classId");
CREATE INDEX "Announcement_schoolId_date_idx" ON "Announcement"("schoolId", "date");
CREATE INDEX "Announcement_schoolId_classId_idx" ON "Announcement"("schoolId", "classId");
CREATE INDEX "Syllabus_schoolId_status_idx" ON "Syllabus"("schoolId", "status");
CREATE INDEX "Syllabus_schoolId_gradeId_term_academicYear_idx"
ON "Syllabus"("schoolId", "gradeId", "term", "academicYear");
