import assert from "node:assert/strict";
import { existsSync, readFileSync, realpathSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseEnv } from "node:util";
import pg from "pg";
import { PGlite } from "@electric-sql/pglite";
import { baselineName, verifyBundle } from "./fresh-install-safety.mjs";
import { assertCatalogMatches, restoreCatalogQueries, validateRestoreTarget } from "./restore-verification-policy.mjs";

let phase = "PRIVATE_TARGET_VALIDATION";

function privatePath(name, exists = true) {
  const root = realpathSync(".private");
  const result = path.join(root, name);
  const resolved = exists || existsSync(result) ? realpathSync(result) : path.join(realpathSync(path.dirname(result)), path.basename(result));
  if (!resolved.startsWith(root + path.sep)) throw new Error("Private evidence path escapes its directory.");
  return resolved;
}

async function main() {
  const saved = parseEnv(readFileSync(privatePath("neon-restore-verification.env"), "utf8"));
  const source = parseEnv(readFileSync(privatePath("neon-staging-migrations.env"), "utf8"));
  const target = validateRestoreTarget({ url: saved.EDUJAY_RESTORE_DATABASE_URL, branchId: saved.EDUJAY_RESTORE_BRANCH_ID,
    stagingHost: source.EDUJAY_EXPECTED_DATABASE_HOST, productionHost: source.EDUJAY_PRODUCTION_DATABASE_HOST });
  const { sql, manifest, checksum } = verifyBundle();
  const expectedDatabase = new PGlite();
  let client;
  try {
    await expectedDatabase.exec(sql);
    await expectedDatabase.exec("SET search_path TO pg_catalog,public");
    const expected = {};
    for (const [name, query] of Object.entries(restoreCatalogQueries)) expected[name] = (await expectedDatabase.query(query)).rows;
    client = new pg.Client({ connectionString: target.url, connectionTimeoutMillis: 15000, statement_timeout: 15000,
      application_name: "edujay-isolated-snapshot-verification" });
    phase = "RESTORED_CONNECTION";
    await client.connect();
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    try {
      await client.query("SET LOCAL search_path TO pg_catalog,public");
      phase = "SERVER_IDENTITY";
      const identity = (await client.query(`SELECT current_user AS role,current_database() AS database,
        current_setting('transaction_read_only') AS read_only,current_setting('neon.branch_id',true) AS branch_id,
        current_setting('neon.endpoint_id',true) AS endpoint_id,current_setting('server_version_num') AS version`)).rows[0];
      assert.equal(identity.role, "neondb_owner"); assert.equal(identity.database, "neondb"); assert.equal(identity.read_only, "on");
      if (identity.branch_id && identity.branch_id !== target.branchId) throw new Error("Server branch identity differs from the operator-supplied restore branch.");
      if (identity.endpoint_id && target.host.split(".")[0] !== identity.endpoint_id) throw new Error("Server endpoint identity differs from the restored connection.");
      const actual = {};
      phase = "RESTORED_CATALOG";
      for (const [name, query] of Object.entries(restoreCatalogQueries)) actual[name] = (await client.query(query)).rows;
      for (const name of Object.keys(restoreCatalogQueries)) {
        if (JSON.stringify(actual[name]) !== JSON.stringify(expected[name])) console.log(JSON.stringify({ catalogMismatch: name, actualRows: actual[name].length, expectedRows: expected[name].length }));
      }
      assertCatalogMatches(actual, expected);
      const indexesHealthy = (await client.query(`SELECT bool_and(i.indisvalid AND i.indisready) AS healthy FROM pg_index i
        JOIN pg_class c ON c.oid=i.indexrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public'`)).rows[0].healthy;
      assert.equal(indexesHealthy, true);
      const constraintsValidated = (await client.query(`SELECT bool_and(con.convalidated) AS validated FROM pg_constraint con
        JOIN pg_namespace n ON n.oid=con.connamespace WHERE n.nspname='public'`)).rows[0].validated;
      assert.equal(constraintsValidated, true);
      phase = "MIGRATION_HISTORY";
      const migrations = (await client.query('SELECT migration_name,checksum,finished_at,rolled_back_at FROM public._prisma_migrations')).rows;
      assert.equal(migrations.length, 1);
      assert.equal(migrations[0].migration_name, baselineName); assert.equal(migrations[0].checksum, checksum);
      assert.ok(migrations[0].finished_at); assert.equal(migrations[0].rolled_back_at, null);
      const counts = [];
      phase = "EMPTY_CHECKPOINT_COUNTS";
      for (const { tablename } of actual.tables) {
        const quoted = '"' + tablename.replaceAll('"', '""') + '"';
        counts.push({ table: tablename, count: (await client.query(`SELECT count(*)::text AS count FROM public.${quoted}`)).rows[0].count });
      }
      const nonempty = counts.filter((row) => row.count !== "0");
      // This particular provider snapshot was taken after all synthetic staging fixtures were removed.
      if (nonempty.length) throw new Error("The restored snapshot is not the expected empty rehearsal checkpoint; do not remove records to force a pass.");
      assert.equal(actual.tables.length, 91);
      const checks = actual.constraints.filter((row) => row.contype === "c").length;
      assert.equal(checks, manifest.checks);
      const evidence = { environment: "isolated-restore", branchId: target.branchId, host: target.host, verifiedAt: new Date().toISOString(),
        schemaVerified: true, baselineSha256: manifest.baselineSha256, migrationHistoryVerified: true, indexesHealthy, constraintsValidated,
        postgresMajor: Math.floor(Number(identity.version) / 10000),
        readOnly: true, tlsVerified: true, tables: counts.length, checkConstraints: checks, allApplicationTablesEmpty: true,
        serverBranchIdentityVerified: Boolean(identity.branch_id),
        branchIdentityBasis: identity.branch_id ? "server setting matches operator branch ID" : "operator-provided branch ID and distinct endpoint; server branch setting unavailable",
        scope: "Reviewed schema, constraints/index definitions, migration checksum and empty application tables. No school-data, financial, encrypted-upload, production restore or RPO/RTO certification." };
      await client.query("ROLLBACK");
      mkdirSync(".private/database-evidence", { recursive: true });
      writeFileSync(privatePath("database-evidence/restored-snapshot-schema.json", false), JSON.stringify(evidence, null, 2) + "\n", { mode: 0o600 });
      console.log(JSON.stringify(evidence));
    } catch (error) { await client.query("ROLLBACK").catch(() => {}); throw error; }
  } finally {
    try { await client?.end(); }
    finally { await expectedDatabase.close(); }
  }
}

main().catch((error) => {
  console.error(JSON.stringify({ failed: true, phase, code: /^[A-Z0-9]{5}$/.test(error?.code ?? "") ? error.code : "RESTORE_VERIFICATION_FAILED",
    message: "Read-only verification stopped. No reset, data cleanup, connection migration or switchover was attempted. Inspect private target settings and evidence; never paste credentials." }));
  process.exitCode = 1;
});
