// ===================================================================
// The save (expansion, round 1)
// -------------------------------------------------------------------
// In memory it is G.save, flat, as the game has always read it. Stored, it is
// one document with a schemaVersion, in sections (toDoc / fromDoc;
// docs/expansion/save-schema.md lists the fields).
//   where   IndexedDB ("vocabZombie", store kv, key main): one transaction, so
//           a write is all there or not there. localStorage keeps a flat copy
//           under the old key, written first and at once: the one write sure
//           to finish as a page goes away, what js/strings.js reads before
//           anything else, and what an older build can still open. meta.rev
//           counts the writes: the start takes the higher, the flat copy on a
//           tie (it is never behind). No IndexedDB: localStorage alone.
//   when    G.persist(): within G.CONFIG.save.debounceMs. G.persist(true) or
//           the page hidden or closing: now.
//   safety  a save that cannot be read is never written over: nothing is
//           stored until the player has chosen (js/dataui.js), and what could
//           not be read is kept aside. Up to seven snapshots: one a day, and
//           one before anything that replaces the save.
//
//   G.SaveManager.open()              reads the save (js/game.js, before init)
//   .flush()  .later()                through G.persist
//   .snapshot(reason)  .snapshots()   the backups, newest first
//   .restore(id)  .adopt(save, why)  .reset()  .restart()
//   .status()  .needsBackup()  .backedUp()
// ===================================================================
window.G = window.G || {};

