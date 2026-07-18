/* tb-beacon.js — private analytics mirror beacon for STATIC sites (v1).
 *
 * One page_view per load to the collector's public /v1/collect. No cookies,
 * no storage, no fingerprinting, respects Do Not Track. All bucketing/clamping
 * happens server-side in tebdictate/analytics/schema.py; nothing sent here is
 * stored verbatim. NO KEY on purpose: /v1/collect is the unauthenticated,
 * rate-limited beacon door — never embed X-Analytics-Key in public JS.
 *
 * Include (self-hosted, one line per page):
 *   <script defer src="/tb-beacon.js" data-property="tebscribe"></script>
 *
 * NEVER include on tebchart.com's static pages — they publish "no cookies,
 * no trackers" and are measured via CloudFront logs instead (RUNBOOK.md §4).
 */
(function () {
  "use strict";
  if (navigator.doNotTrack === "1" || window.doNotTrack === "1") return;
  var COLLECT = "https://tebchart.com/v1/collect";
  var prop = (document.currentScript && document.currentScript.dataset.property) || "";
  if (!prop) return;
  var q = new URLSearchParams(location.search);
  function utm(k) {
    var v = (q.get(k) || "").toLowerCase();
    return /^[a-z0-9_-]{1,32}$/.test(v) ? v : "";
  }
  var body = JSON.stringify({
    v: 1, property: prop, event: "page_view", route: location.pathname,
    campaign_source: utm("utm_source"),
    campaign_medium: utm("utm_medium"),
    campaign_name: utm("utm_campaign")
  });
  // text/plain keeps this a CORS "simple request" (no preflight); the
  // collector parses bytes and ignores the content type. sendBeacon survives
  // page unload; the fetch fallback is fire-and-forget.
  var blob = new Blob([body], { type: "text/plain" });
  if (!(navigator.sendBeacon && navigator.sendBeacon(COLLECT, blob))) {
    try { fetch(COLLECT, { method: "POST", body: body, mode: "no-cors", keepalive: true }); } catch (e) {}
  }
})();
