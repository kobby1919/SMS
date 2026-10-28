import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
import React from "react";

const require = createRequire(import.meta.url);
function load(query = "") {
  const compiled = { exports: {} };
  const source = readFileSync("src/components/NavbarClient.tsx", "utf8") + "\nexport const testOnly = { roleShortcuts, parentSearchItems, SearchBox, NavbarClient };";
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const mocks = {
    react: { ...React, useState: (value) => [value === "" ? query : value, () => {}], useMemo: (fn) => fn(), useRef: () => ({ current: null }), useEffect: () => {} },
    "next/link": { __esModule: true, default: "a" },
    "next/navigation": { usePathname: () => "/platform/onboarding" },
    "framer-motion": { motion: { header: "header" } },
    "./UserButtonWrapper": {},
    "@/src/lib/actions/appNotificationActions": {},
  };
  new Function("require", "module", "exports", js)((id) => Object.hasOwn(mocks, id) ? mocks[id] : require(id), compiled, compiled.exports);
  return compiled.exports.testOnly;
}
function links(node) {
  if (Array.isArray(node)) return node.flatMap(links);
  if (!React.isValidElement(node)) return [];
  return [...(node.type === "a" ? [node] : []), ...links(node.props.children)];
}

function elements(node) {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!React.isValidElement(node)) return [];
  return [node, ...elements(node.props.children)];
}

test("platform admin has no desktop search or mobile search trigger; school roles retain both", () => {
  const { NavbarClient, SearchBox } = load();
  for (const role of ["platform_admin", "admin", "teacher", "parent", "bursar", "student"]) {
    const nodes = elements(NavbarClient({ user: { role, fullName: "Test User", schoolName: "Edujay" } }));
    assert.equal(nodes.filter((node) => node.type === SearchBox).length, role === "platform_admin" ? 0 : 1);
    assert.equal(nodes.filter((node) => node.props["aria-label"] === "Open search").length, role === "platform_admin" ? 0 : 1);
    assert.ok(nodes.some((node) => node.props.className?.includes("min-w-0 flex-1 xl:max-w-56")));
    if (role === "platform_admin") assert.ok(!nodes.some((node) => node.props.className?.includes("min-w-[16rem]")));
  }
});

test("every role has one shortcut per destination and unique rendered search keys", () => {
  const { roleShortcuts, SearchBox } = load();
  for (const [role, items] of Object.entries(roleShortcuts)) {
    assert.equal(new Set(items.map((item) => item.href)).size, items.length, `${role} has a duplicate shortcut`);
    const rendered = links(SearchBox({ items, mobile: true }));
    assert.equal(new Set(rendered.map((item) => item.key)).size, rendered.length);
  }
});

test("admin bill searches return one result while preserving both original keyword sets", () => {
  for (const query of ["bill", "money", "outstanding", "student fee status"]) {
    const { roleShortcuts, SearchBox } = load(query);
    const rendered = links(SearchBox({ items: roleShortcuts.admin, mobile: true }));
    assert.equal(rendered.filter((item) => item.props.href === "/list/finance/bills").length, 1);
  }
});

test("distinct parent notifications with identical title and destination retain stable unique identities", () => {
  const { parentSearchItems, SearchBox } = load("weekly summary");
  const notifications = ["first", "second"].map((id) => ({ id, title: "Weekly summary", href: "/parent/updates", category: "ACADEMIC", description: "Summary ready" }));
  const render = (rows) => links(SearchBox({ items: parentSearchItems([], rows), mobile: true }));
  assert.deepEqual(render(notifications).map((item) => item.key), ["notification:first", "notification:second"]);
  assert.deepEqual(render([...notifications].reverse()).map((item) => item.key), ["notification:second", "notification:first"]);
});
