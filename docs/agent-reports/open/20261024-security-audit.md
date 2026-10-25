# Security audit of the public sites — 2026-10-24

**Method (passive only).** Plain GETs of each URL, response headers via the hackertarget header API, TLS grade via SSL Labs (cached or standard scan, results not published), DNS via Google DNS-over-HTTPS (dns.google), and subdomain discovery from Certificate Transparency logs (crt.sh). No fuzzing, no brute force, no logins, no writes. No secrets or tokens are reproduced here; verification tokens are omitted on purpose.

**Runs.** Two lane runs on 2026-10-24/25 each did the live checks on their own; this file merges both. A re-check on 2026-10-25 (~04:00 UTC) filled the gaps: SSL Labs for tebchart/tebdictate, www.tebscribe.com headers, `/vendor/phpunit/` and `/backup.sql`, and the tebscribe.com cert. The shell has no network (`curl`/`dig`/`openssl` are refused), so every check went through the read-only services above. `2026-10-24-outside-security-check-all-sites.md` is the other run's copy and is superseded by this file.

**Bottom line.**
- **PHP does not run on any of these sites.** Every PHP or CMS path that scanners probe returns 404, or 403 on tebchart. No `X-Powered-By` header, no `PHPSESSID` cookie and no `.php` route answers anywhere. The stacks are GitHub Pages, S3+CloudFront, AWS App Runner (envoy) behind CloudFront, and an AWS ALB. The current wave of PHP exploits, and the AI scanners that look for them, find nothing here.
- **No secrets, git metadata, backups or bucket listings are exposed.**
- **The real gaps are e-mail spoofing (DMARC/SPF), missing security headers on three sites, and one stale DNS record.** All of them are DNS or infra changes, so they are recommendations only.

## Sites and how each was identified
| # | Site | URL audited | Hosting (evidence) |
|---|---|---|---|
| 1 | tebiq.com | https://tebiq.com/ | AWS ALB (`Server: awselb/2.0` on the http→https 301; A 3.132.105.179, 16.58.208.124) |
| 2 | www.tebiq.com | https://www.tebiq.com/ | CNAME → tebiq.com (same ALB) |
| 3 | v2.tebiq.com | https://v2.tebiq.com/ | same ALB IPs as tebiq.com; serves the tebIQ app SPA |
| 4 | tebscribe.com | https://tebscribe.com/ | GitHub Pages (`Server: GitHub.com`; A 185.199.108–111.153; `CNAME` file in this repo) |
| 5 | tebchart.com | https://tebchart.com/ | S3 behind CloudFront (`Server: AmazonS3`, `Via: … (CloudFront)`) |
| 6 | tebdictate.com | https://tebdictate.com/ | App Runner/envoy behind CloudFront (`server: envoy`, `Via: … (CloudFront)`) |
| 7 | tebRounds site | https://tebscribe.com/apps/tebrounds.html | page in this repo (`apps/tebrounds.html:8` canonical). **tebrounds.com** is registered and hosted on Route 53 (NS awsdns-26/28/32/39), but it has no A record and `www` is NXDOMAIN, so it serves no website and there is nothing to probe |
| 8 | Lovable landing | **NOT FOUND** | no Lovable URL anywhere in this repo, no `*.lovable.app` hit in search, no matching name in the CT logs. Founder to supply the URL |
| 9 | ACEP page | https://tebiq.com/acep | linked from `classic.html:845`; served by the tebiq.com ALB (same headers) |

