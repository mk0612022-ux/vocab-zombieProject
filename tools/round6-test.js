// Dev-only (not shipped). New list, round 2: twenty waves, the ten bosses
// (their cutscenes, the arena and its energy walls, every move and the way
// out of it), what follows a boss (its death, the word, the shop), the Boss
// Codex and the save. The save is put back afterwards.
//   const r = await G.Round6Test.run();   r.fail -> []
window.G = window.G || {};
G.Round6Test = (function () {
  const results = [];
  const ok = (name, cond, info) => results.push({ name, pass: !!cond, info: info === undefined ? "" : info });
  const tick = () => new Promise((r) => { const ch = new MessageChannel(); ch.port1.onmessage = () => r(); ch.port2.postMessage(0); });
  const key = (code) => G.onKeyDown({ code, key: code, preventDefault() {}, stopPropagation() {} });
  const DT = 1 / 60;
  let g, B;
  const up = (n) => { for (let i = 0; i < (n || 1); i++) g._upd.call(g, DT); };
  const r1 = (v) => Math.round(v * 10) / 10;

  function fresh(level) {
    g = G.Game; B = G.Bosses;
    G.save.tutorialDone = true;
    G.save.settings.graphicsQuality = "medium";
    G.save.settings.gameSpeed = 1;
    g.startLevel(level || 1);
    g._upd = g._upd || g.update;
    g.update = function () {};
    g.clearZombies();
    G.Input.mode = "desktop";
    return g;
  }
  // a boss wave's zombies all down: straight to boss `id`, past its cutscene
  function toBoss(id, wave, skipCut) {
    if (G.Cutscene.active) G.Cutscene.stop();
    if (B.boss || B.phase) B.reset(g);
    G.Modal.reset(); g.paused = false; g.state = "GAMEPLAY"; G.UI.showScreen(null);
    g.player.hp = g.player.maxHp;
    g.wave = (wave || 5) - 1; g.startWave();
    g.spawnedCount = g.requiredKills; g.clearZombies();
    B.forceNext = id;
    g.checkWaveClear();
    up(1);
    if (skipCut !== false) { let n = 0; while (G.Cutscene.active && n < 700) { up(1); n++; } }
    return B.boss;
  }
  // hold the boss still and let only the move under test happen
  function quiet(b) { if (b.act && b.act.end) b.act.end(); b.act = null; b.swipeCd = 999; b.abilityCd = 999; }
  function place(x, z) { g.yawObject.position.set(x, 1.7, z); g._prevPos = null; }
  function sim(sec, each) { const n = Math.round(sec / DT); for (let i = 0; i < n; i++) { if (each) each(i); up(1); if (!B.boss || B.phase !== "fight") break; } }
  const taken = () => B.stats.taken;
  // (round 3 of the new series: a right answer opens the ability honeycomb
  // first -- pick the first hexagon and carry on)
  const hive = () => { if (G.Modal.isOpen("abilities")) { G.UI.hivePick(0); G.UI.hiveFinishReveal(); G.UI.hiveClose(null, G.Abilities.slots.length >= G.Abilities.MAX); } };
  // (new series, round 1: then the wave's six-question quiz -- answered right, the shop)
  const quiz = (pass) => { const Q = G.Quiz; if (!Q.active) return false; let n = 0; while (Q.stage !== "result" && n++ < 40) { if (Q.stage === "question") { const q = Q.qs[Q.i]; Q.answer(pass === false ? (q.answer + 1) % q.choices.length : q.answer); } Q.update(5); } Q.close(); return true; };

  // ---------------- F: twenty waves ----------------
  async function waves() {
    const T = G.WAVE_TABLE;
    ok("F 20 waves in every level", T.length === 20 && G.LEVELS.every((l) => l.waves === 20), G.LEVELS.map((l) => l.waves).join(","));
    const bossW = []; for (let w = 1; w <= 25; w++) if (G.isBossWave(w)) bossW.push(w);
    ok("F boss waves are 5, 10, 15, 20 (and 25 in Endless)", bossW.join(",") === "5,10,15,20,25", bossW.join(","));
    ok("F waves 1-4 ease in: fewer, slower, no/few fast ones", T[0][0] < T[1][0] && T[1][0] < T[2][0] && T[2][0] < T[3][0] && T[0][1] < 1 && T[0][2] === 0, T.slice(0, 4).map((r) => r[0] + "@" + r[1]).join(" "));
    let mono = true;
    for (let i = 1; i < 20; i++) { if (T[i][1] < T[i - 1][1] || T[i][2] < T[i - 1][2] || T[i][5] > T[i - 1][5]) mono = false; }
    ok("F speed, fast share and spawn pace only climb", mono);
    const s1 = G.waveSpec(G.getLevel(1), 12, "campaign"), s3 = G.waveSpec(G.getLevel(3), 12, "campaign");
    ok("F the bunker is harder than the school at the same wave", s3.kills > s1.kills && s3.speed > s1.speed && s3.fast > s1.fast, s1.kills + " vs " + s3.kills);
    const ot = G.waveSpec(G.getLevel(1), 24, "campaign"), en = G.waveSpec(G.getLevel(3), 60, "endless");
    ok("F overtime plays like wave 19; Endless climbs to a ceiling", ot.kills === G.waveSpec(G.getLevel(1), 19, "campaign").kills && en.speed <= 1.45 + 0.7 * 0.12 + 1e-9, ot.kills + " / " + r1(en.speed));
    fresh(1);
    g.wave = 6; g.startWave();
    ok("F a wave's quota comes from its row", g.requiredKills === G.waveSpec(g.level, 7, "campaign").kills, g.requiredKills);
    const z = g.spawnZombieAt("normal", new THREE.Vector3(-44, 0, -20));
    ok("F a zombie walks at its wave's pace", Math.abs(z.speed - G.ZOMBIE_TYPES.normal.speed * G.Spawner.spec.speed) < 1e-6, r1(z.speed));
    g.clearZombies();
    G.UI.updateHud(g.buildHudState());
    ok("F HUD: Wave X/20", /Wave 7\/20/.test(document.getElementById("hud-level-wave").textContent), document.getElementById("hud-level-wave").textContent);
    // a boss wave: its own zombies first, then the boss
    g.wave = 4; g.startWave();
    g.spawnedCount = 3; g.checkWaveClear();
    ok("F boss wave: no boss while its zombies are still to come", !B.phase);
    g.spawnedCount = g.requiredKills; g.spawnZombieAt("normal", new THREE.Vector3(-44, 0, -20)); g.spawnedCount = g.requiredKills;
    g.checkWaveClear();
    ok("F ... nor while one is still standing", !B.phase);
    g.clearZombies(); g.checkWaveClear();
    ok("F ... then its boss", B.phase === "pending");
    G.Modal.open("crate", { pause: true });
    g.paused = false; up(3);
    ok("F the boss waits while a window is open", B.phase === "pending" && !G.Cutscene.active);
    G.Modal.close("crate"); g.paused = false;
    B.reset(g);
    // money for twenty waves
    ok("F economy: a wave pays 50 + 10 x wave; a boss 200 + 30 x wave", G.ECONOMY.waveBonus(1) === 60 && G.ECONOMY.waveBonus(20) === 250 && G.ECONOMY.bossBounty(20) === 800);
    ok("F perks cost more (x1.3)", G.Perks.price("extra_slot") === Math.round(900 * 1.3 / 10) * 10, G.Perks.price("extra_slot"));
    ok("F wall guns cost more (x1.25)", G.WEAPON_DEFS.shotgun.price === 500 && G.WEAPON_DEFS.hall_monitor.price === 1500, G.WEAPON_DEFS.shotgun.price + "," + G.WEAPON_DEFS.hall_monitor.price);
    ok("F objectives sized for 20 waves: 150/165/180 words, all 4 bosses", G.LEVEL_OBJECTIVES[1].minCorrect === 150 && G.LEVEL_OBJECTIVES[3].minCorrect === 180 && G.LEVEL_OBJECTIVES[2].bosses === 4);
    let total = 0; for (let w = 1; w <= 20; w++) total += G.waveSpec(G.getLevel(1), w, "campaign").kills;
    ok("F the school sends enough zombies for the word goal", total > G.LEVEL_OBJECTIVES[1].minCorrect / 0.6, total);
  }

  // ---------------- G1-G3: the arrival ----------------
  async function arrival() {
    fresh(1);
    const hp0 = g.player.hp;
    toBoss("gravedigger", 5, false);
    ok("G1 the boss's cutscene starts", G.Cutscene.active && B.phase === "cutscene");
    ok("G2 letterbox bars in", document.body.classList.contains("cine-on"));
    ok("G2 the HUD and touch controls are out of the way", getComputedStyle(document.getElementById("hud")).visibility === "hidden");
    ok("G2 nothing else alive", g.zombies.length === 0);
    const P = g.yawObject.position;
    ok("G3 the player is moved outdoors, to the football field", /^YARD/.test(G.getRegionAt(g.world, P.x, P.z, 0) || "") && P.x > g.world.pitch.minX && P.x < g.world.pitch.maxX + 2, P.toArray().map(r1).join(","));
    ok("G2 the game plays no part: only pause keys", (() => { g.player.currentSlot = 1; key("Digit1"); return g.player.currentSlot === 1 && !g.playing(); })());
    // (the frame that started it is not one of its frames: it only set it up)
    let n = 0, cardAt = -1, slowSeen = false;
    const E = G.Cutscene.el;
    while (G.Cutscene.active && n < 800) {
      up(1); n++;
      if (cardAt < 0 && E.card.classList.contains("show")) cardAt = G.Cutscene.t;
      if (G.Cutscene.active && G.Cutscene.slowAt(G.Cutscene.t) < 1) slowSeen = true;
    }
    ok("G2 exactly ten seconds (600 frames at 60 fps)", n === 600, n);
    ok("G2 slow motion at its key moment", slowSeen);
    ok("G2 the title card shows during it", cardAt > 5 && cardAt < 7, r1(cardAt));
    ok("G2 the card: wave, name, epithet, Thai", E.wave.textContent === "Wave 5" && E.name.textContent === "Mortimer Grave" && E.title.textContent === "The Relentless" && E.thai.textContent === G.BOSS_WORDS.relentless.th, E.name.textContent + " / " + E.title.textContent + " / " + E.thai.textContent);
    ok("G2 the player cannot be hurt during it", g.player.hp === hp0 && B.stats.fightT === 0);
    ok("G2 then the fight, bars gone", B.phase === "fight" && !document.body.classList.contains("cine-on"));
    // the arena
    const A = B.arena;
    ok("G3 energy walls: the field's fence (4), its posts and the school's doors", G.Arena.walls.filter((w) => w.u).length === 5 && G.Arena.cols.length === 5, G.Arena.walls.length + " / " + G.Arena.cols.length);
    place(A.rect.maxX - 0.8, -20);
    for (let i = 0; i < 40; i++) g.tryMove(0.1, 0);
    ok("G3 the fence stops the player", g.yawObject.position.x < A.rect.maxX + 0.35, r1(g.yawObject.position.x));
    const front = g.world.footprint[0].maxZ;
    ok("G3 the school's front doors are sealed", G.Arena.cols.some((c) => Math.abs((c.min.z + c.max.z) / 2 - (front + 0.4)) < 0.3 && c.min.x <= -3 && c.max.x >= 3));
    // G4
    const bar = document.getElementById("hud-boss-bar");
    up(1);
    ok("G4 a big red health bar at the top, with the name", !bar.classList.contains("hidden") && document.getElementById("hud-boss-name").textContent === "Mortimer Grave, The Relentless");
    ok("G4 much bigger than a zombie", B.boss.rig.H > 3 * 1.8, B.boss.rig.H);
    const rig = B.boss.rig;
    let draws = 0; rig.root.traverse((o) => { if ((o.isMesh || o.isLine) && o.visible) draws++; });
    ok("G4 a boss is cheap to draw (baked parts)", draws <= 25, draws);
    B.reset(g);
    // four different bosses in a run; Endless: a bag of ten
    B.resetRun();
    const four = [0, 1, 2, 3].map(() => B.pick(g).id);
    ok("G1 four bosses of a level are four different ones", new Set(four).size === 4, four.join(","));
    B.resetRun(); g.mode = "endless";
    const ten = []; for (let i = 0; i < 10; i++) ten.push(B.pick(g).id);
    const eleventh = B.pick(g).id;
    ok("G1 Endless: all ten before any comes again, never twice running", new Set(ten).size === 10 && eleventh !== ten[9], ten.join(",") + " | " + eleventh);
    g.mode = "campaign"; B.resetRun();
    // HP grows with the wave
    // (as in a run: each boss is at least a step up from the one before)
    const hp = [5, 10, 15, 20].map((w) => { g.wave = w; const h = B.hpFor(g); B.run.lastHp = h; return h; });
    ok("G4 health grows with the wave (20 the most)", hp[0] < hp[1] && hp[1] < hp[2] && hp[2] < hp[3], hp.join(","));
    ok("G4 laser speed = the base walk (3.2 m/s)", B.LASER_SPEED === 3.2);
    const chk = B.laserCheck(), slow = chk.filter((c) => !c.ok);
    ok("G5 every gun sprints faster than the gaze (no weight changes needed)", slow.length === 0 && chk.length === Object.keys(G.WEAPON_DEFS).length, "slowest " + Math.min(...chk.map((c) => c.sprint)));
    // every cutscene is ten seconds
    const lens = [];
    for (const d of G.BOSS_DEFS) {
      toBoss(d.id, 10, false);
      let k = 0; while (G.Cutscene.active && k < 800) { up(1); k++; }
      lens.push(d.id + ":" + k);
    }
    ok("G2 all ten cutscenes: exactly ten seconds, ten different ones", lens.every((s) => /:600$/.test(s)) && new Set(G.BOSS_DEFS.map((d) => d.intro)).size === 10, lens.join(" "));
    B.reset(g);
  }

  // ---------------- G5: the moves, and the way out of each ----------------
  async function moves() {
    fresh(1);
    const A0 = G.Arena.plan(g), cx = (A0.rect.minX + A0.rect.maxX) / 2;
    // Grave Slam
    let b = toBoss("gravedigger", 5); quiet(b);
    place(cx, -25); b.pos.set(cx, 0, -38);
    b.abilityCd = 0; up(1);
    const circle = B.dangers().find((d) => d.kind === "circle");
    ok("G5 slam: a red circle where the player stands", circle && Math.hypot(circle.x - cx, circle.z + 25) < 0.5 && circle.r >= 3.5, circle && circle.r);
    b.abilityCd = 999;
    let t0 = taken();
    sim(0.5); place(cx + 9, -25);
    sim(2.2);
    ok("G5 slam: out of the circle before it lands, no damage", taken() === t0);
    quiet(b); place(cx, -25); g.player.hp = g.player.maxHp; b.abilityCd = 0; up(1); b.abilityCd = 999;
    t0 = taken();
    sim(2.6);
    const lost = taken() - t0;
    ok("G5 slam: in it, about 55% of health", Math.abs(lost / g.player.maxHp - 0.55) < 0.05, r1(lost / g.player.maxHp * 100) + "%");
    ok("G5 slam: never a kill from full health", g.player.hp > 0 && g.state === "GAMEPLAY");
    // the swipe
    quiet(b); b.swipeCd = 0; place(b.pos.x, b.pos.z + b.rig.R + 1.5); up(1);
    ok("G5 every boss: a swipe, warned by a red wedge", B.dangers().some((d) => d.kind === "sector"));
    // Searing Gaze
    b = toBoss("eye", 5); quiet(b);
    b.pos.set(cx, 0, -45);
    // mode: "stand", "walk" or "sprint", straight down the field away from her
    const gaze = (slot, mode, sec) => {
      quiet(b); g.player.hp = g.player.maxHp; g.stamina = g.maxStamina; g.staminaExhausted = false;
      place(cx, -28); g.yawObject.rotation.y = Math.PI; g.pitchObject.rotation.x = 0; g.player.currentSlot = slot; g.weaponAnim.switchT = 0;
      G.Input.keys = {};
      if (mode !== "stand") G.Input.keys[G.save.settings.keybinds.forward] = true;
      if (mode === "sprint") G.Input.keys[G.save.settings.keybinds.sprint] = true;
      b.abilityCd = 0; up(1); b.abilityCd = 999;
      const t = taken();
      sim(sec);
      G.Input.keys = {};
      return taken() - t;
    };
    // (yaw 0 faces -z; Math.PI faces +z: away from the boss, down the field)
    const heavy = Object.values(G.WEAPON_DEFS).filter((w) => G.weightClass(w).key === "very_heavy" && !w.boxOnly)[0];
    g.player.gunSlots = ["pistol", heavy.id];
    g.player.ammo[heavy.id] = { mag: heavy.magSize, reserve: heavy.magSize * 4 };
    g.player.weaponLevels[heavy.id] = { dmg: 1, rate: 1, mag: 1 };
    const stood = gaze(1, "stand", 4.5);
    ok("G5 gaze: standing still, it burns you", stood > 0, r1(stood / g.player.maxHp * 100) + "%");
    const walked = gaze(1, "walk", 4.5);
    ok("G5 gaze: walking away (pistol), it stays on you", walked > g.player.maxHp * 0.2, r1(walked / g.player.maxHp * 100) + "%");
    const sprintLight = gaze(1, "sprint", 4.5);
    ok("G5 gaze: sprinting away with the pistol, untouched", sprintLight === 0, r1(sprintLight));
    const sprintHeavy = gaze(2, "sprint", 4.5);
    ok("G5 gaze: sprinting with the heaviest gun, untouched too", sprintHeavy === 0, heavy.id + " " + r1(sprintHeavy / g.player.maxHp * 100) + "%");
    g.player.currentSlot = 1;
    // Deafening Roar
    b = toBoss("headmaster", 5); quiet(b); b.pos.set(cx, 0, -40);
    place(cx, -40 + 16); b.abilityCd = 0; up(1); b.abilityCd = 999;
    const roarD = B.dangers().find((d) => d.kind === "roar");
    t0 = taken(); sim(5.8);
    ok("G5 roar: outside the ring, nothing", roarD && taken() === t0 && g.bossSlow === 1, roarD && roarD.r);
    quiet(b); g.player.hp = g.player.maxHp; place(cx, -40 + 5); b.abilityCd = 0; up(1); b.abilityCd = 999;
    t0 = taken(); sim(2); const slowIn = g.bossSlow;
    sim(3.8);
    ok("G5 roar: inside, burning and at half speed until it ends", taken() > t0 && slowIn === 0.5 && g.bossSlow === 1, r1(taken() - t0) + " slow " + slowIn);
    // Brood Call
    b = toBoss("matron", 10); quiet(b); b.pos.set(cx, 0, -40); place(cx, -25);
    b.abilityCd = 0; up(1); b.abilityCd = 999;
    ok("G5 summon: marks on the ground first", B.dangers().filter((d) => d.kind === "summon").length >= 3);
    sim(2.2);
    ok("G5 summon: ordinary zombies with words come up", g.zombies.length >= 3 && g.zombies.every((z) => z.word && z.minion), g.zombies.length);
    ok("G5 ... one of them is the word to shoot", !!g.targetPair && g.zombies.some((z) => z.word === g.targetPair[0]));
    // Bull Rush
    b = toBoss("coach", 5); quiet(b); b.pos.set(cx, 0, -45); place(cx, -25);
    b.abilityCd = 0; up(1); b.abilityCd = 999;
    const lane = B.dangers().find((d) => d.kind === "lane");
    ok("G5 charge: a lane to the arena's edge", lane && lane.len > 15, lane && r1(lane.len));
    sim(0.4); place(cx + 6, -25);
    t0 = taken(); sim(4.5);
    ok("G5 charge: stepped aside, no damage; he hits the wall and is open", taken() === t0 && b.pos.z > A0.rect.maxZ - b.rig.R - 0.6 && (b.vuln === 1.5 || b.vulnT > 0), r1(b.pos.z));
    quiet(b); b.pos.set(cx, 0, -45); b.vuln = 1; g.player.hp = g.player.maxHp; place(cx, -25); b.abilityCd = 0; up(1); b.abilityCd = 999;
    t0 = taken(); sim(3.2);
    ok("G5 charge: in the lane, run down", taken() > t0);
    // Root Ripple
    b = toBoss("thorn", 5); quiet(b); b.pos.set(cx, 0, -40); place(cx, -32);
    b.abilityCd = 0; up(1); b.abilityCd = 999;
    t0 = taken();
    // jump every ring as it arrives
    sim(6, () => {
      const d = Math.hypot(g.yawObject.position.x - b.pos.x, g.yawObject.position.z - b.pos.z);
      const ring = B.dangers().find((q) => q.kind === "ring" && q.r > 1.6 && Math.abs(q.r - d) < 1.6 && q.r < d);
      if (ring && g.velocityY === 0) G.Input.keys[G.save.settings.keybinds.jump] = true; else G.Input.keys[G.save.settings.keybinds.jump] = false;
    });
    G.Input.keys = {};
    ok("G5 roots: jumping each ring, no damage", taken() === t0, r1(taken() - t0));
    quiet(b); g.player.hp = g.player.maxHp; place(cx, -32); b.abilityCd = 0; up(1); b.abilityCd = 999;
    t0 = taken(); let rooted = 0;
    sim(5, () => { if (g.bossRootT > 0) rooted++; });
    ok("G5 roots: standing, hit and held", taken() > t0 && rooted > 0);
    // Forked Fury
    b = toBoss("storm", 5); quiet(b); b.pos.set(cx, 0, -45); place(cx, -25);
    b.abilityCd = 0; up(1); b.abilityCd = 999;
    t0 = taken();
    sim(4, () => {
      // step out of any circle that is about to strike
      const P = g.yawObject.position;
      const bad = B.dangers().find((d) => d.kind === "circle" && Math.hypot(P.x - d.x, P.z - d.z) < d.r + 0.6);
      if (bad) { let best = null; for (let a = 0; a < 16; a++) { const x = P.x + Math.cos(a / 16 * 6.28) * 0.12, z = P.z + Math.sin(a / 16 * 6.28) * 0.12; const s = Math.min(...B.dangers().filter((d) => d.kind === "circle").map((d) => Math.hypot(x - d.x, z - d.z) - d.r)); if (!best || s > best.s) best = { x, z, s }; } g.tryMove(best.x - P.x, best.z - P.z); }
    });
    ok("G5 lightning: out of the circles, no damage", taken() === t0, r1(taken() - t0));
    quiet(b); g.player.hp = g.player.maxHp; place(cx, -25); b.abilityCd = 0; up(1); b.abilityCd = 999;
    t0 = taken(); sim(4);
    ok("G5 lightning: standing still, struck", taken() > t0);
    // Acid Rain
    b = toBoss("chemist", 5); quiet(b); b.pos.set(cx, 0, -40); place(cx, -28);
    b.abilityCd = 0; up(1); b.abilityCd = 999;
    sim(2.2);
    ok("G5 acid: pools on the ground afterwards", B.pools.length >= 3, B.pools.length);
    const pool = B.pools[0];
    quiet(b); t0 = taken(); place(pool.x, pool.z); sim(1);
    ok("G5 acid: standing in a pool burns", taken() > t0);
    place(A0.rect.minX + 2, A0.rect.minZ + 2); t0 = taken(); sim(1);
    ok("G5 acid: out of the pools, nothing", taken() === t0);
    // Event Horizon
    b = toBoss("void", 5); quiet(b); b.pos.set(cx, 0, -40); b.root.rotation.y = 0; place(cx, -30);
    b.abilityCd = 0; up(1); b.abilityCd = 999;
    const pull = B.dangers().find((d) => d.kind === "pull");
    sim(1.4); const z0 = g.yawObject.position.z; sim(1.5);
    ok("G5 vortex: pulls the player in", pull && g.yawObject.position.z < z0 - 1, r1(z0 - g.yawObject.position.z));
    ok("G5 vortex: slower than a walk", pull && pull.speed < 3.2, pull && pull.speed);
    // Trick Question
    b = toBoss("examiner", 5); quiet(b); b.pos.set(cx, 0, -40); place(cx, -28);
    b.abilityCd = 0; up(1); b.abilityCd = 999;
    sim(1.0);
    const figs = B.dangers().filter((d) => d.kind === "figure");
    ok("G5 clones: copies round the player, one real", figs.length >= 3 && figs.filter((f) => f.real).length === 1, figs.length);
    ok("G5 clones: the copies are see-through (the tell)", B.clones.length >= 2 && B.clones.every((c) => c.mats.every((m) => m.transparent && m.opacity < 1)));
    const cl = B.clones[0], hp0 = b.hp;
    const res = B.onShot(g, cl.hitboxes[0], 50, cl.root.position.clone());
    ok("G5 clones: one shot pops a copy, the boss is not hurt", res.hit && cl.popped && b.hp === hp0);
    const real = B.onShot(g, b.rig.hitboxes[0], 50, b.pos.clone());
    ok("G5 clones: the real one takes the damage", real.hit && b.hp < hp0);
    B.reset(g);
  }

  // ---------------- G6: after the boss ----------------
  async function after() {
    fresh(1);
    const path = (answer) => {
      const b = toBoss("gravedigger", 5);
      const money0 = g.player.money;
      B.damage(g, 1e9, null);
      const dying = B.phase === "dying" && G.Cutscene.active && G.Cutscene.kind === "death";
      let n = 0; while (G.Cutscene.active && n < 500) { up(1); n++; }
      const q = !!g.challenge && G.Modal.isOpen("challenge") && document.getElementById("hud-challenge-box").classList.contains("boss");
      const pair = g.challenge && g.challenge.pair;
      const wallsGone = G.Arena.cols.length === 0;
      let hiveOpen = false;
      if (answer === "right") { g.answerChallenge(g.challenge.choices.indexOf(pair[0])); hiveOpen = G.Modal.isOpen("abilities"); hive(); }
      else if (answer === "wrong") g.answerChallenge(g.challenge.choices.findIndex((c) => c !== pair[0]));
      else { g.challenge.timeLeft = 0.01; g.updateChallengeTimer(0.05); }
      const quizzed = quiz(true);
      return { dying, n, q, pair, wallsGone, hiveOpen, quizzed, result: g._bossQuestion.result, state: g.state, shop: G.Modal.isOpen("shop"), phase: B.phase, money: g.player.money - money0 };
    };
    const a = path("right");
    ok("G6 1: a grand death (4.6 s), the walls come down", a.dying && Math.abs(a.n - 276) <= 1 && a.wallsGone, a.n);
    ok("G6 2: then one hard word, against the clock", a.q && a.pair && g._bossQuestion);
    // (the wave's quiz comes between -- tools/round8-test.js follows a whole
    // boss wave; here no zombie came before the boss, so there are no words
    // to ask and it is skipped)
    ok("G6 right answer: 3: the ability choice, then the shop", a.result === "right" && a.hiveOpen && a.state === "SHOP" && a.shop && a.phase === null);
    ok("G6 the shop has Ready, a timer and the rotating perks", !!document.getElementById("btn-shop-continue") && g._perkOffer.length === 4);
    ok("G6 the bounty is paid", a.money === G.ECONOMY.waveBonus(5) + G.ECONOMY.bossBounty(5), a.money);
    g.leaveShop();
    ok("G6 6: then the next wave", g.wave === 6 && g.state === "GAMEPLAY");
    const w = path("wrong");
    ok("G6 wrong answer: no ability, the shop", w.result === "wrong" && w.state === "SHOP" && w.phase === null);
    g.leaveShop();
    const t = path("timeout");
    ok("G6 out of time: the shop, the word noted", t.result === "timeout" && t.state === "SHOP" && !!g.wrongWordsThisRun[t.pair[0]]);
    g.leaveShop();
    // wave 10: the checkpoint hook (round 3)
    toBoss("eye", 10); B.damage(g, 1e9, null);
    let n = 0; while (G.Cutscene.active && n < 500) { up(1); n++; }
    g.answerChallenge(0); hive(); quiz(true);
    ok("G6 5: after wave 10's boss the checkpoint is due (kept in round 3)", g._checkpointDue === true);
    g.leaveShop();
    ok("G6 5: ...and kept as the shop closes", G.Checkpoint.has(1) && G.Checkpoint.get(1).wave === 11);
    ok("G4 names on the result screen", (() => { G.UI.renderResultScreen("win", { score: 1, wave: 20, correct: 1, wrong: 0, money: 0, bosses: B.run.downs }, {}); const t = document.getElementById("victory-review").textContent; return /Mortimer Grave, The Relentless/.test(t) && /Iris Glare, The Omniscient/.test(t); })());
    ok("G4 met and beaten go into the save", G.save.bosses.seen.gravedigger >= 3 && G.save.bosses.defeated.gravedigger >= 3);
    ok("G4 objective: bosses x/4", (() => { const r = G.Objectives.list(g).find((x) => /bosses/.test(x.label)); return r && /\/ 4$/.test(r.value); })());
    // wave 20: the fourth boss, objectives done -> victory
    const S = G.Objectives.state; S.latched = true; S.keysFound = S.keysTotal; for (let i = 0; i < S.roomsNeeded; i++) S.visited.add("test" + i); g.notesReadRun = new Set(["a", "b", "c", "d"]); S.bossesDown = 3;
    toBoss("coach", 20); B.damage(g, 1e9, null);
    n = 0; while (G.Cutscene.active && n < 500) { up(1); n++; }
    g.answerChallenge(0); hive();
    ok("G6 wave 20's boss down, objectives done: Victory", g.state === "VICTORY", g.state);
    ok("J3 a win deletes the level's checkpoint", !G.Checkpoint.has(1));
  }

  // ---------------- the Boss Codex ----------------
  async function codex() {
    g = G.Game;
    g.quitToMainMenu();
    const icon = document.querySelector('.lobby-icon[data-icon="bosses"]');
    ok("G4 lobby: a 'Bosses' icon, 'Boss Codex' as its tooltip", icon && icon.querySelector(".li-label").textContent === "Bosses" && icon.dataset.tip === "Boss Codex");
    G.save.bosses = { seen: { void: 2, examiner: 1 }, defeated: { void: 1 } };
    icon.click();
    ok("G4 the codex opens", G.UI._currentScreen === "screen-bosses");
    const cards = Array.from(document.querySelectorAll("#codex-grid .codex-card"));
    ok("G4 ten cards", cards.length === 10);
    const lockedC = cards.filter((c) => c.classList.contains("locked"));
    ok("G4 unseen: a silhouette and ???", lockedC.length === 8 && lockedC.every((c) => /\?\?\?/.test(c.textContent) && c.querySelector("img[data-sil]")));
    const seenC = cards.find((c) => c.dataset.id === "void");
    ok("G4 seen: name, epithet, Thai, move", seenC && /Warden Vex/.test(seenC.textContent) && /The Insatiable/.test(seenC.textContent) && seenC.textContent.includes(G.BOSS_WORDS.insatiable.th) && /Event Horizon/.test(seenC.textContent), seenC && seenC.textContent);
    await new Promise((r) => setTimeout(r, 400));
    const pic = G.BossModels.portrait("void", false), sil = G.BossModels.portrait("gravedigger", true);
    ok("G4 pictures: the boss in colour, the unseen as a silhouette", /^data:image\/png/.test(pic) && /^data:image\/png/.test(sil) && pic !== sil);
    seenC.click();
    ok("G4 a card opens as a window (G.Modal)", G.Modal.isOpen("codex") && !document.getElementById("codex-detail").classList.contains("hidden"));
    ok("G4 ... with the move and the way out", /pull is slower than your walk/.test(document.getElementById("codex-d-counter").textContent));
    ok("G4 a controller works inside it", G.Pad.scope() === document.getElementById("codex-detail"));
    key("Escape");
    ok("G4 Escape closes it", !G.Modal.isOpen("codex") && document.getElementById("codex-detail").classList.contains("hidden"));
    document.getElementById("btn-codex-back").click();
    ok("G4 Back to the lobby", G.UI._currentScreen === "screen-mainmenu");
    // the save
    const bad = G.normalizeSave({ unlockedLevels: [1], bosses: { seen: { void: "3", "<x>": 4, eye: -1 }, defeated: [] } });
    ok("G4 save: bosses cleaned on load/import", bad.bosses.seen.void === 3 && !("<x>" in bad.bosses.seen) && !("eye" in bad.bosses.seen) && typeof bad.bosses.defeated === "object");
    ok("G4 save: older saves get an empty codex", JSON.stringify(G.normalizeSave({ unlockedLevels: [1] }).bosses) === '{"seen":{},"defeated":{}}');
  }

  // ---------------- text ----------------
  function text() {
    const miss = [];
    G.BOSS_DEFS.forEach((d) => ["name", "ability", "desc", "counter", "look", "weak"].forEach((k) => { if (!G.STRINGS.en["boss." + d.id + "." + k]) miss.push(d.id + "." + k); }));
    ok("every boss: name, move, description, counterplay, look, weak spot", miss.length === 0, miss.join(","));
    ok("every epithet is a C1/C2 word with its Thai", G.BOSS_DEFS.every((d) => G.BOSS_WORDS[d.word] && G.BOSS_WORDS[d.word].th && /^C[12]$/.test(G.BOSS_WORDS[d.word].cefr)));
    ok("ten unique names, epithets, moves and cutscenes", ["id", "word", "ability", "intro"].every((k) => new Set(G.BOSS_DEFS.map((d) => d[k])).size === 10));
    // (the Thai block, built from char codes so this file has no Thai in it)
    const THAI = new RegExp("[" + String.fromCharCode(0x0E00) + "-" + String.fromCharCode(0x0E7F) + "]");
    const thaiInStrings = Object.entries(G.STRINGS.en).filter(([k, v]) => /^(boss|codex|cine)\./.test(k) && THAI.test(v));
    ok("no Thai in the UI text (only the vocabulary)", thaiInStrings.length === 0);
  }

  async function run() {
    results.length = 0;
    const saved = JSON.stringify(G.save);
    G._missingKeys = {};
    try {
      text();
      await waves(); await tick();
      await arrival(); await tick();
      await moves(); await tick();
      await after(); await tick();
      await codex();
      ok("no missing strings", Object.keys(G._missingKeys || {}).length === 0, Object.keys(G._missingKeys || {}).join(","));
    } catch (e) {
      ok("no exception", false, String(e && e.stack || e));
    } finally {
      G.save = JSON.parse(saved);
      G.Input.keys = {};
      G.Modal.reset();
      if (G.Game._upd) G.Game.update = G.Game._upd;
      G.Game.quitToMainMenu();
    }
    const fail = results.filter((r) => !r.pass);
    return { total: results.length, pass: results.length - fail.length, fail, results };
  }
  return { run };
})();
