// Dev-only (not shipped). The expansion's round 1: the save.
//   A  the sections: every key of G.save in one, and back unchanged
//   B  migration: the fixture of the old flat save to the document and on, step
//      by step, nothing lost; a newer save refused
//   C  where it is kept: IndexedDB and the flat copy, which is taken at the
//      start, a damaged copy, no IndexedDB, IndexedDB hanging, a write cut off,
//      a save that cannot be read (never written over)
//   D  when it is written: at most every two seconds, at once when hidden or
//      closing, and not at all when nothing changed
//   E  snapshots: seven, one a day, restored with a snapshot first
//   F  the file: its name, header, SHA-256, gzip; export -> import equal in
//      every field; damaged and foreign files refused with their own message;
//      the old .json files still read; a download on a computer, the share
//      sheet on a tablet (the sheet itself is stood in for: there is none here)
//   G  merge: each rule, on made-up saves and on the fixture
//   H  the reminder: seven days, new progress, not more than every three days
//   I  on screen: Settings > Data, Import (Merge, Replace), Restore, Reset with
//      its typed code, the Main Menu's card, what is locked in a run
// A stored save of its own throughout (G.SaveManager.sandbox): the page's real
// save is not touched. Load it into the game (in the lobby), then:
//   const r = await G.Round30Test.run();   r.fail -> [] when everything passes
window.G = window.G || {};
G.Round30Test = (function () {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const sorted = (v) => (Array.isArray(v) ? v.map(sorted) : v && typeof v === "object" ? Object.keys(v).sort().reduce((o, k) => { o[k] = sorted(v[k]); return o; }, {}) : v);
  const same = (a, b) => JSON.stringify(sorted(a)) === JSON.stringify(sorted(b));
  // where two values differ: paths, `skip` left out
  function diff(a, b, skip) {
    const out = [];
    (function walk(x, y, p) {
      if (skip && skip.test(p)) return;
      if (x && y && typeof x === "object" && typeof y === "object") new Set(Object.keys(x).concat(Object.keys(y))).forEach((k) => walk(x[k], y[k], p ? p + "." + k : k));
      else if (x !== y) out.push(p + ": " + JSON.stringify(x) + " -> " + JSON.stringify(y));
    })(a, b, "");
    return out;
  }
  const META = /^meta\.(rev|updatedAt|deviceId|gameVersion|createdAt)$/;

  async function run() {
    const results = [], errs = [];
    const ok = (name, pass, info) => { results.push({ name, pass: !!pass, info: info === undefined ? "" : info }); };
    const onErr = (e) => errs.push(String(e.message || (e.reason && e.reason.message) || e.reason || e));
    window.addEventListener("error", onErr);
    window.addEventListener("unhandledrejection", onErr);
    const M = G.SaveManager, F = G.SaveFile, D = G.DataUI, DB = M._.DB, S = M._.S, names = M._.names;
    const fx = await fetch("/tests/fixtures/save-v-current.json?v=" + Date.now()).then((r) => r.json());
    const fxText = JSON.stringify(fx);
    const code = async (fn) => { try { await fn(); return "no error"; } catch (e) { return e.code || String(e); } };
    const main = () => DB.run("kv", "readonly", (st) => st.get("main"));
    const putMain = (doc, rev, schema) => DB.run("kv", "readwrite", (st) => st.put({ id: "main", schemaVersion: schema || M.SCHEMA, rev, updatedAt: 1, json: JSON.stringify(doc) }));
    const flat = () => localStorage.getItem(names.flat);
    const setFlat = (o) => localStorage.setItem(names.flat, typeof o === "string" ? o : JSON.stringify(o));
    const wipe = async () => {
      clearTimeout(S.timer); S.timer = null;
      await S.writing.catch(() => {});
      localStorage.removeItem(names.flat); localStorage.removeItem(names.rescue); localStorage.removeItem(names.snaps);
      await DB.run("kv", "readwrite", (st) => st.clear()).catch(() => {});
      await DB.run("snapshots", "readwrite", (st) => st.clear()).catch(() => {});
    };
    const opened = async () => { const s = await M.open(); clearTimeout(S.timer); S.timer = null; return s; };
    const save0 = G.save, lang0 = G.lang, reload0 = M.reload, setItem0 = Storage.prototype.setItem, deliver0 = F.deliver;
    let reloads = 0;
    M.reload = () => { reloads++; };
    F.deliver = async () => "saved";
    const end = M.sandbox("vzt" + Date.now());
    try {
      // ---------------- A: the sections ----------------
      {
        const d = G.defaultSave(), doc = M.toDoc(d);
        ok("A every key of a save is in a section", !doc.other, doc.other && Object.keys(doc.other).join());
        ok("A the seven sections and the version", ["profile", "settings", "learning", "progress", "checkpoint", "flags", "meta"].every((k) => doc[k] && typeof doc[k] === "object") && doc.schemaVersion === 2);
        const s = G.normalizeSave(clone(fx));
        ok("A there and back: the same save", same(M.fromDoc(M.toDoc(s)), s), diff(M.fromDoc(M.toDoc(s)), s).slice(0, 4).join("; "));
        const back = M.fromDoc(M.toDoc(Object.assign({}, s, { future: { a: 1 } })));
        ok("A a key no section names is kept", back.future && back.future.a === 1);
        ok("A the fixture is the old format", fx.schemaVersion === undefined && fx.meta === undefined);
      }

      // ---------------- B: migration ----------------
      {
        const doc = M.migrate(clone(fx)), input = clone(fx);
        M.migrate(input);
        ok("B the flat save becomes a document of the current version", doc.schemaVersion === M.SCHEMA && M.versionOf(fx) === 1 && M.versionOf(doc) === M.SCHEMA);
        ok("B the file given is not changed", JSON.stringify(input) === fxText);
        const s = M.toSave(clone(fx)), plain = G.normalizeSave(clone(fx));
        const d = diff(plain, s, /^meta\.createdAt$/);
        ok("B every field of the fixture comes through", !d.length, d.slice(0, 4).join("; "));
        ok("B its words, boxes and checkpoint", Object.keys(s.wordStats).length === 129 && Object.keys(s.learn.srs).length === 125 && s.checkpoints.level1.wave === 11, Object.keys(s.wordStats).length);
        const first = Math.min.apply(null, Object.keys(fx.learn.activity).map(Number));
        ok("B its age from the first day played", s.meta.createdAt === first * 864e5, s.meta.createdAt);
        ok("B a migrated save is stable", same(G.normalizeSave(clone(s)), s));
        ok("B a document stays as it is", same(M.migrate(clone(doc)), doc));
        ok("B a newer version is refused", (await code(() => M.migrate({ schemaVersion: 99 }))) === "save.errNewer");
        ok("B something that is no save is refused", (await code(() => M.migrate("x"))) === "save.errCorrupt" && (await code(() => M.migrate([1]))) === "save.errCorrupt");
      }

      // ---------------- C: where it is kept ----------------
      {
        await wipe();
        await opened();
        ok("C nothing stored: a new player", M.isFirstRun() && !M.failure() && G.save.unlockedLevels.length === 1);
        ok("C a new player has an id and a birthday", G.save.meta.deviceId.length === 16 && G.save.meta.createdAt > 0);
        M.flush(); await M.settled();
        const rec1 = await main();
        ok("C IndexedDB holds the document", !!rec1 && rec1.schemaVersion === M.SCHEMA && same(M.toSave(JSON.parse(rec1.json)), G.save), rec1 && rec1.rev);
        const f1 = JSON.parse(flat());
        ok("C the flat copy holds the save and the same count", same(G.normalizeSave(clone(f1)), G.save) && f1.meta.rev === rec1.rev);
        ok("C status: IndexedDB", (await M.status()).backend === "indexeddb");

        await opened();
        const r0 = (await main()).rev;
        M.flush(); await M.settled();
        ok("C opened again with nothing new: no write", !M.isFirstRun() && (await main()).rev === r0 && JSON.parse(flat()).meta.rev === r0);

        // the first start with this file
        await wipe();
        setFlat(fxText);
        await opened();
        ok("C the old save is read", !M.isFirstRun() && Object.keys(G.save.wordStats).length === 129 && !M.failure());
        ok("C ...and stays as it was until something new is written", flat() === fxText);
        await wait(50);
        const snaps = await M.snapshots();
        ok("C ...with a snapshot of it as it was", snaps.length === 1 && snaps[0].reason === "migration" && snaps[0].json === fxText && snaps[0].schemaVersion === 1);
        const was = clone(G.save);
        M.flush(); await M.settled();
        const f2 = JSON.parse(flat());
        ok("C written: the flat copy is still the old format, and more", f2.meta.rev === 1 && f2.schemaVersion === undefined && !diff(G.normalizeSave(clone(fx)), G.normalizeSave(clone(f2)), /^meta\./).length);
        ok("C ...what an older build reads: every old key where it was", Object.keys(fx).every((k) => k in f2));
        await opened();
        ok("C started again: the same save", !diff(was, G.save, META).length, diff(was, G.save, META).slice(0, 3).join("; "));

        // which copy
        const mark = (n) => { const s = G.normalizeSave(clone(fx)); s.endlessHighScore = n; return s; };
        const withRev = (s, rev) => { s.meta.rev = rev; return s; };
        await wipe();
        setFlat(withRev(mark(1), 5)); await putMain(M.toDoc(withRev(mark(2), 10)), 10);
        await opened();
        ok("C IndexedDB further on: IndexedDB", G.save.endlessHighScore === 2);
        await wipe();
        setFlat(withRev(mark(1), 12)); await putMain(M.toDoc(withRev(mark(2), 10)), 10);
        await opened();
        ok("C the flat copy further on: the flat copy", G.save.endlessHighScore === 1);
        await wipe();
        setFlat(withRev(mark(1), 10)); await putMain(M.toDoc(withRev(mark(2), 10)), 10);
        await opened();
        ok("C a tie: the flat copy (an older build may have written it)", G.save.endlessHighScore === 1);
        await wipe();
        await putMain(M.toDoc(withRev(mark(2), 10)), 10);
        await opened();
        ok("C the flat copy gone: IndexedDB, not a new player", G.save.endlessHighScore === 2 && !M.isFirstRun());
        await wipe();
        setFlat("{broken"); await putMain(M.toDoc(withRev(mark(2), 10)), 10);
        await opened();
        ok("C the flat copy damaged: IndexedDB, nothing to ask", G.save.endlessHighScore === 2 && !M.failure());
        await wipe();
        setFlat(withRev(mark(1), 5));
        await DB.run("kv", "readwrite", (st) => st.put({ id: "main", schemaVersion: 2, rev: 9, updatedAt: 1, json: "{broken" }));
        await opened();
        ok("C IndexedDB damaged: the flat copy", G.save.endlessHighScore === 1 && !M.failure());

        // a newer build's save: used neither way, and kept
        await wipe();
        setFlat(withRev(mark(1), 5));
        const newer = '{"schemaVersion":99,"meta":{"rev":9}}';
        await DB.run("kv", "readwrite", (st) => st.put({ id: "main", schemaVersion: 99, rev: 9, updatedAt: 1, json: newer }));
        await opened();
        ok("C a newer build's record: the flat copy used, the record kept aside", G.save.endlessHighScore === 1 && M.rescueText() === newer && !M.failure());

        // a write cut off: one transaction is all or nothing
        await wipe();
        await putMain({ a: 1 }, 3);
        const d = await DB.open();
        const cut = await code(() => DB.tx(d, "kv", "readwrite", (st) => { const r = st.put({ id: "main", schemaVersion: 2, rev: 4, updatedAt: 1, json: "half" }); st.transaction.abort(); return r; }));
        const after = await main();
        ok("C a transaction cut off leaves the record as it was", cut !== "no error" && after.rev === 3 && after.json === '{"a":1}', cut);

        // the tab closed while IndexedDB is writing: its write never lands
        await wipe();
        await opened(); M.flush(); await M.settled();
        const run0 = DB.run;
        G.save.endlessHighScore = 777;
        DB.run = () => new Promise(() => {});
        M.flush();
        await wait(30);
        DB.run = run0;
        S.writing = Promise.resolve();
        const stale = await main();
        await opened();
        ok("C closed mid-write: the flat copy has it, and the next start takes it", stale.rev < G.save.meta.rev + 1 && G.save.endlessHighScore === 777, stale.rev);
        M.flush(); await M.settled();
        ok("C ...and IndexedDB catches up", JSON.parse((await main()).json).progress.endlessHighScore === 777);

        // no IndexedDB
        await wipe();
        const open0 = DB.open, conn0 = DB.conn;
        DB.conn = null; DB.open = () => Promise.reject(new Error("no IndexedDB here"));
        setFlat(withRev(mark(5), 3));
        await opened();
        ok("C no IndexedDB: localStorage alone", G.save.endlessHighScore === 5 && (await M.status()).backend === "localstorage");
        G.save.endlessHighScore = 6; M.flush(); await M.settled();
        ok("C ...it writes", JSON.parse(flat()).endlessHighScore === 6);
        await M.snapshot("daily"); await M.snapshot("import"); await M.snapshot("merge");
        const ls = await M.snapshots();
        ok("C ...two snapshots there, the newest", ls.length === G.CONFIG.save.lsSnapshots && ls[0].reason === "merge");
        localStorage.removeItem(names.snaps);
        // IndexedDB that never answers: the start goes on after bootWaitMs
        DB.open = () => new Promise(() => {});
        const t0 = performance.now();
        await opened();
        const took = performance.now() - t0;
        ok("C IndexedDB hanging: the start waits, then uses the flat copy", G.save.endlessHighScore === 6 && took >= G.CONFIG.save.bootWaitMs - 50 && took < G.CONFIG.save.bootWaitMs + 800, Math.round(took) + " ms");
        G.save.endlessHighScore = 8;
        M.flush();
        ok("C ...and goes on saving to the flat copy", JSON.parse(flat()).endlessHighScore === 8);
        DB.open = open0; DB.conn = conn0; S.writing = Promise.resolve();

        // a save that cannot be read
        await wipe();
        const bad = '{"unlockedLevels":[1],"truncated';
        setFlat(bad);
        await opened();
        const fl = M.failure();
        ok("C not readable: the game starts on a blank save, and asks", !!fl && fl.raw === bad && G.save.unlockedLevels.length === 1 && !M.isFirstRun());
        G.save.endlessHighScore = 5; M.flush(); await M.settled();
        ok("C ...and nothing is written over it", flat() === bad && !(await main()));
        M.startFresh(); await M.settled();
        ok("C start fresh: the old text kept aside, the new save written", M.rescueText() === bad && !M.failure() && JSON.parse(flat()).endlessHighScore === 5);
        // both copies failing to write
        await wipe();
        await opened(); M.flush(); await M.settled();
        const run1 = DB.run, banner0 = G.UI.flashPurchaseBanner; let shown = 0;
        G.UI.flashPurchaseBanner = () => { shown++; };
        S.failShown = false;
        DB.run = () => Promise.reject(new Error("full"));
        Storage.prototype.setItem = function () { throw new Error("quota"); };
        G.save.endlessHighScore = 11; M.flush(); await M.settled();
        G.save.endlessHighScore = 12; M.flush(); await M.settled();
        Storage.prototype.setItem = setItem0; DB.run = run1; G.UI.flashPurchaseBanner = banner0;
        ok("C neither copy writes: said once", shown === 1 && G._persistFailed === true, shown);
        M.flush(); await M.settled();
        ok("C ...and written once they work again", JSON.parse(flat()).endlessHighScore === 12);
        G._persistFailed = false;
      }

      // ---------------- D: when it is written ----------------
      {
        await wipe();
        await opened(); M.flush(); await M.settled();
        let writes = 0;
        Storage.prototype.setItem = function (k, v) { if (k === names.flat) writes++; return setItem0.call(this, k, v); };
        const t0 = performance.now();
        for (let i = 0; i < 20; i++) { G.save.endlessHighScore = 100 + i; G.persist(); await wait(40); }
        const during = writes, soon = performance.now() - t0;
        while (writes === during && performance.now() - t0 < 4000) await wait(20);
        const at = performance.now() - t0;
        ok("D twenty changes in a moment: no write yet", during === 0, Math.round(soon) + " ms");
        ok("D ...one write, two seconds after the first", writes === 1 && at >= 1950 && at < 2600, Math.round(at) + " ms, " + writes);
        G.persistSoon(); await wait(30);
        ok("D persistSoon is the same", writes === 1);
        G.save.endlessHighScore = 200;
        G.persist(true);
        ok("D G.persist(true): at once", writes === 2 && JSON.parse(flat()).endlessHighScore === 200);
        G.save.endlessHighScore = 201; G.persist();
        window.dispatchEvent(new Event("pagehide"));
        ok("D the page closing: at once", writes === 3 && JSON.parse(flat()).endlessHighScore === 201);
        G.save.endlessHighScore = 202;
        Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
        document.dispatchEvent(new Event("visibilitychange"));
        delete document.hidden;
        ok("D the page hidden: at once, even without a G.persist", writes === 4 && JSON.parse(flat()).endlessHighScore === 202);
        G.persist(true); G.persist(true);
        ok("D nothing changed: nothing written", writes === 4);
        G.save.meta.playSec += 30;
        G.persist(true);
        ok("D the time played alone is written", writes === 5);
        Storage.prototype.setItem = setItem0;
        await M.settled();
        const rec = await main();
        ok("D IndexedDB has the last of them", rec.rev === G.save.meta.rev, rec.rev + " / " + G.save.meta.rev);
      }

      // ---------------- E: snapshots ----------------
      {
        await wipe();
        setFlat(fxText);
        await opened(); await wait(30);
        for (let i = 0; i < 9; i++) { G.save.endlessHighScore = i; await M.snapshot("import"); }
        const list = await M.snapshots();
        const newest = JSON.parse(list[0].json), oldest = JSON.parse(list[list.length - 1].json);
        ok("E seven kept, the newest", list.length === 7 && newest.progress.endlessHighScore === 8 && oldest.progress.endlessHighScore === 2, list.length);
        ok("E the migration's own has gone with the oldest", !list.some((r) => r.reason === "migration"));
        ok("E each says what is in it", list[0].summary.levels === 2 && list[0].summary.remembered >= 0 && "playSec" in list[0].summary && list[0].rev === G.save.meta.rev, JSON.stringify(list[0].summary));

        await wipe();
        setFlat(fxText);
        await opened(); await wait(30);
        M.flush(); await M.settled();
        S.day = -1; await M.daily();
        const n1 = (await M.snapshots()).filter((r) => r.reason === "daily").length;
        ok("E the day's backup", n1 === 1, n1);
        S.day = -1; await M.daily();
        ok("E ...once", (await M.snapshots()).filter((r) => r.reason === "daily").length === 1);
        G.Clock.offsetDays = 1; S.day = -1; await M.daily();
        ok("E a new day with nothing new: none", (await M.snapshots()).filter((r) => r.reason === "daily").length === 1);
        G.save.endlessHighScore = 4321; M.flush(); await M.settled();
        G.Clock.offsetDays = 1; S.day = -1; await M.daily();
        ok("E a new day with something new: one more", (await M.snapshots()).filter((r) => r.reason === "daily").length === 2);
        G.Clock.offsetDays = 0;
        await wipe();
        await opened(); M.flush(); await M.settled();
        S.day = -1; await M.daily();
        ok("E a new player: no backup of nothing", !(await M.snapshots()).length);

        // restore
        await wipe();
        setFlat(fxText);
        await opened(); await wait(30);
        M.flush(); await M.settled();
        const keep = await M.snapshot("daily");
        const before = clone(G.save);
        G.save.endlessHighScore = 55555; G.save.settings.fontSize = "small"; M.flush(); await M.settled();
        await M.restore(keep.id);
        ok("E restore: back as it was", !diff(before, G.save, META).length, diff(before, G.save, META).slice(0, 3).join("; "));
        const after = await M.snapshots();
        ok("E ...and what was there kept first", after[0].reason === "restore" && JSON.parse(after[0].json).progress.endlessHighScore === 55555);
        ok("E ...and stored", JSON.parse(flat()).endlessHighScore === before.endlessHighScore && (await main()).rev === G.save.meta.rev);
        ok("E the count of writes only goes up", G.save.meta.rev > keep.rev);
      }

      // ---------------- F: the file ----------------
      {
        ok("F SHA-256 of nothing", F.sha256("") === "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
        ok("F SHA-256 of abc", F.sha256("abc") === "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
        ok("F SHA-256 of two blocks", F.sha256("abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq") === "248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1");
        if (window.crypto && crypto.subtle) {
          const hex = async (t) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(t)))).map((b) => b.toString(16).padStart(2, "0")).join("");
          let badLen = null;
          for (let n = 0; n < 140 && badLen === null; n++) { const t = String.fromCharCode(0x0E01).repeat(n) + "a".repeat(n % 7); if ((await hex(t)) !== F.sha256(t)) badLen = n; }
          ok("F the same as the browser's, at every length around a block", badLen === null, badLen);
          ok("F ...and on the whole fixture", (await hex(fxText)) === F.sha256(fxText));
        }
        await wipe();
        setFlat(fxText);
        await opened(); await wait(30);
        G.save.meta.playSec = 3700;
        const file = await F.make(), o = JSON.parse(file.text), h = o.header;
        ok("F the file's name", /^vocab-zombie-save-\d{8}-\d{4}\.vzsave$/.test(file.name), file.name);
        ok("F its header", h.app === "vocab-zombie" && h.schemaVersion === M.SCHEMA && !isNaN(new Date(h.exportedAt)) && typeof h.gameVersion === "string" && h.deviceLabel.length > 0, JSON.stringify(Object.assign({}, h, { checksum: "" })));
        ok("F the checksum is the payload's", h.checksum === F.sha256(o.payload) && h.checksum.length === 64);
        ok("F compressed, and says so", h.compressed === "gzip" && o.payload.length < JSON.stringify(M.toDoc(G.save)).length / 2, o.payload.length + " of " + JSON.stringify(M.toDoc(G.save)).length);
        const res = await F.read(file.text);
        ok("F export -> import: equal in every field", !diff(G.save, res.save).length, diff(G.save, res.save).slice(0, 4).join("; "));
        ok("F its summary", res.summary.levels === 2 && res.summary.playSec === 3700 && res.exportedAt === h.exportedAt);
        const cs0 = window.CompressionStream, ds0 = window.DecompressionStream;
        window.CompressionStream = undefined;
        const plain = await F.make(), po = JSON.parse(plain.text);
        window.CompressionStream = cs0;
        ok("F no CompressionStream: plain, and says so", po.header.compressed === false && JSON.parse(po.payload).schemaVersion === M.SCHEMA);
        ok("F ...read just the same", !diff(G.save, (await F.read(plain.text)).save).length);
        window.DecompressionStream = undefined;
        const noGz = await code(() => F.read(file.text));
        window.DecompressionStream = ds0;
        ok("F no DecompressionStream: says so", noGz === "save.errGzip", noGz);
        // damaged
        const mid = Math.floor(o.payload.length / 2), flip = o.payload[mid] === "A" ? "B" : "A";
        const hurt = JSON.stringify({ header: h, payload: o.payload.slice(0, mid) + flip + o.payload.slice(mid + 1) });
        ok("F one character changed: refused", (await code(() => F.read(hurt))) === "save.errChecksum");
        ok("F ...and the message says so", /checksum/i.test(await F.read(hurt).catch((e) => e.message)));
        ok("F a wrong checksum: refused", (await code(() => F.read(JSON.stringify({ header: Object.assign({}, h, { checksum: "00" }), payload: o.payload })))) === "save.errChecksum");
        ok("F cut short: refused", (await code(() => F.read(file.text.slice(0, file.text.length - 40)))) === "save.errJson");
        ok("F another app: refused", (await code(() => F.read(JSON.stringify({ header: Object.assign({}, h, { app: "other" }), payload: o.payload })))) === "save.errApp");
        ok("F a newer version: refused", (await code(() => F.read(JSON.stringify({ header: Object.assign({}, h, { schemaVersion: 99 }), payload: o.payload })))) === "save.errNewer");
        ok("F no header: refused", (await code(() => F.read(JSON.stringify({ payload: "x" })))) === "save.errNotSave");
        ok("F any other JSON: refused", (await code(() => F.read('{"hello":1}'))) === "save.errNotSave" && (await code(() => F.read("[1,2]"))) === "save.errNotSave");
        const junk = btoa("not gzip at all");
        ok("F a good checksum on bad gzip: refused", (await code(() => F.read(JSON.stringify({ header: Object.assign({}, h, { checksum: F.sha256(junk) }), payload: junk })))) === "save.errCorrupt");
        const junk2 = "[1,2,3]";
        ok("F a good checksum on no save: refused", (await code(() => F.read(JSON.stringify({ header: Object.assign({}, h, { compressed: false, checksum: F.sha256(junk2) }), payload: junk2 })))) === "save.errCorrupt");
        // the old files
        const old = await F.read(JSON.stringify({ format: G.SAVE_FORMAT, version: G.SAVE_FORMAT_VERSION, exportedAt: "2026-10-01T10:00:00.000Z", summary: {}, save: fx }));
        ok("F the old .json export is read", !diff(G.normalizeSave(clone(fx)), old.save, /^meta\./).length && old.exportedAt === "2026-10-01T10:00:00.000Z");
        ok("F a bare save is read", !diff(G.normalizeSave(clone(fx)), (await F.read(fxText)).save, /^meta\./).length);
        const red = await new Promise((r) => G.readSaveFile(new File([file.text], file.name), (err, x) => r(err ? null : x)));
        ok("F the old G.readSaveFile reads the new file", !!red && !diff(G.save, red.save).length);
        ok("F the device label has no more than kinds", /^[A-Za-z]+( · [A-Za-z]+)?$/.test(F.deviceLabel()), F.deviceLabel());
        // how it leaves the game: a link on a computer, the share sheet on a tablet
        const clicks = [], click0 = HTMLAnchorElement.prototype.click, hand0 = G.isHandheld;
        HTMLAnchorElement.prototype.click = function () { clicks.push({ name: this.download, url: this.href }); };
        const refuse = (name) => Object.defineProperty(navigator, "share", { configurable: true, value: async () => { throw new DOMException("no", name); } });
        try {
          const how = await deliver0(file);
          ok("F a computer: a download, under the file's name", how === "saved" && clicks.length === 1 && clicks[0].name === file.name, how);
          ok("F ...of exactly the file", (await fetch(clicks[0].url).then((r) => r.text())) === file.text);
          const shared = [];
          G.isHandheld = () => true;
          Object.defineProperty(navigator, "canShare", { configurable: true, value: (d) => !!(d.files && d.files.length) });
          Object.defineProperty(navigator, "share", { configurable: true, value: async (d) => { shared.push(d.files[0]); } });
          const how2 = await deliver0(file);
          ok("F a tablet: the share sheet, and no download", how2 === "shared" && shared.length === 1 && shared[0].name === file.name && clicks.length === 1, how2);
          ok("F ...of exactly the file", (await shared[0].text()) === file.text);
          refuse("AbortError");
          ok("F ...cancelled there: cancelled, no download", (await deliver0(file)) === "cancelled" && clicks.length === 1);
          refuse("NotAllowedError");
          ok("F ...it wants a fresh tap: says so", (await deliver0(file)) === "needTap" && clicks.length === 1);
          refuse("DataError");
          ok("F ...any other refusal: a download instead", (await deliver0(file)) === "saved" && clicks.length === 2);
          Object.defineProperty(navigator, "canShare", { configurable: true, value: () => false });
          ok("F a tablet that cannot share files: a download", (await deliver0(file)) === "saved" && clicks.length === 3);
        } finally {
          HTMLAnchorElement.prototype.click = click0; G.isHandheld = hand0;
          delete navigator.canShare; delete navigator.share;
        }
      }

      // ---------------- G: merge ----------------
      {
        const blank = () => G.normalizeSave({});
        const a = blank(), b = blank();
        a.learn.srs = { alpha: { b: 2, due: 100, last: 50, n: 4, lapses: 1 }, beta: { b: 5, due: 300, last: 70, n: 2, lapses: 0 }, tie: { b: 2, due: 10, last: 60, n: 3, lapses: 0 }, never: { b: 1, due: 1, last: null, n: 0, lapses: 0, from: "stats" } };
        b.learn.srs = { alpha: { b: 5, due: 200, last: 60, n: 9, lapses: 0 }, beta: { b: 1, due: 100, last: 60, n: 7, lapses: 3 }, tie: { b: 3, due: 12, last: 60, n: 5, lapses: 0 }, never: { b: 2, due: 9, last: 5, n: 1, lapses: 0 }, gamma: { b: 3, due: 8, last: 3, n: 1, lapses: 0 } };
        a.wordStats = { w: { correct: 5, wrong: 1, lastCorrect: 100 } }; b.wordStats = { w: { correct: 3, wrong: 4, lastCorrect: 200 }, v: { correct: 1, wrong: 0, lastCorrect: 5 } };
        a.learn.conf = { x: { y: { n: 2, ok: 1, off: false } } }; b.learn.conf = { x: { y: { n: 5, ok: 0, off: true }, z: { n: 1, ok: 0, off: false } } };
        a.learn.daily = { streak: 9, best: 12, last: 40, nextDue: 41, days: { 39: 5, 40: 7 } }; b.learn.daily = { streak: 2, best: 8, last: 44, nextDue: 45, days: { 40: 9, 44: 2 } };
        a.learn.skills.spelling = { r: 5, w: 1 }; b.learn.skills.spelling = { r: 2, w: 3 };
        a.learn.activity = { 40: 3 }; b.learn.activity = { 40: 7, 41: 1 };
        a.learn.spellRun = 3; b.learn.spellRun = 8;
        a.learn.why = { w: [{ d: 1, c: "spelling", x: "a", t: "spell" }, { d: 3, c: "form", x: "b", t: "cloze" }] }; b.learn.why = { w: [{ d: 2, c: "meaning", x: "c", t: "en2th" }, { d: 3, c: "form", x: "b", t: "cloze" }] };
        a.unlockedLevels = [1, 2]; b.unlockedLevels = [1, 3];
        a.unlockedWeapons = ["pistol", "smg"]; b.unlockedWeapons = ["pistol", "rifle"];
        a.achievements = { one: true }; b.achievements = { two: true };
        a.notes.level1 = ["n1"]; b.notes.level1 = ["n1", "n2"];
        a.bosses = { seen: { x: 3 }, defeated: {} }; b.bosses = { seen: { x: 1, y: 2 }, defeated: { x: 1 } };
        a.levelHighScores = { 1: 500 }; b.levelHighScores = { 1: 300, 2: 100 };
        a.dailyHighScores = { d: 5 }; b.dailyHighScores = { d: 9 };
        a.endlessHighScore = 10; b.endlessHighScore = 20; a.endlessHighWave = 7; b.endlessHighWave = 2;
        a.leaderboards.level1 = [{ score: 50, date: "2026-01-01", meta: "" }, { score: 30, date: "2026-01-02", meta: "" }];
        b.leaderboards.level1 = [{ score: 40, date: "2026-01-03", meta: "" }, { score: 30, date: "2026-01-02", meta: "" }];
        b.leaderboards.review = [{ score: 9, date: "2026-01-03", meta: "" }];
        a.customWords.level1 = [["Apple", "m1"], ["chat", "m2"]]; b.customWords.level1 = [["apple", "m1"], ["pear", "m3"]]; b.customWords.level2 = [["APPLE", "m4"], ["chat", "m5", { wl: "fr", ml: "th" }]];
        a.importedSets = { s1: { name: "One", words: [["a", "m1"]] } }; b.importedSets = { s1: { name: "Changed", words: [] }, s2: { name: "One", words: [["a", "m1"]] }, s3: { name: "Three", words: [["b", "m3"]] } };
        const cp = (at, wave) => ({ v: 1, levelId: 1, wave, savedAt: at, player: { gunSlots: [] }, hp: 1, money: 1, score: 1 });
        a.checkpoints = { level1: cp(100, 11) }; b.checkpoints = { level1: cp(200, 13), level2: Object.assign(cp(5, 11), { levelId: 2 }) };
        a.settings.fontSize = "small"; b.settings.fontSize = "large";
        a.learnSeen = { intro_keys: true }; b.learnSeen = { intro_pad: true };
        a.tutorialSeen = { move: true }; b.tutorialSeen = { shop: true }; b.tutorialDone = true;
        a.meta = Object.assign(a.meta, { createdAt: 500, playSec: 100, deviceId: "here", rev: 7, lastExportAt: 9 }); b.meta = Object.assign(b.meta, { createdAt: 300, playSec: 400, deviceId: "there", rev: 90 });
        b.profile.name = "File";
        const a0 = clone(a), b0 = clone(b), m = F.merge(a, b), srs = m.learn.srs;
        ok("G a word: the record with the newer review", srs.alpha.b === 5 && srs.beta.b === 5 && srs.beta.n === 2, JSON.stringify(srs.beta));
        ok("G ...the same day: the one with more reviews", srs.tie.b === 3 && srs.tie.n === 5);
        ok("G ...never reviewed loses to reviewed; a word on one side comes", srs.never.b === 2 && !!srs.gamma);
        ok("G counts: the larger, field by field", m.wordStats.w.correct === 5 && m.wordStats.w.wrong === 4 && m.wordStats.w.lastCorrect === 200 && !!m.wordStats.v);
        ok("G confused pairs", m.learn.conf.x.y.n === 5 && m.learn.conf.x.y.ok === 1 && m.learn.conf.x.y.off === true && !!m.learn.conf.x.z);
        ok("G the streak goes with the newer day, the best is the best", m.learn.daily.streak === 2 && m.learn.daily.last === 44 && m.learn.daily.nextDue === 45 && m.learn.daily.best === 12);
        ok("G ...each day's count", m.learn.daily.days[40] === 9 && m.learn.daily.days[39] === 5 && m.learn.daily.days[44] === 2);
        ok("G skills, activity, the spelling run", m.learn.skills.spelling.r === 5 && m.learn.skills.spelling.w === 3 && m.learn.activity[40] === 7 && m.learn.activity[41] === 1 && m.learn.spellRun === 8);
        ok("G the causes of mistakes: both, once, in order", m.learn.why.w.length === 3 && m.learn.why.w.map((h) => h.d).join() === "1,2,3");
        ok("G unlocks: all of both", m.unlockedLevels.join() === "1,2,3" && m.unlockedWeapons.join() === "pistol,smg,rifle" && m.achievements.one && m.achievements.two && m.notes.level1.join() === "n1,n2");
        ok("G bosses, scores: the larger", m.bosses.seen.x === 3 && m.bosses.seen.y === 2 && m.bosses.defeated.x === 1 && m.levelHighScores[1] === 500 && m.levelHighScores[2] === 100 && m.dailyHighScores.d === 9 && m.endlessHighScore === 20 && m.endlessHighWave === 7);
        ok("G leaderboards: together, in order, no entry twice", m.leaderboards.level1.map((e) => e.score).join() === "50,40,30" && m.leaderboards.review.length === 1);
        const cw = m.customWords;
        ok("G the player's words: together, one of a word in any level or case", cw.level1.map((p) => p[0]).join() === "Apple,chat,pear" && cw.level2.length === 1 && cw.level2[0][2].wl === "fr", JSON.stringify(cw));
        ok("G word sets: the id's own kept, the same words not twice, a new one in", m.importedSets.s1.name === "One" && !m.importedSets.s2 && !!m.importedSets.s3);
        ok("G checkpoints: the newer of each level", m.checkpoints.level1.wave === 13 && !!m.checkpoints.level2);
        ok("G settings: this device's", m.settings.fontSize === "small");
        ok("G ...or the file's when asked", F.merge(a, b, { useFileSettings: true }).settings.fontSize === "large");
        ok("G flags: both", m.learnSeen.intro_keys && m.learnSeen.intro_pad && m.tutorialSeen.move && m.tutorialSeen.shop && m.tutorialDone === true);
        ok("G meta: the older birthday, the larger time, this device", m.meta.createdAt === 300 && m.meta.playSec === 400 && m.meta.deviceId === "here" && m.meta.lastExportAt === 9);
        ok("G the name: the file's when here has none", m.profile.name === "File");
        ok("G neither save is changed", same(a, a0) && same(b, b0));
        ok("G the result is a valid save", same(G.normalizeSave(clone(m)), m));
        const s = G.normalizeSave(clone(fx)), twin = F.merge(s, clone(s));
        ok("G the fixture with itself: nothing changes", !diff(s, twin).length, diff(s, twin).slice(0, 4).join("; "));
        const swapped = F.merge(b, a);
        ok("G either way round: the same words", same(Object.keys(swapped.learn.srs).sort(), Object.keys(srs).sort()) && same(swapped.learn.srs, srs) && same(swapped.wordStats, m.wordStats));
      }

      // ---------------- H: the reminder ----------------
      {
        await wipe();
        setFlat(fxText);
        await opened(); await wait(30);
        const m = G.save.meta, DAY = 864e5, t0 = 1800000000000;
        m.createdAt = t0; m.lastExportAt = 0; m.exportMark = 0; m.nudgeAt = 0;
        ok("H under seven days: no", !M.needsBackup(t0 + 6 * DAY));
        ok("H over seven, never backed up: yes", M.needsBackup(t0 + 8 * DAY));
        M.nudged(t0 + 8 * DAY);
        ok("H shown: not again for three days", !M.needsBackup(t0 + 10 * DAY) && M.needsBackup(t0 + 11 * DAY + 1));
        M.backedUp(t0 + 12 * DAY);
        ok("H a file made: no more", !M.needsBackup(t0 + 13 * DAY) && !M.backupOverdue(t0 + 30 * DAY));
        const w = Object.keys(G.save.learn.srs)[0];
        G.save.learn.srs[w].n += 1;
        ok("H new progress, seven days on: yes", !M.needsBackup(t0 + 18 * DAY) && M.needsBackup(t0 + 20 * DAY));
        const st = G.Account.state;
        G.Account.state = () => ({ signedIn: true });
        ok("H signed in: no", !M.needsBackup(t0 + 40 * DAY));
        G.Account.state = st;
        await wipe();
        await opened();
        G.save.meta.createdAt = t0;
        ok("H nothing played: no", !M.needsBackup(t0 + 40 * DAY));
      }

      // ---------------- I: on screen ----------------
      {
        const $ = (id) => document.getElementById(id);
        const btn = (i) => document.querySelector(`#dialog-btns [data-i="${i}"]`);
        const waitDialog = async (re) => { for (let i = 0; i < 100; i++) { if (G.Dialog.isOpen() && re.test($("dialog-title").textContent + $("dialog-text").textContent)) return true; await wait(20); } return false; };
        const openData = async () => { G.UI._settingsReturn = "screen-home"; G.SettingsUI.cat = "data"; G.UI.renderSettings(); G.UI.showScreen("screen-settings"); for (let i = 0; i < 150 && !$("set-backups").children.length; i++) await wait(20); await wait(60); };
        await wipe();
        setFlat(fxText);
        await opened(); await wait(30);
        M.flush(); await M.settled();
        await M.snapshot("daily");
        await openData();
        ok("I Settings has Data, chosen", !!$("set-cat-data") && $("set-cat-data").classList.contains("on") && !$("set-sec-data").classList.contains("hidden"));
        ok("I where it is kept", $("set-store-v").textContent === G.T("data.store.indexeddb") && $("set-store-note").textContent.length > 10, $("set-store-note").textContent);
        ok("I the last backup: never", $("set-lastbackup-v").textContent === G.T("data.never"));
        const days = (n) => G.DataUI.ago(G.Clock.now() - n * 864e5);
        ok("I ...then in days", days(0) === G.T("data.today") && days(1) === G.T("data.yesterday") && days(3) === G.T("data.daysAgo", { n: 3 }), days(3));
        ok("I Export and Import are here, not under Account", !!$("set-sec-data").querySelector("#btn-export-save") && !!$("set-sec-data").querySelector("#btn-import-save-settings") && !$("set-sec-account").querySelector("#btn-export-save"));
        const rows = $("set-backups").querySelectorAll(".set-row");
        ok("I the backups: two, each with a date, a reason, a summary and Restore", rows.length === 2 && rows[0].textContent.includes(G.T("data.reason.daily")) && rows[1].textContent.includes(G.T("data.reason.migration")) && !!rows[0].querySelector("button"), rows.length);
        ok("I every row has its line of text", Array.from($("set-sec-data").querySelectorAll(".set-row")).every((r) => r.querySelector(".set-desc")));
        ok("I reset is a danger button", $("btn-reset-progress").classList.contains("btn-danger") && !$("btn-reset-progress").disabled);
        const stops = G.SettingsUI.stops();
        ok("I keys and a controller reach them all", stops.includes($("btn-reset-progress")) && stops.some((b) => b.id.indexOf("btn-restore-") === 0) && stops.includes($("btn-export-save")));
        G.Pad.scope();
        ok("I a controller's list has them", G.Pad.focusables($("screen-settings")).includes($("btn-reset-progress")));

        // export
        let made = null;
        F.deliver = async (f) => { made = f; return "saved"; };
        await G.DataUI.exportNow();
        ok("I Export makes the file and counts it", !!made && /\.vzsave$/.test(made.name) && G.save.meta.lastExportAt > 0 && $("set-lastbackup-v").textContent === G.T("data.today"));
        // a tablet that wants a fresh tap
        let tries = 0;
        F.deliver = async () => (++tries === 1 ? "needTap" : "shared");
        G.save.meta.lastExportAt = 0;
        await G.DataUI.exportNow();
        ok("I a browser that wants a tap: a button to tap", G.Dialog.isOpen() && $("dialog-title").textContent === G.T("data.exportTitle") && G.save.meta.lastExportAt === 0);
        btn(0).click(); await wait(40);
        ok("I ...then it is saved", tries === 2 && !G.Dialog.isOpen() && G.save.meta.lastExportAt > 0);
        F.deliver = async () => "cancelled";
        G.save.meta.lastExportAt = 0;
        await G.DataUI.exportNow();
        ok("I cancelled: not counted", G.save.meta.lastExportAt === 0 && !G.Dialog.isOpen());
        F.deliver = async () => "saved";

        // import: a damaged file
        const file = await F.make();
        await G.DataUI.onFile(new File([file.text.slice(0, 100)], "x.vzsave"));
        ok("I a damaged file: a window that says so", G.Dialog.isOpen() && $("dialog-title").textContent === G.T("data.importFailed") && $("dialog-text").textContent === G.T("save.errJson"));
        G.Dialog.close();
        // import: Merge
        const other = G.normalizeSave(clone(fx));
        other.endlessHighScore = 999999; other.settings.fontSize = "small"; other.meta.playSec = 7300; other.unlockedLevels = [1, 2, 3];
        const doc = JSON.stringify(M.toDoc(other));
        const oFile = JSON.stringify({ header: { app: "vocab-zombie", schemaVersion: 2, gameVersion: "x", exportedAt: "2026-10-01T10:00:00.000Z", deviceLabel: "iPad · Safari", compressed: false, checksum: F.sha256(doc) }, payload: doc });
        // (through the real file box)
        const box = $("import-save-file"), dt = new DataTransfer();
        dt.items.add(new File([oFile], "o.vzsave"));
        box.files = dt.files;
        box.dispatchEvent(new Event("change"));
        ok("I the file box leads to the preview, and lets a file be chosen again", (await waitDialog(new RegExp(G.T("data.importTitle")))) && !box.value);
        ok("I it asks for our kinds of file on a computer", box.accept === ".vzsave,.json", box.accept);
        ok("I the preview: a table of both sides", G.Dialog.isOpen() && $("dialog-body").querySelectorAll("tbody tr").length === 4 && $("dialog-body").textContent.includes("2 "), $("dialog-body").textContent.slice(0, 60));
        ok("I ...with the file's date, words, levels, time", $("dialog-body").querySelectorAll("tbody tr")[2].cells[2].textContent === "3" && $("dialog-body").querySelectorAll("tbody tr")[3].cells[2].textContent === G.T("data.time.hm", { h: 2, m: 2 }));
        const before = clone(G.save), keys0 = (await M.snapshots()).length;
        reloads = 0;
        btn(0).click();
        ok("I Merge: done, and it asks to restart", await waitDialog(new RegExp(G.T("data.done.merge"))));
        ok("I ...the best of both", G.save.endlessHighScore === 999999 && G.save.unlockedLevels.join() === "1,2,3" && G.save.settings.fontSize === before.settings.fontSize);
        ok("I ...a snapshot first", (await M.snapshots())[0].reason === "merge" && (await M.snapshots()).length === Math.min(7, keys0 + 1));
        btn(0).click(); await wait(40);
        await wait(60);
        ok("I ...the page restarts", reloads === 1 && !G.Dialog.isOpen(), reloads);
        // import: Merge with the file's settings
        await G.DataUI.onFile(new File([oFile], "o.vzsave"));
        $("dlg-use-settings").checked = true;
        btn(0).click();
        await waitDialog(new RegExp(G.T("data.done.merge")));
        ok("I the tick: the file's settings too", G.save.settings.fontSize === "small");
        G.Dialog.close();
        // import: Replace
        await G.DataUI.onFile(new File([oFile], "o.vzsave"));
        btn(1).click();
        await waitDialog(new RegExp(G.T("data.done.import")));
        ok("I Replace: the file, whole", !diff(other, G.save, /^meta\./).length && (await M.snapshots())[0].reason === "import", diff(other, G.save, /^meta\./).slice(0, 3).join("; "));
        G.Dialog.close();
        // cancel
        await G.DataUI.onFile(new File([oFile], "o.vzsave"));
        const rev0 = G.save.meta.rev;
        btn(2).click(); await wait(30);
        ok("I Cancel: nothing changes", G.save.meta.rev === rev0 && !G.Dialog.isOpen());

        // restore from the list
        await openData();
        const first = (await M.snapshots()).find((r) => r.reason === "merge");
        $("btn-restore-" + first.id).click();
        ok("I Restore asks first", G.Dialog.isOpen() && $("dialog-title").textContent === G.T("data.restoreTitle") && $("dialog-text").textContent.includes(G.T("data.summary", { words: first.summary.remembered, levels: first.summary.levels, time: G.T("data.time.m", { m: 0 }) }).split(" ")[0]));
        btn(1).click(); await wait(30);
        ok("I ...Cancel keeps things", !G.Dialog.isOpen() && G.save.meta.rev === rev0);
        $("btn-restore-" + first.id).click();
        btn(0).click();
        ok("I ...yes: restored", await waitDialog(new RegExp(G.T("data.done.restore"))));
        G.Dialog.close();

        // reset
        await openData();
        G.save.settings.fontSize = "large";
        $("btn-reset-progress").click();
        await wait(30);
        const go = btn(0), inp = $("dlg-code");
        const shownCode = /(\d{4})/.exec($("dialog-text").textContent)[1];
        ok("I Reset: a code to type, the button off until it is right", !!inp && go.disabled);
        const rev1 = G.save.meta.rev;
        go.click(); await wait(20);
        ok("I ...the button does nothing until then", G.Dialog.isOpen() && G.save.meta.rev === rev1);
        inp.value = "0000"; inp.dispatchEvent(new Event("input"));
        ok("I ...a wrong code keeps it off", go.disabled);
        G.onKeyDown({ code: "Enter", key: "Enter", preventDefault() {} }); await wait(20);
        ok("I ...and Enter too", G.Dialog.isOpen() && G.save.meta.rev === rev1);
        inp.focus();
        G.onKeyDown({ code: "Digit1", key: "1", preventDefault() {} });
        ok("I digits typed in the box are not button shortcuts", G.Dialog.isOpen());
        G.onKeyDown({ code: "Backspace", key: "Backspace", preventDefault() {} });
        ok("I ...nor Backspace", G.Dialog.isOpen());
        inp.value = shownCode; inp.dispatchEvent(new Event("input"));
        ok("I the right code: on", !go.disabled);
        go.click();
        ok("I Reset done", await waitDialog(new RegExp(G.T("data.done.reset"))));
        ok("I ...the progress gone, the settings kept", !Object.keys(G.save.learn.srs).length && !Object.keys(G.save.wordStats).length && G.save.unlockedLevels.length === 1 && !Object.keys(G.save.checkpoints).length && G.save.settings.fontSize === "large");
        ok("I ...a snapshot first, with it all in", (await M.snapshots())[0].reason === "reset" && Object.keys(JSON.parse((await M.snapshots())[0].json).learning.wordStats).length > 100);
        G.Dialog.close();
        // the controller's digits
        const pad0 = G.Input.padActive;
        G.Input.padActive = true;
        G.DataUI.askReset(); await wait(20);
        const shown = /(\d{4})/.exec($("dialog-text").textContent)[1];
        shown.split("").forEach((d) => $("dialog-body").querySelector(`[data-d="${d}"]`).click());
        ok("I a controller: buttons for the digits", $("dlg-code").value === shown && !btn(0).disabled);
        G.Dialog.close();
        G.Input.padActive = pad0;

        // the Main Menu's card
        G.Dialog.close();
        await wipe();
        setFlat(fxText);
        await opened(); await wait(30);
        G.save.meta.createdAt = Date.now() - 30 * 864e5;
        G.DataUI._nudged = false;
        G.MainMenu.show(); await wait(60);
        const card = $("home-nudge");
        ok("I the Main Menu's card", !card.classList.contains("hidden") && $("home-nudge-text").textContent.length > 20 && G.save.meta.nudgeAt > 0);
        const n = G.MainMenu.btns.length;
        ok("I ...its buttons follow the menu's for keys and a controller", G.MainMenu.btns[n - 1] === $("home-nudge-later") && G.MainMenu.items()[n - 2] === "backup");
        $("home-nudge-later").click(); await wait(30);
        ok("I ...Later closes it, and the menu's list is as it was", card.classList.contains("hidden") && G.MainMenu.btns.length === n - 2 && G.MainMenu.focusI < n - 2);
        G.MainMenu.refresh();
        ok("I ...and it stays closed", card.classList.contains("hidden"));
        G.save.meta.nudgeAt = 0; G.save.meta.createdAt = Date.now() - 30 * 864e5;
        G.MainMenu.refresh();
        $("home-nudge-go").click(); await wait(120);
        ok("I ...Back Up opens Settings > Data", G.UI._currentScreen === "screen-settings" && G.SettingsUI.cat === "data" && card.classList.contains("hidden"));
        ok("I the red dot on Data while one is due", !document.querySelector("#set-cat-data .sc-dot").classList.contains("hidden"));

        // a run: what replaces the save is locked
        const ret = G.UI._settingsReturn;
        G.UI._settingsReturn = "screen-pause";
        G.UI.renderSettings(); await wait(120);
        const locked = ["btn-import-save-settings", "btn-reset-progress"].every((id) => $(id).disabled);
        ok("I in a run: Import, Reset and Restore are off", locked && Array.from($("set-backups").querySelectorAll("button")).every((b) => b.disabled));
        ok("I ...Export is not", !$("btn-export-save").disabled);
        G.UI._settingsReturn = ret;

        // not readable, at the menu
        await wipe();
        setFlat("{broken");
        await opened();
        G.Dialog.close();
        G.MainMenu.show(); await wait(60);
        ok("I not readable: the window, first thing", G.Dialog.isOpen() && $("dialog-title").textContent === G.T("data.failTitle"));
        let raw = null;
        F.deliver = async (f) => { raw = f; return "saved"; };
        btn(0).click(); await wait(30);
        ok("I ...Export Raw Data gives what was there, and stays", !!raw && raw.text === "{broken" && /\.txt$/.test(raw.name) && G.Dialog.isOpen());
        btn(1).click(); await wait(60);
        ok("I ...Start Fresh goes on", !G.Dialog.isOpen() && !M.failure() && M.rescueText() === "{broken");
        await openData();
        ok("I ...and the copy is still in Data", !!$("btn-export-raw"));
        raw = null; $("btn-export-raw").click(); await wait(30);
        ok("I ...to export any time", !!raw && raw.text === "{broken");
        G.UI.goToMainMenu();
      }
    } catch (e) {
      ok("the suite ran to its end", false, String(e && e.stack || e));
    } finally {
      Storage.prototype.setItem = setItem0;
      G.Clock.offsetDays = 0;
      F.deliver = deliver0; M.reload = reload0;
      if (G.Dialog.isOpen()) G.Dialog.close();
      G.Modal.reset();
      await end();
      if (G.lang !== lang0) await new Promise((res) => G.setUILang(lang0, { done: res }));
      G.DataUI.closeNudge();
      window.removeEventListener("error", onErr);
      window.removeEventListener("unhandledrejection", onErr);
    }
    ok("the page's own save is as it was", G.save === save0);
    const missing = Object.keys(G._missingKeys || {});
    ok("no missing strings", !missing.length, missing.join());
    ok("no uncaught errors", errs.length === 0, errs.join(" | "));
    return { total: results.length, fail: results.filter((r) => !r.pass), pass: results.filter((r) => r.pass).map((r) => r.name + (r.info !== "" ? " [" + r.info + "]" : "")) };
  }
  return { run };
})();
