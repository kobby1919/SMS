import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import ts from "typescript";
import postcss from "postcss";
import tailwindcss from "tailwindcss";

const require = createRequire(import.meta.url);
const { webpack } = require("next/dist/compiled/webpack/webpack");
const { chromium } = require(process.env.EDUJAY_PLAYWRIGHT_PATH ?? "C:/Users/KWABENA JUNIOR/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");
const output = path.resolve("tmp/navbar-responsive");
mkdirSync(output, { recursive: true });
const source = readFileSync("src/components/NavbarClient.tsx", "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
const configExports = {};
new Function("exports", ts.transpileModule(readFileSync("tailwind.config.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText)(configExports);
const css = (await postcss([tailwindcss({ ...configExports.default, content: [{ raw: source + ' h-dvh w-14 md:w-56 lg:w-60 xl:w-64 flex flex-1 min-w-0 overflow-y-auto bg-gray-50', extension: "tsx" }] })]).process(readFileSync("src/app/globals.css", "utf8"), { from: undefined })).css;
const entry = path.join(output, "entry.cjs");
writeFileSync(entry, `
const React = require('react');
const { createRoot } = require('react-dom/client');
const icons = require('lucide-react');
const dom = require('react-dom');
const jsx = require('react/jsx-runtime');
const mocks = {
  react: React, 'react-dom': dom, 'react/jsx-runtime': jsx, 'lucide-react': icons,
  'next/link': {__esModule:true,default:({href,onClick,children,...props})=>React.createElement('a',{...props,href,onClick:event=>{event.preventDefault();onClick?.(event);window.lastNavigation=href;}},children)},
  'next/navigation': {usePathname:()=>'/'+window.fixtureRole,useRouter:()=>({push:href=>{window.lastNavigation=href;},refresh(){}})},
  'framer-motion': {motion:{header:({initial,animate,transition,suppressHydrationWarning,...props})=>React.createElement('header',{...props,style:{transform:'translateY(0)'}})}},
  './UserButtonWrapper': {__esModule:true,default:()=>React.createElement('button',{'aria-label':'Account menu',style:{width:32,height:32,borderRadius:'50%',background:'#334155',color:'white'},onClick:()=>{window.accountClicked=true;}},'QA')},
  '@/src/lib/actions/appNotificationActions': {markAppNotificationRead:async id=>{window.readNotification=id;},markAppNotificationsRead:async()=>{window.readAll=true;}}
};
const loaded={exports:{}};
new Function('require','exports',${JSON.stringify(compiled)})(id=>{if(!(id in mocks))throw Error(id);return mocks[id];},loaded.exports);
const role=window.fixtureRole;
createRoot(document.getElementById('root')).render(React.createElement('div',{className:'flex h-dvh'},
 React.createElement('aside',{className:'w-14 md:w-56 lg:w-60 xl:w-64',style:{flexShrink:0}},'E'),
 React.createElement('main',{className:'min-w-0 flex-1 overflow-y-auto'},React.createElement(loaded.exports.default,{
 user:{role,fullName:'Samuel Kwabena Assan With A Very Long Display Name',schoolName:'Edujay Internal Quality Assurance International School'},
 parentContext:{children:[{id:'ward-one',name:'Long Guardian Ward Name For Responsive Testing',className:'QA Primary 1A'}]},
 appNotificationUnreadCount:105,appNotifications:[{id:'n1',type:'SYSTEM',category:'ACADEMIC',priority:'HIGH',title:'A long notification title for the active school',description:'Please review the relevant school record and continue the test.',href:'/teacher/accountability',createdAt:'2026-10-28T12:00:00Z',readAt:null}]
 }),React.createElement('div',{style:{height:1600,padding:16}},
 React.createElement('h1',{id:'fixture-heading'},'School overview'),
 React.createElement('p',{id:'fixture-body'},'Review school records and the current academic period.'),
 React.createElement('label',null,'Test field',React.createElement('input',{'aria-label':'Test field'})),
 React.createElement('table',{id:'fixture-table'},React.createElement('tbody',null,React.createElement('tr',null,React.createElement('td',null,'GHS 3,470.00'))))
 ))));
`);
await new Promise((resolve, reject) => {
  const compiler = webpack({ mode: "development", context: process.cwd(), entry, output: { path: output, filename: "bundle.js" }, devtool: false, optimization: { minimize: false } });
  compiler.run((error, stats) => compiler.close(() => error || stats.hasErrors() ? reject(error ?? Error(stats.toString({ all: false, errors: true }))) : resolve()));
});
const bundle = readFileSync(path.join(output, "bundle.js"), "utf8");
const browser = await chromium.launch({ headless: true, channel: "msedge" });
let checked = 0;
try {
  for (const role of ["admin", "teacher", "parent", "bursar", "platform_admin"]) {
    for (const width of [320, 390, 640, 768, 1024, 1280, 1440]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.route("http://typography.test/fonts/**", async (route) => {
        const requested = new URL(route.request().url()).pathname;
        assert.match(requested, /^\/fonts\/(inter|clash-display)\/[a-z0-9.-]+$/);
        await route.fulfill({ body: readFileSync(path.join("public", requested)), contentType: requested.endsWith("woff2") ? "font/woff2" : "font/ttf" });
      });
      await page.setContent(`<html><head><base href="http://typography.test/"><style>${css}</style></head><body><div id="root"></div><script>window.fixtureRole=${JSON.stringify(role)}</script></body></html>`);
      await page.addScriptTag({ content: bundle });
      await page.getByRole("button", { name: "Account menu", exact: true }).waitFor();
      await page.evaluate(() => document.fonts.ready);
      assert.ok((await page.locator("#fixture-heading").evaluate((el) => getComputedStyle(el).fontFamily)).includes("Clash Display"));
      for (const selector of ["#fixture-body", "#fixture-table", 'input[aria-label="Test field"]']) assert.ok((await page.locator(selector).evaluate((el) => getComputedStyle(el).fontFamily)).includes("Inter"));
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${role}/${width} page overflow`);
      for (const name of ["Account menu", "Open notifications"]) {
        const box = await page.getByRole("button", { name, exact: true }).boundingBox();
        assert.ok(box && box.x >= 0 && box.x + box.width <= width + 1, `${role}/${width}/${name} clipped`);
      }
      await page.getByRole("button", { name: "Account menu", exact: true }).click();
      assert.equal(await page.evaluate(() => window.accountClicked), true);
      if (role !== "platform_admin" && width < 1280) {
        await page.getByRole("button", { name: "Open search", exact: true }).click();
        const dialog = page.getByRole("dialog", { name: "Search Edujay", exact: true });
        await dialog.waitFor();
        const bounds = await dialog.boundingBox();
        assert.ok(bounds.x <= 1 && bounds.width >= width - 1 && bounds.height >= 899, `${role}/${width} search not full viewport`);
        assert.equal(await dialog.getByRole("textbox", { name: "Search Edujay" }).evaluate((el) => document.activeElement === el), true);
        await dialog.getByRole("textbox", { name: "Search Edujay" }).fill(role === "admin" || role === "teacher" ? "attendance" : "fees");
        assert.ok(await dialog.getByRole("link").count() > 0);
        await page.keyboard.press("Escape");
        await dialog.waitFor({ state: "hidden" });
        assert.equal(await page.getByRole("button", { name: "Open search", exact: true }).evaluate((el) => document.activeElement === el), true);
        await page.getByRole("button", { name: "Open search", exact: true }).click();
        await dialog.getByRole("textbox", { name: "Search Edujay" }).fill("home");
        const destination = await dialog.getByRole("link").first().getAttribute("href");
        await dialog.getByRole("link").first().click();
        await dialog.waitFor({ state: "hidden" });
        assert.equal(await page.evaluate(() => window.lastNavigation), destination);
      }
      await page.getByRole("button", { name: "Open notifications", exact: true }).click();
      const panel = page.getByRole("dialog", { name: "Notifications", exact: true });
      await panel.waitFor();
      await page.waitForTimeout(50);
      const bounds = await panel.boundingBox();
      assert.ok(bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= width + 1 && bounds.y + bounds.height <= 901, `${role}/${width} notification clipped`);
      await page.screenshot({ path: path.join(output, `${role}-${width}.png`), fullPage: false });
      await panel.getByRole("button", { name: "Mark all read", exact: true }).click();
      await page.waitForFunction(() => window.readAll === true);
      assert.ok(await panel.isVisible(), "Portal click unexpectedly dismissed the notification panel");
      await page.keyboard.press("Escape");
      await panel.waitFor({ state: "hidden" });
      assert.equal(errors.length, 0, errors.join("\n"));
      checked++;
      await page.close();
    }
  }
  console.log(`${checked} interactive role/viewport checks passed: layout, full-screen search, focus restoration, notifications and account trigger. Clerk's real account popup is mocked.`);
} finally { await browser.close(); }
