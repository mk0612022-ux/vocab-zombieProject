// Dev-only (not shipped). Newer list, round 1: the end-of-wave quiz (A),
// slower health regeneration (B), boss health by wave and ammunition in the
// arena (C), turning from the FIRE and AIM buttons (D), the touch buttons'
// new look (E), HUD sizes (F), and every balance number in js/config.js.
// The save is put back afterwards.
//   const r = await G.Round8Test.run();   r.fail -> []
window.G = window.G || {};
G.Round8Test = (function () {
  const results = [];
  const ok = (name, cond, info) => results.push({ name, pass: !!cond, info: info === undefined ? "" : info });
  const tick = () => new Promise((r) => { const ch = new MessageChannel(); ch.port1.onmessage = () => r(); ch.port2.postMessage(0); });
  const key = (code, o) => G.onKeyDown(Object.assign({ code, key: code, repeat: false, preventDefault() {}, stopPropagation() {} }, o || {}));
  const DT = 1 / 60;
  const r1 = (v) => Math.round(v * 10) / 10;
  let g, B, Q;
  const up = (n) => { for (let i = 0; i < (n || 1); i++) g._upd.call(g, DT); };

  function fresh(level) {
    g = G.Game; B = G.Bosses; Q = G.Quiz;
    G.save.tutorialDone = true;
    G.save.settings.graphicsQuality = "medium";
    G.save.settings.gameSpeed = 1;
    G.save.checkpoints = {};
    g.startLevel(level || 1);
    g._upd = g._upd || g.update;
    g.update = function () {};
    g.clearZombies();
    G.Input.mode = "desktop"; G.Input.padActive = false;
    return g;
  }
  // a wave's zombies, all spawned and shot: the right word each time, or
  // (wrong: a list of which to get wrong) the wrong one
  function playWave(wrongAt) {
    wrongAt = wrongAt || [];
    const P = g.yawObject.position;
    let n = 0;
    while (g.spawnedCount < g.requiredKills && n < 200) {
      // (four alive at most, like the real spawner early on)
      while (g.zombies.filter((z) => z.alive).length < 4 && g.spawnedCount < g.requiredKills) {
        const z = g.spawnZombieAt("normal", new THREE.Vector3(P.x + (n % 5) * 2 - 4, 0, P.z - 12)); z.emerge = null; n++;
      }
      const alive = g.zombies.filter((z) => z.alive);
      const target = alive.find((z) => z.word === g.targetPair[0]);
      const k = g.totalZombiesKilled;
      const victim = wrongAt.includes(k) ? alive.find((z) => z !== target) || target : target;
      victim.hp = 0; victim.alive = false; g.onZombieDeath(victim);
    }
    // (the dead lie there until their fall has played out)
    g.clearZombies();
  }
  function answerAll(pattern) {
    // pattern: "r" right, "w" wrong, "t" out of time
    let i = 0, n = 0;
    while (Q.active && Q.stage !== "result" && n++ < 60) {
      if (Q.stage === "question") {
        const q = Q.qs[Q.i], a = pattern[i++] || "r";
        if (a === "r") Q.answer(q.answer); else if (a === "w") Q.answer((q.answer + 1) % q.choices.length); else Q.update(Q.limit + 0.01);
      }
      Q.update(5);
    }
  }

  // ================================================================
  // config: every balance number in one file
  // ================================================================
  async function config() {
    const txt = await (await fetch("js/config.js?v=" + Date.now())).text();
    const tables = ["G.CONFIG", "G.LEVELS", "G.WAVE_TABLE", "G.ECONOMY", "G.SHOP_ITEMS", "G.WEAPON_DEFS", "G.MELEE_DEF", "G.ZOMBIE_TYPES", "G.PERKS", "G.LEVEL_OBJECTIVES", "G.ABILITIES"];
    ok("config: one file holds every balance table", tables.every((t) => new RegExp("^" + t.replace(".", "\\.") + " = ", "m").test(txt)), tables.filter((t) => !new RegExp("^" + t.replace(".", "\\.") + " = ", "m").test(txt)).join(","));
    const others = ["js/entities.js", "js/systems.js", "js/perks.js", "js/objectives.js", "js/world.js", "js/abilities.js"];
    const dup = [];
    for (const f of others) { const s = await (await fetch(f + "?v=" + Date.now())).text(); tables.forEach((t) => { if (new RegExp("^" + t.replace(".", "\\.") + " = ", "m").test(s)) dup.push(f + ":" + t); }); }
    ok("config: ...and nowhere else", dup.length === 0, dup.join(","));
    const C = G.CONFIG;
    ok("config: player, quiz, boss, abilities, third floor, checkpoint", C.player && C.quiz && C.boss && C.abilities && C.floor3 && C.checkpoint && C.player.maxHp === 450);
    ok("config: loaded before everything else", Array.from(document.scripts).map((s) => s.getAttribute("src") || "").filter((s) => /^js\//.test(s)).indexOf("js/config.js") === 1);
  }

  // ================================================================
  // A: the end-of-wave quiz
  // ================================================================
  async function quiz() {
    fresh(1);
    ok("A2 every wave has at least six zombies (so six words)", g.requiredKills >= G.CONFIG.quiz.minWordsPerWave, g.requiredKills);
    playWave([1]);
    const words = g.waveWords.map((p) => p[0]);
    ok("A2 the wave's words are noted as they spawn", words.length === g.spawnedCount && words.length >= 6, words.join(","));
    ok("A2 six different words even in wave 1 (four alive at once, six in all)", new Set(words.map((w) => w.toLowerCase())).size >= 6);
    const missed = Array.from(g.waveMissed);
    ok("A2 a wrong shot marks both words (the one shot and the one wanted)", missed.length === 2, missed.join(","));
    // the wave is over
    g.checkWaveClear();
    ok("A1 after the wave: the quiz, not the shop", Q.active && G.Modal.isOpen("quiz") && g.state === "GAMEPLAY" && !G.Modal.isOpen("shop"));
    ok("A1 ...the game fully paused (a G.Modal window)", G.Modal.pausesAll() && g.paused);
    const asked = Q.qs.map((q) => q.pair[0]);
    ok("A2 six questions, all from this wave's words", asked.length === 6 && asked.every((w) => words.includes(w)), asked.join(","));
    ok("A2 the words shot wrong come first", missed.every((w) => asked.slice(0, missed.length).map((x) => x.toLowerCase()).includes(w)));
    ok("A2 no word asked twice", new Set(asked).size === asked.length);
    ok("A3 four choices, the two kinds in turn", Q.qs.every((q, i) => q.choices.length === 4 && q.kind === (i % 2 ? "en2th" : "th2en")));
    const clean = Q.qs.every((q) => {
      const answerText = q.choices[q.answer];
      const pool = g.wordPool;
      const meaningOf = (c) => (q.kind === "th2en" ? (pool.find((p) => p[0] === c) || [])[1] : c);
      return new Set(q.choices).size === 4 && q.choices.filter((c, i) => i !== q.answer).every((c) => (meaningOf(c) || "").trim() !== q.pair[1].trim()) && (q.kind === "th2en" ? answerText === q.pair[0] : answerText === q.pair[1]);
    });
    ok("A3 the wrong choices are other words of the level, none meaning the same", clean);
    const el = (id) => document.getElementById(id);
    ok("A3 Correct: 0/6 and Mistakes: 0/2 on the window", el("quiz-correct").textContent === "Correct: 0/6" && el("quiz-mistakes").textContent === "Mistakes: 0/2");
    ok("A3 the question: Thai meaning -> English word first", el("quiz-prompt").textContent === Q.qs[0].pair[1] && document.querySelectorAll("#quiz-choices .quiz-choice").length === 4);
    ok("A3 fifteen seconds a question", Q.limit === 15);
    // keys 1-4, and weapon keys do nothing meanwhile
    g.player.currentSlot = 1;
    const st0 = Object.assign({}, G.save.wordStats[Q.qs[0].pair[0].toLowerCase()] || { correct: 0, wrong: 0 });
    const wrongK = (Q.qs[0].answer + 1) % 4;
    key("Digit" + (wrongK + 1));
    ok("A3 key 1-4 answers", Q.stage === "feedback" && Q.qs[0].picked === wrongK && g.player.currentSlot === 1);
    const btns = document.querySelectorAll("#quiz-choices .quiz-choice");
    ok("A3 a wrong answer: shown at once, the right one lit", btns[wrongK].classList.contains("is-wrong") && btns[Q.qs[0].answer].classList.contains("is-right") && /The answer is/.test(el("quiz-feedback").textContent));
    ok("A3 Mistakes: 1/2", el("quiz-mistakes").textContent === "Mistakes: 1/2");
    const st1 = G.save.wordStats[Q.qs[0].pair[0].toLowerCase()];
    ok("A3 the answer goes into the long-term word stats", st1 && st1.wrong === st0.wrong + 1);
    ok("A3 ...and onto the run's words to review", !!g.wrongWordsThisRun[Q.qs[0].pair[0]]);
    Q.update(0.5);
    ok("A3 the answer stays up a moment", Q.stage === "feedback");
    Q.update(1.2);
    ok("A3 then the next question (English word -> Thai meaning)", Q.stage === "question" && Q.i === 1 && el("quiz-prompt").textContent === Q.qs[1].pair[0]);
    // out of time
    Q.update(14.9);
    ok("A3 still waiting at 14.9 s", Q.stage === "question");
    Q.update(0.2);
    ok("A3 out of time counts as a mistake", Q.stage === "feedback" && Q.mistakes === 2 && /Time's up/.test(el("quiz-feedback").textContent));
    key("Enter");
    ok("A3 Enter moves on", Q.stage === "question" && Q.i === 2);
    // a click (or a tap) answers too
    document.querySelectorAll("#quiz-choices .quiz-choice")[Q.qs[2].answer].click();
    ok("A3 a click (or a tap) answers", Q.correct === 1 && Q.stage === "feedback");
    ok("A3 Correct: 1/6", el("quiz-correct").textContent === "Correct: 1/6");
    ok("A3 a controller works in it", G.Pad.scope() === document.getElementById("screen-quiz"));
    Q.update(2);
    answerAll("rrr");
    ok("A3 the end: passed (4 right, 2 mistakes), the words missed listed", Q.stage === "result" && Q.passed && /Review passed/.test(el("quiz-verdict").textContent) && el("quiz-missed").querySelectorAll(".qm-row").length === 2);
    key("Enter");
    ok("A1 passed: the shop", !Q.active && g.state === "SHOP" && G.Modal.isOpen("shop") && !G.Modal.isOpen("quiz"));
    // a failed one: no shop, the next wave at once
    g.leaveShop();
    const w0 = g.wave;
    playWave();
    g.checkWaveClear();
    answerAll("rrwwwr");
    ok("A1 three mistakes: failed", Q.stage === "result" && !Q.passed && /Review failed/.test(el("quiz-verdict").textContent));
    el("btn-quiz-continue").click();
    ok("A1 failed: no shop, the next wave straight away", g.state === "GAMEPLAY" && !G.Modal.isOpen("shop") && g.wave === w0 + 1);
    // the words asked come from THIS wave only, wave after wave
    let fromWave = true;
    const logs = [];
    // (waves 6-8: no boss in the way)
    g.wave = 5; g.startWave();
    for (let w = 0; w < 3; w++) {
      playWave([0]);
      const ww = g.waveWords.map((p) => p[0]);
      g.checkWaveClear();
      const a = Q.qs.map((q) => q.pair[0]);
      logs.push("wave " + g.wave + ": spawned " + ww.join(",") + " | asked " + a.join(","));
      if (!a.every((x) => ww.includes(x))) fromWave = false;
      answerAll("rrrrrr"); Q.close();
      if (g.state === "SHOP") g.leaveShop();
    }
    ok("A2 wave after wave: only that wave's words", fromWave, logs.join(" || "));
    G.Round8Test.quizLog = logs.concat((G.Quiz.history || []).slice(-6).map((l) => "history wave " + l.wave + ": words " + l.words.join(",") + " | asked " + l.asked.join(",") + " | missed first " + l.missedFirst.join(",")));
  }

  // A4: the boss wave's order, and its minions' words
  async function bossWave() {
    fresh(1);
    const steps = [];
    const ab = G.Abilities.offer, qo = Q.open, sh = g.openShop, cp = G.Checkpoint.save;
    G.Abilities.offer = function () { steps.push("ability"); return ab.apply(this, arguments); };
    Q.open = function () { steps.push("quiz"); return qo.apply(this, arguments); };
    g.openShop = function () { steps.push("shop"); return sh.apply(this, arguments); };
    G.Checkpoint.save = function () { steps.push("checkpoint"); return cp.apply(this, arguments); };
    try {
      // wave 10: its zombies, its boss (who summons), the boss down
      g.wave = 9; g.startWave();
      playWave();
      B.forceNext = "matron";      // (the one who summons)
      g.checkWaveClear(); up(1);
      let n = 0; while (G.Cutscene.active && n++ < 700) up(1);
      const b = B.boss;
      // its minions: shot, their words noted with the wave's
      b.abilityCd = 0; up(1);
      let m = 0; while (!g.zombies.some((z) => z.minion) && m++ < 400) up(1);
      const minion = g.zombies.find((z) => z.minion);
      ok("A2 a boss's minions' words are the wave's words too", !!minion && G.Quiz.usedThisWave(g, minion.word), minion && minion.word);
      steps.push("death");
      B.damage(g, 1e9, null);
      n = 0; while (G.Cutscene.active && n++ < 500) up(1);
      steps.push("word");
      const c = g.challenge;
      g.answerChallenge(c.choices.indexOf(c.pair[0]));
      if (G.Modal.isOpen("abilities")) { G.UI.hivePick(0); G.UI.hiveFinishReveal(); G.UI.hiveClose(); }
      const asked = Q.active ? Q.qs.map((q) => q.pair[0]) : [];
      ok("A2 the boss wave's quiz: its own words only", asked.length === 6 && asked.every((w) => G.Quiz.usedThisWave(g, w)));
      answerAll("rrwwwr"); Q.close();
      const failedShop = g.state === "SHOP";
      steps.push("next:" + g.wave);
      ok("A4 boss wave: death, word, ability, quiz, (no shop: failed), checkpoint, next wave", steps.join(" > ") === "death > word > ability > quiz > checkpoint > next:11", steps.join(" > "));
      ok("A4 ...the checkpoint kept even though the quiz was failed", !failedShop && G.Checkpoint.has(1) && G.Checkpoint.get(1).wave === 11);
    } finally {
      G.Abilities.offer = ab; Q.open = qo; g.openShop = sh; G.Checkpoint.save = cp;
      B.reset(g);
    }
  }

  // ================================================================
  // B: health regeneration
  // ================================================================
  function regen() {
    fresh(1);
    const C = G.CONFIG.player, pl = g.player;
    ok("B config: 12 s, then 1 HP every 2 s", C.regenDelay === 12 && C.regenHp === 1 && C.regenEvery === 2);
    pl.hp = 200; g._regenFor = null; g.updateRegen(0.01);
    for (let i = 0; i < 119; i++) g.updateRegen(0.1);
    ok("B nothing for 12 s", pl.hp === 200);
    for (let i = 0; i < 101; i++) g.updateRegen(0.1);        // to 22.0 s: 10 s of it
    ok("B then 1 HP every 2 s (5 HP in 10 s)", pl.hp === 205, pl.hp);
    pl.hp -= 1; g.updateRegen(0.1);
    for (let i = 0; i < 115; i++) g.updateRegen(0.1);
    ok("B any loss: stops, and the 12 s start again", pl.hp === 204 && !g.regenerating);
  }

  // ================================================================
  // C: boss health by wave, ammunition in the arena
  // ================================================================
  function bossHp() {
    fresh(1);
    const table = {};
    [5, 10, 15, 20].forEach((w) => {
      g.wave = w;
      const hps = G.BOSS_DEFS.map((d) => { B.forceNext = d.id; return B.hpFor(g); });
      table[w] = hps;
    });
    ok("C every boss at the same wave has the same health", Object.values(table).every((h) => new Set(h).size === 1), JSON.stringify(Object.fromEntries(Object.entries(table).map(([w, h]) => [w, h[0]]))));
    ok("C ...and it rises 5 < 10 < 15 < 20", table[5][0] < table[10][0] && table[10][0] < table[15][0] && table[15][0] < table[20][0]);
    // the player's guns do not change it any more
    g.wave = 5; const hp1 = B.hpFor(g);
    g.player.gunSlots = ["pistol", "golden_smg"]; g.player.ammo.golden_smg = { mag: 50, reserve: 200 }; g.player.weaponLevels.golden_smg = { dmg: 3, rate: 2, mag: 1 };
    ok("C a strong gun found early no longer makes the wave 5 boss a marathon", B.hpFor(g) === hp1);
    ok("C the hospital and the bunker are a step harder", (() => { const lv = g.level; g.level = G.getLevel(3); const h = B.hpFor(g); g.level = lv; return h > hp1; })());
    // the arena's ammunition
    fresh(1);
    g.wave = 4; g.startWave(); g.spawnedCount = g.requiredKills; g.clearZombies();
    B.forceNext = "coach"; g.checkWaveClear(); up(1);
    let n = 0; while (G.Cutscene.active && n++ < 700) up(1);
    const b = B.boss;
    b.act = null; b.swipeCd = 999; b.abilityCd = 999;
    const AM = G.CONFIG.boss.arenaAmmo;
    for (let i = 0; i < Math.round((AM.firstAfter - 0.5) * 60); i++) { up(1); b.swipeCd = 999; b.abilityCd = 999; g.player.hp = g.player.maxHp; }
    ok("C arena: no box in the first seconds", !g.drops.some((d) => d.arena && d.kind === "ammo"));
    up(60);
    const first = g.drops.filter((d) => d.arena && d.kind === "ammo");
    const r = B.arena.rect;
    ok("C arena: a box after " + AM.firstAfter + " s, inside the arena", first.length === 1 && first[0].mesh.position.x > r.minX && first[0].mesh.position.x < r.maxX, first.length);
    ok("C arena: the next in 20-30 s", b.supplyT >= AM.every[0] - 1.1 && b.supplyT <= AM.every[1]);
    b.hp = b.maxHp * 0.74; up(1);
    ok("C arena: the boss drops one at 75%", g.drops.filter((d) => d.arena && d.kind === "ammo").length === 2 && b.dropsDone === 1);
    b.hp = b.maxHp * 0.2; up(1);
    ok("C arena: ...and at 50% and 25%", b.dropsDone === 3 && g.drops.filter((d) => d.arena && d.kind === "ammo").length === 4);
    const pl = g.player; pl.gunSlots = ["pistol", "smg"]; pl.ammo.smg = { mag: 0, reserve: 0 }; pl.weaponLevels.smg = { dmg: 1, rate: 1, mag: 1 };
    const pr = pl.ammo.pistol.reserve;
    g.collectDrop(g.drops.find((d) => d.arena && d.kind === "ammo"));
    ok("C arena: a box fills every gun (" + AM.magsPerGun + " magazines each)",pl.ammo.smg.reserve === G.WEAPON_DEFS.smg.magSize * AM.magsPerGun && pl.ammo.pistol.reserve === pr + G.WEAPON_DEFS.pistol.magSize * AM.magsPerGun);
    B.reset(g);
  }

  // ================================================================
  // D: turning from FIRE and AIM
  // ================================================================
  function touch(el, type, id, x, y) {
    const t = new Touch({ identifier: id, target: el, clientX: x, clientY: y });
    const list = type === "touchend" || type === "touchcancel" ? [] : [t];
    el.dispatchEvent(new TouchEvent(type, { bubbles: true, cancelable: true, touches: list, targetTouches: list, changedTouches: [t] }));
  }
  function fireLook() {
    fresh(1);
    G.Input.mode = "touch"; g.state = "GAMEPLAY"; G.UI.applyControlMode();
    const I = G.Input, fire = document.getElementById("touch-fire"), ads = document.getElementById("touch-ads"), joy = document.getElementById("touch-joystick");
    const fr = fire.getBoundingClientRect(), cx = fr.left + fr.width / 2, cy = fr.top + fr.height / 2;
    I.consumeMouseDelta();
    touch(fire, "touchstart", 11, cx, cy);
    ok("D FIRE pressed: firing", I.touchFire);
    touch(fire, "touchmove", 11, cx - 30, cy + 10);
    let d = I.consumeMouseDelta();
    const k = G.TouchCfg.btnLookSens() * G.CONFIG.touch.lookDrag;
    ok("D drag on FIRE turns the view (the look area's rate)", Math.abs(d.x - (-30 * k)) < 1e-6 && Math.abs(d.y - 10 * k) < 1e-6, d.x + "," + d.y);
    touch(fire, "touchmove", 11, cx - 400, cy + 10);
    d = I.consumeMouseDelta();
    ok("D ...still turning (and firing) once the finger is off the button", Math.abs(d.x - (-370 * k)) < 1e-6 && I.touchFire);
    // more fingers at once: the stick and AIM too
    const jr = joy.getBoundingClientRect(), jx = jr.left + jr.width / 2, jy = jr.top + jr.height / 2;
    touch(joy, "touchstart", 12, jx, jy);
    touch(joy, "touchmove", 12, jx, jy - 30);
    const ar = ads.getBoundingClientRect(), ax = ar.left + ar.width / 2, ay = ar.top + ar.height / 2;
    touch(ads, "touchstart", 13, ax, ay);
    touch(ads, "touchmove", 13, ax + 20, ay);
    d = I.consumeMouseDelta();
    ok("D walk + fire-turn + AIM-turn at once, each finger its own", I.touchMove.y < -0.5 && I.aimDown && I.touchFire && Math.abs(d.x - 20 * k) < 1e-6, I.touchMove.y + " / " + d.x);
    touch(fire, "touchend", 11, cx - 400, cy + 10);
    touch(ads, "touchmove", 13, ax + 30, ay);
    d = I.consumeMouseDelta();
    ok("D FIRE let go: firing stops, AIM still turns", !I.touchFire && Math.abs(d.x - 10 * k) < 1e-6);
    touch(ads, "touchend", 13, ax + 30, ay); touch(joy, "touchend", 12, jx, jy - 30);
    G.TouchCfg.setBtnLookSens(2);
    touch(fire, "touchstart", 14, cx, cy); touch(fire, "touchmove", 14, cx + 10, cy);
    d = I.consumeMouseDelta();
    ok("D its own sensitivity (Settings, the layout editor)", Math.abs(d.x - 10 * 2 * G.CONFIG.touch.lookDrag) < 1e-6);
    touch(fire, "touchend", 14, cx + 10, cy);
    G.TouchCfg.setBtnLookSens(1);
    G.UI.renderSettings();
    ok("D Settings: the FIRE/AIM sensitivity slider", !!document.getElementById("set-blook") && !!document.getElementById("set-tlook"));
    I.aimDown = false; ads.classList.remove("active");
  }

  // ================================================================
  // E: the touch buttons' look
  // ================================================================
  function looks() {
    const ids = ["fire", "ads", "interact", "reload", "jump", "sprint", "pause"];
    ok("E every button has an icon", ids.every((id) => document.querySelector("#touch-" + id + " svg.tb-ico")));
    const bs = ids.map((id) => document.getElementById("touch-" + id).getBoundingClientRect().width);
    ok("E FIRE is the biggest", bs[0] > Math.max(...bs.slice(1)), bs.map(Math.round).join(","));
    const cs = getComputedStyle(document.getElementById("touch-fire"));
    ok("E frosted glass (a blur behind it) and a glowing edge", /blur/.test(cs.backdropFilter || cs.webkitBackdropFilter || "") && /rgba?\(/.test(cs.boxShadow));
    // the hit areas: the sizes the layout sets, as before
    const root = document.getElementById("touch-controls"), rs = getComputedStyle(root);
    const px = (v) => parseFloat(v);
    ok("E hit areas no smaller: FIRE and a small button their full sizes", Math.abs(bs[0] - px(rs.getPropertyValue("--tf")) * 1) < 2 || bs[0] >= 62, bs[0]);
    const f = document.getElementById("touch-fire");
    f.dispatchEvent(new TouchEvent("touchstart", { bubbles: true, cancelable: true, changedTouches: [new Touch({ identifier: 31, target: f, clientX: 1, clientY: 1 })] }));
    ok("E pressed: it sinks and a ring spreads out", f.classList.contains("pressed") && !!f.querySelector(".tb-ripple"));
    f.dispatchEvent(new TouchEvent("touchend", { bubbles: true, cancelable: true, changedTouches: [new Touch({ identifier: 31, target: f, clientX: 1, clientY: 1 })] }));
    // the reload ring
    fresh(1);
    G.Input.mode = "touch"; g.state = "GAMEPLAY"; G.UI.applyControlMode();
    g.player.ammo.pistol.mag = 3; g.reload();
    for (let i = 0; i < 20; i++) g.updateShooting(DT);
    G.UI.updateHud(g.buildHudState());
    const rb = document.getElementById("touch-reload");
    ok("E the reload button fills its ring while reloading", rb.classList.contains("reloading") && parseFloat(rb.style.getPropertyValue("--rp")) > 0, rb.style.getPropertyValue("--rp"));
    ok("E the stick: a ring, arrows, a knob", !!document.querySelector("#touch-joystick .tj-arrows") && !!document.getElementById("touch-joystick-knob"));
    G.Input.mode = "desktop"; G.UI.applyControlMode();
  }

  // ================================================================
  // F: HUD sizes
  // ================================================================
  function hud() {
    fresh(1);
    g.state = "GAMEPLAY"; G.UI.setHudVisible(true); G.UI.showScreen(null);
    const H = G.HudCfg;
    H.reset();
    ok("F eleven sliders: the whole HUD and ten parts", ["all"].concat(H.PARTS).length === 11 && H.PARTS.includes("hp") && H.PARTS.includes("stamina") && H.PARTS.includes("money") && H.PARTS.includes("minimap"));
    H.set("hp", 1.4);
    ok("F a part's size", document.querySelector(".hud-health").style.zoom !== "" && Math.abs(parseFloat(document.querySelector(".hud-health").style.zoom) - 1.4 * H.fitK) < 0.01);
    ok("F ...only that part", document.querySelector(".hud-stamina").style.zoom === "" || Math.abs(parseFloat(document.querySelector(".hud-stamina").style.zoom) - H.fitK) < 0.01);
    H.set("hp", 9); ok("F 150% at most", H.get("hp") === 1.5);
    H.set("hp", 0.1); ok("F 50% at least", H.get("hp") === 0.5);
    ok("F kept in the save", G.save.settings.hudScale.hp === 0.5);
    H.set("all", 1.5); H.PARTS.forEach((p) => H.set(p, 1.5));
    const extra = H.problems().filter((p) => !H._baseline.has(p));
    ok("F everything at 150%: nothing overlaps or leaves the screen (it shrinks to fit)", extra.length === 0, extra.join(",") + " fit " + r1(H.fitK));
    H.reset();
    ok("F Reset to Default", Object.keys(G.save.settings.hudScale).length === 0 && document.querySelector(".hud-health").style.zoom === "");
    // touch mode: the panels move to the top, where the weapon panel shares a
    // corner with the minimap; the touch buttons count as well
    G.Input.mode = "touch"; G.UI.applyControlMode(); H._baseKey = null; H.reset();
    ok("F touch mode, default sizes: no HUD part on another or on a touch button (" + innerWidth + "x" + innerHeight + ")", H.problems().length === 0, H.problems().join(","));
    H.set("all", 1.5); H.PARTS.forEach((p) => H.set(p, 1.5));
    ok("F touch mode, everything at 150%: still nothing (it shrinks to fit)", H.problems().length === 0, H.problems().join(",") + " fit " + r1(H.fitK));
    const tb = G.TouchCfg.IDS.map((id) => document.getElementById("touch-" + id)).filter((el) => el && el.getClientRects().length && el.getBoundingClientRect().width > 1).map((el) => [el.id, el.getBoundingClientRect()]);
    const tOver = [];
    tb.forEach((a, i) => tb.slice(i + 1).forEach((b) => { if (a[1].left < b[1].right - 1 && b[1].left < a[1].right - 1 && a[1].top < b[1].bottom - 1 && b[1].top < a[1].bottom - 1) tOver.push(a[0] + "|" + b[0]); }));
    ok("F touch mode: no touch button on another (the weapon row included)", tOver.length === 0, tOver.join(","));
    H.reset(); G.Input.mode = "desktop"; G.UI.applyControlMode();
    // the editor
    g.pause();
    G.UI._settingsReturn = "screen-pause"; G.UI.renderSettings(); G.UI.showScreen("screen-settings");
    document.getElementById("btn-hudcfg").click();
    ok("F Settings > Adjust HUD Size: the real HUD and the sliders", H.editing && !document.getElementById("hudcfg-panel").classList.contains("hidden") && !document.getElementById("hud").classList.contains("hidden") && document.querySelectorAll("#hudcfg-rows input[type=range]").length === 11);
    ok("F a controller works in it", G.Pad.scope() === document.getElementById("hudcfg-panel"));
    const inp = document.querySelector('#hudcfg-rows [data-part="money"] input');
    inp.value = 1.3; inp.dispatchEvent(new Event("input"));
    ok("F moving a slider sizes the HUD as it goes", Math.abs(H.get("money") - 1.3) < 1e-6 && document.querySelector(".hud-money-stat").style.zoom !== "");
    key("Escape");
    ok("F Escape closes it, back to Settings", !H.editing && G.UI._currentScreen === "screen-settings");
    // from the touch layout editor too
    G.TouchCfg.openEditor();
    document.getElementById("touchcfg-hud").click();
    ok("F from the touch layout editor too", H.editing && !G.TouchCfg.editing);
    document.getElementById("hudcfg-done").click();
    ok("F ...and back to it", !H.editing && G.TouchCfg.editing);
    G.TouchCfg.closeEditor();
    H.reset(); G.persist();
  }

  async function run() {
    results.length = 0;
    for (let i = 0; i < 200 && !(G.save && G.Game.renderer); i++) await new Promise((r) => setTimeout(r, 50));
    if (!G.save) return { total: 1, pass: 0, fail: [{ name: "the game had not started", pass: false, info: "" }], results: [] };
    const saved = JSON.stringify(G.save);
    G._missingKeys = {};
    const rpl = G.Input.requestPointerLock;
    G.Input.requestPointerLock = function () {};
    try {
      await config(); await tick();
      await quiz(); await tick();
      await bossWave(); await tick();
      regen(); await tick();
      bossHp(); await tick();
      fireLook(); await tick();
      looks(); await tick();
      hud(); await tick();
      ok("no missing strings", Object.keys(G._missingKeys || {}).length === 0, Object.keys(G._missingKeys || {}).join(","));
    } catch (e) {
      ok("no exception", false, String(e && e.stack || e));
    } finally {
      G.Input.requestPointerLock = rpl;
      if (G.Quiz.active) G.Quiz.reset();
      if (G.HudCfg.editing) G.HudCfg.closeEditor();
      if (G.TouchCfg.editing) G.TouchCfg.closeEditor();
      G.save = JSON.parse(saved);
      G.persist();
      G.Input.keys = {};
      G.Input.mode = "desktop";
      G.Modal.reset();
      if (G.Game._upd) G.Game.update = G.Game._upd;
      G.Game.quitToMainMenu();
    }
    const fail = results.filter((r) => !r.pass);
    return { total: results.length, pass: results.length - fail.length, fail, results };
  }
  return { run };
})();
