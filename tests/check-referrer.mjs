// Every public HTML page declares a referrer policy (GitHub Pages cannot set response headers).
// Usage: node tests/check-referrer.mjs [site-root]
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = process.argv[2] || join(dirname(fileURLToPath(import.meta.url)), "..");
const SKIP = new Set([".git", "_research", "node_modules", "tests", ".dispatch", "assets"]);
function walk(d, out = []) {
  for (const n of readdirSync(d)) {
    if (SKIP.has(n)) continue;
    const p = join(d, n);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (n.endsWith(".html")) out.push(p);
  }
  return out;
}
const OK = /<meta\s+name="referrer"\s+content="(strict-origin-when-cross-origin|strict-origin|same-origin|no-referrer)"/;
let bad = 0;
const files = walk(ROOT);
for (const f of files) {
  if (!OK.test(readFileSync(f, "utf8"))) {
    bad++;
    console.error(`FAIL ${relative(ROOT, f)}: no safe referrer meta`);
  }
}
if (files.length === 0) {
  bad++;
  console.error("FAIL: no HTML pages found");
}
console.log(`${files.length} pages checked, ${bad} failing`);
process.exit(bad ? 1 : 0);
