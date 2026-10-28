import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import ts from "typescript";

const list = (args) => execFileSync("git", args, { encoding: "utf8" }).split("\0").filter(Boolean);
const dirty = new Set(list(["diff", "--name-only", "-z"]));
const files = list(["ls-files", "-z", "src/components", "src/app"])
  .filter((name) => /\.tsx?$/.test(name) && !name.startsWith("src/app/api/") && !dirty.has(name));
const changed = [];
for (const name of files) {
  const original = readFileSync(name, "utf8");
  const file = ts.createSourceFile(name, original, ts.ScriptTarget.Latest, true, name.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const edits = new Map();
  const replace = (node, value) => edits.set(`${node.getStart(file)}:${node.end}`, { start: node.getStart(file), end: node.end, value });
  function heading(node) {
    for (let current = node.parent; current; current = current.parent) {
      if (ts.isJsxOpeningElement(current) || ts.isJsxSelfClosingElement(current)) return /^h[1-6]$/.test(current.tagName.getText(file));
    }
    return false;
  }
  function visit(node) {
    if (ts.isStringLiteral(node) && node.text.includes("font-nunito")) {
      replace(node, JSON.stringify(node.text.replaceAll("font-nunito", heading(node) ? "font-clashDisplay" : "font-inter")));
    }
    if (ts.isPropertyAssignment(node) && node.name.getText(file) === "fontFamily" && ts.isStringLiteral(node.initializer)) {
      const value = node.initializer.text;
      if (/DM Sans|Sora|Nunito|Inter|Clash Display/.test(value)) {
        replace(node.initializer, JSON.stringify(heading(node) || /Clash Display/.test(value) ? "var(--font-heading)" : "var(--font-body)"));
      }
    }
    if (heading(node) && ts.isPropertyAssignment(node)) {
      const key = node.name.getText(file);
      if (key === "fontWeight" && /^(800|900|"800"|"900")$/.test(node.initializer.getText(file))) replace(node.initializer, "700");
      if (key === "letterSpacing" && /^['"]-/.test(node.initializer.getText(file))) replace(node.initializer, "0");
    }
    ts.forEachChild(node, visit);
  }
  visit(file);
  let source = original;
  for (const edit of [...edits.values()].sort((a, b) => b.start - a.start)) source = source.slice(0, edit.start) + edit.value + source.slice(edit.end);
  source = source.replace(/font-family:\s*['"](?:DM Sans|Sora|Nunito)['"],\s*(?:var\(--font-inter\),\s*)?sans-serif/g, "font-family: var(--font-body)");
  if (source !== original) { writeFileSync(name, source); changed.push(name); }
}
mkdirSync("tmp/typography", { recursive: true });
writeFileSync("tmp/typography/changed-files.json", JSON.stringify(changed, null, 2) + "\n");
console.log(JSON.stringify({ changedFiles: changed.length, skippedPreviouslyDirtyFiles: [...dirty], files: changed }, null, 2));
