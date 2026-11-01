// Safety check before a release: every file Webflow loads exists, every relative
// import resolves, every site file parses. Exit 1 on any problem.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "acorn";
import { ROOT, entryFiles, reachableFiles, siteJsFiles } from "./lib.mjs";

let bad = 0;
const fail = (msg) => { bad++; console.log("  x " + msg); };

console.log("Files Webflow loads:");
const { files, missing } = reachableFiles();
for (const f of entryFiles()) console.log("  - " + f);
for (const m of missing) fail(`${m.file} is imported by ${m.from} but does not exist`);

console.log(`\nSyntax (${files.length} files reachable from the site):`);
for (const f of siteJsFiles()) {
  // Webflow loads every file as type="module", so parse each one as a module.
  try {
    parse(readFileSync(join(ROOT, f), "utf8"), { ecmaVersion: "latest", sourceType: "module" });
  } catch (e) {
    fail(`${f}: ${e.message}`);
  }
}

console.log(bad ? `\n${bad} problem(s). Fix before releasing.` : "\nAll good.");
process.exit(bad ? 1 : 0);
