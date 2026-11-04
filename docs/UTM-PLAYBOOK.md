# UTM playbook for tebscribe.com and the product sites

Written 2026-11-04. Everything here was checked against the code in this repo and in `scripta/` (paths are given so you can re-check). Where something was not verified, it says so.

## 1. Naming convention

Five parameters. Lower-case only, letters, digits, `_` and `-` only, no spaces. The first three are measured everywhere; the last two only in Google Analytics.

| Parameter | Meaning | Rule | Examples |
|---|---|---|---|
| `utm_source` | who sent the click | one short name per platform | `linkedin`, `facebook`, `instagram`, `tiktok`, `youtube`, `x`, `email`, `qr`, `acep` |
| `utm_medium` | the kind of channel | one of `social`, `video`, `email`, `print`, `event`, `referral`; links we place on our own pages use the placement instead: `globe`, `nav`, `hero`, `card`, `cta`, `faq`, `footer`, `body` | `social` |
| `utm_campaign` | the push or the page slug | at most 32 characters; `always_on` for evergreen posts; a short dated name for a time-boxed push (`acep26`, `launch_android`) | `acep26` |
| `utm_content` | which creative or which product | free text; for our own outbound links it is the product (`tebiq`, `tebchart`, `tebdictate`, `img`, `tebrounds`, `tebintake`, `tebcapture`, `bellody`, `tools`) | `post`, `video_desc` |
| `utm_term` | paid keyword | leave out unless a paid search campaign runs | |

Hard limits that come from the private collector (`scripta/tebdictate/analytics/schema.py`):

- `^[a-z0-9_-]{1,32}$` is the only accepted shape (`schema.py` line 152; `tb-beacon.js` applies the same test first). Uppercase is lower-cased; a value with a space or dot, or over 32 characters, is dropped by the beacon and the visit is recorded with no campaign.
- Each of source, medium and campaign allows at most 50 distinct values per day (`CAPS`, line 122 onward, and `_DailyDistinctCap`, line 318 onward). The 51st new value of the day is stored as `other` (the cap is per collector process, so the real ceiling can be a little higher). So never put a post id, a date-time or a person's name in `utm_campaign`; put those in `utm_content`.
- Do not tag links from one tebscribe.com page to another tebscribe.com page. In Google Analytics a UTM on an internal link starts a new session and overwrites the real source. Internal links stay plain; that is why the globe's internal links carry no UTMs.

Links tebscribe.com places on its own pages (already done in this repo, enforced by `tests/check-seo.mjs`) follow `utm_source=tebscribe&utm_medium=<placement>&utm_campaign=<page slug>&utm_content=<product>`. Page slugs: `home`, `home_globe`, `products`, `apps`, `apps_by_dr_c`, `img`, `free_dictation`, `free_medical_tools`, `app_<name>` for `/apps/<name>.html`. The shared menu's "Try tebIQ" button builds the same link at run time (`tb-nav.js`, `utmSlug`). App Store and Google Play links cannot carry UTMs and are left plain; see section 5.

## 2. Ready-to-paste links

Default campaign is `always_on` (ACEP row: `acep26`). Replace `utm_campaign` for a time-boxed push. Change `utm_content` to tell two posts apart (it shows in Google Analytics only). Every value below was checked against the shape rule.

#### tebscribe.com home

| Channel | Link |
|---|---|
| LinkedIn | `https://tebscribe.com/?utm_source=linkedin&utm_medium=social&utm_campaign=always_on&utm_content=post` |
| Facebook | `https://tebscribe.com/?utm_source=facebook&utm_medium=social&utm_campaign=always_on&utm_content=post` |
| Instagram (bio link) | `https://tebscribe.com/?utm_source=instagram&utm_medium=social&utm_campaign=always_on&utm_content=bio` |
| TikTok (bio link) | `https://tebscribe.com/?utm_source=tiktok&utm_medium=social&utm_campaign=always_on&utm_content=bio` |
| YouTube (video description) | `https://tebscribe.com/?utm_source=youtube&utm_medium=video&utm_campaign=always_on&utm_content=video_desc` |
| X | `https://tebscribe.com/?utm_source=x&utm_medium=social&utm_campaign=always_on&utm_content=post` |
| Email / newsletter | `https://tebscribe.com/?utm_source=email&utm_medium=email&utm_campaign=always_on&utm_content=newsletter` |
| QR code on print (poster, badge, card) | `https://tebscribe.com/?utm_source=qr&utm_medium=print&utm_campaign=always_on&utm_content=poster` |
| Conference (ACEP-style booth, slide, badge) | `https://tebscribe.com/?utm_source=acep&utm_medium=event&utm_campaign=acep26&utm_content=booth_qr` |

#### IMG roadmap

