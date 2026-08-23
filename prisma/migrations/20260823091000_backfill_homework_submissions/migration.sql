INSERT INTO "HomeworkSubmission" ("schoolId", "assignmentId", "studentId", "createdAt", "updatedAt")
SELECT
  a."schoolId",
  a."id",
  s."id",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Assignment" a
JOIN "Lesson" l
  ON l."id" = a."lessonId"
 AND l."schoolId" = a."schoolId"
JOIN "Student" s
  ON s."classId" = l."classId"
 AND s."schoolId" = a."schoolId"
ON CONFLICT ("schoolId", "assignmentId", "studentId") DO NOTHING;
