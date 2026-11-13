import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
import { renderToStaticMarkup } from 'react-dom/server';
const require = createRequire(import.meta.url);
function load(path, mocks, stubAliases = false) {
  const m = { exports: {} };
  const code = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  new Function('require', 'module', 'exports', code)((id) => mocks[id] ?? (stubAliases && id.startsWith('@/') ? new Proxy({}, { get: () => () => {} }) : require(id)), m, m.exports);
  return m.exports;
}
function fixture() {
  const state = [], refs = [];
  let cursor = 0, refCursor = 0, refreshes = 0, calls = 0, settle, reject;
  const request = new Promise((resolve, fail) => { settle = resolve; reject = fail; });
  const mocks = {
    react: {
      useState: (initial) => { const i = cursor++; if (!(i in state)) state[i] = initial; return [state[i], (next) => { state[i] = typeof next === 'function' ? next(state[i]) : next; }]; },
      useRef: (value) => { const i = refCursor++; return refs[i] ??= { current: value }; },
      useMemo: (fn) => fn(), useEffect: () => {}, useTransition: () => [false, (work) => work()],
    },
    'next/navigation': { useRouter: () => ({ refresh: () => { refreshes++; } }) },
    '@/src/components/useCAEntryWindow': { useCAEntryWindow: (status) => status },
    '@/src/lib/ca-entry-window-status': load('src/lib/ca-entry-window-status.ts', {}),
    '@/src/generated/prisma': {},
    '@/src/lib/caGrades': { TERM_LABELS: {} },
    '@/src/lib/academic-readiness-rules': { activityEligibility: () => 'ELIGIBLE' },
    '@/src/lib/actions/caActions': { bulkUpsertCAActivityScores: () => { calls++; return request; } },
  };
  const Component = load('src/components/CAActivityManager.tsx', mocks).default;
  const props = { classId: 1, className: 'Primary 1', activeTerm: 'TERM_1', activeYear: '2026/27', subjects: [{ id: 1, name: 'English' }], students: [{ id: 's', name: 'Test', surname: 'Student' }], scoreEntryWindowsBySubjectId: { 1: { allowed: true, label: 'lesson' } }, buckets: [{ id: 1, subjectId: 1, term: 'TERM_1', academicYear: '2026/27', type: 'CLASS_EXERCISE', allocationMarks: 10, aggregationMode: 'AVERAGE_TO_BUCKET', activities: [{ id: 1, title: 'Exercise 1', rawMaxScore: 10, scores: [], activityDate: new Date() }] }] };
  const render = () => { cursor = 0; refCursor = 0; return Component(props); };
  const find = (node, predicate) => {
    if (!node || typeof node !== 'object') return null;
    if (predicate(node)) return node;
    for (const child of [node.props?.children].flat(Infinity)) { const result = find(child, predicate); if (result) return result; }
    return null;
  };
  const button = () => find(render(), (n) => n.type === 'button' && 'aria-busy' in n.props);
  find(render(), (n) => n.type === 'input' && n.props.max === 10 && n.props.min === 0).props.onChange({ target: { value: '0' } });
  return { render, find, button, settle, reject, get calls() { return calls; }, get refreshes() { return refreshes; } };
}
test('rapid repeated click sends one request and disables editing until it settles', async () => {
  const f = fixture(); const click = f.button().props.onClick;
  const first = click(); await click();
  assert.equal(f.calls, 1);
  assert.equal(f.button().props.disabled, true);
  const input = f.find(f.render(), (n) => n.type === 'input' && n.props.max === 10 && n.props.min === 0);
  assert.equal(input.props.disabled, true);
  assert.match(renderToStaticMarkup(f.render()), /Saving scores and preparing/);
  f.settle({ success: true, count: 1, changedCount: 1, eventCount: 1 }); await first;
  assert.equal(f.button().props.disabled, true);
  assert.match(renderToStaticMarkup(f.render()), /Scores Locked/);
  assert.equal(f.refreshes, 1);
});
test('expected rejection stops saving and keeps entered scores without claiming success', async () => {
  const f = fixture(); const pending = f.button().props.onClick();
  f.settle({ success: false, error: 'Publish scores for all eligible students.' }); await pending;
  const html = renderToStaticMarkup(f.render());
  assert.match(html, /Publish scores for all eligible students/);
  assert.doesNotMatch(html, /Saving scores and preparing|saved successfully/);
  assert.equal(f.button().props.disabled, false); assert.equal(f.refreshes, 0);
  assert.match(html, /value="0"/);
});
test('unknown production error is not exposed and does not leave a saving message', async () => {
  const f = fixture(); const pending = f.button().props.onClick();
  f.reject(new Error('Minified React error #441 private detail')); await pending;
  const html = renderToStaticMarkup(f.render());
  assert.match(html, /save could not be confirmed/);
  assert.doesNotMatch(html, /#441|private detail|Saving scores and preparing/);
  assert.equal(f.button().props.disabled, false);
});
test('post-save warning preserves saved lock rather than offering another save', async () => {
  const f = fixture(); const pending = f.button().props.onClick();
  f.settle({ success: true, count: 1, changedCount: 1, eventCount: 0, warning: 'Scores are saved; parent updates need review.' }); await pending;
  assert.equal(f.button().props.disabled, true);
  assert.match(renderToStaticMarkup(f.render()), /parent updates need review/);
});
test('unchanged confirmed scores still lock the activity', async () => {
  const f = fixture(); const pending = f.button().props.onClick();
  f.settle({ success: true, count: 1, changedCount: 0, eventCount: 0 }); await pending;
  assert.equal(f.button().props.disabled, true);
  assert.match(renderToStaticMarkup(f.render()), /Scores confirmed and activity locked/);
});

function actionFixture({ recordingError, parentError, locked = false } = {}) {
  class CAScoreEntryError extends Error {}
  let writes = 0;
  const mocks = {
    '@/src/lib/ca-score-error': { CAScoreEntryError },
    '@/src/lib/authz': { requireRole: async () => ({ userId: 't', role: 'teacher', schoolId: 'a' }) },
    '@/src/lib/validation/parse': { parseActionInput: (_, input) => input },
    '@/src/lib/prisma': { default: {
      cAActivity: { findFirst: async () => ({ classId: 1, subjectId: 1, rawMaxScore: 10, isLocked: locked, bucket: { term: 'TERM_1', academicYear: '2026/27' }, class: { students: [{ id: 's' }] } }) },
      reportCardPublication: { findUnique: async () => null },
    } },
    '@/src/lib/services/academic-period': { requireActiveAcademicConfig: async () => ({ currentTerm: 'TERM_1', academicYear: '2026/27' }) },
    '@/src/lib/academic-readiness-rules': { activityEligibility: () => 'ELIGIBLE' },
    '@/src/lib/services/ca-score-recording': { recordCAActivityScores: async () => { if (recordingError) throw new CAScoreEntryError(recordingError); writes++; return [{ changed: true, score: { id: 1 } }]; } },
    '@/src/lib/services/parent-daily-summary': { recordCAActivityScoreEvents: async () => { if (parentError) throw new Error('private provider error'); return [{}]; } },
    'next/cache': { revalidatePath: () => {} },
  };
  const api = load('src/lib/actions/caActions.ts', mocks, true);
  return { run: () => api.bulkUpsertCAActivityScores({ activityId: 1, rows: [{ studentId: 's', rawScore: 0 }] }), get writes() { return writes; } };
}
test('server action returns expected recording restrictions as readable data', async () => {
  const f = actionFixture({ recordingError: 'CA entry is outside the lesson window.' });
  assert.deepEqual(await f.run(), { success: false, error: 'CA entry is outside the lesson window.' });
  assert.equal(f.writes, 0);
});
test('a saved and locked activity is not submitted to the recorder again', async () => {
  const f = actionFixture({ locked: true }); const result = await f.run();
  assert.equal(result.success, false); assert.match(result.error, /locked/); assert.equal(f.writes, 0);
});
test('parent preparation failure after commit returns saved status and safe warning', async () => {
  const f = actionFixture({ parentError: true }); const result = await f.run();
  assert.equal(f.writes, 1); assert.equal(result.success, true); assert.equal(result.changedCount, 1);
  assert.match(result.warning, /Scores are saved and locked/);
  assert.doesNotMatch(result.warning, /private provider/);
});
