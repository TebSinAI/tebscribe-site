// tebCapture receiver crypto — the phone-camera → this-computer half of the
// E2EE pairing. Classic script (NOT a module): shares ONE global scope with
// tebcapture.html's inline logic and MUST load AFTER
// /dictate/static/vendor/x25519.js (window.X25519). Also exports via
// module.exports so the Node cross-language vector test can exercise it.
//
// Two layers, both byte-matched to the iOS camera (ios/tebCapture/Support/
// Crypto.swift) and the relay's Python reference so the products can never
// silently diverge:
//
//   1) SESSION KEY (identical to tebDictate's v2 handshake — same vector):
//        shared  = X25519(ownPriv, phonePub)
//        key     = HKDF-SHA256(shared, salt = 16-byte QR nonce,
//                              info = "tebiq-live-cursor-e2ee-v2|<receiverPub>|<phonePub>")
//      The receiver is the "browser" role, so receiverPub is first in the info.
//
//   2) CHUNK IV — v2 (wire change 2026-08-19; matches Crypto.swift chunkIV):
//        IV(rid,index) = HKDF-SHA256(sessionKey, salt = "tebcapture-iv-v2",
//                                    info = "iv|<recording_id>|<index>", 12)
//        plaintext     = AES-256-GCM(open, key = sessionKey, iv = IV(rid,index),
//                                    aad = "<recording_id>|<index>", ct||tag)
//      v1 (salt "tebcapture-iv", info "iv|<index>") reused the GCM nonce across
//      two recordings in one session — deleted. The IV is derived (not sent) so
//      the receiver reproduces it; the AAD binds each chunk to its recording+index.
//
//   3) SAVED RECEIVER KDF (flag-gated on relay TEBCAPTURE_SAVED_RECEIVERS;
//      matches Crypto.swift SavedReceiver):
//        pairSecret  = HKDF-SHA256(X25519(ownDhPriv, phoneDhPub), salt = nonce,
//                                  info = "tebcapture-pair-secret-v1", 32)
//        sessionKey  = HKDF-SHA256(pairSecret, salt = sessionNonce,
//                                  info = "tebcapture-session-key-v1|<sid>", 32)
//        receiverId  = b64url(SHA256(Ed25519 signPub)[:12])
//        PoP         = Ed25519.sign(signPriv, "tebcapture-pair-offer|<rid>|<nonce>")
//
// Do NOT change any constant here without regenerating and re-pinning the
// cross-language vectors (tests/e2ee_vector.json + tests/tebcapture_chunk_vector.json).
// Crypto primitives: X25519 from the vendored curve; HKDF-SHA256 (via HMAC, RFC
// 5869) and AES-256-GCM from WebCrypto — the same portable path tebDictate uses
// because Safari < 17.4 lacks WebCrypto X25519 / native HKDF on iOS. Ed25519 uses
// WebCrypto where the browser supports it (Chrome/Edge — the saved-mode targets).

const TC_INFO_PREFIX = "tebiq-live-cursor-e2ee-v2";
const TC_IV_SALT = "tebcapture-iv-v2";
const TC_PAIR_SECRET_INFO = "tebcapture-pair-secret-v1";
const TC_SESSION_KEY_INFO = "tebcapture-session-key-v1";

// ---- byte / base64url helpers (unpadded RFC 4648 §5) ---------------------------
function _tcB64urlEncode(bytes){
  let bin = "";
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  for(let i=0;i<b.length;i++) bin += String.fromCharCode(b[i]);
  return btoa(bin).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
}
function _tcB64urlDecode(str){
  let s = String(str||"").replace(/-/g,"+").replace(/_/g,"/");
  while(s.length % 4) s += "=";
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++) out[i] = bin.charCodeAt(i);
  return out;
}
function _tcUtf8(str){ return new TextEncoder().encode(str); }

// ---- HKDF-SHA256 (RFC 5869) via HMAC — universally supported ------------------
async function _tcHmac(keyBytes, data){
  const k = await crypto.subtle.importKey("raw", keyBytes, { name:"HMAC", hash:"SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", k, data));
}
async function _tcHkdf(ikm, salt, info, length){
  const prk = await _tcHmac((salt && salt.length) ? salt : new Uint8Array(32), ikm);   // extract
  const out = new Uint8Array(length);
  let t = new Uint8Array(0), pos = 0, counter = 1;
  while(pos < length){                                                                 // expand
    const block = new Uint8Array(t.length + info.length + 1);
    block.set(t, 0); block.set(info, t.length); block[block.length - 1] = counter;
    t = await _tcHmac(prk, block);
    const n = Math.min(t.length, length - pos);
    out.set(t.subarray(0, n), pos); pos += n; counter++;
  }
  return out;
}
async function _tcSha256(bytes){ return new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)); }

