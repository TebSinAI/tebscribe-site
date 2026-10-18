# Deploying tebscribe.com

Static site on GitHub Pages (repo root = site root). The landing-train orchestrator publishes; builders never deploy.

## Checks before landing

    node --check tb-consent.js && node --check tb-beacon.js
    node tests/check-consent.mjs
    node tests/check-jsonld.mjs

## After deploy

Ping IndexNow so Bing / ChatGPT search re-crawl. The key file is served at
`https://tebscribe.com/95ec06effaa430ffd3984f7f087bfe3b.txt` (confirm it returns the key first).

    Key: 95ec06effaa430ffd3984f7f087bfe3b
    curl "https://api.indexnow.org/indexnow?url=https://tebscribe.com/&key=95ec06effaa430ffd3984f7f087bfe3b"

A 200 or 202 response means accepted. Also fetch `https://tebscribe.com/llms.txt` to confirm it is live (404 = not published yet).
