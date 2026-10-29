import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";
import * as generated from "../../src/generated/prisma/index.js";

const require = createRequire(import.meta.url);
const files = new Set([
  "migration/inventory", "migration/staging", "migration/reconciliation", "migration/recovery", "migration/column-mapping", "migration/invite-email",
  "validation/data-migration", "admission-number", "prisma-conflicts", "services/migration-inventory", "services/migration-recovery",
  "services/migration-staging", "services/migration-staging-storage", "services/migration-staging-parser",
  "services/data-migration-validation", "services/data-migration-import", "services/migration-reconciliation", "services/onboarding", "roles",
]);
const external = new Set(["zod", "crypto", "node:crypto", "node:fs/promises", "node:path", "csv-parse/sync"]);

export function loadMigrationServices(prisma) {
  const cache = new Map();
  const unsupported = () => { throw new Error("This subject-only rehearsal must not execute people or finance paths."); };
  const injected = {
    "server-only": {}, "@/src/lib/prisma": { default: prisma }, "@/src/generated/prisma": generated,
    "@/src/lib/cacheTags": { revalidateDashboard() {}, revalidateReferenceData() {} },
    "@/src/lib/services/user-management": { studentRecordUsername: unsupported },
    "@/src/lib/services/bill-discounts": { applyDiscountInTransaction: unsupported },
    "@clerk/nextjs/server": { clerkClient: unsupported },
    "@/src/lib/services/notifications": { appBaseUrl: unsupported, sendFirstAdminInviteEmail: unsupported, sendSchoolAdminInviteEmail: unsupported },
    "@/src/lib/services/onboarding-policy": { getSchoolAdminInviteAccountSafety: unsupported },
  };
  // Ephemeral test key and non-production recovery mode never alter process.env or deployment settings.
  const isolatedProcess = { env: { NODE_ENV: "test", MIGRATION_STAGING_ENCRYPTION_KEY: randomBytes(32).toString("base64") }, cwd: () => process.cwd() };
  function load(name) {
    if (Object.hasOwn(injected, name)) return injected[name];
    if (external.has(name)) return require(name);
    const key = name.replace(/^@\/src\/lib\//, "");
    if (!files.has(key) || !name.startsWith("@/src/lib/")) throw new Error("Unexpected integration dependency; review the service allowlist.");
    if (cache.has(key)) return cache.get(key);
    const filename = `src/lib/${key}.ts`;
    const exports = {};
    cache.set(key, exports);
    const source = ts.transpileModule(readFileSync(filename, "utf8"), { compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
    } }).outputText;
    vm.runInNewContext(source, { exports, require: load, Buffer, Date, Set, Map, BigInt, process: isolatedProcess }, { filename });
    return exports;
  }
  return Object.fromEntries(Object.entries({
    inventoryCore: "migration/inventory", inventory: "services/migration-inventory", staging: "services/migration-staging",
    importer: "services/data-migration-import", reconciliation: "services/migration-reconciliation",
    storage: "services/migration-staging-storage", parser: "services/migration-staging-parser",
    conflicts: "prisma-conflicts",
    recovery: "services/migration-recovery", onboarding: "services/onboarding",
  }).map(([key, file]) => [key, load(`@/src/lib/${file}`)]));
}
