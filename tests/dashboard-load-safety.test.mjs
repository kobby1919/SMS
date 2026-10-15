import test from 'node:test';
import assert from 'node:assert/strict';
import { validateLoadTarget } from '../tools/dashboard-performance/safety.mjs';

const config = { baseUrl: 'http://localhost:3100', fixtureToken: 'EDUJAY_LOADTEST_ABCDEFGH', adminStates: ['.private/admin1.json', '.private/admin2.json'], bursarState: '.private/bursar.json', teacherState: '.private/teacher.json', rounds: 2, billId: 1, activityId: 1, schoolId: 'synthetic', studentId: 'student', teacherId: 'teacher', bucketTitle: 'Test', paymentAmount: 1, rawScore: 0, assessmentPath: '/list/ca?classId=1', maxDashboardP95Ms: 15000 };
const env = { EDUJAY_DISPOSABLE_TEST_ACK: 'ISOLATED_APP_AND_SYNTHETIC_DATABASE', DATABASE_URL: 'postgres://working/db', DASHBOARD_TEST_DATABASE_URL: 'postgres://isolated/test' };
test('mixed-load rehearsal requires explicit isolation and private role sessions', () => {
  assert.equal(validateLoadTarget(config, env).port, '3100');
  for (const value of [undefined, '', 'yes']) assert.throws(() => validateLoadTarget(config, { ...env, EDUJAY_DISPOSABLE_TEST_ACK: value }));
  assert.throws(() => validateLoadTarget(config, { ...env, DASHBOARD_TEST_DATABASE_URL: 'postgres://another:password@working/db?schema=test' }));
  assert.throws(() => validateLoadTarget({ ...config, teacherState: 'public/session.json' }, env));
});
test('mixed-load rehearsal refuses production origins, working app, unbounded work and invalid fixtures', () => {
  for (const override of [{ baseUrl: 'https://edujay.app' }, { baseUrl: 'http://localhost:3000' }, { assessmentPath: 'https://example.com' }, { rounds: 100 }, { rawScore: -1 }, { paymentAmount: Infinity }, { fixtureToken: 'real school' }, { adminStates: [] }]) assert.throws(() => validateLoadTarget({ ...config, ...override }, env));
});
