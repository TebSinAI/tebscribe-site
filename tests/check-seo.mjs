// SEO guard for the static site. Fails if an indexable page lacks a self canonical, a unique title
// (<= 65 chars) or description (<= 160), tb-beacon.js, or is missing from sitemap.xml; if a noindex page is
// listed in the sitemap; if an outbound product link lacks UTMs; or if the homepage structured data,
// globe mount, robots.txt or the claims rules regress.
// Usage: node tests/check-seo.mjs
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ORIGIN, ROOT, loadPages, sitemapUrls } from "./_site.mjs";

let bad = 0;
const fail = (m) => { bad++; console.error("FAIL " + m); };
const pages = loadPages();
const indexable = pages.filter((p) => !p.noindex);
const sm = sitemapUrls();
const smSet = new Map(sm.map((u) => [u.loc, u]));

// 1. per indexable page
const titles = new Map(), descs = new Map();
for (const p of indexable) {
  const want = ORIGIN + p.path;
  if (p.canonical !== want) fail(`${p.file}: canonical "${p.canonical}" must be "${want}"`);
  if (!p.title) fail(`${p.file}: missing <title>`);
  else {
    if (p.title.length > 65) fail(`${p.file}: title is ${p.title.length} chars (max 65)`);
    if (titles.has(p.title)) fail(`${p.file}: title duplicates ${titles.get(p.title)}`); else titles.set(p.title, p.file);
  }
  if (!p.description) fail(`${p.file}: missing meta description`);
  else {
    if (p.description.length > 160) fail(`${p.file}: description is ${p.description.length} chars (max 160)`);
    if (descs.has(p.description)) fail(`${p.file}: description duplicates ${descs.get(p.description)}`); else descs.set(p.description, p.file);
  }
  if (!/<script[^>]*src="\/tb-beacon\.js"[^>]*data-property="tebscribe"/.test(p.html) && !/<script[^>]*data-property="tebscribe"[^>]*src="\/tb-beacon\.js"/.test(p.html)) fail(`${p.file}: tb-beacon.js (data-property="tebscribe") missing`);
  if (!smSet.has(want)) fail(`${p.file}: ${want} is indexable but missing from sitemap.xml`);
  if (!/<h1[\s>]/.test(p.html)) fail(`${p.file}: no <h1>`);
  const noAlt = (p.html.match(/<img\b[^>]*>/gi) || []).filter((t) => !/\balt=/.test(t));
  if (noAlt.length) fail(`${p.file}: ${noAlt.length} <img> without alt`);
}

// 2. sitemap lists only real, indexable, canonical URLs
const byUrl = new Map(pages.map((p) => [ORIGIN + p.path, p]));
for (const u of sm) {
  const p = byUrl.get(u.loc);
  if (!p) fail(`sitemap.xml: ${u.loc} is not a page in this repo`);
  else if (p.noindex) fail(`sitemap.xml: ${u.loc} is noindex and must not be listed`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(u.lastmod)) fail(`sitemap.xml: ${u.loc} has no valid lastmod`);
}
if (new Set(sm.map((u) => u.loc)).size !== sm.length) fail("sitemap.xml: duplicate <loc>");

// 3. outbound links to our product sites carry UTMs (App Store/Play links cannot; /tebiqadmin is a login)
const PROD = /href="(https?:\/\/(?:www\.)?(?:tebiq|tebchart|tebdictate)\.com[^"]*)"/g;
for (const p of indexable) {
  for (const m of p.html.matchAll(PROD)) {
    const u = m[1].replace(/&amp;/g, "&");
    if (/\/tebiqadmin/.test(u)) continue;
    for (const k of ["utm_source=tebscribe", "utm_medium=", "utm_campaign=", "utm_content="]) {
      if (!u.includes(k)) { fail(`${p.file}: outbound link ${u} lacks ${k}`); break; }
    }
    const camp = (u.match(/utm_campaign=([^&]*)/) || [])[1] || "";
    if (!/^[a-z0-9_-]{1,32}$/.test(camp)) fail(`${p.file}: utm_campaign "${camp}" is not [a-z0-9_-]{1,32} (the beacon collector clamps anything else to "other")`);
  }
}

