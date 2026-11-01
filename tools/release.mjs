// Releases what is committed on main as the next version tag, then confirms
// jsDelivr serves every file the site loads, byte for byte. Only after that is
// it safe to point Webflow at the new version.
//
//   npm run release            -> next patch (1.8.1 -> 1.8.2)
//   npm run release -- 1.9.0   -> a chosen version
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { ROOT, MAP, git, latestTag, reachableFiles } from "./lib.mjs";

const stop = (msg) => { console.error("\nSTOPPED: " + msg); process.exit(1); };

execFileSync(process.execPath, [join(ROOT, "tools", "check.mjs")], { stdio: "inherit" });

if (git("rev-parse", "--abbrev-ref", "HEAD") !== "main") stop("not on main.");
if (git("status", "--porcelain")) stop("uncommitted changes. Commit them first.");

const prev = latestTag();
const [a, b, c] = prev.split(".").map(Number);
const next = process.argv[2] || `${a}.${b}.${c + 1}`;
if (!/^\d+\.\d+\.\d+$/.test(next)) stop(`"${next}" is not like 1.8.2.`);
if (git("tag", "--list", next)) stop(`tag ${next} already exists.`);
if (git("rev-parse", "HEAD") === git("rev-list", "-n", "1", prev)) stop(`nothing new since ${prev}.`);

console.log(`\nReleasing ${prev} -> ${next}`);
console.log(git("log", "--oneline", `${prev}..HEAD`));

git("push", "origin", "main");
git("tag", next);
git("push", "origin", next);

const { files } = reachableFiles();
const sha = (buf) => createHash("sha256").update(buf).digest("hex");
console.log(`\nWaiting for jsDelivr to serve ${files.length} files at @${next} ...`);
for (let attempt = 1; attempt <= 12; attempt++) {
  const results = await Promise.all(files.map(async (f) => {
    const res = await fetch(`${MAP.cdnBase}@${next}/${f}`, { cache: "no-store" });
    if (!res.ok) return `${f}: HTTP ${res.status}`;
    const got = Buffer.from(await res.arrayBuffer());
    return sha(got) === sha(readFileSync(join(ROOT, f))) ? null : `${f}: content differs`;
  }));
  const bad = results.filter(Boolean);
  if (!bad.length) {
    console.log(`\nAll ${files.length} files are live on jsDelivr at @${next}.`);
    console.log(`Next: switch Webflow from @${MAP.liveVersion} to @${next} (10 code blocks, version only), then publish.`);
    process.exit(0);
  }
  console.log(`  try ${attempt}: ${bad.length} not ready (${bad[0]})`);
  await new Promise((r) => setTimeout(r, 10_000));
}
stop(`jsDelivr does not serve @${next}. Webflow was NOT changed and still runs @${MAP.liveVersion}. ` +
  "If every file says HTTP 404, the GitHub repo is private: jsDelivr can only read public repos.");
