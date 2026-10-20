import assert from "node:assert/strict";
import { loadMigrationServices } from "./migration-service-harness.mjs";
import { migrationContest } from "./contested-migration.mjs";

export async function checkMigrationRecovery({ prisma, holder, observer, ids, run, waitForBlocked }) {
  const { inventoryCore, inventory, recovery, staging, importer, reconciliation, onboarding, conflicts } = loadMigrationServices(prisma);
  const pid = (await holder.query("SELECT pg_backend_pid() AS pid")).rows[0].pid;
  const contested = migrationContest({ holder, observer, waitForBlocked, pid });
  const context = (schoolId) => ({ role: "admin", schoolId, userId: "synthetic-admin" });
  const importRequest = (schoolId, uploadId) => ({ schoolId, uploadId, actorId: "synthetic-admin" });
  const scope = (version = 0, status = "CONFIRMED") => ({ version, status, source: "Synthetic recovery race rehearsal",
    representative: "Synthetic representative", acknowledged: status === "CONFIRMED", finance: null,
    rows: inventoryCore.inventoryDatasets.map(([key]) => ({ key, disposition: key === "subjects" ? "INCLUDE" : "EXCLUDE",
      expectedRecords: key === "subjects" ? 1 : 0, files: key === "subjects" ? "synthetic-subjects.csv" : "",
      reason: "Synthetic subject-only rehearsal", from: "", to: "" })) });
  const plan = (version, status = "HOLD") => ({ version, inventoryVersion: 1, status,
    decisionOwner: "Synthetic recovery operator", recoveryPointMinutes: 60, recoveryTimeMinutes: 120,
    cutoverNote: "Synthetic staging concurrency check only; no production backup or restore attestation.",
    holdReason: status === "HOLD" ? "Synthetic safety hold for concurrency verification." : "", acknowledged: true, evidence: null });
  const savePlan = (schoolId, version, status) => recovery.saveMigrationRecovery(schoolId, "synthetic-recovery-operator", plan(version, status));
  const stage = (schoolId, name) => staging.stageMigrationUpload(schoolId, "synthetic-admin", {
    areaKey: "subjects", fileName: "synthetic-subjects.csv", csv: `Subject\n${name}\n`, mapping: { subjectName: "Subject" },
  });
  const audits = (schoolId, action) => prisma.onboardingAuditLog.count({ where: { schoolId, action } });
  const assertRejected = (row, ErrorType) => {
    assert.equal(row.status, "rejected");
    if (!conflicts.isSerializationConflict(row.reason) && !(row.reason instanceof ErrorType)) throw row.reason;
  };
  const notCompleted = async (schoolId) => {
    const school = await prisma.school.findUniqueOrThrow({ where: { id: schoolId } });
    assert.notEqual(school.onboardingStatus, "COMPLETED"); assert.equal(school.setupCompletedAt, null);
    assert.equal(await audits(schoolId, "ONBOARDING_COMPLETED"), 0);
  };
  for (const id of ids) await inventory.saveMigrationInventory(id, "synthetic-admin", scope());

  let heldUpload;
  await run("hold_commits_before_waiting_import_and_blocks_retry", (async () => {
    heldUpload = await stage(ids[0], "Synthetic held subject");
    const settled = await contested("School", ids[0], async (start, blocked) => {
      start(savePlan(ids[0], 0, "HOLD")); await blocked(1);
      start(importer.importValidatedMigrationRows(importRequest(ids[0], heldUpload.uploadId))); await blocked(2);
    });
    assert.equal(settled[0].status, "fulfilled"); assertRejected(settled[1], importer.MigrationImportError);
    assert.equal(await prisma.subject.count({ where: { schoolId: ids[0] } }), 0);
    assert.equal(await audits(ids[0], "IMPORT_RECORDED"), 0);
    assert.equal((await recovery.getMigrationRecovery(ids[0])).plan.status, "HOLD");
    await assert.rejects(importer.importValidatedMigrationRows(importRequest(ids[0], heldUpload.uploadId)), (error) => error instanceof importer.MigrationImportError && /on hold/.test(error.message));
    assert.equal((await prisma.migrationStagedUpload.findUniqueOrThrow({ where: { id: heldUpload.uploadId } })).status, "VALIDATED");
  })());

  await run("active_import_finishes_before_hold_then_new_import_is_fenced", (async () => {
    await savePlan(ids[0], 1, "READY");
    const settled = await contested("MigrationStagedUpload", heldUpload.uploadId, async (start, blocked) => {
      start(importer.importValidatedMigrationRows(importRequest(ids[0], heldUpload.uploadId))); await blocked(1);
      start(savePlan(ids[0], 2, "HOLD")); await blocked(2);
    });
    assert.equal(settled[0].status, "fulfilled"); assert.equal(settled[0].value.importedRows, 1);
    if (settled[1].status === "rejected") {
      if (!conflicts.isSerializationConflict(settled[1].reason)) throw settled[1].reason;
      // A failed serializable HOLD is not an active hold; explicitly record it after refresh.
      assert.equal((await recovery.getMigrationRecovery(ids[0])).plan.version, 2);
      await savePlan(ids[0], 2, "HOLD");
    }
    const hold = await recovery.getMigrationRecovery(ids[0]);
    assert.equal(hold.plan.status, "HOLD"); assert.equal(hold.plan.version, 3);
    const imported = await prisma.onboardingAuditLog.findFirstOrThrow({ where: { schoolId: ids[0], action: "IMPORT_RECORDED" } });
    assert.ok(imported.id < hold.logId);
    const next = await stage(ids[0], "Synthetic next upload under hold");
    await assert.rejects(importer.importValidatedMigrationRows(importRequest(ids[0], next.uploadId)), (error) => error instanceof importer.MigrationImportError && /on hold/.test(error.message));
    assert.equal(await prisma.subject.count({ where: { schoolId: ids[0] } }), 1);
    assert.equal(await audits(ids[0], "IMPORT_RECORDED"), 1);
  })());

  async function prepareCompletion(schoolId, index) {
    await prisma.school.update({ where: { id: schoolId }, data: { code: `TST${index}`, onboardingStatus: "USERS_DONE", setupStep: "complete" } });
    const grade = await prisma.grade.create({ data: { schoolId, level: "Synthetic grade", order: 1 } });
    await prisma.class.create({ data: { schoolId, gradeId: grade.id, name: "Synthetic class", capacity: 10 } });
    const upload = await stage(schoolId, "Synthetic completion subject");
    assert.equal((await importer.importValidatedMigrationRows(importRequest(schoolId, upload.uploadId))).importedRows, 1);
    const report = await reconciliation.getMigrationReconciliation(schoolId);
    assert.equal(report.canApprove, true);
    await reconciliation.approveMigrationReconciliation(schoolId, "synthetic-reviewer", { fingerprint: report.fingerprint,
      representative: "Synthetic representative", reviewNote: "Reviewed all synthetic subjects and their import evidence.", checkedSamples: true, acknowledged: true });
  }

  await run("inventory_edit_invalidates_approval_before_waiting_completion", (async () => {
    await prepareCompletion(ids[1], 1);
    const settled = await contested("School", ids[1], async (start, blocked) => {
      start(inventory.saveMigrationInventory(ids[1], "synthetic-editor", scope(1, "DRAFT"))); await blocked(1);
      start(onboarding.completeSchoolOnboarding(context(ids[1]))); await blocked(2);
    });
    assert.equal(settled[0].status, "fulfilled"); assertRejected(settled[1], reconciliation.MigrationReconciliationError);
    await notCompleted(ids[1]);
    assert.equal((await inventory.getMigrationInventory(ids[1])).version, 2);
    assert.equal((await reconciliation.getMigrationReconciliation(ids[1])).approval, null);
    await assert.rejects(onboarding.completeSchoolOnboarding(context(ids[1])), (error) => error instanceof reconciliation.MigrationReconciliationError);
  })());

  await run("hold_commits_before_waiting_completion_and_blocks_retry", (async () => {
    await prepareCompletion(ids[2], 2);
    const settled = await contested("School", ids[2], async (start, blocked) => {
      start(savePlan(ids[2], 0, "HOLD")); await blocked(1);
      start(onboarding.completeSchoolOnboarding(context(ids[2]))); await blocked(2);
    });
    assert.equal(settled[0].status, "fulfilled"); assertRejected(settled[1], reconciliation.MigrationReconciliationError);
    await notCompleted(ids[2]);
    await assert.rejects(onboarding.completeSchoolOnboarding(context(ids[2])), (error) => error instanceof reconciliation.MigrationReconciliationError && /on hold/.test(error.message));
  })());

  await run("concurrent_completion_commits_once_and_retry_is_idempotent", (async () => {
    await savePlan(ids[2], 1, "READY");
    const settled = await contested("School", ids[2], async (start, blocked) => {
      start(onboarding.completeSchoolOnboarding(context(ids[2])));
      start(onboarding.completeSchoolOnboarding(context(ids[2])));
      await blocked(2);
    });
    assert.equal(settled.filter((row) => row.status === "fulfilled").length, 1);
    assertRejected(settled.find((row) => row.status === "rejected"), reconciliation.MigrationReconciliationError);
    assert.equal((await prisma.school.findUniqueOrThrow({ where: { id: ids[2] } })).onboardingStatus, "COMPLETED");
    assert.equal(await audits(ids[2], "ONBOARDING_COMPLETED"), 1);
    assert.equal((await onboarding.completeSchoolOnboarding(context(ids[2]))).onboardingStatus, "COMPLETED");
    assert.equal(await audits(ids[2], "ONBOARDING_COMPLETED"), 1);
  })());
}
