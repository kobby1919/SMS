import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseArgs, parseEnv } from "node:util";
import pg from "pg";
import { Prisma } from "../../src/generated/prisma/index.js";
import { baselineName, validateTarget, verifyBundle } from "./fresh-install-safety.mjs";
import { assertRuntimeAttributes, buildRuntimeGrants, createRuntimeRoleSql, runtimeConnectionUrls, runtimeRole } from "./runtime-role-policy.mjs";

const { values } = parseArgs({ options: { apply: { type: "boolean", default: false }, verify: { type: "boolean", default: false } } });
const privateDirectory = realpathSync(".private");
function privateFile(name) {
  const result = path.join(privateDirectory, name);
  if (existsSync(result) && path.dirname(realpathSync(result)) !== privateDirectory) throw new Error("Private file resolves outside the private directory.");
  return result;
}
function clientFor(url, applicationName) {
  const verified = new URL(url);
  verified.searchParams.set("sslmode", "verify-full");
  return new pg.Client({ connectionString: verified.toString(), connectionTimeoutMillis: 15000,
    statement_timeout: 15000, application_name: applicationName });
}
const tables = [...Prisma.dmmf.datamodel.models.map((model) => model.dbName ?? model.name), "_SubjectToTeacher"].sort();

async function verifyLogin(url, label) {
  const client = clientFor(url, `edujay-runtime-${label}-verification`);
  await client.connect();
  try {
    const identity = (await client.query("SELECT current_user AS role,current_database() AS database")).rows[0];
    if (identity.role !== runtimeRole || identity.database !== "neondb") throw new Error("Unexpected runtime identity.");
    const role = (await client.query("SELECT rolcanlogin,rolsuper,rolcreatedb,rolcreaterole,rolreplication,rolbypassrls,rolinherit FROM pg_roles WHERE rolname=current_user")).rows[0];
    const memberships = (await client.query("SELECT count(*)::int AS count FROM pg_auth_members WHERE member=(SELECT oid FROM pg_roles WHERE rolname=current_user)")).rows[0].count;
    const ownsObjects = (await client.query("SELECT EXISTS(SELECT 1 FROM pg_database WHERE datdba=(SELECT oid FROM pg_roles WHERE rolname=current_user)) OR EXISTS(SELECT 1 FROM pg_class WHERE relowner=(SELECT oid FROM pg_roles WHERE rolname=current_user)) OR EXISTS(SELECT 1 FROM pg_namespace WHERE nspowner=(SELECT oid FROM pg_roles WHERE rolname=current_user)) AS owns")).rows[0].owns;
    assertRuntimeAttributes(role, memberships, ownsObjects);
    const privileges = (await client.query(`SELECT has_schema_privilege(current_user,'public','CREATE') AS schema_create,
      has_database_privilege(current_user,current_database(),'CREATE') AS database_create,
      has_database_privilege(current_user,current_database(),'TEMP') AS temp,
      has_table_privilege(current_user,'public._prisma_migrations','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') AS history`)).rows[0];
    if (Object.values(privileges).some(Boolean)) throw new Error("Runtime role has forbidden DDL or migration-history access.");
    const tablePermissions = (await client.query(`SELECT c.relname,has_table_privilege(current_user,c.oid,'SELECT') AND
      has_table_privilege(current_user,c.oid,'INSERT') AND has_table_privilege(current_user,c.oid,'UPDATE') AND
      has_table_privilege(current_user,c.oid,'DELETE') AS dml,
      has_table_privilege(current_user,c.oid,'TRUNCATE,REFERENCES,TRIGGER') AS extra
      FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r' AND c.relname<>'_prisma_migrations' ORDER BY c.relname`)).rows;
    if (JSON.stringify(tablePermissions.map((row) => row.relname)) !== JSON.stringify(tables) || tablePermissions.some((row) => !row.dml || row.extra)) throw new Error("Application table privileges differ from the allowlist.");
    const sequences = (await client.query(`SELECT bool_and(has_sequence_privilege(current_user,c.oid,'USAGE') AND NOT has_sequence_privilege(current_user,c.oid,'UPDATE')) AS allowed FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='S'`)).rows[0];
    if (sequences.allowed !== true) throw new Error("Sequence privileges are incorrect.");

    // One transaction keeps pooled checks on one connection and rolls back every test write.
    await client.query("BEGIN");
    try {
      const id = "runtime_probe_" + randomBytes(12).toString("hex");
      await client.query('INSERT INTO public."School" (id,name,slug,"updatedAt") VALUES ($1,$2,$1,now())', [id, "Synthetic runtime permission check"]);
      const changed = await client.query('UPDATE public."School" SET name=$2 WHERE id=$1 RETURNING id', [id, "Updated synthetic check"]);
      if (changed.rowCount !== 1) throw new Error("Runtime update check failed.");
      const found = await client.query('SELECT id FROM public."School" WHERE id=$1', [id]);
      if (found.rowCount !== 1) throw new Error("Runtime read check failed.");
      await client.query('DELETE FROM public."School" WHERE id=$1', [id]);
      for (const forbidden of [
        'SELECT 1 FROM public._prisma_migrations LIMIT 1',
        'UPDATE public._prisma_migrations SET checksum=checksum WHERE false',
        'CREATE TABLE public.edujay_permission_probe (id integer)',
        'CREATE TEMP TABLE edujay_permission_probe (id integer)',
        'ALTER TABLE public."School" ADD COLUMN edujay_permission_probe integer',
        'TRUNCATE TABLE public."School"',
        'CREATE ROLE edujay_permission_probe NOLOGIN',
        'SET ROLE neondb_owner',
      ]) {
        await client.query("SAVEPOINT denied_operation");
        let denied = false;
        try { await client.query(forbidden); } catch (error) { if (error.code !== "42501") throw error; denied = true; }
        await client.query("ROLLBACK TO SAVEPOINT denied_operation");
        if (!denied) throw new Error("A forbidden operation unexpectedly succeeded.");
      }
    } finally { await client.query("ROLLBACK"); }
    return { connection: label, role: runtimeRole, tables: tablePermissions.length, tlsVerified: true, checksPassed: true };
  } finally { await client.end(); }
}

