-- CreateEnum
CREATE TYPE "TimetablePublicationStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateTable
CREATE TABLE "TimetablePublication" (
    "id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "TimetablePublicationStatus" NOT NULL DEFAULT 'ACTIVE',
    "reason" TEXT,
    "publishedBy" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "schoolId" TEXT NOT NULL,

    CONSTRAINT "TimetablePublication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PublishedTimetableLesson" (
    "id" TEXT NOT NULL,
    "sourceId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "day" "Day" NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "schoolId" TEXT NOT NULL,
    "publicationId" TEXT NOT NULL,
    "subjectId" INTEGER NOT NULL,
    "subjectName" TEXT NOT NULL,
    "classId" INTEGER NOT NULL,
    "className" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "teacherName" TEXT NOT NULL,
    "periodTemplateId" TEXT,
    "periodTemplateName" TEXT,
    "periodTemplateType" "SchoolPeriodType",
    "periodStartTime" TEXT,
    "periodEndTime" TEXT,
    "periodOrder" INTEGER,

    CONSTRAINT "PublishedTimetableLesson_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TimetablePublication_schoolId_version_key" ON "TimetablePublication"("schoolId", "version");

-- CreateIndex
CREATE INDEX "TimetablePublication_schoolId_status_publishedAt_idx" ON "TimetablePublication"("schoolId", "status", "publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PublishedTimetableLesson_publicationId_sourceId_key" ON "PublishedTimetableLesson"("publicationId", "sourceId");

-- CreateIndex
CREATE INDEX "PublishedTimetableLesson_schoolId_publicationId_idx" ON "PublishedTimetableLesson"("schoolId", "publicationId");

-- CreateIndex
CREATE INDEX "PublishedTimetableLesson_schoolId_classId_day_idx" ON "PublishedTimetableLesson"("schoolId", "classId", "day");

-- CreateIndex
CREATE INDEX "PublishedTimetableLesson_schoolId_teacherId_day_idx" ON "PublishedTimetableLesson"("schoolId", "teacherId", "day");

-- CreateIndex
CREATE INDEX "PublishedTimetableLesson_schoolId_subjectId_idx" ON "PublishedTimetableLesson"("schoolId", "subjectId");

-- AddForeignKey
ALTER TABLE "TimetablePublication" ADD CONSTRAINT "TimetablePublication_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublishedTimetableLesson" ADD CONSTRAINT "PublishedTimetableLesson_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublishedTimetableLesson" ADD CONSTRAINT "PublishedTimetableLesson_publicationId_fkey" FOREIGN KEY ("publicationId") REFERENCES "TimetablePublication"("id") ON DELETE CASCADE ON UPDATE CASCADE;
