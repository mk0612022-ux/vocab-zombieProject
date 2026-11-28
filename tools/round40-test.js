// Dev-only (not shipped). The story series' round 2: the narrative tools (js/story/dialogue.js,
// phone.js, storycam.js, lexilens.js) and the stand-in prologue that tries them.
//   A  the data and the settings: the chapter's phone, the lines' keys, the scenes' clocks; the
//      keys T and L (an old save: unbound if taken); Settings' rows only while Story Mode is on
//   B  the dialogue box: speaker, English, the bank's words a button, the chapter's bold; the
//      three subtitle levels (and the box's button); Enter, the timer, held = faster, a short
//      press = next; a word tapped = its card, no review; no jump while a line is up
//   C  a choice (G.Dialog): keys 1-3, kept in the save; a word question counts (SRS), a practice
//      word does not
//   D  the phone: a message, its toast and badge, the flag; T opens it (the world held), tabs,
//      subtitles; L the torch -- the SpotLight in the light pool, the light count the same on and
//      off; Esc / T close; the touch buttons (44 px); the phone as a checkpoint left it
//   E  the camera: a turn to a point, the view locked, a walk, the bars, the world slowed
//   F  LexiLens: the HUD's parts (and the zombies' words), the boot, the theme, a glitch, a system
//      line and its subtitle, "Neural pattern disrupted" on a right shot
//   G  the prologue's first minute: no HUD, the alarm, the messages, Beam's thread read, the
//      reply, the walk in to the radio's line (story round 5: the whole prologue is suite 43's)
//   H  a cinematic part seen once (round 5: the walk in from the gate) is skipped by holding
//      Space; never the first time
//   I  a controller: the D-pad's up opens the phone, B closes it, down the torch
//   J  four languages: a line's subtitle, the phone, a system line
//   K  leaving a chapter: nothing of it left for the campaign (HUD, labels, torch, classes)
// Load it into the game (in the lobby), then:
//   const r = await G.Round40Test.run();   r.fail -> [] when everything passes
window.G = window.G || {};
G.Round40Test = (function () {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  async function run() {
    const results = [], errs = [], numbers = {};
    const ok = (name, pass, info) => { results.push({ name, pass: !!pass, info: info === undefined ? "" : info }); window._t40 = results.length + " " + name; };
    const onErr = (e) => errs.push(String(e.message || (e.reason && e.reason.message) || e.reason || e));
    window.addEventListener("error", onErr);
    window.addEventListener("unhandledrejection", onErr);
    const g = G.Game, S = G.Story, SC = G.StoryScenes, D = G.StoryDialogue, PH = G.StoryPhone, CAM = G.StoryCam, LENS = G.LexiLens, CH = G.STORY_CHAPTERS.ch1;
    const T = (k, v) => G.T(k, v), $ = (id) => document.getElementById(id), B = document.body;
    const backup = JSON.stringify(G.save), lang0 = G.lang, lock0 = G.Input.requestPointerLock, enabled0 = G.CONFIG.story.enabled, mode0 = G.Input.mode, pad0 = G.Input.pollGamepad;
    const real = g._update0 || g.update;
    G._missingKeys = {};
    G.Input.requestPointerLock = () => {};
    const step = (n, dt) => { for (let i = 0; i < n; i++) real.call(g, dt || 1 / 60); };
    const until = (cond, max) => { for (let i = 0; i < (max || 900) && !cond(); i++) step(1); return !!cond(); };
    const yield0 = () => wait(0);
    const key = (code) => G.onKeyDown({ code, preventDefault() {}, stopPropagation() {}, repeat: false });
    const setLang = (l) => (G.lang === l ? Promise.resolve() : new Promise((r) => G.setUILang(l, { done: r })));
    const settle = () => { g.update = () => {}; G.Modal.reset(); g.paused = false; g.state = "GAMEPLAY"; G.Input.clearHeldInputs(); step(2); };
    const play = (fn) => { g.update = real; fn(); settle(); };
    const at = (x, z, y) => { g.teleportPlayer(new THREE.Vector3(x, y || 0, z)); step(2); };
    // (story round 4: a zone of the chapter's map, by name -- its middle, on its storey)
    const toZone = (name) => { const q = G.STORY_CHAPTERS.ch1.zones[name]; at((q.x0 + q.x1) / 2, (q.z0 + q.z1) / 2, q.y); };
    const alive = () => g.zombies.filter((z) => z.alive);
    const clearAll = () => { for (let i = 0; i < 40 && alive().length; i++) { step(1); const tp = g.targetPair; const z = alive().find((q) => tp && q.word === tp[0]); if (z) g.damageZombie(z, 9999, z.mesh.position.clone(), { dir: null, head: false }); step(2); } };
    const pick = (i) => { g.update = real; G.Dialog.choose(i); g.update = () => {}; g.paused = false; step(2); };
    // the lines up now (not the ones the beats after them add): each one moved on as it shows
    const talkAll = () => {
      let n = (D.current ? 1 : 0) + D.queued;
      for (let i = 0; i < 90 * (n + 1) && n > 0; i++) { if (D.current) { D.next(); n--; } step(1); }
      step(2);
    };
    const vis = (sel) => { const el = document.querySelector(sel); return !!el && getComputedStyle(el).visibility !== "hidden" && getComputedStyle(el).display !== "none"; };
    const lights = () => { let n = 0; g.scene.traverse((o) => { if (o.isLight) n++; }); return n; };
    const fresh = () => {
      G.save.story = { ch: {} };
      // (a play of the prologue elsewhere in this browser leaves its cinematic parts "seen":
      // held Space would skip them; these checks see them the first time)
      Object.keys(G.save.tutorialSeen || {}).forEach((k) => { if (/^story_/.test(k)) delete G.save.tutorialSeen[k]; });
    };
    const quit = () => { if (G.Dialog.isOpen()) G.Dialog.close(); if (PH.isOpen()) PH.close(); g.update = real; if (g.state !== "MENU") g.quitToMainMenu(); g.update = () => {}; G.Modal.reset(); };

    // (story round 6: scenes 1-1 and 1-2 are the design's now -- the run's shell this suite tries
    // (zones, groups, checkpoints, a scene's HUD) goes on the stand-ins it was written for, put back after)
    const CHS = G.STORY_CHAPTERS.ch1.scenes, real12 = CHS.slice(1, 9);       // (story round 7: and 1-3, 1-4; round 8: 1-5; round 9: 1-6; round 10: 1-7, 1-8)
    CHS.splice(1, 8,
      { id: "s1", title: "story.ch1.s1", objective: "story.ch1.s1.obj", start: { x: -1.5, y: 8, z: 0.4, yaw: -Math.PI / 2 }, clock: "08:50", light: "alarm", beats: [
        { do: [["objective", "story.ch1.s1.obj"]] },
        { wait: { zone: "corridor3East" }, do: [["banner", "story.ph.group"], ["spawn", { id: "c1", at: "corridor3Far", count: 3 }]] },
        { wait: { cleared: "c1" }, do: [["banner", "story.ph.clear"], ["checkpoint"], ["next"]] }] },
      { id: "s2", title: "story.ch1.s2", objective: "story.ch1.s2.obj", start: { x: 25.5, y: 4, z: -0.5, yaw: Math.PI / 2 }, clock: "09:10", light: "blackout", beats: [
        { do: [["objective", "story.ch1.s2.obj"]] },
        { wait: { zone: "libraryBack" }, do: [["spawn", { id: "r1", at: "wing2", count: 2 }]] },
        { wait: { cleared: "r1" }, do: [["checkpoint"], ["next"]] }] },
      { id: "s3", title: "story.ch1.s3", objective: "story.ch1.s3.obj", start: { x: -31.5, y: 4, z: 4.6, yaw: Math.PI }, clock: "09:30", light: "library",
        cast: [{ id: "min", who: "min", at: { x: -37, y: 4, z: 5.5 }, yaw: -Math.PI / 2 }, { id: "nam", who: "nam", at: { x: -36.6, y: 4, z: 4.3 }, yaw: -Math.PI / 2 + 0.3 },
          { id: "tonkla", who: "tonkla", at: { x: -37.4, y: 4, z: 6.9 }, yaw: -Math.PI / 2 - 0.3 }], beats: [
        { do: [["objective", "story.ch1.s3.obj"], ["spawn", { id: "d1", at: "libWindows", count: 2 }]] },
        { wait: { cleared: "d1" }, do: [["checkpoint", { x: -31.5, y: 4, z: 4.6, yaw: Math.PI }], ["spawn", { id: "d2", at: "libDoors", count: 3 }]] },
        { wait: { cleared: "d2" }, do: [["banner", "story.ph.clear"], ["checkpoint"], ["next"]] }] },
      { id: "s4", title: "story.ch1.s4", objective: "story.ch1.s4.obj", start: { x: -33, y: 4, z: 4.6, yaw: Math.PI / 2 }, clock: "10:15", light: "nurse", beats: [
        { do: [["objective", "story.ch1.s4.obj"]] },
        { wait: { zone: "nurse" }, do: [["spawn", { id: "n1", at: "wing2", count: 2 }]] },
        { wait: { cleared: "n1" }, do: [["checkpoint"], ["next"]] }] },
      { id: "s5", title: "story.ch1.s5", objective: "story.ch1.s5.obj", start: { x: -42, y: 4, z: -17.5, yaw: Math.PI }, clock: "12:30", light: "noon", beats: [
        { do: [["objective", "story.ch1.s5.obj"]] },
        { wait: { zone: "canteen" }, do: [["banner", "story.ph.group"], ["spawn", { id: "f1", at: "canteenFar", count: 4 }]] },
        { wait: { cleared: "f1" }, do: [["checkpoint"], ["next"]] }] },
      { id: "s6", title: "story.ch1.s6", objective: "story.ch1.s6.obj", start: { x: -41.2, y: 0, z: -1, yaw: -Math.PI / 2 }, clock: "17:00", light: "golden", beats: [
        { do: [["objective", "story.ch1.s6.obj"]] },
        { wait: { zone: "adminDoor" }, do: [["spawn", { id: "h1", at: "corridor1", count: 3 }]] },
        { wait: { cleared: "h1" }, do: [["checkpoint"], ["next"]] }] },
      // (story round 10: 1-7 and 1-8 too)
      { id: "s7", title: "story.ch1.s7", objective: "story.ch1.s7.obj", start: { x: 4.5, y: 0, z: 6, yaw: Math.PI }, clock: "17:45", light: "sunset", doors: { ENTRANCE: true }, beats: [
        { do: [["objective", "story.ch1.s7.obj"]] },
        { wait: { zone: "flagYard" }, do: [["banner", "story.ph.group"], ["spawn", { id: "b1", at: "yardRows", count: 4 }]] },
        { wait: { cleared: "b1" }, do: [["checkpoint"], ["next"]] }] },
      { id: "s8", title: "story.ch1.s8", objective: "story.ch1.s8.obj", start: { x: 0, y: 0, z: 30, yaw: -2.35 }, clock: "18:15", light: "dusk", beats: [
        { do: [["objective", "story.ch1.s8.obj"]] },
        { wait: { zone: "gate" }, do: [["end"]] }] });
    try {
      G.CONFIG.story.enabled = true;
      G.save.settings.storySubs = "full";
      // ================= A: the data and the settings =================
      {
        for (const l of ["th", "zh", "fr"]) await setLang(l);   // (the other languages' tables load when first used)
        await setLang("en");
        const beats = CH.scenes[0].beats, keys = [];
        beats.forEach((b) => (b.do || []).forEach((a) => {
          if (a[0] === "say") a[1].forEach((it) => keys.push(it.line));
          if (a[0] === "ask") { keys.push(a[1].line); a[1].options.forEach((o) => keys.push(o.text)); [].concat(a[1].right || [], a[1].wrong || []).forEach((it) => keys.push(it.line)); }
          if (a[0] === "sys") keys.push(typeof a[1] === "string" ? a[1] : a[1].key);
        }));
        Object.keys(CH.messages).forEach((m) => keys.push(CH.messages[m].text));
        Object.keys(CH.notices).forEach((n) => keys.push(CH.notices[n].text, CH.notices[n].app));
        const missing = keys.filter((k) => ["en", "th", "zh", "fr"].some((l) => !G.STRINGS[l] || G.STRINGS[l][k] == null));
        numbers.lines = keys.length;
        ok("A the prologue's lines, choices, system lines, messages (" + keys.length + "): in all four languages", keys.length >= 25 && !missing.length, missing.join(" "));
        ok("A every scene has its clock (the phone's), the prologue starts with no HUD and no glasses", CH.scenes.every((s) => /^\d\d:\d\d$/.test(s.clock)) && CH.scenes[0].hud === "none" && CH.scenes[0].lens === false);
        ok("A the phone's contacts, messages, notices", CH.messages.beam1.from === "beam" && CH.messages.min1.from === "min" && CH.notices.cal && CH.notices.ad);
        const kb = G.defaultKeybinds();
        ok("A the keys: phone T, flashlight L (decision D5)", kb.phone === "KeyT" && kb.flashlight === "KeyL");
        const old = JSON.parse(backup); old.settings = Object.assign({}, old.settings, { keybinds: Object.assign({}, old.settings.keybinds, { reload: "KeyT" }) });
        delete old.settings.keybinds.phone; delete old.settings.keybinds.flashlight;
        const n = G.normalizeSave(old).settings.keybinds;
        ok("A an old save with T taken: phone unbound, flashlight L", n.phone === "" && n.flashlight === "KeyL" && n.reload === "KeyT", n.phone + "/" + n.flashlight);
        ok("A storySubs: default full, a bad value mended", G.defaultSave().settings.storySubs === "full" && G.normalizeSave(Object.assign(JSON.parse(backup), { settings: Object.assign({}, JSON.parse(backup).settings, { storySubs: "x" }) })).settings.storySubs === "full");
        G.CONFIG.story.enabled = false;
        G.SettingsUI.cat = "language"; G.UI._settingsReturn = "screen-mainmenu"; G.UI.renderSettings(); G.UI.showScreen("screen-settings"); await wait(60);
        const offRow = document.querySelector('[data-row="set-storysubs"]');
        G.SettingsUI.cat = "controls"; G.UI.renderSettings(); await wait(40);
        const offKey = !document.querySelector('.keybind-btn[data-action="phone"]');
        ok("A Story Mode off: no subtitle row, no phone / flashlight keys in Settings", (!offRow || offRow.classList.contains("hidden")) && offKey);
        G.CONFIG.story.enabled = true;
        G.UI.renderSettings(); await wait(40);
        const onKey = !!document.querySelector('.keybind-btn[data-action="phone"]') && !!document.querySelector('.keybind-btn[data-action="flashlight"]');
        G.SettingsUI.cat = "language"; G.UI.renderSettings(); await wait(40);
        const onRow = document.querySelector('[data-row="set-storysubs"]');
        ok("A on: both keys listed, the subtitle row there (3 choices)", onKey && onRow && !onRow.classList.contains("hidden") && onRow.querySelectorAll(".seg-o").length === 3);
        G.UI.menuOrigin = "lobby"; G.UI.goToMainMenu();
        await yield0();
      }

      // ================= B: the dialogue box =================
      {
        fresh();
        play(() => S.start("ch1", { scene: 1, beat: 0, skip: true }));
        step(4);
        await setLang("th");
        D.say([{ who: "invig", line: "story.ch1.d.invigLens" }]);
        step(1);
        const box = $("story-dlg");
        ok("B a line: the box, the speaker, the English", vis("#story-dlg") && $("sd-who").textContent === T("story.who.invig") && $("sd-line").textContent === G.STRINGS.en["story.ch1.d.invigLens"], $("sd-line").textContent);
        const words = Array.from(box.querySelectorAll(".sd-word")).map((b) => b.dataset.form.toLowerCase());
        ok("B ...the bank's words a button (verify), the chapter's bold (candidate is not in the bank yet: plain)", words.includes("verify") && box.querySelector('.sd-word.key[data-form="verify"]'), words.join(","));
        ok("B full subtitles: the whole line in the menus' language", $("sd-subwrap").textContent === G.STRINGS.th["story.ch1.d.invigLens"]);
        D.setLevel("key");
        ok("B key words: the chapter's words with their meaning, nothing else", box.querySelector(".sd-gloss") && $("sd-subwrap").textContent.indexOf("verify") >= 0 && $("sd-subwrap").textContent !== G.STRINGS.th["story.ch1.d.invigLens"], $("sd-subwrap").textContent);
        D.setLevel("en");
        ok("B English only: no subtitle; the level kept in the settings", !$("sd-subwrap").textContent && G.save.settings.storySubs === "en");
        $("sd-lvl").click();
        ok("B the box's button: the next level (full again)", D.level() === "full" && $("sd-subwrap").textContent === G.STRINGS.th["story.ch1.d.invigLens"]);
        await setLang("en");
        D.say(["story.ch1.d.chaiGo"]);
        key("Enter"); step(16);
        ok("B Enter: the next line (no speaker: none shown)", D.current && D.current.line === "story.ch1.d.chaiGo" && $("sd-who").classList.contains("hidden"));
        const dur = D.current.dur;
        step(Math.ceil(dur * 60) + 4);
        ok("B by itself after its time (" + dur.toFixed(1) + " s), then the box goes", !D.busy() && (step(30), $("story-dlg").classList.contains("hidden")), dur);
        // held: faster; a short press: next
        D.say([{ who: "radio", line: "story.ch1.d.radio" }, { who: "chai", line: "story.ch1.d.chaiGo" }]);
        step(1);
        const kbJ = G.save.settings.keybinds.jump;
        G.Input.keys[kbJ] = true; step(30);
        ok("B held (Space): everything 4x as fast, the hint's ring full", D.fast() === G.CONFIG.story.dialogue.fast && vis("#story-hold") && $("story-hold").classList.contains("on"));
        const t0 = D.current.t; step(30);
        ok("B ...the line's clock running 4x", D.current.t - t0 > 1.5, (D.current.t - t0).toFixed(2));
        G.Input.keys[kbJ] = false; step(2);
        const l0 = D.current && D.current.line;
        G.Input.keys[kbJ] = true; step(5); G.Input.keys[kbJ] = false; step(2);
        ok("B a short press: the next line", l0 === "story.ch1.d.radio" && (step(16), D.current && D.current.line === "story.ch1.d.chaiGo"), D.current && D.current.line);
        // no jump while a line is up
        G.Input.keys[kbJ] = true; step(6);
        const vy = g.velocityY, held = D.holdsJump();
        G.Input.keys[kbJ] = false; step(2);
        ok("B no jump while a line is up (the key is the dialogue's)", vy === 0 && held, vy + " " + held);
        D.clear(); step(2);
        G.Input.keys[kbJ] = true; step(2);
        const vy2 = g.velocityY; G.Input.keys[kbJ] = false; step(30);
        ok("B ...and a jump again once none is", vy2 > 0, vy2);
        // a word tapped: its card, no review
        D.say([{ who: "invig", line: "story.ch1.d.invigLens" }]); step(1);
        const vw = $("story-dlg").querySelector('.sd-word[data-form="verify"]');
        const srs0 = JSON.stringify(G.save.learn.srs[G.wordKey(G.WordBank.pairOf(G.WordBank.byId("verify")))] || null);
        vw.click(); await wait(20);
        ok("B a word tapped: its mini card (the peek window), the world held while it is read", G.Modal.isOpen("wordpeek") && !$("word-peek").classList.contains("hidden") && G.Modal.freezesWorld());
        G.VocabCard.closePeek();
        ok("B ...a look, not a review: its box unchanged", JSON.stringify(G.save.learn.srs[G.wordKey(G.WordBank.pairOf(G.WordBank.byId("verify")))] || null) === srs0);
        D.clear();
        quit();
        await yield0();
      }

      // ================= C: a choice =================
      {
        fresh();
        play(() => S.start("ch1", { scene: 1, beat: 0, skip: true }));
        step(3);
        let got = null;
        D.ask({ who: "beam", line: "story.ch1.m.beam2", options: [{ text: "story.ch1.c.what", value: "what" }, { text: "story.ch1.c.promise", value: "promise" }] }, (i, op) => { got = op.value; S.chose("beam", op.value); });
        await wait(20);
        const btns = Array.from(document.querySelectorAll("#dialog-btns button"));
        ok("C a choice: G.Dialog's window, the question with its speaker, 2 answers in English", G.Dialog.isOpen() && $("dialog-box").classList.contains("story-choice") && $("dialog-body").textContent.indexOf(T("story.who.beam")) >= 0 && btns.length === 2 && btns[0].querySelector(".sc-en").textContent === G.STRINGS.en["story.ch1.c.what"]);
        ok("C ...the world held (a window: the run paused)", g.paused && !g.playing());
        g.update = real; key("Digit2"); g.update = () => {}; g.paused = false; step(2);
        ok("C key 2: the second answer, kept in the chapter's save", got === "promise" && G.save.story.ch.ch1.choices.beam === "promise" && !G.Dialog.isOpen());
        // a word question that counts, and a practice one that does not
        const e = G.WordBank.byId("verify"), p = G.WordBank.pairOf(e), k = G.wordKey(p);
        const before = JSON.stringify(G.save.learn.srs[k] || null);
        D.ask({ line: "story.ch1.d.invigLens", quiz: { word: "verify", kind: "meaning" }, options: [{ text: "story.ch1.c.pencil", right: true }, { text: "story.ch1.c.ruler" }] }, () => {});
        await wait(10); pick(0);
        ok("C a word question answered: it counts for the word (its SRS record moved)", JSON.stringify(G.save.learn.srs[k] || null) !== before, before + " -> " + JSON.stringify(G.save.learn.srs[k] || null));
        const srsN = Object.keys(G.save.learn.srs).length;
        D.ask({ line: "story.ch1.d.beamThing", quiz: { word: "pencil", practice: true }, options: [{ text: "story.ch1.c.pencil", right: true }, { text: "story.ch1.c.ruler" }] }, () => {});
        await wait(10); pick(1);
        ok("C a practice word: nothing recorded", Object.keys(G.save.learn.srs).length === srsN && !G.save.learn.srs.pencil);
        quit();
        await yield0();
      }

      // ================= D: the phone =================
      {
        fresh();
        play(() => S.start("ch1", { scene: 1, beat: 0, skip: true }));
        step(3);
        const L0 = lights();
        ok("D a chapter's light pool has the torch (a SpotLight, off)", G.Perf.torch && G.Perf.torch.isSpotLight && G.Perf.torch.intensity === 0 && G.Perf.torch.parent === g.scene);
        PH.deliver("beam1"); step(1);
        ok("D a message: its toast (Beam, the text, T to open), the flag", vis("#story-toast") && $("story-toast").textContent.indexOf(T("story.who.beam")) >= 0 && $("story-toast").textContent.indexOf("LEXA") >= 0 && S.run.flags.has("msg:beam1") && PH.unread() === 1);
        PH.notify("cal"); step(1);
        key("KeyT"); step(1);
        ok("D T: the phone (a window, the world held)", PH.isOpen() && G.Modal.isOpen("story-phone") && G.Modal.freezesWorld());
        const tabs = Array.from(document.querySelectorAll("#sp-tabs .sp-tab")).map((t) => t.dataset.thread);
        ok("D ...a tab for Beam and the notifications; Beam's message (unread now 1: the notification)", tabs.join() === "beam,*" && $("sp-body").textContent.indexOf("LEXA") >= 0 && PH.unread() === 1, tabs.join());
        // (a message with one of the chapter's words in it: a line of the chapter's, sent by hand)
        CH.messages._t40 = { from: "beam", text: "story.ch1.d.invigLens" };
        PH.deliver("_t40"); step(1);
        ok("D ...a message's words: the bank's tappable, the chapter's bold (verify)", !!$("sp-body").querySelector('.sd-word.key[data-form="verify"]') && $("sp-body").querySelectorAll(".sp-msg").length === 2);
        delete CH.messages._t40; PH.state.msgs = PH.state.msgs.filter((m) => m !== "_t40"); S.run.flags.delete("msg:_t40"); PH.state.unread.beam = 0;
        ok("D ...the clock of the scene (08:50)", $("sp-clock").textContent === "08:50");
        G.Modal.handleKey({ code: "ArrowRight", repeat: false });
        ok("D the arrow: the notifications (the calendar's)", document.querySelector(".sp-tab.on").dataset.thread === "*" && $("sp-body").textContent.indexOf("Room 305") >= 0 && PH.unread() === 0);
        G.Modal.handleKey({ code: "KeyL", repeat: false });
        ok("D L in the phone: the torch on (its button pressed)", PH.state.torch && $("sp-torch").getAttribute("aria-pressed") === "true");
        G.Modal.handleKey({ code: "Escape", repeat: false });
        ok("D Esc: the phone closed, the run going again", !PH.isOpen() && !G.Modal.isOpen() && g.playing());
        step(30);
        const on = G.Perf.torch.intensity, L1 = lights();
        ok("D the torch lit, ahead of the eyes (target in front)", on > 1 && G.Perf.torch.target.position.distanceTo(g.yawObject.position) > 5, on.toFixed(2));
        key("KeyL"); step(40);
        ok("D L: off again (intensity 0)", G.Perf.torch.intensity === 0 && !PH.state.torch, G.Perf.torch.intensity);
        ok("D the scene's light count the same with the torch on and off (" + L0 + ")", L0 === L1 && lights() === L0, L0 + "/" + L1 + "/" + lights());
        key("KeyT"); step(1); key("KeyT"); step(1);
        ok("D T again: closed", !PH.isOpen());
        // touch: the buttons
        G.Input.mode = "touch"; G.UI.applyControlMode(); await wait(30);
        const tb = $("touch-phone"), tt = $("touch-torch");
        ok("D touch: the phone and torch buttons there in a chapter, at least 44 px", tb && tt && vis("#touch-phone") && tb.offsetWidth >= 44 && tb.offsetHeight >= 44 && tt.offsetWidth >= 44, tb && tb.offsetWidth);
        PH.deliver("beam2"); step(1);
        ok("D ...the badge counts the unread", !$("touch-phone-badge").classList.contains("hidden") && $("touch-phone-badge").textContent === "1");
        G.Input.mode = mode0; G.UI.applyControlMode();
        // the checkpoint keeps the phone
        g.update = real; S.checkpoint(g, null); g.update = () => {};
        const cp = JSON.parse(JSON.stringify(G.save.story.ch.ch1.cp));
        quit();
        play(() => S.start("ch1", cp));
        step(2);
        ok("D Continue from that checkpoint: the phone as it was (Beam's 2 messages, the notice)", PH.threads().join() === "beam,*" && PH.state.msgs.join() === "beam1,beam2" && PH.state.notes.join() === "cal", PH.state.msgs.join());
        quit();
        await yield0();
      }

      // ================= E: the camera =================
      {
        fresh();
        play(() => S.start("ch1", { scene: 1, beat: 0, skip: true }));
        step(3);
        const pt = { x: 10, y: 1.7, z: 12 };
        CAM.look(g, pt, 0.5); step(10);
        ok("E look: the view turning", CAM.turning && CAM.busy());
        step(30);
        const P = g.yawObject.position, fwd = new THREE.Vector3(-Math.sin(g.yawObject.rotation.y), 0, -Math.cos(g.yawObject.rotation.y));
        const to = new THREE.Vector3(pt.x - P.x, 0, pt.z - P.z).normalize();
        ok("E ...facing the point once done", !CAM.turning && fwd.dot(to) > 0.995, fwd.dot(to).toFixed(4));
        CAM.lock(true);
        const yaw0 = g.yawObject.rotation.y;
        G.Input.mouseDelta.x = 300; step(2);
        ok("E locked: the mouse does not turn the view", Math.abs(g.yawObject.rotation.y - yaw0) < 1e-6);
        CAM.lock(false); G.Input.mouseDelta.x = 300; step(2);
        ok("E unlocked: it does again", Math.abs(g.yawObject.rotation.y - yaw0) > 0.1);
        CAM.walk(g, { x: 5, z: 0.4 }); step(5);
        ok("E walk: the player walking by themselves", CAM.walking);
        until(() => !CAM.walking, 600);
        ok("E ...there", Math.hypot(g.yawObject.position.x - 5, g.yawObject.position.z - 0.4) < 0.6, g.yawObject.position.x.toFixed(2) + "," + g.yawObject.position.z.toFixed(2));
        CAM.bars(true);
        // (where the slide ends: headless Edge may not run the 0.55 s transition while the page is busy)
        const bar = document.querySelector(".cine-top");
        bar.style.transition = "none"; void bar.offsetWidth;
        const tf = getComputedStyle(bar).transform;
        bar.style.transition = "";
        ok("E the bars (the boss scenes' own) slid in, the HUD still there", B.classList.contains("story-bars") && (tf === "none" || /^matrix\(1, 0, 0, 1, 0, 0\)$/.test(tf)) && vis("#hud"), tf);
        CAM.bars(false);
        CAM.slow(g, 1); step(1);
        ok("E slow: the world at a third (Focus Time's), for a second", g._slowmoT > 0.9 && B.classList.contains("slowmo"));
        step(70);
        ok("E ...then back", g._slowmoT === 0 && !B.classList.contains("slowmo"));
        CAM.look(g, { x: -10, z: 12 }, 2); step(5); CAM.finish(g);
        ok("E finish: the turn done at once", !CAM.turning);
        quit();
        await yield0();
      }

      // ================= F: LexiLens =================
      {
        fresh();
        play(() => S.start("ch1", { scene: 1, beat: 0, skip: true }));
        step(3);
        ok("F a scene after the prologue: the whole HUD, the glasses on", LENS.on && LENS.shown.length === 4 && B.classList.contains("lexilens") && vis(".hud-meaning-box") && !G.Visuals.labelsOff);
        LENS.parts("none");
        ok("F none: no word box, no health, no gun parts, no zombie words", !vis(".hud-meaning-box") && !vis(".hd-bars") && !vis("#hud-slots") && !vis("#hud-detail") && G.Visuals.labelsOff && B.dataset.lens === "");
        LENS.parts(["word"]);
        ok("F word: the box booting (its flicker), the rest still off", vis(".hud-meaning-box") && B.classList.contains("lens-boot-word") && !vis(".hd-bars") && B.classList.contains("lens-partial"));
        LENS.show(["vitals"]);
        ok("F ...vitals added", vis(".hd-bars") && LENS.shown.join() === "word,vitals");
        LENS.parts("all");
        ok("F all: everything, the score and mission back", vis("#hud-slots") && vis(".hd-top") && !B.classList.contains("lens-partial") && !G.Visuals.labelsOff);
        LENS.glitch(0.5); step(1);
        ok("F a glitch: red, jittering", B.classList.contains("lens-glitch"));
        step(40);
        ok("F ...over after its time", !B.classList.contains("lens-glitch"));
        LENS.sys("story.ch1.sys.calib", S.vars()); step(1);
        ok("F a system line: English, the candidate's number in it", vis("#lens-sys") && $("lens-sys").querySelector(".ls-line").textContent.indexOf("LEXA EXAM SYSTEM") === 0 && $("lens-sys").textContent.indexOf(S.vars().name) > 0, $("lens-sys").textContent);
        step(Math.ceil(G.CONFIG.story.lens.sysSec * 60) + 5);
        ok("F ...gone after its time", !vis("#lens-sys"));
        // a right shot: "CORRECT. Neural pattern disrupted."
        toZone("corridor3East"); step(3);
        until(() => alive().length >= 1, 60);
        const r0 = g.correctCount;
        step(1);
        const tp = g.targetPair, z = alive().find((q) => tp && q.word === tp[0]);
        if (z) g.damageZombie(z, 9999, z.mesh.position.clone(), { dir: null, head: false });
        step(1);
        ok("F a right shot: \"CORRECT. Neural pattern disrupted.\"", g.correctCount === r0 + 1 && LENS.line && LENS.line.key === "story.lens.correct" && $("lens-sys").textContent.indexOf("Neural pattern disrupted") >= 0, $("lens-sys").textContent);
        quit();
        await yield0();
      }

      // ================= G: the prologue's first minute (story round 5: the whole of it is suite 43's) =================
      {
        fresh();
        play(() => S.start("ch1", null));
        step(2);
        ok("G the prologue: no HUD, no glasses, no zombie words", B.dataset.lens === "" && !LENS.on && G.Visuals.labelsOff && !vis(".hud-meaning-box"));
        ok("G ...the alarm: the calendar's notification", PH.state.notes.join() === "cal" && vis("#story-toast"));
        until(() => PH.state.msgs.length === 2, 400);
        ok("G ...the LEXA ad, then Beam's two messages, in order", PH.state.notes.join() === "cal,ad" && PH.state.msgs.join() === "beam1,beam2");
        PH.open("beam"); step(1); PH.close(); step(2);
        until(() => G.Dialog.isOpen(), 200);
        ok("G ...Beam's thread read, then the reply to Beam: a choice", S.run.flags.has("read:beam") && G.Dialog.isOpen() && document.querySelectorAll("#dialog-btns button").length === 2);
        pick(1);
        until(() => D.current && D.current.who === "radio", 300);
        ok("G ...chosen, kept; walked in from the gate to the radio's line", G.save.story.ch.ch1.choices.beam === "promise" && D.current && D.current.who === "radio" && CAM.walking);
        // (the bars and a line: its box over the bottom bar, not across it)
        CAM.bars(true); step(2);
        const dlgBottom = parseFloat(getComputedStyle($("story-dlg")).bottom);
        ok("G with the bars: the line's box over the bottom bar, not across it", dlgBottom >= window.innerHeight * 0.12, dlgBottom.toFixed(0) + " px of " + window.innerHeight);
        CAM.bars(false);
        quit();
        await yield0();
      }

      // ================= H: skipping what was seen =================
      {
        // (story round 5: the prologue's first cinematic part is the walk in from the gate)
        const toGate = () => { play(() => S.start("ch1", null)); until(() => PH.state.msgs.length === 2, 400); PH.open("beam"); step(1); PH.close(); step(2); until(() => G.Dialog.isOpen(), 200); pick(0); until(() => CH.scenes[0].beats[S.run.beatI] && CH.scenes[0].beats[S.run.beatI].cine === "gate", 200); step(2); };
        G.save.story = { ch: {} };
        G.save.tutorialSeen.story_ch1_gate = true;
        toGate();
        const bi = S.run.beatI, b = CH.scenes[0].beats[bi];
        ok("H replaying: at the walk in (seen before), skippable", b.cine === "gate" && SC.canSkip(S.run), bi);
        const kbJ = G.save.settings.keybinds.jump;
        G.Input.keys[kbJ] = true; step(Math.ceil(G.CONFIG.story.dialogue.holdSkip * 60) + 8); G.Input.keys[kbJ] = false; step(2);
        const p = g.yawObject.position;
        ok("H held: the walk passed at once -- at the entrance, no line left, the seating plan next", S.run.beatI >= 12 && Math.hypot(p.x - 4.6, p.z - 9.8) < 0.8 && !D.busy() && S.run.objective === "story.ch1.obj.board", S.run.beatI + " " + p.x.toFixed(1) + "," + p.z.toFixed(1));
        quit();
        delete G.save.tutorialSeen.story_ch1_gate;
        G.save.story = { ch: {} };
        toGate();
        ok("H never seen: not skippable", CH.scenes[0].beats[S.run.beatI].cine === "gate" && !SC.canSkip(S.run));
        quit();
        await yield0();
      }

      // ================= I: a controller =================
      {
        fresh();
        play(() => S.start("ch1", { scene: 1, beat: 0, skip: true }));
        step(3);
        const btn = () => ({ pressed: false, value: 0 }), pad = { buttons: Array.from({ length: 17 }, btn), axes: [0, 0, 0, 0] };
        G.Input.pollGamepad = () => pad;
        const press = (i) => { pad.buttons[i].pressed = true; G.Pad.poll(1 / 60); pad.buttons[i].pressed = false; G.Pad.poll(1 / 60); };
        press(G.Pad.B.UP);
        ok("I the D-pad's up: the phone (no ability there in a chapter)", PH.isOpen());
        ok("I ...its window is the pad's scope (the phone's buttons)", G.Pad.scope() === $("story-phone-box"));
        press(G.Pad.B.B);
        ok("I B: closed", !PH.isOpen());
        press(G.Pad.B.DOWN);
        ok("I the D-pad's down: the torch", PH.state.torch);
        press(G.Pad.B.DOWN);
        G.Input.pollGamepad = pad0;
        G.Pad.release();
        quit();
        await yield0();
      }

      // ================= J: four languages =================
      {
        fresh();
        for (const l of ["th", "zh", "fr", "en"]) {
          await setLang(l);
          play(() => S.start("ch1", { scene: 1, beat: 0, skip: true }));
          step(2);
          D.say([{ who: "min", line: "story.ch1.d.minLuck" }]); step(1);
          const sub = $("sd-subwrap").textContent;
          PH.deliver("min1"); key("KeyT"); step(1);
          const title = $("sp-title").textContent;
          PH.close();
          LENS.sys("story.ch1.sys.vital"); step(1);
          const sys = $("lens-sys").textContent;
          ok("J " + l + ": the line English, its subtitle, the phone, a system line", $("sd-line").textContent === G.STRINGS.en["story.ch1.d.minLuck"] && sub === (l === "en" ? "" : G.STRINGS[l]["story.ch1.d.minLuck"]) && title === G.STRINGS[l]["story.phone.title"] && sys.indexOf(G.STRINGS.en["story.ch1.sys.vital"]) === 0 && (l === "en" || sys.indexOf(G.STRINGS[l]["story.ch1.sys.vital"]) > 0), sub + " | " + sys);
          quit();
        }
      }

      // ================= K: leaving: nothing left for the campaign =================
      {
        fresh();
        play(() => S.start("ch1", null));
        step(2);
        PH.torch(true); CAM.bars(true); D.say(["story.ch1.d.chaiGo"]); step(2);
        quit();
        ok("K left mid-prologue: whole HUD, zombie words on, no glasses, no bars, no box, no phone", B.dataset.lens.split(" ").length === 4 && !G.Visuals.labelsOff && !B.classList.contains("lexilens") && !B.classList.contains("story-bars") && !vis("#story-dlg") && !PH.isOpen() && !B.classList.contains("torch-on"));
        g.update = real; g.startLevel(1); g.update = () => {}; G.Modal.reset(); g.paused = false; g.state = "GAMEPLAY"; step(2);
        ok("K the campaign after it: no torch in its light pool, the HUD whole, no story classes", G.Perf.torch === null && vis(".hud-meaning-box") && !B.classList.contains("story-run") && !vis("#touch-phone"));
        quit();
      }

      ok("no missing strings", !Object.keys(G._missingKeys || {}).length, Object.keys(G._missingKeys || {}).join());
    } catch (e) {
      ok("no exception", false, e.message + " " + (e.stack || "").split("\n").slice(0, 3).join(" | "));
    } finally {
      CHS.splice(1, 8, ...real12);
      G.CONFIG.story.enabled = enabled0;
      G.Input.pollGamepad = pad0; G.Input.padActive = false;
      G.Input.mode = mode0; if (G.UI.applyControlMode) G.UI.applyControlMode();
      Object.keys(G.Input.keys).forEach((k) => { G.Input.keys[k] = false; });
      g.update = real;
      G.Input.requestPointerLock = lock0;
      if (G.Dialog.isOpen()) G.Dialog.close();
      if (PH.isOpen()) PH.close();
      G.Modal.reset();
      if (G.lang !== lang0) await new Promise((res) => G.setUILang(lang0, { done: res }));
      if (g.state !== "MENU") g.quitToMainMenu();
      G.save = G.normalizeSave(JSON.parse(backup)); G.persist(true);   // (written now: the runner closes the browser right after)
      G.UI.menuOrigin = "lobby"; G.UI.goToMainMenu();
      window.removeEventListener("error", onErr);
      window.removeEventListener("unhandledrejection", onErr);
    }
    ok("no uncaught errors", errs.length === 0, errs.join(" | "));
    return { total: results.length, fail: results.filter((r) => !r.pass), pass: results.filter((r) => r.pass).map((r) => r.name + (r.info !== "" ? " [" + r.info + "]" : "")), numbers };
  }
  return { run };
})();
