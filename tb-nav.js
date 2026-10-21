/* tb-nav.js — the ONE site menu for tebscribe.com (v1).
 *
 * Include in <head>, before first paint (classic script, no defer):
 *   <script src="/tb-nav.js"></script>
 * and mark the page's old menu with  data-tb-legacy-nav  (the old element stays in the HTML as
 * the no-JS fallback; this script hides it and puts the shared bar in its place).
 *
 * Vanilla JS, no network calls, no cookies. Shadow DOM, so no page stylesheet can restyle or
 * break it (several pages have a global `nav{position:...}` rule). Labels follow the site
 * language (?lang=, localStorage "teb.lang", <html lang>) and update live on a `tb:lang`
 * event: window.dispatchEvent(new CustomEvent("tb:lang",{detail:"ar"})).
 * Translations are AI-drafted; native review owed.
 */
(function () {
  "use strict";
  if (window.__tbNav) return;
  window.__tbNav = 1;

  var LINKS = [
    { k: "apps_c", href: "/products-by-dr-c/", on: function (p) { return p.indexOf("/products-by-dr-c/") === 0; } },
    { k: "apps", href: "/apps.html", on: function (p) { return p === "/apps.html" || p.indexOf("/apps/") === 0; } },
    { k: "dict", href: "/free-dictation/", on: function (p) { return p.indexOf("/free-dictation/") === 0; } },
    { k: "tools", href: "/free-medical-tools/", on: function (p) { return p.indexOf("/free-medical-tools/") === 0; } },
    { k: "img", href: "/IMG/", hl: 1, on: function (p) { return p.toLowerCase().indexOf("/img/") === 0; } },
    { k: "why", href: "/#principles" },
    { k: "vision", href: "/#vision" }
  ];

  var L = {
    en: { apps_c: "Apps by Dr. C", apps: "All apps", dict: "Free dictation", tools: "Free medical tools", img: "For IMGs", why: "Why we're different", vision: "Vision", cta: "Try tebIQ", menu: "Menu", close: "Close menu", home: "tebScribe home", label: "Main menu" },
    es: { apps_c: "Apps del Dr. C", apps: "Todas las apps", dict: "Dictado gratis", tools: "Herramientas médicas gratis", img: "Para IMG", why: "Por qué somos distintos", vision: "Visión", cta: "Probar tebIQ", menu: "Menú", close: "Cerrar menú", home: "Inicio de tebScribe", label: "Menú principal" },
    fr: { apps_c: "Apps du Dr C", apps: "Toutes les apps", dict: "Dictée gratuite", tools: "Outils médicaux gratuits", img: "Pour les IMG", why: "Notre différence", vision: "Vision", cta: "Essayer tebIQ", menu: "Menu", close: "Fermer le menu", home: "Accueil tebScribe", label: "Menu principal" },
    pt: { apps_c: "Apps do Dr. C", apps: "Todos os apps", dict: "Ditado grátis", tools: "Ferramentas médicas grátis", img: "Para IMGs", why: "O que nos diferencia", vision: "Visão", cta: "Experimente o tebIQ", menu: "Menu", close: "Fechar menu", home: "Início tebScribe", label: "Menu principal" },
    ru: { apps_c: "Приложения Dr. C", apps: "Все приложения", dict: "Бесплатная диктовка", tools: "Бесплатные мед. инструменты", img: "Для IMG", why: "Чем мы отличаемся", vision: "Видение", cta: "Попробовать tebIQ", menu: "Меню", close: "Закрыть меню", home: "tebScribe, главная", label: "Главное меню" },
    zh: { apps_c: "Dr. C 的应用", apps: "全部应用", dict: "免费语音听写", tools: "免费医学工具", img: "国际医学毕业生", why: "我们的不同", vision: "愿景", cta: "试用 tebIQ", menu: "菜单", close: "关闭菜单", home: "tebScribe 首页", label: "主菜单" },
    ar: { apps_c: "تطبيقات د. سي", apps: "كل التطبيقات", dict: "إملاء مجاني", tools: "أدوات طبية مجانية", img: "للأطباء خريجي الخارج", why: "ما الذي يميزنا", vision: "الرؤية", cta: "جرّب tebIQ", menu: "القائمة", close: "إغلاق القائمة", home: "الصفحة الرئيسية لـ tebScribe", label: "القائمة الرئيسية" },
    fa: { apps_c: "برنامه‌های دکتر سی", apps: "همه برنامه‌ها", dict: "دیکته رایگان", tools: "ابزارهای پزشکی رایگان", img: "ویژه IMG", why: "چرا متفاوتیم", vision: "چشم‌انداز", cta: "tebIQ را امتحان کنید", menu: "منو", close: "بستن منو", home: "صفحه اصلی tebScribe", label: "منوی اصلی" },
    ur: { apps_c: "ڈاکٹر سی کی ایپس", apps: "تمام ایپس", dict: "مفت ڈکٹیشن", tools: "مفت طبی ٹولز", img: "IMG ڈاکٹروں کے لیے", why: "ہم مختلف کیوں ہیں", vision: "ویژن", cta: "tebIQ آزمائیں", menu: "مینو", close: "مینو بند کریں", home: "tebScribe ہوم", label: "مرکزی مینو" },
    hi: { apps_c: "डॉ. सी के ऐप्स", apps: "सभी ऐप्स", dict: "मुफ़्त डिक्टेशन", tools: "मुफ़्त मेडिकल टूल्स", img: "IMG डॉक्टरों के लिए", why: "हम अलग क्यों हैं", vision: "विज़न", cta: "tebIQ आज़माएँ", menu: "मेन्यू", close: "मेन्यू बंद करें", home: "tebScribe होम", label: "मुख्य मेन्यू" },
    bn: { apps_c: "ডা. সি-র অ্যাপ", apps: "সব অ্যাপ", dict: "বিনামূল্যে ডিক্টেশন", tools: "বিনামূল্যে মেডিকেল টুল", img: "IMG চিকিৎসকদের জন্য", why: "আমরা কেন আলাদা", vision: "ভিশন", cta: "tebIQ চেষ্টা করুন", menu: "মেনু", close: "মেনু বন্ধ করুন", home: "tebScribe হোম", label: "প্রধান মেনু" }
  };
  var RTL = { ar: 1, fa: 1, ur: 1 };

  function pickLang() {
    var v = null;
    try { v = new URLSearchParams(location.search).get("lang"); } catch (e) {}
    var h = document.documentElement.lang || "";
    if (!v && h && h.toLowerCase().indexOf("en") !== 0) v = h;
    if (!v) { try { v = localStorage.getItem("teb.lang"); } catch (e) {} }
    if (!v) v = "en";
    v = String(v).toLowerCase().split("-")[0];
    return L[v] ? v : "en";
  }

  // Hide the page's old menu as early as the parser sees it (no flash), keep it as no-JS fallback.
  var hide = document.createElement("style");
  hide.textContent = "[data-tb-legacy-nav]{display:none!important}";
  (document.head || document.documentElement).appendChild(hide);

  var CSS = [
    ":host{position:fixed;top:0;left:0;right:0;z-index:900;display:block;font:15px/1.4 -apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;-webkit-text-size-adjust:100%}",
    "*{box-sizing:border-box}",
    "a,button{font:inherit;color:inherit;-webkit-tap-highlight-color:transparent}",
    "a{text-decoration:none}",
    ".bar{display:flex;align-items:center;gap:22px;height:64px;padding:0 max(20px,env(safe-area-inset-right)) 0 max(20px,env(safe-area-inset-left));background:rgba(6,9,18,.86);backdrop-filter:blur(16px) saturate(160%);-webkit-backdrop-filter:blur(16px) saturate(160%);border-bottom:1px solid rgba(255,255,255,.12);color:#F5F6FA}",
    ".brand{display:inline-flex;align-items:center;gap:10px;min-height:44px;font-size:19px;color:#F5F6FA;flex:none}",
    ".brand svg{width:30px;height:30px;flex:none}",
    ".brand b{font-weight:700}.brand span{font-weight:300}",
    ".links{display:flex;align-items:center;gap:4px;margin-inline-start:auto}",
    ".links a{display:inline-flex;align-items:center;min-height:44px;padding:0 12px;border-radius:10px;color:#C4C9D8;font-weight:500;font-size:14.5px;white-space:nowrap;position:relative;transition:color .15s,background .15s}",
    ".links a:hover{color:#fff;background:rgba(255,255,255,.07)}",
    ".links a[aria-current=page]{color:#fff}",
    ".links a[aria-current=page]::after{content:'';position:absolute;inset-inline:12px;bottom:6px;height:2px;border-radius:2px;background:#0A84FF}",
    ".links a.hl{border:1px solid rgba(255,196,87,.55);color:#FFD27A;margin-inline:4px}",
    ".links a.hl:hover{background:rgba(255,196,87,.12);color:#FFE2A6}",
    ".links a.hl[aria-current=page]{background:rgba(255,196,87,.16);color:#FFE2A6}",
    ".links a.hl[aria-current=page]::after{display:none}",
    ".cta{display:inline-flex;align-items:center;gap:6px;min-height:44px;padding:0 18px;border-radius:999px;background:linear-gradient(135deg,#0A84FF,#5E5CE6);color:#fff;font-weight:600;font-size:14.5px;white-space:nowrap;flex:none;box-shadow:0 6px 22px rgba(10,132,255,.32)}",
    ".cta:hover{filter:brightness(1.1)}",
    ".langslot{display:flex;align-items:center;flex:none}",
    ".langslot:empty{display:none}",
    ".langslot select{appearance:none;-webkit-appearance:none;min-height:44px;max-width:11em;padding:0 30px 0 14px;border-radius:999px;border:1px solid rgba(255,255,255,.22);background:rgba(255,255,255,.07) url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M1 1l4 4 4-4' fill='none' stroke='%23bbb' stroke-width='1.6'/%3E%3C/svg%3E\") no-repeat right 12px center;color:#F5F6FA;font:600 13.5px/1 -apple-system,system-ui,sans-serif;cursor:pointer}",
    ":host([dir=rtl]) .langslot select{padding:0 14px 0 30px;background-position:left 12px center}",
    ".langslot select option{color:#111;background:#fff}",
    ".tog{display:none;width:44px;height:44px;border:1px solid rgba(255,255,255,.18);border-radius:12px;background:transparent;color:#F5F6FA;cursor:pointer;align-items:center;justify-content:center}",
    ".tog svg{width:22px;height:22px}",
    ".panel{display:none}",
    "a:focus-visible,button:focus-visible{outline:2px solid #7AB8FF;outline-offset:2px}",
    "@media (max-width:1180px){",
    "  .bar{height:56px;gap:12px}",
    "  .links,.bar>.cta{display:none}",
    "  .tog{display:inline-flex}",
    "  .langslot{margin-inline-start:auto}",
    "  .panel{position:fixed;top:56px;left:0;right:0;max-height:calc(100vh - 56px);max-height:calc(100dvh - 56px);overflow:auto;background:rgba(6,9,18,.98);border-bottom:1px solid rgba(255,255,255,.14);padding:8px 20px 20px;transform:translateY(-8px);opacity:0;visibility:hidden;transition:opacity .18s,transform .18s,visibility .18s}",
    "  .panel.open{display:block;opacity:1;transform:none;visibility:visible}",
    "  .panel a.i{display:flex;align-items:center;min-height:52px;padding:0 4px;border-bottom:1px solid rgba(255,255,255,.1);color:#E4E7F0;font-size:17px;font-weight:500}",
    "  .panel a.i[aria-current=page]{color:#fff;box-shadow:inset 3px 0 0 #0A84FF;padding-inline-start:12px}",
    "  .panel a.i.hl{color:#FFD27A}",
    "  .panel .cta{display:flex;justify-content:center;margin-top:16px;min-height:50px}",
    "}",
    "@media (max-width:480px){.bar{padding:0 12px;gap:8px}.langslot select{max-width:7.6em;padding-inline-start:10px}}",
    "@media (prefers-reduced-motion:reduce){*{transition:none!important}}"
  ].join("\n");

  var LOGO = '<svg viewBox="0 0 64 64" aria-hidden="true"><defs><linearGradient id="tbg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0A84FF"/><stop offset="1" stop-color="#5E5CE6"/></linearGradient></defs><path d="M32 2c20 0 30 10 30 30s-10 30-30 30S2 52 2 32 12 2 32 2Z" fill="url(#tbg)"/><circle cx="32" cy="32" r="13" fill="none" stroke="#fff" stroke-width="3.4"/><path d="M40 40 L48 48" stroke="#fff" stroke-width="3.4" stroke-linecap="round"/><circle cx="32" cy="32" r="2.2" fill="#fff"/></svg>';
  var BURGER = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>';
  var XICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';

  var host, root, tog, panel, lang;
  var path = (location.pathname.replace(/index\.html$/, "") || "/");

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  function render(code) {
    lang = L[code] ? code : "en";
    var t = L[lang];
    host.setAttribute("dir", RTL[lang] ? "rtl" : "ltr");
    host.setAttribute("lang", lang);
    var items = LINKS.map(function (it) {
      var cur = it.on && it.on(path) ? ' aria-current="page"' : "";
      return { it: it, cur: cur, txt: esc(t[it.k]) };
    });
    var desk = items.map(function (x) { return '<a href="' + x.it.href + '"' + x.cur + (x.it.hl ? ' class="hl"' : "") + ">" + x.txt + "</a>"; }).join("");
    var mob = items.map(function (x) { return '<a class="i' + (x.it.hl ? " hl" : "") + '" href="' + x.it.href + '"' + x.cur + ">" + x.txt + "</a>"; }).join("");
    var cta = '<a class="cta" href="https://tebiq.com" target="_blank" rel="noopener">' + esc(t.cta) + " <span aria-hidden=\"true\">" + (RTL[lang] ? "←" : "→") + "</span></a>";
    var moved = root.querySelector(".langslot > select");
    if (moved) moved.remove();
    root.innerHTML = "<style>" + CSS + "</style>" +
      '<div class="bar"><a class="brand" href="/" aria-label="' + esc(t.home) + '">' + LOGO + "<div><span>teb</span><b>Scribe</b></div></a>" +
      '<nav class="links" aria-label="' + esc(t.label) + '">' + desk + "</nav>" + '<div class="langslot"></div>' + cta +
      '<button class="tog" type="button" aria-expanded="false" aria-controls="tbn-panel" aria-label="' + esc(t.menu) + '">' + BURGER + "</button></div>" +
      '<nav class="panel" id="tbn-panel" aria-label="' + esc(t.label) + '">' + mob + cta + "</nav>";
    if (moved) root.querySelector(".langslot").appendChild(moved);
    tog = root.querySelector(".tog");
    panel = root.querySelector(".panel");
    tog.addEventListener("click", function () { setOpen(!panel.classList.contains("open")); });
    panel.addEventListener("click", function (e) { if (e.target.closest && e.target.closest("a")) setOpen(false); });
  }

  function setOpen(on) {
    panel.classList.toggle("open", on);
    tog.setAttribute("aria-expanded", on ? "true" : "false");
    tog.setAttribute("aria-label", L[lang][on ? "close" : "menu"]);
    tog.innerHTML = on ? XICON : BURGER;
  }

  // A page's own language chooser (select.j3d-lang from i18n-*.js, or select.tb-lang) lives in the old
  // menu bar, which is now hidden; adopt it into the shared bar so it keeps working.
  function adoptLang() {
    var sel = document.querySelector("select.j3d-lang, select.tb-lang");
    if (sel && root.querySelector(".langslot") && !root.contains(sel)) {
      root.querySelector(".langslot").appendChild(sel);
      measure();
    }
  }

  function measure() {
    var h = host.getBoundingClientRect().height || 64;
    document.documentElement.style.setProperty("--tbn-h", Math.round(h) + "px");
    return h;
  }

  function mount() {
    var legacy = document.querySelector("[data-tb-legacy-nav]");
    var legacyFixed = false;
    if (legacy) { try { legacyFixed = getComputedStyle(legacy).position === "fixed"; } catch (e) {} }
    // The shared bar is fixed. A page whose old menu was fixed already leaves room for it; a page
    // whose old menu sat in the flow (or had none) gets the room reserved here.
    var needPad = !legacyFixed && !document.documentElement.hasAttribute("data-tb-nav-pad-off");
    host = document.createElement("div");
    host.id = "tb-nav";
    root = host.attachShadow({ mode: "open" });
    render(pickLang());
    document.body.insertBefore(host, document.body.firstChild);
    adoptLang();
    window.addEventListener("load", adoptLang);
    var h = measure();
    if (needPad) document.body.style.paddingTop = Math.round(h) + "px";
    window.addEventListener("resize", function () {
      var nh = measure();
      if (needPad) document.body.style.paddingTop = Math.round(nh) + "px";
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && panel.classList.contains("open")) { setOpen(false); tog.focus(); }
    });
    document.addEventListener("click", function (e) {
      if (panel.classList.contains("open") && !host.contains(e.target)) setOpen(false);
    });
    window.addEventListener("tb:lang", function (e) {
      var c = String((e && e.detail) || "").toLowerCase().split("-")[0];
      render(L[c] ? c : "en");
      measure();
    });
  }

  window.TBNav = { setLang: function (c) { window.dispatchEvent(new CustomEvent("tb:lang", { detail: c })); } };

  if (document.body) mount();
  else document.addEventListener("DOMContentLoaded", mount);
})();
