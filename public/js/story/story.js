// ===================================================================
// Story Mode (story series, round 1): the chapters' shell
// -------------------------------------------------------------------
// A chapter (js/data/story/ch*.js) is played as a run of its own, mode
// "story" (js/game.js): its map, its words, no waves, no shop, no wave clear;
// its scenes (js/story/scenes.js) send the zombies and say what to do. Every
// scene ends on a checkpoint (and some in the middle): a death puts the player
// back there, and the chapter can be left and picked up again from the Story tab.
//
//   G.Story.on()               the flag, G.CONFIG.story.enabled -- or ?story=1 in
//                              the address while the series is being built
//   G.Story.chapters()         the chapters, in order
//   G.Story.data(ch)           this player's save for a chapter (made when first asked)
//   G.Story.status(ch)         for the lobby's card: not started / scene i of n / completed
//   G.Story.open(ch)           from the lobby: Continue / Start over / Skip Prologue / Play
//   G.Story.start(ch, from)    a run: from = a checkpoint, or { scene, beat } (Skip
//                              Prologue: scene 1), or null (from the beginning)
//   G.Story.level(ch)          the level G.Game builds (the map: the Training Yard's
//                              until story round 4)
//   G.Story.pairs(ch)          the chapter's words the bank has, in the player's languages
//   G.Story.plan(game, n)      a group's words: CONFIG.story.chapterShare from the
//                              chapter (as a wave plans them: due, learning, at most
//                              maxNew new), the rest words due anywhere else
//   G.Story.checkpoint / died / finish / prologueDone / sceneReached   the runner's calls
//   G.Story.beginRun / update / teardown / hudHead / idleMeaning       js/game.js's hooks
//   (round 2) G.Story.vars / chose / onKey   a line's {name}, a choice kept in the save, a
//   chapter's keys; the narrative tools (js/story/dialogue.js, phone.js, storycam.js,
//   lexilens.js) start with a run and stop with it
//   (round 3) a chapter marked preview (the voxel kit's gallery, js/story/voxelkit.js) is
//   played the same way but nothing of it is written to the save; its zombies, as every
//   chapter's, are built of blocks (js/story/voxelchars.js), the patch of the one under the
//   crosshair lit each frame
//   (round 5) G.Story.arm(game, on) / handsFree()   the gun in the hands, or not yet (a scene
//   with armed: false -- the prologue until Sgt. Chai's pistol); the scene's people, things to
//   use, practice exam and screen (js/story/cast.js, interact.js, aimquiz.js, screen.js) start
//   and stop with a run; idleLabel() the word box's label while nothing is to be shot
// The answers count in the memory boxes as everywhere else; the chapter keeps
// its own totals (right, wrong, time) for its summary and achievements.
// ===================================================================
window.G = window.G || {};

