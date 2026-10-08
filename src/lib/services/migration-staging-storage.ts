import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

type StorageContext = { schoolId: string; uploadId: string; purpose: "SOURCE" | "RESULT" };
interface MigrationStorageAdapter {
  provider: string;
  seal(body: string, context: StorageContext): Promise<string>;
  open(object: string, context: StorageContext): Promise<string>;
}
export class MigrationStorageConfigurationError extends Error {}

async function encryptionKey() {
  const configured = process.env.MIGRATION_STAGING_ENCRYPTION_KEY;
  const value = configured ?? (process.env.NODE_ENV !== "production"
    ? (await readFile(path.join(process.cwd(), ".private", "migration-staging.key"), "utf8").catch(() => "")).trim()
    : "");
  if (!/^[A-Za-z0-9+/]{43}=$/.test(value)) throw new MigrationStorageConfigurationError("Protected migration storage is not configured. Contact the platform administrator.");
  const key = Buffer.from(value, "base64");
  if (key.length !== 32 || key.toString("base64") !== value) throw new MigrationStorageConfigurationError("Protected migration storage is not configured. Contact the platform administrator.");
  return key;
}
const aad = (context: StorageContext) => Buffer.from(JSON.stringify(["migration:v1", context.schoolId, context.uploadId, context.purpose]));

// Only this adapter knows the storage format. Features never expose storage objects.
export const migrationStagingStorage: MigrationStorageAdapter = {
  provider: "DATABASE_ENCRYPTED_V1",
  async seal(body, context) {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", await encryptionKey(), iv);
    cipher.setAAD(aad(context));
    const encrypted = Buffer.concat([cipher.update(body, "utf8"), cipher.final()]);
    return ["v1", iv.toString("base64"), cipher.getAuthTag().toString("base64"), encrypted.toString("base64")].join(":");
  },
  async open(object, context) {
    const [version, iv, tag, encrypted, extra] = object.split(":");
    if (version !== "v1" || !iv || !tag || !encrypted || extra !== undefined || Buffer.from(iv, "base64").length !== 12 || Buffer.from(tag, "base64").length !== 16) throw new Error("Invalid staged storage object.");
    const decipher = createDecipheriv("aes-256-gcm", await encryptionKey(), Buffer.from(iv, "base64"));
    decipher.setAAD(aad(context));
    decipher.setAuthTag(Buffer.from(tag, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(encrypted, "base64")), decipher.final()]).toString("utf8");
  },
};
