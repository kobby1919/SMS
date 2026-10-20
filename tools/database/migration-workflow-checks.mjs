import assert from "node:assert/strict";
import { loadMigrationServices } from "./migration-service-harness.mjs";

export async function checkMigrationWorkflows({ prisma, holder, observer, ids, run, waitForBlocked }) {
  const { inventoryCore, inventory, staging, importer, reconciliation, conflicts } = loadMigrationServices(prisma);
  const { isSerializationConflict } = conflicts;
  const pid = (await holder.query("SELECT pg_backend_pid() AS pid")).rows[0].pid;
  const request = (schoolId, uploadId) => ({ schoolId, uploadId, actorId: "synthetic-admin" });
  const approval = (fingerprint) => ({ fingerprint, representative: "Synthetic representative", reviewNote: "Reviewed synthetic subjects and their committed import evidence.", checkedSamples: true, acknowledged: true });
  const stage = (schoolId, name) => staging.stageMigrationUpload(schoolId, "synthetic-admin", {
    areaKey: "subjects", fileName: "synthetic-subjects.csv", csv: `Subject\n${name}\n`, mapping: { subjectName: "Subject" },
  });
  const recoverable = (error) => isSerializationConflict(error) || (error instanceof importer.MigrationImportError && error.status === 409);
  const audits = (schoolId, action) => prisma.onboardingAuditLog.count({ where: { schoolId, action } });
  for (const schoolId of ids) await inventory.saveMigrationInventory(schoolId, "synthetic-admin", {
    version: 0, status: "CONFIRMED", source: "Synthetic full-workflow rehearsal", representative: "Synthetic representative", acknowledged: true, finance: null,
    rows: inventoryCore.inventoryDatasets.map(([key]) => ({ key, disposition: key === "subjects" ? "INCLUDE" : "EXCLUDE",
      expectedRecords: key === "subjects" ? 1 : 0, files: key === "subjects" ? "synthetic-subjects.csv" : "", reason: "Synthetic subject-only test", from: "", to: "" })),
  });

  // Keep each contested request observed and awaited before fixture cleanup can begin.
  async function contested(table, id, work) {
    const requests = [];
    const failures = [];
    const start = (promise) => {
      requests.push(promise);
      promise.catch((error) => { failures.push(error); });
      return promise;
    };
    await holder.query("BEGIN");
    try {
      assert.ok(["School", "MigrationStagedUpload"].includes(table));
      const lock = table === "School" ? "FOR NO KEY UPDATE" : "FOR UPDATE";
      await holder.query(`SELECT id FROM public."${table}" WHERE id=$1 ${lock}`, [id]);
      await work(start, (count) => waitForBlocked(observer, pid, count, failures));
    } finally { await holder.query("ROLLBACK"); await Promise.allSettled(requests); }
    return Promise.allSettled(requests);
  }

  await run("duplicate_full_import_has_one_commit_and_idempotent_retry", (async () => {
    const upload = await stage(ids[0], "Synthetic duplicate subject");
    const settled = await contested("MigrationStagedUpload", upload.uploadId, async (start, blocked) => {
      start(importer.importValidatedMigrationRows(request(ids[0], upload.uploadId)));
      start(importer.importValidatedMigrationRows(request(ids[0], upload.uploadId)));
      await blocked(2);
    });
    assert.equal(settled.filter((row) => row.status === "fulfilled").length, 1);
    const rejected = settled.find((row) => row.status === "rejected").reason;
    if (!recoverable(rejected)) throw rejected;
    const committed = settled.find((row) => row.status === "fulfilled").value;
    assert.equal(committed.importedRows, 1);
    assert.equal(await prisma.subject.count({ where: { schoolId: ids[0] } }), 1);
    assert.equal(await audits(ids[0], "IMPORT_RECORDED"), 1);
    const retry = await importer.importValidatedMigrationRows(request(ids[0], upload.uploadId));
    assert.equal(JSON.stringify(retry), JSON.stringify(committed));
    assert.equal(await audits(ids[0], "IMPORT_RECORDED"), 1);
  })());

  await run("cancellation_commits_before_waiting_import_without_partial_writes", (async () => {
    const upload = await stage(ids[1], "Synthetic cancelled subject");
    const settled = await contested("School", ids[1], async (start, blocked) => {
      start(importer.importValidatedMigrationRows(request(ids[1], upload.uploadId)));
      await blocked(1);
      await start(staging.cancelStagedMigration(ids[1], "synthetic-admin", upload.uploadId));
    });
    assert.equal(settled[0].status, "rejected"); assert.ok(recoverable(settled[0].reason));
    assert.equal(settled[1].status, "fulfilled");
    const saved = await prisma.migrationStagedUpload.findUniqueOrThrow({ where: { id: upload.uploadId } });
    assert.equal(saved.status, "CANCELLED"); assert.equal(saved.encryptedPayload, null); assert.equal(saved.encryptedResult, null);
    assert.equal(await prisma.subject.count({ where: { schoolId: ids[1] } }), 0);
    assert.equal(await audits(ids[1], "IMPORT_RECORDED"), 0);
    assert.equal(await audits(ids[1], "MIGRATION_UPLOAD_CANCELLED"), 1);
  })());

  await run("import_commits_before_waiting_cancel_preserving_result_and_audit", (async () => {
    const upload = await stage(ids[1], "Synthetic import winner subject");
    const settled = await contested("MigrationStagedUpload", upload.uploadId, async (start, blocked) => {
      start(importer.importValidatedMigrationRows(request(ids[1], upload.uploadId)));
      await blocked(1);
      start(staging.cancelStagedMigration(ids[1], "synthetic-admin", upload.uploadId));
      await blocked(2);
    });
    assert.equal(settled[0].status, "fulfilled"); assert.equal(settled[0].value.importedRows, 1);
    assert.equal(settled[1].status, "rejected");
    assert.equal(settled[1].reason?.constructor?.name, "MigrationStagingError"); assert.equal(settled[1].reason.status, 409);
    const saved = await prisma.migrationStagedUpload.findUniqueOrThrow({ where: { id: upload.uploadId } });
    assert.equal(saved.status, "IMPORTED"); assert.ok(saved.encryptedResult);
    assert.equal(await prisma.subject.count({ where: { schoolId: ids[1] } }), 1);
    assert.equal(await audits(ids[1], "IMPORT_RECORDED"), 1);
    assert.equal(await audits(ids[1], "MIGRATION_UPLOAD_CANCELLED"), 1);
  })());

  await run("concurrent_import_rejects_stale_approval_then_fresh_review_succeeds", (async () => {
    const upload = await stage(ids[2], "Synthetic approval subject");
    const before = await reconciliation.getMigrationReconciliation(ids[2]);
    assert.equal(before.canApprove, false);
    const settled = await contested("School", ids[2], async (start, blocked) => {
      start(importer.importValidatedMigrationRows(request(ids[2], upload.uploadId)));
      await blocked(1);
      start(reconciliation.approveMigrationReconciliation(ids[2], "synthetic-reviewer", approval(before.fingerprint)));
      await blocked(2);
    });
    assert.equal(settled[0].status, "fulfilled");
    assert.equal(settled[1].status, "rejected");
    assert.ok(isSerializationConflict(settled[1].reason) || settled[1].reason instanceof reconciliation.MigrationReconciliationError);
    assert.equal(await audits(ids[2], "MIGRATION_RECONCILIATION_APPROVED"), 0);
    const after = await reconciliation.getMigrationReconciliation(ids[2]);
    assert.equal(after.canApprove, true); assert.notEqual(after.fingerprint, before.fingerprint);
    await reconciliation.approveMigrationReconciliation(ids[2], "synthetic-reviewer", approval(after.fingerprint));
    assert.ok((await reconciliation.getMigrationReconciliation(ids[2])).approval);
    assert.equal(await audits(ids[2], "MIGRATION_RECONCILIATION_APPROVED"), 1);
    assert.equal(await prisma.subject.count({ where: { schoolId: ids[2] } }), 1);
  })());
}
