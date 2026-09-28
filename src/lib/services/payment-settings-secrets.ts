import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";

function getPaymentSettingsKey() {
  const explicitKey = process.env.PAYMENT_SETTINGS_ENCRYPTION_KEY;

  if (explicitKey) {
    const decoded = Buffer.from(explicitKey, "base64");
    if (decoded.length === 32) return decoded;

    if (explicitKey.length >= 32) {
      return createHash("sha256").update(explicitKey).digest();
    }
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("PAYMENT_SETTINGS_ENCRYPTION_KEY must be set before saving payment provider secrets.");
  }

  const fallback = process.env.PARENT_SUMMARY_WORKER_SECRET || process.env.DATABASE_URL || "edujay-local-payment-settings";
  return createHash("sha256").update(fallback).digest();
}

export function encryptPaymentSecret(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, getPaymentSettingsKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${iv.toString("base64")}:${tag.toString("base64")}:${encrypted.toString("base64")}`;
}

export function decryptPaymentSecret(value: string) {
  const [ivValue, tagValue, encryptedValue] = value.split(":");
  if (!ivValue || !tagValue || !encryptedValue) {
    throw new Error("Saved payment secret is not in a valid encrypted format.");
  }

  const decipher = createDecipheriv(ALGORITHM, getPaymentSettingsKey(), Buffer.from(ivValue, "base64"));
  decipher.setAuthTag(Buffer.from(tagValue, "base64"));

  return Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

export function hasPaymentSecret(value?: string | null) {
  return Boolean(value);
}
