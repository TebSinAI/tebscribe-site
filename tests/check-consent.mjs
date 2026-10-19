// Every public HTML page: no static gtag tag, exactly one tb-consent.js include, one consent-open link.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

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
const files = walk(".");
for (const f of files) {
  const s = readFileSync(f, "utf8");
  const gtag = count(s, /<script[^>]*src=["'][^"']*googletagmanager\.com\/gtag\/js/g);
  const inc = count(s, /<script[^>]*src=["']\/tb-consent\.js["']/g);
  const link = count(s, /data-tb-consent-open/g);
  if (gtag !== 0 || inc !== 1 || link !== 1) {
    bad++;
    console.error(`FAIL ${f}: static gtag=${gtag} (want 0), tb-consent include=${inc} (want 1), open link=${link} (want 1)`);
  }
}
console.log(`${files.length} pages checked, ${bad} failing`);
process.exit(bad ? 1 : 0);
