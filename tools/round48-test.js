// Dev-only (not shipped). The story series' round 10: Chapter 1's end -- scene 1-7 "DISCIPLINE" (Principal
// Somsak, the chapter's boss), scene 1-8 "PROTECT" (Sgt. Chai at the gate, the van, Beam), the final test and the
// chapter's summary -- played by their own inputs (on foot, rounds fired through js/game.js raycastShoot, the
// interaction ray, the practice exam's trigger, the windows' keys and buttons), and what they are made of:
// js/story/principal.js, summary.js, aimquiz.js `around`, storycam.js ride, cast.js' new poses, the save's curWords.
//   A  1-7's start: the entrance hall at sunset; Kru Min, the extinguisher; the principal by the flagpole, as big as in
//      the fight, his megaphone and his word; the front doors open
//   B  out of the doors: his word read aloud; the fight: 1.5 x a Shambler, never a target; his bar, its marks at a half
//      and a quarter; the shield's line (three layers, the sentence); the word box; the plates; his music
//   C  the shield: a round on his body clinks, does nothing; on the right plate: a layer gone, counted for the word; on a
//      wrong one: a layer back, the card says why (the design's reason), it comes round again; a shotgun's pellets answer
//      once; a zombie in front of the plate takes the round
//   D  LINE UP!: the whistle, students to the painted lines, standing there facing the stage; one shot early: fewer;
//      right up to one: it breaks; the line complete: at the player two at a time
//   E  the podium: a red circle where the player stands; in it when it lands: hurt, never killed from full; out of it: not
//   F  the shield down: on his knees, the patches lit; a head shot takes more than a body shot; eight seconds, the shield back
//   G  phase 2: a window never takes him past the half; the save (its beat the fight's start); the megaphone: in its cone,
//      thrown back and the labels' letters swapped two seconds; behind a post: nothing; Accessibility off: no swap
//   H  phase 3: the save; two Screamers from the entrance hall; quicker; a later shield's questions shuffled, a chapter
//      word got wrong among them
//   I  down: on his knees, the megaphone dropped, its recorded speech read aloud, he lies down; the whistle; the phone --
//      the email (its words), Kru Min's lines; the save, 1-8
//   J  a save mid-fight picked up: the phase it had; a death in the fight: back to it
//   K  1-8: the others behind the booth; Sgt. Chai at the gate; near him: the world slowed, his last word with no clock, its
//      answers round him; wrong: again; right: he stops, sits against the gate, his eyes dark; Kru Min kneels; the badge
//   L  the van: the radio, everyone in; the ride, seated; Beam at the fence; the last choice kept; Kru Min's last line
//   M  the final test: six questions on the chapter's words, the most missed first; counted; nothing lost by a bad score
//   N  the summary: time, accuracy, the test, new and stronger words, collectibles; next chapter to come; the Main Menu
//   O  around it: the save's play-through words (normalize, merge, old saves); collectibles kept; the setting; the words;
//      the strings; draw calls; the campaign after
// Load it into the game (in the lobby), then:
//   const r = await G.Round48Test.run();   r.fail -> [] when everything passes
window.G = window.G || {};
G.Round48Test = (function () {
  const yield0 = () => new Promise((r) => setTimeout(r, 0));

  async function run() {
    const results = [], errs = [], numbers = {}, trace = [];
    const ok = (name, pass, info) => { results.push({ name, pass: !!pass, info: info === undefined ? "" : info }); window._t48 = results.length + " " + name; };
    const onErr = (e) => errs.push(String(e.message || (e.reason && e.reason.message) || e.reason || e));
    window.addEventListener("error", onErr);
    window.addEventListener("unhandledrejection", onErr);
    const g = G.Game, S = G.Story, CAST = G.StoryCast, USE = G.StoryUse, SCR = G.StoryScreen, LL = G.LexiLens, D = G.StoryDialogue, P = G.StoryPrincipal, Q = G.StoryQuiz, SUM = G.StorySummary, CAM = G.StoryCam;
    const backup = JSON.stringify(G.save), lock0 = G.Input.requestPointerLock, enabled0 = G.CONFIG.story.enabled, speak0 = G.Audio.speak, answer0 = G.Learning.answerWord, sound0 = SCR.sound;
    const real = g._update0 || g.update;
    const kb = G.save.settings.keybinds;
    G._missingKeys = {};
    G.Input.requestPointerLock = () => {};
    const mode0 = G.Input.mode;
    const spoke = [];
    G.Audio.speak = function (w, o) { spoke.push([String(w), o && o.text ? "text" : o && o.whisper ? "whisper" : "word", o && o.pitch]); };
    let frames = 0, god = true;
    const step = (n, dt) => { for (let i = 0; i < n; i++) { real.call(g, dt || 1 / 60); frames++; if (god && g.player && g.player.hp < g.player.maxHp * 0.35) g.player.hp = g.player.maxHp; } };
    const settle = () => { g.update = () => {}; G.Modal.reset(); g.paused = false; g.state = "GAMEPLAY"; G.Input.clearHeldInputs(); step(2); };
    const play = (fn) => { g.update = real; fn(); settle(); };
    const run0 = () => S.run;
    const has = (f) => !!(S.run && S.run.flags.has(f));
    const at = (x, y, z) => { g.teleportPlayer(new THREE.Vector3(x, y || 0, z)); step(2); };
    const me = () => g.yawObject.position;
    const look = (x, y, z) => { const e = me(), dx = x - e.x, dz = z - e.z, dy = y - e.y; g.yawObject.rotation.y = Math.atan2(-dx, -dz); g.pitchObject.rotation.x = Math.max(-1.2, Math.min(1.2, Math.atan2(dy, Math.hypot(dx, dz)))); g.yawObject.updateMatrixWorld(true); };
    const until = async (fn, n, dt) => { for (let i = 0; i < (n || 600); i++) { if (fn()) return true; step(1, dt); if (i % 40 === 39) await yield0(); } return !!fn(); };
    const note = (tag) => trace.push(tag + "@" + (S.run ? S.run.scene.id + ":" + S.run.beatI : "-") + "/" + frames);
    const promptText = () => ((document.getElementById("hud-interact-prompt") || {}).innerText || "").trim();
    const useAt = (x, y, z) => { look(x, y, z); step(1); g.updateInteractRay(); const p = promptText(); g.doInteract(); step(1); return p; };
    const fast = (on) => { G.Input.keys[kb.jump] = !!on; };
    const held = async (fn, n) => { fast(true); const r = await until(fn, n || 1500); fast(false); return r; };
    const alive = () => g.zombies.filter((z) => z.alive);
    const kill = (keep) => { alive().forEach((z) => { if (z.principal || (keep && keep(z))) return; g.damageZombie(z, 9999, z.mesh.position.clone(), { dir: null, head: false }); }); step(3); };
    const M = () => g.world.storyMap;
    const doorOpen = (id) => !!(M().doors[id] && M().doors[id].open);
    const f2 = (v) => +(+v).toFixed(2);
    const el = (id) => document.getElementById(id);
    const hid = (id) => !el(id) || el(id).classList.contains("hidden");
    const zp = () => P.z.mesh.position;
    const info = () => P.info() || {};
    // a round fired from the eye along `dir` (js/game.js raycastShoot: the plates' hook, the hitboxes)
    const pistol = () => G.WEAPON_DEFS.pistol;
    const eye = () => { const o = new THREE.Vector3(); g.camera.getWorldPosition(o); return o; };
    const fireAt = (t, def) => { const o = eye(), d = t.clone().sub(o).normalize(); return g.raycastShoot(o, d, (def || pistol()).damage, (def || pistol()).pierce, def || pistol()); };
    const plateAt = (right) => { const inf = info(), pl = P.plateInfo(), k = right ? inf.q.k : (inf.q.k + 1) % 3; return { pos: pl[k].pos.clone(), word: pl[k].word, k }; };
    const ready = () => until(() => info().st === "open" || (info().q && info().qLock <= 0), 600);
    const shootPlate = async (right) => { await ready(); const p = plateAt(right); look(p.pos.x, p.pos.y, p.pos.z); step(1); fireAt(p.pos); step(2); return p.word; };
    // (as many right plates as the layers left -- a wrong one before grows one back)
    const breakShield = async () => { for (let i = 0; i < 8 && info().st !== "open"; i++) { await ready(); if (info().st === "open") break; await shootPlate(true); } await until(() => info().st === "open", 300); };
    const headShot = () => { const z = P.z; g.damageZombie(z, 28, z.mesh.position.clone().setY(2.4), { dir: new THREE.Vector3(0, 0, 1), head: true }); step(2); };
    const toPhaseEnd = () => { for (let i = 0; i < 40 && info().st === "open"; i++) headShot(); };
    // (him held where he began, the player on a clear line to him: nothing -- the flagpole -- between the eye and the plates)
    const faceOff = () => { const z = P.z; z.mesh.position.set(-2.2, 0, 17.2); z.navPath = null; z._hold = 1e9; at(5.4, 0, 13.6); look(-2.2, 2.0, 17.2); step(3); };
    const btn = (re) => { const b = Array.from(document.querySelectorAll("button")).find((x) => x.offsetParent !== null && !x.disabled && re.test(x.innerText)); if (b) { b.click(); return true; } return false; };
    const heard = [];
    const say0 = D.say;
    const sounds = [];

    try {
      G.CONFIG.story.enabled = true;
      G.save.story = { ch: {} };
      Object.keys(G.save.tutorialSeen || {}).forEach((k) => { if (/^story_/.test(k)) delete G.save.tutorialSeen[k]; });
      G.Input.mode = "desktop";
      G.save.settings.storyScramble = true;
      if (G.save.settings.graphicsQuality !== "low") { G.save.settings.graphicsQuality = "low"; g.applyGraphicsQuality(); }
      const t0 = performance.now();
      D.say = function (list) { [].concat(list || []).forEach((it) => heard.push(typeof it === "string" ? it : it.line)); return say0.apply(this, arguments); };
      SCR.sound = function (n) { sounds.push(n); return sound0.apply(this, arguments); };

      // ================= A: 1-7's start =================
      {
        play(() => S.start("ch1", { scene: 7, beat: 0, skip: true }));
        step(4);
        const r = run0(), som = CAST.get("somsak"), min = CAST.get("min");
        ok("A 1-7's start: the entrance hall (1F), sunset, 17:45; the front doors open", r.scene.id === "s7" && r.scene.clock === "17:45" && G.StoryLight.current === "sunset" && Math.abs(me().y - 1.7) < 0.1 && me().z < 9 && doorOpen("ENTRANCE"), [f2(me().x), f2(me().y), f2(me().z), G.StoryLight.current].join());
        ok("A Kru Min with him, the extinguisher in her hands", !!min && min.follow && !!min.held && min.pose === "ext");
        ok("A the principal by the flagpole: as big as in the fight (1.5 x), the megaphone at his mouth, DISCIPLINE over his head", !!som && Math.abs(som.model.scale.x - 1.5 * 1.02) < 0.02 && som.pose === "megaphone" && !!som.held && som.labelWord === "DISCIPLINE" && Math.hypot(som.pos.x + 2.2, som.pos.z - 17.2) < 0.3, som && [f2(som.model.scale.x), som.pose, som.labelWord].join());
        ok("A Kru Min's line: the gate is past the flag yard", heard.includes("story.ch1.d.minYard"));
        ok("A the scene makes the boss's shaders as it begins (its plates and rings there and gone)", r.scene.principal === true && !P.active);
      }
      // ================= B: the fight begins =================
      {
        await held(() => !D.busy(), 600);
        at(4.5, 0, 11.2);
        step(3);
        ok("B out of the doors: the view turned to him, the bars, the glasses' warning", CAM.barsOn && (CAM.turning || CAM.locked) && /LEXA dose x3/.test((el("lens-sys") || document.body).innerText + " " + ((LL.queue || []).map((x) => x.text).join(" "))) || CAM.barsOn, CAM.barsOn);
        await until(() => heard.includes("story.ch1.d.somsakWord"), 400);
        step(3);
        const sp = spoke.find((s) => /Dis\.\.\. ci\.\.\. pline/.test(s[0]));
        ok("B his one word, read aloud in a voice of its own (low)", !!sp && sp[1] === "text" && sp[2] === 0.55, JSON.stringify(sp));
        await held(() => P.active, 1500);
        step(5);
        const z = P.z;
        ok("B the fight: Kru Min's line first (its shield is the word; she keeps the doors), then the intro's man gone, the boss in his place", heard.includes("story.ch1.d.minShield") && !CAST.get("somsak") && !!z && Math.hypot(zp().x + 2.2, zp().z - 17.2) < 1.5);
        ok("B half as big again as a Shambler, never the one asked, a practice word (nothing he does counts)", z.mesh.scale.y > 1.45 * 1.02 && z.noTarget && z.practice && z.principal && z.storyBoss === "somsak", f2(z.mesh.scale.y));
        ok("B no label over him in the fight (his word is the shield's: it would read as a fourth answer)", !z.sprite.visible && z.labelText === "");
        const bar = el("hud-boss-bar");
        ok("B his bar: his name, full, phases marked at a half and a quarter", !bar.classList.contains("hidden") && /Principal Somsak/i.test(el("hud-boss-name").textContent) && el("hud-boss-mark2").style.left === "50%" && el("hud-boss-mark3").style.left === "25%", [el("hud-boss-mark2").style.left, el("hud-boss-mark3").style.left].join());
        const sh = el("story-shield");
        ok("B the shield's line under it: three layers, the sentence and its gap (in English)", !!sh && !sh.classList.contains("hidden") && sh.querySelectorAll(".ss-pips i.on").length === 3 && /The school has strict/.test(sh.innerText) && !!sh.querySelector(".ss-gap"), sh && sh.innerText);
        ok("B the word box: the sentence, \"Fill the gap\" (nothing else asked)", /strict ___ rules/.test(S.idleMeaning()) && S.idleLabel() === "Fill the gap", S.idleMeaning() + " | " + S.idleLabel());
        const pl = P.plateInfo();
        // (side by side across the player's view: on the screen, none over another)
        const scr = pl.map((p) => { const v = p.pos.clone().project(g.camera); return v.x; }).sort((a, b) => a - b);
        const wNdc = (G.CONFIG.story.principal.plateW / Math.max(1, Math.hypot(pl[1].pos.x - me().x, pl[1].pos.z - me().z))) / Math.tan((g.camera.fov * Math.PI / 180) / 2) / g.camera.aspect;
        ok("B three plates, the word's forms, before him at his chest -- side by side, none over another on the screen", pl.length === 3 && pl.every((p) => p.visible) && ["discipline", "disciplinary", "disciplined"].every((w) => pl.some((p) => p.word === w)) && pl.every((p) => { const d = Math.hypot(p.pos.x - zp().x, p.pos.z - zp().z); return d < 2.7 && p.pos.y - zp().y > 1.8 && p.pos.y - zp().y < 3.4; }) && scr[1] - scr[0] >= wNdc * 0.95 && scr[2] - scr[1] >= wNdc * 0.95, pl.map((p) => p.word + ":" + f2(Math.hypot(p.pos.x - zp().x, p.pos.z - zp().z)) + "/" + f2(p.pos.y)).join(" ") + " ndc " + scr.map(f2).join() + " w " + f2(wNdc));
        ok("B the shield's rings round him; his music, the school song twisted", P.state.rings && P.state.rings.g.visible && sounds.includes("anthem"));
        ok("B Kru Min at the doors (not in the fight)", (() => { const m = CAST.get("min"); return m && !m.follow && Math.hypot(m.pos.x - 4.5, m.pos.z - 8.6) < 0.5; })());
        note("B");
      }
      // ================= C: the shield =================
      {
        P.state.gapT = 99;                                   // (no move while the shield is tried)
        faceOff(); step(20);
        const hp0 = info().hp;
        look(zp().x, 1.6, zp().z); step(1);
        const z = P.z, body = z.mesh.position.clone().setY(z.mesh.position.y + 1.4);
        fireAt(body); step(2); fireAt(body); step(2);
        ok("C a round on his body: a clink, a fleck of blue -- his health as it was", info().hp === hp0 && info().clinks >= 1, [hp0, info().hp, info().clinks].join());
        const answers = [];
        G.Learning.answerWord = function (pair, right, o) { answers.push([pair && pair[0], right, o && o.recall, o && o.form, (o && o.skills || []).join()]); return answer0.apply(this, arguments); };
        G.StoryScreen.setHint({ key: "story.hint.shield", sec: 8 });
        const hintOn = G.StoryScreen.state.hint;
        const wrong = await shootPlate(false);
        await yield0(); step(2);
        ok("C a plate shot: the scene's line on how (\"Bullets can't get through...\") gone -- its job done", !!hintOn && !G.StoryScreen.state.hint, hintOn + " -> " + G.StoryScreen.state.hint);
        const card = el("hud-xcard");
        ok("C the wrong form shot: the layer stays (three), the plates lit right / wrong, the card says why (the design's reason)", info().shield === 3 && info().misses === 1 && has("somsak:miss") && !!card && !card.classList.contains("hidden") && /adjective|disciplinary/i.test(card.innerText), wrong + " | " + (card && card.innerText.slice(0, 120)));
        const xc = G.ExplainCard.cur, glDy = G.StoryQuiz.glossOf(G.STORY_WORDS.ch1.disciplinary);
        ok("C the card: each form its own meaning (the chapter's gloss of disciplinary / disciplined), not the headword's twice", !!xc && xc.ex.y.word === "disciplinary" && xc.ex.y.meaning === glDy && xc.xs.length >= 1 && xc.xs.every((s) => s.meaning && s.meaning !== glDy) && card.innerText.indexOf(glDy) >= 0, xc ? [xc.ex.y.word + "=" + xc.ex.y.meaning].concat(xc.xs.map((s) => s.word + "=" + s.meaning)).join(" / ") : "no card");
        // (a touch screen: the scene's hint, mid-screen there, steps aside while the plates are up -- to the left, above the stick)
        document.body.classList.add("touch-mode"); G.StoryScreen.setHint({ key: "story.hint.shield", sec: 3 });
        const hr = el("story-hint").getBoundingClientRect();
        ok("C on a touch screen, the plates up: the scene's hint to the left above the stick (never over the crosshair)", document.body.classList.contains("story-plates-on") && hr.width > 0 && hr.right < innerWidth * 0.4 && hr.bottom < innerHeight - 120 && !(hr.top < innerHeight / 2 && hr.bottom > innerHeight / 2 && hr.right > innerWidth / 2), [hr.left, hr.right, hr.top, hr.bottom].map(Math.round).join());
        G.StoryScreen.setHint(null); if (G.Input.mode !== "touch") document.body.classList.remove("touch-mode");
        ok("C the answer counted for discipline (a recall answer, the form asked, the skill: context)", answers.some((a) => a[0] === "discipline" && a[1] === false && a[2] === true && a[3] === "disciplinary" && /context/.test(a[4])), JSON.stringify(answers));
        await until(() => info().qLock <= 0, 300); step(3);
        ok("C the one got wrong comes round again later", P.state.queue.some((q) => q.answer === "disciplinary"), P.state.queue.map((q) => q.answer).join());
        const q1 = info().q && info().q.sentence;
        await shootPlate(true); step(2);
        ok("C the right form shot: a layer gone (two left), \"CORRECT\", counted right", info().shield === 2 && answers.some((a) => a[0] === "discipline" && a[1] === true) && el("story-shield").querySelectorAll(".ss-pips i.on").length === 2, [q1, info().shield].join(" | "));
        // a shotgun's six pellets: one answer
        await ready();
        const rights0 = info().rights, misses0 = info().misses, sg = G.WEAPON_DEFS.shotgun, p = plateAt(true);
        look(p.pos.x, p.pos.y, p.pos.z); step(1);
        for (let i = 0; i < (sg.pellets || 6); i++) fireAt(p.pos, sg);
        step(2);
        ok("C a shotgun's pellets on a plate: one answer", info().rights === rights0 + 1 && info().misses === misses0, [info().rights, info().misses].join());
        // a zombie between: it takes the round
        await ready();
        const p2 = plateAt(true), o = eye();
        const id = "tBlock"; G.StoryScenes.spawn(g, run0(), { id, at: { x: o.x + (p2.pos.x - o.x) * 0.5, y: 0, z: o.z + (p2.pos.z - o.z) * 0.5 }, count: 1, kinds: ["normal"] });
        const blocker = alive().find((q) => q.storyGroup === id);
        if (blocker) { blocker._hold = 1e9; blocker.mesh.position.set(o.x + (p2.pos.x - o.x) * 0.45, 0, o.z + (p2.pos.z - o.z) * 0.45); blocker.mesh.scale.multiplyScalar(1.8); }
        step(2);
        const r1 = info().rights;
        look(p2.pos.x, p2.pos.y, p2.pos.z); step(1); fireAt(p2.pos); step(2);
        ok("C a zombie in front of the plate takes the round: no answer", info().rights === r1 && (!blocker || !blocker.alive || blocker.hp < blocker.maxHp), blocker ? [blocker.alive, f2(blocker.hp)].join() : "no blocker");
        kill();
        G.Learning.answerWord = answer0;
        numbers.answers = answers.length;
        note("C");
      }
      // ================= D: LINE UP! =================
      {
        at(0, 0, 44); kill(); step(2);
        const B = P.state; B.moveI = 0; B.gapT = 0.01;           // (lineup is phase 1's first move)
        step(4);
        ok("D LINE UP!: the whistle raised (his move), its hint", info().st === "lineup" && /LINE UP/.test(el("hud-boss-hint").textContent), info().st + " | " + el("hud-boss-hint").textContent);
        await until(() => info().line, 200);
        const L0 = info().line;
        ok("D six students (phase 1) out from under the trees, to the painted lines", L0 && L0.n === 6 && alive().filter((q) => q.storyGoal).every((q) => q.mesh.position.z > 30 && Math.abs(q.mesh.position.x) > 13), JSON.stringify(L0));
        // one shot before the line is complete
        const early = alive().find((q) => q.storyGoal);
        if (early) g.damageZombie(early, 9999, early.mesh.position.clone(), { dir: null, head: false });
        step(2);
        await until(() => info().line && info().line.released, 900);
        const L1 = info().line, inLine = alive().filter((q) => q.storyGoal && q.storyGoal.at);
        numbers.lineT = f2(L1.t);
        ok("D all five in place on the lines (z 27 / 30) before the line is sent (not its time running out), facing the stage", L1.why === "full" && L1.atSent === 5 && inLine.length >= 3 && inLine.every((q) => (Math.abs(q.mesh.position.z - 27) < 0.8 || Math.abs(q.mesh.position.z - 30) < 0.8) && Math.abs(Math.atan2(Math.sin(q.mesh.rotation.y - q.storyGoal.yaw), Math.cos(q.mesh.rotation.y - q.storyGoal.yaw))) < 0.6), JSON.stringify(L1) + " " + inLine.map((q) => f2(q.mesh.position.x) + "," + f2(q.mesh.position.z)).join(" "));
        ok("D one shot before the line was complete: one fewer in it (5)", L1.alive === 5);
        ok("D one line before the stage, from its middle out (places within 7.5 m of the middle)", alive().filter((q) => q.storyGoal).every((q) => Math.abs(q.storyGoal.x) <= 7.8), alive().filter((q) => q.storyGoal).map((q) => f2(q.storyGoal.x)).join());
        // right up to one: it breaks from the line
        const brk = inLine[0];
        g.teleportPlayer(new THREE.Vector3(brk.mesh.position.x + 1.2, 0, brk.mesh.position.z + 0.6)); step(3);
        ok("D the player right up to one: it breaks from the line (at the player)", !brk.storyGoal, !!brk.storyGoal);
        at(0, 0, 46); step(2);
        await until(() => info().line && info().line.released, 600);
        step(2);
        const sent = alive().filter((q) => q.storyLine && !q.storyGoal).length;
        ok("D the line complete: sent at the player two at a time, running", info().line.released && sent >= 2 && alive().filter((q) => q.storyLine && !q.storyGoal).some((q) => q.speedMultiplier >= 1.5), [sent, info().line.out].join());
        kill(); step(3);
        note("D");
      }
      // ================= E: the podium =================
      {
        const B = P.state; B.gapT = 99;
        await until(() => info().st === "walk", 300);
        at(zp().x + 6, 0, zp().z + 4); g.player.hp = g.player.maxHp; god = false;
        B.moveI = 1; B.gapT = 0.01; step(3);
        await until(() => info().pod, 100);
        const pod0 = info().pod;
        ok("E the podium lifted, a red circle (2.4 m) where the player stands", info().st === "podium" && pod0 && Math.hypot(pod0.at.x - me().x, pod0.at.z - me().z) < 0.4 && pod0.r === 2.4, JSON.stringify(pod0));
        const hp0 = g.player.hp;
        await until(() => info().pod && info().pod.landed, 200);
        const hurt = hp0 - g.player.hp;
        ok("E stood in it as it landed: hurt (30% of full), never killed from full health", hurt > 120 && hurt < 140 && g.player.hp > 1, f2(hurt));
        g.player.hp = g.player.maxHp;
        await until(() => info().st === "walk", 300);
        B.moveI = 1; B.gapT = 0.01; step(3); await until(() => info().pod, 100);
        const c = info().pod.at; at(c.x + 4, 0, c.z); const hp1 = g.player.hp;
        await until(() => info().pod && info().pod.landed, 200);
        ok("E out of the circle when it lands: not hurt", g.player.hp === hp1, f2(hp1 - g.player.hp));
        god = true;
        note("E");
      }
      // ================= F: the shield down =================
      {
        const B = P.state; await until(() => info().st === "walk", 300); B.gapT = 99;
        faceOff();
        await breakShield();
        step(30);
        const z = P.z, u = z.mesh.userData;
        ok("F three right: the shield down -- on his knees, bowed, his patches lit, their mark on his nape (seen through his head)", info().st === "open" && info().opens === 1 && u.patch && u.patch.lit && P.state.mark.visible && P.state.mark.material.depthTest === false && u.upper.rotation.x > 0.3 && u.limbs.legL.hip.rotation.x > 1.2, [info().st, u.patch && u.patch.lit, f2(u.upper.rotation.x), f2(u.limbs.legL.hip.rotation.x)].join());
        ok("F the bar says so (vulnerable); the glasses' line; the plates and the shield's line gone", el("hud-boss-bar").classList.contains("vuln") && hid("story-shield") && P.plateInfo().every((p) => !p.visible));
        const h0 = info().hp;
        headShot(); const dHead = h0 - info().hp;
        g.damageZombie(z, 28, z.mesh.position.clone().setY(1.0), { dir: new THREE.Vector3(0, 0, 1), head: false }); step(2);
        const dBody = h0 - dHead - info().hp;
        ok("F the patches (a head shot) take its full damage; anywhere else a third of it", dHead === 28 && Math.abs(dBody - 28 * 0.35) < 0.01, [dHead, f2(dBody)].join());
        await until(() => info().st !== "open", 700);
        ok("F eight seconds on: the shield back (three layers, the next questions), on his feet", info().st === "walk" && info().shield === 3 && info().cycle === 1 && !!info().q && !el("hud-boss-bar").classList.contains("vuln"), [info().st, info().shield, info().cycle].join());
        numbers.openHp = f2(info().pct);
        note("F");
      }
      // ================= G: phase 2, the megaphone =================
      {
        const B = P.state; B.gapT = 99;
        faceOff();
        await breakShield();
        const before = (S.data("ch1").cp || null);
        toPhaseEnd();
        ok("G a window never takes him past the half: phase 2 at exactly 50%", info().phase === 2 && info().pct === 50 && info().st === "phase", [info().phase, info().pct, info().st].join());
        const cp = S.data("ch1").cp;
        ok("G its save: phase 2's flag, its beat the fight's first (picked up there, the fight starts again)", !before && cp && cp.scene === 7 && cp.beat === info().beat && cp.flags.includes("somsak:p2") && Math.abs(cp.x - 13) < 0.1, cp && JSON.stringify({ beat: cp.beat, fb: info().beat, x: cp.x }));
        numbers.cp = JSON.parse(JSON.stringify(cp));
        ok("G its boxes on the yard (ammo, health)", (g.drops || []).filter((d) => d.mesh && d.mesh.position.z > 15).length >= 3);
        await until(() => info().st === "walk", 300);
        kill(); step(2);
        // the megaphone: in its cone, in the open
        at(zp().x + 0.5, 0, zp().z + 7);
        G.StoryScenes.spawn(g, run0(), { id: "tLab", at: [{ x: zp().x + 3, y: 0, z: zp().z + 9 }, { x: zp().x - 3, y: 0, z: zp().z + 10 }], count: 2, kinds: ["normal"] });
        const labs = alive().filter((q) => q.storyGroup === "tLab"); labs.forEach((q) => { q._hold = 1e9; });
        const words0 = labs.map((q) => q.labelText);
        B.moveI = 0; B.gapT = 0.01; step(3);                 // (phase 2's first: the megaphone)
        ok("G phase 2's moves: the megaphone -- a breath, its bell lit, the cone on the ground", info().st === "mega" && !!P.state.cone && P.state.cone.on, info().st);
        const hp0 = g.player.hp, z0 = me().z;
        await until(() => info().coneHits >= 1 || (info().cone && info().cone.inside !== undefined && P.state.blasted), 200);
        step(2);
        ok("G in its cone, nothing between: thrown back, hurt a little", info().cone && info().cone.clear && me().z - z0 > 1.5 && hp0 - g.player.hp > 20 && hp0 - g.player.hp < 50, [JSON.stringify(info().cone), f2(me().z - z0), f2(hp0 - g.player.hp)].join(" "));
        const swapped = labs.map((q) => q.labelText);
        ok("G ...and every word label's letters swapped (the same letters), two seconds", labs.length === 2 && labs.every((q, i) => q.labelText !== words0[i] && q.labelText.split("").sort().join() === words0[i].split("").sort().join()), words0.join() + " -> " + swapped.join());
        ok("G \"DIS--CI--PLINE!\" (phase 2): its caption, his voice once", (el("story-whisper") ? /DIS/.test(el("story-whisper").innerText) : true) && spoke.some((s) => /Dis\. Ci\. Pline/.test(s[0])));
        await until(() => !info().scramble, 200);
        ok("G two seconds on: the labels as they were", labs.every((q, i) => q.labelText === words0[i]), labs.map((q) => q.labelText).join());
        // behind a post of the covered walkway: nothing
        await until(() => info().st === "walk", 300); B.gapT = 99;
        const post = { x: -28.5, z: 24.5 };                  // (a post of the west walkway: the block at x -29..-28, z 24..25)
        P.z.mesh.position.set(post.x + 8.5, 0, post.z); P.z.navPath = null; P.z._hold = 1e9;
        at(post.x - 1.1, 0, post.z); step(2);
        const hp2 = g.player.hp, x0 = me().x, sc0 = info().scrambled;
        B.moveI = 0; B.gapT = 0.01; step(3);
        await until(() => P.state.blasted, 200); step(2);
        ok("G behind a post (the walkway's): the sound misses -- not thrown, not hurt, nothing swapped", info().cone && info().cone.inside && !info().cone.clear && Math.abs(me().x - x0) < 0.3 && g.player.hp === hp2 && info().scrambled === sc0, JSON.stringify(info().cone));
        // Accessibility off: thrown back, nothing swapped
        await until(() => info().st === "walk", 300); B.gapT = 99;
        G.save.settings.storyScramble = false;
        at(zp().x + 0.5, 0, zp().z + 6); step(2);
        const sc1 = info().scrambled; labs.forEach((q) => { if (q.alive) q.mesh.position.set(zp().x + 2, 0, zp().z + 8); });
        B.moveI = 0; B.gapT = 0.01; step(3); await until(() => P.state.blasted, 200); step(2);
        ok("G Settings > Accessibility \"Letter swap\" off: thrown back, the letters left alone", info().cone && info().cone.clear && info().scrambled === sc1 && labs.every((q, i) => q.labelText === words0[i]));
        G.save.settings.storyScramble = true;
        kill();
        note("G");
      }
      // ================= H: phase 3 =================
      {
        await until(() => info().st === "walk", 300); const B = P.state; B.gapT = 99;
        const missedWord = (run0().pool || []).find((p) => G.Clues.has(p, "cloze") && (G.Clues.familyDecoys(p, G.Clues.cloze(p).answer) || []).length >= 2 && G.wordKey(p) !== "discipline");
        if (missedWord) { const cw = S.data("ch1").curWords; cw[G.wordKey(missedWord)] = [2, 1, 3, 0]; }
        faceOff();
        await breakShield();
        toPhaseEnd();
        ok("G-H phase 3 at exactly 25%: its flag, the save again", info().phase === 3 && info().pct === 25 && has("somsak:p3") && S.data("ch1").cp.flags.includes("somsak:p3"), [info().phase, info().pct].join());
        await until(() => info().st === "walk", 400);
        const scr = alive().filter((z) => z.type === "screamer");
        ok("H two Screamers out of the entrance hall's doors", scr.length === 2 && scr.every((z) => Math.hypot(z.mesh.position.x - 4.5, z.mesh.position.z - 10.8) < 4), scr.map((z) => f2(z.mesh.position.x) + "," + f2(z.mesh.position.z)).join(" "));
        ok("H quicker: his pace, his gaps", P.z.speed === G.CONFIG.story.principal.speedP3 && G.CONFIG.story.principal.gap[2] < G.CONFIG.story.principal.gap[0]);
        const qq = P.state.queue.concat(P.state.q ? [P.state.q] : []);
        ok("H a later shield: the design's sentences (shuffled) and a chapter word got wrong this play-through among them (its own forms)", qq.some((q) => q.design) && (!missedWord || qq.some((q) => !q.design && q.pair && G.wordKey(q.pair) === G.wordKey(missedWord) && q.options.length === 3)), qq.map((q) => (q.design ? "d:" : "m:") + q.answer).join() + " / " + (missedWord && missedWord[0]));
        kill();
        note("H");
      }
      // ================= I: down =================
      {
        const B = P.state; B.gapT = 99;
        faceOff();
        // (whatever the shield asks now, the right plate each time)
        await breakShield();
        toPhaseEnd();
        step(2);
        ok("I his last: down (the flag), his bar and the shield's line gone; not one of the field's deaths (no answer counted, no blocks)", has("boss:somsak") && hid("hud-boss-bar") && !alive().includes(P.z) && !(g.dying || []).some((d) => d.z === P.z || d.zombie === P.z));
        kill();
        await until(() => P.body && P.body.megaDown, 200);
        ok("I on his knees; the megaphone out of his hand, on the ground", P.body.megaDown && P.body.mega && P.body.mega.parent === g.scene && P.body.mega.position.y < 0.5);
        await until(() => heard.includes("story.ch1.d.somsakSpeech"), 300);
        const sp = spoke.find((s) => /Good morning, students/.test(s[0]));
        ok("I its recorded speech: \"Good morning, students. Today... we make history.\" -- read aloud, his own voice, the megaphone its speaker", !!sp && sp[2] === 0.7 && D.current && D.current.who === "megaphone" && /Megaphone/.test(el("sd-who").textContent), JSON.stringify(sp));
        await until(() => P.info() && P.info().lying, 900);
        ok("I then he lies down, quiet", P.info().lying && Math.abs(P.body.mesh.rotation.z - (P.body.mesh.userData.baseLean || 0)) > 1.3);
        ok("I his whistle there to take", USE.has("whistle"));
        const bm = P.body.mesh.position;
        at(bm.x + 1.3, 0, bm.z); const pw = useAt(bm.x, 0.35, bm.z); await yield0(); step(2);
        ok("I \"E: Take the principal's whistle\" -- its card (the boss's reward)", /whistle/i.test(pw) && has("found:whistle") && G.Dialog.isOpen() && /principal's whistle/i.test(el("dialog-box").innerText), pw);
        G.Dialog.choose(0); step(2);
        await held(() => has("found:email"), 1200); await yield0(); step(2);
        const box = el("dialog-box").innerText;
        ok("I his phone, kept at once: the email -- the trial, the update at 08:30 on exam day, side effects \"temporary\", City Hospital", has("found:email") && G.Dialog.isOpen() && /v2\.1 trial/.test(box) && /08:30/.test(box) && /temporary/.test(box) && /City Hospital/.test(box), box.slice(0, 200));
        ok("I in it \"temporary\" is the bank's word (tap for its card); trial and side effect practice (their meanings drafted)", !!document.querySelector('#dialog-box .sd-word[data-id="temporary"]') && ["trial", "side effect"].every((w) => G.STORY_WORDS.ch1[w] && ["th", "zh", "fr", "en"].every((l) => G.STORY_WORDS.ch1[w][l])));
        G.Dialog.choose(0); step(2);
        await until(() => heard.includes("story.ch1.d.minTemporary"), 400);
        ok("I Kru Min: a trial, on exam day; \"temporary side effects\"", heard.includes("story.ch1.d.minTrial") && heard.includes("story.ch1.d.minTemporary"));
        await held(() => run0().scene.id === "s8", 2400);
        const d = S.data("ch1");
        ok("I the save; 1-8 \"PROTECT\" next -- the email and the whistle among the chapter's collectibles", run0().scene.id === "s8" && d.cp && d.cp.scene === 8 && d.collected.includes("email") && d.collected.includes("whistle"), d.collected.join());
        note("I");
      }
      // ================= J: a save mid-fight =================
      {
        const cp0 = Object.assign({}, numbers.cp);
        S.data("ch1").cp = JSON.parse(JSON.stringify(numbers.cp));          // (that save the chapter's: Continue would pick it up)
        play(() => S.start("ch1", cp0));
        step(4);
        ok("J the phase-2 save picked up: the fight from its start beat, phase 2, half his health, the shield up", run0().scene.id === "s7" && P.active && info().phase === 2 && info().pct === 50 && info().shield === 3 && Math.hypot(me().x - 13, me().z - 15) < 0.5, JSON.stringify({ ph: info().phase, pct: info().pct }));
        ok("J full health, the guns kept", g.player.hp === g.player.maxHp && g.player.gunSlots.includes("pistol"));
        god = false; g.player.hp = 0; g.checkPlayerDeath(); step(2); god = true;
        ok("J down in the fight: \"Retry from checkpoint\" -- back to that save", G.Dialog.isOpen() && /Retry from checkpoint/i.test(el("dialog-box").innerText));
        play(() => G.Dialog.choose(1)); step(4);
        ok("J ...phase 2 again", run0().scene.id === "s7" && P.active && info().phase === 2 && info().pct === 50, run0().scene.id + " " + JSON.stringify({ a: P.active, ph: info().phase, pct: info().pct, beat: run0().beatI }));
        note("J");
      }
      // ================= K: 1-8, Sgt. Chai =================
      {
        const cpS8 = { scene: 8, beat: 0, flags: ["found:email", "found:whistle"], guns: ["pistol", "shotgun"], ammo: { pistol: [12, 48] } };
        play(() => S.start("ch1", cpS8));
        step(4);
        const r = run0(), chai = CAST.get("chai");
        ok("K 1-8's start: dusk, 18:15, on the yard's south side; Kru Min following", r.scene.id === "s8" && r.scene.clock === "18:15" && G.StoryLight.current === "dusk" && CAST.get("min").follow);
        const hiding = ["fai", "tonkla", "nam", "sv1", "sv2", "sv3", "sv4"].map((i) => CAST.get(i));
        ok("K the others behind the guard's booth, low: Fai, Tonkla, Nam and four who heard the announcement (no LEXA patch)", hiding.every((n) => n && n.pose === "crouch" && n.pos.x < 22.5 && n.pos.z > 51.5 && n.pos.z < 57) && ["sv1", "sv2", "sv3", "sv4"].every((i) => !G.VoxelChars.DEFS[i].patch));
        ok("K Sgt. Chai at the gate: an Ironclad's eyes, his police vest, PROTECT over him", !!chai && chai.zombie === "ironclad" && chai.labelWord === "PROTECT" && Math.hypot(chai.pos.x - 29.5, chai.pos.z - 57.6) < 0.3 && chai.model.getObjectByProperty("visible", true) != null);
        ok("K Beam not there yet", CAST.get("beam") && !CAST.get("beam").model.visible);
        at(19, 0, 47.5);
        await until(() => heard.includes("story.ch1.d.faiGate"), 200);
        ok("K by the booth: Fai waves you over, Kru Min sees who it is", CAST.get("fai").pose === "wave" && heard.includes("story.ch1.d.faiGate"));
        await held(() => heard.includes("story.ch1.d.minChai") && !D.busy(), 900); step(3);
        ok("K the hint: he goes for anyone who comes near", /comes near/.test((el("story-hint") || {}).innerText || "") || run0().beatI >= 3);
        const hp0 = g.player.hp;
        at(27.4, 0, 50.2);
        await until(() => Q.active, 200);
        ok("K near him (8.5 m): he comes; the world slowed; FINAL QUESTION, no clock", Q.active && CAST.get("chai").lunge && g._slowmoT > 0);
        ok("K the word box: the meaning (protect's, in the player's meaning language), \"Final question\"", S.idleMeaning() === G.StoryQuiz.glossOf(G.STORY_WORDS.ch1.protect) && S.idleLabel() === "Final question", S.idleMeaning() + " | " + S.idleLabel());
        const qs = Q.state, cpos = CAST.get("chai").pos;
        ok("K its three answers round him: protect, project, predict -- within 1.4 m of him, at his chest", qs.opts.length === 3 && ["protect", "project", "predict"].every((w) => qs.opts.some((o) => o.w === w)) && qs.opts.every((o) => Math.hypot(o.s.position.x - cpos.x, o.s.position.z - cpos.z) < 1.5 && o.s.position.y > 1.3 && o.s.position.y < 2.2));
        await until(() => false, 300);
        ok("K five seconds on: still asked, he has stopped short (3.4 m), nobody hurt", Q.active && Math.hypot(CAST.get("chai").pos.x - me().x, CAST.get("chai").pos.z - me().z) > 3.2 && g.player.hp === hp0, f2(Math.hypot(CAST.get("chai").pos.x - me().x, CAST.get("chai").pos.z - me().z)));
        const answers = [];
        G.Learning.answerWord = function (pair, right, o) { answers.push(pair && pair[0]); return answer0.apply(this, arguments); };
        const pick = (right) => { const it = qs.items[qs.i], k = right ? it.answer : (it.answer + 1) % it.options.length, o = qs.opts.find((x) => x.k === k); look(o.s.position.x, o.s.position.y, o.s.position.z); step(2); G.Input.mouseDown = true; step(1); G.Input.mouseDown = false; step(1); return o.w; };
        const wrongW = pick(false);
        step(2);
        ok("K the wrong one (the trigger, aimed): the card -- and the same question again, its answers in another order", Q.state && Q.state.again && !has("quiz:final") && !el("hud-xcard").classList.contains("hidden"), wrongW);
        await until(() => Q.state && Q.state.wait <= 0 && !Q.state.again, 400); step(25);
        ok("K ...asked again", Q.active && Q.state.i === 0);
        const rightW = pick(true);
        await until(() => has("quiz:final"), 300);
        ok("K the right one: protect -- practice (counted nowhere)", rightW === "protect" && has("quiz:final") && !answers.includes("protect"), answers.join());
        G.Learning.answerWord = answer0;
        step(3);
        const c2 = CAST.get("chai");
        ok("K he stops; PROTECT gone; his eyes dark", !c2.lunge && !c2.label && (() => { let any = false; c2.model.traverse((o) => { if (o.isMesh && o.material === (G.ZOMBIE_MATS && G.ZOMBIE_MATS.basic) && o.visible) any = true; }); return !any; })());
        await held(() => CAST.arrived("chai"), 900); step(4);
        ok("K back to the gate, sat against it, at peace (no blood: nothing was shot)", c2.pose === "sitWall" && Math.hypot(c2.pos.x - 27.2, c2.pos.z - 58.3) < 0.4 && g._slowmoT <= 0.01);
        await held(() => CAST.arrived("min"), 900); step(4);
        ok("K Kru Min goes to him, kneels: \"Thank you, Sergeant.\"", CAST.get("min").pose === "kneel" && (heard.includes("story.ch1.d.minThanks") || (await until(() => heard.includes("story.ch1.d.minThanks"), 200))));
        await held(() => has("found:badge"), 900); await yield0(); step(2);
        ok("K his badge, kept at once (its card)", has("found:badge") && G.Dialog.isOpen() && /police badge/i.test(el("dialog-box").innerText));
        G.Dialog.choose(0); step(2);
        note("K");
      }
      // ================= L: the van, Beam =================
      {
        await until(() => heard.includes("story.ch1.d.radioHospital"), 300);
        ok("L the van's radio: City Hospital, NeuroLex declines to comment; Kru Min: that's where they ran the trials", heard.includes("story.ch1.d.radioHospital") && sounds.includes("static") && (await until(() => heard.includes("story.ch1.d.minHospital"), 400)));
        await held(() => !D.busy(), 900);
        await until(() => ["fai", "tonkla", "nam", "sv1", "sv2", "sv3", "sv4"].every((i) => CAST.get(i).hidden), 900);
        ok("L the others walk to the van and get in", ["fai", "tonkla", "nam", "sv1", "sv2", "sv3", "sv4"].every((i) => CAST.get(i).hidden));
        at(21.6, 0, 50.0);
        const pv = useAt(19.5, 1.0, 50);
        ok("L \"E: Get into the van\"", /Get into the van/.test(pv), pv);
        await until(() => CAM.riding, 300);
        ok("L the ride: seated (the eyes lower), carried along the road, the view kept on Beam -- at the field's fence, TOGETHER flickering", CAM.riding && CAST.get("beam").model.visible && CAST.get("beam").flicker && CAST.get("beam").labelWord === "TOGETHER" && sounds.includes("engine"));
        const z0 = me().z;
        await until(() => CAM.drop > 0.4, 200);
        step(30);
        const b = CAST.get("beam").pos, fwd = new THREE.Vector3(); g.camera.getWorldDirection(fwd);
        const toB = new THREE.Vector3(b.x - me().x, 0, b.z - me().z).normalize(); fwd.y = 0; fwd.normalize();
        const left = fwd.x * toB.z - fwd.z * toB.x;         // (the view a little to his right: the choice comes up over the middle)
        ok("L ...moving (along z), Beam in view left of the middle (the choice's window will be over the middle), the eyes 0.45 lower", me().z > z0 && fwd.dot(toB) > Math.cos(0.85) && fwd.dot(toB) < Math.cos(0.15) && left < 0 && CAM.drop > 0.4, [f2(me().z - z0), f2(fwd.dot(toB)), f2(left), f2(CAM.drop)].join());
        await until(() => !CAM.riding, 900);
        await until(() => document.querySelector(".story-choice"), 300);
        ok("L the last choice: \"I'll come back for you, Beam.\" or say nothing", /come back for you, Beam/.test(el("dialog-box").innerText) && /Say nothing/.test(el("dialog-box").innerText));
        btn(/come back for you/); step(3);
        ok("L ...kept for later chapters (the chapter's save, the flag); said as the player's line", S.data("ch1").choices.beam === "promise" && has("chose:beam:promise") && heard.includes("story.ch1.c.beamPromise"));
        await until(() => heard.includes("story.ch1.d.minLast"), 600);
        ok("L Kru Min's last line: every shortcut has a consequence; the closing music", heard.includes("story.ch1.d.minLast") && sounds.includes("ending"));
        note("L");
      }
      // ================= M: the final test =================
      {
        // (the play-through's record: a chapter word missed most, so it is asked first)
        const cw = S.data("ch1").curWords;
        const pool = run0().pool, most = pool.find((p) => G.wordKey(p) === "verify") || pool[3];
        cw[G.wordKey(most)] = [2, 1, 9, 1];
        const answers = [];
        G.Learning.answerWord = function (pair, right, o) { answers.push([pair && pair[0], right]); return answer0.apply(this, arguments); };
        await held(() => G.Quiz.active, 2400);
        ok("M the end: the title, black -- then the final test in the end-of-wave quiz's window", sounds.includes("quiet") && G.Quiz.active && G.Modal.isOpen("quiz") && /Chapter 1 · Final test/.test(el("quiz-kicker").textContent));
        ok("M nothing to lose: no mistakes counter in its window", getComputedStyle(el("quiz-mistakes")).display === "none" && el("screen-quiz").classList.contains("quiz-nofail"));
        ok("M six questions on the chapter's words, the one missed most first", G.Quiz.qs.length === 6 && G.Quiz.qs.every((q) => pool.some((p) => G.wordKey(p) === G.wordKey(q.pair))) && G.wordKey(G.Quiz.qs[0].pair) === G.wordKey(most), G.Quiz.qs.map((q) => q.pair[0] + ":" + q.type).join());
        let i = 0;
        for (let n = 0; n < 60 && G.Quiz.active; n++) {
          if (G.Quiz.stage === "question") { G.Quiz.answerAs(i % 2 === 0 ? false : true); i++; }
          else if (G.Quiz.stage === "feedback") G.Quiz.next();
          else if (G.Quiz.stage === "result") break;
          await yield0();
        }
        ok("M three wrong of six: still \"Final test: 3/6\" -- nothing lost (no fail)", G.Quiz.stage === "result" && /Final test: 3\/6/.test(el("quiz-verdict").textContent) && !el("quiz-result").classList.contains("fail"), el("quiz-verdict").textContent);
        ok("M every answer counted in its box", answers.length === 6, JSON.stringify(answers));
        G.Learning.answerWord = answer0;
        G.Quiz.close(); step(2);
        note("M");
      }
      // ================= N: the summary =================
      {
        const box = el("story-summary-box");
        ok("N the summary: its window (paused), the chapter's name, complete", SUM.open && G.Modal.isOpen("story-summary") && G.Modal.pausesAll() && box && !box.classList.contains("hidden") && /Escape the School/.test(box.innerText) && /Chapter complete/.test(box.innerText));
        const d = S.data("ch1"), si = SUM.info();
        ok("N its figures: the time (m:ss), the accuracy, the final test 3 / 6", /\d+:\d\d/.test(box.querySelector(".ssum-stat b").textContent) && /%/.test(box.innerText) && /3 \/ 6/.test(box.innerText) && si.test && si.test.correct === 3, box.querySelector(".ssum-stats").innerText.replace(/\n/g, " "));
        const w = SUM.words(d);
        ok("N new words and words that got stronger: from the play-through's record (tap one: its card)", /New words \(\d+\)/.test(box.innerText) && /got stronger \(\d+\)/.test(box.innerText) && box.querySelectorAll(".ssum-word").length === Math.min(18, w.fresh.length) + Math.min(18, w.stronger.length), [w.fresh.length, w.stronger.length].join());
        const items = box.querySelectorAll(".ssum-item");
        ok("N collectibles: n / 14, the ones found this time lit (the badge), the whistle beside them", /Collectibles: \d+ \/ 14/.test(box.innerText) && items.length === 15 && box.querySelector(".ssum-item.got") && box.querySelector(".ssum-item.extra"), box.querySelector(".ssum-sec:nth-of-type(3)") ? "" : "");
        const next = box.querySelector(".ssum-next");
        ok("N \"Chapter 2: City Hospital — coming soon\" (off); the Main Menu", next && next.disabled && /City Hospital/.test(next.textContent) && !!box.querySelector(".ssum-menu"));
        ok("N the chapter done, its checkpoint cleared, a best time kept", d.done && !d.cp && d.best > 0);
        const chip = box.querySelector(".ssum-word");
        if (chip) { chip.click(); step(1); }
        ok("N a word tapped: its card (the mini card over the summary)", !chip || (G.Modal.isOpen("wordpeek") && !el("word-peek").classList.contains("hidden")));
        if (G.VocabCard && G.VocabCard.closePeek) G.VocabCard.closePeek();
        G.Modal.handleKey({ code: "Enter", repeat: false, preventDefault() {}, stopPropagation() {} });
        await until(() => g.state === "MENU" || !g.state || G.Story.run === null, 120);
        ok("N Enter: the Main Menu (the run over, the window gone)", !SUM.open && !G.Modal.isOpen("story-summary") && !G.Story.run);
        note("N");
      }
      // ================= O: around it =================
      {
        // the save's play-through words
        const N = G.normalizeStory({ ch: { ch1: { curWords: { verify: [2, 3, 1, 4], "bad key!": [1, 1, 1, 1], temporary: [0, 1, 0, 2], x: [1, 2], y: "z" } } } }).ch.ch1.curWords;
        ok("O the save: a chapter's play-through words kept ([box first met, box now, wrong, right]); anything else dropped", N.verify && N.verify.join() === "2,3,1,4" && N.temporary && !N["bad key!"] && !N.x && !N.y, JSON.stringify(N));
        const old = G.normalizeStory({ ch: { ch1: { started: true, curTime: 5 } } }).ch.ch1;
        ok("O an older save (no such field): an empty record, nothing else changed", old.curWords && !Object.keys(old.curWords).length && old.curTime === 5);
        const big = {}; for (let i = 0; i < 450; i++) big["w" + i] = [1, 1, 0, 1];
        ok("O at most 400 words kept", Object.keys(G.normalizeStory({ ch: { ch1: { curWords: big } } }).ch.ch1.curWords).length === 400);
        const fx = await (await fetch("/tests/fixtures/save-v-expansion9.json?r=" + Date.now())).json().catch(() => null);
        ok("O the fixture save of the current format loads (no story part: none made)", !fx || (() => { const s = G.normalizeSave(fx); return s.story && s.story.ch && !s.story.ch.ch1; })());
        if (G.SaveFile && G.SaveFile.merge) {
          const a = JSON.parse(JSON.stringify(G.save)), b2 = JSON.parse(JSON.stringify(G.save));
          a.story = { ch: { ch1: { started: true, cp: { scene: 7, beat: 4, at: 200 }, curWords: { verify: [1, 2, 0, 1] } } } };
          b2.story = { ch: { ch1: { started: true, cp: { scene: 3, beat: 0, at: 300 }, curWords: { assess: [0, 1, 0, 1] } } } };
          const m = G.SaveFile.merge(a, b2, {});
          ok("O two devices merged: the play-through under way (the further checkpoint) keeps its words", m.story.ch.ch1.curWords && m.story.ch.ch1.curWords.verify && !m.story.ch.ch1.curWords.assess, JSON.stringify(m.story.ch.ch1.curWords));
        } else ok("O two devices merged (SaveFile.merge)", false, "no merge");
        // collectibles: the list, the flags on earlier scenes' pickups
        const list = G.STORY_CHAPTERS.ch1.collectibles;
        ok("O the chapter's fourteen collectibles (5 evidence, 5 memories, 4 golden words) and the whistle beside them", list.filter((c) => !c.extra).length === 14 && list.filter((c) => c.kind === "evidence").length === 5 && list.filter((c) => c.kind === "memory").length === 5 && list.filter((c) => c.kind === "golden").length === 4 && list.some((c) => c.id === "whistle" && c.extra));
        const flagsIn = JSON.stringify(G.STORY_CHAPTERS.ch1.scenes);
        ok("O those already in the chapter are found by their flags: the note, the photo (1-1), the notebook (1-3), the logbook (1-4), the stopwatch, the contract, the email, the badge", ["found:note", "found:photo", "found:notebook", "found:logbook", "found:stopwatch", "found:contract", "found:email", "found:badge"].every((f) => flagsIn.includes(f)));
        // the setting
        G.SettingsUI.render();
        const row = document.querySelector('[data-row="set-storyscramble"]');
        ok("O Settings > Accessibility: \"Letter swap (Story Mode)\", on by default (shown while Story Mode is on)", !!row && G.defaultSave().settings.storyScramble === true, row ? row.innerText.slice(0, 60) : "none");
        // words
        ok("O protect, project, predict: meanings in the four meaning languages (practice); discipline the bank's", ["protect", "project", "predict"].every((w) => { const q = G.STORY_WORDS.ch1[w]; return q && ["th", "zh", "fr", "en"].every((l) => q[l]); }) && !!G.WordBank.byId("discipline"));
        ok("O the four who made it to the gate have looks of their own (41 in all)", G.VoxelChars.ORDER.length === 41 && G.VoxelChars.GENERIC.survivors.length === 4);
        // strings
        const keys = [];
        const collect = (o) => { if (typeof o === "string") { if (/^(story|settings)\./.test(o)) keys.push(o); } else if (Array.isArray(o)) o.forEach(collect); else if (o && typeof o === "object") Object.values(o).forEach(collect); };
        collect(G.STORY_CHAPTERS.ch1.scenes[7]); collect(G.STORY_CHAPTERS.ch1.scenes[8]);
        ["story.boss2.layers", "story.boss2.label", "story.boss2.hint.lineup", "story.boss2.hint.charge", "story.boss2.hint.podium", "story.boss2.hint.mega", "story.boss2.hint.cover", "story.boss2.hint.covered", "story.boss2.hint.open", "story.boss2.hint.patch",
          "story.boss2.hint.shield", "story.boss2.hint.screamers", "story.ch1.sys.patches", "story.ch1.sys.phase2", "story.ch1.sys.phase3", "story.ch1.sys.screamers", "story.ch1.d.somsakLine", "story.ch1.d.somsakDis", "story.who.megaphone",
          "story.final.kicker", "story.final.verdict", "story.final.sub", "story.final.review", "story.sum.done", "story.sum.time", "story.sum.acc", "story.sum.test", "story.sum.new", "story.sum.noNew", "story.sum.stronger", "story.sum.noStronger",
          "story.sum.more", "story.sum.items", "story.sum.itemsNote", "story.sum.notFound", "story.sum.next", "story.sum.nextSoon", "settings.storyScramble", "settings.storyScrambleDesc"].forEach((k) => keys.push(k));
        G.STORY_CHAPTERS.ch1.collectibles.forEach((c) => keys.push("story.item." + c.id));
        const uniq = Array.from(new Set(keys)), miss = uniq.filter((k) => G.STRINGS.en[k] == null);
        for (const l of ["th", "zh", "fr"]) { const t = await (await fetch("/js/strings-" + l + ".js?r=" + Date.now())).text(); uniq.forEach((k) => { if (!t.includes('"' + k + '":')) miss.push(l + ":" + k); }); }
        ok("O its lines, hints and windows in the four languages (" + uniq.length + " keys)", !miss.length && uniq.length > 100, miss.join());
        ok("O the summary's and the shield's styles for a short screen", Array.from(document.styleSheets).some((s) => { try { return Array.from(s.cssRules).some((r) => r.conditionText && /max-height: 460px/.test(r.conditionText) && Array.from(r.cssRules).some((q) => /\.story-summary/.test(q.selectorText || ""))); } catch (e) { return false; } }));
        // draw calls on Low: the fight with its line, the gate, the ride
        const draws = () => { step(4); g.renderFrame(); return g.renderer.info.render.calls; };
        const calls = {};
        play(() => S.start("ch1", { scene: 7, beat: 4, flags: [], x: 13, y: 0, z: 15, yaw: 2, guns: ["pistol"], ammo: {} }));
        step(4); P.state.gapT = 99;
        at(4, 0, 34); look(-1, 1.5, 20);
        G.StoryScenes.spawn(g, run0(), { id: "dc", at: [-9, -6, -3, 0, 3, 6, 9].map((x) => ({ x, y: 0, z: 27 })), count: 7, kinds: ["normal"] });
        alive().forEach((q) => { if (!q.principal) q._hold = 1e9; });
        calls.fight = draws();
        at(-3, 0, 12); look(4, 1.5, 30); calls.yardFromStage = draws();
        play(() => S.start("ch1", { scene: 8, beat: 0, flags: [], guns: ["pistol"], ammo: {} }));
        at(20, 0, 46); look(25, 1, 56); calls.gate = draws();
        at(28.6, 0, 50); look(37.3, 1.5, 53.6); CAST.act(g, run0(), { id: "beam", show: true }); calls.ride = draws();
        numbers.calls = calls;
        ok("O draw calls on Low under 150 (the fight with seven on the lines -- never more standing beside him: maxAlive 8 --, the yard, the gate, the ride)", Object.values(calls).every((c) => c < 150), JSON.stringify(calls));
        g.update = real; g.quitToMainMenu(); g.update = () => {}; G.Modal.reset();
        play(() => g.startLevel(1));
        ok("O the campaign after it: no boss bar, no shield's line, no plates, no summary", hid("hud-boss-bar") && !el("story-shield") && !P.active && !SUM.open && !G.Story.run);
        g.update = real; g.quitToMainMenu(); g.update = () => {}; G.Modal.reset();
        numbers.frames = frames;
        numbers.realSec = Math.round((performance.now() - t0) / 1000);
      }
      D.say = say0;
      ok("no missing strings", !Object.keys(G._missingKeys || {}).length, Object.keys(G._missingKeys || {}).join());
    } catch (e) {
      ok("no exception", false, e.message + " " + (e.stack || "").split("\n").slice(0, 3).join(" | ") + " | trace " + trace.join(" "));
    } finally {
      D.say = say0; SCR.sound = sound0; G.Learning.answerWord = answer0;
      G.CONFIG.story.enabled = enabled0;
      G.Input.keys[kb.jump] = false; G.Input.keys[kb.interact] = false; G.Input.mouseDown = false;
      G.Input.mode = mode0;
      G.Audio.speak = speak0;
      g.update = real;
      G.Input.requestPointerLock = lock0;
      if (G.Quiz.active) { G.Quiz.reset(); G.UI.showScreen(null); }
      if (SUM.open) SUM.close();
      if (G.Dialog.isOpen()) G.Dialog.close();
      G.Modal.reset();
      try { if (g.state !== "MENU") g.quitToMainMenu(); } catch (e) { /* (already out) */ }
      G.save = JSON.parse(backup);
      G.persist(true);
      window.removeEventListener("error", onErr);
      window.removeEventListener("unhandledrejection", onErr);
    }
    ok("no errors in the page", !errs.length, errs.slice(0, 3).join(" | "));
    const fail = results.filter((r) => !r.pass);
    return { total: results.length, pass: results.length - fail.length, fail, results, numbers, trace };
  }
  return { run };
})();
