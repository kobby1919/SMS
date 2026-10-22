import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";

const source = readFileSync("src/lib/services/onboarding.ts", "utf8");
const ast = ts.createSourceFile("onboarding.ts", source, ts.ScriptTarget.Latest, true);
const declaration = ast.statements.find((node) => ts.isFunctionDeclaration(node) && node.name?.text === "completeSchoolOnboarding");
assert.ok(declaration);
const compiled = ts.transpileModule(declaration.getText(ast), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;
const load = new Function("exports", "getSchoolOnboardingState", "withApprovedMigration", compiled + "; return exports.completeSchoolOnboarding;");

for (const route of ["fresh", "migration"]) {
  test(`${route} completion initializes missing operating settings without enabling delivery`, async () => {
    const events = [];
    const school = { code: "TEST", onboardingStatus: "USERS_DONE", _count: { grades: 1, classes: 1, subjects: 1 } };
    const tx = {
      school: {
        findUniqueOrThrow: async () => school,
        update: async () => { events.push("complete"); return { ...school, onboardingStatus: "COMPLETED" }; },
      },
      schoolNotificationSetting: { upsert: async (input) => {
        events.push("settings");
        assert.equal(input.where.schoolId, "school-test");
        assert.equal(JSON.stringify(input.create), JSON.stringify({ schoolId: "school-test", emailEnabled: false, smsEnabled: false, whatsappEnabled: false }));
        assert.equal(JSON.stringify(input.update), "{}");
      } },
      onboardingAuditLog: { create: async () => { events.push("audit"); } },
    };
    const complete = load({}, async () => ({ ...school, setupPath: route }), async (schoolId, work, requireInventory, steps) => {
      assert.equal(schoolId, "school-test");
      assert.equal(requireInventory, false);
      assert.equal(JSON.stringify(steps), '["complete"]');
      return work(tx);
    });
    await complete({ schoolId: "school-test", userId: "admin-test", role: "admin" });
    assert.deepEqual(events, ["settings", "complete", "audit"]);
  });
}

test("settings failure prevents completion and completion audit", async () => {
  const unexpected = async () => assert.fail("Completion must stop if settings cannot be initialized");
  const school = { code: "TEST", onboardingStatus: "USERS_DONE", _count: { grades: 1, classes: 1, subjects: 1 } };
  const complete = load({}, async () => school, async (_schoolId, work) => work({
    school: { findUniqueOrThrow: async () => school, update: unexpected },
    schoolNotificationSetting: { upsert: async () => { throw new Error("settings unavailable"); } },
    onboardingAuditLog: { create: unexpected },
  }));
  await assert.rejects(complete({ schoolId: "school-test", userId: "admin-test", role: "admin" }), /settings unavailable/);
});
