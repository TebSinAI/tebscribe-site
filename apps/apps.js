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

  function init() {
    document.querySelectorAll("[data-app-feedback]").forEach(function (root) {
      var app = root.getAttribute("data-app-feedback");
      if (!app) return;
      loadComments(root, app);
      initForm(root, app);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
