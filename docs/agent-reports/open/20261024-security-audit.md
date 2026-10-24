# Security audit of the public sites — 2026-10-24

**Method (passive only).** Plain GETs of each URL, response headers via the hackertarget header API, TLS grade via SSL Labs (cached or standard scan, results not published), DNS via Google DNS-over-HTTPS (dns.google), and subdomain discovery from Certificate Transparency logs (crt.sh). No fuzzing, no brute force, no logins, no writes. No secrets or tokens are reproduced here; verification tokens are omitted on purpose.

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
| 7 | tebRounds site | https://tebscribe.com/apps/tebrounds.html | page in this repo (`apps/tebrounds.html:8` canonical). **tebrounds.com was not checked:** nothing in the repo points to it |
| 8 | Lovable landing | **NOT FOUND** | no Lovable URL anywhere in this repo, no `*.lovable.app` hit in search, no matching name in the CT logs. Founder to supply the URL |
| 9 | ACEP page | https://tebiq.com/acep | linked from `classic.html:845`; served by the tebiq.com ALB (same headers) |

## Transport and headers (homepage response)
| Site | TLS grade (SSL Labs) | Cert expiry (crt.sh, latest) | HSTS | CSP | X-Frame-Options | Referrer-Policy | Permissions-Policy | Server banner |
|---|---|---|---|---|---|---|---|---|
| tebiq.com, www, /acep | **A+** (both ALB IPs) | 2027-01-16 (Amazon, auto-renew) | `max-age=31536000; includeSubDomains` | **Report-Only** (not enforced), `script-src 'self' 'unsafe-inline' …` | DENY | strict-origin-when-cross-origin | set (mic=self, others off) | none on 200; `awselb/2.0` on redirect |
| v2.tebiq.com | same ALB as tebiq.com (no separate scan: rate-limited) | 2026-12-28 (Amazon, auto-renew) | same as tebiq.com | Report-Only, same | DENY | same | same | none |
| tebscribe.com (+ tebRounds page) | **B** (TLS 1.2/1.3 only; capped by GitHub/Fastly's shared cipher list) | 2026-11-28 (Let's Encrypt, auto-renew by GitHub) | **absent** | **absent** | **absent** | absent (browser default applies) | absent | `GitHub.com` (no version) |
| tebchart.com | **A** (finished CloudFront endpoints; the rest were still queued; A+ needs HSTS) | 2027-01-15 (Amazon, auto-renew) | **absent** | **absent** | **absent** | **absent** | **absent** | `AmazonS3` |
| tebdictate.com | **A** (all 4 finished CloudFront endpoints; A+ needs HSTS) | 2027-01-25 (Amazon, auto-renew) | **absent** | **absent** | **absent** | **absent** | **absent** | `envoy` |

Every host redirects http→https with a 301 (checked tebiq.com, tebscribe.com, tebchart.com, tebdictate.com).

## PHP / exploit-path probes (one GET each)
Paths: `/wp-login.php`, `/xmlrpc.php`, `/phpinfo.php`, `/.env`, `/.git/HEAD`, `/vendor/phpunit/phpunit/src/Util/PHP/eval-stdin.php`, `/server-status`, `/backup.zip`, `/dump.sql` (tebscribe.com also `/wp-admin/` and `/.git/config`).

| Host | Result | Meaning |
|---|---|---|
| tebscribe.com | all **404** | safe; static site, nothing is served outside the repo |
| tebiq.com | all **404** | safe |
| www.tebiq.com | `/.env`, `/.git/HEAD`, `/wp-login.php`, `/phpinfo.php`, `/xmlrpc.php`, `/server-status` → **404** | safe |
| tebchart.com | all **403** (S3 `AccessDenied` XML through CloudFront) | safe; the bucket is private and listing is denied |
| tebdictate.com | all **404** | safe |
| v2.tebiq.com | all **200**, but the body is the tebIQ SPA shell (catch-all route), with no env values, git refs or dumps | not an exposure, but scanners will log it as a hit (soft-404) |

## E-mail authentication and DNS
| Domain | MX | SPF | DMARC | DKIM (`google` selector) |
|---|---|---|---|---|
| tebscribe.com | Google Workspace (aspmx.l.google.com …) | `v=spf1 include:amazonses.com ~all`: **does not list Google** | `p=none` (monitor only) | **not found** |
| tebiq.com | Google (smtp.google.com) | `v=spf1 include:_spf.google.com include:amazonses.com include:spf.mtasv.net ~all` ✓ | `p=none` (monitor only) | not found (may use another selector) |
| tebchart.com | **none** | **none** | **none** (NXDOMAIN) | n/a |
| tebdictate.com | **none** | **none** | **none** (NXDOMAIN) | n/a |

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
| Google Fonts fetched before consent (visitor IP reaches Google) | Low (privacy) | `index.html:145-147`, `apps/tebrounds.html:18-20`, `products-by-dr-c/index.html:30-32`, `tebcapture/index.html:25-27`, `bellody/*`, `free-*/index.html` | Self-host the font files and drop the preconnects (a visual change, so it needs a separate brief) |
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

### Lovable landing
Not audited, because the URL could not be found (see the sites table). Send the URL and it can be run through the same passive checks.

## Done on this branch
- `tests/check-publish-safety.mjs` (new) and a line in `DEPLOY.md`: GitHub Pages publishes every committed file, so the check stops the most common AI-scanner wins (`.env`, `.php`, `.sql`, backup archives, keys) from ever being committed. It also blocks any static third-party `<script src>` that would load before consent. It passes on the current tree (90 files, 22 pages).

## For the other repos / infra (recommendations only)
1. DNS: fix tebscribe.com SPF and DKIM; add SPF `-all`, DMARC `p=reject` and a null MX to tebchart.com and tebdictate.com; move tebiq.com and tebscribe.com DMARC towards `p=reject`; delete `api-dev.tebiq.com`.
2. CloudFront response-headers policy for tebchart.com and tebdictate.com.
3. tebIQ: enforce the CSP (drop `'unsafe-inline'`), return real 404s for scanner paths on v2, confirm gtag is consent-gated.
4. tebscribe.com: a CDN in front of GitHub Pages if HSTS and CSP are wanted; self-host fonts.
