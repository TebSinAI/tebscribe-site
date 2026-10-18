// tebCapture PERSONAL MODEL GATEWAY — the COMPUTER (web receiver) side.
//
// "Your phone asks; this computer answers using YOUR key." A SAVED (remembered)
// pairing on the phone sends a signed, encrypted request through the ciphertext-only
// relay; this computer decrypts it, enforces consent/child-safeguard/budget/rate,
// calls the model provider YOU configured with YOUR credential, then encrypts + signs
// an INERT suggestion back. The relay never sees plaintext; the phone never receives a
// provider credential. Guest (QR) sessions cannot use the gateway — they get the
// `savedComputerRequired` state.
//
// Classic script (NOT a module) so it shares tebcapture.html's global scope and loads
// after tebcapture-chunk-crypto.js. Also `module.exports` for the Node cross-language
// test. Everything network/crypto/storage/time related is dependency-injected so the
// gateway runs headless in Node against a fake relay + fake provider.
//
// PROTOCOL v1 (pinned — founder chat brief 2026-08-19; see docs/GATEWAY-CONTRACT.md and
// the executable copy tests/gen_gateway_vector.py). Do NOT change a constant without
// regenerating tests/gateway_v1_vector.json AND reconciling the iOS lane's vector:
//   reqKey  = HKDF-SHA256(pairSecret, salt "tebcapture-gw-req-v1",  info "<sid>|<request_id>", 32)
//   respKey = HKDF-SHA256(pairSecret, salt "tebcapture-gw-resp-v1", info "<sid>|<request_id>", 32)
//   IV      = HKDF-SHA256(dirKey,     salt "tebcapture-gw-iv-v1",   info "<request_id>|<seq>", 12)
//   ct      = AES-256-GCM(dirKey, IV, aad "<request_id>|<seq>|<direction>")   direction ∈ {req,resp}
//   meta    = canonical JSON (sorted keys, no spaces) {byte_count,ct_sha256,direction,request_id,seq,sid}
//   sig     = Ed25519(signPriv, utf8(meta))   phone signs req; receiver signs resp
//   relay   : PUT/GET/DELETE {RELAY}/api/capture/gateway/{request_id}/{direction}/{seq}
//             body ≤ 64 KiB application/x-tebcapture-gw; headers X-TC-Sig, X-TC-Meta (b64url)
//
// SECURITY: provider credentials live ONLY here — WebCrypto AES-GCM in IndexedDB under a
// PBKDF2-SHA256(≥600k) passphrase key, unlocked per browser session, never logged, never
// sent to the phone or the relay. Only api.anthropic.com / api.openai.com / localhost:11434
// are reachable (SSRF allowlist). Model providers see the request text under THEIR terms.

