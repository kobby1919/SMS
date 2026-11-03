import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";

const require = createRequire(import.meta.url);
function fixture(props = {}, forwardedRef) {
  const hooks = [];
  let cursor = 0, effect, lastVisible, focusCalls = 0, changes = 0;
  const input = {
    selectionStart: 2, selectionEnd: 5, selectionDirection: "backward",
    focus: () => { focusCalls++; },
    setSelectionRange: (start, end, direction) => { input.selectionStart = start; input.selectionEnd = end; input.selectionDirection = direction; },
  };
  const document = { activeElement: input };
  const react = {
    forwardRef: (render) => render,
    useId: () => "test-password",
    useCallback: (work) => work,
    useRef: (initial) => { const index = cursor++; hooks[index] ??= { current: initial }; return hooks[index]; },
    useState: (initial) => {
      const index = cursor++;
      if (!(index in hooks)) hooks[index] = initial;
      return [hooks[index], (value) => { hooks[index] = typeof value === "function" ? value(hooks[index]) : value; }];
    },
    useLayoutEffect: (work, [visible]) => { if (lastVisible !== visible) { effect = work; lastVisible = visible; } },
  };
  const loaded = { exports: {} };
  const code = ts.transpileModule(readFileSync("src/components/auth/PasswordInput.tsx", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  new Function("require", "module", "exports", "document", code)((id) => id === "react" ? react : require(id), loaded, loaded.exports, document);
  function render() {
    cursor = 0;
    const tree = loaded.exports.default({ value: "Example-password", onChange: () => { changes++; }, ...props }, forwardedRef);
    const [field, button] = tree.props.children;
    field.props.ref(input);
    if (effect) { const work = effect; effect = null; work(); }
    return { field, button };
  }
  return { render, input, document, get focusCalls() { return focusCalls; }, get changes() { return changes; } };
}

test("passwords start hidden with an accessible non-submit eye button", () => {
  const { field, button } = fixture({ required: true, autoComplete: "current-password", name: "password" }).render();
  assert.equal(field.props.type, "password");
  assert.equal(field.props.required, true);
  assert.equal(field.props.autoComplete, "current-password");
  assert.equal(field.props.name, "password");
  assert.equal(button.props.type, "button");
  assert.equal(button.props["aria-label"], "Show password");
  assert.equal(button.props.title, "Show password");
  assert.equal(button.props["aria-controls"], field.props.id);
  assert.equal(button.props["aria-pressed"], false);
  assert.equal(field.props.style.paddingInlineEnd, "3.5rem");
  assert.match(button.props.className, /h-11 w-11/);
});

test("toggling preserves the password, selection, focus and validation handlers", () => {
  const f = fixture();
  f.render().button.props.onClick();
  let next = f.render();
  assert.equal(next.field.props.type, "text");
  assert.equal(next.field.props.value, "Example-password");
  assert.equal(next.button.props["aria-label"], "Hide password");
  assert.equal(next.button.props["aria-pressed"], true);
  assert.deepEqual([f.input.selectionStart, f.input.selectionEnd, f.input.selectionDirection], [2, 5, "backward"]);
  assert.equal(f.focusCalls, 1);
  assert.equal(f.changes, 0);
  next.button.props.onClick();
  next = f.render();
  assert.equal(next.field.props.type, "password");
  assert.equal(f.changes, 0);
});

test("confirmation fields are independent and keyboard toggles do not steal focus", () => {
  const password = fixture(), confirmation = fixture();
  password.document.activeElement = {};
  password.render().button.props.onClick();
  assert.equal(password.render().field.props.type, "text");
  assert.equal(confirmation.render().field.props.type, "password");
  assert.equal(password.focusCalls, 0);
});

test("disabled controls stay hidden and forward refs for registered form inputs", () => {
  const ref = { current: null };
  const f = fixture({ disabled: true, autoComplete: "new-password" }, ref);
  let tree = f.render();
  assert.equal(ref.current, f.input);
  assert.equal(tree.field.props.disabled, true);
  assert.equal(tree.button.props.disabled, true);
  tree.button.props.onClick();
  tree = f.render();
  assert.equal(tree.field.props.type, "password");
  let prevented = false;
  tree.button.props.onPointerDown({ preventDefault: () => { prevented = true; } });
  assert.equal(prevented, true);
});

test("all account forms use the shared control without changing autocomplete intent", () => {
  for (const [path, count] of [["src/components/auth/CustomSignInForm.tsx", 3], ["src/components/auth/CustomSignUpForm.tsx", 2]]) {
    const source = readFileSync(path, "utf8");
    assert.equal((source.match(/<PasswordInput/g) ?? []).length, count);
    assert.doesNotMatch(source, /type="password"/);
    assert.match(source, /autoComplete="new-password"/);
  }
  assert.match(readFileSync("src/components/auth/CustomSignInForm.tsx", "utf8"), /autoComplete="current-password"/);
  assert.match(readFileSync("src/components/InputField.tsx", "utf8"), /type === "password" \? <PasswordInput/);
});