async function main() {
  if (values.apply && values.verify) throw new Error("Choose apply or verify.");
  const settings = parseEnv(readFileSync(privateFile("neon-staging-migrations.env"), "utf8"));
  const target = validateTarget({ environment: "staging", url: settings.EDUJAY_MIGRATION_DATABASE_URL,
    expectedHost: settings.EDUJAY_EXPECTED_DATABASE_HOST, productionHost: settings.EDUJAY_PRODUCTION_DATABASE_HOST });
  const { manifest, checksum } = verifyBundle();
  const evidence = JSON.parse(readFileSync(path.join(privateDirectory, "database-evidence/staging-fresh-install.json"), "utf8"));
  if (evidence.environment !== "staging" || evidence.host !== target.host || evidence.verified !== true || evidence.baselineSha256 !== manifest.baselineSha256 ||
      !Number.isFinite(Date.parse(evidence.verifiedAt)) || Date.parse(evidence.verifiedAt) > Date.now() || Date.now() - Date.parse(evidence.verifiedAt) > 7 * 86400_000) throw new Error("Matching recent staging schema evidence is required.");
  const owner = clientFor(settings.EDUJAY_MIGRATION_DATABASE_URL, "edujay-staging-runtime-role-setup");
  await owner.connect();
  const runtimeFile = privateFile("neon-staging-runtime.env");
  try {
    const identity = (await owner.query("SELECT current_user AS role,current_database() AS database")).rows[0];
    if (identity.role !== "neondb_owner" || identity.database !== "neondb") throw new Error("Unexpected migration-owner identity.");
    const history = (await owner.query('SELECT migration_name,checksum,finished_at,rolled_back_at FROM public._prisma_migrations')).rows;
    if (history.length !== 1 || history[0].migration_name !== baselineName || history[0].checksum !== checksum || !history[0].finished_at || history[0].rolled_back_at) throw new Error("Staging schema history is unexpected.");
    const actual = (await owner.query("SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename<>'_prisma_migrations' ORDER BY tablename")).rows.map((row) => row.tablename);
    if (JSON.stringify(actual) !== JSON.stringify(tables)) throw new Error("The installed table list differs from the generated model allowlist.");
    const roleExists = (await owner.query("SELECT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=$1) AS exists", [runtimeRole])).rows[0].exists;
    console.log(JSON.stringify({ environment: "staging", tables: tables.length, roleExists, mode: values.apply ? "APPLY" : values.verify ? "VERIFY" : "READ_ONLY_PREFLIGHT" }));
    if (!values.apply && !values.verify) return;
    if (values.apply) {
      if (roleExists || existsSync(runtimeFile)) throw new Error("Runtime role or credential file already exists. Never silently rotate or replace it.");
      const password = randomBytes(32).toString("hex");
      const urls = runtimeConnectionUrls(settings.EDUJAY_MIGRATION_DATABASE_URL, password);
      // Write secrets only to this ignored private file, never stdout, command arguments or Git.
      writeFileSync(runtimeFile, `# STAGING ONLY. Keep private. Never use in Production.\nDATABASE_URL=${urls.pooled}\nEDUJAY_STAGING_DIRECT_URL=${urls.direct}\n`, { flag: "wx", mode: 0o600 });
      await owner.query("BEGIN");
      try {
        await owner.query("SELECT pg_advisory_xact_lock(18453,19000)");
        await owner.query(`${createRuntimeRoleSql} PASSWORD '${password}'`);
        await owner.query(buildRuntimeGrants(tables));
        await owner.query("COMMIT");
      } catch (error) { await owner.query("ROLLBACK"); throw error; }
    }
    const runtime = parseEnv(readFileSync(runtimeFile, "utf8"));
    // Verify the saved targets before allowing any synthetic probe.
    const direct = new URL(runtime.EDUJAY_STAGING_DIRECT_URL);
    const pooled = new URL(runtime.DATABASE_URL);
    const expected = runtimeConnectionUrls(settings.EDUJAY_MIGRATION_DATABASE_URL, decodeURIComponent(direct.password));
    if (direct.toString() !== expected.direct || pooled.toString() !== expected.pooled) throw new Error("Saved runtime connection targets do not match staging.");
    const results = [];
    results.push(await verifyLogin(expected.direct, "direct"));
    results.push(await verifyLogin(expected.pooled, "pooled"));
    const remaining = (await owner.query('SELECT count(*)::int AS count FROM public."School" WHERE id LIKE \'runtime_probe_%\'')).rows[0].count;
    if (remaining !== 0) throw new Error("Synthetic runtime probe records remain; stop and investigate.");
    writeFileSync(path.join(privateDirectory, "database-evidence/staging-runtime-role.json"), JSON.stringify({ environment: "staging", host: target.host,
      role: runtimeRole, baselineSha256: manifest.baselineSha256, verifiedAt: new Date().toISOString(), results, syntheticRowsRemaining: remaining }, null, 2) + "\n", { mode: 0o600 });
    console.log(JSON.stringify({ verified: true, results, syntheticRowsRemaining: remaining, credentialsSavedPrivately: true }));
  } finally { await owner.end(); }
}

main().catch((error) => {
  console.error(JSON.stringify({ failed: true, code: /^\d{5}$/.test(error?.code ?? "") ? error.code : "SETUP_OR_VERIFICATION_FAILED",
    message: "Stopped without automatic retry, password rotation or cleanup. Inspect staging state privately; never paste credential files into chat." }));
  process.exitCode = 1;
});
