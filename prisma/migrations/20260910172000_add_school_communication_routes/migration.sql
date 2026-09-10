CREATE TYPE "ParentTeacherContactRouteTarget" AS ENUM (
  'SUBJECT_TEACHER',
  'CLASS_TEACHER',
  'SELECTED_TEACHER',
  'SCHOOL_OFFICE'
);

CREATE TABLE "SchoolCommunicationRoute" (
  "id" TEXT NOT NULL,
  "category" "ParentTeacherContactCategory" NOT NULL,
  "target" "ParentTeacherContactRouteTarget" NOT NULL DEFAULT 'SUBJECT_TEACHER',
  "selectedTeacherId" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "schoolId" TEXT NOT NULL,

  CONSTRAINT "SchoolCommunicationRoute_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SchoolCommunicationRoute_schoolId_category_key"
  ON "SchoolCommunicationRoute"("schoolId", "category");

CREATE INDEX "SchoolCommunicationRoute_schoolId_target_idx"
  ON "SchoolCommunicationRoute"("schoolId", "target");

CREATE INDEX "SchoolCommunicationRoute_schoolId_selectedTeacherId_idx"
  ON "SchoolCommunicationRoute"("schoolId", "selectedTeacherId");

ALTER TABLE "SchoolCommunicationRoute"
  ADD CONSTRAINT "SchoolCommunicationRoute_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "School"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SchoolCommunicationRoute"
  ADD CONSTRAINT "SchoolCommunicationRoute_selectedTeacherId_fkey"
  FOREIGN KEY ("selectedTeacherId") REFERENCES "Teacher"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