## Transport and headers (homepage response)
| Site | TLS grade (SSL Labs) | Cert expiry (crt.sh, latest) | HSTS | CSP | X-Frame-Options | Referrer-Policy | Permissions-Policy | Server banner |
|---|---|---|---|---|---|---|---|---|
| tebiq.com, www, /acep | **A+** (both ALB IPs) | 2027-01-16 (Amazon, auto-renew) | `max-age=31536000; includeSubDomains` | **Report-Only** (not enforced), `script-src 'self' 'unsafe-inline' …` | DENY | strict-origin-when-cross-origin | set (mic=self, others off) | none on 200; `awselb/2.0` on redirect |
| v2.tebiq.com | same ALB as tebiq.com (no separate scan: rate-limited) | 2026-12-28 (Amazon, auto-renew) | same as tebiq.com | Report-Only, same | DENY | same | same | none |
| tebscribe.com (+ tebRounds page) | **B** on all 4 GitHub Pages IPs (TLS 1.2/1.3 only; capped by GitHub/Fastly's shared cipher list; OCSP stapling off) | 2026-11-28 (Let's Encrypt YR2, auto-renewed by GitHub). crt.sh also lists an unrelated Amazon cert for tebscribe.com valid to 2027-01-13; GitHub Pages does not serve it | **absent** | **absent** | **absent** | header absent. **Meta tag added on this branch** (`strict-origin-when-cross-origin`) | absent | `GitHub.com` (no version) |
| www.tebscribe.com | same GitHub Pages edge | same cert | absent | absent | absent | absent | absent | `GitHub.com`. Answers 301 → https://tebscribe.com/ (hackertarget, 2026-10-25) |
| tebchart.com | **A** on all 12 CloudFront endpoints (SSL Labs READY, 2026-10-25; A+ needs HSTS) | 2027-01-15 (Amazon, auto-renew) | **absent** | **absent** | **absent** | **absent** | **absent** | `AmazonS3` |
| tebdictate.com | **A** on all 12 CloudFront endpoints (SSL Labs READY, 2026-10-25; A+ needs HSTS) | 2027-01-25 (Amazon, auto-renew) | **absent** | **absent** | **absent** | **absent** | **absent** | `envoy`, plus `x-envoy-upstream-service-time` |
| tebrounds.com | n/a (no A record) | none in CT logs | n/a | n/a | n/a | n/a | n/a | n/a |
| Lovable landing | NOT FOUND (no URL) | — | — | — | — | — | — | — |

Every host redirects http→https with a 301 (checked tebiq.com, tebscribe.com, tebchart.com, tebdictate.com).

## PHP / exploit-path probes (one GET each)
Both runs combined. Extra paths tried: `/vendor/phpunit/phpunit/src/Util/PHP/eval-stdin.php` and `/dump.sql` everywhere, plus `/wp-admin/` and `/.git/config` on tebscribe.com; all gave the same code as the row below. www.tebiq.com and the www hosts 301 to their apex, so they get the apex's answer. tebrounds.com has no web host, so it was not probed.

| Path | tebscribe.com | tebiq.com (+www, /acep) | v2.tebiq.com | tebchart.com | tebdictate.com |
|---|---|---|---|---|---|
| /wp-login.php | 404 | 404 | 200 SPA shell | 403 | 404 |
| /xmlrpc.php | 404 | 404 | 200 SPA shell | 403 | 404 |
| /phpinfo.php | 404 | 404 | 200 SPA shell | 403 | 404 |
| /.env | 404 | 404 | 200 SPA shell | 403 | 404 |
| /.git/HEAD | 404 | 404 | 200 SPA shell | 403 | 404 |
| /vendor/phpunit/ | 404 | 404 | 200 SPA shell (no listing, no PHP source, re-checked 2026-10-25) | 403 | 404 |
| /server-status | 404 | 404 | 200 SPA shell | 403 | 404 |
| /backup.zip | 404 | 404 | 200 SPA shell | 403 | 404 |
| /backup.sql | 404 | 404 | 200 SPA shell | 403 | 404 |

**Every 200 is a finding, and the only 200s are on v2.tebiq.com.** In each case the body is the tebIQ single-page-app shell (a catch-all route) and contains no env values, git refs, PHP source or dumps. It is not an exposure, but scanners log it as a hit (a soft-404). See the v2 table. tebchart.com's 403 is S3 `AccessDenied` XML through CloudFront: the bucket is private and listing is denied.

