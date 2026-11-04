// Regenerates sitemap.xml from the indexable pages in this repo. lastmod = the page's last git commit date,
// or today when the file has uncommitted changes. Usage: node tests/gen-sitemap.mjs [--write]
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ORIGIN, ROOT, loadPages, sitemapUrls } from "./_site.mjs";

const git = (...a) => execFileSync("git", a, { cwd: ROOT, encoding: "utf8" }).trim();
const today = new Date().toISOString().slice(0, 10);
const old = new Map(sitemapUrls().map((u) => [u.loc, readPriority(u.loc)]));
function readPriority(loc) {
  const xml = readFileSync(join(ROOT, "sitemap.xml"), "utf8");
  const m = xml.match(new RegExp(`<loc>${loc.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}</loc>[\\s\\S]*?<priority>([^<]+)</priority>`));
  return m ? m[1] : "0.5";
}
const rows = loadPages().filter((p) => !p.noindex).map((p) => {
  const dirty = git("status", "--porcelain", "--", p.file) !== "";
  const date = dirty ? today : git("log", "-1", "--format=%cs", "--", p.file) || today;
  return { loc: ORIGIN + p.path, date, pri: old.get(ORIGIN + p.path) || "0.5", depth: p.path.split("/").filter(Boolean).length };
}).sort((a, b) => (a.loc === ORIGIN + "/" ? -1 : b.loc === ORIGIN + "/" ? 1 : parseFloat(b.pri) - parseFloat(a.pri) || a.loc.localeCompare(b.loc)));

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!-- tebscribe.com sitemap. Indexable pages only (noindex: /3d/, /classic.html, /bellody/classic.html,
     /tebcapture/, /404.html). Generated: node tests/gen-sitemap.mjs --write (lastmod = git commit date). -->
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${rows.map((r) => `  <url>\n    <loc>${r.loc}</loc>\n    <lastmod>${r.date}</lastmod>\n    <priority>${r.pri}</priority>\n  </url>`).join("\n")}
</urlset>
`;
if (process.argv.includes("--write")) { writeFileSync(join(ROOT, "sitemap.xml"), xml); console.log(`wrote sitemap.xml (${rows.length} URLs)`); }
else process.stdout.write(xml);
