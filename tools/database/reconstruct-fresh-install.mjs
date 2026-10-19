import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";

// Offline investigation only: no dotenv, pg client, network or live database URL.
const root = process.cwd();
const output = path.join(root, ".private", "fresh-install-review");
mkdirSync(output, { recursive: true });
const historical = execFileSync("git", ["show", "593a38c:prisma/schema.prisma"], { encoding: "utf8" });
writeFileSync(path.join(output, "pre-tenancy.prisma"), historical);
const cli = path.join(root, "node_modules/prisma/build/index.js");
function schemaSql(schema) {
  return execFileSync(process.execPath, [cli, "migrate", "diff", "--from-empty", "--to-schema", schema, "--script", "--config", "prisma.fresh.config.ts"], {
    encoding: "utf8", maxBuffer: 16 * 1024 * 1024,
    env: { ...process.env, DATABASE_URL: "", EDUJAY_MIGRATION_DATABASE_URL: "" },
  });
}
const historicalSql = schemaSql(path.join(output, "pre-tenancy.prisma"));
writeFileSync(path.join(output, "pre-tenancy.sql"), historicalSql);
writeFileSync(path.join(output, "current-schema.sql"), schemaSql("prisma/schema.prisma"));
const db = new PGlite();
let reconstructionFailed = false;
try {
  await db.exec(historicalSql);
  for (const name of readdirSync("prisma/migrations").filter((name) => /^\d/.test(name) && name >= "202605").sort()) {
    try {
      await db.exec(readFileSync(path.join("prisma/migrations", name, "migration.sql"), "utf8"));
    } catch (error) {
      console.error(JSON.stringify({ failedMigration: name, message: error.message }));
      reconstructionFailed = true;
      break;
    }
  }
  if (reconstructionFailed) throw new Error("Historical reconstruction failed; refusing baseline generation.");
  const expected = new PGlite();
  try {
    await expected.exec(readFileSync(path.join(output, "current-schema.sql"), "utf8"));
    const catalog = async (connection) => ({
      columns: (await connection.query(`SELECT table_name, column_name, data_type, udt_name, is_nullable, column_default FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name, ordinal_position`)).rows,
      constraints: (await connection.query(`SELECT c.relname AS table_name, con.conname AS name, con.contype AS type, pg_get_constraintdef(con.oid) AS definition FROM pg_constraint con JOIN pg_class c ON c.oid=con.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' ORDER BY c.relname,con.conname`)).rows,
      indexes: (await connection.query(`SELECT tablename AS table_name,indexname AS name,indexdef AS definition FROM pg_indexes WHERE schemaname='public' ORDER BY tablename,indexname`)).rows,
    });
    const actualCatalog = await catalog(db);
    const expectedCatalog = await catalog(expected);
    writeFileSync(path.join(output, "catalog.json"), JSON.stringify({ reconstructed: actualCatalog, expected: expectedCatalog }, null, 2));
    const difference = (left, right, key) => left.filter((item) => !right.some((other) => key(item) === key(other)));
    for (const field of ["columns", "constraints", "indexes"]) {
      const key = field === "columns" ? (row) => JSON.stringify(row) : (row) => JSON.stringify([row.table_name, row.definition]);
      console.log(JSON.stringify({ field, historicalOnly: difference(actualCatalog[field], expectedCatalog[field], key).length, schemaOnly: difference(expectedCatalog[field], actualCatalog[field], key).length }));
    }
    const quote = (name) => '"' + name.replaceAll('"', '""') + '"';
    const checks = actualCatalog.constraints.filter((row) => row.type === "c");
    const indexSignature = (row) => row.definition.slice(row.definition.indexOf(" ON "));
    const extraIndexes = difference(actualCatalog.indexes, expectedCatalog.indexes, indexSignature);
    const safetySql = [
      "-- Database-only safeguards recovered from the immutable legacy migration history.",
      ...checks.map((row) => `ALTER TABLE public.${quote(row.table_name)} ADD CONSTRAINT ${quote(row.name)} ${row.definition};`),
      ...extraIndexes.map((row) => row.definition + ";"),
    ].join("\n");
    const baseline = "-- Fresh installations only. Do not apply to an existing school database.\n" +
      "-- Canonical Prisma schema plus recovered SQL-only safety constraints. No seeds.\n\nBEGIN;\n\n" +
      readFileSync(path.join(output, "current-schema.sql"), "utf8") + "\n" + safetySql + "\n\nCOMMIT;\n";
    writeFileSync(path.join(output, "baseline.sql"), baseline);
    if (process.argv.includes("--write-baseline")) {
      const directory = "prisma/fresh-migrations/20261019000000_fresh_install";
      mkdirSync(directory, { recursive: true });
      writeFileSync(path.join(directory, "migration.sql"), baseline, { flag: "wx" });
      writeFileSync("prisma/fresh-migrations/migration_lock.toml", 'provider = "postgresql"\n', { flag: "wx" });
      const hash = (body) => createHash("sha256").update(body.toString().replaceAll("\r\n", "\n")).digest("hex");
      const legacy = readdirSync("prisma/migrations").filter((name) => /^\d/.test(name)).sort().map((name) => ({
        name, sha256: hash(readFileSync(path.join("prisma/migrations", name, "migration.sql"))),
      }));
      writeFileSync("prisma/fresh-migrations/provenance.json", JSON.stringify({
        historicalSchemaCommit: "593a38c", schemaSha256: hash(readFileSync("prisma/schema.prisma")),
        baselineSha256: hash(baseline), checks: checks.length, extraIndexes: extraIndexes.length, legacy,
        knownLegacyDrift: ["Missing pre-tenancy CA/curriculum/finance DDL", "ParentTeacherContactMessage.studentId and foreign key missing", "Historical updatedAt/default and array-nullability differences", "Legacy identifiers truncated differently from Prisma-generated names"],
      }, null, 2) + "\n", { flag: "wx" });
      console.log(`Fresh baseline generated: ${checks.length} check constraints and ${extraIndexes.length} additional indexes.`);
    }
  } finally { await expected.close(); }
  console.log("Offline reconstruction artifacts written to .private/fresh-install-review (no live connection).");
} finally {
  await db.close();
}
