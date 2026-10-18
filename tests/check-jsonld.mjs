// JSON.parse every application/ld+json block in every public HTML page.
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
let blocks = 0, bad = 0;
for (const f of walk(".")) {
  const s = readFileSync(f, "utf8");
  for (const m of s.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/g)) {
    blocks++;
    try { JSON.parse(m[1]); } catch (e) { bad++; console.error(`FAIL ${f}: ${e.message}`); }
  }
}
console.log(`${blocks} JSON-LD blocks, ${bad} invalid`);
process.exit(bad ? 1 : 0);
