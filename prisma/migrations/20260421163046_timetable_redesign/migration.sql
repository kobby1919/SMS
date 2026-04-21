-- DropForeignKey
ALTER TABLE "Lesson" DROP CONSTRAINT "Lesson_subjectId_fkey";

-- AlterTable
ALTER TABLE "Class" ADD COLUMN "section" TEXT;

-- AlterTable: Add order with a temporary default, update values, then remove default
ALTER TABLE "Grade" ADD COLUMN "order" INTEGER NOT NULL DEFAULT 0;
UPDATE "Grade" SET "order" = CAST("level" AS INTEGER);

-- AlterTable: Clean nulls then make subjectId required
DELETE FROM "Lesson" WHERE "subjectId" IS NULL;
ALTER TABLE "Lesson" ALTER COLUMN "subjectId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Teacher" ADD COLUMN "maxClasses" INTEGER NOT NULL DEFAULT 5;

-- CreateIndex
CREATE UNIQUE INDEX "Grade_order_key" ON "Grade"("order");

-- AddForeignKey
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;