(function (root) {
  "use strict";

  // ---- constants (pinned) ------------------------------------------------------
  var GW_REQ_SALT = "tebcapture-gw-req-v1";
  var GW_RESP_SALT = "tebcapture-gw-resp-v1";
  var GW_IV_SALT = "tebcapture-gw-iv-v1";
  var GW_CONTENT_TYPE = "application/x-tebcapture-gw";
  var MAX_BODY_BYTES = 64 * 1024;
  var PBKDF2_ITERS = 600000;
  var PROVIDER_TIMEOUT_MS = 30000;
  var DEFAULT_DAILY_BUDGET_USD = 1.0;
  var DEFAULT_RATE_PER_MIN = 10;
  var GATEWAY_TTL_MS = 10 * 60 * 1000;

  // Endpoint allowlist — the ONLY origins an adapter may reach (SSRF guard).
  var ENDPOINT_ALLOWLIST = [
    "https://api.anthropic.com",
    "https://api.openai.com",
    "http://localhost:11434",
  ];

  // Truthful static catalog. Model lists may go stale; a provider adapter can offer an
  // optional live list (Ollama /api/tags). No fabricated model names beyond these pins.
  var PROVIDER_CATALOG = [
    {
      provider_id: "anthropic",
      label: "Anthropic (Claude)",
      endpoint: "https://api.anthropic.com",
      credential: "api_key",
      models: ["claude-sonnet-5", "claude-opus-4-8", "claude-haiku-4-5-20251001"],
      default_model: "claude-sonnet-5",
    },
    {
      provider_id: "openai",
      label: "OpenAI",
      endpoint: "https://api.openai.com",
      credential: "api_key",
      models: ["gpt-4o", "gpt-4o-mini"],
      default_model: "gpt-4o-mini",
    },
    {
      provider_id: "ollama-local",
      label: "Ollama (this computer only)",
      endpoint: "http://localhost:11434",
      credential: "none",
      models: ["llama3.1", "qwen2.5"],
      default_model: "llama3.1",
      live_list: true,
    },
  ];

  var ALLOWED_KINDS = ["caption", "title", "hashtags", "shotlist", "voice_note_summary"];

  // ---- byte / base64url helpers (unpadded RFC 4648 §5) -------------------------
  function b64url(bytes) {
    var b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    var bin = "";
    for (var i = 0; i < b.length; i++) bin += String.fromCharCode(b[i]);
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  function b64urlDecode(str) {
    var s = String(str || "").replace(/-/g, "+").replace(/_/g, "/");
    while (s.length % 4) s += "=";
    var bin = atob(s);
    var out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  function utf8(str) { return new TextEncoder().encode(str); }
  function fromUtf8(bytes) { return new TextDecoder().decode(bytes); }
  function concatBytes(a, b) {
    var out = new Uint8Array(a.length + b.length);
    out.set(a, 0); out.set(b, a.length); return out;
  }
  function toHex(bytes) {
    var s = ""; for (var i = 0; i < bytes.length; i++) s += bytes[i].toString(16).padStart(2, "0");
    return s;
  }

  // ---- HKDF-SHA256 (RFC 5869) via HMAC — portable, matches tebcapture-chunk-crypto --
  function subtle() {
    if (root.crypto && root.crypto.subtle) return root.crypto.subtle;
    throw new Error("WebCrypto unavailable");
  }
  async function hmac(keyBytes, data) {
    var k = await subtle().importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    return new Uint8Array(await subtle().sign("HMAC", k, data));
  }
  async function hkdf(ikm, salt, info, length) {
    var prk = await hmac(salt && salt.length ? salt : new Uint8Array(32), ikm);
    var out = new Uint8Array(length);
    var t = new Uint8Array(0), pos = 0, counter = 1;
    while (pos < length) {
      var block = new Uint8Array(t.length + info.length + 1);
      block.set(t, 0); block.set(info, t.length); block[block.length - 1] = counter;
      t = await hmac(prk, block);
      var n = Math.min(t.length, length - pos);
      out.set(t.subarray(0, n), pos); pos += n; counter++;
    }
    return out;
  }
  async function sha256(bytes) { return new Uint8Array(await subtle().digest("SHA-256", bytes)); }
  async function sha256hex(bytes) { return toHex(await sha256(bytes)); }

  // ---- gateway key schedule ----------------------------------------------------
  function reqKey(pairSecret, sid, requestId) {
    return hkdf(pairSecret, utf8(GW_REQ_SALT), utf8(sid + "|" + requestId), 32);
  }
  function respKey(pairSecret, sid, requestId) {
    return hkdf(pairSecret, utf8(GW_RESP_SALT), utf8(sid + "|" + requestId), 32);
  }
  function gwIV(dirKey, requestId, seq) {
    return hkdf(dirKey, utf8(GW_IV_SALT), utf8(requestId + "|" + seq), 12);
  }
  // Canonical JSON: keys sorted, separators (",",":"), no whitespace. Six fields only.
  function canonicalMeta(sid, requestId, seq, direction, ctSha256, byteCount) {
    return (
      '{"byte_count":' + byteCount +
      ',"ct_sha256":"' + ctSha256 +
      '","direction":"' + direction +
      '","request_id":"' + requestId +
      '","seq":' + seq +
      ',"sid":"' + sid + '"}'
    );
  }

  async function sealChunk(dirKey, requestId, seq, direction, plaintext) {
    var iv = await gwIV(dirKey, requestId, seq);
    var key = await subtle().importKey("raw", dirKey, { name: "AES-GCM", length: 256 }, false, ["encrypt"]);
    var aad = utf8(requestId + "|" + seq + "|" + direction);
    var ct = new Uint8Array(await subtle().encrypt({ name: "AES-GCM", iv: iv, additionalData: aad }, key, plaintext));
    return { iv: iv, ct: ct };
  }
  async function openChunk(dirKey, requestId, seq, direction, ct) {
    var iv = await gwIV(dirKey, requestId, seq);
    var key = await subtle().importKey("raw", dirKey, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
    var aad = utf8(requestId + "|" + seq + "|" + direction);
    var pt = await subtle().decrypt({ name: "AES-GCM", iv: iv, additionalData: aad }, key, ct);
    return new Uint8Array(pt);
  }

  // ---- Ed25519 (WebCrypto; raw pub + pkcs8-wrapped seed) -----------------------
  var PKCS8_ED25519_PREFIX = Uint8Array.from(
    [0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x04, 0x22, 0x04, 0x20]
  );
  async function edPrivFromSeed(seed32) {
    var pkcs8 = concatBytes(PKCS8_ED25519_PREFIX, seed32);
    return subtle().importKey("pkcs8", pkcs8, { name: "Ed25519" }, false, ["sign"]);
  }
  async function edPubFromRaw(pub32) {
    return subtle().importKey("raw", pub32, { name: "Ed25519" }, false, ["verify"]);
  }
  async function edSign(privKey, msgBytes) {
    return new Uint8Array(await subtle().sign({ name: "Ed25519" }, privKey, msgBytes));
  }
  async function edVerify(pubKey, sig, msgBytes) {
    return subtle().verify({ name: "Ed25519" }, pubKey, sig, msgBytes);
  }

  // Package a plaintext chunk into the exact wire shape (body + X-TC-Meta + X-TC-Sig).
  // `signPriv` is a CryptoKey: phone identity for direction "req", receiver for "resp".
  async function packageChunk(dirKey, signPriv, sid, requestId, seq, direction, plaintext) {
    if (plaintext.length > MAX_BODY_BYTES) throw new Error("chunk plaintext exceeds cap");
    var sealed = await sealChunk(dirKey, requestId, seq, direction, plaintext);
    if (sealed.ct.length > MAX_BODY_BYTES) throw new Error("chunk ciphertext exceeds 64 KiB cap");
    var ctSha = await sha256hex(sealed.ct);
    var meta = canonicalMeta(sid, requestId, seq, direction, ctSha, sealed.ct.length);
    var sig = await edSign(signPriv, utf8(meta));
    return {
      body: sealed.ct,
      ct_sha256: ctSha,
      byte_count: sealed.ct.length,
      meta: meta,
      headers: { "X-TC-Meta": b64url(utf8(meta)), "X-TC-Sig": b64url(sig) },
    };
  }

  // Verify + decrypt an inbound chunk. Fails CLOSED on any mismatch (signature, digest,
  // AAD/IV, field agreement). `verifyPub` is the peer's identity CryptoKey.
  async function verifyAndOpen(dirKey, verifyPub, sid, requestId, seq, direction, body, headers) {
    var metaB64 = headers["X-TC-Meta"] || headers["x-tc-meta"];
    var sigB64 = headers["X-TC-Sig"] || headers["x-tc-sig"];
    if (!metaB64 || !sigB64) throw new Error("missing X-TC-Meta / X-TC-Sig");
    var metaBytes = b64urlDecode(metaB64);
    var meta;
    try { meta = JSON.parse(fromUtf8(metaBytes)); } catch (_) { throw new Error("meta not JSON"); }
    if (meta.sid !== sid || meta.request_id !== requestId || meta.seq !== seq || meta.direction !== direction) {
      throw new Error("meta field mismatch");
    }
    var okSig = await edVerify(verifyPub, b64urlDecode(sigB64), metaBytes);
    if (!okSig) throw new Error("signature invalid");
    if (body.length !== meta.byte_count) throw new Error("byte_count mismatch");
    var ctSha = await sha256hex(body);
    if (ctSha !== meta.ct_sha256) throw new Error("ct_sha256 mismatch");
    // Re-serialise canonically and compare — rejects noncanonical / extra-field metas.
    if (canonicalMeta(sid, requestId, seq, direction, meta.ct_sha256, meta.byte_count) !==
        fromUtf8(metaBytes)) {
      throw new Error("meta not canonical");
    }
    var pt = await openChunk(dirKey, requestId, seq, direction, body);
    return { plaintext: pt, meta: meta };
  }

  var crypto = {
    REQ_SALT: GW_REQ_SALT, RESP_SALT: GW_RESP_SALT, IV_SALT: GW_IV_SALT,
    MAX_BODY_BYTES: MAX_BODY_BYTES, CONTENT_TYPE: GW_CONTENT_TYPE,
    b64url: b64url, b64urlDecode: b64urlDecode, utf8: utf8, fromUtf8: fromUtf8,
    hkdf: hkdf, sha256: sha256, sha256hex: sha256hex,
    reqKey: reqKey, respKey: respKey, gwIV: gwIV, canonicalMeta: canonicalMeta,
    sealChunk: sealChunk, openChunk: openChunk,
    edPrivFromSeed: edPrivFromSeed, edPubFromRaw: edPubFromRaw, edSign: edSign, edVerify: edVerify,
    packageChunk: packageChunk, verifyAndOpen: verifyAndOpen,
  };

  // ---- credential vault: PBKDF2-SHA256(≥600k) → AES-GCM in IndexedDB ------------
  // Storage is injectable: browser uses IndexedDB (idbStore), Node injects memory.
  function memoryStore() {
    var map = {};
    return {
      get: function (k) { return Promise.resolve(k in map ? map[k] : null); },
      set: function (k, v) { map[k] = v; return Promise.resolve(); },
      del: function (k) { delete map[k]; return Promise.resolve(); },
    };
  }
  function idbStore(dbName, storeName) {
    dbName = dbName || "tebcapture-gw"; storeName = storeName || "vault";
    function withStore(mode, fn) {
      return new Promise(function (resolve, reject) {
        var open = root.indexedDB.open(dbName, 1);
        open.onupgradeneeded = function () { open.result.createObjectStore(storeName); };
        open.onerror = function () { reject(open.error); };
        open.onsuccess = function () {
          var db = open.result;
          var tx = db.transaction(storeName, mode);
          var req = fn(tx.objectStore(storeName));
          tx.oncomplete = function () { db.close(); resolve(req && req.result); };
          tx.onerror = function () { db.close(); reject(tx.error); };
        };
      });
    }
    return {
      get: function (k) { return withStore("readonly", function (s) { return s.get(k); }); },
      set: function (k, v) { return withStore("readwrite", function (s) { s.put(v, k); }); },
      del: function (k) { return withStore("readwrite", function (s) { s.delete(k); }); },
    };
  }

  // The vault holds ONE encrypted blob per provider_id. The passphrase-derived AES key
  // lives only in memory for the session; lock() drops it. Plaintext credentials never
  // touch the store, a log, the phone, or the relay.
  function makeVault(store, opts) {
    store = store || (root.indexedDB ? idbStore() : memoryStore());
    var iters = (opts && opts.iterations) || PBKDF2_ITERS;
    var sessionKey = null;   // AES-GCM CryptoKey
    var sessionSalt = null;

    async function deriveKey(passphrase, salt) {
      var base = await subtle().importKey("raw", utf8(passphrase), { name: "PBKDF2" }, false, ["deriveKey"]);
      return subtle().deriveKey(
        { name: "PBKDF2", salt: salt, iterations: iters, hash: "SHA-256" },
        base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
    }
    async function unlock(passphrase) {
      var salt = await store.get("__salt__");
      if (!salt) {
        salt = new Uint8Array(16); root.crypto.getRandomValues(salt);
        await store.set("__salt__", Array.from(salt));
      } else {
        salt = Uint8Array.from(salt);
      }
      sessionKey = await deriveKey(passphrase, salt);
      sessionSalt = salt;
      // Prove the passphrase against a stored verifier (first unlock writes it).
      var verifier = await store.get("__verifier__");
      if (!verifier) {
        var iv = new Uint8Array(12); root.crypto.getRandomValues(iv);
        var ct = new Uint8Array(await subtle().encrypt({ name: "AES-GCM", iv: iv }, sessionKey, utf8("tebcapture-gw-vault-v1")));
        await store.set("__verifier__", { iv: Array.from(iv), ct: Array.from(ct) });
        return true;
      }
      try {
        var pt = await subtle().decrypt(
          { name: "AES-GCM", iv: Uint8Array.from(verifier.iv) }, sessionKey, Uint8Array.from(verifier.ct));
        if (fromUtf8(new Uint8Array(pt)) !== "tebcapture-gw-vault-v1") throw new Error("bad");
        return true;
      } catch (_) {
        sessionKey = null; sessionSalt = null;
        throw new Error("wrong passphrase");
      }
    }
    function lock() { sessionKey = null; sessionSalt = null; }
    function isUnlocked() { return !!sessionKey; }
    async function setCredential(providerId, secret) {
      if (!sessionKey) throw new Error("vault locked");
      var iv = new Uint8Array(12); root.crypto.getRandomValues(iv);
      var ct = new Uint8Array(await subtle().encrypt({ name: "AES-GCM", iv: iv }, sessionKey, utf8(secret)));
      await store.set("cred:" + providerId, { iv: Array.from(iv), ct: Array.from(ct) });
    }
    async function getCredential(providerId) {
      if (!sessionKey) throw new Error("vault locked");
      var blob = await store.get("cred:" + providerId);
      if (!blob) return null;
      var pt = await subtle().decrypt(
        { name: "AES-GCM", iv: Uint8Array.from(blob.iv) }, sessionKey, Uint8Array.from(blob.ct));
      return fromUtf8(new Uint8Array(pt));
    }
    async function hasCredential(providerId) {
      return !!(await store.get("cred:" + providerId));
    }
    async function removeCredential(providerId) { await store.del("cred:" + providerId); }

    return {
      unlock: unlock, lock: lock, isUnlocked: isUnlocked,
      setCredential: setCredential, getCredential: getCredential,
      hasCredential: hasCredential, removeCredential: removeCredential,
    };
  }

  // ---- provider adapters (normalized interface) --------------------------------
  function assertAllowedUrl(url) {
    var origin;
    try { origin = new URL(url).origin; } catch (_) { throw new Error("bad url"); }
    if (ENDPOINT_ALLOWLIST.indexOf(origin) === -1) throw new Error("endpoint not allowed: " + origin);
    return url;
  }
  function catalogFor(providerId) {
    for (var i = 0; i < PROVIDER_CATALOG.length; i++) if (PROVIDER_CATALOG[i].provider_id === providerId) return PROVIDER_CATALOG[i];
    return null;
  }
  // Deterministic prompt from a gateway request — inert, text-only, no media bytes.
  function buildPrompt(req) {
    var cs = (req.inputs && req.inputs.clip_signals) || {};
    var lines = [
      "You generate a short social-media " + req.kind + " for a video the user shot.",
      "You receive only deterministic analysis, never the footage.",
      "Signals: " + JSON.stringify(cs),
    ];
    if (req.inputs && req.inputs.user_text) lines.push("User note: " + req.inputs.user_text);
    lines.push("Reply with the " + req.kind + " only, no preamble.");
    return lines.join("\n");
  }
  function withTimeout(fetchImpl, timeoutMs) {
    return function (url, init) {
      var ctrl = new AbortController();
      var t = setTimeout(function () { ctrl.abort(); }, timeoutMs);
      init = Object.assign({}, init, { signal: ctrl.signal });
      return fetchImpl(url, init).finally(function () { clearTimeout(t); });
    };
  }
  var adapters = {
    anthropic: async function (opts) {
      var url = assertAllowedUrl("https://api.anthropic.com/v1/messages");
      var r = await opts.fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": opts.apiKey,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model: opts.model, max_tokens: opts.maxTokens,
          messages: [{ role: "user", content: opts.prompt }],
        }),
      });
      if (!r.ok) return { status: httpStatus(r.status), http: r.status };
      var j = await r.json();
      var text = (j.content && j.content[0] && j.content[0].text) || "";
      var usage = j.usage || {};
      return {
        status: "ok", provider_id: "anthropic", model_id: j.model || opts.model,
        suggestions: [{ text: text }],
        usage: { in_tokens: usage.input_tokens || 0, out_tokens: usage.output_tokens || 0 },
      };
    },
    openai: async function (opts) {
      var url = assertAllowedUrl("https://api.openai.com/v1/chat/completions");
      var r = await opts.fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: "Bearer " + opts.apiKey },
        body: JSON.stringify({
          model: opts.model, max_tokens: opts.maxTokens,
          messages: [{ role: "user", content: opts.prompt }],
        }),
      });
      if (!r.ok) return { status: httpStatus(r.status), http: r.status };
      var j = await r.json();
      var text = (j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || "";
      var u = j.usage || {};
      return {
        status: "ok", provider_id: "openai", model_id: j.model || opts.model,
        suggestions: [{ text: text }],
        usage: { in_tokens: u.prompt_tokens || 0, out_tokens: u.completion_tokens || 0 },
      };
    },
    "ollama-local": async function (opts) {
      var url = assertAllowedUrl("http://localhost:11434/api/chat");
      var r = await opts.fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          model: opts.model, stream: false,
          messages: [{ role: "user", content: opts.prompt }],
        }),
      });
      if (!r.ok) return { status: httpStatus(r.status), http: r.status };
      var j = await r.json();
      var text = (j.message && j.message.content) || "";
      return {
        status: "ok", provider_id: "ollama-local", model_id: j.model || opts.model,
        suggestions: [{ text: text }],
        usage: { in_tokens: j.prompt_eval_count || 0, out_tokens: j.eval_count || 0 },
      };
    },
  };
  function httpStatus(code) {
    if (code === 401 || code === 403) return "denied";
    return "provider_error";
  }

  // ---- policy: consent / child-safeguard / budget / rate + visible ledger ------
  function makePolicy(opts) {
    opts = opts || {};
    var clock = opts.clock || function () { return Date.now(); };
    var dailyBudget = opts.dailyBudgetUsd != null ? opts.dailyBudgetUsd : DEFAULT_DAILY_BUDGET_USD;
    var ratePerMin = opts.ratePerMin || DEFAULT_RATE_PER_MIN;
    var consented = {};                 // project_id -> true
    var minorProjects = opts.minorProjects || {};   // project_id -> true (child-safeguard)
    var recentTimestamps = [];          // for the sliding 60s rate window
    var spendByDay = {};                // "YYYY-MM-DD" -> usd
    var ledger = [];

    function dayKey(ts) { return new Date(ts).toISOString().slice(0, 10); }
    function isConsented(projectId) { return !!consented[projectId]; }
    function grantConsent(projectId) { consented[projectId] = true; }
    function revokeConsent(projectId) { delete consented[projectId]; }
    function markMinor(projectId, isMinor) { if (isMinor) minorProjects[projectId] = true; else delete minorProjects[projectId]; }

    // Returns {ok:true} or {ok:false, status:"denied"|"budget"} — receiver-enforced.
    function check(projectId, estCostUsd) {
      if (minorProjects[projectId]) return { ok: false, status: "denied", reason: "minor_safeguard" };
      if (!consented[projectId]) return { ok: false, status: "denied", reason: "consent_required" };
      var now = clock();
      recentTimestamps = recentTimestamps.filter(function (t) { return now - t < 60000; });
      if (recentTimestamps.length >= ratePerMin) return { ok: false, status: "denied", reason: "rate_limited" };
      var spent = spendByDay[dayKey(now)] || 0;
      if (spent + (estCostUsd || 0) > dailyBudget) return { ok: false, status: "budget", reason: "daily_budget" };
      return { ok: true };
    }
    function reserve() { recentTimestamps.push(clock()); }
    function record(entry) {
      var now = clock();
      var cost = (entry.usage && entry.usage.cost_usd) || 0;
      if (entry.status === "ok") spendByDay[dayKey(now)] = (spendByDay[dayKey(now)] || 0) + cost;
      ledger.push(Object.assign({ ts: now }, entry));
      if (ledger.length > 200) ledger.shift();
    }
    function spentToday() { return spendByDay[dayKey(clock())] || 0; }

    return {
      isConsented: isConsented, grantConsent: grantConsent, revokeConsent: revokeConsent,
      markMinor: markMinor, check: check, reserve: reserve, record: record,
      ledger: ledger, spentToday: spentToday,
      dailyBudget: dailyBudget, ratePerMin: ratePerMin,
    };
  }

  // ---- relay client (gateway endpoints) ----------------------------------------
  function relayClient(relayOrigin, sessionToken, fetchImpl) {
    var base = String(relayOrigin || "").replace(/\/$/, "");
    function path(requestId, direction, seq) {
      return base + "/api/capture/gateway/" + encodeURIComponent(requestId) + "/" + direction + "/" + seq;
    }
    function auth() { return sessionToken ? { authorization: "Bearer " + sessionToken } : {}; }
    return {
      getChunk: async function (requestId, direction, seq) {
        var r = await fetchImpl(path(requestId, direction, seq), { method: "GET", headers: auth() });
        if (r.status === 404) return null;
        if (!r.ok) throw new Error("relay get " + r.status);
        var body = new Uint8Array(await r.arrayBuffer());
        return { body: body, headers: { "X-TC-Meta": r.headers.get("X-TC-Meta"), "X-TC-Sig": r.headers.get("X-TC-Sig") } };
      },
      putChunk: async function (requestId, direction, seq, pkg) {
        var headers = Object.assign({ "content-type": GW_CONTENT_TYPE }, auth(), pkg.headers);
        var r = await fetchImpl(path(requestId, direction, seq), { method: "PUT", headers: headers, body: pkg.body });
        if (!r.ok) throw new Error("relay put " + r.status);
        return true;
      },
      del: async function (requestId) {
        var r = await fetchImpl(base + "/api/capture/gateway/" + encodeURIComponent(requestId), { method: "DELETE", headers: auth() });
        return r.ok || r.status === 404;
      },
    };
  }

  // Short-code for typed pairing: real one from the relay when it offers it, else a
  // stable sid-prefix fallback (relay returns 404 until the endpoint ships).
  async function fetchShortCode(relayOrigin, sid, sessionToken, fetchImpl) {
    var base = String(relayOrigin || "").replace(/\/$/, "");
    fetchImpl = fetchImpl || root.fetch;
    try {
      var r = await fetchImpl(base + "/api/capture/session/code", {
        method: "POST",
        headers: Object.assign({ "content-type": "application/json" },
          sessionToken ? { authorization: "Bearer " + sessionToken } : {}),
        body: JSON.stringify({ sid: sid }),
      });
      if (r.ok) {
        var j = await r.json();
        if (j && j.code) return { code: String(j.code), source: "relay" };
      }
    } catch (_) { /* fall through to sid prefix */ }
    var prefix = String(sid || "").replace(/[^A-Za-z0-9]/g, "").slice(0, 8).toUpperCase() || "--------";
    return { code: prefix, source: "sid-prefix" };
  }

  // ---- orchestrator ------------------------------------------------------------
  // Handles ONE gateway request end-to-end: fetch req chunk(s), verify phone signature,
  // decrypt, enforce policy, call provider (30s), encrypt+sign response, PUT it back.
  // DELETE ownership: whoever produces the LAST object cleans up. When the receiver
  // uploads a response (ok OR a terminal denial), it leaves it for the phone to GET —
  // the phone (or the relay's 10-min TTL) DELETEs the request_id afterward. The receiver
  // DELETEs the request_id itself ONLY when it uploads NO response (schema/verify error,
  // cancellation, revocation) — purging an unanswerable request.
  function makeOrchestrator(deps) {
    var relay = deps.relay;                     // relayClient
    var vault = deps.vault;                     // makeVault
    var policy = deps.policy;                   // makePolicy
    var sid = deps.sid;
    var pairSecret = deps.pairSecret;           // Uint8Array (saved pairing)
    var receiverSignPriv = deps.receiverSignPriv;   // CryptoKey (Ed25519 receiver identity)
    var phoneSignPub = deps.phoneSignPub;       // CryptoKey (Ed25519 paired phone identity)
    var providerAdapters = deps.adapters || adapters;
    var fetchImpl = deps.fetch || root.fetch;
    var costModel = deps.costModel || function () { return 0; };   // usd estimate per request
    var timeoutMs = deps.timeoutMs || PROVIDER_TIMEOUT_MS;
    var onLedger = deps.onLedger || function () {};
    var cancelled = {};                          // request_id -> true

    function cancel(requestId) { cancelled[requestId] = true; }
    function revoke() { deps.revoked = true; }

    async function respond(requestId, respObj) {
      var pt = utf8(JSON.stringify(respObj));
      var rk = await respKey(pairSecret, sid, requestId);
      var pkg = await packageChunk(rk, receiverSignPriv, sid, requestId, 0, "resp", pt);
      await relay.putChunk(requestId, "resp", 0, pkg);
    }

    async function handle(signal) {
      var requestId = signal.request_id;
      var entry = { request_id: requestId, status: "provider_error" };
      try {
        if (deps.revoked || cancelled[requestId]) { await relay.del(requestId); return { status: "cancelled" }; }

        var chunk = await relay.getChunk(requestId, "req", signal.seq != null ? signal.seq : 0);
        if (!chunk) return { status: "gone" };

        var rk = await reqKey(pairSecret, sid, requestId);
        var opened = await verifyAndOpen(rk, phoneSignPub, sid, requestId, signal.seq != null ? signal.seq : 0, "req", chunk.body, chunk.headers);
        var req = JSON.parse(fromUtf8(opened.plaintext));

        // Schema/shape enforcement (fail closed on anything off-contract).
        if (req.v !== 1 || req.request_id !== requestId || ALLOWED_KINDS.indexOf(req.kind) === -1) {
          throw new Error("request schema invalid");
        }
        entry.project_id = req.project_id; entry.kind = req.kind;

        var est = costModel(req);
        var verdict = policy.check(req.project_id, est);
        if (!verdict.ok) {
          entry.status = verdict.status;
          var denied = { v: 1, request_id: requestId, status: verdict.status, reason: verdict.reason,
            provider_id: null, model_id: null, suggestions: [], usage: { in_tokens: 0, out_tokens: 0 } };
          // A denial IS a response the phone must read — leave it for the phone to
          // GET (phone/TTL DELETEs the request_id afterward; see respond() note).
          if (!deps.revoked && !cancelled[requestId]) await respond(requestId, denied);
          policy.record(entry); onLedger(policy.ledger);
          return { status: verdict.status };
        }
        policy.reserve();

        var providerId = req.provider_id || deps.defaultProvider || "anthropic";
        var cat = catalogFor(providerId);
        if (!cat) throw new Error("unknown provider");
        var model = req.model_id || cat.default_model;
        var apiKey = cat.credential === "none" ? null : await vault.getCredential(providerId);
        if (cat.credential !== "none" && !apiKey) {
          entry.status = "denied";
          var noKey = { v: 1, request_id: requestId, status: "denied", reason: "no_credential",
            provider_id: providerId, model_id: model, suggestions: [], usage: { in_tokens: 0, out_tokens: 0 } };
          if (!deps.revoked && !cancelled[requestId]) await respond(requestId, noKey);
          policy.record(entry); onLedger(policy.ledger);
          return { status: "denied" };
        }

        var adapter = providerAdapters[providerId];
        var result = await adapter({
          fetch: withTimeout(fetchImpl, timeoutMs),
          apiKey: apiKey, model: model, prompt: buildPrompt(req),
          maxTokens: Math.min(req.budget_tokens || 1000, 4000),
        });

        if (deps.revoked || cancelled[requestId]) { await relay.del(requestId); entry.status = "cancelled"; policy.record(entry); onLedger(policy.ledger); return { status: "cancelled" }; }

        var usage = result.usage || { in_tokens: 0, out_tokens: 0 };
        usage.cost_usd = est;
        var respObj = {
          v: 1, request_id: requestId, status: result.status || "provider_error",
          provider_id: providerId, model_id: result.model_id || model,
          suggestions: result.suggestions || [], usage: usage,
        };
        // Deliver the response and STOP — the phone GETs it, then the phone (or the
        // relay's 10-min TTL) DELETEs the request_id. Deleting here would wipe the
        // response before the phone can read it.
        await respond(requestId, respObj);
        entry.status = respObj.status; entry.provider_id = providerId; entry.model_id = respObj.model_id; entry.usage = usage;
        policy.record(entry); onLedger(policy.ledger);
        return { status: respObj.status, response: respObj };
      } catch (e) {
        entry.error = String(e && e.message || e);
        policy.record(entry); onLedger(policy.ledger);
        try { await relay.del(requestId); } catch (_) {}
        return { status: "error", error: entry.error };
      }
    }

    return { handle: handle, cancel: cancel, revoke: revoke, respond: respond };
  }

  var gateway = {
    // constants
    ENDPOINT_ALLOWLIST: ENDPOINT_ALLOWLIST, PROVIDER_CATALOG: PROVIDER_CATALOG,
    ALLOWED_KINDS: ALLOWED_KINDS, PBKDF2_ITERS: PBKDF2_ITERS,
    PROVIDER_TIMEOUT_MS: PROVIDER_TIMEOUT_MS, GATEWAY_TTL_MS: GATEWAY_TTL_MS,
    // layers
    crypto: crypto,
    memoryStore: memoryStore, idbStore: idbStore, makeVault: makeVault,
    adapters: adapters, assertAllowedUrl: assertAllowedUrl, catalogFor: catalogFor,
    buildPrompt: buildPrompt, withTimeout: withTimeout,
    makePolicy: makePolicy, relayClient: relayClient, fetchShortCode: fetchShortCode,
    makeOrchestrator: makeOrchestrator,
  };

  if (typeof window !== "undefined") window.tebCaptureGateway = gateway;
  if (typeof module !== "undefined" && module.exports) module.exports = gateway;
})(typeof globalThis !== "undefined" ? globalThis : this);
