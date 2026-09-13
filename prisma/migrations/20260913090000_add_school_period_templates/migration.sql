CREATE TYPE "SchoolPeriodType" AS ENUM (
  'TEACHING',
  'BREAK',
  'ASSEMBLY',
  'LUNCH',
  'CLOSING',
  'OTHER'
);

CREATE TABLE "SchoolPeriodTemplate" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" "SchoolPeriodType" NOT NULL DEFAULT 'TEACHING',
  "startTime" TEXT NOT NULL,
  "endTime" TEXT NOT NULL,
  "order" INTEGER NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "schoolId" TEXT NOT NULL,

  CONSTRAINT "SchoolPeriodTemplate_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Lesson"
  ADD COLUMN "periodTemplateId" TEXT;

CREATE UNIQUE INDEX "SchoolPeriodTemplate_schoolId_name_key"
  ON "SchoolPeriodTemplate"("schoolId", "name");

CREATE UNIQUE INDEX "SchoolPeriodTemplate_schoolId_order_key"
  ON "SchoolPeriodTemplate"("schoolId", "order");

CREATE INDEX "SchoolPeriodTemplate_schoolId_type_isActive_idx"
  ON "SchoolPeriodTemplate"("schoolId", "type", "isActive");

CREATE INDEX "Lesson_schoolId_periodTemplateId_idx"
  ON "Lesson"("schoolId", "periodTemplateId");

ALTER TABLE "SchoolPeriodTemplate"
  ADD CONSTRAINT "SchoolPeriodTemplate_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "School"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Lesson"
  ADD CONSTRAINT "Lesson_periodTemplateId_fkey"
  FOREIGN KEY ("periodTemplateId") REFERENCES "SchoolPeriodTemplate"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
