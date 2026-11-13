import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
function load(path, mocks = {}) {
  const m = { exports: {} };
  const code = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('require', 'module', 'exports', code)((id) => mocks[id] ?? {}, m, m.exports);
  return m.exports;
}
const shared = load('src/lib/ca-entry-window-status.ts');
const { evaluateTeacherCAEntryWindowStatus } = load('src/lib/services/teacher-ca-entry-window.ts');
test('server supplies actual close instant including allowance in the school timezone', () => {
  const status = evaluateTeacherCAEntryWindowStatus({
    settings: { allowEarlyAttendanceMarking: false, attendanceOpenMinutesBeforeLesson: 0, attendanceGraceMinutesAfterLesson: 10, attendanceEscalateMinutesAfterLesson: 30 },
    lessons: [{ day: 'FRIDAY', subjectId: 1, subject: { name: 'English' }, startTime: new Date('2000-01-01T07:30:00Z'), endTime: new Date('2000-01-01T08:10:00Z') }],
    subjectId: 1, now: new Date('2026-11-13T12:35:00Z'), timezone: 'America/New_York',
  });
  assert.equal(status.allowed, true);
  assert.equal(status.closesAt, '2026-11-13T13:40:00.000Z');
  assert.match(status.reason, /08:40/);
  const close = Date.parse(status.closesAt);
  assert.equal(shared.currentCAEntryWindow(status, close).allowed, true);
  assert.equal(shared.currentCAEntryWindow(status, close + 1).allowed, false);
  assert.equal(status.allowed, true, 'never mutate server props');
});
test('expired page status closes without clearing drafts or granting a later lesson automatically', () => {
  const status = { allowed: true, label: 'English', reason: null, closesAt: '2026-11-13T08:40:00Z' };
  const result = shared.currentCAEntryWindow(status, Date.parse('2026-11-13T09:00:00Z'));
  assert.equal(result.allowed, false); assert.match(result.reason, /unsaved marks remain/);
  assert.equal(shared.currentCAEntryWindow({ ...status, allowed: false }, 0).allowed, false);
});
test('live subscription updates after idle time, focus and mobile tab resume, and cleans up', () => {
  const oldWindow = globalThis.window, oldDocument = globalThis.document;
  const callbacks = {}, removed = [];
  globalThis.window = { setInterval: (fn) => { callbacks.tick = fn; return 7; }, clearInterval: (id) => removed.push(id), addEventListener: (name, fn) => { callbacks[name] = fn; }, removeEventListener: (name) => removed.push(name) };
  globalThis.document = { addEventListener: (name, fn) => { callbacks[name] = fn; }, removeEventListener: (name) => removed.push(name) };
  let notifyCount = 0, getSnapshot, cleanup;
  const originalNow = Date.now;
  try {
    const { useCAEntryWindow } = load('src/components/useCAEntryWindow.ts', {
      '@/src/lib/ca-entry-window-status': shared,
      react: { useSyncExternalStore: (subscribe, snapshot) => { getSnapshot = snapshot; cleanup = subscribe(() => notifyCount++); return snapshot(); } },
    });
    const close = Date.parse('2026-11-13T08:40:00Z');
    Date.now = () => close - 1;
    assert.equal(useCAEntryWindow({ allowed: true, label: 'English', reason: null, closesAt: new Date(close).toISOString() }).allowed, true);
    Date.now = () => close + 1;
    callbacks.tick(); callbacks.focus(); callbacks.visibilitychange();
    assert.equal(getSnapshot(), false); assert.equal(notifyCount, 3);
    cleanup(); assert.deepEqual(removed, [7, 'focus', 'visibilitychange']);
  } finally { Date.now = originalNow; globalThis.window = oldWindow; globalThis.document = oldDocument; }
});
