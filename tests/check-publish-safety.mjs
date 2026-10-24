// GitHub Pages publishes the repo root as-is (and the repo is public), so any file committed here is
// downloadable. This check fails if the tree holds what AI/automated scanners probe for (server-side
// code, env files, DB dumps, backups/archives, keys), or if any HTML page loads a third-party script
// statically (third-party scripts must only be injected by tb-consent.js after opt-in).
// Usage: node tests/check-publish-safety.mjs [site-root]
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = process.argv[2] || join(dirname(fileURLToPath(import.meta.url)), "..");
const SKIP = new Set([".git", "node_modules", ".dispatch"]);
const RISKY_EXT = /\.(php\d?|phtml|phar|sql|sqlite3?|db|bak|old|orig|swp|zip|tar|gz|tgz|7z|rar|pem|key|p12|pfx)$/i;
const RISKY_NAME = /^(\.env(\..*)?|\.htpasswd|\.htaccess|wp-config.*|composer\.(json|lock)|id_rsa.*|id_ed25519.*|\.npmrc|\.git-credentials)$/i;
const EXT_SCRIPT = /<script[^>]*\ssrc=["']\s*(?:https?:)?\/\//gi;

function walk(d, out = []) {
  for (const n of readdirSync(d)) {
    if (SKIP.has(n)) continue;
    const p = join(d, n);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}
let bad = 0;
const files = walk(ROOT);
for (const f of files) {
  const name = f.split(/[\\/]/).pop();
  if (RISKY_EXT.test(name) || RISKY_NAME.test(name)) {
    bad++;
    console.error(`FAIL ${relative(ROOT, f)}: server-side, secret or backup file would be public on Pages`);
  }
}
const pages = files.filter((f) => f.endsWith(".html"));
for (const f of pages) {
  const hits = readFileSync(f, "utf8").match(EXT_SCRIPT) || [];
  if (hits.length) {
    bad++;
    console.error(`FAIL ${relative(ROOT, f)}: ${hits.length} static third-party <script src> (load it via tb-consent.js after consent)`);
  }
}
if (pages.length === 0) {
  bad++;
  console.error(`FAIL: no HTML pages found under ${ROOT} (wrong site root?)`);
}
console.log(`${files.length} files / ${pages.length} pages checked, ${bad} failing`);
process.exit(bad ? 1 : 0);