// ---- 1) session key (raw 32 bytes) --------------------------------------------
// Returns raw bytes (NOT a CryptoKey) because chunk-IV derivation feeds the same
// key back into HKDF as input key material. `receiverPub`/`phonePub` fix the info
// string; `nonce` is the 16-byte QR salt.
async function tebCaptureDeriveSessionKey(ownPriv, peerPub, receiverPub, phonePub, nonce){
  if(typeof X25519==="undefined") throw new Error("X25519 vendor not loaded");
  const shared = X25519.scalarMult(ownPriv, peerPub);
  const info = _tcUtf8(TC_INFO_PREFIX + "|" + _tcB64urlEncode(receiverPub) + "|" + _tcB64urlEncode(phonePub));
  return _tcHkdf(shared, nonce, info, 32);
}

// ---- 2) chunk IV + decrypt (v2) -----------------------------------------------
// v2 mixes the recording id into the IV: a session key can outlive one recording,
// and v1 reused the GCM nonce at every index across recordings (catastrophic).
async function tebCaptureChunkIV(sessionKey, recordingId, index){
  return _tcHkdf(sessionKey, _tcUtf8(TC_IV_SALT), _tcUtf8("iv|" + String(recordingId) + "|" + index), 12);
}
// `ctBytes` is the raw AES-GCM output (ciphertext||tag) the relay serves as
// application/x-tebcapture-ct. Throws (fail closed) if the tag/AAD don't verify.
async function tebCaptureDecryptChunk(sessionKey, recordingId, index, ctBytes){
  const iv = await tebCaptureChunkIV(sessionKey, recordingId, index);
  const key = await crypto.subtle.importKey("raw", sessionKey, { name:"AES-GCM", length:256 }, false, ["decrypt"]);
  const pt = await crypto.subtle.decrypt(
    { name:"AES-GCM", iv, additionalData:_tcUtf8(String(recordingId) + "|" + String(index)) },
    key, ctBytes);
  return new Uint8Array(pt);
}

function tebCaptureGenerateKeypair(){
  if(typeof X25519==="undefined") throw new Error("X25519 vendor not loaded");
  const priv = new Uint8Array(32);
  crypto.getRandomValues(priv);
  return { priv, pub: X25519.scalarMultBase(priv) };
}

// ---- 3) saved-receiver KDF (byte-matched to Crypto.swift SavedReceiver) --------
// pairSecret both sides derive once and store client-side. `ownDhPriv` is this
// receiver's static x25519 private key; `phoneDhPub` arrives in the /pair result.
async function tebCaptureDerivePairSecret(ownDhPriv, phoneDhPub, nonce){
  if(typeof X25519==="undefined") throw new Error("X25519 vendor not loaded");
  const shared = X25519.scalarMult(ownDhPriv, phoneDhPub);
  return _tcHkdf(shared, nonce, _tcUtf8(TC_PAIR_SECRET_INFO), 32);
}
// per-recording key from the stored pair secret + the phone's per-session nonce
// (read from recording_started). ephemeralShared is empty by default, exactly as
// the iOS deriveSessionKey default.
async function tebCaptureDeriveSavedSessionKey(pairSecret, sid, sessionNonce, ephemeralShared){
  const ikm = ephemeralShared && ephemeralShared.length
    ? (()=>{ const m=new Uint8Array(pairSecret.length+ephemeralShared.length); m.set(pairSecret,0); m.set(ephemeralShared,pairSecret.length); return m; })()
    : pairSecret;
  return _tcHkdf(ikm, sessionNonce, _tcUtf8(TC_SESSION_KEY_INFO + "|" + sid), 32);
}
// receiver id = b64url(SHA256(signPub)[:12]) — self-authenticating, matches Swift.
async function tebCaptureReceiverId(signPub){
  const h = await _tcSha256(signPub);
  return _tcB64urlEncode(h.subarray(0,12));
}

var tebCaptureChunkCrypto = {
  INFO_PREFIX: TC_INFO_PREFIX, IV_SALT: TC_IV_SALT,
  PAIR_SECRET_INFO: TC_PAIR_SECRET_INFO, SESSION_KEY_INFO: TC_SESSION_KEY_INFO,
  b64: _tcB64urlEncode, b64d: _tcB64urlDecode, hkdf: _tcHkdf, sha256: _tcSha256,
  deriveSessionKey: tebCaptureDeriveSessionKey,
  chunkIV: tebCaptureChunkIV, decryptChunk: tebCaptureDecryptChunk,
  generateKeypair: tebCaptureGenerateKeypair,
  derivePairSecret: tebCaptureDerivePairSecret,
  deriveSavedSessionKey: tebCaptureDeriveSavedSessionKey,
  receiverId: tebCaptureReceiverId,
};
if(typeof window !== "undefined") window.tebCaptureChunkCrypto = tebCaptureChunkCrypto;
if(typeof module !== "undefined" && module.exports) module.exports = tebCaptureChunkCrypto;