G.Story = (function () {
  const T = (k, v) => G.T(k, v);
  const C = () => G.CONFIG.story || {};
  const chapter = (id) => (G.STORY_CHAPTERS || {})[id] || null;
  let run = null;           // the chapter under way: { id, ch, pool, sceneI, beatI, ... }
  let pending = null;       // what G.Game.startStory is to begin with: { id, from }

  function on() { return !!C().enabled || /[?&]story=1(\b|$)/.test(location.search || ""); }
  function chapters() { return (G.STORY_ORDER || []).map(chapter).filter(Boolean); }
  // (round 3) a preview -- the voxel kit's gallery: played as a chapter, nothing of it kept
  const preview = (id) => !!(chapter(id) && chapter(id).preview);
  let scratch = null;
  // the save's entry for a chapter; made (with every default) the first time
  function data(id) {
    if (preview(id)) return scratch || (scratch = G.normalizeStory({ ch: { ch99: {} } }).ch.ch99);
    const st = G.save.story || (G.save.story = { ch: {} });
    if (!st.ch) st.ch = {};
    if (!st.ch[id]) st.ch[id] = G.normalizeStory({ ch: { [id]: {} } }).ch[id];
    return st.ch[id];
  }
  const peek = (id) => (G.save && G.save.story && G.save.story.ch && G.save.story.ch[id]) || null;
  function status(id) {
    const c = chapter(id);
    if (!c) return "";
    if (c.preview) return T("story.kit.status");
    if (c.soon) return T("story.status.soon");
    const d = peek(id);
    if (!d || !d.started) return T("story.status.new");
    if (d.done && !d.cp) return T("story.status.done");
    const i = d.cp ? d.cp.scene : d.scene;
    return T("story.status.scene", { i: i + 1, n: c.scenes.length });
  }
  const sceneTitle = (c, i) => (c.scenes[i] ? T(c.scenes[i].title) : "");

  // ---------------- words ----------------
  // the chapter's words the Master Word Bank has (a family form as its headword)
  function entries(id) {
    const c = chapter(id), seen = new Set(), out = [];
    if (!c || !c.words || !G.WordBank) return out;
    c.words.main.forEach((w) => {
      const e = G.WordBank.byId(w) || G.WordBank.lookup(w) || (G.WordBank.textOwner ? G.WordBank.textOwner(w, "en") : null);
      if (e && !seen.has(e.id)) { seen.add(e.id); out.push(e); }
    });
    return out;
  }
  function missing(id) {
    const c = chapter(id);
    if (!c || !c.words || !G.WordBank) return [];
    return c.words.main.filter((w) => !(G.WordBank.byId(w) || G.WordBank.lookup(w) || (G.WordBank.textOwner && G.WordBank.textOwner(w, "en"))));
  }
  function pairs(id) {
    const wl = G.Lang.word(), ml = G.Lang.meaning();
    return entries(id).map((e) => G.WordBank.pairOf(e, wl, ml)).filter(Boolean);
  }
  // a group of n zombies' words. Counted slot by slot through the run (so small
  // groups still add up): CONFIG.story.chapterShare of the slots from the
  // chapter -- the first of them as a wave ranks them: due, learning, at most
  // maxNew new -- and the rest words due anywhere else in the bank; with none
  // due there, the chapter's own. (A zombie takes one of the plan's words:
  // js/game.js spawnZombieAt.)
  function plan(game, n) {
    const pool = (run && run.pool) || game.wordPool || [];
    n = Math.max(1, n | 0);
    if (!pool.length) return [];
    const share = C().chapterShare, k0 = run ? run.slots || 0 : 0;
    let nCh = 0;
    for (let k = k0 + 1; k <= k0 + n; k++) if (Math.round(share * k) > Math.round(share * (k - 1))) nCh++;
    if (run) run.slots = k0 + n;
    const mine = new Set(pool.map((p) => G.wordKey(p)));
    const elsewhere = (run && run.elsewhere) || (G.getAllBuiltinWords ? G.getAllBuiltinWords() : []).filter((p) => !mine.has(G.wordKey(p)));
    if (run) run.elsewhere = elsewhere;
    const ranked = G.WavePlan.build(pool, n);
    const out = ranked.slice(0, nCh);
    G.shuffle(G.SRS.split(elsewhere).due).slice(0, n - out.length).forEach((p) => out.push(p));
    // (short of words due elsewhere: the chapter's own make up the group)
    for (const p of ranked.concat(G.shuffle(pool))) { if (out.length >= n) break; if (!out.includes(p)) out.push(p); }
    return G.shuffle(out);
  }

  // ---------------- the level ----------------
  function level(id) {
    const c = chapter(id);
    // (round 4: `map` is the chapter's own place, js/world.js G.StoryMaps -- "training" the
    // Training Yard's stand-in; `theme` its palette, sound and grade)
    const map = c.map && c.map !== "training" ? c.map : null;
    return { id: "story_" + id, theme: c.theme || "training", map, icon: "📖", waves: 1, difficulty: 0.8, spawnBaseInterval: 99, maxAliveZombies: 16, wordsKey: null, name: T(c.title), story: id, kit: !!c.kit };
  }

  // ---------------- from the lobby ----------------
  function open(id) {
    if (!on()) return;
    const c = chapter(id);
    if (!c || c.soon || !G.Dialog) return;
    if (c.preview) { start(id, null); return; }        // (round 3: the kit's gallery: straight in)
    const d = peek(id) || {};
    // (the main button last, as in the game's other windows: Continue, Play again / Start over, or Play)
    // (a completed chapter played again has its checkpoints too: `done` stays, it was finished once)
    const buttons = [{ label: T("dialog.cancel"), cancel: true }];
    const resume = !!d.cp;
    const skip = { label: T("story.open.skip"), action: () => start(id, { scene: 1, beat: 0, skip: true }) };
    if (resume) {
      buttons.push({ label: T("story.open.restart"), action: () => restart(id, true) });
      if (d.prologueDone) buttons.push(skip);
      buttons.push({ label: T("story.open.continue", { scene: sceneTitle(c, d.cp.scene) }), primary: true, action: () => start(id, d.cp) });
    } else if (d.started) {
      if (d.prologueDone) buttons.push(skip);
      buttons.push({ label: T(d.done ? "story.open.again" : "story.open.restart"), primary: true, action: () => restart(id, false) });
    } else buttons.push({ label: T("story.open.play"), primary: true, action: () => start(id, null) });
    const text = resume ? T("story.open.resume", { i: d.cp.scene + 1, n: c.scenes.length, scene: sceneTitle(c, d.cp.scene) }) : T("story.open.text");
    const body = C().enabled ? "" : `<p class="story-preview">${G.escapeHtml(T("story.preview"))}</p>`;
    G.Dialog.open({ icon: "📖", title: T("story.chapterN", { n: c.n }) + " · " + T(c.title), text, body, buttons });
  }
  // start over: with a checkpoint to lose, asked first
  function restart(id, hasCp) {
    if (!hasCp) { start(id, null); return; }
    G.Dialog.confirm({ title: T("story.open.restart"), text: T("story.restart.text"), yes: T("story.open.restart"), no: T("dialog.cancel") }, () => start(id, null));
  }
  function start(id, from) {
    const c = chapter(id);
    if (!c || c.soon || !G.Game || !G.Game.startStory) return;
    const d = data(id);
    d.started = true; d.runs = (d.runs || 0) + 1;
    // (from the beginning, or Skip Prologue: a new play-through)
    if (!from || from.skip) { d.cp = null; d.scene = from && from.skip ? 1 : 0; d.curTime = 0; d.curRight = 0; d.curWrong = 0; }
    G.persist();
    pending = { id, from: from || null };
    G.Game.startStory(id);
  }

  // ---------------- the run ----------------
  function beginRun(game) {
    const p = pending || { id: "ch1", from: null };
    pending = null;
    const c = chapter(p.id);
    if (!c) return;
    const from = p.from;
    run = { id: p.id, ch: c, game, pool: game.wordPool, flags: new Set(from && from.flags ? from.flags : []), time: 0, time0: 0,
      right0: game.correctCount || 0, wrong0: game.wrongCount || 0, over: false, dead: false, lastShot: null, hintKey: null, hintN: 0, hintAt: -99,
      keyIds: new Set(entries(p.id).map((e) => e.id)) };   // (round 2: the chapter's words, bold in its lines)
    document.body.classList.add("story-run");
    // (round 2) the narrative tools start clean; the phone takes back what the flags say came
    if (G.StoryDialogue) G.StoryDialogue.reset();
    if (G.StoryCam) G.StoryCam.reset();
    if (G.LexiLens) G.LexiLens.reset();
    if (G.StoryPhone) G.StoryPhone.start();
    // (round 5) and the scene's people, things to use, the practice exam, the screen (the last
    // run's level is gone: nothing of it to take out of the scene)
    if (G.StoryCast) G.StoryCast.reset();
    if (G.StoryUse) G.StoryUse.reset(game);
    if (G.StoryQuiz) G.StoryQuiz.reset(game);
    if (G.StoryScreen) G.StoryScreen.reset();
    // (round 6) the letter locks, the whispers
    if (G.StoryLock) G.StoryLock.reset(game);
    if (G.StoryWhisper) G.StoryWhisper.reset();
    // (round 7) what is pushed into place, a cabinet's window
    if (G.StoryPush) G.StoryPush.reset();
    if (G.StoryPick) G.StoryPick.reset(game);
    // what the checkpoint was carrying (full health: a checkpoint is a fresh start)
    if (from && from.guns) {
      const pl = game.player;
      from.guns.forEach((g) => { if (G.WEAPON_DEFS[g] && !pl.gunSlots.includes(g) && G.Loadout && G.Loadout.add) G.Loadout.add(game, g); });
      Object.keys(from.ammo || {}).forEach((g) => { if (pl.ammo[g]) { pl.ammo[g].mag = from.ammo[g][0]; pl.ammo[g].reserve = from.ammo[g][1]; } });
      if (from.melee && from.melee !== (pl.melee || "knife") && G.Melee && G.MELEE_WEAPONS && G.MELEE_WEAPONS[from.melee]) G.Melee.give(game, from.melee);
      pl.hp = pl.maxHp;
    }
    const sceneI = from ? Math.min(c.scenes.length - 1, from.scene | 0) : 0;
    G.StoryScenes.enter(game, run, sceneI, from && !from.skip ? from.beat : 0);
    const sc = c.scenes[sceneI], at = from && Number.isFinite(from.x) && from.x !== null ? from : sc.start;
    if (at) {
      game.teleportPlayer(new THREE.Vector3(at.x, Number.isFinite(at.y) ? at.y : 0, at.z));        // (round 4: and its storey)
      if (Number.isFinite(at.yaw)) game.yawObject.rotation.y = at.yaw;
      game.pitchObject.rotation.x = 0;
    }
    game.requiredKills = 0; game.spawnedCount = 0;
    data(p.id).scene = Math.max(data(p.id).scene || 0, sceneI);
    sceneCard();
  }
  function update(game, dt) {
    if (!run || run.over || game.mode !== "story") return;
    if (game.state === "GAMEPLAY" && !game.paused) run.time += dt;
    // (round 2: the lines and what is held first -- a beat may be waiting on them)
    if (G.StoryDialogue) G.StoryDialogue.update(game, dt);
    if (G.LexiLens) G.LexiLens.update(dt);
    if (G.StoryPhone) G.StoryPhone.update(game, dt);
    // (round 3) the LEXA patch of the zombie under the crosshair; the kit's gallery
    if (G.VoxelChars) G.VoxelChars.update(game);
    if (run.ch.kit && G.VoxelKit) G.VoxelKit.update(game, dt);
    // (round 4) the chapter's map: the storeys drawn, the sun over the player
    if (game.world && game.world.storyMap && game.world.storyMap.update) game.world.storyMap.update(game);
    if (G.StoryLight) G.StoryLight.update(game);
    // (round 5) the scene's people, a press in time, the practice exam, the screen's moments
    if (G.StoryCast) G.StoryCast.update(game, dt);
    if (G.StoryUse) G.StoryUse.update(game, dt);
    if (G.StoryQuiz) G.StoryQuiz.update(game, dt);
    if (G.StoryScreen) G.StoryScreen.update(game, dt);
    // (round 6) a letter lock being turned (or left for a fight), zombies whispering their words
    if (G.StoryLock) G.StoryLock.update(game, dt);
    if (G.StoryWhisper) G.StoryWhisper.update(game, dt);
    // (round 7) a bookshelf pushed while the button is held
    if (G.StoryPush) G.StoryPush.update(game, dt);
    G.StoryScenes.update(game, run, dt);
  }
  // (round 5) the gun in the hands -- or not yet. Handed over (not `quiet`): it comes up as a
  // gun drawn does, the HUD's slots and magazine showing it
  function arm(game, on, quiet) {
    if (!run) return;
    const was = !run.unarmed;
    run.unarmed = !on;
    if (G.ViewModel && G.ViewModel.setVisible) G.ViewModel.setVisible(!!on);
    document.body.classList.toggle("story-hands-free", !on);          // (the gun's touch buttons away: css)
    if (on && !was && !quiet) {
      if (game.wsm && game.wsm.requestSwitch) game.wsm.requestSwitch();
      if (G.Audio && G.Audio.sfx) G.Audio.sfx("pickup");
    }
  }
  function handsFree() { return !!(run && run.unarmed && !run.over); }
  // (round 2) a line's {name}: the profile's name, else a candidate number of this device's
  function vars() {
    const p = G.save && G.save.profile;
    if (p && p.name) return { name: p.name };
    const id = String((G.save && G.save.meta && G.save.meta.deviceId) || "x");
    let h = 0;
    for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
    return { name: "305-" + String(10 + (h % 90)) };
  }
  // (round 2) a choice made: kept in the chapter's save (G.normalizeStory keeps a-z 0-9 _)
  function chose(id, value) {
    if (!run) return;
    const d = data(run.id), k = String(id).replace(/[^a-zA-Z0-9_]/g, "").slice(0, 32), v = String(value).replace(/[^a-zA-Z0-9_]/g, "").slice(0, 32);
    if (k && v) { d.choices[k] = v; G.persist(); }
  }
  // (round 2) a chapter's keys: the phone, its torch, Enter for the next line (js/game.js G.onKeyDown)
  function onKey(e) {
    if (!run || run.over) return false;
    // (round 6) at a letter lock every key is the lock's (but the pause)
    if (G.StoryLock && G.StoryLock.holds()) return G.StoryLock.onKey(e);
    const kb = G.save.settings.keybinds;
    if (kb.phone && e.code === kb.phone) { if (!e.repeat && G.StoryPhone) G.StoryPhone.toggle(); return true; }
    if (kb.flashlight && e.code === kb.flashlight) { if (!e.repeat && G.StoryPhone) G.StoryPhone.torch(); return true; }
    // (round 5) a press in time, and the practice exam's answer, before the interaction key's own use
    if (G.StoryUse && G.StoryUse.onKey(e)) return true;
    if (G.StoryQuiz && G.StoryQuiz.active && G.StoryQuiz.onKey(e)) return true;
    return !!(G.StoryDialogue && G.StoryDialogue.onKey(e));
  }
  // (round 7) wrong shots in a row on the same word: a scene's `hints` -- { who, after, gap } -- has
  // someone help: Nam, her paper dictionary open, reads the word's meaning (in English) and its first
  // letter. A help: the answer that follows moves no box (the wrong shots already took the word
  // out of it: js/game.js learnRight), and it says so as any helper does (_attempt.assisted)
  function onWrongShot(game, z, tp) {
    const sc = run && !run.over && run.scene, h = sc && sc.hints;
    if (!h || !tp) return;
    const key = G.wordKey(tp);
    if (run.hintKey !== key) { run.hintKey = key; run.hintN = 0; }
    run.hintN++;
    if (run.hintN !== (h.after || 2) || run.time - run.hintAt < (h.gap != null ? h.gap : 12)) return;
    run.hintAt = run.time;
    const def = G.Clues && G.Clues.definition ? G.Clues.definition(tp) : "", word = String(tp[0] || "");
    if (G.StoryCast && G.StoryCast.get(h.who)) G.StoryCast.act(game, run, { id: h.who, talk: 2.2 });
    G.StoryDialogue.say([{ who: h.who || "nam", line: def ? (h.line || "story." + run.ch.id + ".d.namDict") : (h.lineFirst || "story." + run.ch.id + ".d.namFirst"),
      vars: Object.assign(vars(), { def, first: word.charAt(0).toUpperCase(), n: word.length }) }]);
    if (game._attempt && game._attempt.key === key) game._attempt.assisted = true;
    run.flags.add("hinted");
  }
  // (round 7) a shot fired: when (a scene asks { fired: s } -- the nurse woken by it)
  if (G.Bus) G.Bus.on("weapon:fire", () => { if (run && !run.over) { run.lastShot = run.time; run.lastShotPos = run.game && run.game.yawObject ? run.game.yawObject.position.clone() : null; } }, "story");
  // (round 2) the lines, the turned view, the bars, the phone: gone (a death, the end, leaving)
  function quiet() {
    if (G.StoryDialogue) G.StoryDialogue.reset();
    if (G.StoryCam) G.StoryCam.reset();
    if (G.StoryPhone) G.StoryPhone.close();
  }
  // the answers and the time since the last time they were counted, into the chapter's totals
  function commit(game) {
    if (!run) return;
    const d = data(run.id);
    const dr = Math.max(0, (game.correctCount || 0) - run.right0), dw = Math.max(0, (game.wrongCount || 0) - run.wrong0), dt = Math.max(0, run.time - run.time0);
    d.right += dr; d.wrong += dw; d.time += dt;
    d.curRight += dr; d.curWrong += dw; d.curTime += dt;
    run.right0 = game.correctCount || 0; run.wrong0 = game.wrongCount || 0; run.time0 = run.time;
  }
  // the scene's name across the screen: as a run begins, and on to the next scene
  function sceneCard() {
    if (run && G.UI.flashPurchaseBanner) G.UI.flashPurchaseBanner(G.escapeHtml(sceneTitle(run.ch, run.sceneI)), G.escapeHtml(T("story.chapterN", { n: run.ch.n })));
  }
  function checkpoint(game, at) {
    if (!run) return;
    commit(game);
    const d = data(run.id), pl = game.player, ammo = {};
    pl.gunSlots.forEach((g) => { const a = pl.ammo[g]; if (a) ammo[g] = [a.mag, a.reserve]; });
    const pos = at && Number.isFinite(at.x) ? at : null;
    d.cp = { scene: run.sceneI, beat: run.beatI, at: Date.now(), hp: Math.max(1, pl.hp), guns: pl.gunSlots.slice(), melee: pl.melee || "knife", ammo,
      flags: Array.from(run.flags), x: pos ? pos.x : null, y: pos && Number.isFinite(pos.y) ? pos.y : null, z: pos ? pos.z : null, yaw: pos && Number.isFinite(pos.yaw) ? pos.yaw : null };
    d.scene = Math.max(d.scene || 0, run.sceneI);
    G.save.story = G.normalizeStory(G.save.story);
    G.persist(true);
    // (the campaign's checkpoint toast, js/checkpoint.js, with the chapter's line)
    if (G.Checkpoint && G.Checkpoint.toast) G.Checkpoint.toast(0, T("story.checkpoint"));
    if (G.Bus) G.Bus.emit("story:checkpoint", { ch: run.id, scene: run.sceneI, beat: run.beatI });
  }
  function prologueDone() { if (run) { data(run.id).prologueDone = true; G.persist(); } }
  function sceneReached(i) { if (run) { const d = data(run.id); d.scene = Math.max(d.scene || 0, i); G.persist(); sceneCard(); } }

  // the player down: a scene that cannot be lost keeps them standing; else back to the checkpoint
  function died(game) {
    if (!run || run.over) return false;
    if (run.scene && run.scene.noDeath) { game.player.hp = Math.max(C().floorHp || 1, 1); return true; }
    if (run.dead) { game.player.hp = 1; return true; }
    run.dead = true;
    game.player.hp = 1;
    commit(game);
    G.persist(true);
    quiet();
    const id = run.id, d = data(id);
    const back = d.cp ? d.cp : { scene: run.sceneI, beat: 0 };
    G.Dialog.open({ icon: "🩸", title: T("story.death.title"), text: T("story.death.text"), buttons: [
      { label: T("story.menu"), cancel: true, action: () => G.Game.quitToMainMenu() },
      { label: T("story.death.retry"), primary: true, action: () => start(id, back) },
    ] });
    return true;
  }
  // the chapter's end: done, the best time, the summary (story round 10 gives it its own screen)
  function finish(game) {
    if (!run) return;
    commit(game);
    run.over = true;
    quiet();
    const id = run.id, c = run.ch, d = data(id);
    d.done = true; d.cp = null; d.scene = 0; d.finishedAt = Date.now();
    if (d.curTime > 0) d.best = d.best > 0 ? Math.min(d.best, d.curTime) : d.curTime;
    const total = d.curRight + d.curWrong, acc = total ? Math.round((d.curRight / total) * 100) : 0;
    const t = Math.round(d.curTime), time = Math.floor(t / 60) + ":" + String(t % 60).padStart(2, "0");
    G.persist(true);
    if (G.Bus) G.Bus.emit("story:done", { ch: id, time: d.curTime, right: d.curRight, wrong: d.curWrong });
    const next = c.next && chapter(c.next);
    // (the next chapter: named, and its button off while it is still to come)
    const buttons = [];
    if (next) buttons.push({ label: T(next.soon ? "story.end.nextSoon" : "story.end.next", { title: T(next.title) }), disabled: !!next.soon, action: () => { if (!next.soon) start(next.id, null); } });
    buttons.push({ label: T("story.menu"), primary: true, cancel: true, action: () => G.Game.quitToMainMenu() });
    G.Dialog.open({ icon: "🏁", title: T("story.end.title"), text: T("story.end.text", { title: T(c.title), t: time, a: acc }), buttons });
  }
  function teardown(game) {
    if (run && !run.over) commit(game);
    if (run) G.persist();
    run = null;
    document.body.classList.remove("story-run");
    // (round 2: and the whole HUD back, the glasses off -- before any other mode is played)
    if (G.StoryDialogue) G.StoryDialogue.reset();
    if (G.StoryCam) G.StoryCam.reset();
    if (G.StoryPhone) G.StoryPhone.stop();
    if (G.LexiLens) G.LexiLens.reset();
    if (G.VoxelChars) G.VoxelChars.reset();
    if (G.VoxelKit) G.VoxelKit.teardown();
    if (G.StoryLight) G.StoryLight.reset();
    // (round 5) the scene's people and things gone with the level; the hands' gun shown again
    if (G.StoryCast) G.StoryCast.reset(game);
    if (G.StoryUse) G.StoryUse.reset(game);
    if (G.StoryQuiz) G.StoryQuiz.reset(game);
    if (G.StoryScreen) G.StoryScreen.reset();
    if (G.StoryLock) G.StoryLock.reset(game);
    if (G.StoryWhisper) G.StoryWhisper.reset();
    if (G.StoryPush) G.StoryPush.reset();
    if (G.StoryPick) G.StoryPick.reset(game);
    if (G.ViewModel && G.ViewModel.setVisible) G.ViewModel.setVisible(true);
    document.body.classList.remove("story-hands-free");
  }
  // the HUD's top box while a chapter is played: the chapter, the scene; the objective in the word box
  function hudHead(game, left) {
    if (!run) return { level: "", wave: "", left: "" };
    return { level: T("story.chapterN", { n: run.ch.n }), wave: sceneTitle(run.ch, run.sceneI), left: game.zombies.some((z) => z.alive) ? T("hud.zombiesLeft", { n: left }) : "" };
  }
  // (round 5: while the practice exam runs, its question and which one it is)
  function idleMeaning() { const q = G.StoryQuiz && G.StoryQuiz.active ? G.StoryQuiz.line() : null; return q || (run && run.objective ? T(run.objective, vars()) : "-"); }
  function idleLabel() { const l = G.StoryQuiz && G.StoryQuiz.active ? G.StoryQuiz.label() : null; return l || T("story.objective"); }
  // the page going away mid-scene: the answers and the time so far into the chapter's
  // totals (the player comes back at the checkpoint; js/savemanager.js writes the save)
  window.addEventListener("pagehide", () => { if (run && !run.over && run.game) { commit(run.game); G.persist(true); } });

  return {
    on, chapters, chapter, data, status, entries, missing, pairs, plan, level, open, restart, start,
    beginRun, update, commit, checkpoint, prologueDone, sceneReached, died, finish, teardown, hudHead, idleMeaning, idleLabel,
    vars, chose, onKey, arm, handsFree, onWrongShot,
    get run() { return run; }, get pending() { return pending; },
  };
})();
