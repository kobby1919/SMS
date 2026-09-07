ALTER TABLE "Assignment" ADD COLUMN IF NOT EXISTS "homeworkSequence" INTEGER;

WITH numbered_homework AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "schoolId", "lessonId"
      ORDER BY "startDate" ASC, "id" ASC
    ) AS sequence_number
  FROM "Assignment"
)
UPDATE "Assignment" AS assignment
SET "homeworkSequence" = numbered_homework.sequence_number
FROM numbered_homework
WHERE assignment."id" = numbered_homework."id"
  AND assignment."homeworkSequence" IS NULL;

ALTER TABLE "Assignment" ALTER COLUMN "homeworkSequence" SET DEFAULT 1;
ALTER TABLE "Assignment" ALTER COLUMN "homeworkSequence" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "Assignment_schoolId_lessonId_homeworkSequence_key"
ON "Assignment"("schoolId", "lessonId", "homeworkSequence");