## E-mail authentication and DNS
| Domain | MX | SPF | DMARC | DKIM (`google` selector) |
|---|---|---|---|---|
| tebscribe.com | Google Workspace (aspmx.l.google.com …) | `v=spf1 include:amazonses.com ~all`: **does not list Google** | `p=none` (monitor only) | **not found** |
| tebiq.com | Google (smtp.google.com) | `v=spf1 include:_spf.google.com include:amazonses.com include:spf.mtasv.net ~all` ✓ | `p=none` (monitor only) | not found (may use another selector) |
| tebchart.com | **none** | **none** | **none** (NXDOMAIN) | n/a |
| tebdictate.com | **none** | **none** | **none** (NXDOMAIN) | n/a |
| tebrounds.com | **none** | **none** (no TXT at all) | **none** (NXDOMAIN) | n/a |

SES DKIM selectors are random CNAMEs and can't be listed from outside, so DKIM is only *partly* checked.

**Subdomain takeover (CT-log names, each resolved):** app, newapp, dev, v2 and www (tebiq.com) resolve to live AWS endpoints. api, api.app and pulsemd are NXDOMAIN, which is fine. newdev, api-newdev and api.tebscribe.com return no data and are not dangling. **api-dev.tebiq.com is a dangling CNAME:** it points to `mmfv7mkp3g.us-east-2.awsapprunner.com`, which returns NXDOMAIN. www.tebscribe.com → tebsinai.github.io is live.

**S3/CloudFront:** tebchart.com returns 403 for unknown keys, so listing is denied. The obvious bucket names (`tebchart.com`, `www.tebchart.com`, `tebchart`) do not exist on S3, so no open origin was found. The real origin bucket name is not public, so a direct-origin test was not possible.

## Findings per site
Severity: High = exploitable now; Medium = real abuse path; Low = hardening; Info = no action needed.

