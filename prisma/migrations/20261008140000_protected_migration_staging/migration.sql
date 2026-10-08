ALTER TYPE "OnboardingAuditAction" ADD VALUE IF NOT EXISTS 'MIGRATION_UPLOAD_STAGED';
ALTER TYPE "OnboardingAuditAction" ADD VALUE IF NOT EXISTS 'MIGRATION_UPLOAD_CANCELLED';
ALTER TYPE "OnboardingAuditAction" ADD VALUE IF NOT EXISTS 'MIGRATION_UPLOAD_EXPIRED';
CREATE TYPE "MigrationUploadStatus" AS ENUM ('VALIDATED', 'IMPORTED', 'CANCELLED', 'EXPIRED');
CREATE TABLE "MigrationStagedUpload" (
  "id" TEXT PRIMARY KEY,
  "schoolId" TEXT NOT NULL REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "uploadedBy" TEXT NOT NULL,
  "areaKey" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "checksum" TEXT NOT NULL,
  "rowCount" INTEGER NOT NULL CHECK ("rowCount" > 0 AND "rowCount" <= 2000),
  "byteSize" INTEGER NOT NULL CHECK ("byteSize" > 0 AND "byteSize" <= 1000000),
  "inventoryVersion" INTEGER NOT NULL,
  "storageProvider" TEXT NOT NULL,
  "encryptedPayload" TEXT,
  "encryptedResult" TEXT,
  "status" "MigrationUploadStatus" NOT NULL DEFAULT 'VALIDATED',
  "batchId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "importedAt" TIMESTAMP(3)
);
CREATE UNIQUE INDEX "MigrationStagedUpload_batchId_key" ON "MigrationStagedUpload"("batchId");
CREATE INDEX "MigrationStagedUpload_schoolId_createdAt_idx" ON "MigrationStagedUpload"("schoolId", "createdAt");
CREATE INDEX "MigrationStagedUpload_status_expiresAt_idx" ON "MigrationStagedUpload"("status", "expiresAt");
