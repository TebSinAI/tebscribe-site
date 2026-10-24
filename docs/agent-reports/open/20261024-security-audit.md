# Security audit of the public sites — 2026-10-24 (PARTIAL: repo-side only)

**Limit of this run:** the sandbox declined every outbound command (curl, dig, openssl), so NO live TLS, header, path-probe, DNS (SPF/DKIM/DMARC/CNAME) or S3/CloudFront check was performed. Nothing below claims a live result. The live checklist at the end must be run from a host with network access. No site config was changed.

## Repo evidence (tebscribe.com = this repo)
| Finding | Severity | Evidence | Fix |
|---|---|---|---|
| PHP does not apply to this repo: pure static site (HTML/JS/TXT) on GitHub Pages | n/a | `CNAME` = tebscribe.com; `DEPLOY.md:3` "Static site on GitHub Pages"; no `*.php`, `composer.json`, `vendor/` in tree | none; still confirm live that `/wp-login.php`, `/xmlrpc.php`, `/phpinfo.php`, `/.env`, `/.git/HEAD` return 404 |
| Security headers cannot be set from the repo (GitHub Pages sends no custom HSTS/CSP/X-Frame-Options/Permissions-Policy) | Low–Med | no `Content-Security-Policy` meta in index.html or apps/*.html (grep count 0) | Recommend CloudFront/Cloudflare response-headers policy (infra: recommendation only). Verify live that Pages serves HSTS |
| No `<meta name="referrer">` on any page | Low | grep count 0 in index.html, apps/*.html | Add `strict-origin-when-cross-origin` meta site-wide (not done: touches every page; browsers default to it already) |
| Google Fonts loaded from fonts.googleapis.com / gstatic before any consent | Low–Med (privacy: visitor IP sent to Google) | index.html:145-147, apps/tebrounds.html:18-20, products-by-dr-c/index.html:30-32, bellody/*, free-*/index.html, tebcapture/index.html:25-27 | Self-host the fonts, drop the preconnects |
| Analytics gated by consent: default denied, gtag injected only after opt-in | OK | tb-consent.js:39-41, :64-73; `tests/check-consent.mjs` | none |
| No other third-party `<script src>` found | OK | grep of index.html, apps/, products-by-dr-c, free-*, bellody, tebcapture, 404.html | none |
| IndexNow key file public at root | Info | `95ec06effaa430ffd3984f7f087bfe3b.txt`; by design (DEPLOY.md) | none |
| Hostnames: repo references tebscribe.com, tebiq.com, v2.tebiq.com, tebchart.com, tebdictate.com. No tebrounds.com, Lovable or acep URL found | Info | grep over html/txt/xml | Founder to confirm real hostnames for tebrounds, Lovable landing, ACEP page |

## Per-site status (all live items NOT CHECKED)
| Site | TLS/expiry | HSTS/CSP/XFO/Referrer/Permissions | Banner | PHP paths | SPF/DKIM/DMARC/CNAME |
|---|---|---|---|---|---|
| tebscribe.com | not checked | not checked | not checked | static, PHP N/A (repo evidence) | not checked |
| tebiq.com, www., v2. | not checked | not checked | not checked | unknown (other repo) | not checked |
| tebchart.com, tebdictate.com | not checked | not checked | not checked | unknown | not checked |
| tebrounds, Lovable landing, ACEP | hostname unverified | — | — | — | — |

## Live checklist (passive only)
- Headers: `curl -sI https://HOST`
- Paths: `curl -s -o /dev/null -w '%{http_code}' https://HOST/PATH` for /wp-login.php /xmlrpc.php /phpinfo.php /.env /.git/HEAD /vendor/phpunit/ /server-status /backup.zip /dump.sql (404/403 good; 200 on a SPA catch-all needs a body check)
- Cert expiry: `openssl s_client -connect HOST:443 | openssl x509 -noout -enddate`
- Mail DNS: `dig +short TXT HOST`, `_dmarc.HOST`, and `SELECTOR._domainkey.HOST`
- Takeover: `dig CNAME` per subdomain, confirm each target still exists
- S3: `curl -s https://BUCKET.s3.amazonaws.com/` for listing
