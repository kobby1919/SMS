import test from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { assertRuntimeAttributes, buildRuntimeGrants, createRuntimeRoleSql, runtimeConnectionUrls } from "../tools/database/runtime-role-policy.mjs";

test("runtime connection URLs use a separate identity and verified TLS", () => {
  const urls = runtimeConnectionUrls("postgresql://neondb_owner:owner-test@ep-staging.c-8.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require", "runtime-test");
  for (const value of Object.values(urls)) {
    const url = new URL(value);
    assert.equal(url.username, "edujay_app");
    assert.equal(url.password, "runtime-test");
    assert.equal(url.searchParams.get("sslmode"), "verify-full");
    assert.equal(url.searchParams.get("channel_binding"), "require");
  }
  assert.equal(new URL(urls.pooled).hostname, "ep-staging-pooler.c-8.eu-central-1.aws.neon.tech");
  assert.throws(() => runtimeConnectionUrls(urls.pooled, "test"));
  assert.throws(() => runtimeConnectionUrls(urls.direct, ""));
});

test("allowlist excludes migration history, unsafe names, duplicates and future tables", () => {
  for (const tables of [[], ["_prisma_migrations"], ["School", "School"], ["School; DROP SCHEMA public"]]) assert.throws(() => buildRuntimeGrants(tables));
  assert.doesNotMatch(buildRuntimeGrants(["School"]), /DEFAULT PRIVILEGES|ALL TABLES/);
});

test("attribute verification rejects administrative, inherited and owner permissions", () => {
  const role = { rolcanlogin: true, rolsuper: false, rolcreatedb: false, rolcreaterole: false, rolreplication: false, rolbypassrls: false, rolinherit: false };
  assert.doesNotThrow(() => assertRuntimeAttributes(role, 0, false));
  for (const flag of ["rolsuper", "rolcreatedb", "rolcreaterole", "rolreplication", "rolbypassrls", "rolinherit"]) assert.throws(() => assertRuntimeAttributes({ ...role, [flag]: true }, 0, false));
  assert.throws(() => assertRuntimeAttributes(role, 1, false));
  assert.throws(() => assertRuntimeAttributes(role, 0, true));
});

test("actual PostgreSQL permits runtime CRUD but denies DDL and migration access", async () => {
  const db = new PGlite();
  try {
    await db.exec('CREATE TABLE public."School" (id text PRIMARY KEY,name text); CREATE TABLE public._prisma_migrations (checksum text); CREATE SEQUENCE public.runtime_test_seq; CREATE ROLE neondb_owner NOLOGIN;');
    await db.exec(createRuntimeRoleSql);
    const database = (await db.query("SELECT current_database() AS name")).rows[0].name;
    // PGlite uses its own database name; the deployed Neon policy remains fixed to neondb.
    await db.exec(buildRuntimeGrants(["School"]).replaceAll("DATABASE neondb", `DATABASE "${database.replaceAll('"', '""')}"`));
    await db.exec("SET SESSION AUTHORIZATION edujay_app; BEGIN");
    await db.exec('INSERT INTO public."School" VALUES (\'synthetic\',\'test\'); UPDATE public."School" SET name=\'updated\' WHERE id=\'synthetic\';');
    assert.equal((await db.query('SELECT name FROM public."School"')).rows[0].name, "updated");
    await db.exec('DELETE FROM public."School" WHERE id=\'synthetic\'');
    for (const sql of [
      "SELECT * FROM public._prisma_migrations",
      "UPDATE public._prisma_migrations SET checksum=checksum WHERE false",
      "CREATE TABLE public.denied (id integer)",
      "CREATE TEMP TABLE denied (id integer)",
      'ALTER TABLE public."School" ADD COLUMN denied integer',
      'TRUNCATE public."School"',
      "CREATE ROLE denied NOLOGIN",
      "SET ROLE neondb_owner",
      "SELECT setval('public.runtime_test_seq',10)",
    ]) {
      await db.exec("SAVEPOINT denied_operation");
      await assert.rejects(db.exec(sql), (error) => error.code === "42501", sql);
      await db.exec("ROLLBACK TO SAVEPOINT denied_operation");
    }
    await db.exec("ROLLBACK; RESET SESSION AUTHORIZATION");
    assert.equal((await db.query('SELECT count(*)::int AS count FROM public."School"')).rows[0].count, 0);
    await db.exec("CREATE TABLE public.future_table (id integer); SET SESSION AUTHORIZATION edujay_app");
    await assert.rejects(db.exec("SELECT * FROM public.future_table"), (error) => error.code === "42501");
  } finally { await db.close(); }
});
