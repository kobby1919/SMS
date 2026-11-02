import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
import { renderToStaticMarkup } from "react-dom/server";

const require = createRequire(import.meta.url);
const message = "Coverage updates are only allowed during school hours (07:30-15:00, Africa/Accra).";

function fixture({ covered = false, failure = false, unexpected = false } = {}) {
  const state = [];
  let cursor = 0, pending, refreshes = 0;
  const calls = [];
  const action = (name) => async (...args) => {
    calls.push([name, ...args]);
    if (unexpected) throw new Error("Minified React error #441; private detail");
    return failure ? { success: false, error: message } : { success: true };
  };
  const mocks = {
    react: {
      useState: (initial) => {
        const index = cursor++;
        if (!(index in state)) state[index] = initial;
        return [state[index], (value) => { state[index] = typeof value === "function" ? value(state[index]) : value; }];
      },
      useTransition: () => [false, (work) => { pending = work(); }],
    },
    "next/navigation": { useRouter: () => ({ refresh: () => { refreshes++; } }) },
    "@/src/lib/actions/syllabusActions": { markTopicCovered: action("mark"), unmarkTopicCovered: action("unmark") },
  };
  const module = { exports: {} };
  const code = ts.transpileModule(readFileSync("src/components/SyllabusProgressCard.tsx", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  new Function("require", "module", "exports", code)((id) => mocks[id] ?? require(id), module, module.exports);
  const render = () => {
    cursor = 0;
    return module.exports.default({ topicId: 1, topicTitle: "Greetings", teacherClasses: [{ id: 1, name: "Primary 1A" }], coveredClassIds: covered ? [1] : [], existingProgress: [] });
  };
  const find = (node, predicate) => {
    if (!node || typeof node !== "object") return null;
    if (predicate(node)) return node;
    for (const child of [node.props?.children].flat(Infinity)) {
      const found = find(child, predicate);
      if (found) return found;
    }
    return null;
  };
  return { state, calls, render, find, complete: () => pending, get refreshes() { return refreshes; } };
}

for (const covered of [false, true]) {
  test(`blocked ${covered ? "unmarking" : "marking"} displays the safe restriction without changing coverage`, async () => {
    const f = fixture({ covered, failure: true });
    f.find(f.render(), (node) => node.type === "button" && node.props.className.includes("flex-1")).props.onClick();
    await f.complete();
    assert.deepEqual(f.state[0], covered ? [1] : []);
    assert.equal(f.refreshes, 0);
    const html = renderToStaticMarkup(f.render());
    assert.ok(html.includes(message));
    assert.match(html, /role="alert"/);
    assert.doesNotMatch(html, /marked as covered|marked as not covered|Minified React/);
  });
}

test("blocked note saving leaves the note editor open and does not claim success", async () => {
  const f = fixture({ covered: true, failure: true });
  f.find(f.render(), (node) => node.props?.title === "Add note").props.onClick();
  f.find(f.render(), (node) => node.type === "button" && node.props.children === "Save").props.onClick();
  await f.complete();
  assert.equal(f.state[2][1], true);
  assert.equal(f.refreshes, 0);
  assert.equal(f.state[4], null);
  assert.ok(renderToStaticMarkup(f.render()).includes(message));
});

test("unexpected production errors display a neutral message, not raw React details", async () => {
  const f = fixture({ unexpected: true });
  f.find(f.render(), (node) => node.type === "button" && node.props.className.includes("flex-1")).props.onClick();
  await f.complete();
  assert.match(renderToStaticMarkup(f.render()), /Coverage could not be updated/);
  assert.doesNotMatch(renderToStaticMarkup(f.render()), /private detail|#441/);
  assert.equal(f.refreshes, 0);
});

test("successful marking updates coverage and refreshes the page", async () => {
  const f = fixture();
  f.find(f.render(), (node) => node.type === "button" && node.props.className.includes("flex-1")).props.onClick();
  await f.complete();
  assert.deepEqual(f.state[0], [1]);
  assert.equal(f.refreshes, 1);
  assert.match(renderToStaticMarkup(f.render()), /marked as covered/);
});
