# Passive security audit — tebiq / teb sites (2026-10-24)

STATUS: OPEN. Live passive checks done 2026-10-25 03:40–03:50 UTC; one item per site still UNVERIFIED (noted).

## Method and limits
- Shell network (`curl`/`dig`/`openssl`) was refused by the sandbox, so every live check went through read-only
  third-party GET services or a single plain GET per URL:
  - DNS: Google DNS-over-HTTPS (`https://dns.google/resolve?name=…&type=…`)
  - Subdomains and certificate expiry: Certificate Transparency (`https://crt.sh/?q=%25.<domain>&output=json`)
  - Response headers: `https://api.hackertarget.com/httpheaders/?q=<url>`
  - TLS grade: SSL Labs cached results (`api.ssllabs.com/api/v3/analyze?fromCache=on`)
  - Exploit paths: one GET per host×path
- No fuzzing, no brute force, no auth, no prod DB, no AWS API. No secret values are reproduced here.
- **Not located:** the "Lovable landing page" has no hostname anywhere in this repo, and none of the CT-logged names
  point at Lovable. It needs a URL from the founder. **tebrounds:** `tebrounds.com` is registered (SOA present) but has
  no A record and no certificates in CT logs, so there is no live site to test. The tebRounds page that is live is
  `tebscribe.com/apps/tebrounds.html`, which is covered under tebscribe.com.
- **PHP/CMS:** none of the hosts runs PHP. tebscribe.com = GitHub Pages (`Server: GitHub.com`). tebchart.com = S3
  behind CloudFront (`Server: AmazonS3`). tebdictate.com = envoy (App Runner-style) behind CloudFront. tebiq.com and
  v2.tebiq.com = an SPA behind an AWS ALB (A records 3.132.105.179 / 16.58.208.124). No `X-Powered-By: PHP` was seen
  anywhere. The WordPress/PHPUnit exploit campaigns therefore **do not apply**, and every probe confirmed it (table below).

## Exploit-path probe (status codes)
| Path | tebscribe.com | tebiq.com (+www, /acep) | v2.tebiq.com | tebchart.com | tebdictate.com |
|---|---|---|---|---|---|
| /wp-login.php | 404 | 404 | 200 SPA shell | 403 | 404 |
| /xmlrpc.php | 404 | 404 | 200 SPA shell | 403 | 404 |
| /phpinfo.php | 404 | 404 | 200 SPA shell | 403 | 404 |
| /.env | 404 | 404 | 200 SPA shell | 403 | 404 |
| /.git/HEAD | 404 | 404 | 200 SPA shell | 403 | 404 |
| /vendor/phpunit/…/eval-stdin.php | 404 | 404 | 200 SPA shell | 403 | 404 |
| /server-status | 404 | 404 | 200 SPA shell | 403 | 404 |
| /backup.zip | 404 | 404 | 200 SPA shell | 403 | 404 |
| /backup.sql | 404 | 404 | 200 SPA shell | 403 | 404 |

v2.tebiq.com sends its single-page-app login page for any unknown path. No raw env, git, phpinfo, archive or SQL
content was returned, so this is **not an exposure**. It is listed as Info because scanners will log those 200s as hits.
tebchart.com returns 403 for every missing key, which is what a private S3 origin behind CloudFront should do.

