import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { baselineName, requireEmptyDatabase, sha256, validateStagingEvidence, validateTarget, verifyBundle } from "../tools/database/fresh-install-safety.mjs";

const stagingHost = "ep-test-staging.c-8.eu-central-1.aws.neon.tech";
const productionHost = "ep-test-production.c-8.eu-central-1.aws.neon.tech";
const staging = { environment: "staging", url: `postgresql://neondb_owner:synthetic-test-only@${stagingHost}/neondb?sslmode=require`, expectedHost: stagingHost, productionHost };
const { manifest, sql } = verifyBundle();
let db;
let expected;
before(async () => {
  db = new PGlite();
  expected = new PGlite();
  const expectedSql = execFileSync(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "diff", "--from-empty", "--to-schema", "prisma/schema.prisma", "--script", "--config", "prisma.fresh.config.ts"], {
    encoding: "utf8", maxBuffer: 16 * 1024 * 1024, env: { ...process.env, DATABASE_URL: "", EDUJAY_MIGRATION_DATABASE_URL: "" },
  });
  await db.exec(sql);
  await expected.exec(expectedSql);
});
after(async () => { await db?.close(); await expected?.close(); });

test("fresh PostgreSQL catalog matches every canonical table, column, type, default and foreign key", async () => {
  for (const query of [
    `SELECT c.relname AS table_name,a.attname AS column_name,format_type(a.atttypid,a.atttypmod) AS type,a.attnotnull AS required,pg_get_expr(d.adbin,d.adrelid) AS default_value FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace LEFT JOIN pg_attrdef d ON d.adrelid=c.oid AND d.adnum=a.attnum WHERE n.nspname='public' AND c.relkind='r' AND a.attnum>0 AND NOT a.attisdropped ORDER BY c.relname,a.attname`,
    `SELECT c.relname,con.conname,con.contype,pg_get_constraintdef(con.oid) AS definition FROM pg_constraint con JOIN pg_class c ON c.oid=con.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND con.contype IN ('p','f','u') ORDER BY c.relname,con.conname`,
    `SELECT t.typname,e.enumlabel,e.enumsortorder FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public' ORDER BY t.typname,e.enumsortorder`,
  ]) assert.deepEqual((await db.query(query)).rows, (await expected.query(query)).rows);
});

test("all canonical indexes plus the five recovered indexes exist", async () => {
  const query = "SELECT indexname,indexdef FROM pg_indexes WHERE schemaname='public' ORDER BY indexname";
  const actual = (await db.query(query)).rows;
  const canonical = (await expected.query(query)).rows;
  for (const index of canonical) assert.deepEqual(actual.find((row) => row.indexname === index.indexname), index);
  assert.equal(actual.length - canonical.length, manifest.extraIndexes);
  assert.equal((await db.query("SELECT count(*)::int AS count FROM pg_constraint WHERE contype='c' AND connamespace='public'::regnamespace")).rows[0].count, 18);
});

test("fresh initialization seeds no schools, users, balances or operational records", async () => {
  const tables = (await db.query("SELECT tablename FROM pg_tables WHERE schemaname='public'")).rows;
  assert.ok(tables.length > 80);
  for (const { tablename } of tables) {
    const name = '"' + tablename.replaceAll('"', '""') + '"';
    assert.equal((await db.query(`SELECT count(*)::int AS count FROM ${name}`)).rows[0].count, 0, tablename);
  }
});

test("legacy migration files retain their original checksums", () => {
  for (const entry of manifest.legacy) assert.equal(sha256(readFileSync(`prisma/migrations/${entry.name}/migration.sql`)), entry.sha256, entry.name);
});

test("review hashes survive Windows/Linux line endings while Prisma checksums stay byte-exact", () => {
  assert.equal(sha256("one\r\ntwo\r\n"), sha256("one\ntwo\n"));
  assert.match(readFileSync(".gitattributes", "utf8"), /prisma\/fresh-migrations\/\*\* text eol=lf/);
  assert.equal(verifyBundle().checksum.length, 64);
});

