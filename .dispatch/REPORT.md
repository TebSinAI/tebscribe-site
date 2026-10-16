# REPORT it/consent-gate-tebscribe
- Status: PARTIAL
- Summary: Google Analytics no longer loads on any tebscribe.com page until the visitor clicks Accept in a small bottom banner; visitors sending Global Privacy Control are treated as declined with no banner, and every page has a "Your Privacy Choices" link that reopens the choice. The site also gains /llms.txt, a FAQ block with FAQPage markup on the home page, and an IndexNow key file. Not done: no real-browser run and no screenshots (the sandbox refused to launch Chrome or Quick Look), and the LinkedIn/X links could not be checked.
- Commits pushed: by dispatcher
- What changed:
  - New `tb-consent.js` (Consent Mode v2 defaults denied, banner, GPC silent decline, `window.tbConsent.open()`); the inline gtag block on all 6 pages that had it is replaced by `<script defer src="/tb-consent.js" data-ga="G-1XZK7XBL67">`, and the 4 pages that had no tag (404, bellody privacy/support, tebcapture) also get the include so the footer link works. Footer "Your Privacy Choices" link on all 10 pages.
  - `tb-beacon.js` v1.1 exits on `navigator.globalPrivacyControl === true`.
  - New `llms.txt`; `index.html` and `3d/index.html` get a 7-question FAQ (inside the existing "About this page" SEO section) with matching FAQPage JSON-LD; `sitemap.xml` lists the 6 public pages with lastmod 2026-10-16 (adds /tebcapture/; /3d/ stays out because it is noindex).
  - IndexNow key file `95ec06effaa430ffd3984f7f087bfe3b.txt` and `DEPLOY.md` with the "After deploy" ping command (not run).
  - `tests/check-consent.mjs`, `tests/check-jsonld.mjs`.
- Tests run:
  - `node --check tb-consent.js && node --check tb-beacon.js` -> exit 0
  - `node tests/check-consent.mjs` -> exit 0 (10 pages checked, 0 failing)
  - `node tests/check-jsonld.mjs` -> exit 0 (8 JSON-LD blocks, 0 invalid)
  - Node DOM-stub simulation of tb-consent.js (not committed): fresh visit = banner, 0 GTM script injections; Accept = 1 injection; Decline = 0; returning accepted = 1 and no banner; returning declined = 0; GPC (fresh or with an old accept) = no banner, 0 injections, stores `analytics:false`. Consent Mode defaults are the first dataLayer push in every case. This is a stub, not a real browser, so "no request to googletagmanager.com" is confirmed by script injection only.
- Not done / risks:
  - No real headless-browser run: sandbox blocked launching Chrome, curl and qlmanage.
  - LinkedIn/X `sameAs` NOT added: `https://www.linkedin.com/company/tebscribe` and `https://x.com/tebiq` could not be curled (sandbox blocked it). Add after checking they resolve.
  - llms.txt "Pricing" and "Security" both point to `https://tebiq.com` because I could not verify deeper URLs; swap in the real pages if they exist.
  - FAQ: the home page had no FAQ, so I added a visible `<details>` block to the existing "About this page" SEO section; answers reuse the wording from `products.html`'s FAQ (one sentence about download buttons dropped) plus two answers built from existing page text. Please eyeball placement on the 3D page.
  - Existing copy on bellody pages says "No account, no ads, no tracking" while the site now (with consent) runs GA; left unchanged per brief, flag for the founder.
  - The stale comment above the include in index.html/3d/classic/products still describes the old tag; harmless.
  - Banner has English strings only (the i18n hook exposes `J3D_LANG`; strings are in one object `T` at the top of tb-consent.js ready for translations).
  - Privacy-policy sentences owed (for tebiq.com/privacy; I wrote none): (1) tebscribe.com loads Google Analytics only after you click Accept, and not at all if your browser sends Global Privacy Control; (2) you can change your choice any time via "Your Privacy Choices" in the footer, stored in your browser's local storage under `tb_consent`; (3) tebscribe.com also sends a first-party page-view beacon that uses no cookies or storage and is skipped for Do Not Track / Global Privacy Control. The current policy promises "no third-party analytics" so it needs updating before this lands.
- UI preview: MISSING: sandbox refused to launch Chrome or Quick Look, so no PNG could be produced. Static mockups of the banner (light, dark, 375 px phone) are at `.dispatch/ui/_tools/mock-light.html`, `mock-dark.html`, `mock-phone.html` — open them in a browser.
- Files touched: index.html, 3d/index.html, classic.html, products.html, 404.html, bellody/index.html, bellody/classic.html, bellody/privacy/index.html, bellody/support/index.html, tebcapture/index.html, tb-consent.js (new), tb-beacon.js, llms.txt (new), 95ec06effaa430ffd3984f7f087bfe3b.txt (new), sitemap.xml, DEPLOY.md (new), tests/check-consent.mjs (new), tests/check-jsonld.mjs (new)

## Out of scope
- `tests/edit-pages.py` and `tests/edit-faq.py`: one-off edit scripts I used; I could not delete them (rm needs approval). Please trash them before landing.
- Scratch files and two local http servers (ports 8765/8766) were used outside the worktree under the DockDrive tmp folder; the servers may still be running.

parked on it/consent-gate-tebscribe — lands with the nightly train