G.SaveManager = (function () {
  const SCHEMA = 2;                 // 1 was the flat save of before
  const C = () => G.CONFIG.save;
  // (a test points these at its own: sandbox)
  const names = { flat: "vocabZombie_save_v1", rescue: "vocabZombie_save_rescue", snaps: "vocabZombie_snapshots", db: "vocabZombie" };
  const noop = () => {};
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const fail = (key) => { const e = new Error(G.T(key)); e.code = key; return e; };

  // ---------------- the sections ----------------
  // Where each top-level key of G.save goes. A string: the section is that key
  // as it is. A key not named here is kept in doc.other, not lost: add it here
  // (and in save-schema.md) when a round adds one.
  const SECTIONS = {
    profile: "profile", settings: "settings", checkpoint: "checkpoints", meta: "meta",
    learning: ["wordStats", "wordStatsVersion", "learn", "customWords", "importedSets"],
    progress: ["unlockedLevels", "levelHighScores", "dailyHighScores", "endlessHighScore", "endlessHighWave", "leaderboards", "achievements", "unlockedWeapons", "notes", "bosses"],
    flags: ["learnSeen", "tutorialDone", "tutorialSeen"],
  };
  function toDoc(s) {
    const doc = { schemaVersion: SCHEMA }, known = {};
    Object.keys(SECTIONS).forEach((sec) => {
      const k = SECTIONS[sec];
      if (typeof k === "string") { doc[sec] = s[k]; known[k] = true; return; }
      doc[sec] = {};
      k.forEach((key) => { known[key] = true; if (s[key] !== undefined) doc[sec][key] = s[key]; });
    });
    Object.keys(s).forEach((key) => { if (!known[key]) (doc.other = doc.other || {})[key] = s[key]; });
    return doc;
  }
  function fromDoc(doc) {
    const s = Object.assign({}, doc.other);
    Object.keys(SECTIONS).forEach((sec) => {
      const k = SECTIONS[sec];
      if (typeof k !== "string") Object.assign(s, doc[sec]);
      else if (doc[sec] !== undefined) s[k] = doc[sec];
    });
    return s;
  }

  // ---------------- migration ----------------
  // One step each, in order: MIGRATIONS[n] takes a save of version n to n + 1.
  // They only move data; G.normalizeSave fills in the rest afterwards. A step
  // that has shipped is not changed: the next change is a new step.
  const MIGRATIONS = {
    // the flat save to its sections; its age from the first day it was played
    1(flat) {
      const doc = toDoc(flat);
      const days = Object.keys((flat.learn && flat.learn.activity) || {}).map(Number).filter((d) => d > 0);
      if (!doc.meta) doc.meta = {};
      if (!doc.meta.createdAt && days.length) doc.meta = Object.assign({}, doc.meta, { createdAt: Math.min.apply(null, days) * 864e5 });
      return doc;
    },
  };
  const versionOf = (d) => (Number.isInteger(d.schemaVersion) ? d.schemaVersion : 1);
  function migrate(data) {
    if (!data || typeof data !== "object" || Array.isArray(data)) throw fail("save.errCorrupt");
    let v = versionOf(data), d = data;
    if (v > SCHEMA) throw fail("save.errNewer");
    for (; v < SCHEMA; v++) {
      if (!MIGRATIONS[v]) throw fail("save.errCorrupt");
      d = MIGRATIONS[v](d);
    }
    return d;
  }
  // any stored form -> a valid G.save
  const toSave = (data) => G.normalizeSave(fromDoc(migrate(data)));

  // ---------------- IndexedDB ----------------
  // A database of object stores keyed by id (the save's; js/bugreport.js the reports')
  function makeDB(name, stores) {
    const DB = {
      conn: null,
      open() {
        return new Promise((res, rej) => {
          if (!window.indexedDB) { rej(new Error("no IndexedDB")); return; }
          const rq = indexedDB.open(name(), 1);
          rq.onupgradeneeded = () => { stores.forEach((s) => rq.result.createObjectStore(s, { keyPath: "id" })); };
          rq.onsuccess = () => {
            const d = rq.result;
            d.onversionchange = () => { d.close(); if (DB.conn === d) DB.conn = null; };
            d.onclose = () => { if (DB.conn === d) DB.conn = null; };
            DB.conn = d;
            res(d);
          };
          rq.onerror = () => rej(rq.error);
          rq.onblocked = () => rej(new Error("IndexedDB blocked"));
        });
      },
      // one transaction: done when it has committed, not when its requests have run
      tx(d, store, mode, fn) {
        return new Promise((res, rej) => {
          const t = d.transaction(store, mode);
          let out;
          const r = fn(t.objectStore(store));
          if (r) r.onsuccess = () => { out = r.result; };
          t.oncomplete = () => res(out);
          t.onerror = t.onabort = () => rej(t.error || new Error("IndexedDB aborted"));
        });
      },
      // (Safari can drop a connection in the background: once more on a new one)
      run(store, mode, fn) {
        const go = (d) => DB.tx(d, store, mode, fn);
        return (DB.conn ? go(DB.conn) : DB.open().then(go)).catch(() => { if (DB.conn) { DB.conn.close(); DB.conn = null; } return DB.open().then(go); });
      },
    };
    return DB;
  }
  const DB = makeDB(() => names.db, ["kv", "snapshots"]);

  // ---------------- localStorage ----------------
  const flatRead = () => { try { return localStorage.getItem(names.flat); } catch (e) { return null; } };
  const flatWrite = (text) => { try { localStorage.setItem(names.flat, text); return true; } catch (e) { return false; } };

  // ---------------- state ----------------
  const S = { first: false, failure: null, blocked: false, timer: null, body: null, played: 0, writing: Promise.resolve(), idbOk: false, flatOk: true, day: -1, lastId: 0, failShown: false, protect: null };

  const version = () => { const u = G.Updater, m = u && (u.installed || u.server); return m ? m.version : ""; };
  const newId = () => Array.from(crypto.getRandomValues(new Uint8Array(8))).map((b) => b.toString(16).padStart(2, "0")).join("");
  // the save as text, meta aside: when this has not changed there is nothing to write
  const bodyOf = (s) => JSON.stringify(Object.assign({}, s, { meta: undefined }));
  const revOf = (o) => Number(o && o.meta && o.meta.rev) || 0;

  // ---------------- reading it, at the start ----------------
  async function open() {
    S.first = false; S.failure = null; S.blocked = false; S.body = null;
    const raw = flatRead();
    let rec = null, waited = false;
    const read = DB.run("kv", "readonly", (st) => st.get("main"));
    try {
      rec = await Promise.race([read, wait(C().bootWaitMs).then(() => { waited = true; return null; })]);
      S.idbOk = !waited;
    } catch (e) { S.idbOk = false; }
    const list = [];
    if (raw) { try { const o = JSON.parse(raw); list.push({ kind: "flat", data: o, rev: revOf(o), text: raw }); } catch (e) { /* the other copy, if any */ } }
    if (rec) { try { list.push({ kind: "idb", data: JSON.parse(rec.json), rev: rec.rev, text: rec.json }); } catch (e) { if (raw) keepAside(rec.json); } }
    list.sort((a, b) => b.rev - a.rev || (a.kind === "flat" ? -1 : 1));
    let chosen = null, why = null;
    for (const c of list) {
      try { G.save = toSave(c.data); chosen = c; break; }
      catch (e) {
        why = e;
        console.warn("Save copy not readable (" + c.kind + ")", e);
        // (a newer game's save, say: not used, and not written over either)
        if (list.length > 1) keepAside(c.text);
      }
    }
    if (!chosen) {
      G.save = G.defaultSave();
      if (raw || rec) { S.blocked = true; S.failure = { raw: raw || rec.json, why: why ? why.message : "" }; }
      else S.first = true;
    }
    const m = G.save.meta;
    if (!m.createdAt) m.createdAt = Date.now();
    if (!m.deviceId) m.deviceId = newId();
    // the first start since this file: what was there, as it was
    if (chosen && chosen.kind === "flat" && !chosen.data.meta && !S.blocked) snapshot("migration", raw).catch(noop);
    // a read that came too late, with something newer than was used: kept as a backup
    if (waited) read.then((r) => { S.idbOk = true; if (r && r.rev > G.save.meta.rev) putSnapshot(snapRecord("late", r.json, r.schemaVersion)).catch(noop); }, noop);
    // both copies agree: nothing to write yet
    S.played = m.playSec;
    if (rec && list.length === 2 && list[0].rev === list[1].rev) S.body = bodyOf(G.save);
    else if (!S.blocked) later();
    if (!S.blocked) setTimeout(idle, C().bootWaitMs);
    return G.save;
  }

  // ---------------- writing it ----------------
  function later() {
    if (S.timer) return;
    S.timer = setTimeout(() => { S.timer = null; G.persist(true); }, C().debounceMs);
  }
  function flush() {
    const s = G.save;
    clearTimeout(S.timer); S.timer = null;
    if (!s || S.blocked) return;
    const body = bodyOf(s), m = s.meta || (s.meta = G.normalizeSave({}).meta);
    if (body === S.body && m.playSec === S.played) return;
    S.body = body; S.played = m.playSec;
    m.rev += 1; m.updatedAt = Date.now();
    const v = version();
    if (v) m.gameVersion = v;
    S.flatOk = flatWrite(body.slice(0, -1) + ',"meta":' + JSON.stringify(m) + "}");
    const rec = { id: "main", schemaVersion: SCHEMA, rev: m.rev, updatedAt: m.updatedAt, json: JSON.stringify(toDoc(s)) };
    if (!S.flatOk) console.warn("Save: the localStorage copy failed");
    S.writing = S.writing.then(() => DB.run("kv", "readwrite", (st) => st.put(rec))).then(() => { S.idbOk = true; }, (e) => {
      console.warn("Save: IndexedDB failed", e);
      S.idbOk = false;
      if (!S.flatOk) { S.body = null; failed(); }
    });
    if (G.Clock.today() !== S.day) daily().catch(noop);
  }
  // Category L: a save that fails to write (Safari private mode, a full quota)
  // used to fail silently; the first failure is shown once
  function failed() {
    G._persistFailed = true;
    if (S.failShown || !G.UI || !G.UI.flashPurchaseBanner) return;
    S.failShown = true;
    G.UI.flashPurchaseBanner(G.T("save.persistFailTitle"), G.T("save.persistFailText"));
  }
  // done with what has been asked for so far (never longer than `ms`)
  const settled = (ms) => Promise.race([S.writing, wait(ms || C().bootWaitMs)]);

  // A phone kills a backgrounded tab without warning; these are the last
  // reliable moments to write, so a run's word history survives an app switch.
  ["pagehide", "beforeunload"].forEach((ev) => window.addEventListener(ev, () => { if (G.save) G.persist(true); }));
  document.addEventListener("visibilitychange", () => { if (document.hidden && G.save) G.persist(true); });

  // ---------------- what could not be read ----------------
  function keepAside(text) {
    try { localStorage.setItem(names.rescue, text); } catch (e) { /* IndexedDB, below */ }
    DB.run("kv", "readwrite", (st) => st.put({ id: "rescue", at: Date.now(), json: text })).catch(noop);
  }
  const rescueText = () => { try { return localStorage.getItem(names.rescue); } catch (e) { return null; } };
  // the player's choice after a failed read: the old text set aside, and on
  function startFresh() {
    if (!S.failure) return;
    keepAside(S.failure.raw);
    S.failure = null; S.blocked = false; S.body = null;
    flush();
    setTimeout(idle, 0);
  }

  // ---------------- snapshots ----------------
  const lsSnaps = () => { try { return JSON.parse(localStorage.getItem(names.snaps) || "[]"); } catch (e) { return []; } };
  function snapRecord(reason, json, schema) {
    const s = G.save;
    S.lastId = Math.max(Date.now(), S.lastId + 1);
    return { id: S.lastId, reason, day: G.Clock.today(), rev: s.meta.rev, gameVersion: version() || s.meta.gameVersion, schemaVersion: schema, summary: G.saveSummary(s), json };
  }
  async function putSnapshot(rec) {
    try {
      await DB.run("snapshots", "readwrite", (st) => st.put(rec));
      const all = await snapshots();
      const extra = all.slice(C().snapshots);
      if (extra.length) await DB.run("snapshots", "readwrite", (st) => { extra.forEach((r) => st.delete(r.id)); });
    } catch (e) {
      // (no IndexedDB: a couple, and a full localStorage is no reason to stop)
      const all = lsSnaps().concat([rec]).slice(-C().lsSnapshots);
      try { localStorage.setItem(names.snaps, JSON.stringify(all)); } catch (e2) { console.warn("Save: no room for a backup", e2); }
    }
    return rec;
  }
  async function snapshot(reason, raw) {
    return putSnapshot(snapRecord(reason, raw || JSON.stringify(toDoc(G.save)), raw ? 1 : SCHEMA));
  }
  // newest first
  async function snapshots() {
    let all;
    try { all = await DB.run("snapshots", "readonly", (st) => st.getAll()); } catch (e) { all = lsSnaps(); }
    return (all || []).sort((a, b) => b.id - a.id);
  }
  const hasProgress = (s) => reviews(s) > 0 || Object.keys(s.achievements).length > 0 || s.unlockedLevels.length > 1;
  // one a day, when there is something to keep and it is not what the last one holds
  async function daily() {
    const day = G.Clock.today();
    if (S.day === day || !G.save || S.blocked) return;
    S.day = day;
    if (!hasProgress(G.save)) return;
    const all = await snapshots();
    if (all.some((r) => r.reason === "daily" && r.day === day) || (all[0] && all[0].rev === G.save.meta.rev)) return;
    await snapshot("daily");
  }
  // a moment after the start: the day's backup; asking the browser to keep the data
  function idle() {
    daily().catch(noop);
    if (G.save && hasProgress(G.save)) protect();
  }

  // ---------------- replacing the save ----------------
  // `save` in place of what is here, a snapshot of what is here first. What
  // belongs to this device stays. The page starts again after it (restart):
  // everything that read a setting at the start reads the new one.
  async function adopt(save, reason) {
    const m = G.save.meta;
    if (S.failure) keepAside(S.failure.raw);
    else if (reason) await snapshot(reason);
    save.meta = Object.assign({}, save.meta, { deviceId: m.deviceId, rev: Math.max(m.rev, save.meta.rev), lastExportAt: m.lastExportAt, exportMark: m.exportMark, nudgeAt: m.nudgeAt });
    if (!save.meta.createdAt) save.meta.createdAt = m.createdAt;
    G.save = save;
    S.blocked = false; S.failure = null; S.body = null;
    flush();
    await settled();
  }
  async function restore(id) {
    const rec = (await snapshots()).find((r) => r.id === id);
    if (!rec) throw fail("save.errCorrupt");
    await adopt(toSave(JSON.parse(rec.json)), "restore");
  }
  // all the progress gone, the settings kept (a backup first)
  async function reset() {
    const fresh = G.normalizeSave({ settings: G.save.settings });
    fresh.meta.createdAt = Date.now();
    await adopt(fresh, "reset");
  }
  const api = { reload() { location.reload(); } };
  async function restart() { await settled(); api.reload(); }

  // ---------------- how it stands ----------------
  function protect() {
    if (S.protect) return S.protect;
    const st = navigator.storage;
    S.protect = !st || !st.persist ? Promise.resolve(null) : st.persisted().then((yes) => yes || st.persist()).catch(() => null);
    return S.protect;
  }
  async function status() {
    const st = navigator.storage;
    let persisted = null, usage = null, quota = null;
    try { if (st && st.persisted) persisted = await st.persisted(); } catch (e) { /* unknown */ }
    try { if (st && st.estimate) { const e = await st.estimate(); usage = e.usage; quota = e.quota; } } catch (e) { /* unknown */ }
    return { backend: S.idbOk ? "indexeddb" : S.flatOk ? "localstorage" : "memory", persisted, usage, quota };
  }

  // ---------------- the reminder ----------------
  // answers given so far: what "new progress" is measured by
  function reviews(s) {
    const srs = (s.learn && s.learn.srs) || {};
    return Object.keys(srs).reduce((n, k) => n + (srs[k].n || 0), 0);
  }
  const DAY = 864e5;
  function backupOverdue(now) {
    const s = G.save, m = s.meta;
    now = now || G.Clock.now();
    if (S.blocked || (G.Account && G.Account.state().signedIn) || !hasProgress(s)) return false;
    return now - (m.lastExportAt || m.createdAt) > C().remindAfterDays * DAY && reviews(s) !== m.exportMark;
  }
  // ...and not asked lately
  function needsBackup(now) {
    now = now || G.Clock.now();
    return backupOverdue(now) && now - G.save.meta.nudgeAt >= C().remindEveryDays * DAY;
  }
  function nudged(now) { G.save.meta.nudgeAt = now || G.Clock.now(); S.body = null; G.persist(); }
  function backedUp(now) {
    const m = G.save.meta;
    m.lastExportAt = now || G.Clock.now();
    m.exportMark = reviews(G.save);
    S.body = null;
    G.persist(true);
  }

  // ---------------- a test's own storage ----------------
  // sandbox(tag): the rest of the page reads and writes under its own names
  // until the function it returns is called; G.save and the real storage are
  // left as they were.
  function sandbox(tag) {
    const real = Object.assign({}, names), state = Object.assign({}, S), save = G.save;
    clearTimeout(S.timer); S.timer = null;
    if (DB.conn) { DB.conn.close(); DB.conn = null; }
    Object.keys(names).forEach((k) => { names[k] = tag + "_" + k; });
    return async () => {
      clearTimeout(S.timer);
      await S.writing.catch(noop);
      if (DB.conn) { DB.conn.close(); DB.conn = null; }
      await new Promise((r) => { const q = indexedDB.deleteDatabase(names.db); q.onsuccess = q.onerror = q.onblocked = () => r(); });
      ["flat", "rescue", "snaps"].forEach((k) => localStorage.removeItem(names[k]));
      Object.assign(names, real);
      Object.assign(S, state, { timer: null });
      G.save = save;
    };
  }

  return Object.assign(api, {
    SCHEMA, SECTIONS, fail, makeDB, toDoc, fromDoc, migrate, toSave, versionOf,
    open, later, flush, settled, version,
    isFirstRun: () => S.first,
    failure: () => S.failure, startFresh, rescueText,
    snapshot, snapshots, daily, adopt, restore, reset, restart,
    status, protect, reviews, backupOverdue, needsBackup, nudged, backedUp,
    sandbox, _: { DB, S, names, flatRead, bodyOf },
  });
})();