test("migration commands cannot inherit the working DATABASE_URL", () => {
  const config = readFileSync("prisma.fresh.config.ts", "utf8");
  assert.doesNotMatch(config, /dotenv|process\.env\.DATABASE_URL/);
  assert.match(config, /EDUJAY_MIGRATION_DATABASE_URL/);
  const runner = readFileSync("tools/database/fresh-install.mjs", "utf8");
  assert.doesNotMatch(runner, /["'](?:reset|push|resolve|seed)["']/);
  assert.match(runner, /if \(!values.execute\) return/);
});

test("target guard rejects production aliases, pooled URLs, weak TLS and wrong identities", () => {
  assert.equal(validateTarget(staging).host, stagingHost);
  for (const input of [
    { ...staging, environment: "development" }, { ...staging, expectedHost: undefined },
    { ...staging, productionHost: stagingHost }, { ...staging, productionHost: stagingHost.replace(".c-8", "-pooler.c-8") },
    { ...staging, url: staging.url.replace(stagingHost, productionHost) },
    { ...staging, url: staging.url.replace("sslmode=require", "sslmode=disable") },
    { ...staging, url: staging.url.replace("neondb_owner", "edujay_app") },
    { ...staging, url: staging.url.replace(".c-8", "-pooler.c-8") },
    { ...staging, url: staging.url.replace("/neondb", "/other") },
    { ...staging, url: staging.url.replace(stagingHost, "localhost") },
    { ...staging, url: staging.url + "&host=localhost" },
    { ...staging, url: staging.url + "&sslmode=disable" },
    { ...staging, url: staging.url + "&options=-c%20search_path%3Dother" },
  ]) assert.throws(() => validateTarget(input));
});

test("fresh install refuses any existing tables, sequences, views or enum history", () => {
  assert.doesNotThrow(() => requireEmptyDatabase([], []));
  for (const relations of [[{ relname: "Student" }], [{ relname: "_prisma_migrations" }], [{ relname: "orphan_sequence" }]]) {
    assert.throws(() => requireEmptyDatabase(relations, []));
  }
  assert.throws(() => requireEmptyDatabase([], [{ typname: "Term" }]));
});

test("production requires current exact-baseline evidence from a distinct staging endpoint", () => {
  const now = Date.now();
  const evidence = { environment: "staging", verified: true, host: stagingHost, database: "neondb", baselineSha256: manifest.baselineSha256, verifiedAt: new Date(now).toISOString() };
  const target = { host: productionHost, database: "neondb" };
  assert.doesNotThrow(() => validateStagingEvidence(evidence, target, manifest.baselineSha256, now));
  for (const change of [{ verified: false }, { environment: "production" }, { host: productionHost }, { baselineSha256: "different" }, { database: "other" }, { verifiedAt: new Date(now - 8 * 86400_000).toISOString() }, { verifiedAt: new Date(now + 60000).toISOString() }]) {
    assert.throws(() => validateStagingEvidence({ ...evidence, ...change }, target, manifest.baselineSha256, now));
  }
});

test("payment reference and correction duplicate protection enforce real PostgreSQL writes", async () => {
  await db.exec(`
    INSERT INTO "School" (id,name,slug,"updatedAt") VALUES ('test-school','Synthetic','synthetic',now());
    INSERT INTO "Parent" (id,username,name,surname,address,"schoolId") VALUES ('test-parent','parent','Test','Parent','Test','test-school');
    INSERT INTO "Grade" (id,level,"order","schoolId") VALUES (1,'P1',1,'test-school');
    INSERT INTO "Class" (id,name,capacity,"schoolId","gradeId") VALUES (1,'P1',10,'test-school',1);
    INSERT INTO "Student" (id,username,name,surname,address,"bloodType",sex,"updatedAt","schoolId","parentId","classId","gradeId") VALUES ('test-student','student','Test','Student','Test','Unknown','MALE',now(),'test-school','test-parent',1,1);
    INSERT INTO "FeeStructure" (id,title,"academicYear",term,"schoolId","gradeId","createdBy","updatedAt") VALUES (1,'Synthetic','2026/2027','TERM_1','test-school',1,'test-bursar',now());
    INSERT INTO "StudentBill" (id,"totalAmount",balance,"schoolId","studentId","feeStructureId","generatedBy","updatedAt") VALUES (1,100,100,'test-school','test-student',1,'test-bursar',now());
  `);
  const payment = `INSERT INTO "Payment" ("receiptNumber",amount,"paymentMethod","paidBy","referenceNo",status,"schoolId","studentBillId","recordedBy") VALUES ($1,10,'BANK_TRANSFER','Test',$2,$3,'test-school',1,'test-bursar') RETURNING id`;
  const first = (await db.query(payment, ["RCP-TEST-1", "REF-ABC", "CONFIRMED"])).rows[0].id;
  await assert.rejects(db.query(payment, ["RCP-TEST-2", "ref-abc", "PENDING"]), (error) => error.code === "23505");
  await db.query('UPDATE "Payment" SET status=\'REVERSED\' WHERE id=$1', [first]);
  await db.query(payment, ["RCP-TEST-3", "ref-abc", "CONFIRMED"]);
  const correction = `INSERT INTO "PaymentCorrectionRequest" (type,"requestedAction",reason,"requestedBy","schoolId","originalPaymentId","studentBillId","updatedAt",status) VALUES ('DUPLICATE_PAYMENT','REVERSE_PAYMENT','Synthetic','test-bursar','test-school',$1,1,now(),$2)`;
  await db.query(correction, [first, "PENDING_REVIEW"]);
  await assert.rejects(db.query(correction, [first, "APPROVED"]), (error) => error.code === "23505");
});

test("SQL-only positive CA and bounded upload constraints are present in the installed catalog", async () => {
  const rows = (await db.query("SELECT conname,pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE connamespace='public'::regnamespace AND contype='c'")).rows;
  for (const name of ["CABucket_allocationMarks_positive", "CAActivity_rawMaxScore_positive", "CAActivityScore_rawScore_nonnegative", "MigrationStagedUpload_byteSize_check", "MigrationStagedUpload_rowCount_check", "AppNotifDelivery_terminal_timestamp_chk"]) {
    assert.ok(rows.find((row) => row.conname === name), name);
  }
});

test("a second application fails instead of overwriting the installed schema", async () => {
  await assert.rejects(db.exec(sql), /already exists/);
  await db.exec("ROLLBACK");
  assert.equal((await db.query('SELECT count(*)::int AS count FROM "School"')).rows[0].count, 1);
  assert.match(baselineName, /^\d{14}_fresh_install$/);
});

test("failure before commit rolls the whole fresh schema back", async () => {
  const isolated = new PGlite();
  try {
    await assert.rejects(isolated.exec(sql.replace(/COMMIT;\s*$/, "SELECT 1/0; COMMIT;")), /division by zero/);
    await isolated.exec("ROLLBACK");
    assert.equal((await isolated.query("SELECT count(*)::int AS count FROM pg_tables WHERE schemaname='public'")).rows[0].count, 0);
    assert.equal((await isolated.query("SELECT count(*)::int AS count FROM pg_type WHERE typnamespace='public'::regnamespace AND typtype='e'")).rows[0].count, 0);
  } finally { await isolated.close(); }
});
