// tebCapture receiver — project-folder MIRROR engine.
//
// The iPhone keeps a project library (projects → organization-template folders →
// takes/photos). This module mirrors that same logical hierarchy INSIDE the folder
// the user chose in Step 1, and installs every finalized photo/video into the right
// mirrored folder. It is the computer half of docs/MEDIA-CONTRACT.md (single source
// of truth) and MUST reproduce ios/tebCapture/Media/FolderMirror.swift byte-for-byte
// for the common (non-colliding) path so the two devices never diverge.
//
//   tebCapture/<Project>/<Scene>/<Shot>/<Take NN>/Master.<ext>
//   tebCapture/<Project>/<Scene>/<Shot>/<Take NN>/Variants/<Platform>/Variant.<ext>
//   tebCapture/Unsorted/<id>.<ext>          (a transfer with no private manifest)
//
// Durability (receipt invariant, MEDIA-CONTRACT.md): a chunk-N ACK is the ONLY event
// that may let the phone delete a Computer-only item, so we NEVER report an item
// "ready" (and callers must NOT ack chunk N) until the master file AND its index row
// are durable. Installs are atomic: bytes go to `<name>.part`, the hash + byte count
// are verified against MediaTransferFinal, then the part is moved onto `<name>`. A
// crash leaves only a `.part` orphan, which init() sweeps and the journal records.
//
// Classic script (NOT a module) so it shares tebcapture.html's one global scope and
// can load after the crypto/vendor scripts; also exports via module.exports so the
// Node mirror test can drive it against a fake FileSystemDirectoryHandle.
//
// NOTHING here ever touches the relay, the session key, or a token — it only owns the
// chosen directory. Keep it that way: the in-page facade (window.tebCaptureReceiver)
// is built on top and must never surface a secret.

