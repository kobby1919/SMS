-- Activity-based CA foundation.
-- CA buckets define how a subject's class score is allocated.
-- CA activities and scores explain how the student's CA is built during the term.

CREATE TYPE "CAActivityType" AS ENUM (
  'MIDTERM_EXAM',
  'CLASS_TEST',
  'CLASS_EXERCISE',
  'QUIZ',
  'HOMEWORK',
  'PROJECT',
  'PRACTICAL',
  'PARTICIPATION',
  'OTHER'
);

CREATE TYPE "CABucketAggregationMode" AS ENUM (
  'AVERAGE_TO_BUCKET',
  'SUM_ACTIVITIES'
);

CREATE TABLE "CABucket" (
  "id" SERIAL NOT NULL,
  "name" TEXT NOT NULL,
  "type" "CAActivityType" NOT NULL,
  "aggregationMode" "CABucketAggregationMode" NOT NULL DEFAULT 'AVERAGE_TO_BUCKET',
  "allocationMarks" DECIMAL(8,2) NOT NULL,
  "term" "Term" NOT NULL,
  "academicYear" TEXT NOT NULL,
  "order" INTEGER NOT NULL DEFAULT 0,
  "isLocked" BOOLEAN NOT NULL DEFAULT false,
  "schoolId" TEXT NOT NULL DEFAULT 'default-school',
  "classId" INTEGER NOT NULL,
  "subjectId" INTEGER NOT NULL,
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CABucket_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CABucket_allocationMarks_positive" CHECK ("allocationMarks" > 0)
);

CREATE TABLE "CAActivity" (
  "id" SERIAL NOT NULL,
  "title" TEXT NOT NULL,
  "type" "CAActivityType" NOT NULL,
  "rawMaxScore" DECIMAL(8,2) NOT NULL,
  "allocationMarks" DECIMAL(8,2),
  "activityDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "sequence" INTEGER NOT NULL DEFAULT 1,
  "isLocked" BOOLEAN NOT NULL DEFAULT false,
  "schoolId" TEXT NOT NULL DEFAULT 'default-school',
  "bucketId" INTEGER NOT NULL,
  "classId" INTEGER NOT NULL,
  "subjectId" INTEGER NOT NULL,
  "teacherId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CAActivity_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CAActivity_rawMaxScore_positive" CHECK ("rawMaxScore" > 0),
  CONSTRAINT "CAActivity_allocationMarks_positive_or_null" CHECK ("allocationMarks" IS NULL OR "allocationMarks" > 0)
);

CREATE TABLE "CAActivityScore" (
  "id" SERIAL NOT NULL,
  "rawScore" DECIMAL(8,2) NOT NULL,
  "normalizedContribution" DECIMAL(8,2) NOT NULL DEFAULT 0,
  "comment" TEXT,
  "schoolId" TEXT NOT NULL DEFAULT 'default-school',
  "activityId" INTEGER NOT NULL,
  "studentId" TEXT NOT NULL,
  "recordedBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CAActivityScore_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CAActivityScore_rawScore_nonnegative" CHECK ("rawScore" >= 0),
  CONSTRAINT "CAActivityScore_normalizedContribution_nonnegative" CHECK ("normalizedContribution" >= 0)
);

CREATE UNIQUE INDEX "CABucket_schoolId_classId_subjectId_term_academicYear_name_key"
  ON "CABucket"("schoolId", "classId", "subjectId", "term", "academicYear", "name");

CREATE INDEX "CABucket_schoolId_classId_subjectId_term_academicYear_idx"
  ON "CABucket"("schoolId", "classId", "subjectId", "term", "academicYear");

CREATE INDEX "CABucket_schoolId_createdBy_idx"
  ON "CABucket"("schoolId", "createdBy");

CREATE UNIQUE INDEX "CAActivity_bucketId_type_sequence_key"
  ON "CAActivity"("bucketId", "type", "sequence");

CREATE INDEX "CAActivity_schoolId_classId_subjectId_activityDate_idx"
  ON "CAActivity"("schoolId", "classId", "subjectId", "activityDate");

CREATE INDEX "CAActivity_schoolId_teacherId_activityDate_idx"
  ON "CAActivity"("schoolId", "teacherId", "activityDate");

CREATE INDEX "CAActivity_schoolId_bucketId_idx"
  ON "CAActivity"("schoolId", "bucketId");

CREATE UNIQUE INDEX "CAActivityScore_activityId_studentId_key"
  ON "CAActivityScore"("activityId", "studentId");

CREATE INDEX "CAActivityScore_schoolId_studentId_idx"
  ON "CAActivityScore"("schoolId", "studentId");

CREATE INDEX "CAActivityScore_schoolId_activityId_idx"
  ON "CAActivityScore"("schoolId", "activityId");

CREATE INDEX "CAActivityScore_schoolId_recordedBy_updatedAt_idx"
  ON "CAActivityScore"("schoolId", "recordedBy", "updatedAt");

ALTER TABLE "CABucket"
  ADD CONSTRAINT "CABucket_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CABucket"
  ADD CONSTRAINT "CABucket_classId_fkey"
  FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CABucket"
  ADD CONSTRAINT "CABucket_subjectId_fkey"
  FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CABucket"
  ADD CONSTRAINT "CABucket_createdBy_fkey"
  FOREIGN KEY ("createdBy") REFERENCES "Teacher"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CAActivity"
  ADD CONSTRAINT "CAActivity_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CAActivity"
  ADD CONSTRAINT "CAActivity_bucketId_fkey"
  FOREIGN KEY ("bucketId") REFERENCES "CABucket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CAActivity"
  ADD CONSTRAINT "CAActivity_classId_fkey"
  FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CAActivity"
  ADD CONSTRAINT "CAActivity_subjectId_fkey"
  FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CAActivity"
  ADD CONSTRAINT "CAActivity_teacherId_fkey"
  FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CAActivityScore"
  ADD CONSTRAINT "CAActivityScore_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CAActivityScore"
  ADD CONSTRAINT "CAActivityScore_activityId_fkey"
  FOREIGN KEY ("activityId") REFERENCES "CAActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CAActivityScore"
  ADD CONSTRAINT "CAActivityScore_studentId_fkey"
  FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CAActivityScore"
  ADD CONSTRAINT "CAActivityScore_recordedBy_fkey"
  FOREIGN KEY ("recordedBy") REFERENCES "Teacher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