| Channel | Link |
|---|---|
| LinkedIn | `https://tebscribe.com/IMG/?utm_source=linkedin&utm_medium=social&utm_campaign=always_on&utm_content=post` |
| Facebook | `https://tebscribe.com/IMG/?utm_source=facebook&utm_medium=social&utm_campaign=always_on&utm_content=post` |
| Instagram (bio link) | `https://tebscribe.com/IMG/?utm_source=instagram&utm_medium=social&utm_campaign=always_on&utm_content=bio` |
| TikTok (bio link) | `https://tebscribe.com/IMG/?utm_source=tiktok&utm_medium=social&utm_campaign=always_on&utm_content=bio` |
| YouTube (video description) | `https://tebscribe.com/IMG/?utm_source=youtube&utm_medium=video&utm_campaign=always_on&utm_content=video_desc` |
| X | `https://tebscribe.com/IMG/?utm_source=x&utm_medium=social&utm_campaign=always_on&utm_content=post` |
| Email / newsletter | `https://tebscribe.com/IMG/?utm_source=email&utm_medium=email&utm_campaign=always_on&utm_content=newsletter` |
| QR code on print (poster, badge, card) | `https://tebscribe.com/IMG/?utm_source=qr&utm_medium=print&utm_campaign=always_on&utm_content=poster` |
| Conference (ACEP-style booth, slide, badge) | `https://tebscribe.com/IMG/?utm_source=acep&utm_medium=event&utm_campaign=acep26&utm_content=booth_qr` |

#### Free dictation page

| Channel | Link |
|---|---|
| LinkedIn | `https://tebscribe.com/free-dictation/?utm_source=linkedin&utm_medium=social&utm_campaign=always_on&utm_content=post` |
| Facebook | `https://tebscribe.com/free-dictation/?utm_source=facebook&utm_medium=social&utm_campaign=always_on&utm_content=post` |
| Instagram (bio link) | `https://tebscribe.com/free-dictation/?utm_source=instagram&utm_medium=social&utm_campaign=always_on&utm_content=bio` |
| TikTok (bio link) | `https://tebscribe.com/free-dictation/?utm_source=tiktok&utm_medium=social&utm_campaign=always_on&utm_content=bio` |
| YouTube (video description) | `https://tebscribe.com/free-dictation/?utm_source=youtube&utm_medium=video&utm_campaign=always_on&utm_content=video_desc` |
| X | `https://tebscribe.com/free-dictation/?utm_source=x&utm_medium=social&utm_campaign=always_on&utm_content=post` |
| Email / newsletter | `https://tebscribe.com/free-dictation/?utm_source=email&utm_medium=email&utm_campaign=always_on&utm_content=newsletter` |
| QR code on print (poster, badge, card) | `https://tebscribe.com/free-dictation/?utm_source=qr&utm_medium=print&utm_campaign=always_on&utm_content=poster` |
| Conference (ACEP-style booth, slide, badge) | `https://tebscribe.com/free-dictation/?utm_source=acep&utm_medium=event&utm_campaign=acep26&utm_content=booth_qr` |

#### Free medical tools

| Channel | Link |
|---|---|
| LinkedIn | `https://tebscribe.com/free-medical-tools/?utm_source=linkedin&utm_medium=social&utm_campaign=always_on&utm_content=post` |
| Facebook | `https://tebscribe.com/free-medical-tools/?utm_source=facebook&utm_medium=social&utm_campaign=always_on&utm_content=post` |
| Instagram (bio link) | `https://tebscribe.com/free-medical-tools/?utm_source=instagram&utm_medium=social&utm_campaign=always_on&utm_content=bio` |
| TikTok (bio link) | `https://tebscribe.com/free-medical-tools/?utm_source=tiktok&utm_medium=social&utm_campaign=always_on&utm_content=bio` |
| YouTube (video description) | `https://tebscribe.com/free-medical-tools/?utm_source=youtube&utm_medium=video&utm_campaign=always_on&utm_content=video_desc` |
| X | `https://tebscribe.com/free-medical-tools/?utm_source=x&utm_medium=social&utm_campaign=always_on&utm_content=post` |
| Email / newsletter | `https://tebscribe.com/free-medical-tools/?utm_source=email&utm_medium=email&utm_campaign=always_on&utm_content=newsletter` |
| QR code on print (poster, badge, card) | `https://tebscribe.com/free-medical-tools/?utm_source=qr&utm_medium=print&utm_campaign=always_on&utm_content=poster` |
| Conference (ACEP-style booth, slide, badge) | `https://tebscribe.com/free-medical-tools/?utm_source=acep&utm_medium=event&utm_campaign=acep26&utm_content=booth_qr` |

#### tebIQ

