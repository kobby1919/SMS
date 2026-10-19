import { spawn } from "node:child_process";
import { mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseArgs, parseEnv } from "node:util";
import pg from "pg";
import { baselineName, requireEmptyDatabase, validateStagingEvidence, validateTarget, verifyBundle } from "./fresh-install-safety.mjs";

const { values } = parseArgs({ options: {
  "env-file": { type: "string" }, environment: { type: "string" }, execute: { type: "boolean", default: false },
  "approve-production": { type: "boolean", default: false }, "staging-evidence": { type: "string" },
} });

function privatePath(value) {
  if (!value) throw new Error("Provide an explicit file inside .private; local .env files are never loaded.");
  const directory = realpathSync(".private");
  const resolved = realpathSync(value);
  const relative = path.relative(directory, resolved);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("Input must be a private workspace file.");
  return resolved;
}

async function prismaCommand(args, databaseUrl, allowedCodes = [0]) {
  const child = spawn(process.execPath, ["node_modules/prisma/build/index.js", ...args, "--config", "prisma.fresh.config.ts"], {
    env: { ...process.env, DATABASE_URL: "", EDUJAY_MIGRATION_DATABASE_URL: databaseUrl }, stdio: ["ignore", "pipe", "pipe"],
  });
  let diagnostics = "";
  for (const stream of [child.stdout, child.stderr]) stream.on("data", (chunk) => { diagnostics = (diagnostics + chunk.toString()).slice(-64000); });
  const code = await new Promise((resolve, reject) => { child.once("error", reject); child.once("close", resolve); });
  if (!allowedCodes.includes(code)) {
    const prismaCode = diagnostics.match(/\bP\d{4}\b/)?.[0] ?? `exit ${code}`;
    throw new Error(`Migration command failed (${prismaCode}). Do not reset or rerun blindly.`);
  }
  return code;
}

async function main() {
  const settings = parseEnv(readFileSync(privatePath(values["env-file"]), "utf8"));
  const target = validateTarget({ environment: values.environment,
    url: settings.EDUJAY_MIGRATION_DATABASE_URL, expectedHost: settings.EDUJAY_EXPECTED_DATABASE_HOST,
    productionHost: settings.EDUJAY_PRODUCTION_DATABASE_HOST });
  const { manifest, checksum } = verifyBundle();
  if (target.environment === "production") {
    if (!values["approve-production"]) throw new Error("Production writes require --approve-production and staging evidence.");
    const evidence = JSON.parse(readFileSync(privatePath(values["staging-evidence"]), "utf8"));
    validateStagingEvidence(evidence, target, manifest.baselineSha256);
  }
  const client = new pg.Client({ connectionString: settings.EDUJAY_MIGRATION_DATABASE_URL,
    connectionTimeoutMillis: 15000, statement_timeout: 15000, application_name: "edujay-fresh-install-preflight" });
  await client.connect();
  try {
    const { rows: locks } = await client.query("SELECT pg_try_advisory_lock(18453, 19000) AS acquired");
    if (!locks[0].acquired) throw new Error("Another fresh-install process is running.");
    const { rows: identity } = await client.query("SELECT current_user AS role, current_database() AS database");
    if (identity[0].role !== "neondb_owner" || identity[0].database !== target.database) throw new Error("Database identity check failed.");
    const { rows: relations } = await client.query(`SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname NOT IN ('pg_catalog','information_schema') AND n.nspname NOT LIKE 'pg_%' AND c.relkind IN ('r','p','v','m','f','S')`);
    const { rows: enums } = await client.query(`SELECT t.typname FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname NOT IN ('pg_catalog','information_schema') AND n.nspname NOT LIKE 'pg_%' AND t.typtype='e'`);
    requireEmptyDatabase(relations, enums);
    console.log(JSON.stringify({ target, empty: true, mode: values.execute ? "INITIALIZE" : "READ_ONLY_PREFLIGHT" }));
    if (!values.execute) return;
    // Prisma owns its migration bookkeeping. Never db push, reset, seed or mark legacy migrations applied.
    await prismaCommand(["migrate", "deploy"], settings.EDUJAY_MIGRATION_DATABASE_URL);
    await prismaCommand(["migrate", "diff", "--from-config-datasource", "--to-schema", "prisma/schema.prisma", "--exit-code"], settings.EDUJAY_MIGRATION_DATABASE_URL);
    const { rows: applied } = await client.query('SELECT migration_name, checksum, finished_at, rolled_back_at FROM "_prisma_migrations"');
    if (applied.length !== 1 || applied[0].migration_name !== baselineName || applied[0].checksum !== checksum || !applied[0].finished_at || applied[0].rolled_back_at) {
      throw new Error("Migration history does not match the reviewed fresh baseline.");
    }
    const { rows: checks } = await client.query(`SELECT count(*)::int AS count FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname='public' AND c.contype='c'`);
    if (checks[0].count !== manifest.checks) throw new Error("Database safety checks are incomplete.");
    for (const name of ["Payment_school_method_reference_active_unique", "PaymentCorrectionRequest_one_open_per_payment"]) {
      const { rows } = await client.query("SELECT i.indisunique, i.indisvalid FROM pg_index i JOIN pg_class c ON c.oid=i.indexrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname=$1 AND i.indpred IS NOT NULL", [name]);
      if (rows.length !== 1 || !rows[0].indisunique || !rows[0].indisvalid) throw new Error("A financial duplicate-protection index is missing.");
    }
    const evidence = { ...target, baselineSha256: manifest.baselineSha256, verified: true, verifiedAt: new Date().toISOString(), checks: checks[0].count };
    mkdirSync(".private/database-evidence", { recursive: true });
    writeFileSync(`.private/database-evidence/${target.environment}-fresh-install.json`, JSON.stringify(evidence, null, 2) + "\n", { mode: 0o600 });
    console.log(JSON.stringify(evidence));
  } finally { await client.end(); }
}

main().catch(() => {
  console.error("Fresh-install check failed. No automatic reset or recovery was attempted. Check target settings and migration state privately; never paste database credentials into chat.");
  process.exitCode = 1;
});
