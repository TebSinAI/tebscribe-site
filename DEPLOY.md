# Deploying tebscribe.com

Static site on GitHub Pages (repo root = site root). The landing-train orchestrator publishes; builders never deploy.

## Checks before landing

    node --check tb-consent.js && node --check tb-beacon.js
    node tests/check-consent.mjs
    node tests/check-jsonld.mjs
    node tests/check-publish-safety.mjs
    node tests/check-referrer.mjs
    node tests/check-seo.mjs

`check-seo.mjs` fails if an indexable page lacks a self canonical, a unique title (<= 65 chars) or description (<= 160), `tb-beacon.js`, or a sitemap entry; if a noindex page is in `sitemap.xml`; if an outbound link to tebiq.com / tebchart.com / tebdictate.com has no UTMs; or if the homepage JSON-LD, the globe mount, `robots.txt` or the claims rules regress.

After adding, renaming or editing a page, regenerate the sitemap (lastmod = git commit date, or today for uncommitted files) and commit it:

    node tests/gen-sitemap.mjs --write

## After deploy

Ping IndexNow so Bing / ChatGPT search re-crawl. The key file is served at
`https://tebscribe.com/95ec06effaa430ffd3984f7f087bfe3b.txt` (confirm it returns the key first).

    Key: 95ec06effaa430ffd3984f7f087bfe3b
    curl "https://api.indexnow.org/indexnow?url=https://tebscribe.com/&key=95ec06effaa430ffd3984f7f087bfe3b"

A 200 or 202 response means accepted. Also fetch `https://tebscribe.com/llms.txt` to confirm it is live (404 = not published yet).

### IndexNow for every page (one POST)

The GET above only submits `/`. After a deploy that changes several pages, submit every sitemap URL in one request
(Bing, and through it ChatGPT search and other IndexNow partners, re-crawl them). The key file must return the key first.

    curl -s https://tebscribe.com/95ec06effaa430ffd3984f7f087bfe3b.txt   # must print the key
    node -e '
      const xml = require("fs").readFileSync("sitemap.xml", "utf8");
      const urlList = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
      console.log(JSON.stringify({ host: "tebscribe.com", key: "95ec06effaa430ffd3984f7f087bfe3b",
        keyLocation: "https://tebscribe.com/95ec06effaa430ffd3984f7f087bfe3b.txt", urlList }));
    ' > "$TMPDIR/indexnow.json"
    curl -s -o /dev/null -w "%{http_code}\n" -X POST "https://api.indexnow.org/IndexNow" \
      -H "Content-Type: application/json; charset=utf-8" --data @"$TMPDIR/indexnow.json"

200 or 202 means accepted (up to 10,000 URLs per POST; we send 17). 422 usually means the key file is not reachable yet.
Google does not take IndexNow: use the sitemap in Search Console. Submit `https://tebscribe.com/sitemap.xml` there and in
Bing Webmaster Tools once, then they re-read it on their own.
