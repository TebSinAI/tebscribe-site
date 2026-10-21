/* IMG roadmap page behaviour: language switcher, 3D globe hero, part cards, section stepper
   with scroll-spy, search, newsletter form. No libraries, no network calls except the existing
   newsletter POST. Query string is never read except ?lang= and never rewritten (utm_* stay intact).
   Translations: /IMG/img-i18n.js (AI-drafted, native review owed). */
(function () {
  "use strict";
  var D = window.IMG_I18N || {}, LANGS = window.IMG_LANGS || ["en"], EN = D.en || {};
  var SIGNUP_LIVE = true;
  var html = document.documentElement;
  html.classList.add("js");
  var reduce = false;
  try { reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) {}

  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return [].slice.call((r || document).querySelectorAll(s)); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  var lang = "en";
  function t(k) { var d = D[lang]; return (d && d[k] != null && d[k] !== "") ? d[k] : (EN[k] != null ? EN[k] : ""); }
  function ptitle(n) { var a = (D[lang] && D[lang].parts) || EN.parts; return a[n - 1]; }
  function pfmt(n) { return t("partfmt").replace("{n}", n); }

  var secs = $$("section.part");

  /* ---------- language ---------- */
  function norm(c) { return String(c || "").toLowerCase().split("-")[0]; }
  function initialLang() {
    var q = null, s = null, i, c;
    try { q = norm(new URLSearchParams(location.search).get("lang")); } catch (e) {}
    if (q && D[q]) return q;
    try { s = norm(localStorage.getItem("teb.lang")); } catch (e) {}
    if (s && D[s]) return s;
    var nl = navigator.languages || [navigator.language];
    for (i = 0; i < nl.length; i++) { c = norm(nl[i]); if (D[c]) return c; }
    return "en";
  }

  var chipBox = $("#chips"), sel = null;
  LANGS.forEach(function (c) {
    if (!D[c]) return;
    var b = document.createElement("button");
    b.type = "button"; b.className = "chip"; b.lang = c; b.dir = D[c].dir || "ltr";
    b.setAttribute("data-lang", c); b.setAttribute("aria-pressed", "false");
    b.textContent = D[c].name;
    chipBox.appendChild(b);
  });
  // One <select> for the shared site bar (tb-nav.js adopts select.tb-lang), so the language stays
  // switchable while scrolling.
  sel = document.createElement("select");
  sel.className = "tb-lang";
  LANGS.forEach(function (c) {
    if (!D[c]) return;
    var o = document.createElement("option"); o.value = c; o.lang = c; o.textContent = D[c].name; sel.appendChild(o);
  });
  $("#langhold").appendChild(sel);

  function choose(c) {
    apply(c);
    try { localStorage.setItem("teb.lang", c); } catch (e) {}
  }
  chipBox.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest("button[data-lang]");
    if (b) choose(b.getAttribute("data-lang"));
  });
  sel.addEventListener("change", function () { choose(sel.value); });

  /* ---------- cards, stepper, kickers (built once, retitled on language change) ---------- */
  var cardsEl = $("#cards"), stList = $("#stlist");
  var chev = '<svg class="chev" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
  var searchSvg = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>';

  var stSearch = document.createElement("li");
  stSearch.className = "st-search";
  stSearch.innerHTML = '<button type="button" class="st-sbtn" data-t-aria="srch_aria">' + searchSvg + "</button>";
  stList.appendChild(stSearch);

  secs.forEach(function (s, i) {
    var n = i + 1;
    s.setAttribute("data-n", n);
    var k = document.createElement("p");
    k.className = "kick"; k.hidden = true;
    var h2 = $("h2", s);
    h2.parentNode.insertBefore(k, h2.nextSibling);
    s._kick = k;

    var subs = $$("h3", s).filter(function (h) { return h.id && h.textContent.trim().length > 2; });
    var li = document.createElement("li");
    li.className = "card tilt"; li.setAttribute("data-n", n);
    var pills = subs.slice(0, 6).map(function (h) {
      return '<a class="pill" href="#' + esc(h.id) + '">' + esc(h.textContent.trim()) + "</a>";
    }).join("");
    var more = subs.length > 6 ? '<span class="more">+' + (subs.length - 6) + "</span>" : "";
    li.innerHTML =
      '<h3 class="card-h"><button type="button" class="card-b" aria-expanded="false" aria-controls="cp' + n + '">' +
      '<span class="badge" aria-hidden="true">' + n + '</span><span class="card-t"><span class="card-n"></span><span class="card-title"></span></span>' + chev +
      "</button></h3>" +
      '<div class="card-p" id="cp' + n + '"><div><p class="card-in" data-t="inside"></p><div class="pills" dir="ltr" lang="en">' + pills + more + '</div>' +
      '<a class="card-go" href="#part-' + n + '"><span data-t="go"></span> <span class="arr" aria-hidden="true">→</span></a></div></div>';
    cardsEl.appendChild(li);

    var st = document.createElement("li");
    st.innerHTML = '<a href="#part-' + n + '" data-n="' + n + '"><span class="node" aria-hidden="true">' + n + '</span><span class="st-l"></span></a>';
    stList.appendChild(st);
    s._st = st.firstChild; s._card = li;
  });

  cardsEl.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest(".card-b");
    if (!b) return;
    var c = b.closest(".card"), open = !c.classList.contains("open");
    c.classList.toggle("open", open);
    b.setAttribute("aria-expanded", open ? "true" : "false");
  });

  /* ---------- apply language ---------- */
  function apply(code) {
    lang = D[code] ? code : "en";
    var d = D[lang];
    html.lang = lang; html.dir = d.dir || "ltr";
    $$("[data-t]").forEach(function (el) { el.textContent = t(el.getAttribute("data-t")); });
    $$("[data-t-ph]").forEach(function (el) { el.setAttribute("placeholder", t(el.getAttribute("data-t-ph"))); });
    $$("[data-t-aria]").forEach(function (el) { el.setAttribute("aria-label", t(el.getAttribute("data-t-aria"))); });
    $("#chips").setAttribute("aria-label", t("langlabel"));
    $("#stepper").setAttribute("aria-label", t("stepper"));
    $$(".mtonly").forEach(function (el) { el.hidden = lang === "en"; });
    secs.forEach(function (s, i) {
      var n = i + 1, ti = ptitle(n);
      $(".card-n", s._card).textContent = pfmt(n);
      $(".card-title", s._card).textContent = ti;
      $(".st-l", s._st).textContent = ti;
      s._st.setAttribute("aria-label", pfmt(n) + ": " + ti);
      var a = $('.toc a[href="#part-' + n + '"]');
      if (a) { if (!a._en) a._en = a.textContent; a.textContent = lang === "en" ? a._en : pfmt(n) + ": " + ti; }
      s._kick.hidden = lang === "en";
      s._kick.lang = lang; s._kick.dir = d.dir || "ltr";
      s._kick.textContent = pfmt(n) + " · " + ti;
    });
    $$(".chip", chipBox).forEach(function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-lang") === lang ? "true" : "false"); });
    sel.value = lang;
    sel.setAttribute("aria-label", t("langlabel"));
    window.dispatchEvent(new CustomEvent("tb:lang", { detail: lang }));
    if (window.__imgSpy) window.__imgSpy();
  }

  /* ---------- search (same behaviour as before, plus match highlight) ---------- */
  var q = $("#q"), hits = $("#hits");
  function run() {
    var v = q.value.trim().toLowerCase(); hits.innerHTML = "";
    secs.forEach(function (s) { $$("mark", s).forEach(function (m) { m.replaceWith(document.createTextNode(m.textContent)); }); s.normalize(); });
    if (v.length < 2) return;
    var n = 0;
    secs.forEach(function (s) {
      $$("h2,h3,p,li", s).forEach(function (el) {
        if (el.classList.contains("kick")) return;
        var tx = el.textContent, i = tx.toLowerCase().indexOf(v);
        if (i < 0 || n >= 30) return;
        n++;
        if (!el.id) el.id = "h" + Math.random().toString(36).slice(2, 8);
        var a = Math.max(0, i - 40), b = i + v.length + 60;
        var li = document.createElement("li");
        li.innerHTML = '<a href="#' + el.id + '">' + esc(tx.slice(a, i)) + "<mark>" + esc(tx.slice(i, i + v.length)) + "</mark>" + esc(tx.slice(i + v.length, b)) + "</a><small>" +
          esc(s.dataset.title ? ("Part " + s.id.replace("part-", "") + ": " + s.dataset.title) : "") + "</small>";
        hits.appendChild(li);
      });
    });
    if (!n) hits.innerHTML = "<li>" + esc(t("nohit")) + "</li>";
  }
  q.addEventListener("input", run);
  q.addEventListener("keydown", function (e) { if (e.key === "Escape") { q.value = ""; run(); } });
  hits.addEventListener("click", function (e) { if (e.target.closest && e.target.closest("a")) hits.innerHTML = ""; });
  function focusSearch() {
    var w = $("#find");
    w.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
    setTimeout(function () { try { q.focus({ preventScroll: true }); } catch (e) { q.focus(); } }, reduce ? 0 : 350);
  }
  $$("[data-focus-search]").forEach(function (b) { b.addEventListener("click", function (e) { e.preventDefault(); focusSearch(); }); });
  $(".st-sbtn").addEventListener("click", focusSearch);

  /* ---------- newsletter form (payload unchanged: {email, source:'img'}) ---------- */
  if (SIGNUP_LIVE) {
    $("#signup").hidden = false;
    $("#subform").addEventListener("submit", function (e) {
      e.preventDefault();
      var m = $("#submsg"); m.textContent = t("m_send");
      fetch("https://tebiq.com/api/pulse/subscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: $("#subemail").value, source: "img" }) })
        .then(function (r) { m.textContent = r.ok ? t("m_ok") : (r.status === 429 ? t("m_429") : t("m_bad")); })
        .catch(function () { m.textContent = t("m_fail"); });
    });
  }

  /* ---------- share ---------- */
  var shareBtn = $("#share");
  if (!navigator.share && !(navigator.clipboard && navigator.clipboard.writeText)) shareBtn.hidden = true;
  shareBtn.addEventListener("click", function () {
    var url = location.origin + location.pathname;   // clean link, no utm
    if (navigator.share) { navigator.share({ title: document.title, url: url }).catch(function () {}); return; }
    navigator.clipboard.writeText(url).then(function () { $("#sharemsg").textContent = t("share_done"); }, function () {});
  });

  /* ---------- scroll-spy + progress ---------- */
  var stepper = $("#stepper"), ticking = false, activeN = 0;
  function spy() {
    ticking = false;
    var vh = window.innerHeight, line = vh * 0.34, act = 0, i, r;
    for (i = 0; i < secs.length; i++) { r = secs[i].getBoundingClientRect(); if (r.top <= line) act = i + 1; }
    var first = secs[0].getBoundingClientRect(), last = secs[secs.length - 1].getBoundingClientRect();
    var total = last.bottom - first.top, p = total > 0 ? (line - first.top) / total : 0;
    p = Math.max(0, Math.min(1, p));
    stepper.style.setProperty("--p", p.toFixed(4));
    if (act !== activeN) {
      activeN = act;
      secs.forEach(function (s, k) {
        var n = k + 1, a = s._st;
        a.parentNode.classList.toggle("done", n < act);
        if (n === act) { a.setAttribute("aria-current", "step"); a.classList.add("on"); } else { a.removeAttribute("aria-current"); a.classList.remove("on"); }
      });
      var cur = act ? secs[act - 1]._st : null, ls = stList;
      if (cur && ls.scrollWidth > ls.clientWidth + 2 && getComputedStyle(ls).overflowX !== "visible") {
        var cr = cur.getBoundingClientRect(), lr = ls.getBoundingClientRect();
        ls.scrollLeft += (cr.left + cr.width / 2) - (lr.left + lr.width / 2);
      }
    }
  }
  window.__imgSpy = function () { activeN = -1; spy(); };
  window.addEventListener("scroll", function () { if (!ticking) { ticking = true; requestAnimationFrame(spy); } }, { passive: true });
  window.addEventListener("resize", spy);

  /* ---------- 3D tilt on cards (pointer devices only, never with reduced motion) ---------- */
  var canTilt = false;
  try { canTilt = !reduce && window.matchMedia("(hover:hover) and (pointer:fine)").matches; } catch (e) {}
  if (canTilt) {
    $$(".tilt").forEach(function (el) {
      el.addEventListener("pointermove", function (e) {
        var r = el.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
        el.style.setProperty("--ry", (x * 7).toFixed(2) + "deg");
        el.style.setProperty("--rx", (-y * 7).toFixed(2) + "deg");
      });
      el.addEventListener("pointerleave", function () { el.style.setProperty("--ry", "0deg"); el.style.setProperty("--rx", "0deg"); });
    });
  }

  /* ---------- globe ---------- */
  var LAND = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD+DwAAAAAAAAAAAAAAAOD/HwAAAAAAAAAAAAAAAMD/PwAAAAAwAAAAAAAAAAD+HwAAAID/BwAAgAMAAAD+HwAYAP7///8A4P///wH8AwDe////////8P///wF4cIDv////////4P//DwAwAMDD//////8fwID/H3gAAMDz/////+cDIAD/P/wAAIz4/////wEDAAD+//4BAP7//////wMBAAD8//8BAPD//////wMAAAD4//8AAPj//v///wMAAAD4/x8AALgezv///wkAAAD4/w8AAA77z///fwAAAAD4/wcAAA7g3///TwQAAADw/wMAAPwA////DwEAAADg/wEAAP6D////DwAAAADAHwEAAP9/z///DwAAAACADwAAgP//X///DwAAAAAADwIAgP//fvj/AwAAAAAATgAAwP//fvB4AAAAAAAAcAAAwP//PXDwEAAAAAAAwAAAwP//B2DgEAAAAAAAgPgAgP//H2DgMAAAAAAAAP4BAP//DwAAIAAAAAAAAPwHAIL/DwAgDAAAAAAAAPwHAID/BwAgBwAAAAAAAP4fAID/AwBgBgEAAAAAAP5/AID/AwBAAA4AAAAAAP7/AAD/AwAAABwAAAAAAPz/AAD/AQAAAAAAAAAAAPh/AAD/EQAAwAsAAAAAAPB/AAD/GQAA4A8AAAAAAOB/AAD/CQAA+B8AAAAAAPA/AAD+CAAA/D8AAAAAAPAPAAB+AAAA/H8AAAAAAPAHAAB8AAAA/H8AAAAAAPAHAAA8AAAAfH8AAAAAAPADAAAIAAAACDwgAAAAAPgBAAAAAAAAADhgAAAAAHgAAAAAAAAAAABgAAAAAHgAAAAAAAAAAAAwAAAAADgAAAAAAAAAAAAAAAAAADgAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
  function initGlobe() {
    var box = $("#globe"), cv = $("#gc");
    if (!box || !cv || !cv.getContext) return;
    var ctx = cv.getContext("2d");
    if (!ctx) return;
    var R2D = Math.PI / 180, W = 120, H = 60, bin, pts = [], i, j;
    try { bin = atob(LAND); } catch (e) { return; }
    function vec(lon, lat) { lon *= R2D; lat *= R2D; return [Math.cos(lat) * Math.sin(lon), Math.sin(lat), Math.cos(lat) * Math.cos(lon)]; }
    for (j = 0; j < H; j++) for (i = 0; i < W; i++) {
      var idx = j * W + i;
      if ((bin.charCodeAt(idx >> 3) >> (idx & 7)) & 1) pts.push(vec(-180 + (i + 0.5) * 3, 90 - (j + 0.5) * 3));
    }
    // Where IMGs set out from, and the U.S. cities the arcs land on. Decorative only.
    var FROM = [[31.2, 30.0], [3.4, 6.5], [36.8, -1.3], [67.0, 24.9], [77.2, 28.6], [90.4, 23.8], [51.4, 35.7], [46.7, 24.7], [121.0, 14.6], [-77.0, -12.0], [-46.6, -23.5], [-99.1, 19.4], [37.6, 55.8], [116.4, 39.9], [29.0, 41.0], [-74.1, 4.7]];
    var TO = [[-74.0, 40.7], [-87.6, 41.9], [-95.4, 29.8], [-80.2, 25.8], [-118.2, 34.0], [-84.4, 33.7]];
    var N = 56, arcs = FROM.map(function (f, k) {
      var a = vec(f[0], f[1]), b = vec(TO[k % TO.length][0], TO[k % TO.length][1]);
      var dot = Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])), om = Math.acos(dot), so = Math.sin(om) || 1, line = [];
      for (var s = 0; s <= N; s++) {
        var u = s / N, ka = Math.sin((1 - u) * om) / so, kb = Math.sin(u * om) / so, lift = 1 + 0.2 * Math.sin(Math.PI * u) * Math.min(1, om / 1.2);
        line.push([(ka * a[0] + kb * b[0]) * lift, (ka * a[1] + kb * b[1]) * lift, (ka * a[2] + kb * b[2]) * lift]);
      }
      return { a: a, b: b, line: line };
    });
    var psi = -48 * R2D, phi = 0.38, dpr = 1, size = 0, running = false, last = 0, drag = null, dragging = false;

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      size = Math.max(160, box.clientWidth);
      cv.width = Math.round(size * dpr); cv.height = Math.round(size * dpr);
      if (!running) draw(performance.now());
    }
    function rot(v) {
      var cp = Math.cos(psi), sp = Math.sin(psi), x = v[0] * cp - v[2] * sp, z = v[0] * sp + v[2] * cp;
      var cf = Math.cos(phi), sf = Math.sin(phi);
      return [x, v[1] * cf - z * sf, v[1] * sf + z * cf];
    }
    function draw(ts) {
      var w = cv.width, R = w * 0.415, c = w / 2, k, m, p, v, px;
      ctx.clearRect(0, 0, w, w);
      var ds = Math.max(1.4 * dpr, R * 0.0105);
      for (k = 0; k < pts.length; k++) {
        p = rot(pts[k]);
        if (p[2] <= 0.02) continue;
        ctx.fillStyle = "rgba(125,185,255," + (0.18 + 0.7 * p[2]).toFixed(3) + ")";
        ctx.fillRect(c + p[0] * R - ds / 2, c - p[1] * R - ds / 2, ds, ds);
      }
      var T = reduce ? 2600 : ts;
      for (k = 0; k < arcs.length; k++) {
        var A = arcs[k], prev = null, ph = ((T / 5200) + k * 0.173) % 1, head = ph * N;
        ctx.lineCap = "round";
        for (m = 0; m <= N; m++) {
          v = rot(A.line[m]);
          var vis = v[2] > 0.01, cur = vis ? [c + v[0] * R, c - v[1] * R] : null;
          if (prev && cur) {
            var d = head - m; if (d < 0) d += N;
            var tail = d >= 0 && d < 16 ? 1 - d / 16 : 0;
            ctx.strokeStyle = tail > 0 ? "rgba(255,196,87," + (0.25 + 0.75 * tail).toFixed(2) + ")" : "rgba(255,196,87,0.16)";
            ctx.lineWidth = (tail > 0 ? 1.4 + 1.6 * tail : 1) * dpr;
            ctx.beginPath(); ctx.moveTo(prev[0], prev[1]); ctx.lineTo(cur[0], cur[1]); ctx.stroke();
          }
          prev = cur;
        }
        v = rot(A.line[Math.floor(head) % (N + 1)]);
        if (v[2] > 0.01) { ctx.fillStyle = "#FFE3A0"; ctx.beginPath(); ctx.arc(c + v[0] * R, c - v[1] * R, 2.6 * dpr, 0, 6.2832); ctx.fill(); }
        v = rot(A.a);
        if (v[2] > 0.02) {
          px = [c + v[0] * R, c - v[1] * R];
          var pu = ((T / 2400) + k * 0.31) % 1;
          ctx.strokeStyle = "rgba(160,205,255," + (0.55 * (1 - pu)).toFixed(2) + ")"; ctx.lineWidth = 1.2 * dpr;
          ctx.beginPath(); ctx.arc(px[0], px[1], (2 + pu * 9) * dpr, 0, 6.2832); ctx.stroke();
          ctx.fillStyle = "#CFE6FF"; ctx.beginPath(); ctx.arc(px[0], px[1], 2.1 * dpr, 0, 6.2832); ctx.fill();
        }
      }
      for (k = 0; k < TO.length; k++) {
        v = rot(vec(TO[k][0], TO[k][1]));
        if (v[2] > 0.02) {
          px = [c + v[0] * R, c - v[1] * R];
          ctx.fillStyle = "rgba(255,196,87,.22)"; ctx.beginPath(); ctx.arc(px[0], px[1], 7 * dpr, 0, 6.2832); ctx.fill();
          ctx.fillStyle = "#FFC457"; ctx.beginPath(); ctx.arc(px[0], px[1], 3.2 * dpr, 0, 6.2832); ctx.fill();
        }
      }
    }
    function loop(ts) {
      if (!running) return;
      var dt = Math.min(64, ts - last); last = ts;
      if (!dragging) psi -= dt * 0.00011;
      draw(ts);
      requestAnimationFrame(loop);
    }
    function start() { if (running || reduce) return; running = true; last = performance.now(); requestAnimationFrame(loop); }
    function stop() { running = false; }

    cv.style.touchAction = "pan-y";
    cv.addEventListener("pointerdown", function (e) { dragging = true; drag = e.clientX; try { cv.setPointerCapture(e.pointerId); } catch (x) {} });
    cv.addEventListener("pointermove", function (e) {
      if (!dragging) return;
      psi -= (e.clientX - drag) / (size * 0.415) * 1.0; drag = e.clientX;
      if (!running) draw(performance.now());
    });
    function up() { dragging = false; }
    cv.addEventListener("pointerup", up); cv.addEventListener("pointercancel", up);

    resize();
    window.addEventListener("resize", resize);
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (es) { es[0].isIntersecting ? start() : stop(); }, { threshold: 0.05 }).observe(box);
    } else start();
    document.addEventListener("visibilitychange", function () { if (document.hidden) stop(); else start(); });
    box.classList.add("live");
  }
  try { initGlobe(); } catch (e) { /* the CSS sphere stays as the static fallback */ }

  apply(initialLang());
  spy();
})();
