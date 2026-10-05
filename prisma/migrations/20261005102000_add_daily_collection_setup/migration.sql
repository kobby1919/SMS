CREATE TYPE "CollectorStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'LEFT_SCHOOL');

CREATE TYPE "DailyCollectionAuditAction" AS ENUM (
  'COLLECTOR_CREATED',
  'COLLECTOR_UPDATED',
  'COLLECTOR_SUSPENDED',
  'COLLECTOR_REACTIVATED',
  'COLLECTOR_LEFT_SCHOOL',
  'COLLECTION_TYPE_CREATED',
  'COLLECTION_TYPE_UPDATED',
  'COLLECTION_TYPE_DEACTIVATED',
  'COLLECTION_TYPE_REACTIVATED',
  'COLLECTOR_ASSIGNED',
  'COLLECTOR_UNASSIGNED'
);

CREATE TABLE "Collector" (
  "id" TEXT NOT NULL,
  "username" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "surname" TEXT NOT NULL,
  "sex" "UserSex" NOT NULL,
  "email" TEXT,
  "phone" TEXT,
  "address" TEXT,
  "status" "CollectorStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "schoolId" TEXT NOT NULL DEFAULT 'default-school',

  CONSTRAINT "Collector_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DailyCollectionType" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "category" "FeeCategory" NOT NULL DEFAULT 'FEEDING',
  "amount" DECIMAL(10,2) NOT NULL,
  "description" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "requiresBursarConfirmation" BOOLEAN NOT NULL DEFAULT true,
  "createdBy" TEXT NOT NULL,
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "schoolId" TEXT NOT NULL DEFAULT 'default-school',

  CONSTRAINT "DailyCollectionType_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DailyCollectionTypeCollector" (
  "id" TEXT NOT NULL,
  "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "assignedBy" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL DEFAULT 'default-school',
  "collectorId" TEXT NOT NULL,
  "collectionTypeId" TEXT NOT NULL,

  CONSTRAINT "DailyCollectionTypeCollector_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DailyCollectionAuditLog" (
  "id" TEXT NOT NULL,
  "action" "DailyCollectionAuditAction" NOT NULL,
  "performedBy" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "metadata" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "schoolId" TEXT NOT NULL DEFAULT 'default-school',
  "collectorId" TEXT,
  "collectionTypeId" TEXT,

  CONSTRAINT "DailyCollectionAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Collector_username_key" ON "Collector"("username");
CREATE UNIQUE INDEX "Collector_schoolId_email_key" ON "Collector"("schoolId", "email");
CREATE INDEX "Collector_schoolId_idx" ON "Collector"("schoolId");
CREATE INDEX "Collector_schoolId_status_idx" ON "Collector"("schoolId", "status");
CREATE INDEX "Collector_schoolId_createdAt_idx" ON "Collector"("schoolId", "createdAt");

CREATE UNIQUE INDEX "DailyCollectionType_schoolId_name_key" ON "DailyCollectionType"("schoolId", "name");
CREATE INDEX "DailyCollectionType_schoolId_isActive_idx" ON "DailyCollectionType"("schoolId", "isActive");
CREATE INDEX "DailyCollectionType_schoolId_category_idx" ON "DailyCollectionType"("schoolId", "category");
CREATE INDEX "DailyCollectionType_schoolId_createdAt_idx" ON "DailyCollectionType"("schoolId", "createdAt");

CREATE UNIQUE INDEX "DailyCollectionTypeCollector_collectorId_collectionTypeId_key"
ON "DailyCollectionTypeCollector"("collectorId", "collectionTypeId");
CREATE INDEX "DailyCollectionTypeCollector_schoolId_collectorId_idx"
ON "DailyCollectionTypeCollector"("schoolId", "collectorId");
CREATE INDEX "DailyCollectionTypeCollector_schoolId_collectionTypeId_idx"
ON "DailyCollectionTypeCollector"("schoolId", "collectionTypeId");

CREATE INDEX "DailyCollectionAuditLog_schoolId_createdAt_idx"
ON "DailyCollectionAuditLog"("schoolId", "createdAt");
CREATE INDEX "DailyCollectionAuditLog_schoolId_action_createdAt_idx"
ON "DailyCollectionAuditLog"("schoolId", "action", "createdAt");
CREATE INDEX "DailyCollectionAuditLog_schoolId_collectorId_createdAt_idx"
ON "DailyCollectionAuditLog"("schoolId", "collectorId", "createdAt");
CREATE INDEX "DailyCollectionAuditLog_schoolId_collectionTypeId_createdAt_idx"
ON "DailyCollectionAuditLog"("schoolId", "collectionTypeId", "createdAt");

ALTER TABLE "Collector"
ADD CONSTRAINT "Collector_schoolId_fkey"
FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "DailyCollectionType"
ADD CONSTRAINT "DailyCollectionType_schoolId_fkey"
FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "DailyCollectionTypeCollector"
ADD CONSTRAINT "DailyCollectionTypeCollector_collectorId_fkey"
FOREIGN KEY ("collectorId") REFERENCES "Collector"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DailyCollectionTypeCollector"
ADD CONSTRAINT "DailyCollectionTypeCollector_collectionTypeId_fkey"
FOREIGN KEY ("collectionTypeId") REFERENCES "DailyCollectionType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DailyCollectionAuditLog"
ADD CONSTRAINT "DailyCollectionAuditLog_schoolId_fkey"
FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "DailyCollectionAuditLog"
ADD CONSTRAINT "DailyCollectionAuditLog_collectorId_fkey"
FOREIGN KEY ("collectorId") REFERENCES "Collector"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DailyCollectionAuditLog"
ADD CONSTRAINT "DailyCollectionAuditLog_collectionTypeId_fkey"
FOREIGN KEY ("collectionTypeId") REFERENCES "DailyCollectionType"("id") ON DELETE SET NULL ON UPDATE CASCADE;
