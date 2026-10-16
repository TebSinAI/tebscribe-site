/* tb-consent.js — consent gate for Google Analytics on tebscribe.com (v1).
 *
 * Google Analytics (GA4) does NOT load until the visitor clicks Accept.
 * Global Privacy Control (navigator.globalPrivacyControl === true) is treated as
 * Decline: no banner, nothing loads, {analytics:false} is stored silently.
 * Choice lives in localStorage['tb_consent'] = {"analytics":bool,"decidedAt":ISO,"version":1}.
 * Consent Mode v2 defaults are pushed as 'denied' before anything else.
 *
 * Include (self-hosted, one line per page):
 *   <script defer src="/tb-consent.js" data-ga="G-XXXXXXXXXX"></script>
 * Footer link that reopens the choice:
 *   <a href="#" data-tb-consent-open>Your Privacy Choices</a>
 *
 * NEVER include on tebchart.com's static pages (script-free by ruling).
 * The first-party tb-beacon.js is separate: no cookies, no storage, DNT/GPC aware.
 */
(function () {
  "use strict";
  var script = document.currentScript;
  var GA = (script && script.dataset.ga) || "";
  var KEY = "tb_consent";

  // Strings live here so i18n can be added later (English only today).
  var T = {
    en: {
      label: "Cookie choice",
      text: "We use Google Analytics to count visits, only if you say yes. Nothing loads until you choose.",
      accept: "Accept", decline: "Decline", policy: "Privacy policy"
    }
  };
  var PRIVACY_URL = "https://tebiq.com/privacy";

  function str() {
    var l = (window.J3D_LANG || document.documentElement.lang || "en").split("-")[0];
    return T[l] || T.en;
  }

  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = window.gtag || gtag;
  gtag("consent", "default", {
    analytics_storage: "denied", ad_storage: "denied",
    ad_user_data: "denied", ad_personalization: "denied"
  });

  function hasGPC() { return navigator.globalPrivacyControl === true; }

  function read() {
    try {
      var v = JSON.parse(localStorage.getItem(KEY));
      if (v && typeof v.analytics === "boolean") return v;
    } catch (e) {}
    return null;
  }
  function write(analytics) {
    try {
      localStorage.setItem(KEY, JSON.stringify({
        analytics: analytics, decidedAt: new Date().toISOString(), version: 1
      }));
    } catch (e) {}
  }

  var loaded = false;
  function loadGA() {
    if (loaded || !GA) return;
    loaded = true;
    var s = document.createElement("script");
    s.async = true;
    s.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(GA);
    document.head.appendChild(s);
    gtag("js", new Date());
    gtag("consent", "update", { analytics_storage: "granted" });
    gtag("config", GA, { anonymize_ip: true });
  }

  var banner = null;
  function close() { if (banner && banner.parentNode) banner.parentNode.removeChild(banner); banner = null; }

  function choose(yes) {
    write(yes);
    close();
    if (yes && !hasGPC()) loadGA();
    if (!yes) gtag("consent", "update", { analytics_storage: "denied" });
  }

  function css() {
    var st = document.createElement("style");
    // Site tokens win (--bg-2/--fg on the dark hub pages, --panel/--ink on the
    // light/dark product pages); otherwise follow the OS colour scheme.
    st.textContent =
      "#tb-consent{--tbc-bg:var(--bg-2,var(--panel,#fff));--tbc-fg:var(--fg,var(--ink,#111));" +
      "position:fixed;left:16px;right:16px;bottom:calc(16px + env(safe-area-inset-bottom));z-index:2147483000;" +
      "max-width:720px;margin:0 auto;display:flex;flex-wrap:wrap;gap:12px 16px;align-items:center;" +
      "padding:14px 16px;border-radius:14px;box-sizing:border-box;" +
      "background:var(--tbc-bg);color:var(--tbc-fg);border:1px solid var(--hair-strong,rgba(128,128,128,.45));" +
      "box-shadow:0 8px 30px rgba(0,0,0,.35);font:14px/1.45 var(--font,-apple-system,system-ui,sans-serif)}" +
      "@media (prefers-color-scheme:dark){#tb-consent{--tbc-bg:var(--bg-2,var(--panel,#16181F));--tbc-fg:var(--fg,var(--ink,#F5F6FA))}}" +
      "#tb-consent p{margin:0;flex:1 1 260px;color:inherit}" +
      "#tb-consent a{color:var(--blue,#0A84FF);text-decoration:underline}" +
      "#tb-consent .tbc-b{display:flex;gap:8px;flex:0 0 auto}" +
      "#tb-consent button{min-height:40px;min-width:92px;padding:0 16px;border-radius:999px;cursor:pointer;" +
      "font:600 14px/1 var(--font,system-ui,sans-serif);color:inherit;background:transparent;" +
      "border:1px solid var(--hair-strong,rgba(128,128,128,.6))}" +
      "#tb-consent button:focus-visible{outline:2px solid var(--blue,#0A84FF);outline-offset:2px}";
    return st;
  }

  function show() {
    if (banner) return;
    var t = str();
    banner = document.createElement("div");
    banner.id = "tb-consent";
    banner.setAttribute("role", "dialog");
    banner.setAttribute("aria-label", t.label);
    var p = document.createElement("p");
    p.appendChild(document.createTextNode(t.text + " "));
    var a = document.createElement("a");
    a.href = PRIVACY_URL; a.target = "_blank"; a.rel = "noopener"; a.textContent = t.policy;
    p.appendChild(a);
    var box = document.createElement("div");
    box.className = "tbc-b";
    var no = document.createElement("button");
    no.type = "button"; no.textContent = t.decline;
    no.addEventListener("click", function () { choose(false); });
    var yes = document.createElement("button");
    yes.type = "button"; yes.textContent = t.accept;
    yes.addEventListener("click", function () { choose(true); });
    box.appendChild(no); box.appendChild(yes);
    banner.appendChild(css());
    banner.appendChild(p); banner.appendChild(box);
    document.body.appendChild(banner);
    // Phones: sit above the pinned "Get started" bar instead of covering it.
    var fab = document.querySelector(".j3d-fab");
    if (fab && getComputedStyle(fab).display !== "none") {
      var r = fab.getBoundingClientRect();
      if (r.height) banner.style.bottom = Math.round(window.innerHeight - r.top + 10) + "px";
    }
  }

  window.tbConsent = { open: show };

  function wire() {
    document.addEventListener("click", function (e) {
      var el = e.target && e.target.closest ? e.target.closest("[data-tb-consent-open]") : null;
      if (el) { e.preventDefault(); show(); }
    });
    var c = read();
    if (hasGPC()) {
      if (!c || c.analytics) write(false);
      return;
    }
    if (!c) show();
    else if (c.analytics) loadGA();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", wire);
  else wire();
})();
