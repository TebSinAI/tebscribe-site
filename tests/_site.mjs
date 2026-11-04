// Shared helpers for the SEO tests: page discovery, noindex detection, URL mapping.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const ORIGIN = "https://tebscribe.com";
const SKIP = new Set([".git", "_research", "node_modules", "tests", ".dispatch", "assets", "docs"]);

export function walk(d = ROOT, out = []) {
  for (const n of readdirSync(d)) {
    if (SKIP.has(n)) continue;
    const p = join(d, n);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (n.endsWith(".html")) out.push(p);
  }
  return out;
}

// repo file -> public URL ("index.html" -> "/", "IMG/index.html" -> "/IMG/", "apps.html" -> "/apps.html")
export function urlPath(file) {
  const rel = relative(ROOT, file).split("\\").join("/");
  if (rel === "index.html") return "/";
  return "/" + (rel.endsWith("/index.html") ? rel.slice(0, -"index.html".length) : rel);
}

export function loadPages() {
  return walk().map((file) => {
    const html = readFileSync(file, "utf8");
    const robots = (html.match(/<meta\s+name="robots"\s+content="([^"]*)"/i) || [])[1] || "";
    return {
      file: relative(ROOT, file), path: urlPath(file), html,
      noindex: /noindex/i.test(robots),
      title: ((html.match(/<title>([\s\S]*?)<\/title>/i) || [])[1] || "").replace(/&amp;/g, "&").trim(),
      description: ((html.match(/<meta\s+name="description"\s+content="([^"]*)"/i) || [])[1] || "").replace(/&amp;/g, "&").trim(),
      canonical: (html.match(/<link\s+rel="canonical"\s+href="([^"]*)"/i) || [])[1] || "",
    };
  });
}

export function sitemapUrls() {
  const xml = readFileSync(join(ROOT, "sitemap.xml"), "utf8");
  return [...xml.matchAll(/<url>\s*<loc>([^<]+)<\/loc>(?:\s*<lastmod>([^<]+)<\/lastmod>)?/g)].map((m) => ({ loc: m[1], lastmod: m[2] || "" }));
}
