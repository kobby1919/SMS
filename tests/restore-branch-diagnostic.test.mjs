import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";

const path = "src/lib/services/restore-branch-diagnostic.ts";
const source = readFileSync(path, "utf8");
const exports = {};
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports, require: () => ({}), URL, Date });
const inspect = exports.getRestoreBranchConnectionDiagnostic;
const target = "ep-blue-sound-ba4q8i6i.c-8.eu-central-1.aws.neon.tech";
const resultFor = (value) => inspect({ DATABASE_URL: value }).connections[0].comparison;

test("direct and pooled connections to the exact old restore endpoint are flagged", () => {
  for (const host of [target, target.replace(".c-8", "-pooler.c-8"), target.toUpperCase(), `${target}.`]) {
    assert.equal(resultFor(`postgresql://user:private-password@${host}/db`), "MATCH");
  }
  assert.equal(resultFor(`postgres://user:private-password@${target}/db`), "MATCH");
});

test("query-string host precedence matches the application driver's parsing", () => {
  assert.equal(resultFor(`postgresql://u:p@ep-other.c-8.eu-central-1.aws.neon.tech/db?host=${target}`), "MATCH");
  assert.equal(resultFor(`postgresql://u:p@${target}/db?host=ep-other.c-8.eu-central-1.aws.neon.tech`), "DIFFERENT");
  assert.equal(resultFor(`postgresql://u:p@ep-other.c-8.eu-central-1.aws.neon.tech/db?host=first&host=${target}`), "MATCH");
});

test("missing, malformed, proxy and ambiguous connections never imply that deletion is safe", () => {
  assert.equal(resultFor(undefined), "NOT_CONFIGURED");
  for (const value of ["private-invalid-url", `https://${target}/db`, "postgresql://u:p@proxy.internal/db", "postgresql://u:p@localhost/db", `postgresql://u:p@${target}.evil.example/db`, `postgresql://u:p@${target}/db?host=one,two`]) assert.equal(resultFor(value), "UNKNOWN");
  assert.equal(resultFor("postgresql://u:p@ep-other.c-8.eu-central-1.aws.neon.tech/db"), "DIFFERENT");
});

test("only whitelisted metadata and comparison results leave the server", () => {
  const env = {
    DATABASE_URL: `postgresql://private-user:private-password@${target}/private-db?sslmode=require`,
    DIRECT_URL: `postgresql://private-user:private-password@${target}/private-db`,
    NEON_RECOVERY_API_KEY: "private-api-key",
    VERCEL_ENV: "production", VERCEL_URL: "edujay-release.vercel.app", VERCEL_GIT_COMMIT_SHA: "a".repeat(40),
  };
  const result = inspect(env);
  assert.equal(result.connections[0].comparison, "MATCH");
  assert.equal(result.connections[1].comparison, "MATCH");
  assert.equal(result.commit, "aaaaaaa");
  assert.equal(result.environment, "production");
  const serialized = JSON.stringify(result);
  assert.doesNotMatch(serialized, /private-user|private-password|private-db|private-api-key|postgresql:|ep-blue-sound/);
  const malformed = inspect({ VERCEL_ENV: "private-password", VERCEL_URL: "https://u:private-password@host/", VERCEL_GIT_COMMIT_SHA: "private-password" });
  assert.doesNotMatch(JSON.stringify(malformed), /private-password/);
});

test("diagnostic has no network, database or filesystem effects and stays on a dynamic platform-guarded page", () => {
  assert.doesNotMatch(source, /fetch\(|prisma|readFile|console\.|\.connect\(/);
  const page = readFileSync("src/app/(dashboard)/platform/onboarding/page.tsx", "utf8");
  assert.match(page, /dynamic = "force-dynamic"/);
  assert.ok(page.indexOf('requirePageSession(["platform_admin"])') < page.indexOf("<RestoreBranchConnectionCheck"));
  const panel = readFileSync("src/components/RestoreBranchConnectionCheck.tsx", "utf8");
  assert.match(panel, /not permission to delete/);
  assert.doesNotMatch(panel, /"use client"/);
});
