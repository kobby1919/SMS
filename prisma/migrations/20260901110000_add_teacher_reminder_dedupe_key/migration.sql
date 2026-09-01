ALTER TABLE "TeacherReminder" ADD COLUMN IF NOT EXISTS "dedupeKey" TEXT;

UPDATE "TeacherReminder"
SET "dedupeKey" = CONCAT('legacy:', "id")
WHERE "dedupeKey" IS NULL;

ALTER TABLE "TeacherReminder" ALTER COLUMN "dedupeKey" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "TeacherReminder_schoolId_dedupeKey_key" ON "TeacherReminder"("schoolId", "dedupeKey");