| Channel | Link |
|---|---|
| LinkedIn | `https://tebiq.com/?utm_source=linkedin&utm_medium=social&utm_campaign=always_on&utm_content=post` |
| Facebook | `https://tebiq.com/?utm_source=facebook&utm_medium=social&utm_campaign=always_on&utm_content=post` |
| Instagram (bio link) | `https://tebiq.com/?utm_source=instagram&utm_medium=social&utm_campaign=always_on&utm_content=bio` |
| TikTok (bio link) | `https://tebiq.com/?utm_source=tiktok&utm_medium=social&utm_campaign=always_on&utm_content=bio` |
| YouTube (video description) | `https://tebiq.com/?utm_source=youtube&utm_medium=video&utm_campaign=always_on&utm_content=video_desc` |
| X | `https://tebiq.com/?utm_source=x&utm_medium=social&utm_campaign=always_on&utm_content=post` |
| Email / newsletter | `https://tebiq.com/?utm_source=email&utm_medium=email&utm_campaign=always_on&utm_content=newsletter` |
| QR code on print (poster, badge, card) | `https://tebiq.com/?utm_source=qr&utm_medium=print&utm_campaign=always_on&utm_content=poster` |
| Conference (ACEP-style booth, slide, badge) | `https://tebiq.com/?utm_source=acep&utm_medium=event&utm_campaign=acep26&utm_content=booth_qr` |

#### tebChart

| Channel | Link |
|---|---|
| LinkedIn | `https://tebchart.com/?utm_source=linkedin&utm_medium=social&utm_campaign=always_on&utm_content=post` |
| Facebook | `https://tebchart.com/?utm_source=facebook&utm_medium=social&utm_campaign=always_on&utm_content=post` |
| Instagram (bio link) | `https://tebchart.com/?utm_source=instagram&utm_medium=social&utm_campaign=always_on&utm_content=bio` |
| TikTok (bio link) | `https://tebchart.com/?utm_source=tiktok&utm_medium=social&utm_campaign=always_on&utm_content=bio` |
| YouTube (video description) | `https://tebchart.com/?utm_source=youtube&utm_medium=video&utm_campaign=always_on&utm_content=video_desc` |
| X | `https://tebchart.com/?utm_source=x&utm_medium=social&utm_campaign=always_on&utm_content=post` |
| Email / newsletter | `https://tebchart.com/?utm_source=email&utm_medium=email&utm_campaign=always_on&utm_content=newsletter` |
| QR code on print (poster, badge, card) | `https://tebchart.com/?utm_source=qr&utm_medium=print&utm_campaign=always_on&utm_content=poster` |
| Conference (ACEP-style booth, slide, badge) | `https://tebchart.com/?utm_source=acep&utm_medium=event&utm_campaign=acep26&utm_content=booth_qr` |

#### tebDictate

| Channel | Link |
|---|---|
| LinkedIn | `https://tebdictate.com/?utm_source=linkedin&utm_medium=social&utm_campaign=always_on&utm_content=post` |
| Facebook | `https://tebdictate.com/?utm_source=facebook&utm_medium=social&utm_campaign=always_on&utm_content=post` |
| Instagram (bio link) | `https://tebdictate.com/?utm_source=instagram&utm_medium=social&utm_campaign=always_on&utm_content=bio` |
| TikTok (bio link) | `https://tebdictate.com/?utm_source=tiktok&utm_medium=social&utm_campaign=always_on&utm_content=bio` |
| YouTube (video description) | `https://tebdictate.com/?utm_source=youtube&utm_medium=video&utm_campaign=always_on&utm_content=video_desc` |
| X | `https://tebdictate.com/?utm_source=x&utm_medium=social&utm_campaign=always_on&utm_content=post` |
| Email / newsletter | `https://tebdictate.com/?utm_source=email&utm_medium=email&utm_campaign=always_on&utm_content=newsletter` |
| QR code on print (poster, badge, card) | `https://tebdictate.com/?utm_source=qr&utm_medium=print&utm_campaign=always_on&utm_content=poster` |
| Conference (ACEP-style booth, slide, badge) | `https://tebdictate.com/?utm_source=acep&utm_medium=event&utm_campaign=acep26&utm_content=booth_qr` |

Instagram and TikTok do not make links in captions clickable: put the link in the bio. YouTube: put it in the description and the pinned comment. For a printed QR code, generate the QR from the full link (a short domain redirect would hide it) and keep `utm_source=qr`; per-poster variants go in `utm_content` (`poster_er_lounge`).

## 3. Where each kind of traffic shows up

