// Every public HTML page: no static gtag tag, exactly one tb-consent.js include, one consent-open link.
// Usage: node tests/check-consent.mjs [site-root]
// The site root defaults to the repo root (the folder above this file), whatever the current
// working directory is, so the check can never silently pass by scanning an empty folder.
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
const count = (s, re) => (s.match(re) || []).length;
let bad = 0;
const files = walk(ROOT);
for (const f of files) {
  const s = readFileSync(f, "utf8");
  const gtag = count(s, /<script[^>]*src=["'][^"']*googletagmanager\.com\/gtag\/js/g);
  const inc = count(s, /<script[^>]*src=["']\/tb-consent\.js["']/g);
  const link = count(s, /data-tb-consent-open/g);
  if (gtag !== 0 || inc !== 1 || link !== 1) {
    bad++;
    console.error(`FAIL ${relative(ROOT, f)}: static gtag=${gtag} (want 0), tb-consent include=${inc} (want 1), open link=${link} (want 1)`);
  }
}
if (files.length === 0) {
  bad++;
  console.error(`FAIL: no HTML pages found under ${ROOT} (wrong site root?)`);
}
console.log(`${files.length} pages checked, ${bad} failing`);
process.exit(bad ? 1 : 0);
