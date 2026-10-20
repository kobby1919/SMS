import test from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { verifyBundle } from "../tools/database/fresh-install-safety.mjs";
import { assertCatalogMatches, restoreCatalogQueries, validateRestoreTarget } from "../tools/database/restore-verification-policy.mjs";

const stagingHost = "ep-staging.c-8.eu-central-1.aws.neon.tech";
const productionHost = "ep-production.c-8.eu-central-1.aws.neon.tech";
const host = "ep-restored.c-8.eu-central-1.aws.neon.tech";
const target = { url: `postgresql://neondb_owner:synthetic-test-only@${host}/neondb?sslmode=require&channel_binding=require`, branchId: "br-restored-test", stagingHost, productionHost };

test("restore target requires a distinct direct endpoint, owner identity, valid pins and verified TLS", () => {
  const restored = validateRestoreTarget(target);
  assert.equal(restored.environment, "isolated-restore"); assert.equal(restored.branchId, target.branchId);
  assert.equal(new URL(restored.url).searchParams.get("sslmode"), "verify-full");
  for (const badHost of [stagingHost, productionHost, stagingHost.replace(".", "-pooler."), productionHost.replace(".", "-pooler.")]) {
    assert.throws(() => validateRestoreTarget({ ...target, url: target.url.replace(host, badHost) }));
  }
  for (const update of [{ stagingHost: "" }, { stagingHost: "https://example.com" }, { branchId: host }, { branchId: target.url },
    { url: target.url.replace("neondb_owner", "edujay_app") }, { url: target.url.replace("sslmode=require", "sslmode=disable") },
    { url: target.url + "&options=unsafe" }]) assert.throws(() => validateRestoreTarget({ ...target, ...update }));
});

test("reviewed baseline catalog comparison catches missing tables, fields, constraints, indexes and enum values", async () => {
  const db = new PGlite();
  try {
    await db.exec(verifyBundle().sql);
    await db.exec("SET search_path TO pg_catalog,public");
    const expected = {};
    for (const [name, query] of Object.entries(restoreCatalogQueries)) expected[name] = (await db.query(query)).rows;
    assert.equal(expected.tables.length, 91);
    assert.equal(expected.constraints.filter((row) => row.contype === "c").length, 18);
    assert.doesNotThrow(() => assertCatalogMatches(expected, expected));
    for (const name of Object.keys(expected)) {
      assert.ok(expected[name].length > 0);
      const altered = structuredClone(expected); altered[name].pop();
      assert.throws(() => assertCatalogMatches(altered, expected), new RegExp(name));
    }
    const nullable = structuredClone(expected); nullable.columns[0].required = !nullable.columns[0].required;
    assert.throws(() => assertCatalogMatches(nullable, expected), /columns/);
  } finally { await db.close(); }
});
