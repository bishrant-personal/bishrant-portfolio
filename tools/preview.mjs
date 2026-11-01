// Opens the LIVE site in a browser, but serves this repo's local files in place of
// the jsDelivr copies. Nothing in Webflow changes; only this browser window sees
// your edits. Reload the window after saving a file.
//
//   npm run preview               -> bishrant.com/
//   npm run preview -- /about     -> bishrant.com/about
//   npm run smoke                 -> every page Webflow loads repo files on, headless,
//                                    reports errors and which local files ran
import { chromium } from "playwright";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { ROOT, MAP } from "./lib.mjs";

const smoke = process.argv.includes("--smoke");
const SITE = "https://www.bishrant.com";
// Any version, old or new owner name: the code under test is always the local copy.
const CDN = /^https:\/\/cdn\.jsdelivr\.net\/gh\/[^/]+\/bishrant-portfolio@[^/]+\/(.+?)(\?.*)?$/;
const TYPES = { js: "text/javascript", json: "application/json", css: "text/css" };

const browser = await chromium.launch({ headless: smoke });
const context = await browser.newContext({ viewport: smoke ? { width: 1440, height: 900 } : null, bypassCSP: true });
let served = new Set();
await context.route(CDN, async (route) => {
  const file = route.request().url().match(CDN)[1];
  const local = join(ROOT, file);
  if (!existsSync(local)) return route.continue();
  served.add(file);
  if (!smoke) console.log("local  " + file);
  await route.fulfill({
    status: 200,
    headers: { "content-type": TYPES[file.split(".").pop()] || "application/octet-stream", "access-control-allow-origin": "*", "cache-control": "no-store" },
    body: readFileSync(local),
  });
});

if (!smoke) {
  const page = await context.newPage();
  page.on("pageerror", (e) => console.log("ERROR  " + e.message));
  page.on("console", (m) => m.type() === "error" && console.log("console error  " + m.text()));
  const url = new URL(process.argv[2] || "/", SITE).href;
  await page.goto(url);
  console.log(`\nPreviewing ${url} with local files. Close the window to stop.`);
  browser.on("disconnected", () => process.exit(0));
} else {
  const paths = [...new Set(MAP.blocks.map((b) => b.path))];
  let bad = 0;
  for (const p of paths) {
    served = new Set();
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(SITE + p, { waitUntil: "load" });
    await page.mouse.wheel(0, 1500);
    await page.waitForTimeout(4000);
    const expected = new Set(MAP.blocks.filter((b) => b.path === p || b.pageId === null).flatMap((b) => b.files));
    const notLocal = [...expected].filter((f) => !served.has(f));
    if (errors.length || notLocal.length) bad++;
    console.log(`${errors.length || notLocal.length ? "x" : "ok"}  ${p}  (${served.size} local files)`);
    for (const e of errors) console.log("     error: " + e);
    for (const f of notLocal) console.log("     not served locally: " + f);
    await page.close();
  }
  await browser.close();
  console.log(bad ? `\n${bad} page(s) with problems.` : "\nEvery page ran the local files with no errors.");
  process.exit(bad ? 1 : 0);
}
