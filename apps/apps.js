/* apps/apps.js — shared behavior for tebscribe.com/apps/*.html
 *
 * ONE place for the feedback API origin — change here, never per-page.
 *
 * Backend contract (scripta branch it/app-feedback-inbox, flag `app_feedback_enabled`
 * default OFF as of this build — the router itself is still being built in parallel):
 *   POST {API_ORIGIN}/api/public/app-feedback
 *     JSON { app, kind, name, email, body, website }  (website = honeypot, must stay empty)
 *   GET  {API_ORIGIN}/api/public/app-feedback/<app>/comments
 *     -> approved comments only
 *
 * Every page must render as complete against a 404 from either endpoint (feature
 * off), so this file treats 404 as an expected state, not an error.
 */
(function () {
  "use strict";
  var API_ORIGIN = "https://v2.tebiq.com";

  function esc(s) {
    return (s == null ? "" : String(s))
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function qs(sel, root) { return (root || document).querySelector(sel); }

  function fmtDate(iso) {
    if (!iso) return "";
    var d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  }

  function renderComments(root, items) {
    var list = qs("#comment-list", root);
    var empty = qs("#comments-empty", root);
    if (!list) return;
    list.innerHTML = "";
    if (!items || !items.length) {
      if (empty) empty.hidden = false;
      return;
    }
    if (empty) empty.hidden = true;
    items.forEach(function (c) {
      var name = esc(c.name || "A user");
      var body = esc(c.body || "");
      var date = esc(fmtDate(c.created_at || c.createdAt || c.date));
      var el = document.createElement("div");
      el.className = "comment";
      el.innerHTML =
        '<div class="comment-head"><span class="comment-name">' + name + "</span>" +
        (date ? "<span>" + date + "</span>" : "") + "</div>" +
        '<div class="comment-body">' + body + "</div>";
      list.appendChild(el);
    });
  }

  function goFeatureOff(root) {
    var list = qs("#comment-list", root);
    var empty = qs("#comments-empty", root);
    var note = qs("#comments-note", root);
    var form = qs("#feedback-form", root);
    if (list) list.hidden = true;
    if (empty) empty.hidden = true;
    if (note) {
      note.hidden = false;
      note.textContent = "Comments and the write-to-us form for this app aren't switched on yet — coming soon.";
    }
    if (form) form.hidden = true;
  }

  function loadComments(root, app) {
    if (!window.fetch) return; // no-JS / no-fetch: leave the static HTML as authored
    fetch(API_ORIGIN + "/api/public/app-feedback/" + encodeURIComponent(app) + "/comments", {
      headers: { Accept: "application/json" }
    })
      .then(function (res) {
        if (res.status === 404 || res.status === 405) { goFeatureOff(root); return null; }
        if (!res.ok) return null;
        return res.json();
      })
      .then(function (data) {
        if (data == null) return;
        var items = Array.isArray(data) ? data : (data.comments || data.items || data.results || []);
        renderComments(root, items);
      })
      .catch(function () { /* network hiccup — leave the default empty state, never a raw error */ });
  }

  function clearStatus(root) {
    var el = qs("#feedback-status", root);
    if (el) { el.className = "form-status"; el.textContent = ""; }
  }

  function setStatus(root, kind, msg) {
    var el = qs("#feedback-status", root);
    if (!el) return;
    el.className = "form-status show " + kind;
    el.textContent = msg;
  }

  function initForm(root, app) {
    var form = qs("#feedback-form", root);
    if (!form || !window.fetch) return; // no fetch: the form's own action/method still works
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var hp = form.querySelector('[name="website"]');
      if (hp && hp.value) return; // honeypot tripped — fail silently, no signal to the bot
      var kindEl = form.querySelector('[name="kind"]:checked');
      var nameEl = form.querySelector('[name="name"]');
      var emailEl = form.querySelector('[name="email"]');
      var bodyEl = form.querySelector('[name="body"]');
      var btn = form.querySelector('button[type="submit"]');
      var payload = {
        app: app,
        kind: kindEl ? kindEl.value : "comment",
        name: nameEl ? nameEl.value : "",
        email: emailEl ? emailEl.value : "",
        body: bodyEl ? bodyEl.value : "",
        website: ""
      };
      if (btn) btn.disabled = true;
      clearStatus(root);
      fetch(API_ORIGIN + "/api/public/app-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      })
        .then(function (res) {
          // 404 = route not registered yet; 405 = the generic API catch-all only
          // answers GET, so an unmatched POST 405s before it ever reaches the app's
          // own 404 handler (verified live 2026-09-12: GET .../app-feedback -> 404
          // {"detail":"Not found"}, POST the same path -> 405 {"detail":"Method Not
          // Allowed"}, allow: GET). Both mean "not switched on yet" from here.
          if (res.status === 404 || res.status === 405) { goFeatureOff(root); return; }
          if (res.status === 429) { setStatus(root, "err", "Please try again later."); return; }
          if (res.status === 422) {
            return res.json().catch(function () { return {}; }).then(function (d) {
              setStatus(root, "err", d.message || d.detail || "Please check the form and try again.");
            });
          }
          if (!res.ok) { setStatus(root, "err", "Something went wrong. Please try again."); return; }
          form.reset();
          setStatus(root, "ok", "Thanks — this reaches the founder directly.");
        })
        .catch(function () {
          setStatus(root, "err", "Couldn't reach the server. Please try again.");
        })
        .finally(function () {
          if (btn) btn.disabled = false;
        });
    });
  }

  /* ---------------------------------------------------------------------
   * PROMOTIONS — live feed from scripta's public Promo Center feed.
   * Contract: GET {API_ORIGIN}/api/promo/promotions -> {"apps":[{"slug","name","promotions":[...]}]}
   *           GET {API_ORIGIN}/api/promo/<slug>/promotions -> same per-app shape
   * 404 or a network failure both mean "no promotions" — the static fallback
   * copy already in the HTML is left exactly as authored, never replaced with
   * an error. `?feed=<url>` overrides the fetch target for local testing
   * (e.g. a JSON file served by `python3 -m http.server`); it is a query
   * param a visitor could type, not a switch anyone would flip by accident,
   * and every value it can return is rendered through textContent below.
   * -------------------------------------------------------------------- */
  var HUB_SLUGS = ["tebiq", "tebchart", "tebdictate", "tebintake", "tebcapture", "tebrounds", "bellody", "momo-home"];

  function promoFeedURL(defaultPath) {
    try {
      var override = new URLSearchParams(window.location.search).get("feed");
      if (override) return override;
    } catch (e) {}
    return API_ORIGIN + defaultPath;
  }

  function fetchPromoFeed(url) {
    if (!window.fetch) return Promise.resolve(null);
    var ctrl = window.AbortController ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, 10000) : null;
    return fetch(url, { headers: { Accept: "application/json" }, signal: ctrl ? ctrl.signal : undefined })
      .then(function (res) {
        if (timer) clearTimeout(timer);
        if (res.status === 404 || !res.ok) return null;
        return res.json().catch(function () { return null; });
      })
      .catch(function () {
        if (timer) clearTimeout(timer);
        return null; // 404 / network failure / timeout: treat as "no promotions"
      });
  }

  function extractPromotions(data) {
    if (!data) return null;
    if (Array.isArray(data)) return data;
    if (Array.isArray(data.promotions)) return data.promotions;
    return null;
  }

  function grantLabel(grant) {
    if (!grant || !grant.type) return "Special offer";
    var n = parseInt(grant.value, 10);
    switch (grant.type) {
      case "pro_months":
        return isNaN(n) ? "Special offer" : n + " month" + (n === 1 ? "" : "s") + " of Pro";
      case "pro_lifetime":
        return "Pro for life";
      case "trial_days":
        return isNaN(n) ? "Special offer" : n + "-day trial";
      default:
        return "Special offer";
    }
  }

  function copyPromoCode(code, labelEl) {
    if (!navigator.clipboard || !navigator.clipboard.writeText) return;
    navigator.clipboard.writeText(code).then(function () {
      if (!labelEl) return;
      labelEl.textContent = "Copied";
      setTimeout(function () { labelEl.textContent = "Copy"; }, 1600);
    }).catch(function () { /* clipboard denied — code is already visible as text */ });
  }

  function buildPromoCard(promo) {
    var card = document.createElement("div");
    card.className = "promo-card";

    var headline = document.createElement("div");
    headline.className = "promo-headline";
    headline.textContent = promo.headline || "";
    card.appendChild(headline);

    if (promo.blurb) {
      var blurb = document.createElement("p");
      blurb.className = "promo-blurb";
      blurb.textContent = promo.blurb;
      card.appendChild(blurb);
    }

    var grant = document.createElement("div");
    grant.className = "promo-grant";
    grant.textContent = grantLabel(promo.grant);
    card.appendChild(grant);

    if (promo.code) {
      var copyLabel = document.createElement("span");
      copyLabel.className = "promo-copy-label";
      copyLabel.textContent = "Copy";

      var codeText = document.createElement("span");
      codeText.className = "promo-code-text";
      codeText.textContent = promo.code;

      var codeBtn = document.createElement("button");
      codeBtn.type = "button";
      codeBtn.className = "promo-code-btn";
      codeBtn.setAttribute("aria-label", "Copy promo code " + promo.code);
      codeBtn.appendChild(codeText);
      codeBtn.appendChild(copyLabel);
      codeBtn.addEventListener("click", function () { copyPromoCode(promo.code, copyLabel); });
      card.appendChild(codeBtn);
    }

    var metaBits = [];
    if (typeof promo.cap === "number" && promo.cap > 0 && typeof promo.remaining === "number") {
      metaBits.push(promo.remaining + " left");
    }
    var exp = fmtDate(promo.expires_at);
    if (exp) metaBits.push("Expires " + exp);
    if (metaBits.length) {
      var meta = document.createElement("div");
      meta.className = "promo-meta";
      meta.textContent = metaBits.join(" · ");
      card.appendChild(meta);
    }

    return card;
  }

  function renderPromoCards(container, promotions) {
    while (container.firstChild) container.removeChild(container.firstChild);
    promotions.forEach(function (p) { container.appendChild(buildPromoCard(p)); });
  }

  function showPromos(root, promotions) {
    var cardsEl = qs(".promo-cards", root);
    var emptyEl = qs(".promo-empty", root);
    if (!promotions || !promotions.length) return; // leave static fallback untouched
    if (cardsEl) { renderPromoCards(cardsEl, promotions); cardsEl.hidden = false; }
    if (emptyEl) emptyEl.hidden = true;
  }

  function initPromoBlock(root) {
    var slug = root.getAttribute("data-promo");
    if (!slug) return;
    fetchPromoFeed(promoFeedURL("/api/promo/" + encodeURIComponent(slug) + "/promotions"))
      .then(function (data) { showPromos(root, extractPromotions(data)); });
  }

  function initPromoHub(root) {
    fetchPromoFeed(promoFeedURL("/api/promo/promotions")).then(function (data) {
      if (!data || !Array.isArray(data.apps)) return;
      var bySlug = {};
      data.apps.forEach(function (app) { if (app && app.slug) bySlug[app.slug] = app; });
      HUB_SLUGS.forEach(function (slug) {
        var app = bySlug[slug];
        if (!app) return;
        var section = root.querySelector('[data-promo-section="' + slug + '"]');
        if (!section) return;
        var nameEl = qs(".promo-app-name", section);
        if (nameEl && app.name) nameEl.textContent = app.name;
        showPromos(section, app.promotions);
      });
    });
  }

  function init() {
    document.querySelectorAll("[data-app-feedback]").forEach(function (root) {
      var app = root.getAttribute("data-app-feedback");
      if (!app) return;
      loadComments(root, app);
      initForm(root, app);
    });
    document.querySelectorAll("[data-promo]").forEach(initPromoBlock);
    var hub = document.querySelector("[data-promo-hub]");
    if (hub) initPromoHub(hub);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
