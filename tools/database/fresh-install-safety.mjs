import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

export const baselineName = "20261019000000_fresh_install";
export const sha256 = (value) => createHash("sha256").update(value.toString().replaceAll("\r\n", "\n")).digest("hex");
export const migrationChecksum = (value) => createHash("sha256").update(value).digest("hex");
const canonicalHost = (value) => value.toLowerCase().replace("-pooler.", ".");

export function validateTarget({ environment, url, expectedHost, productionHost }) {
  if (!["staging", "production"].includes(environment)) throw new Error("Select staging or production explicitly.");
  if (!expectedHost || !productionHost) throw new Error("Pin both the target hostname and production hostname before connecting.");
  const neonHost = /^ep-[a-z0-9-]+\.[a-z0-9.-]+\.neon\.tech$/;
  if (!neonHost.test(expectedHost) || !neonHost.test(productionHost)) throw new Error("Pinned endpoints must be Neon hostnames, not URLs.");
  let parsed;
  try { parsed = new URL(url); } catch { throw new Error("Missing or invalid dedicated migration connection URL."); }
  if (!["postgres:", "postgresql:"].includes(parsed.protocol) || !parsed.username || !parsed.password || parsed.pathname !== "/neondb") {
    throw new Error("Expected an authenticated PostgreSQL connection to neondb.");
  }
  if (!neonHost.test(parsed.hostname) || parsed.hostname.includes("-pooler.") || parsed.hash || (parsed.port && parsed.port !== "5432")) {
    throw new Error("Use the direct Neon endpoint, not the pooled runtime connection.");
  }
  const seen = new Set();
  for (const [key] of parsed.searchParams) {
    if (!["sslmode", "channel_binding"].includes(key) || seen.has(key)) throw new Error("Connection URL contains unreviewed or duplicate options.");
    seen.add(key);
  }
  if (!["require", "verify-full"].includes(parsed.searchParams.get("sslmode"))) throw new Error("TLS must be required.");
  if (parsed.hostname !== expectedHost || parsed.username !== "neondb_owner") throw new Error("The endpoint or migration role does not match the pinned target.");
  const matchesProduction = canonicalHost(parsed.hostname) === canonicalHost(productionHost);
  if ((environment === "staging" && matchesProduction) || (environment === "production" && !matchesProduction)) {
    throw new Error("Environment/production endpoint mismatch. No changes are allowed.");
  }
  return { environment, host: parsed.hostname, database: "neondb" };
}

export function verifyBundle() {
  const manifest = JSON.parse(readFileSync("prisma/fresh-migrations/provenance.json", "utf8"));
  const sql = readFileSync(`prisma/fresh-migrations/${baselineName}/migration.sql`, "utf8");
  if (sha256(sql) !== manifest.baselineSha256 || sha256(readFileSync("prisma/schema.prisma")) !== manifest.schemaSha256) {
    throw new Error("Fresh baseline or Prisma schema changed; re-review the deployment migration bundle.");
  }
  return { manifest, sql, checksum: migrationChecksum(sql) };
}

export function requireEmptyDatabase(relations, enums) {
  if (relations.length || enums.length) throw new Error("This is not an empty database. Refusing to initialize, reset, resolve or overwrite anything.");
}

export function validateStagingEvidence(evidence, target, baselineSha256, now = Date.now()) {
  if (evidence?.environment !== "staging" || evidence?.verified !== true || evidence.baselineSha256 !== baselineSha256 ||
      !evidence.host || canonicalHost(evidence.host) === canonicalHost(target.host) || evidence.database !== target.database ||
      !Number.isFinite(Date.parse(evidence.verifiedAt)) || Date.parse(evidence.verifiedAt) > now || now - Date.parse(evidence.verifiedAt) > 7 * 86400_000) {
    throw new Error("Production requires recent successful verification of this exact baseline on a distinct staging endpoint.");
  }
}