## Site: tebscribe.com / www.tebscribe.com (this repo)
| Finding | Severity | Evidence | Fix |
|---|---|---|---|
| TLS grade B; cert valid to 2027-01-13 | Low | SSL Labs cached: grade B on all 4 GitHub Pages IPs. TLS 1.2/1.3 only, `forwardSecrecy:1` (some non-FS suites), OCSP stapling off. Expiry from crt.sh | Cannot be changed from the repo (GitHub's TLS endpoint). Accept, or front with Cloudflare |
| No HSTS | Medium | hackertarget headers for `https://tebscribe.com/`: no `Strict-Transport-Security`. SSL Labs `hstsPolicy: absent`. `http://` → 301 https works | GitHub Pages cannot set it. Recommendation: Cloudflare proxy with HSTS |
| No CSP, no X-Frame-Options / frame-ancestors, no nosniff, no Permissions-Policy | Medium (clickjacking of a marketing site; no PHI on it) | same header dump: only `Server`, cache and CORS headers | Same proxy recommendation. A meta CSP was **not** added: pages use inline scripts and JSON-LD (would break), and a meta tag cannot set `frame-ancestors` |
| No Referrer-Policy | Low | no referrer meta in any of the 22 pages before this branch | **FIXED on this branch:** `<meta name="referrer" content="strict-origin-when-cross-origin">` on all 22 pages, guarded by `tests/check-referrer.mjs` (added to `DEPLOY.md` checks) |
| Banner `Server: GitHub.com`, `Access-Control-Allow-Origin: *` | Info | header dump | Expected for GitHub Pages. Public static content only |
| Exploit paths | OK | all 404 (table) | none |
| GA4 gated behind consent | OK | `tb-consent.js` loads gtag only after Accept; GPC = decline. `tests/check-consent.mjs`: 22 pages, 0 failing | none |
| Google Fonts load before consent | Low–Medium (visitor IP sent to Google; EU case law) | `fonts.googleapis.com` links in `404.html:20`, `classic.html:81`, `apps/*.html:20`, `free-dictation/index.html:32`, `products-by-dr-c/index.html:32`, `3d/index.html:141` | Self-host the fonts under `/assets/fonts` (visual change, separate lane) |
| `.gitignore` did not block secrets or backups (repo root = public site) | Low | old `.gitignore` had 3 lines. `git ls-files` shows no `.env/.sql/.zip/.bak/.pem/.key/.php` files today | **FIXED on this branch:** `.env`, `.env.*`, `*.sql(.gz)`, `*.zip`, `*.tar.gz`, `*.bak`, `*.pem`, `*.key` added |
| `tebcapture` relay origin `capture.tebdictate.com` does not resolve | Info | `tebcapture/index.html:485`; DoH: NXDOMAIN | Not a takeover risk (our own zone, no CNAME). Create the record before that feature ships |
| SPF | OK | `v=spf1 include:amazonses.com ~all`. MX = Google Workspace | Google sends this domain's mail but `_spf.google.com` is missing from SPF. Add it, consider `-all` |
| DMARC `p=none` | Medium (domain can be spoofed in phishing) | `_dmarc.tebscribe.com`: `v=DMARC1; p=none; pct=100; rua=…; fo=1` | Read the rua reports, then go to `p=quarantine`, then `p=reject` |
| DKIM | UNVERIFIED | `google._domainkey.tebscribe.com` NXDOMAIN. SES selectors are random tokens and cannot be listed passively | Confirm Workspace DKIM is turned on (Admin → Gmail → Authenticate email) |
| Subdomain takeover | OK | `www` → CNAME `tebsinai.github.io` (served, 301 to apex). CT names `api`, `er`, `login`, `notify`, `ideas` → no records (NXDOMAIN/NODATA), so nothing dangles | none |

## Site: tebiq.com / www.tebiq.com / tebiq.com/acep (scripta)
| Finding | Severity | Evidence | Fix (recommendation, scripta repo / infra) |
|---|---|---|---|
| TLS A+; cert valid to 2027-01-16 | OK | SSL Labs cached: A+ on 16.58.208.124 and 3.132.105.179. crt.sh | none |
| HSTS, XFO, nosniff, Referrer-Policy, Permissions-Policy, COOP | OK | headers on `/` and `/acep`: `strict-transport-security: max-age=31536000; includeSubDomains`, `x-frame-options: DENY`, `x-content-type-options: nosniff`, `referrer-policy: strict-origin-when-cross-origin`, `permissions-policy: microphone=(self), camera=() …` | Optional: add `preload` once every subdomain is HTTPS |
| CSP is report-only, so it is **not enforced** | Medium (XSS on an authenticated clinical app has no CSP backstop) | `content-security-policy-report-only: default-src 'self'; script-src 'self' 'unsafe-inline' https://www.googletagmanager.com …` | Review the reports, then switch to enforcing `Content-Security-Policy`. Plan to drop `'unsafe-inline'` (nonces). Auth/PHI-adjacent, so recommendation only |
| No server banner | OK | no `Server` / `X-Powered-By` header | none |
| `www` → 301 → apex | OK | header dump | none |
| Exploit paths | OK | all 404 | none |
| Third-party scripts before consent | UNVERIFIED | CSP allows `googletagmanager.com` and `fonts.googleapis.com`. The fetch tool strips `<script>` tags, so load order could not be seen. "Your Privacy Choices" link on `/` goes to `#` | Check in a fresh browser with consent declined (DevTools → Network). Gate gtag the way `tb-consent.js` does |
| SPF | OK | `v=spf1 include:_spf.google.com include:amazonses.com include:spf.mtasv.net ~all` | consider `-all` |
| DMARC `p=none` | Medium | `_dmarc.tebiq.com`: `v=DMARC1; p=none; rua=…; fo=1` | Move to quarantine, then reject |
| DKIM | UNVERIFIED | `google._domainkey.tebiq.com` NXDOMAIN (MX = Google) | Confirm Workspace/SES/Postmark DKIM is on |
| **Dangling CNAME `api-dev.tebiq.com`** | Medium | DoH: `api-dev.tebiq.com CNAME mmfv7mkp3g.us-east-2.awsapprunner.com`, and that target is **NXDOMAIN** (service deleted) | Delete the CNAME. App Runner names are random, so takeover is unlikely, but a dangling record is exactly what automated takeover scanners look for. **The zone may live in a legacy account: the founder decides who edits it. Do not touch tebiq-dev/tebiq-prod from a lane** |
| CT-logged leftovers | Info | `api`, `api.app`, `pulsemd`, `beta`, `kb` → NXDOMAIN. `newdev`, `api-newdev` → no A record. `dev`, `newapp` → CloudFront IPs (3.168.x), live but out of scope here | Inventory `dev`/`newapp` (possibly legacy hosts) in a separate, founder-approved check |

## Site: v2.tebiq.com (scripta)
| Finding | Severity | Evidence | Fix |
|---|---|---|---|
| TLS | OK (shared endpoint) | same IPs as tebiq.com (A+). Own cert valid to 2026-12-28 (crt.sh). The host-specific SSL Labs call was rate-limited (429) | Re-check the grade after 2026-12-28 to confirm the cert auto-renewed |
| HSTS / XFO / nosniff / referrer / permissions / no banner | OK | identical header set to tebiq.com | none |
| CSP report-only | Medium | same as tebiq.com | same |
| SPA returns 200 shell for every unknown path | Info | exploit table | Optional: return 404 for unknown non-route paths so scanners stop flagging it |

## Site: tebchart.com / www.tebchart.com (S3 + CloudFront)
| Finding | Severity | Evidence | Fix (tebchart repo / CloudFront) |
|---|---|---|---|
| TLS grade | UNVERIFIED | SSL Labs scan was still at "Resolving domain names" during this run. Cert valid to 2027-01-15 (crt.sh) | Re-run `ssllabs.com/ssltest/analyze.html?d=tebchart.com` |
| No HSTS, CSP, X-Frame-Options, nosniff, Referrer-Policy or Permissions-Policy | Medium | headers for `https://tebchart.com/` and `www`: none of these present. `http://` → 301 https works | Attach a CloudFront **Response Headers Policy** (managed `SecurityHeadersPolicy` or custom) to the distribution. One change, no app code |
| Banner `Server: AmazonS3` | Low | header dump | The Response Headers Policy can remove or override `Server` |
| S3 listing / open origin | OK (as far as passively visible) | every probed missing path → 403, which looks like an OAC/private bucket. Path-style `s3.amazonaws.com/tebchart.com/` → 404 (no public bucket by that name) | Confirm OAC plus Block Public Access in the console (read-only) |
| No SPF and no DMARC (domain sends no mail: no MX) | Medium (anyone can send mail "from" tebchart.com) | DoH: no TXT at apex; `_dmarc.tebchart.com` NXDOMAIN | Publish `v=spf1 -all` and `_dmarc` `v=DMARC1; p=reject;`, plus optionally a null MX (`0 .`) |
| Takeover | OK | apex and `www` → live CloudFront | none |

## Site: tebdictate.com / www.tebdictate.com (envoy + CloudFront)
| Finding | Severity | Evidence | Fix (tebdictate repo / CloudFront) |
|---|---|---|---|
| TLS grade | UNVERIFIED | SSL Labs scan not finished during this run. Cert valid to 2027-01-25 (crt.sh) | Re-run SSL Labs |
| No HSTS, CSP, X-Frame-Options, nosniff, Referrer-Policy or Permissions-Policy | Medium (an in-browser dictation page that can be framed, so the microphone prompt could be clickjacked) | headers for `https://tebdictate.com/`: only cache headers, `server: envoy`, `x-envoy-upstream-service-time` | CloudFront Response Headers Policy, or set the headers in the app. Include `frame-ancestors 'none'` and `Permissions-Policy: microphone=(self)` |
| Banner `server: envoy`, `x-envoy-upstream-service-time` | Low | header dump | Strip them in the Response Headers Policy |
| No SPF and no DMARC (no MX) | Medium | no TXT at apex; `_dmarc.tebdictate.com` NXDOMAIN | `v=spf1 -all`, `v=DMARC1; p=reject;`, null MX |
| Exploit paths | OK | all 404 | none |

## Recommendations per owning repo (none applied here)
- **scripta (tebiq.com, v2.tebiq.com):** enforce CSP (now report-only). Verify gtag waits for consent. DMARC → quarantine/reject. Confirm DKIM.
- **DNS owner for tebiq.com (founder decides; may be a legacy account):** delete dangling `api-dev.tebiq.com` CNAME. Inventory `dev.tebiq.com` and `newapp.tebiq.com`.
- **tebchart site / CloudFront:** Response Headers Policy (HSTS, CSP, XFO, nosniff, referrer, permissions, strip `Server`). Confirm OAC. SPF `-all` + DMARC reject.
- **tebdictate site / CloudFront:** same headers policy, with microphone-aware Permissions-Policy and frame-ancestors. Strip envoy headers. SPF `-all` + DMARC reject.
- **tebscribe-site (this repo):** done on branch: referrer meta + `.gitignore`. Remaining: self-host fonts; HSTS/CSP/XFO need a header-capable proxy (Cloudflare) in front of GitHub Pages. Add `_spf.google.com` to SPF. DMARC → quarantine.
- **Founder:** give the Lovable landing page URL (not found anywhere) so it can be checked.
