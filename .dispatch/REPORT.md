# REPORT it/consent-gate-tebscribe
- Status: DONE
- Summary: Google Analytics no longer loads on any tebscribe.com page until the visitor clicks Accept in a small bottom banner. Visitors whose browser sends Global Privacy Control are treated as having declined, with no banner, and every page has a "Your Privacy Choices" footer link that reopens the choice. This was checked in real headless Chrome on all 10 pages. The site also gets /llms.txt, a FAQ with matching FAQ markup on the home page, and an IndexNow key file. Before this lands, the tebiq.com privacy policy needs the three sentences listed below, because it currently says "no third-party analytics".
- Commits pushed: by dispatcher
- What changed:
  - Reviewed the previous worker's `tb-consent.js` and kept its logic. I fixed the banner colours so they follow the light/dark theme on the tebCapture and Bellody pages (it used to stay white in dark mode there). On phones the banner now sits above the pinned "Get started" bar instead of covering it, and it respects the safe area at the bottom of the screen.
  - The inline gtag block is gone from all 10 HTML pages, replaced by one `tb-consent.js` include plus the footer link. The GA comment in index/3d/classic/products now says GA loads only after consent.
  - llms.txt: Pricing, Security and Support now point to the real pages tebiq.com/pricing, /security and /support (each checked: 200 with its own page title). Bellody support is a separate line.
  - sitemap.xml: removed `/tebcapture/` because that page is noindex. It now lists the 5 indexable pages, all with lastmod 2026-10-16. robots.txt is unchanged.
  - Moved the previous worker's leftover one-off scripts (`tests/edit-faq.py`, `tests/edit-pages.py`) to `$DD/.trash/2026-10-16-consent-gate-edit-scripts/`.
- Tests run:
  - `node --check tb-consent.js && node --check tb-beacon.js` -> exit 0
  - `node tests/check-consent.mjs` -> exit 0 (10 pages checked, 0 failing)
  - `node tests/check-jsonld.mjs` -> exit 0 (8 JSON-LD blocks, 0 invalid)
  - Headless Chrome via `node .dispatch/ui/_tools/cdp-check.mjs` -> exit 0, 49/49 PASS. On each of the 10 pages: banner shown, 0 googletagmanager requests before Accept, exactly 1 `gtag/js` request after it. Also passed: returning visitor who accepted (no banner, GA loads); Decline (0 requests, and still 0 on reload); footer link reopens the banner; stored value is `{"analytics":false,"decidedAt":…,"version":1}`; the first dataLayer push is the Consent Mode v2 default with all four signals denied; GPC visitor gets no banner, 0 requests and `analytics:false` stored; on a 375 px phone the banner has 16 px gutters, stays above the Get started bar and the page does not scroll sideways. GA requests were intercepted locally, so no real hit reached Google.
- Not done / risks:
  - `sameAs` was NOT extended. `https://www.linkedin.com/company/tebscribe` returns 404. `https://x.com/tebiq` resolves, but the account belongs to an unrelated person ("phylisa sagi (@tebiq)"), so it must not be linked. Give me the real profile URLs if they exist.
  - IndexNow key file: `/95ec06effaa430ffd3984f7f087bfe3b.txt`. The ping command is in DEPLOY.md under "After deploy" and has not been run.
  - Banner text is English only. The strings are in object `T` at the top of `tb-consent.js`, and the script already picks a language from `window.J3D_LANG` or `<html lang>` once translations are added.
  - Copy on the Bellody pages says "no tracking" while the site now runs GA with consent. Left as is (copy is out of scope); please review.
  - Privacy-policy sentences owed for tebiq.com/privacy (I wrote none of the policy):
    1. "tebscribe.com loads Google Analytics only after you click Accept, and never if your browser sends Global Privacy Control."
    2. "You can change your choice any time with 'Your Privacy Choices' in the footer; the choice is kept in your browser's local storage (`tb_consent`)."
    3. "tebscribe.com also counts page views with a first-party beacon that sets no cookies, uses no storage, and is skipped when Do Not Track or Global Privacy Control is on."
  - Nothing I needed was unreachable.
- UI preview: .dispatch/ui/consent-dark.png (home page, desktop) · .dispatch/ui/consent-light.png (tebCapture, light scheme) · .dispatch/ui/consent-phone.png (home page, 375 px, above the Get started bar)
- Files touched: tb-consent.js, index.html, 3d/index.html, classic.html, products.html, llms.txt, sitemap.xml, tests/edit-faq.py and tests/edit-pages.py (moved to trash). Earlier run, kept: 404.html, bellody/index.html, bellody/classic.html, bellody/privacy/index.html, bellody/support/index.html, tebcapture/index.html, tb-beacon.js, 95ec06effaa430ffd3984f7f087bfe3b.txt, DEPLOY.md, tests/check-consent.mjs, tests/check-jsonld.mjs

## Out of scope
- `.dispatch/REPORT.md` was committed by the previous run's dispatcher commit; this is a fresh copy of it.

parked on it/consent-gate-tebscribe — lands with the nightly train
