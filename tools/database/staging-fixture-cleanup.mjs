import assert from "node:assert/strict";

export async function cleanupStagingFixtures(prisma, ids) {
  assert.equal(ids.length, 3); assert.equal(new Set(ids).size, 3);
  assert.ok(ids.every((id) => /^concurrency_probe_[0-9a-f-]{36}$/.test(id)));
  const schools = await prisma.school.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, slug: true } });
  assert.ok(schools.every((school) => school.name === "Synthetic concurrency rehearsal" && school.slug === school.id));
  await prisma.$transaction(async (tx) => {
    await tx.onboardingAuditLog.deleteMany({ where: { schoolId: { in: ids } } });
    await tx.migrationStagedUpload.deleteMany({ where: { schoolId: { in: ids } } });
    await tx.subject.deleteMany({ where: { schoolId: { in: ids } } });
    assert.equal((await tx.school.deleteMany({ where: { id: { in: ids } } })).count, schools.length);
  });
  assert.equal(await prisma.school.count({ where: { id: { in: ids } } }), 0);
  for (const model of [prisma.onboardingAuditLog, prisma.migrationStagedUpload, prisma.subject]) {
    assert.equal(await model.count({ where: { schoolId: { in: ids } } }), 0);
  }
}
