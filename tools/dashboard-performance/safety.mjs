import assert from 'node:assert/strict';

export function validateLoadTarget(config, env) {
  assert.equal(env.EDUJAY_DISPOSABLE_TEST_ACK, 'ISOLATED_APP_AND_SYNTHETIC_DATABASE');
  const target = new URL(config.baseUrl);
  assert.ok(['localhost', '127.0.0.1'].includes(target.hostname), 'Mixed writes are restricted to an isolated local app.');
  assert.equal(target.protocol, 'http:');
  assert.ok(target.port && target.port !== '3000', 'Do not use the working app port.');
  assert.ok(!target.username && !target.password);
  const test = new URL(env.DASHBOARD_TEST_DATABASE_URL);
  const current = new URL(env.DATABASE_URL);
  assert.ok(['postgres:', 'postgresql:'].includes(test.protocol));
  assert.notEqual(`${test.hostname}:${test.port || '5432'}${test.pathname}`, `${current.hostname}:${current.port || '5432'}${current.pathname}`, 'A different schema or login on the same working database is not isolation.');
  assert.match(config.fixtureToken, /^EDUJAY_LOADTEST_[A-Z0-9]{8,32}$/);
  assert.ok(Array.isArray(config.adminStates) && config.adminStates.length >= 2 && config.adminStates.length <= 10);
  for (const state of [...config.adminStates, config.bursarState, config.teacherState]) assert.ok(typeof state === 'string' && state.startsWith('.private/'));
  assert.ok(Number.isInteger(config.rounds) && config.rounds >= 1 && config.rounds <= 10);
  for (const id of [config.billId, config.activityId]) assert.ok(Number.isSafeInteger(id) && id > 0);
  for (const id of [config.schoolId, config.studentId, config.teacherId, config.bucketTitle]) assert.ok(typeof id === 'string' && id.length > 0);
  assert.ok(Number.isFinite(config.paymentAmount) && config.paymentAmount >= 0.01 && config.paymentAmount <= 100);
  assert.ok(Number.isFinite(config.rawScore) && config.rawScore >= 0);
  const assessment = new URL(config.assessmentPath, target.origin);
  assert.equal(assessment.origin, target.origin);
  assert.ok(assessment.pathname === '/list/ca' || assessment.pathname.startsWith('/list/ca/'));
  assert.ok(Number.isFinite(config.maxDashboardP95Ms) && config.maxDashboardP95Ms > 0 && config.maxDashboardP95Ms <= 60000);
  return target;
}
