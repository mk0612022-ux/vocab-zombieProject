// ===================================================================
// The save as a file (expansion, round 1)
// -------------------------------------------------------------------
// A .vzsave is JSON: { header, payload }.
//   header   { app, schemaVersion, gameVersion, exportedAt, deviceLabel,
//              compressed, checksum }
//   payload  the document of js/savemanager.js as text -- gzipped and in base64
//            when the browser has CompressionStream (compressed: "gzip")
// checksum is the SHA-256 of the payload exactly as it stands in the file.
// read() also takes the .json files of before (wrapped or a bare save), and
// never touches the save: what it gives back is looked at first (js/dataui.js).
//
//   G.SaveFile.make()              -> { name, text }
//   G.SaveFile.deliver(file)       -> "shared" | "saved" | "cancelled" | "needTap"
//   G.SaveFile.read(text)          -> { save, exportedAt, summary } (throws a
//                                     message that says what is wrong)
//   G.SaveFile.merge(here, there, { useFileSettings })
//
// merge() is the rule for two saves of one player, here and in round 8. Its
// choices beyond the prompt's: a word's box goes with the newer review (a day
// number: the same day, the record with more reviews); the Daily Review streak
// goes with the newer day, because it is a state and not a count.
// ===================================================================
window.G = window.G || {};

