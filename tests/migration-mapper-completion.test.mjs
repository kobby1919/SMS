import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";

const source = readFileSync("src/components/DataMigrationMapper.tsx", "utf8");
const ast = ts.createSourceFile("DataMigrationMapper.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
function findFunction(name) {
  let found;
  function visit(node) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) found = node;
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.ok(found, name);
  return found;
}

test("completed, busy, empty and unmapped uploads cannot trigger validation or erase results", async () => {
  const compiled = ts.transpileModule(findFunction("validateRows").getText(ast), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText;
  const compiledAst = ts.createSourceFile("handler.js", compiled, ts.ScriptTarget.Latest, true);
  const body = compiledAst.statements[0].body.getText(compiledAst).slice(1, -1);
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  const handler = new AsyncFunction("readyForValidation", "busy", "importResult", "allRows",
    "setError", "setValidation", "setImportResult", "setIsValidating", "fetch", body);
  const unexpected = () => assert.fail("Blocked validation must not mutate state or send a request");
  for (const [ready, busy, completed, rows] of [
    [true, false, { importedRows: 2 }, [["class"]]],
    [true, true, null, [["class"]]],
    [true, false, null, []],
    [false, false, null, [["class"]]],
  ]) await handler(ready, busy, completed, rows, unexpected, unexpected, unexpected, unexpected, unexpected);
});

test("completion disables the validation button and deliberate input changes clear completion", () => {
  assert.match(source, /disabled=\{!readyForValidation \|\| busy \|\| !!importResult \|\| allRows.length === 0\}/);
  assert.match(source, /importResult \? "Import completed" : "Validate and save upload"/);
  for (const name of ["resetForArea", "handleFile", "updateMapping", "resumeUpload"]) {
    assert.match(findFunction(name).body.getText(ast), /setImportResult\(null\)/, name);
  }
});
