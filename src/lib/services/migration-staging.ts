import "server-only";
import { createHash, randomUUID } from "node:crypto";
import prisma from "@/src/lib/prisma";
import { migrationStagingStorage } from "@/src/lib/services/migration-staging-storage";
import { parseStagedCsv } from "@/src/lib/services/migration-staging-parser";
import { validateMigrationRows } from "@/src/lib/services/data-migration-validation";
import { getMigrationInventory } from "@/src/lib/services/migration-inventory";
import { inventorySchema } from "@/src/lib/migration/inventory";
import { MigrationStagingError, stagedUploadIdSchema } from "@/src/lib/migration/staging";
import { stageUploadSchema } from "@/src/lib/migration/staging";

const checksum = (csv: string) => createHash("sha256").update(csv, "utf8").digest("hex");
const retentionMs = 7 * 24 * 60 * 60 * 1000;

export async function stageMigrationUpload(schoolId: string, actorId: string, raw: unknown) {
  const { input, payload } = parseStagedCsv(raw);
  const validation = await validateMigrationRows({ schoolId, ...payload });
  const id = randomUUID();
  const digest = checksum(input.csv);
  const encryptedPayload = await migrationStagingStorage.seal(JSON.stringify(input), { schoolId, uploadId: id, purpose: "SOURCE" });
  const expiresAt = new Date(Date.now() + retentionMs);
  const upload = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "School" WHERE "id" = ${schoolId} FOR SHARE`;
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${schoolId}), hashtext('migration-staging-quota'))`;
    const inventory = await getMigrationInventory(schoolId, tx);
    if (inventory?.status !== "CONFIRMED" || !inventorySchema.safeParse(inventory).success || !inventory.rows.some((r) => r.key === input.areaKey && r.disposition === "INCLUDE")) throw new MigrationStagingError("Confirm the inventory scope for this dataset before saving an upload.", 409);
    const [pendingCount, retainedCount] = await Promise.all([
      tx.migrationStagedUpload.count({ where: { schoolId, status: "VALIDATED", encryptedPayload: { not: null } } }),
      tx.migrationStagedUpload.count({ where: { schoolId, encryptedPayload: { not: null } } }),
    ]);
    if (pendingCount >= 20 || retainedCount >= 100) throw new MigrationStagingError("The workspace holds up to 20 pending and 100 retained files. Cancel unused uploads or clear expired files before adding more.", 409);
    return tx.migrationStagedUpload.create({ data: { id, schoolId, uploadedBy: actorId, areaKey: input.areaKey, fileName: input.fileName, checksum: digest, rowCount: payload.rows.length, byteSize: Buffer.byteLength(input.csv, "utf8"), inventoryVersion: inventory.version, storageProvider: migrationStagingStorage.provider, encryptedPayload, expiresAt } }).then(async (saved) => {
      await tx.onboardingAuditLog.create({ data: { schoolId, performedBy: actorId, action: "MIGRATION_UPLOAD_STAGED", metadata: { uploadId: id, checksum: digest, areaKey: input.areaKey, rowCount: payload.rows.length, inventoryVersion: inventory.version, expiresAt: expiresAt.toISOString() } } });
      return saved;
    });
  }, { timeout: 20000, maxWait: 15000 });
  return { ...validation, uploadId: upload.id, checksum: digest, expiresAt: expiresAt.toISOString(), inventoryVersion: upload.inventoryVersion };
}

export async function loadStagedMigration(schoolId: string, rawId: unknown) {
  const id = stagedUploadIdSchema.parse(rawId);
  const upload = await prisma.migrationStagedUpload.findFirst({ where: { id, schoolId } });
  if (!upload) throw new MigrationStagingError("Upload not found.", 404);
  if (upload.expiresAt <= new Date() || ["CANCELLED", "EXPIRED"].includes(upload.status) || !upload.encryptedPayload) throw new MigrationStagingError("This upload is cancelled or expired. Upload the file again.", 410);
  if (upload.storageProvider !== migrationStagingStorage.provider) throw new MigrationStagingError("The storage adapter for this upload is unavailable.", 503);
  let source: unknown;
  try { source = JSON.parse(await migrationStagingStorage.open(upload.encryptedPayload, { schoolId, uploadId: id, purpose: "SOURCE" })); }
  catch { throw new MigrationStagingError("The protected file could not be verified. Do not import it; contact support.", 409); }
  const input = stageUploadSchema.parse(source);
  if (checksum(input.csv) !== upload.checksum || input.areaKey !== upload.areaKey || input.fileName !== upload.fileName) throw new MigrationStagingError("The saved file does not match its recorded identity.", 409);
  const parsed = parseStagedCsv(input);
  if (parsed.payload.rows.length !== upload.rowCount || Buffer.byteLength(input.csv, "utf8") !== upload.byteSize) throw new MigrationStagingError("The saved file does not match its recorded size or row count.", 409);
  return { upload, ...parsed };
}

export async function readStagedImportResult(schoolId: string, uploadId: string, encrypted: string) {
  return JSON.parse(await migrationStagingStorage.open(encrypted, { schoolId, uploadId, purpose: "RESULT" }));
}

export async function cancelStagedMigration(schoolId: string, actorId: string, rawId: unknown) {
  const id = stagedUploadIdSchema.parse(rawId);
  await prisma.$transaction(async (tx) => {
    const cancelled = await tx.migrationStagedUpload.updateMany({ where: { id, schoolId, status: "VALIDATED" }, data: { status: "CANCELLED", encryptedPayload: null, encryptedResult: null } });
    if (!cancelled.count) throw new MigrationStagingError("Only a pending upload in this school can be cancelled.", 409);
    await tx.onboardingAuditLog.create({ data: { schoolId, performedBy: actorId, action: "MIGRATION_UPLOAD_CANCELLED", metadata: { uploadId: id } } });
  });
}

export async function purgeExpiredMigrationUploads(schoolId: string, actorId: string) {
  await prisma.$transaction(async (tx) => {
    const removed = await tx.migrationStagedUpload.updateMany({ where: { schoolId, expiresAt: { lte: new Date() }, OR: [{ encryptedPayload: { not: null } }, { encryptedResult: { not: null } }] }, data: { encryptedPayload: null, encryptedResult: null, status: "EXPIRED" } });
    if (removed.count) await tx.onboardingAuditLog.create({ data: { schoolId, performedBy: actorId, action: "MIGRATION_UPLOAD_EXPIRED", metadata: { count: removed.count } } });
  });
}

export async function listStagedMigrationUploads(schoolId: string) {
  const select = { id: true, fileName: true, areaKey: true, status: true, checksum: true, rowCount: true, uploadedBy: true, inventoryVersion: true, createdAt: true, expiresAt: true, batchId: true } as const;
  const [pending, history] = await Promise.all([
    prisma.migrationStagedUpload.findMany({ where: { schoolId, status: "VALIDATED", encryptedPayload: { not: null } }, orderBy: { createdAt: "desc" }, take: 20, select }),
    prisma.migrationStagedUpload.findMany({ where: { schoolId, OR: [{ status: { not: "VALIDATED" } }, { encryptedPayload: null }] }, orderBy: { createdAt: "desc" }, take: 10, select }),
  ]);
  const uploads = [...pending, ...history];
  return uploads.map((row) => ({ ...row, status: row.expiresAt <= new Date() && row.status === "VALIDATED" ? "EXPIRED" : row.status, createdAt: row.createdAt.toISOString(), expiresAt: row.expiresAt.toISOString() }));
}
