ALTER TABLE "ContinuousAssessment" ADD COLUMN "examRecordedAt" TIMESTAMP(3);
-- Preserve known positive legacy entries; default zeroes remain unconfirmed.
UPDATE "ContinuousAssessment" SET "examRecordedAt" = "updatedAt" WHERE "examScore" > 0;
ALTER TABLE "Student" ADD COLUMN "classJoinedAt" TIMESTAMP(3);
-- Start tracking existing current placements now; never invent earlier membership.
UPDATE "Student" SET "classJoinedAt" = CURRENT_TIMESTAMP;
ALTER TABLE "Student" ALTER COLUMN "classJoinedAt" SET DEFAULT CURRENT_TIMESTAMP;
