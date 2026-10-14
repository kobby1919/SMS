import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

function availability(env) {
  const loaded = { exports: {} };
  const code = ts.transpileModule(readFileSync("src/lib/services/notification-provider-adapters.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function("require", "module", "exports", "process", "fetch", code)(() => ({}), loaded, loaded.exports, { env }, () => { throw new Error("Tracking must never call a provider"); });
  return loaded.exports.notificationProviderAvailability;
}

test("provider capability checks do not send or claim unsupported channels are configured", () => {
  const check = availability({ EMAIL_PROVIDER: "resend", RESEND_API_KEY: "private-test-key", NODE_ENV: "production" });
  assert.equal(check("EMAIL"), "AVAILABLE");
  assert.equal(check("SMS"), "UNSUPPORTED");
  assert.equal(check("WHATSAPP"), "UNSUPPORTED");
  assert.equal(availability({ EMAIL_PROVIDER: "other", RESEND_API_KEY: "key" })("EMAIL"), "UNSUPPORTED");
  assert.equal(availability({ NODE_ENV: "production" })("EMAIL"), "NOT_CONFIGURED");
  assert.equal(availability({ NODE_ENV: "development" })("EMAIL"), "SIMULATED");
  assert.equal(availability({ NODE_ENV: "production", RESEND_API_KEY: "  " })("EMAIL"), "NOT_CONFIGURED");
});