(function (root, factory) {
  const api = factory();
  if (typeof window !== "undefined") window.tebCaptureMirror = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(this, function () {
  "use strict";

  const VERSION = "1.0.0";
  const ROOT = "tebCapture";
  const MIRROR_DIR = ".mirror";
  const INDEX_FILE = "index.json";
  const JOURNAL_FILE = "journal.ndjson";
  const UNSORTED = "Unsorted";
  const MAX_SCALARS = 80;
  const FALLBACK = "Untitled";
  const RECENT_CAP = 20;

  // Windows-reserved device names (case-insensitive) — rejected because the mirror
  // must be creatable on every desktop the receiver may run on. Matches FolderMirror.swift.
  const RESERVED = new Set([
    "con", "prn", "aux", "nul",
    "com1", "com2", "com3", "com4", "com5", "com6", "com7", "com8", "com9",
    "lpt1", "lpt2", "lpt3", "lpt4", "lpt5", "lpt6", "lpt7", "lpt8", "lpt9",
  ]);
  const FORBIDDEN = new Set(["/", "\\", ":", "*", "?", '"', "<", ">", "|"]);

  const SAFE_EXTENSIONS = new Set(["jpg", "heic", "mov", "mp4"]);
  // receiver_media_status enum (MEDIA-CONTRACT.md). Never a path/label/exception.
  const STATUS = Object.freeze({
    RECEIVING: "receiving", PROCESSING: "processing", READY: "ready",
    WAITING_FOR_WIFI: "waiting_for_wifi", COMPUTER_LOW_STORAGE: "computer_low_storage",
    NEEDS_ATTENTION: "needs_attention",
  });

  // ---- sanitization (byte-for-byte with FolderMirror.swift.sanitize) ------------
  function suffix(stableID) {
    return String(stableID || "").replace(/-/g, "").toLowerCase().slice(0, 8);
  }
  function isControl(ch) { return /\p{Cc}/u.test(ch); }
  function trimDotsWs(s) {
    // Swift trims CharacterSet(charactersIn: ". \t\n") from both ends — that exact set.
    return s.replace(/^[.\t\n ]+/, "").replace(/[.\t\n ]+$/, "");
  }
  function sanitize(label, stableID) {
    let s = String(label == null ? "" : label).normalize("NFC");
    // Replace forbidden + control characters with '-'.
    s = Array.from(s).map((ch) => (FORBIDDEN.has(ch) || isControl(ch) ? "-" : ch)).join("");
    // Collapse whitespace runs to a single space (also trims leading/trailing whitespace).
    s = s.split(/\s+/u).filter(Boolean).join(" ");
    // Trim leading/trailing dots and whitespace.
    s = trimDotsWs(s);
    if (s === "") s = FALLBACK;
    // Cap at MAX_SCALARS Unicode scalars BEFORE any collision suffix.
    const scalars = Array.from(s);
    if (scalars.length > MAX_SCALARS) {
      s = trimDotsWs(scalars.slice(0, MAX_SCALARS).join(""));
      if (s === "") s = FALLBACK;
    }
    // Reserved device names get a stable suffix.
    if (RESERVED.has(s.toLowerCase())) s = s + "-" + suffix(stableID);
    return s;
  }
  function takeFolder(number) {
    const n = Math.max(0, Number(number) || 0);
    return "Take " + String(n).padStart(2, "0");
  }

  // Logical components (root-relative) for a master / variant. Matches FolderMirror.swift.
  function masterComponents(display, identity, safeExtension) {
    return [
      ROOT,
      sanitize(display.project, identity.projectID),
      sanitize(display.scene, identity.sceneID),
      sanitize(display.shot, identity.shotID),
      takeFolder(identity.takeNumber),
      "Master." + safeExtension,
    ];
  }
  function variantComponents(display, identity, variantID, platform, safeExtension) {
    return [
      ROOT,
      sanitize(display.project, identity.projectID),
      sanitize(display.scene, identity.sceneID),
      sanitize(display.shot, identity.shotID),
      takeFolder(identity.takeNumber),
      "Variants",
      sanitize(platform, variantID),
      "Variant." + safeExtension,
    ];
  }

  // ---- meta helpers -------------------------------------------------------------
  function safeExt(meta) {
    const e = String(meta.safe_extension || "").toLowerCase();
    if (SAFE_EXTENSIONS.has(e)) return e;
    return meta.kind === "photo" ? "jpg" : "mp4";
  }
  // A transfer is "sorted" only with a full logical identity from the private manifest.
  function isSorted(meta) {
    const d = meta && meta.display;
    return !!(d && d.project && meta.project_id && meta.scene_id && meta.shot_id &&
      meta.take_id && (d.take_number != null));
  }
  // Root-relative logical components for the master (or Unsorted fallback).
  function componentsFor(meta) {
    const ext = safeExt(meta);
    if (!isSorted(meta)) {
      // No manifest → Unsorted. Name by stable id so it is unique and idempotent.
      const base = sanitize(meta.media_id || meta.recording_id || "item", meta.media_id);
      return [ROOT, UNSORTED, base + "." + ext];
    }
    const d = meta.display;
    const identity = {
      projectID: meta.project_id, sceneID: meta.scene_id, shotID: meta.shot_id,
      takeID: meta.take_id, takeNumber: d.take_number,
    };
    if (d.variant_platform && meta.variant_id) {
      return variantComponents(d, identity, meta.variant_id, d.variant_platform, ext);
    }
    return masterComponents(d, identity, ext);
  }

  const toHex = (b) => Array.from(new Uint8Array(b)).map((x) => x.toString(16).padStart(2, "0")).join("");
  async function sha256Hex(bytes) {
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return toHex(digest);
  }
  function concatBytes(chunks) {
    let total = 0;
    for (const c of chunks) total += c.byteLength;
    const out = new Uint8Array(total);
    let off = 0;
    for (const c of chunks) { out.set(c, off); off += c.byteLength; }
    return out;
  }

  // ---- the mirror engine --------------------------------------------------------
  function createMirror(rootHandle, opts) {
    opts = opts || {};
    const nowIso = opts.now || (() => new Date().toISOString());
    const listeners = { change: [], item: [], receipt: [] };
    // index.items: media_id -> record. index.dirs: lowercased rel dir path -> owner stableID
    // (the receiver-only collision key: a case-insensitive name owned by a DIFFERENT stable
    // ID gets an 8-char suffix — MEDIA-CONTRACT.md "case-insensitive collisions").
    let index = { version: 1, items: {}, dirs: {}, recent: [] };
    let journalHandle = null;

    function emit(ev, data) { (listeners[ev] || []).forEach((cb) => { try { cb(data); } catch (_) {} }); }

    // ---- directory-handle plumbing ----
    async function mirrorDir(create) {
      const rootTeb = await rootHandle.getDirectoryHandle(ROOT, { create: !!create });
      return rootTeb.getDirectoryHandle(MIRROR_DIR, { create: !!create });
    }
    async function readFileText(dir, name) {
      try {
        const fh = await dir.getFileHandle(name, { create: false });
        const f = await fh.getFile();
        return await f.text();
      } catch (_) { return null; }
    }
    async function atomicWriteText(dir, name, text) {
      // Write to <name>.part then move onto <name> so a crash never leaves a half index.
      const partName = name + ".part";
      const fh = await dir.getFileHandle(partName, { create: true });
      const w = await fh.createWritable();
      await w.write(text);
      await w.close();
      await moveOnto(dir, fh, partName, name);
    }
    async function moveOnto(dir, fileHandle, partName, finalName) {
      if (typeof fileHandle.move === "function") {
        try { await dir.removeEntry(finalName); } catch (_) {}
        await fileHandle.move(finalName);
        return;
      }
      // Fallback for browsers without FileSystemFileHandle.move(): copy then delete.
      const bytes = new Uint8Array(await (await fileHandle.getFile()).arrayBuffer());
      const out = await dir.getFileHandle(finalName, { create: true });
      const w = await out.createWritable();
      await w.write(bytes);
      await w.close();
      try { await dir.removeEntry(partName); } catch (_) {}
    }

    async function persistIndex() {
      const md = await mirrorDir(true);
      await atomicWriteText(md, INDEX_FILE, JSON.stringify(index));
      emit("change", publicState());
    }
    async function appendJournal(entry) {
      try {
        if (!journalHandle) {
          const md = await mirrorDir(true);
          journalHandle = await md.getFileHandle(JOURNAL_FILE, { create: true });
        }
        const f = await journalHandle.getFile();
        const w = await journalHandle.createWritable({ keepExistingData: true });
        await w.write({ type: "write", position: f.size, data: JSON.stringify(entry) + "\n" });
        await w.close();
      } catch (_) { /* journal is belt-and-suspenders; the .part sweep still recovers */ }
    }

    // ---- path resolution with case-insensitive collision suffixing ----
    // Returns the ON-DISK components (may differ from logical when two distinct stable
    // IDs sanitize to the same case-insensitive name). Idempotent per stable ID.
    function resolveOnDisk(logicalComponents, stableIDs) {
      const out = [];
      for (let i = 0; i < logicalComponents.length; i++) {
        const isLeaf = i === logicalComponents.length - 1;
        let name = logicalComponents[i];
        const id = (stableIDs && stableIDs[i]) || null;
        if (!isLeaf && id) {
          const parentKey = out.join("/").toLowerCase();
          const key = parentKey + "/" + name.toLowerCase();
          const owner = index.dirs[key];
          if (owner && owner !== id) {
            name = name + "-" + suffix(id);
          }
          index.dirs[(parentKey + "/" + name.toLowerCase())] = id;
        }
        out.push(name);
      }
      return out;
    }

    async function ensureDir(components) {
      let dir = rootHandle;
      for (const name of components) dir = await dir.getDirectoryHandle(name, { create: true });
      return dir;
    }
    // ensurePath(components) — idempotent create of a directory chain (no leaf file).
    async function ensurePath(components) {
      if (!Array.isArray(components)) throw new Error("components must be an array");
      return ensureDir(components);
    }

    function stableIDsFor(meta, components) {
      // Parallel array of stable IDs for each directory component (leaf file = null).
      if (!isSorted(meta)) return components.map(() => null);
      const d = meta.display;
      // [root, project, scene, shot, take, (Variants, platform,) file]
      const ids = [null, meta.project_id, meta.scene_id, meta.shot_id, meta.take_id];
      if (d.variant_platform && meta.variant_id) { ids.push(null, meta.variant_id); }
      ids.push(null); // leaf file
      return ids;
    }

    function recordFrom(meta, relPath, receipt) {
      const d = meta.display || {};
      return {
        media_id: meta.media_id,
        recording_id: meta.recording_id || null,
        kind: meta.kind || (safeExt(meta) === "jpg" || safeExt(meta) === "heic" ? "photo" : "video"),
        safe_extension: safeExt(meta),
        path: relPath,
        byte_count: meta.byte_count != null ? meta.byte_count : null,
        sha256: meta.sha256 || null,
        project: d.project || null,
        scene: d.scene || null,
        shot: d.shot || null,
        take_number: d.take_number != null ? d.take_number : null,
        variant_platform: d.variant_platform || null,
        project_id: meta.project_id || null,
        scene_id: meta.scene_id || null,
        shot_id: meta.shot_id || null,
        take_id: meta.take_id || null,
        variant_id: meta.variant_id || null,
        unsorted: !isSorted(meta),
        receipt: receipt,
        received_at: nowIso(),
      };
    }
    function bumpRecent(mediaId) {
      index.recent = [mediaId].concat(index.recent.filter((x) => x !== mediaId)).slice(0, RECENT_CAP);
    }

    // ---- streaming install: begin → write* → finalize (atomic, verified) ----
    async function beginIngest(meta) {
      if (!meta || !meta.media_id) throw new Error("meta.media_id required");
      const logical = componentsFor(meta);
      const onDisk = resolveOnDisk(logical, stableIDsFor(meta, logical));
      const dirComponents = onDisk.slice(0, -1);
      let finalName = onDisk[onDisk.length - 1];
      const dir = await ensureDir(dirComponents);
      // Guard: an existing Master/Variant that belongs to a DIFFERENT media_id must not be
      // clobbered (a re-take with the same take id). Suffix by media id.
      finalName = await freeName(dir, finalName, meta.media_id);
      const relPath = dirComponents.concat(finalName).join("/");
      const partName = finalName + ".part";
      const partHandle = await dir.getFileHandle(partName, { create: true });
      const writable = await partHandle.createWritable();
      let bytesWritten = 0;
      const hashChunks = [];
      await appendJournal({ t: "begin", media_id: meta.media_id, part: relPath + ".part", final: relPath, ts: nowIso() });
      // Provisional "receiving" record so the Recent panel can show it in flight.
      index.items[meta.media_id] = recordFrom(meta, relPath, STATUS.RECEIVING);
      bumpRecent(meta.media_id);
      emit("receipt", { media_id: meta.media_id, status: STATUS.RECEIVING });

      return {
        media_id: meta.media_id,
        relPath,
        async write(bytes) {
          const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
          await writable.write(b);
          bytesWritten += b.byteLength;
          hashChunks.push(b);
        },
        async abort() {
          try { await writable.close(); } catch (_) {}
          try { await dir.removeEntry(partName); } catch (_) {}
          delete index.items[meta.media_id];
          index.recent = index.recent.filter((x) => x !== meta.media_id);
          await appendJournal({ t: "abort", media_id: meta.media_id, part: relPath + ".part", ts: nowIso() });
          await persistIndex();
        },
        async finalize(final) {
          final = final || {};
          await writable.close();
          // Verify byte count + SHA-256 over the concatenated plaintext (MEDIA-CONTRACT.md §3).
          const expectBytes = final.byte_count != null ? final.byte_count : meta.byte_count;
          if (expectBytes != null && bytesWritten !== expectBytes) {
            index.items[meta.media_id].receipt = STATUS.NEEDS_ATTENTION;
            emit("receipt", { media_id: meta.media_id, status: STATUS.NEEDS_ATTENTION });
            await persistIndex();
            throw new Error("byte_count mismatch: got " + bytesWritten + " expected " + expectBytes);
          }
          const expectHash = (final.sha256 || meta.sha256 || "").toLowerCase();
          const gotHash = await sha256Hex(concatBytes(hashChunks));
          if (expectHash && gotHash !== expectHash) {
            index.items[meta.media_id].receipt = STATUS.NEEDS_ATTENTION;
            emit("receipt", { media_id: meta.media_id, status: STATUS.NEEDS_ATTENTION });
            await persistIndex();
            throw new Error("sha256 mismatch");
          }
          // Atomically move the .part onto the master, then drop the sidecar beside it.
          await moveOnto(dir, partHandle, partName, finalName);
          const rec = index.items[meta.media_id];
          rec.receipt = STATUS.READY;
          rec.byte_count = bytesWritten;
          rec.sha256 = gotHash;
          await writeSidecar(dir, finalName, rec, meta);
          await appendJournal({ t: "finalize", media_id: meta.media_id, path: relPath, sha256: gotHash, byte_count: bytesWritten, ts: nowIso() });
          await persistIndex();
          emit("item", rec);
          emit("receipt", { media_id: meta.media_id, status: STATUS.READY });
          return rec;
        },
      };
    }

    // One-shot install (test hook + memory-buffered pipeline). Verifies then installs.
    async function ingest(meta, bytes) {
      const t = await beginIngest(meta);
      try {
        await t.write(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes));
        return await t.finalize({ sha256: meta.sha256, byte_count: meta.byte_count });
      } catch (err) {
        try { await t.abort(); } catch (_) {}
        throw err;
      }
    }

    async function freeName(dir, name, mediaId) {
      // If <name> already exists and its sidecar names a different media_id, suffix it.
      try {
        await dir.getFileHandle(name, { create: false });
      } catch (_) { return name; } // absent → free
      const side = await readFileText(dir, name + ".json");
      if (side) {
        try { const j = JSON.parse(side); if (j && j.media_id === mediaId) return name; } catch (_) {}
      }
      const dot = name.lastIndexOf(".");
      const stem = dot > 0 ? name.slice(0, dot) : name;
      const ext = dot > 0 ? name.slice(dot) : "";
      return stem + "-" + suffix(mediaId) + ext;
    }

    async function writeSidecar(dir, finalName, rec, meta) {
      const sidecar = {
        schema_version: 1,
        media_id: rec.media_id,
        recording_id: rec.recording_id,
        kind: rec.kind,
        safe_extension: rec.safe_extension,
        byte_count: rec.byte_count,
        sha256: rec.sha256,
        source_ids: {
          project_id: rec.project_id, scene_id: rec.scene_id, shot_id: rec.shot_id,
          take_id: rec.take_id, variant_id: rec.variant_id,
        },
        display: meta.display || null,
        captured_at: meta.captured_at || null,
        duration_milliseconds: meta.duration_milliseconds != null ? meta.duration_milliseconds : null,
        pixel_width: meta.pixel_width != null ? meta.pixel_width : null,
        pixel_height: meta.pixel_height != null ? meta.pixel_height : null,
        orientation_degrees: meta.orientation_degrees != null ? meta.orientation_degrees : null,
        received_at: rec.received_at,
      };
      const name = finalName + ".json";
      await atomicWriteText(dir, name, JSON.stringify(sidecar, null, 2));
    }

    // ---- crash recovery: load index, replay journal, sweep .part orphans ----
    async function init() {
      const md = await mirrorDir(true);
      const idxText = await readFileText(md, INDEX_FILE);
      if (idxText) {
        try {
          const parsed = JSON.parse(idxText);
          index = Object.assign({ version: 1, items: {}, dirs: {}, recent: [] }, parsed);
          if (!index.items) index.items = {};
          if (!index.dirs) index.dirs = {};
          if (!Array.isArray(index.recent)) index.recent = [];
        } catch (_) { /* corrupt index → start fresh, tree sweep still recovers files */ }
      }
      // Journal replay: a `begin` with no matching `finalize`/`abort` is a crashed install.
      const jText = await readFileText(md, JOURNAL_FILE);
      const crashed = new Set();
      if (jText) {
        for (const line of jText.split("\n")) {
          if (!line.trim()) continue;
          let e; try { e = JSON.parse(line); } catch (_) { continue; }
          if (e.t === "begin") crashed.add(e.media_id);
          else if (e.t === "finalize" || e.t === "abort") crashed.delete(e.media_id);
        }
      }
      for (const mid of crashed) {
        // Drop the provisional index row; the .part sweep below deletes the leftover file.
        delete index.items[mid];
        index.recent = index.recent.filter((x) => x !== mid);
      }
      await sweepParts(await rootHandle.getDirectoryHandle(ROOT, { create: true }));
      await persistIndex();
      return publicState();
    }
    // Depth-first removal of every `*.part` leftover under tebCapture/ (skips .mirror,
    // whose own index/journal parts are handled by atomicWriteText's own move).
    async function sweepParts(dir, depth) {
      depth = depth || 0;
      if (depth > 24) return;
      const kids = [];
      for await (const [name, handle] of dir.entries()) kids.push([name, handle]);
      for (const [name, handle] of kids) {
        if (handle.kind === "file" && name.endsWith(".part")) {
          try { await dir.removeEntry(name); } catch (_) {}
        } else if (handle.kind === "directory" && name !== MIRROR_DIR) {
          await sweepParts(handle, depth + 1);
        }
      }
    }

    // ---- read-only queries --------------------------------------------------------
    function publicState() {
      return {
        version: VERSION,
        root: ROOT,
        hasFolder: true,
        itemCount: Object.keys(index.items).length,
        projectCount: listProjects().length,
      };
    }
    function receipts() {
      return index.recent
        .map((id) => index.items[id])
        .filter(Boolean)
        .map((r) => Object.assign({}, r));
    }
    function listProjects() {
      const seen = new Map();
      for (const r of Object.values(index.items)) {
        if (r.unsorted) { seen.set(" unsorted", { project: UNSORTED, project_id: null, unsorted: true }); continue; }
        if (r.project_id && !seen.has(r.project_id)) {
          seen.set(r.project_id, { project: r.project, project_id: r.project_id, unsorted: false });
        }
      }
      return Array.from(seen.values());
    }
    // listFolder(relPathArray|string) — the index rows whose path sits directly under it.
    function listFolder(path) {
      const prefix = (Array.isArray(path) ? path.join("/") : String(path || "")).replace(/\/+$/, "");
      const out = [];
      for (const r of Object.values(index.items)) {
        if (!prefix || r.path.indexOf(prefix + "/") === 0 || r.path === prefix) out.push(Object.assign({}, r));
      }
      return out;
    }
    async function getFileHandleFor(mediaId) {
      const rec = index.items[mediaId];
      if (!rec) return null;
      const parts = rec.path.split("/");
      let dir = rootHandle;
      for (let i = 0; i < parts.length - 1; i++) dir = await dir.getDirectoryHandle(parts[i], { create: false });
      return dir.getFileHandle(parts[parts.length - 1], { create: false });
    }

    return {
      version: VERSION,
      STATUS,
      init,
      ensurePath,
      beginIngest,
      ingest,
      getState: publicState,
      receipts,
      listProjects,
      listFolder,
      getFileHandleFor,
      getIndex: () => JSON.parse(JSON.stringify(index)),
      on(ev, cb) { if (listeners[ev] && typeof cb === "function") listeners[ev].push(cb); },
    };
  }

  return {
    VERSION,
    ROOT,
    STATUS,
    sanitize,
    suffix,
    takeFolder,
    masterComponents,
    variantComponents,
    componentsFor,
    isSorted,
    safeExt,
    createMirror,
  };
});
