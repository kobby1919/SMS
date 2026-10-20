import test from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { blockedSessionCountSql, postgresErrorCode } from "../tools/database/concurrency-locks.mjs";

test("Prisma raw serialization failures are distinguished from unrelated database errors", () => {
  const raw = { code: "P2010", meta: { driverAdapterError: { cause: { originalCode: "40001" } } } };
  assert.equal(postgresErrorCode(raw), "40001");
  assert.equal(postgresErrorCode({ code: "P2010", meta: { code: "23505" } }), "23505");
  assert.equal(postgresErrorCode({ code: "P2010", meta: { message: "40001" } }), undefined);
});

test("lock observation includes queued waiters, deduplicates chains and excludes unrelated sessions", async () => {
  const db = new PGlite();
  try {
    // Isolated catalog fixtures reproduce a holder, queued waiters and unrelated activity.
    await db.exec(`CREATE SCHEMA test_catalog;
      CREATE TABLE test_catalog.pg_stat_activity (pid integer PRIMARY KEY, blockers integer[]);
      INSERT INTO test_catalog.pg_stat_activity VALUES (100,'{}'),(200,'{100}'),(300,'{200}'),(400,'{100,200}'),(500,'{}');
      CREATE FUNCTION test_catalog.pg_blocking_pids(integer) RETURNS integer[] LANGUAGE SQL STABLE
        AS 'SELECT blockers FROM test_catalog.pg_stat_activity WHERE pid=$1';
      SET search_path TO test_catalog,pg_catalog;`);
    assert.equal((await db.query(blockedSessionCountSql, [100])).rows[0].count, 3);
    assert.equal((await db.query(blockedSessionCountSql, [200])).rows[0].count, 2);
    assert.equal((await db.query(blockedSessionCountSql, [500])).rows[0].count, 0);
    assert.equal((await db.query(blockedSessionCountSql, [999])).rows[0].count, 0);
  } finally { await db.close(); }
});
