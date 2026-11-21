// Dev-only (not shipped). The story series' round 1: Story Mode's shell (js/story/*.js).
//   A  the data: chapter 1's nine scenes, titles and objectives in four languages; its
//      words (the ones the bank has; the rest listed as missing); chapter 2 named only
//   B  the save: the default, G.normalizeStory mending a broken part, both old fixtures
//      given a story part, the section (toDoc/fromDoc), the merge rules
//   C  the flag and the lobby: off -> no Story tab; on -> the tab first, chapter 1's card
//      and its status, chapter 2 locked "coming soon"; the chapter window's buttons
//   D  a run: mode "story", no waves (no spawner, no wave clear, no loot, no notes, no
//      tips); the objective in the HUD; a zone sends a group; the words 60 / 40 and at
//      most maxNew new; a group down -> checkpoint -> the next scene
//   E  the checkpoint in the save (scene, beat, guns, ammo, flags, where); death -> the
//      window -> Retry puts the player back there, full health; the prologue cannot be lost
//   F  from the lobby: Continue, Start over (asked first), Skip Prologue once the prologue is done
//   G  the chapter's end: done, the best time, the summary (time, accuracy), chapter 2's
//      button off; the answers and the time counted into the chapter's totals
//   H  a wrong shot's speed-up ends with its group (decision D11)
//   I  four languages: the chapter window, the HUD, the death window
// Load it into the game (in the lobby), then:
//   const r = await G.Round39Test.run();   r.fail -> [] when everything passes
window.G = window.G || {};
G.Round39Test = (function () {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  async function run() {
    const results = [], errs = [], numbers = {};
    const ok = (name, pass, info) => { results.push({ name, pass: !!pass, info: info === undefined ? "" : info }); window._t39 = results.length + " " + name; };
    const onErr = (e) => errs.push(String(e.message || (e.reason && e.reason.message) || e.reason || e));
    window.addEventListener("error", onErr);
    window.addEventListener("unhandledrejection", onErr);
    const g = G.Game, S = G.Story, SC = G.StoryScenes, CH = G.STORY_CHAPTERS.ch1, T = (k, v) => G.T(k, v), $ = (id) => document.getElementById(id);
    const backup = JSON.stringify(G.save), lang0 = G.lang, spawn0 = G.Spawner.update, lock0 = G.Input.requestPointerLock, enabled0 = G.CONFIG.story.enabled;
    const real = g._update0 || g.update;
    G._missingKeys = {};
    G.Input.requestPointerLock = () => {};
    const step = (n, dt) => { for (let i = 0; i < n; i++) real.call(g, dt || 1 / 60); };
    const yield0 = () => wait(0);
    const key = (code) => G.onKeyDown({ code, preventDefault() {}, stopPropagation() {}, repeat: false });
    const setLang = (l) => (G.lang === l ? Promise.resolve() : new Promise((r) => G.setUILang(l, { done: r })));
    const play = (fn) => { g.update = real; fn(); g.update = () => {}; G.Modal.reset(); g.paused = false; g.state = "GAMEPLAY"; G.Input.clearHeldInputs(); step(2); };
    const at = (x, z, y) => { g.teleportPlayer(new THREE.Vector3(x, y || 0, z)); step(2); };
    // (story round 4: a zone of the chapter's map, by name -- its middle, on its storey)
    const toZone = (name) => { const q = G.STORY_CHAPTERS.ch1.zones[name]; at((q.x0 + q.x1) / 2, (q.z0 + q.z1) / 2, q.y); };
    const alive = () => g.zombies.filter((z) => z.alive);
    // shoot the zombie the question asks for (or, wrong: one it does not)
    const shoot = (right) => {
      step(1);
      const tp = g.targetPair, list = alive();
      const z = right ? list.find((q) => tp && q.word === tp[0]) : list.find((q) => !tp || q.word !== tp[0]);
      if (z) g.damageZombie(z, 9999, z.mesh.position.clone(), { dir: null, head: false });
      step(2);
      return !!z;
    };
    const clearAll = () => { for (let i = 0; i < 30 && alive().length; i++) shoot(true); };
    const fresh = () => { G.save.story = { ch: {} }; };

    try {
      // ================= A: the data =================
      {
        ok("A chapter 1: nine scenes, the first the prologue (cannot be lost), the last ends the chapter",
          CH.scenes.length === 9 && CH.scenes[0].prologue && CH.scenes[0].noDeath && CH.scenes[8].beats.some((b) => (b.do || []).some((a) => a[0] === "end")));
        const keys = ["story.ch1.title"].concat(CH.scenes.map((s) => s.title), CH.scenes.map((s) => s.objective));
        ok("A every scene's title and objective in English", keys.every((k) => G.STRINGS.en[k]), keys.filter((k) => !G.STRINGS.en[k]).join());
        const have = S.entries("ch1"), miss = S.missing("ch1");
        numbers.words = have.length + " in the bank, " + miss.length + " missing";
        ok("A its words: the bank's (" + have.length + "), the rest listed missing (" + miss.length + "), 30 in all", have.length + miss.length === 30 && have.length >= 11, miss.join(" "));
        ok("A ...a family form counts as its headword (assessment -> assess)", have.some((e) => e.id === "assess"));
        const pr = S.pairs("ch1");
        ok("A ...as pairs in the player's languages", pr.length === have.length && pr.every((p) => Array.isArray(p) && p[0] && p[1]));
        ok("A chapter 2: named, coming soon, no scenes", G.STORY_CHAPTERS.ch2 && G.STORY_CHAPTERS.ch2.soon && !G.STORY_CHAPTERS.ch2.scenes.length && G.STORY_ORDER[1] === "ch2");
      }

      // ================= B: the save =================
      {
        ok("B a new save: story { ch: {} }", JSON.stringify(G.defaultSave().story) === JSON.stringify({ ch: {} }));
        const bad = G.normalizeStory({ ch: { ch1: { started: "yes", scene: 99, cp: { scene: "3", beat: -4, guns: ["pistol", 5, "bad id!"], ammo: { pistol: [12, 48], x: "y" }, flags: ["a", "a", "b"], x: "1.5", z: null }, collected: ["k1", "k1", 7], best: -3, choices: { beam: "back", "<x>": "y" } }, hack: { done: true }, ch999: {} } });
        const c = bad.ch.ch1;
        ok("B normalizeStory: only chapter keys kept (ch + 1-2 digits)", Object.keys(bad.ch).join() === "ch1");
        ok("B ...types and bounds mended", c.started === true && c.scene === 40 && c.cp.scene === 3 && c.cp.beat === 0 && c.cp.guns.join() === "pistol" && c.cp.flags.join() === "a,b"
          && c.cp.ammo.pistol.join() === "12,48" && !c.cp.ammo.x && c.cp.x === 1.5 && c.cp.z === null && c.collected.join() === "k1" && c.best === 0 && c.choices.beam === "back" && !c.choices["<x>"], JSON.stringify(c.cp));
        ok("B ...a chapter's defaults filled", c.right === 0 && c.curTime === 0 && c.done === false && c.prologueDone === false && JSON.stringify(c.achievements) === "{}");
        for (const f of ["save-v-current", "save-v-expansion9"]) {
          const fx = await (await fetch("/tests/fixtures/" + f + ".json?r=" + Date.now())).json();
          const n = G.normalizeSave(fx);
          ok("B the old fixture " + f + ": given story { ch: {} }, nothing else of it changed", JSON.stringify(n.story) === JSON.stringify({ ch: {} }) && n.unlockedLevels.join() === G.normalizeSave(fx).unlockedLevels.join());
        }
        ok("B the save's sections: story its own", G.SaveManager.SECTIONS.story === "story");
        const s1 = G.normalizeSave(JSON.parse(backup));
        s1.story = G.normalizeStory({ ch: { ch1: { started: true, scene: 2, cp: { scene: 2, beat: 1, at: 5 }, collected: ["a"] } } });
        const back = G.SaveManager.fromDoc(G.SaveManager.toDoc(s1));
        ok("B toDoc/fromDoc: the story part as it went", JSON.stringify(G.normalizeStory(back.story)) === JSON.stringify(s1.story) && G.SaveManager.toDoc(s1).story.ch.ch1.scene === 2);
        const A = G.normalizeSave(JSON.parse(backup)), B = G.normalizeSave(JSON.parse(backup));
        A.story = G.normalizeStory({ ch: { ch1: { started: true, scene: 3, cp: { scene: 3, beat: 0, at: 10 }, collected: ["a", "b"], best: 900, curTime: 300, right: 5 } } });
        B.story = G.normalizeStory({ ch: { ch1: { started: true, prologueDone: true, scene: 5, cp: { scene: 5, beat: 2, at: 5 }, collected: ["c"], best: 700, curTime: 450, right: 9 } } });
        const m = G.SaveFile.merge(A, B).story.ch.ch1;
        ok("B merge: the further checkpoint, its play-through's figures", m.cp.scene === 5 && m.cp.beat === 2 && m.curTime === 450 && m.scene === 5, JSON.stringify(m.cp));
        ok("B ...prologue seen on either, collected from both, the shorter best, the larger totals", m.prologueDone && m.collected.slice().sort().join() === "a,b,c" && m.best === 700 && m.right === 9);
        B.story.ch.ch1.done = true; B.story.ch.ch1.finishedAt = 20; B.story.ch.ch1.cp = null;
        const m2 = G.SaveFile.merge(A, B).story.ch.ch1;
        ok("B ...finished on either: done, a checkpoint from before the finish dropped", m2.done && m2.cp === null && m2.scene === 0, JSON.stringify(m2.cp));
        A.story.ch.ch1.cp.at = 30;   // (A playing it again after B finished it)
        const m3 = G.SaveFile.merge(A, B).story.ch.ch1;
        ok("B ...a replay's checkpoint (after the finish) kept, still done", m3.done && m3.cp && m3.cp.scene === 3 && m3.scene === 3 && m3.curTime === 300, JSON.stringify(m3.cp));
        await yield0();
      }

      // ================= C: the flag and the lobby =================
      {
        G.CONFIG.story.enabled = false;
        const offOk = !S.on() && G.Lobby.TABS.indexOf("story") < 0;
        ok("C the flag off (and no ?story=1): no Story tab", offOk || /[?&]story=1/.test(location.search), G.Lobby.TABS.join());
        G.CONFIG.story.enabled = true;
        ok("C the flag on: the Story tab first", S.on() && G.Lobby.TABS[0] === "story" && G.Lobby.TABS.length === 3, G.Lobby.TABS.join());
        fresh();
        G.UI.menuOrigin = "lobby"; G.UI.goToMainMenu({ tab: "story", select: "story1" }); await wait(80);
        const cards = G.Lobby.modes("story").map((m) => m.id);
        ok("C the tab's cards: chapter 1, chapter 2", cards.join() === "story1,story2");
        ok("C chapter 1: not started", S.status("ch1") === T("story.status.new"));
        ok("C chapter 2: locked, coming soon", G.Lobby.locked(G.Lobby.MODES.find((m) => m.id === "story2")) && S.status("ch2") === T("story.status.soon"));
        S.open("ch1"); await wait(30);
        const btns = Array.from(document.querySelectorAll("#dialog-btns button")).map((b) => b.textContent);
        ok("C a new chapter's window: Cancel and Play", G.Dialog.isOpen() && btns.length === 2 && btns[1].indexOf(T("story.open.play")) === 0, btns.join(" | "));
        key("Escape");
        ok("C ...Esc closes it, nothing started", !G.Dialog.isOpen() && g.state === "MENU");
        S.open("ch2");
        ok("C chapter 2 does not open", !G.Dialog.isOpen());
        await yield0();
      }

      // ================= D: a run =================
      {
        fresh();
        const due0 = G.Clock.today();
        // (a few words due elsewhere in the bank, for the group's 40%)
        const mine = new Set(S.pairs("ch1").map((p) => G.wordKey(p)));
        const others = G.getAllBuiltinWords().filter((p) => !mine.has(G.wordKey(p))).slice(0, 12);
        others.forEach((p) => { G.save.learn.srs[G.wordKey(p)] = { b: 2, due: due0 - 1, last: due0 - 3 }; });
        // (and two of the chapter's own due, box 1: a group's chapter words take them first)
        const dueCh = S.pairs("ch1").slice(0, 2).map((p) => G.wordKey(p));
        dueCh.forEach((k) => { G.save.learn.srs[k] = { b: 1, due: due0 - 1, last: due0 - 2 }; });
        play(() => S.start("ch1", null));
        ok("D a chapter run: mode story, the chapter's own map (js/story/ch1map.js), the chapter's words", g.mode === "story" && g.level.map === "ch1" && g.level.story === "ch1" && g.wordPool.length === S.pairs("ch1").length);
        ok("D ...scene 1 (the prologue), at its start", S.run && S.run.sceneI === 0 && Math.abs(g.yawObject.position.z - CH.scenes[0].start.z) < 1.5, g.yawObject.position.z.toFixed(1));
        let h = g.buildHudState();
        ok("D the HUD: Chapter 1, Exam Day; the objective in the word box", h.head.level === T("story.chapterN", { n: 1 }) && h.head.wave === T("story.ch1.s0") && h.currentMeaning === T("story.ch1.s0.obj") && h.meaningLabel === T("story.objective"), JSON.stringify(h.head) + " " + h.currentMeaning);
        step(240);
        ok("D no waves: no spawner, no zombie by itself", alive().length === 0 && g.state === "GAMEPLAY");
        ok("D ...no story notes, no shop", (!g.world.notes || !g.world.notes.length) && g.state !== "SHOP");
        // (story round 2: the prologue tries the narrative tools now -- suite 40 plays it through;
        // a run's groups, words and checkpoints are tried here on scene 2, The Long Corridor)
        g.update = g._update0; g.quitToMainMenu(); g.update = () => {}; G.Modal.reset();
        play(() => S.start("ch1", { scene: 1, beat: 0, skip: true }));
        h = g.buildHudState();
        ok("D scene 2 (The Long Corridor) at its start, its objective in the HUD", S.run.sceneI === 1 && Math.abs(g.yawObject.position.z - CH.scenes[1].start.z) < 1.5 && h.head.wave === T("story.ch1.s1") && h.currentMeaning === T("story.ch1.s1.obj"));
        toZone("corridor3East");
        ok("D a zone reached: the group comes (3, its own)", alive().length === 3 && alive().every((z) => z.storyGroup === "c1"), alive().length);
        // the run's slots 1-3: chapter, elsewhere, chapter
        const isCh = (p) => mine.has(G.wordKey(p));
        const wp = (g.wavePlan || []).slice(), wpCh = wp.filter(isCh);
        ok("D the group's words: 2 of its 3 the chapter's, 1 due elsewhere", wp.length === 3 && wpCh.length === 2 && wp.filter((p) => !isCh(p)).every((p) => G.SRS.isDue(p)), wp.map((p) => p[0]).join());
        ok("D ...the chapter's due words first", wpCh.every((p) => dueCh.includes(G.wordKey(p))), wpCh.map((p) => p[0]).join());
        const plan = S.plan(g, 10), inCh = plan.filter(isCh).length;
        numbers.plan = inCh + " chapter / " + (plan.length - inCh) + " due elsewhere";
        ok("D the next ten: 6 the chapter's, 4 due elsewhere (60 / 40 over the run)", plan.length === 10 && inCh === 6, numbers.plan);
        const p5 = S.plan(g, 5);
        ok("D ...a group: no more than maxNew new words", G.SRS.split(p5).fresh.length <= G.CONFIG.waveWords.maxNew && p5.length === 5, G.SRS.split(p5).fresh.length);
        ok("D ...the HUD counts the group (3 left)", g.buildHudState().head.left === T("hud.zombiesLeft", { n: alive().filter((z) => !z.decoy).length }), g.buildHudState().head.left);
        // (a look-alike decoy may come with a word the player knows: never a target, it goes once the rest are down)
        const r0 = g.correctCount, real = alive().filter((z) => !z.decoy).length;
        clearAll();
        ok("D the group down by its right words", alive().length === 0 && g.correctCount - r0 === real, (g.correctCount - r0) + " of " + real);
        ok("D ...no loot dropped", !(g.drops || []).length);
        const d = G.save.story.ch.ch1;
        ok("D -> the checkpoint, the next scene (scene 3)", S.run.sceneI === 2 && d.cp && d.cp.scene === 2 && d.cp.beat === 0);
        // (written at once: the copy a reload reads -- the game closed now picks up here)
        let kept = null;
        try { kept = G.normalizeSave(JSON.parse(localStorage.getItem("vocabZombie_save_v1"))).story.ch.ch1; } catch (e) { kept = null; }
        ok("D ...in the stored save at once (a reload continues from it)", kept && kept.cp && kept.cp.scene === 2 && kept.started, kept && JSON.stringify(kept.cp));
        const toastEl = $("hud-checkpoint"), ban = $("hud-purchase-banner");
        ok("D ...the campaign's checkpoint toast says so", toastEl.classList.contains("showing") && toastEl.textContent.indexOf(T("story.checkpoint")) >= 0, toastEl.textContent);
        ok("D ...the new scene's name across the screen (Chapter 1 / its title)", ban.classList.contains("showing") && ban.querySelector(".pb-name").textContent === T("story.ch1.s2") && ban.querySelector(".pb-title").textContent === T("story.chapterN", { n: 1 }), ban.textContent);
        ok("D no money in a chapter: Savings hidden (no shop)", getComputedStyle($("hud-savings")).display === "none");
        h = g.buildHudState();
        ok("D ...its objective in the HUD", h.head.wave === T("story.ch1.s2") && h.currentMeaning === T("story.ch1.s2.obj"));
        ok("D ...the answers counted into the chapter", d.right === real && d.curRight === real, d.right);
        await yield0();

        // ================= E: the checkpoint, death =================
        ok("E the checkpoint: where (scene 3's start), the guns and their ammo, the time", d.cp.x === CH.scenes[2].start.x && d.cp.z === CH.scenes[2].start.z && d.cp.guns.includes("pistol") && Array.isArray(d.cp.ammo.pistol) && d.time > 0, JSON.stringify(d.cp));
        toZone("libraryBack");
        ok("E scene 3: the group by the library's back door", alive().length === 2);
        const dw0 = G.save.story.ch.ch1.wrong, shot = shoot(false);
        g.player.hp = 0; g.checkPlayerDeath(); step(2);
        ok("E killed: the window (Retry from checkpoint), the game not over", G.Dialog.isOpen() && $("dialog-title").textContent === T("story.death.title") && g.state !== "GAME_OVER");
        ok("E ...the wrong answer counted into the chapter before the retry", shot && G.save.story.ch.ch1.wrong === dw0 + 1, dw0 + " -> " + G.save.story.ch.ch1.wrong);
        g.update = real;
        G.Dialog.choose(G.Dialog._o.buttons.findIndex((b) => b.primary));
        g.update = () => {}; G.Modal.reset(); g.paused = false; g.state = "GAMEPLAY"; step(2);
        ok("E Retry: back at the checkpoint (scene 3, its start), full health, no zombies", S.run.sceneI === 2 && Math.abs(g.yawObject.position.z - CH.scenes[2].start.z) < 1.5 && g.player.hp === g.player.maxHp && alive().length === 0);
        // the prologue cannot be lost
        play(() => S.start("ch1", { scene: 0, beat: 0, skip: false }));
        g.player.hp = 0; g.checkPlayerDeath(); step(2);
        ok("E the prologue: killed, still standing (no window)", g.player.hp >= 1 && !G.Dialog.isOpen() && S.run.sceneI === 0);
        g.quitToMainMenu(); G.Modal.reset();
        await yield0();
      }

      // ================= F: from the lobby =================
      {
        const d = G.save.story.ch.ch1;
        d.cp = { scene: 2, beat: 0, at: Date.now(), hp: 100, guns: ["pistol"], melee: "knife", ammo: { pistol: [5, 30] }, flags: ["x1"], x: null, z: null, yaw: null };
        d.prologueDone = true;   // (as if the prologue had been played: D now starts at scene 2)
        S.open("ch1"); await wait(30);
        let btns = Array.from(document.querySelectorAll("#dialog-btns button")).map((b) => b.textContent);
        ok("F a chapter left at a checkpoint: Cancel, Start over, Skip Prologue, Continue", btns.length === 4 && btns[3].indexOf(T("story.open.continue", { scene: T("story.ch1.s2") })) === 0, btns.join(" | "));
        g.update = real; G.Dialog.choose(3); g.update = () => {}; G.Modal.reset(); g.paused = false; g.state = "GAMEPLAY"; step(2);
        ok("F Continue: scene 3 at its start, the ammo as it was kept, the flags", S.run.sceneI === 2 && g.player.ammo.pistol.mag === 5 && g.player.ammo.pistol.reserve === 30 && S.run.flags.has("x1"));
        g.quitToMainMenu(); G.Modal.reset();
        S.open("ch1"); await wait(20);
        G.Dialog.choose(1); await wait(20);
        ok("F Start over: asked first (the checkpoint would be lost)", G.Dialog.isOpen() && $("dialog-text").textContent === T("story.restart.text"));
        g.update = real; G.Dialog.choose(G.Dialog._o.buttons.findIndex((b) => b.primary)); g.update = () => {}; G.Modal.reset(); g.paused = false; g.state = "GAMEPLAY"; step(2);
        ok("F ...yes: the prologue again, no checkpoint, a new play-through", S.run.sceneI === 0 && !G.save.story.ch.ch1.cp && G.save.story.ch.ch1.curRight === 0);
        g.quitToMainMenu(); G.Modal.reset();
        S.open("ch1"); await wait(20);
        const skipI = G.Dialog._o.buttons.findIndex((b) => b.label === T("story.open.skip"));
        g.update = real; G.Dialog.choose(skipI); g.update = () => {}; G.Modal.reset(); g.paused = false; g.state = "GAMEPLAY"; step(2);
        ok("F Skip Prologue: scene 2 (The Long Corridor) at its start", skipI > 0 && S.run.sceneI === 1 && Math.abs(g.yawObject.position.z - CH.scenes[1].start.z) < 1.5);
        g.quitToMainMenu(); G.Modal.reset();
        await yield0();
      }

      // ================= G: the chapter's end =================
      {
        const d = G.save.story.ch.ch1;
        d.curRight = 8; d.curWrong = 2; d.curTime = 600;
        play(() => S.start("ch1", { scene: 8, beat: 0, at: 1, guns: ["pistol"], ammo: {}, flags: [], x: null, z: null, yaw: null }));
        ok("G the last scene: PROTECT", S.run.sceneI === 8 && g.buildHudState().head.wave === T("story.ch1.s8"));
        step(30);
        toZone("gate");
        const e = G.save.story.ch.ch1;
        ok("G its zone: the chapter done, no checkpoint, the best time", e.done && !e.cp && e.best >= 600 && e.finishedAt > 0, e.best);
        ok("G the summary: time and accuracy (80%)", G.Dialog.isOpen() && $("dialog-title").textContent === T("story.end.title") && $("dialog-text").textContent.indexOf("80") >= 0, $("dialog-text").textContent);
        const next = Array.from(document.querySelectorAll("#dialog-btns button")).find((b) => b.textContent.indexOf(T("story.ch2.title")) >= 0);
        ok("G ...chapter 2's button there and off (coming soon)", !!next && next.disabled);
        ok("G the lobby card: completed", S.status("ch1") === T("story.status.done"));
        G.Dialog.close(); g.quitToMainMenu(); G.Modal.reset();
        ok("G ...back in the menus: Savings shown again", getComputedStyle($("hud-savings")).display !== "none" && !document.body.classList.contains("story-run"));
        S.open("ch1"); await wait(20);
        const ob = G.Dialog._o ? G.Dialog._o.buttons : [];
        ok("G a completed chapter's window: Cancel, Skip Prologue, Play again (the main button last)", ob.length === 3 && ob[1].label === T("story.open.skip") && ob[2].label === T("story.open.again") && ob[2].primary, ob.map((b) => b.label).join(" | "));
        // played again: its own checkpoints, Continue, the pause menu's retry from there; still completed once
        g.update = real; G.Dialog.choose(2); g.update = () => {}; G.Modal.reset(); g.paused = false; g.state = "GAMEPLAY"; step(2);
        ok("G Play again: the prologue, a new play-through", S.run && S.run.sceneI === 0 && !G.save.story.ch.ch1.cp && G.save.story.ch.ch1.curTime < 1);
        // (that play-through's checkpoints, tried from Skip Prologue: the prologue's own run is suite 40's)
        g.update = real; g.quitToMainMenu(); g.update = () => {}; G.Modal.reset();
        S.open("ch1"); await wait(20);
        g.update = real; G.Dialog.choose(G.Dialog._o.buttons.findIndex((b) => b.label === T("story.open.skip"))); g.update = () => {}; G.Modal.reset(); g.paused = false; g.state = "GAMEPLAY"; step(2);
        toZone("corridor3East"); clearAll(); step(2);
        const again = G.save.story.ch.ch1;
        ok("G ...a checkpoint of its own: scene 3, the chapter still completed", again.cp && again.cp.scene === 2 && again.done && S.status("ch1") === T("story.status.scene", { i: 3, n: 9 }), S.status("ch1"));
        g.update = real; g.retry(); g.update = () => {}; G.Modal.reset(); g.paused = false; g.state = "GAMEPLAY"; step(2);
        ok("G ...the pause menu's retry: back at that checkpoint", S.run.sceneI === 2 && Math.abs(g.yawObject.position.z - CH.scenes[2].start.z) < 1.5);
        g.quitToMainMenu(); G.Modal.reset();
        S.open("ch1"); await wait(20);
        const rb = G.Dialog._o ? G.Dialog._o.buttons : [];
        ok("G ...its window offers Continue (last, the main button)", rb.length === 4 && rb[3].primary && rb[3].label === T("story.open.continue", { scene: T("story.ch1.s2") }), rb.map((b) => b.label).join(" | "));
        G.Dialog.close();
        await yield0();
      }

      // ================= H: a wrong shot's speed-up ends with its group =================
      {
        fresh();
        play(() => S.start("ch1", { scene: 3, beat: 0, guns: ["pistol"], ammo: {}, flags: [], x: null, z: null, yaw: null }));
        step(3);
        const first = alive();
        ok("H scene 4 sends its first group at once", first.length === 2 && first.every((z) => z.storyGroup === "d1"));
        // a second group out at the same time (by hand), then a wrong shot
        SC.spawn(g, S.run, { id: "extra", at: "libDoors", count: 2 });
        const hw0 = S.data("ch1").wrong;
        shoot(false);
        window.dispatchEvent(new Event("pagehide"));
        ok("H (the page going away mid-scene: the wrong answer into the chapter's totals)", S.data("ch1").wrong === hw0 + 1 && S.data("ch1").curWrong >= 1, hw0 + " -> " + S.data("ch1").wrong);
        const sped = alive().filter((z) => z.speedMultiplier > 1).length;
        ok("H a wrong shot: everyone left sped up (+25%)", sped >= 2, sped);
        alive().filter((z) => z.storyGroup === "d1").forEach((z) => g.damageZombie(z, 9999, z.mesh.position.clone(), { dir: null, head: false }));
        step(4);
        const rest = alive().filter((z) => z.storyGroup === "extra");
        ok("H ...its group down: the other group back to normal speed", rest.length >= 1 && rest.every((z) => z.speedMultiplier === 1), rest.map((z) => z.speedMultiplier).join());
        g.quitToMainMenu(); G.Modal.reset();
        await yield0();
      }

      // ================= I: four languages =================
      {
        fresh();
        for (const l of ["th", "zh", "fr", "en"]) {
          await setLang(l);
          S.open("ch1"); await wait(20);
          const t = $("dialog-title").textContent;
          G.Dialog.close();
          play(() => S.start("ch1", null));
          const h = g.buildHudState();
          ok("I " + l + ": the chapter window, the HUD's chapter and objective in this language", t.indexOf(G.STRINGS[l]["story.chapterN"].replace("{n}", "1")) === 0 && h.currentMeaning === G.STRINGS[l]["story.ch1.s0.obj"], t + " / " + h.currentMeaning);
          g.quitToMainMenu(); G.Modal.reset();
        }
      }

      ok("no missing strings", !Object.keys(G._missingKeys || {}).length, Object.keys(G._missingKeys || {}).join());
    } catch (e) {
      ok("no exception", false, e.message + " " + (e.stack || "").split("\n").slice(0, 3).join(" | "));
    } finally {
      G.CONFIG.story.enabled = enabled0;
      G.Spawner.update = spawn0;
      g.update = real;
      G.Input.requestPointerLock = lock0;
      if (G.Dialog.isOpen()) G.Dialog.close();
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