G.SaveFile = (function () {
  const APP = "vocab-zombie";
  const M = () => G.SaveManager;
  const fail = (k) => M().fail(k);

  // ---------------- SHA-256 ----------------
  // Of a text's UTF-8 bytes, in hex. crypto.subtle exists only on https and
  // localhost, and the game is also served plainly over the LAN (an iPad's way
  // to a test build); a file is made or read in one go, so it is done here.
  const SHA = (function () {
    const K = [], H = [];
    for (let n = 2; K.length < 64; n++) {
      let prime = true;
      for (let d = 2; d * d <= n; d++) if (n % d === 0) { prime = false; break; }
      if (!prime) continue;
      if (H.length < 8) H.push(Math.floor((Math.sqrt(n) % 1) * 4294967296));
      K.push(Math.floor((Math.cbrt(n) % 1) * 4294967296));
    }
    return { K, H };
  })();
  function sha256(text) {
    const bytes = new TextEncoder().encode(text), n = bytes.length;
    const size = ((n + 9 + 63) >> 6) << 6;
    const buf = new Uint8Array(size);
    buf.set(bytes); buf[n] = 0x80;
    const v = new DataView(buf.buffer);
    v.setUint32(size - 8, Math.floor(n / 536870912)); v.setUint32(size - 4, (n << 3) >>> 0);
    const h = SHA.H.slice(), w = new Array(64);
    const rot = (x, c) => (x >>> c) | (x << (32 - c));
    for (let off = 0; off < size; off += 64) {
      for (let i = 0; i < 16; i++) w[i] = v.getUint32(off + i * 4);
      for (let i = 16; i < 64; i++) {
        const a = w[i - 15], b = w[i - 2];
        w[i] = (w[i - 16] + (rot(a, 7) ^ rot(a, 18) ^ (a >>> 3)) + w[i - 7] + (rot(b, 17) ^ rot(b, 19) ^ (b >>> 10))) | 0;
      }
      let [a, b, c, d, e, f, g, x] = h;
      for (let i = 0; i < 64; i++) {
        const t1 = (x + (rot(e, 6) ^ rot(e, 11) ^ rot(e, 25)) + ((e & f) ^ (~e & g)) + SHA.K[i] + w[i]) | 0;
        const t2 = ((rot(a, 2) ^ rot(a, 13) ^ rot(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
        x = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      [a, b, c, d, e, f, g, x].forEach((val, i) => { h[i] = (h[i] + val) | 0; });
    }
    return h.map((val) => (val >>> 0).toString(16).padStart(8, "0")).join("");
  }

  // ---------------- gzip, base64 ----------------
  function toBase64(bytes) {
    let s = "";
    for (let i = 0; i < bytes.length; i += 8192) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192));
    return btoa(s);
  }
  function fromBase64(text) {
    const s = atob(text), out = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
    return out;
  }
  async function gzip(text) {
    if (!window.CompressionStream) return null;
    try {
      const st = new Blob([text]).stream().pipeThrough(new CompressionStream("gzip"));
      return new Uint8Array(await new Response(st).arrayBuffer());
    } catch (e) { return null; }
  }
  async function gunzip(bytes) {
    if (!window.DecompressionStream) throw fail("save.errGzip");
    const st = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
    return new Response(st).text();
  }

  // ---------------- making one ----------------
  const pad = (n) => String(n).padStart(2, "0");
  const stamp = (d) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
  // what the file says it came from: kinds, never anything of the person's
  function deviceLabel() {
    const ua = navigator.userAgent;
    const os = /iPhone/.test(ua) ? "iPhone" : /iPad/.test(ua) || (/Macintosh/.test(ua) && G.isHandheld()) ? "iPad" : /Android/.test(ua) ? "Android"
      : /Windows/.test(ua) ? "Windows" : /Macintosh/.test(ua) ? "Mac" : /Linux/.test(ua) ? "Linux" : "";
    const br = /Edg\//.test(ua) ? "Edge" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\/|CriOS\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "";
    return [os, br].filter(Boolean).join(" · ");
  }
  async function make() {
    const json = JSON.stringify(M().toDoc(G.save));
    let payload = json, compressed = false;
    const gz = await gzip(json), b64 = gz ? toBase64(gz) : null;
    if (b64 && b64.length < json.length) { payload = b64; compressed = "gzip"; }
    const now = new Date();
    const header = { app: APP, schemaVersion: M().SCHEMA, gameVersion: M().version() || G.save.meta.gameVersion, exportedAt: now.toISOString(), deviceLabel: deviceLabel(), compressed, checksum: sha256(payload) };
    return { name: "vocab-zombie-save-" + stamp(now) + ".vzsave", text: JSON.stringify({ header, payload }) };
  }
  // what could not be read, as it was (the Data page, the failed start)
  const rawFile = (text) => ({ name: "vocab-zombie-raw-" + stamp(new Date()) + ".txt", text });

  // A phone or tablet shares the file (on iPad: Save to Files), a computer
  // downloads it. A browser may ask for a fresh tap before it shares: "needTap".
  async function deliver(file) {
    const f = window.File ? new File([file.text], file.name, { type: "application/json" }) : null;
    if (f && G.isHandheld() && navigator.canShare && navigator.canShare({ files: [f] })) {
      try { await navigator.share({ files: [f] }); return "shared"; }
      catch (e) {
        if (e.name === "AbortError") return "cancelled";
        if (e.name === "NotAllowedError") return "needTap";
      }
    }
    const url = URL.createObjectURL(new Blob([file.text], { type: "application/octet-stream" }));
    const a = document.createElement("a");
    a.href = url; a.download = file.name;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return "saved";
  }

  // ---------------- reading one ----------------
  const looksFlat = (o) => !!o && (Array.isArray(o.unlockedLevels) || (!!o.wordStats && typeof o.wordStats === "object"));
  async function unpack(o) {
    const h = o.header;
    if (!h || typeof h !== "object") throw fail("save.errNotSave");
    if (h.app !== APP) throw fail("save.errApp");
    if (!Number.isInteger(h.schemaVersion) || typeof o.payload !== "string") throw fail("save.errCorrupt");
    if (h.schemaVersion > M().SCHEMA) throw fail("save.errNewer");
    if (sha256(o.payload) !== h.checksum) throw fail("save.errChecksum");
    let json = o.payload;
    if (h.compressed) {
      try { json = await gunzip(fromBase64(o.payload)); }
      catch (e) { throw e.code ? e : fail("save.errCorrupt"); }
    }
    try { return JSON.parse(json); } catch (e) { throw fail("save.errCorrupt"); }
  }
  async function read(text) {
    let o;
    try { o = JSON.parse(text); } catch (e) { throw fail("save.errJson"); }
    if (!o || typeof o !== "object" || Array.isArray(o)) throw fail("save.errNotSave");
    let data, exportedAt = null;
    if ("payload" in o) { data = await unpack(o); exportedAt = o.header.exportedAt || null; }
    else if (o.format === G.SAVE_FORMAT && o.save) { data = o.save; exportedAt = o.exportedAt || null; }
    else if (looksFlat(o) || Number.isInteger(o.schemaVersion)) data = o;
    else throw fail("save.errNotSave");
    let save;
    try { save = M().toSave(data); } catch (e) { throw e.code ? e : fail("save.errCorrupt"); }
    return { save, exportedAt, summary: G.saveSummary(save) };
  }
  // a chosen file's text
  const textOf = (file) => new Promise((res, rej) => {
    const r = new FileReader();
    r.onerror = () => rej(fail("save.errRead"));
    r.onload = () => res(String(r.result));
    r.readAsText(file);
  });
  const readFile = (file) => textOf(file).then(read);

  // ---------------- two saves of one player ----------------
  const obj = (o) => (o && typeof o === "object" && !Array.isArray(o) ? o : {});
  const most = (x, y) => Math.max(Number(x) || 0, Number(y) || 0);
  const union = (a, b) => a.concat(b.filter((v) => !a.includes(v)));
  // every key of both; `both` settles a key they share
  function join(a, b, both) {
    a = obj(a); b = obj(b);
    const out = Object.assign({}, a);
    Object.keys(b).forEach((k) => { out[k] = k in a ? both(a[k], b[k], k) : b[k]; });
    return out;
  }
  const day = (v) => (v == null ? -1 : v);
  function newerBox(x, y) {
    if (day(x.last) !== day(y.last)) return day(x.last) > day(y.last) ? x : y;
    if (x.n !== y.n) return x.n > y.n ? x : y;
    return y.b > x.b ? y : x;
  }
  function mergeDaily(x, y) {
    const lx = day(x.last), ly = day(y.last), newer = ly > lx ? y : x;
    return { streak: lx === ly ? most(x.streak, y.streak) : newer.streak, best: most(x.best, y.best), last: newer.last, nextDue: newer.nextDue, days: join(x.days, y.days, most) };
  }
  function mergeWhy(a, b) {
    return join(a, b, (x, y) => {
      const seen = {}, all = x.concat(y).filter((h) => { const k = [h.d, h.c, h.x, h.t].join("|"); if (seen[k]) return false; seen[k] = true; return true; });
      return all.sort((p, q) => p.d - q.d).slice(-G.CONFIG.explain.history);
    });
  }
  function mergeLearn(a, b) {
    return Object.assign({}, a, {
      srs: join(a.srs, b.srs, newerBox),
      conf: join(a.conf, b.conf, (p, q) => join(p, q, (m, n) => ({ n: most(m.n, n.n), ok: most(m.ok, n.ok), off: !!(m.off || n.off) }))),
      daily: mergeDaily(a.daily, b.daily),
      skills: join(a.skills, b.skills, (p, q) => ({ r: most(p.r, q.r), w: most(p.w, q.w) })),
      activity: join(a.activity, b.activity, most),
      spellRun: most(a.spellRun, b.spellRun),
      why: mergeWhy(a.why, b.why),
    });
  }
  // the player's words: a word is one word by its language and spelling, in any level
  function mergeCustom(a, b) {
    const tag = (p) => G.CustomVocab.langsOf(p).wl + ":" + p[0].toLowerCase();
    const out = {}, seen = {};
    Object.keys(a).forEach((k) => { out[k] = a[k].slice(); a[k].forEach((p) => { seen[tag(p)] = true; }); });
    Object.keys(b).forEach((k) => b[k].forEach((p) => {
      if (seen[tag(p)]) return;
      seen[tag(p)] = true;
      (out[k] = out[k] || []).push(p);
    }));
    return out;
  }
  function mergeSets(a, b) {
    const sig = (s) => s.name + "|" + JSON.stringify(s.words);
    const out = Object.assign({}, a), have = {};
    Object.keys(a).forEach((k) => { have[sig(a[k])] = true; });
    Object.keys(b).forEach((k) => { if (!(k in out) && !have[sig(b[k])]) out[k] = b[k]; });
    return out;
  }
  function mergeBoards(a, b) {
    return join(a, b, (x, y) => {
      const seen = {}, all = x.concat(y).filter((e) => { const k = JSON.stringify(e); if (seen[k]) return false; seen[k] = true; return true; });
      return all.sort((p, q) => q.score - p.score).slice(0, 10);
    });
  }
  // here: this device; there: the file. Neither is changed.
  function merge(here, there, opts) {
    const a = here, b = there, o = opts || {};
    const m = a.meta, n = b.meta, born = [m.createdAt, n.createdAt].filter(Boolean);
    const out = Object.assign({}, b, a, {
      settings: o.useFileSettings ? b.settings : a.settings,
      wordStats: join(a.wordStats, b.wordStats, (x, y) => Object.assign({}, x, { correct: most(x.correct, y.correct), wrong: most(x.wrong, y.wrong), lastCorrect: most(x.lastCorrect, y.lastCorrect) })),
      learn: mergeLearn(a.learn, b.learn),
      customWords: mergeCustom(a.customWords, b.customWords),
      importedSets: mergeSets(a.importedSets, b.importedSets),
      unlockedLevels: union(a.unlockedLevels, b.unlockedLevels).sort((x, y) => x - y),
      unlockedWeapons: union(a.unlockedWeapons, b.unlockedWeapons),
      levelHighScores: join(a.levelHighScores, b.levelHighScores, most),
      dailyHighScores: join(a.dailyHighScores, b.dailyHighScores, most),
      endlessHighScore: most(a.endlessHighScore, b.endlessHighScore),
      endlessHighWave: most(a.endlessHighWave, b.endlessHighWave),
      leaderboards: mergeBoards(a.leaderboards, b.leaderboards),
      achievements: Object.assign({}, b.achievements, a.achievements),
      notes: join(a.notes, b.notes, union),
      bosses: { seen: join(a.bosses.seen, b.bosses.seen, most), defeated: join(a.bosses.defeated, b.bosses.defeated, most) },
      checkpoints: join(a.checkpoints, b.checkpoints, (x, y) => ((y.savedAt || 0) > (x.savedAt || 0) ? y : x)),
      learnSeen: Object.assign({}, b.learnSeen, a.learnSeen),
      tutorialSeen: Object.assign({}, b.tutorialSeen, a.tutorialSeen),
      tutorialDone: !!(a.tutorialDone || b.tutorialDone),
      profile: a.profile.name || a.profile.avatar ? a.profile : b.profile,
      meta: Object.assign({}, m, { createdAt: born.length ? Math.min.apply(null, born) : 0, playSec: most(m.playSec, n.playSec) }),
    });
    return G.normalizeSave(JSON.parse(JSON.stringify(out)));
  }

  // (the old call, for what still uses it)
  G.readSaveFile = function (file, cb) { readFile(file).then((r) => cb(null, r), (e) => cb(e)); };

  return { make, rawFile, deliver, read, readFile, merge, sha256, deviceLabel };
})();