### tebscribe.com (this repo) and the tebRounds page
| Finding | Severity | Evidence | Fix |
|---|---|---|---|
| PHP / CMS not present | Info | probes above all 404; `DEPLOY.md:3` "Static site on GitHub Pages"; no `*.php` in tree | none. **Fixed on this branch:** `tests/check-publish-safety.mjs` now fails the build if a `.php`, `.env`, `.sql`, archive, key or similar file, or a static third-party `<script src>`, is ever committed |
| SPF omits Google although MX is Google Workspace; DMARC `p=none`; no `google._domainkey` | **Medium** | dns.google TXT/MX for tebscribe.com, `_dmarc`, `google._domainkey` (NXDOMAIN) | Recommendation (DNS): SPF `v=spf1 include:_spf.google.com include:amazonses.com ~all`; turn on Workspace DKIM; after 2–4 weeks of clean `rua` reports, move DMARC to `p=quarantine`, then `p=reject` |
| No HSTS, CSP, X-Frame-Options or Permissions-Policy (GitHub Pages can't send custom headers) | Low | hackertarget headers for https://tebscribe.com/ | Recommendation (infra): put CloudFront or Cloudflare in front with a response-headers policy, or move to S3+CloudFront like tebchart. The site has no logins or forms that carry PHI, so the clickjacking/XSS impact is low |
| TLS grade B | Low | SSL Labs endpoint 185.199.108.153: B, TLS 1.2/1.3 only, no HSTS | Comes from GitHub's shared edge and is not fixable in the repo; same infra fix as above |
| No Referrer-Policy (header or meta) | Low | no referrer meta on any of the 22 pages before this branch | **Fixed on this branch:** `<meta name="referrer" content="strict-origin-when-cross-origin">` on all 22 pages, guarded by `tests/check-referrer.mjs` (in `DEPLOY.md` checks). The header-level gaps (HSTS, CSP, XFO) still need the infra fix above |
| `.gitignore` did not block secrets, dumps or logs (repo root = public site) | Low | the old `.gitignore` had 3 lines. `git ls-files` shows no such files committed today | **Fixed on this branch:** `.env*`, `*.sql(.gz)`, `*.zip`, `*.tar.gz`, `*.bak`, `*.log`, `*.pem`, `*.key` ignored; `tests/check-publish-safety.mjs` catches any that get force-added |
| Google Fonts fetched before consent (visitor IP reaches Google) | Low (privacy) | `fonts.googleapis.com` stylesheet on every page, checked by grep 2026-10-25: `index.html:148`, `404.html:21`, `classic.html:82`, `apps.html:21`, `products.html:39`, `3d/index.html:142`, `apps/{tebiq,tebchart,tebdictate,tebrounds,tebcapture,tebintake,promotions}.html:21`, `products-by-dr-c/index.html:33`, `free-dictation/index.html:33`, `free-medical-tools/index.html:33`, `tebcapture/index.html:28`, `bellody/classic.html:15`, `bellody/{index,support/index,privacy/index}.html:14` (preconnects sit on the two lines above each) | Self-host the font files and drop the preconnects (a visual change, so it needs a separate brief) |
| `tebcapture` relay origin `capture.tebdictate.com` does not resolve | Info | `tebcapture/index.html:485`; DoH NXDOMAIN | Not a takeover risk (our own zone, no CNAME). Create the record before that feature ships |
| Analytics gated by consent | OK | `tb-consent.js:39-41`, `:64-73`; `tests/check-consent.mjs` passes (22 pages) | none |
| Whole repo is public, and everything outside `_`-prefixed folders is served (e.g. `/docs/evidence/*.png`, `/DEPLOY.md` return 200; `/_research/…` returns 404) | Info | github.com/TebSinAI/tebscribe-site is public; fetches above | Keep internal notes in `_`-prefixed folders or in a private repo. **This report is public too once it lands.** It holds no secrets, and every finding can be seen from outside, but the founder may prefer to keep it private |
| IndexNow key file and key in `DEPLOY.md` | Info | `95ec06effaa430ffd3984f7f087bfe3b.txt` | Public by design (IndexNow needs it public); none |

### tebiq.com, www.tebiq.com, ACEP page (tebiq.com/acep)
| Finding | Severity | Evidence | Fix |
|---|---|---|---|
| PHP not detected; strong transport (A+, HSTS with includeSubDomains, XFO DENY, nosniff, Permissions-Policy) | Info | SSL Labs A+; headers above; probes 404 | none |
| CSP is **Report-Only**, so it does not block anything, and it allows `'unsafe-inline'` scripts | Low–Medium | `content-security-policy-report-only:` header on https://tebiq.com/ | Recommendation (tebIQ repo; touches the PHI app shell): once reports are clean, switch to the enforcing `Content-Security-Policy`; move inline scripts to files or nonces and drop `'unsafe-inline'` |
| DMARC `p=none` | Medium | `_dmarc.tebiq.com` TXT | Recommendation (DNS): move to `p=quarantine`, then `p=reject` after reviewing reports |
| Dangling CNAME `api-dev.tebiq.com` → deleted App Runner service | Low | dns.google: CNAME `mmfv7mkp3g.us-east-2.awsapprunner.com`, target NXDOMAIN | Recommendation (Route 53): delete the record. App Runner names are random, so an attacker can't claim this one, but stale records are what takeover scanners look for |
| CT-logged leftovers `dev.tebiq.com`, `newapp.tebiq.com` | Info | both resolve to live CloudFront (3.168.x); `beta`, `kb`, `api`, `api.app`, `pulsemd` → NXDOMAIN | Inventory `dev`/`newapp` (possibly legacy hosts) in a separate, founder-approved check. The zone may sit in a legacy account: the founder decides who edits it |
| Third-party scripts before consent | Not verified | my fetch tool strips `<script>` tags; the CSP allows `googletagmanager.com` and `fonts.googleapis.com` | Check in the tebIQ repo that gtag loads only after opt-in (same pattern as `tb-consent.js` here) |

### v2.tebiq.com (tebIQ app)
| Finding | Severity | Evidence | Fix |
|---|---|---|---|
| PHP not detected; same transport and headers as tebiq.com | Info | same ALB IPs; headers above | none |
| SPA catch-all returns 200 for `/.env`, `/.git/HEAD`, `/wp-login.php`, `*.php`, `*.sql`, `*.zip` | Low | each of these returned 200 with the app shell (no sensitive content) | Recommendation (tebIQ repo): return a real 404 for dotfiles and `.php`/`.sql`/`.zip`/`.bak` paths so scanners and WAF logs stop treating them as hits |
| CSP Report-Only with `'unsafe-inline'` (this is the PHI app) | Medium | header above | Recommendation only (PHI/auth): enforce the CSP here first |

### tebchart.com
| Finding | Severity | Evidence | Fix |
|---|---|---|---|
| PHP not detected; private S3 origin (403 on every probe, no listing) | Info | probes above; `Server: AmazonS3` | none |
| No HSTS, CSP, X-Frame-Options, nosniff, Referrer-Policy or Permissions-Policy | Low–Medium | hackertarget headers for https://tebchart.com/ | Recommendation (infra): attach a CloudFront response-headers policy (AWS managed `SecurityHeadersPolicy`, plus HSTS and a CSP) to the distribution |
| No SPF, DMARC or MX: anyone can send mail "from" @tebchart.com | Medium | dns.google TXT (none), `_dmarc` NXDOMAIN, MX none | Recommendation (DNS): `v=spf1 -all`; `_dmarc` `v=DMARC1; p=reject;`; null MX `0 .` |
| Missing pages answer with 403 S3 XML instead of 404 | Info | `/nonexistent-probe-404` → 403 `application/xml` | Optional: CloudFront custom error response 403→404 |

### tebdictate.com
| Finding | Severity | Evidence | Fix |
|---|---|---|---|
| PHP not detected; App Runner/envoy behind CloudFront; TLS A | Info | probes 404; `server: envoy`; SSL Labs A | none |
| No HSTS, CSP, X-Frame-Options, nosniff, Referrer-Policy or Permissions-Policy on a page that asks for the microphone | Medium | hackertarget headers for https://tebdictate.com/ | Recommendation (tebDictate repo / CloudFront): add the headers in the app or as a CloudFront response-headers policy, including `Permissions-Policy: microphone=(self)` and `frame-ancestors 'none'` |
| No SPF, DMARC or MX | Medium | as tebchart.com | Recommendation (DNS): same three records |

### tebrounds.com (domain only, no website)
| Finding | Severity | Evidence | Fix |
|---|---|---|---|
| No web host, so PHP, headers and TLS do not apply | Info | dns.google: A none, `www` NXDOMAIN, NS on Route 53 | none |
| No SPF, DMARC or MX: anyone can send mail "from" @tebrounds.com | Medium | dns.google TXT (none), `_dmarc` NXDOMAIN, MX none | Recommendation (DNS): same three records as tebchart.com |

### Lovable landing
Not audited, because the URL could not be found (see the sites table). Send the URL and it can be run through the same passive checks.

## Done on this branch
- `tests/check-publish-safety.mjs` (new) and a line in `DEPLOY.md`: GitHub Pages publishes every committed file, so the check stops the most common AI-scanner wins (`.env`, `.php`, `.sql`, backup archives, keys) from ever being committed. It also blocks any static third-party `<script src>` that would load before consent. It passes on the current tree (90 files, 22 pages).
- `<meta name="referrer" content="strict-origin-when-cross-origin">` on all 22 pages, guarded by `tests/check-referrer.mjs` (also in `DEPLOY.md`).
- `.gitignore` now ignores `.env*`, `*.sql(.gz)`, `*.zip`, `*.tar.gz`, `*.bak`, `*.log`, `*.pem`, `*.key`.

## For the other repos / infra (recommendations only)
1. DNS: fix tebscribe.com SPF and DKIM; add SPF `-all`, DMARC `p=reject` and a null MX to tebchart.com, tebdictate.com and tebrounds.com; move tebiq.com and tebscribe.com DMARC towards `p=reject`; delete `api-dev.tebiq.com`.
2. CloudFront response-headers policy for tebchart.com and tebdictate.com.
3. tebIQ: enforce the CSP (drop `'unsafe-inline'`), return real 404s for scanner paths on v2, confirm gtag is consent-gated.
4. tebscribe.com: a CDN in front of GitHub Pages if HSTS and CSP are wanted; self-host fonts.