| Landing on | What records the visit | Where you read it | UTM fields kept |
|---|---|---|---|
| tebscribe.com, visitor clicked Accept | Google Analytics 4, property `G-1XZK7XBL67`, loaded by `tb-consent.js` only after Accept and never when Global Privacy Control is on | GA4 > Reports > Acquisition > Traffic acquisition. Set the dimension to Session campaign (or Session source / medium). `utm_content` and `utm_term` appear as "Session manual ad content" and "Session manual term" when you add them as a secondary dimension or in Explore. | all five |
| tebscribe.com, any visitor without Do Not Track or Global Privacy Control (no consent needed, no cookies) | the first-party beacon `tb-beacon.js`, property `tebscribe`, sent to `https://tebchart.com/v1/collect` | the private analytics dashboard fed by that collector; campaign queries read the raw events, which are kept about 30 days (`store.py` line 101, `read.py` `page_opens`) | source, medium, campaign only |
| tebiq.com | scripta's first-party server middleware, which maps `utm_source`, `utm_medium`, `utm_campaign` to the same three fields (`scripta/app/analytics/buckets.py` line 138, `middleware.py` line 90). It also accepts `?src=<token>` when there is no `utm_source` (for printed QR codes, as on `/acep?src=qr`). | same private dashboard | source, medium, campaign |
| tebchart.com and tebdictate.com static pages | CloudFront logs, per `RUNBOOK.md` section 4. That path never reads the query string, so campaign fields are stored blank (`scripta/tebdictate/analytics/cf_logs.py` lines 18 and 176). | the same dashboard shows the visit and a referrer bucket (`tebscribe.com`, `linkedin.com` and so on) but not the campaign | none |
| App Store / Google Play | not linked to a web UTM | App Store Connect > App Analytics; Play Console > Acquisition | see section 5 |

So: a LinkedIn post that points at tebscribe.com is fully measured (GA4 for consenting visitors, the beacon for everyone else). A post that points straight at tebiq.com is measured by tebiq's own middleware. A post that points straight at tebchart.com or tebdictate.com is counted as a visit with a referrer at best, and its campaign is lost. If you want campaign numbers for those two, send the click through a tebscribe.com page first, or ask for the CloudFront path to be changed (out of scope for this site).

What the beacon stores about a visit to tebscribe.com: property, event (`page_view`), route, device class, country, referrer bucket and the three campaign fields (`schema.py` `Event`, line 179 onward). The route is clamped to an allowlist (`ROUTE_TEMPLATES`, line 82 onward), and today only `/`, `/img` and `/3d` of the tebscribe.com paths are on it, so visits to `/products.html`, `/apps.html`, `/free-dictation/`, `/free-medical-tools/`, `/apps/*.html` and `/bellody/*` are all recorded under `/other`. Campaign numbers still work, but page-level numbers for those pages do not until the allowlist is extended (a change in scripta, not this site).

## 4. utm_content and utm_term are not measured by the beacon

`tb-beacon.js` sends `utm_source`, `utm_medium` and `utm_campaign` only (as `campaign_source`, `campaign_medium`, `campaign_name`). The collector never stores `utm_content` or `utm_term`; for the first-party data they do not exist. Google Analytics does keep them, for consenting visitors.

Adding them to the first-party data would need, in order: (1) `tb-beacon.js` sends two more fields; (2) `schema.py` adds `campaign_content` and `campaign_term` to `CAPS`, to the `Event` dataclass and to `validate()`, with the same shape rule and a daily distinct cap; (3) `store.py` writes them as raw-only fields (the existing comment on line 101 explains why campaign fields are never rollups); (4) `read.py` and the dashboard get a filter for them; (5) `scripta/app/analytics/buckets.py` and `middleware.py` map the two parameters for tebiq.com; (6) the Terraform table and the dashboard schema are checked for new attributes. Until then, put the distinction that matters into `utm_campaign` (up to 32 characters, 50 values a day) and use `utm_content` only for Google Analytics.

## 5. App store links

- Apple: UTM parameters do nothing on an App Store URL. Create a campaign link in App Store Connect (App Analytics > Campaigns), which adds `pt` and `ct` parameters, and read installs there.
- Google Play: add `&referrer=utm_source%3Dlinkedin%26utm_medium%3Dsocial%26utm_campaign%3Dalways_on` to `https://play.google.com/store/apps/details?id=com.tebscribe.tebiq`; Play Console reports it under Acquisition. This only helps if the app reads the install referrer or you use the Console report.
- These two are not wired into the site; the site links stay plain.

## 6. Checklist before a campaign

1. Pick the destination from section 2 and paste the link.
2. Change `utm_campaign` (32 characters or fewer, no ids) and `utm_content`.
3. Open the link once from a phone, accept analytics, and check GA4 Realtime shows the campaign. For tebscribe.com without consent, the beacon call to `tebchart.com/v1/collect` should appear in the browser network panel.
4. Never add UTMs to links between tebscribe.com pages, and never add any other tracker. The only analytics on this site are GA4 after consent and the first-party beacon.
