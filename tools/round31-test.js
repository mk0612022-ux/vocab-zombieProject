// Dev-only (not shipped). The expansion's round 2: the bug and word reports.
//   A  the console: copied into a ring, still reaching the real console
//   B  errors: thrown, rejected, a file not loaded; the same one only counts
//   C  frames: FPS, the worst frame, the 1% low, slow frames, nothing kept of a
//      tab that was away; what a frame costs
//   D  G.Bus: the last fifty events, the game's own among them
//   E  the report: everything the prompt lists, from a real run; nothing of
//      the player's name; a part that fails leaves the rest
//   F  the picture: the frame drawn, as a JPEG no wider than 1280
//   G  the window: from the pause menu, Settings, How to Play and its key; the
//      form; the file and the summary; the last ten kept; the game held and
//      let go
//   H  the toast: a thrown error, the toast, the report with its stack
//   I  a word: the flag in the explanation, the Word Log and the card; what is
//      kept; the file and the copy; no word and no box touched
//   J  Settings > Help; keys and a controller; the clipboard refusing
// Reports go to a store of the test's own. Load it into the game (in the lobby), then:
//   const r = await G.Round31Test.run();   r.fail -> [] when everything passes
window.G = window.G || {};
G.Round31Test = (function () {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  async function run() {
    const results = [], errs = [];
    const ok = (name, pass, info) => { results.push({ name, pass: !!pass, info: info === undefined ? "" : info }); };
    const BOOM = "round31 test error";
    const onErr = (e) => { const m = String(e.message || (e.reason && e.reason.message) || e.reason || e); if (m.indexOf(BOOM) < 0) errs.push(m); };
    window.addEventListener("error", onErr);
    window.addEventListener("unhandledrejection", onErr);
    const D = G.Diag, R = G.BugReport, W = G.WordReport, S = G.ReportStore, F = G.SaveFile, g = G.Game;
    const $ = (id) => document.getElementById(id);
    const btn = (i) => document.querySelector(`#dialog-btns [data-i="${i}"]`);
    const until = async (fn, ms) => { const t0 = performance.now(); while (!fn() && performance.now() - t0 < (ms || 15000)) await wait(20); return !!fn(); };
    const backup = JSON.stringify(G.save), deliver0 = F.deliver, copy0 = G.DataUI.copy, spawn0 = G.Spawner.update, lock0 = G.Input.requestPointerLock, state0 = G.Account.state;
    const real = g._update0 || g.update;
    const files = [];
    let copied = null;
    F.deliver = async (f) => { files.push(f); return "saved"; };
    G.DataUI.copy = async (t, done) => { copied = t; if (done) done(); };
    G.Input.requestPointerLock = () => {};
    S.use("vzt" + Date.now());
    const shotWait = G.CONFIG.diag.shotWaitMs;
    G.CONFIG.diag.shotWaitMs = 15000;                   // (a frame can take seconds in a test browser)
    try {
      // ---------------- A: the console ----------------
      {
        const n0 = D.logs().length;
        console.log("round31 plain", 42, { a: 1 });
        console.warn("round31 warned");
        console.error(new Error("round31 an error object"));
        const logs = D.logs(), last = logs.slice(-3);
        ok("A a log line: its words joined, objects as JSON", last[0].level === "log" && last[0].text === 'round31 plain 42 {"a":1}', last[0].text);
        ok("A warn and error each their level, an Error by its stack", last[1].level === "warn" && last[2].level === "error" && /round31 an error object/.test(last[2].text) && last[2].text.length > 30);
        const loop = {}; loop.self = loop;
        console.debug(loop);
        ok("A a cycle does not break it", D.logs().slice(-1)[0].text === '{"self":{...}}', D.logs().slice(-1)[0].text);
        console.debug({ a: { deep: { deeper: 1 } }, list: [[1, 2], "x"] }, Array.from({ length: 20 }, (_, i) => i), new Map());
        ok("A an object is followed one level, a few items", /"a":\{\.\.\.\}/.test(D.logs().slice(-1)[0].text) && /,\.\.\.\]/.test(D.logs().slice(-1)[0].text) && /\[object Map\]/.test(D.logs().slice(-1)[0].text), D.logs().slice(-1)[0].text);
        console.info("x".repeat(1000));
        ok("A a long line is cut", D.logs().slice(-1)[0].text.length === G.CONFIG.diag.logChars);
        for (let i = 0; i < 260; i++) console.debug("round31 fill " + i);
        const after = D.logs();
        ok("A two hundred lines, the newest, in order", after.length === G.CONFIG.diag.logs && after[199].text === "round31 fill 259" && after[0].text === "round31 fill 60", after.length + " " + after[0].text);
        ok("A it started with the page", n0 >= 0 && typeof after[0].t === "number");
      }

      // ---------------- B: errors ----------------
      {
        R._toastAt = performance.now();                // (no toast yet: H)
        const n0 = D.errors().length;
        setTimeout(() => { throw new Error(BOOM + " thrown"); }, 0);
        await until(() => D.errors().length > n0);
        const e = D.errors().find((x) => x.message.indexOf(BOOM + " thrown") >= 0);
        ok("B a thrown error, with its stack and place", !!e && e.kind === "error" && /Error/.test(e.stack) && /round31-test\.js/.test(e.stack + e.where), e && e.where);
        Promise.reject(new Error(BOOM + " rejected"));
        await until(() => D.errors().some((x) => x.kind === "rejection"));
        const r = D.errors().find((x) => x.kind === "rejection");
        ok("B a rejected promise, with its stack", !!r && r.message.indexOf(BOOM) >= 0 && r.stack.length > 10);
        const m = D.errors().length;
        for (let i = 0; i < 3; i++) D.addError("error", BOOM + " same", "stack here");
        ok("B the same one again only counts", D.errors().length === m + 1 && D.errors().slice(-1)[0].count === 3);
        D.addError("error", "ResizeObserver loop completed with undelivered notifications.");
        ok("B the browser's note about a layout loop is no error", D.errors().length === m + 1);
        const img = document.createElement("img");
        img.src = "/round31-no-such-file.png"; document.body.appendChild(img);
        await until(() => D.errors().some((x) => x.kind === "load"));
        img.remove();
        ok("B a file that did not load", D.errors().some((x) => x.kind === "load" && /no-such-file/.test(x.message)));
        const before = D.errors().length;
        for (let i = 0; i < 40; i++) D.addError("error", BOOM + " many " + i, "s" + i);
        ok("B thirty kept, the newest", D.errors().length === G.CONFIG.diag.errors && before > 0 && /many 39/.test(D.errors().slice(-1)[0].message));
      }

      // ---------------- C: frames ----------------
      {
        const t0 = performance.now();
        for (let i = 0; i < 200000; i++) D.frame(16.7);
        const perFrame = (performance.now() - t0) / 200000;
        ok("C a frame's bookkeeping: far under 0.2 ms", perFrame < 0.002, perFrame.toFixed(6) + " ms");
        // (the best of four passes: a stall of the machine's is not the event's cost)
        let perEvent = Infinity;
        for (let pass = 0; pass < 4; pass++) {
          const t1 = performance.now();
          for (let i = 0; i < 5000; i++) G.Bus.emit("round31:cost", { i });
          perEvent = Math.min(perEvent, (performance.now() - t1) / 5000);
        }
        ok("C an event's: the same", perEvent < 0.02, perEvent.toFixed(6) + " ms");
        D.frame(0); D.frame(-1); D.frame(5000);
        const a = D.fps();
        ok("C a tab that was away is no slow frame", a.min > 50, a.min);
        ok("C all the frame times, at most what the ring holds", a.frames === G.CONFIG.diag.frames);
        ok("C two minutes of seconds", a.seconds.length === G.CONFIG.diag.seconds, a.seconds.length);
        for (let i = 0; i < 7200; i++) D.frame(i % 100 === 0 ? 100 : 10);
        const b = D.fps();
        ok("C the 1% low is the worst frames", Math.abs(b.low1 - 10) < 0.2 && Math.abs(b.min - 10) < 0.2, JSON.stringify([b.low1, b.min]));
        ok("C the frames over 50 ms", b.slow === 72, b.slow);
        ok("C the average", Math.abs(b.avg - 1000 / 10.9) < 1, b.avg);
        ok("C each second: FPS, its worst, its slow frames", b.seconds.every((s) => s.length === 3) && b.seconds.some((s) => s[1] === 10 && s[2] === 1), JSON.stringify(b.seconds[0]));
      }

      // ---------------- D: G.Bus ----------------
      {
        for (let i = 0; i < 80; i++) G.Bus.emit("round31:n", { i });
        ok("D the last fifty events", G.Bus.recent.length === G.CONFIG.diag.events && G.Bus.recent[49].p.i === 79 && typeof G.Bus.recent[49].t === "number");
      }

      // ---------------- a real run, for what follows ----------------
      g.update = real;
      G.Spawner.update = function () {};
      g.startLevel(1);
      g.update = function () {};
      g.requiredKills = 1e9; g.clearZombies(); G.Modal.reset();
      g.paused = false; g.state = "GAMEPLAY"; G.Input.clearHeldInputs();
      for (let i = 0; i < 3; i++) real.call(g, 1 / 60);
      const p = g.yawObject.position;
      g.spawnZombieAt("normal", new THREE.Vector3(p.x + 3, p.y - 1.7, p.z), null);
      g.spawnZombieAt("normal", new THREE.Vector3(p.x + 4, p.y - 1.7, p.z), null);
      g.spawnZombieAt("fast", new THREE.Vector3(p.x + 5, p.y - 1.7, p.z), null);
      ok("D the game's own events", G.Bus.recent.some((e) => e.type === "game:level" && e.p.id === 1) && G.Bus.recent.some((e) => e.type === "game:wave"));

      // ---------------- E: the report ----------------
      {
        G.save.profile.name = "SECRETNAME"; G.save.settings.graphicsQuality = G.save.settings.graphicsQuality || "low";
        const r = R.collect(), t = JSON.stringify(r);
        ok("E the version", typeof r.version.version === "string" && "build" in r.version && "commit" in r.version, JSON.stringify(r.version));
        ok("E the time, UTC and local", !isNaN(new Date(r.at)) && r.at.endsWith("Z") && r.local.length > 10 && typeof r.tzMinutes === "number");
        ok("E the device", r.device.ua === navigator.userAgent && r.device.width === innerWidth && r.device.dpr === devicePixelRatio && !!r.device.orientation && /keyboard|touch|controller/.test(r.device.input), r.device.input);
        const x = r.graphics;
        ok("E the graphics", x.quality === G.save.settings.graphicsQuality && x.fpsCap === G.save.settings.fpsCap && x.fps.frames > 0 && x.calls >= 0 && x.triangles >= 0 && x.geometries > 0 && x.textures >= 0 && x.programs > 0, JSON.stringify(Object.assign({}, x, { fps: 0 })));
        ok("E the sound", typeof r.audio.state === "string");
        ok("E the settings that matter", r.settings.uiLang === G.save.settings.uiLang && "gameSpeed" in r.settings);
        const q = r.game;
        ok("E the game: state, level, wave", q.state === "GAMEPLAY" && q.level === 1 && q.wave >= 1 && q.mode === g.mode, JSON.stringify([q.state, q.level, q.wave]));
        ok("E zombies by kind", q.zombies === 3 && q.kinds.normal === 2 && q.kinds.fast === 1, JSON.stringify(q.kinds));
        ok("E the player", q.player.hp === g.player.hp && q.player.maxHp === g.player.maxHp && typeof q.player.stamina === "number" && Math.abs(q.player.x - p.x) < 0.01);
        ok("E the weapon and its state machine", q.weapon.id === g.currentWeaponId() && q.weapon.state === g.wsm.state && typeof q.weapon.stateTime === "number" && Array.isArray(q.weapon.slots));
        ok("E the HUD's values", r.hud && typeof r.hud.hp === "number" && !!r.hud.hand && !!r.hud.head);
        ok("E logs, errors, events", r.logs.length > 50 && r.errors.length > 0 && r.events.length === 50);
        ok("E an event carries plain values only", r.events.every((e) => Object.keys(e.p).every((k) => e.p[k] === null || typeof e.p[k] !== "object")));
        ok("E nothing of the player's name", t.indexOf("SECRETNAME") < 0 && !("profile" in r) && !("uid" in r));
        // a word on screen, a question open
        g.startWordChallenge("x", () => {}, () => {}, {});
        const c = R.collect().game.question;
        ok("E the question open", !!c && !!c.word && !!c.type, JSON.stringify(c));
        g.challenge = null; G.Modal.reset(); G.UI.setChallengeVisible(false);
        g.state = "GAMEPLAY"; g.paused = false;
        const bad = g.currentWeaponId;
        g.currentWeaponId = () => { throw new Error("broken"); };
        const r2 = R.collect();
        g.currentWeaponId = bad;
        ok("E a part that fails leaves the rest", !!r2.game.failed && !!r2.device.ua && !!r2.version);
        JSON.stringify(R.collect());
        ok("E it is all plain JSON", true);
      }

      // ---------------- F: the picture ----------------
      {
        const url = await D.shot();
        ok("F a JPEG", /^data:image\/jpeg;base64,/.test(url || ""), url && url.slice(0, 30));
        const img = new Image();
        await new Promise((res) => { img.onload = img.onerror = res; img.src = url; });
        const cv = g.renderer.domElement;
        ok("F no wider than 1280, the frame's shape", img.width <= G.CONFIG.diag.shotWidth && img.width > 100 && Math.abs(img.width / img.height - cv.width / cv.height) < 0.02, img.width + "x" + img.height);
        const c = document.createElement("canvas"); c.width = 32; c.height = 18;
        const x = c.getContext("2d"); x.drawImage(img, 0, 0, 32, 18);
        const px = x.getImageData(0, 0, 32, 18).data;
        let sum = 0; for (let i = 0; i < px.length; i += 4) sum += px[i] + px[i + 1] + px[i + 2];
        ok("F of the frame, not of an empty canvas", sum > 500, sum);
        ok("F small enough to keep", url.length < 2e6, url.length);
        const drawn = D.drawn;
        D.drawn = () => {};                             // (nothing drawn: no picture, and no wait for ever)
        const res = await D.shot();
        D.drawn = drawn;
        ok("F no frame drawn: none, after a moment", res === null, String(res).slice(0, 20));
      }

      // ---------------- G: the window ----------------
      {
        g.pause();
        ok("G the pause menu has the button", G.UI._currentScreen === "screen-pause" && !$("btn-pause-report").classList.contains("hidden"));
        $("btn-pause-report").click();
        ok("G it opens, over the game", R.shown && !$("bug-report").classList.contains("hidden") && G.Modal.isOpen("bugreport"));
        ok("G a controller moves inside it", G.Pad.scope() === $("bug-report-box"));
        const pad = G.Pad.focusables($("bug-report-box"));
        ok("G ...to everything", pad.some((b) => b.classList.contains("rp-chip")) && pad.includes($("rp-text")) && pad.includes($("rp-shot")) && pad.includes($("btn-rp-save")) && pad.includes($("btn-rp-close")), pad.length);
        ok("G the seven kinds", document.querySelectorAll("#rp-cats .rp-chip").length === 7);
        ok("G the things one might have been doing", document.querySelectorAll("#rp-doing .rp-chip").length >= 5);
        ok("G screenshot on, UID off", $("rp-shot").checked && !$("rp-uid").checked);
        ok("G a guest has no UID to attach", $("rp-uid").disabled);
        ok("G it says what goes in, and what does not", $("bug-report-body").querySelector("details summary") && $("bug-report-body").querySelector("details p").textContent.length > 40 && $("bug-report-body").querySelector(".rp-note").textContent.length > 20);
        await until(() => !$("rp-thumb").classList.contains("hidden"), 20000);
        ok("G the picture is shown", !$("rp-thumb").classList.contains("hidden") && /^data:image\/jpeg/.test($("rp-thumb").src));
        $("rp-cats").querySelector('[data-cat="audio"]').click();
        ok("G a kind chosen", $("rp-cats").querySelector('[data-cat="audio"]').classList.contains("on") && R.f.cat === "audio");
        $("rp-cats").querySelector('[data-cat="visual"]').click();
        ok("G ...one at a time", $("rp-cats").querySelectorAll(".on").length === 1 && R.f.cat === "visual");
        $("rp-doing").querySelector('[data-do="reloading"]').click();
        ok("G what was going on", R.f.doing === "reloading");
        $("rp-doing").querySelector('[data-do="reloading"]').click();
        ok("G ...tapped again, taken back", R.f.doing === "" && !$("rp-doing").querySelector(".on"));
        $("rp-doing").querySelector('[data-do="reloading"]').click();
        $("rp-text").value = "the gun vanished"; $("rp-text").dispatchEvent(new Event("input"));
        let prevented = false;
        G.onKeyDown({ code: "KeyW", key: "w", preventDefault() { prevented = true; } });
        ok("G typing reaches the box", !prevented && R.shown);
        $("btn-rp-save").click();
        await until(() => files.length === 1 && !R.shown);
        const rep = JSON.parse(files[0].text);
        ok("G the file's name", /^vocab-zombie-report-\d{8}-\d{4}\.vzreport$/.test(files[0].name), files[0].name);
        ok("G what the player said", rep.form.category === "visual" && rep.form.doing === "reloading" && rep.form.text === "the gun vanished");
        ok("G the report as it was when opened", rep.kind === "report" && rep.game.state === "PAUSE" && rep.game.level === 1 && rep.game.windows.length === 0, JSON.stringify(rep.game.windows));
        ok("G with its picture", /^data:image\/jpeg/.test(rep.screenshot || ""));
        ok("G no UID", !("uid" in rep));
        ok("G it closes, and says so", !R.shown && !$("ui-notice").classList.contains("hidden") && $("ui-notice").textContent === G.T("report.saved"));
        ok("G the game is still paused", g.state === "PAUSE");
        const kept = await S.all("reports");
        ok("G kept on this device", kept.length === 1 && kept[0].form.text === "the gun vanished");
        // the picture left out; the UID ticked; the summary
        G.Account.state = () => ({ signedIn: true, uid: "123456789", name: "x" });
        R.open();
        $("rp-shot").click();
        ok("G the picture can be left out", R.f.shot === false && $("rp-thumb").classList.contains("hidden"));
        ok("G a signed-in player can tick the UID, off to start", !$("rp-uid").disabled && !$("rp-uid").checked);
        $("rp-uid").click();
        $("btn-rp-copy").click();
        await until(() => copied !== null);
        ok("G the summary, and the window stays", !!copied && R.shown && $("ui-notice").textContent === G.T("report.copied"), JSON.stringify([!!copied, R.shown, $("ui-notice").textContent]));
        const k2 = await S.all("reports");
        ok("G kept once", k2.length === 2 && k2[1].screenshot === null && k2[1].uid === "123456789", k2.length);
        $("btn-rp-copy").click();
        await wait(40);
        ok("G ...however often it is copied", (await S.all("reports")).length === 2);
        G.onKeyDown({ code: "Escape", key: "Escape", preventDefault() {} });
        ok("G Esc closes it", !R.shown && !G.Modal.isOpen("bugreport"));
        G.Account.state = state0;
        // the summary's limits
        const big = Object.assign({}, k2[1], { errors: Array.from({ length: 30 }, (_, i) => ({ message: "e" + i, stack: "s\n".repeat(400), count: 1, where: "" })), logs: Array.from({ length: 200 }, (_, i) => ({ level: "log", text: "l".repeat(300) + i })) });
        ok("G the summary fits", R.summary(big).length <= G.CONFIG.diag.summaryChars, R.summary(big).length);
        const sum = R.summary(rep);
        ok("G it has what a developer needs", /# Vocab Zombie bug report/.test(sum) && /visual/.test(sum) && /reloading/.test(sum) && /gun vanished/.test(sum) && /Version:/.test(sum) && /Weapon:/.test(sum) && /FPS/.test(sum) && /GPU/.test(sum), sum.length);
        ok("G ...and an error's stack", /## Errors/.test(sum) && /many 39/.test(sum));
        // ten kept
        for (let i = 0; i < 12; i++) await S.put("reports", { id: S.newId(), at: new Date().toISOString(), form: { category: "", text: "n" + i } }, G.CONFIG.diag.reports);
        const ten = await S.all("reports");
        ok("G ten kept, the newest", ten.length === 10 && ten[9].form.text === "n11" && ten[0].form.text === "n2", ten.length);
        await S.clear("reports");
        await S.put("reports", rep, 10);
        // in play: held and let go
        g.resume();
        ok("G (back in the run)", g.state === "GAMEPLAY" && !g.paused);
        G.onKeyDown({ code: G.save.settings.keybinds.report, key: "F8", preventDefault() {} });
        ok("G its key opens it, and the game waits", R.shown && g.paused && G.Modal.pausesAll());
        G.onKeyDown({ code: G.save.settings.keybinds.report, key: "F8", preventDefault() {} });
        ok("G ...pressed again it stays one window", R.shown && G.Modal.stack.filter((m) => m.id === "bugreport").length === 1);
        const snapState = R.snap.game.state;
        R.close();
        ok("G closed, the game goes on", !g.paused && g.state === "GAMEPLAY" && snapState === "GAMEPLAY");
        const area = document.createElement("textarea"); document.body.appendChild(area); area.focus();
        const kb = G.save.settings.keybinds, was = kb.report;
        kb.report = "KeyP";
        G.onKeyDown({ code: "KeyP", key: "p", preventDefault() {} });
        ok("G a letter for the key: not while typing", !R.shown);
        kb.report = was; area.remove();
        ok("G it is in the key list", document.querySelector('.keybind-btn[data-action="report"]') !== undefined && G.defaultKeybinds().report === "F8");
        g.quitToMainMenu();
        G.UI.menuOrigin = "lobby"; G.UI.goToMainMenu();
        await wait(60);
        G.UI.showScreen("screen-howtoplay");
        $("btn-help-report").click();
        ok("G from How to Play", R.shown);
        ok("G in a menu the report still comes", R.snap.game.state === "MENU" && R.snap.game.screen === "screen-howtoplay" && R.snap.hud === null, JSON.stringify(R.snap.game));
        R.close();
        G.UI.goToMainMenu();
      }

      // ---------------- H: the toast ----------------
      {
        R._toastAt = -1e9;
        const el = $("diag-toast");
        setTimeout(() => { throw new Error(BOOM + " toast"); }, 0);
        await until(() => !el.classList.contains("hidden"));
        ok("H a toast, and nothing stops", !el.classList.contains("hidden") && !G.Modal.isOpen() && el.textContent.length > 10, el.textContent);
        ok("H ...its key on a keyboard", el.textContent.indexOf("F8") >= 0 || G.Input.mode === "touch");
        el.click();
        ok("H a tap opens the report", R.shown && R.f.cat === "crash" && el.classList.contains("hidden"));
        ok("H the report has the stack", R.snap.errors.some((e) => e.message.indexOf(BOOM + " toast") >= 0 && /Error/.test(e.stack)));
        R.close();
        el.classList.add("hidden");
        setTimeout(() => { throw new Error(BOOM + " toast 2"); }, 0);
        await wait(80);
        ok("H not again at once", el.classList.contains("hidden"));
        ok("H ...but it is kept", D.errors().some((e) => e.message.indexOf(BOOM + " toast 2") >= 0));
        R._toastAt = -1e9;
        R.toast();
        ok("H on a touch screen it says tap", (() => { const m = G.Input.mode; G.Input.mode = "touch"; R._toastAt = -1e9; R.toast(); const t = el.textContent; G.Input.mode = m; return t === G.T("report.toast"); })());
        R.hideToast();
      }

      // ---------------- I: a word ----------------
      {
        const pair = G.getAllBuiltinWords()[5], key = G.wordKey(pair);
        const srs0 = JSON.stringify(G.save.learn), bank0 = JSON.stringify(G.getAllBuiltinWords());
        // in the explanation
        const box = document.createElement("div"); document.body.appendChild(box);
        const ex = G.Explain.build({ pair, right: false, picked: G.getAllBuiltinWords()[6], type: "th2en" });
        let goneOn = false;
        const v = G.ExplainView.show(box, ex, { auto: 2, onContinue: () => { goneOn = true; } });
        const flag = box.querySelector(".xp-flag");
        ok("I the explanation has a flag", !!flag && flag.getAttribute("aria-label") === G.T("word.flag"));
        flag.click();
        ok("I it opens a short form", G.Dialog.isOpen() && document.querySelectorAll("#wr-types .rp-chip").length === 6 && !!$("wr-note"));
        ok("I Auto-continue waits", v.held === true);
        G.ExplainView.tick(v, 5);
        ok("I ...the answer stays", !goneOn);
        ok("I no problem chosen: nothing to keep", btn(0).disabled);
        document.querySelector('#wr-types [data-t="meaning"]').click();
        ok("I a problem chosen", !btn(0).disabled && document.querySelector('#wr-types .on').dataset.t === "meaning");
        $("wr-note").value = "should be something else";
        btn(0).click();
        await wait(300);
        const w1 = (await S.all("words")).slice(-1)[0];
        ok("I kept: the word's id, its two languages", !!w1 && w1.wordId === key && w1.word === pair[0] && w1.meaning === pair[1] && w1.wl === G.Lang.wl(pair) && w1.ml === G.Lang.ml(pair), JSON.stringify(w1 && [w1.wordId, w1.wl, w1.ml]));
        ok("I ...the problem and the note", w1.type === "meaning" && w1.note === "should be something else" && w1.where === "explain");
        ok("I ...the text on screen", w1.shown === G.Explain.text(ex, true) && w1.shown.length > 5);
        ok("I ...and it says so", await until(() => $("ui-notice").textContent === G.T("word.kept")));
        box.remove();
        // in the Word Log
        G.UI.renderVocabLog(1); G.UI.showScreen("screen-vocablog");
        await wait(30);
        const lf = document.querySelector("#vocablog-content [data-flag]");
        ok("I the Word Log has one a word", !!lf && document.querySelectorAll("#vocablog-content [data-flag]").length === document.querySelectorAll("#vocablog-content .vocab-item").length);
        lf.click();
        ok("I it opens the form, not the card", G.Dialog.isOpen() && !G.Modal.isOpen("vocabcard"));
        document.querySelector('#wr-types [data-t="pos"]').click();
        btn(0).click();
        await wait(300);
        const w2 = (await S.all("words")).slice(-1)[0];
        ok("I from the Word Log", w2.where === "log" && w2.type === "pos" && w2.wordId === G.wordKey(G.UI._vocabLogWords[0]));
        ok("I the text shown: the word and its meaning", w2.shown.indexOf(w2.word) === 0 && w2.shown.indexOf(w2.meaning) > 0);
        // on the card
        G.VocabCard.open(pair);
        $("btn-card-flag").click();
        ok("I the card has one, the form over it", G.Dialog.isOpen() && G.Modal.isOpen("vocabcard"));
        G.onKeyDown({ code: "Escape", key: "Escape", preventDefault() {} });
        ok("I Esc leaves the form, the card stays", !G.Dialog.isOpen() && G.Modal.isOpen("vocabcard"));
        ok("I ...and keeps nothing", (await S.all("words")).length === 2);
        $("btn-card-flag").click();
        document.querySelector('#wr-types [data-t="example"]').click();
        $("wr-note").focus();
        let p2 = false;
        G.onKeyDown({ code: "Enter", key: "Enter", preventDefault() { p2 = true; } });
        ok("I Enter in the note is a new line", G.Dialog.isOpen() && !p2);
        G.onKeyDown({ code: "Digit1", key: "1", preventDefault() {} });
        ok("I ...and a digit a digit", G.Dialog.isOpen());
        btn(0).click();
        await wait(300);
        G.VocabCard.close();
        ok("I from the card", (await S.all("words")).slice(-1)[0].where === "card");
        ok("I no word changed, no box moved", JSON.stringify(G.save.learn) === srs0 && JSON.stringify(G.getAllBuiltinWords()) === bank0);
        // out
        const list = await S.all("words");
        const f = W.fileOf(list), o = JSON.parse(f.text);
        ok("I the file", /^vocab-zombie-words-\d{8}-\d{4}\.vzwords$/.test(f.name) && o.app === "vocab-zombie" && o.kind === "words" && o.count === 3 && o.reports[0].wordId === key, f.name);
        const s = W.summary(list);
        ok("I the copy", s.indexOf(key) > 0 && /should be something else/.test(s) && /by hand/.test(s));
        const many = Array.from({ length: 300 }, (_, i) => Object.assign({}, list[0], { wordId: "word" + i }));
        ok("I a long list fits, and says how many are left out", W.summary(many).length <= G.CONFIG.diag.summaryChars && /more in the file/.test(W.summary(many)));
      }

      // ---------------- J: Settings > Help ----------------
      {
        G.UI._settingsReturn = "screen-home"; G.SettingsUI.cat = "help"; G.UI.renderSettings(); G.UI.showScreen("screen-settings");
        await until(() => $("set-reports").children.length > 0 && /\d/.test($("set-wordreports-v").textContent));
        ok("J Settings has Help", !!$("set-cat-help") && !$("set-sec-help").classList.contains("hidden"));
        ok("J the word reports' count", $("set-wordreports-v").textContent === G.T("help.wordsCount", { n: 3 }), $("set-wordreports-v").textContent);
        const rows = $("set-reports").querySelectorAll(".set-row");
        ok("J the reports kept, each with Save and Copy", rows.length === 1 && rows[0].querySelectorAll("button").length === 2 && rows[0].textContent.indexOf("the gun vanished") >= 0, rows.length);
        ok("J every row has its line of text", Array.from($("set-sec-help").querySelectorAll(".set-row")).every((r) => r.querySelector(".set-desc")));
        ok("J keys and a controller reach them", G.SettingsUI.stops().includes($("btn-report-bug")) && G.SettingsUI.stops().includes($("btn-words-file")) && G.SettingsUI.stops().some((b) => /^btn-report-file-/.test(b.id)));
        files.length = 0;
        rows[0].querySelector("button").click();
        await until(() => files.length === 1);
        ok("J a report exported again", files.length === 1 && JSON.parse(files[0].text).form.text === "the gun vanished");
        files.length = 0;
        $("btn-words-file").click();
        await until(() => files.length === 1);
        ok("J the word reports exported", files.length === 1 && /\.vzwords$/.test(files[0].name));
        copied = null;
        $("btn-words-copy").click();
        await until(() => copied !== null);
        ok("J ...or copied", /word reports \(3\)/.test(copied || ""));
        $("btn-report-bug").click();
        ok("J the button opens the report", R.shown);
        R.close();
        $("btn-words-clear").click();
        await wait(20);
        ok("J Clear asks first", G.Dialog.isOpen() && (await S.all("words")).length === 3);
        btn(1).click(); await wait(30);
        ok("J ...Cancel keeps them", (await S.all("words")).length === 3);
        $("btn-words-clear").click(); await wait(20);
        btn(0).click();
        await until(() => $("set-wordreports-v").textContent === G.T("help.wordsCount", { n: 0 }));
        ok("J ...yes: gone, and the buttons off", (await S.all("words")).length === 0 && $("btn-words-file").disabled && $("btn-words-clear").disabled);
        // the clipboard
        G.DataUI.copy = copy0;
        const ec = document.execCommand, cb = Object.getOwnPropertyDescriptor(Navigator.prototype, "clipboard");
        let hit = 0;
        Object.defineProperty(navigator, "clipboard", { configurable: true, value: undefined });
        document.execCommand = (c) => { hit += c === "copy" ? 1 : 0; return true; };
        let done = 0;
        await G.DataUI.copy("hello", () => { done++; });
        ok("J no Clipboard API (plain http): the old way", hit === 1 && done === 1);
        document.execCommand = () => false;
        await G.DataUI.copy("hello again", () => { done++; });
        ok("J neither: a window to copy from", done === 1 && G.Dialog.isOpen() && $("dlg-copy").value === "hello again");
        G.Dialog.close();
        document.execCommand = ec;
        delete navigator.clipboard;
        if (cb) ok("J (the Clipboard API back)", !!navigator.clipboard);
        G.UI.goToMainMenu();
      }
    } catch (e) {
      ok("the suite ran to its end", false, String(e && e.stack || e));
    } finally {
      G.CONFIG.diag.shotWaitMs = shotWait;
      F.deliver = deliver0; G.DataUI.copy = copy0; G.Account.state = state0; G.Input.requestPointerLock = lock0;
      G.Spawner.update = spawn0; g.update = real;
      R.close(); R.hideToast();
      if (G.Dialog.isOpen()) G.Dialog.close();
      G.Modal.reset();
      if (g.state !== "MENU") g.quitToMainMenu();
      await S.clear("reports"); await S.clear("words");
      const name = S.names.db;
      S.use("");
      await new Promise((res) => { const q = indexedDB.deleteDatabase(name); q.onsuccess = q.onerror = q.onblocked = () => res(); });
      G.save = G.normalizeSave(JSON.parse(backup)); G.persist();
      G.UI.menuOrigin = "lobby"; G.UI.goToMainMenu();
      window.removeEventListener("error", onErr);
      window.removeEventListener("unhandledrejection", onErr);
    }
    const missing = Object.keys(G._missingKeys || {});
    ok("no missing strings", !missing.length, missing.join());
    ok("no uncaught errors", errs.length === 0, errs.join(" | "));
    return { total: results.length, fail: results.filter((r) => !r.pass), pass: results.filter((r) => r.pass).map((r) => r.name + (r.info !== "" ? " [" + r.info + "]" : "")) };
  }
  return { run };
})();