// 4. homepage structured data and globe mount
const home = pages.find((p) => p.path === "/");
const prod = pages.find((p) => p.path === "/products.html");
const ldBlocks = (h) => [...h.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
const nodes = (h) => ldBlocks(h).flatMap((b) => (b["@graph"] ? b["@graph"] : [b]));
const orgOf = (h) => JSON.stringify(nodes(h).find((n) => n["@type"] === "Organization"));
if (orgOf(home.html) !== orgOf(prod.html)) fail("index.html and products.html Organization nodes differ (must be identical)");
for (const n of nodes(home.html)) {
  for (const k of ["@id", "url"]) if (typeof n[k] === "string" && /\/3d\//.test(n[k])) fail(`index.html JSON-LD ${n["@type"]} ${k} points at /3d/: ${n[k]}`);
  if (n["@type"] === "WebPage" && n.url !== ORIGIN + "/") fail(`index.html WebPage url must equal the canonical (${n.url})`);
  if (/AggregateRating|"Review"/.test(JSON.stringify(n))) fail("index.html JSON-LD contains rating/review markup");
}
const org = nodes(home.html).find((n) => n["@type"] === "Organization");
if (!(org.sameAs || []).includes("https://play.google.com/store/apps/details?id=com.tebscribe.tebiq")) fail("Organization.sameAs lacks the tebIQ Google Play listing");
// FAQPage only when the same Q&A is visible on the page body
const visible = home.html.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<style[\s\S]*?<\/style>/g, "");
for (const n of nodes(home.html)) if (n["@type"] === "FAQPage") for (const q of n.mainEntity) if (!visible.includes(q.name)) fail(`FAQPage question not visible on index.html: ${q.name}`);

const globe = home.html.match(/<section id="tb-globe"[\s\S]*?<\/section>/);
if (!globe) fail("index.html: #tb-globe mount missing");
else {
  const order = [...globe[0].matchAll(/data-product="([^"]+)"/g)].map((m) => m[1]);
  const want = ["tebiq", "tebchart", "tebdictate", "img", "tebrounds", "tebintake", "tebcapture", "bellody", "tools"];
  if (order.join() !== want.join()) fail(`#tb-globe product order is ${order.join()} (want ${want.join()})`);
  const colors = [...globe[0].matchAll(/data-color="([^"]+)"/g)].map((m) => m[1].toLowerCase());
  if (new Set(colors).size !== colors.length) fail("#tb-globe data-color values are not distinct");
  for (const m of globe[0].matchAll(/<a href="(https?:[^"]+)"/g)) if (!/utm_medium=globe/.test(m[1]) || !/utm_campaign=home_globe/.test(m[1])) fail(`#tb-globe external link lacks globe UTMs: ${m[1]}`);
  for (const m of globe[0].matchAll(/<span>([^<]+)<\/span>/g)) if (m[1].trim().split(/\s+/).length > 9) fail(`#tb-globe tagline over 9 words: ${m[1]}`);
}
if (!/\/assets\/globe\/tb-globe\.css/.test(home.html) || !/\/assets\/globe\/tb-globe\.js/.test(home.html)) fail("index.html does not load the globe css/js");

// 5. robots.txt
const robots = readFileSync(join(ROOT, "robots.txt"), "utf8");
for (const ua of ["Googlebot", "Bingbot", "Applebot", "DuckDuckBot", "YandexBot", "Google-Extended", "GPTBot", "OAI-SearchBot", "ChatGPT-User", "ClaudeBot", "Claude-User", "Claude-SearchBot", "PerplexityBot", "Perplexity-User", "Meta-ExternalAgent", "CCBot", "Amazonbot", "MistralAI-User"]) {
  if (!new RegExp(`^User-agent:\\s*${ua}\\s*$`, "mi").test(robots)) fail(`robots.txt: no group for ${ua}`);
}
if (/^\s*Disallow:\s*\S/m.test(robots)) fail("robots.txt: contains a Disallow rule (policy is fully permissive)");
if (!/^Sitemap:\s*https:\/\/tebscribe\.com\/sitemap\.xml/m.test(robots)) fail("robots.txt: Sitemap line missing");

// 6. claims rules on the files this lane owns
const BAN = /HIPAA[- ](?:certified|compliant)|de-identified|no hallucinations?|AggregateRating|"@type":\s*"Review"/i;
for (const f of ["index.html", "products.html", "llms.txt", "llms-full.txt"]) {
  const t = readFileSync(join(ROOT, f), "utf8").replace(/<!--[\s\S]*?-->/g, "");
  const m = t.match(BAN);
  if (m) fail(`${f}: banned claim "${m[0]}"`);
}
for (const f of ["llms.txt", "llms-full.txt"]) {
  const t = readFileSync(join(ROOT, f), "utf8");
  for (const needle of ["tebiq.com", "tebdictate.com", "tebchart.com", "/IMG/", "/free-medical-tools/", "tebRounds", "tebIntake", "tebCapture", "Bellody", "Encrypted in transit and at rest (AES). Never used for training. Never sold."]) {
    if (!t.includes(needle)) fail(`${f}: missing "${needle}"`);
  }
}

console.log(`${pages.length} pages (${indexable.length} indexable, ${pages.length - indexable.length} noindex), ${sm.length} sitemap URLs, ${bad} failing`);
process.exit(bad ? 1 : 0);
