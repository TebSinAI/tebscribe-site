# Passive security audit — tebiq / teb sites (2026-10-24)

STATUS: OPEN — PARTIAL. Repo-side audit done; live black-box probes NOT run.

## Limit of this audit (read first)
This builder session could not make any outbound network call: `curl`, `openssl s_client` and `dig` were all refused
by the sandbox permission layer ("requires approval"), and no approver was available. So **no live evidence exists**
for TLS expiry, response headers, banner leaks, exploit-path status codes, S3/CloudFront, DNS/CNAME takeover or
SPF/DKIM/DMARC. Those rows are marked UNVERIFIED below — they are not "clean". Re-run them with the script at the end
from a session that is allowed network access (passive GET/HEAD only).

## Site: tebscribe.com (this repo) — what the repo proves
Stack evidence: GitHub Pages static site (`CNAME` = tebscribe.com; `DEPLOY.md:3` "Static site on GitHub Pages").
`git ls-files` has zero `.php/.env/.sql/.zip/.bak/.log/.pem/.key` files. So PHP/CMS exploit paths
(`/wp-login.php`, `/xmlrpc.php`, `/phpinfo.php`, `/vendor/phpunit`) **do not apply**: there is no PHP runtime on GitHub Pages
and no such files in the tree. `/.env`, `/.git/HEAD`, `/server-status`, backups: not in the published tree; live 404 UNVERIFIED.

| Finding | Severity | Evidence | Fix |
|---|---|---|---|
| No `Referrer-Policy` on any page (GitHub Pages cannot set headers) | Low | no `referrer` meta in any of 22 pages before this change | **FIXED on this branch**: `<meta name="referrer" content="strict-origin-when-cross-origin">` in all 22 pages; guarded by `tests/check-referrer.mjs` |
| Response headers (HSTS, CSP, X-Frame-Options, Permissions-Policy, X-Content-Type-Options) not controllable from repo; GitHub Pages sends no CSP/XFO | Medium (clickjacking, no CSP) | static host; no `_headers` file in repo | Recommendation: put Cloudflare (or similar) in front and set headers there; meta CSP deliberately NOT added — pages use inline scripts/JSON-LD and `/3d/` code, a meta CSP would risk breaking the site and cannot do `frame-ancestors` |
| Google Fonts loaded on page load, before any consent choice | Low–Medium (visitor IP sent to Google; EU rulings) | `<link href="https://fonts.googleapis.com/css2…">` in `404.html:20`, `classic.html:81`, `apps/*.html:20`, `free-dictation/index.html:32`, `products-by-dr-c/index.html:32`, `3d/index.html:141` | Self-host Inter/JetBrains Mono under `/assets/fonts` and drop the preconnects. Not done here: changes visual loading, out of scope for a header fix |
| GA4 consent gating | OK | `tb-consent.js:1-12,69` loads gtag only after Accept, GPC = decline; `tests/check-consent.mjs` (22 pages, 0 failing) forbids static gtag | none |
| `.gitignore` covers only `.DS_Store`, `.gstack/`, `.dispatch/` | Low | `.gitignore` | Add `.env*`, `*.sql`, `*.zip`, `*.bak`, `*.log`, `*.pem`, `*.key` as a guard (not done: kept diff to the header fix) |
| Third-party scripts before consent | None found | grep for googletagmanager/cdn/unpkg/jsdelivr/iframe/hotjar/clarity in non-`_research` files: only `tb-consent.js:69` (post-consent) | none |
| IndexNow key file public | Info | `95ec06ef….txt`, intended by `DEPLOY.md` | none (not a secret) |

Live rows, all UNVERIFIED for tebscribe.com / www.tebscribe.com: TLS grade/expiry, HSTS, server banner, exploit-path
status codes, DNS, SPF/DKIM/DMARC. (GitHub Pages normally serves a valid managed cert and `Server: GitHub.com`; expected, not confirmed.)

## Other hosts — all UNVERIFIED (no network)
tebiq.com, www.tebiq.com, v2.tebiq.com, tebchart.com, tebdictate.com, tebrounds site, Lovable landing page, acep page.
For each, every column (TLS, HSTS, CSP, XFO, referrer, permissions, banner, 8 exploit-path status codes, S3/CloudFront,
CNAME takeover, SPF/DKIM/DMARC) is UNVERIFIED. Do not read this as clean. "No PHP" is not claimed for the Lovable or
other stacks — no evidence available here.

## Recommendations per owning repo (to verify live first)
- **scripta (tebiq.com / v2.tebiq.com / API):** confirm HSTS, CSP, XFO/frame-ancestors, nosniff, Permissions-Policy at the ALB/CloudFront or app; check S3 buckets block public listing and CloudFront origin is OAC-only. Infra = recommendation only.
- **tebscribe-site (this repo):** self-host fonts; extend `.gitignore`; front with a header-capable proxy.
- **tebchart / tebdictate / tebrounds / Lovable landing:** check each repo's host for header support; Lovable hosting limits header control — use a proxy.
- **DNS (all zones):** list CNAMEs, flag any pointing at unclaimed GitHub Pages / S3 / CloudFront / Lovable targets; publish SPF, DKIM, DMARC (`p=quarantine` or stricter) on every sending domain.

## Passive re-run script (HEAD/GET only, no fuzzing)
For each host: `curl -sSI https://HOST/` (headers); `echo | openssl s_client -servername HOST -connect HOST:443 | openssl x509 -noout -enddate`;
`curl -s -o /dev/null -w '%{http_code}' https://HOST/PATH` for PATH in `/wp-login.php /xmlrpc.php /phpinfo.php /.env /.git/HEAD /vendor/phpunit/ /server-status /backup.zip /backup.sql`;
`dig +short CNAME HOST`; `dig +short TXT DOMAIN`, `dig +short TXT _dmarc.DOMAIN`, `dig +short TXT default._domainkey.DOMAIN`.
Any 200 on those paths = finding.
