import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const MAP = JSON.parse(readFileSync(join(ROOT, "tools", "webflow-map.json"), "utf8"));

/** Every file the live site loads directly, once each. */
export const entryFiles = () => [...new Set(MAP.blocks.flatMap((b) => b.files))];

/** Site JS files: everything outside tools/, .git, node_modules. */
export function siteJsFiles(dir = ROOT) {
  const out = [];
  for (const name of readdirSync(dir)) {
    if ([".git", "node_modules", "tools", ".cursor"].includes(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...siteJsFiles(p));
    else if (name.endsWith(".js")) out.push(relative(ROOT, p).replaceAll("\\", "/"));
  }
  return out;
}

const IMPORT_RE = /^\s*(?:import\s+(?:[^'"]*?\s+from\s+)?|export\s+[^'"]*?\s+from\s+)['"]([^'"]+)['"]/gm;

/** Follows relative imports from the entry files: the full set of files the site can load. */
export function reachableFiles() {
  const seen = new Set();
  const missing = [];
  const walk = (file, from) => {
    if (seen.has(file)) return;
    if (!existsSync(join(ROOT, file))) { missing.push({ file, from }); return; }
    seen.add(file);
    const src = readFileSync(join(ROOT, file), "utf8");
    for (const m of src.matchAll(IMPORT_RE)) {
      const spec = m[1];
      if (!spec.startsWith(".")) continue; // bare specifiers come from the importmap
      walk(relative(ROOT, resolve(ROOT, dirname(file), spec)).replaceAll("\\", "/"), file);
    }
  };
  for (const f of entryFiles()) walk(f, "Webflow");
  return { files: [...seen], missing };
}

export const git = (...args) => execFileSync("git", args, { cwd: ROOT, encoding: "utf8" }).trim();

/** Release tags look like 1.8.1 (no "v"); the old v1.0.x tags are ignored. */
export function latestTag() {
  return git("tag", "--list")
    .split("\n")
    .filter((t) => /^\d+\.\d+\.\d+$/.test(t))
    .sort((a, b) => {
      const [x, y] = [a, b].map((t) => t.split(".").map(Number));
      return x[0] - y[0] || x[1] - y[1] || x[2] - y[2];
    })
    .at(-1);
}
