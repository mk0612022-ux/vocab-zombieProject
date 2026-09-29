// Dev-only (not shipped). Newer list, round 2: the bosses' three phases
// (66% and 33%, the roar, the body, the bar's marks), their twenty new moves
// -- each warned before it lands and each with a way out that works -- the
// difficulty by wave, no blow that kills from full health, the Boss Codex
// with all three moves, and every number in js/config.js.
// The save is put back afterwards.
//   const r = await G.Round9Test.run();   r.fail -> []
window.G = window.G || {};
G.Round9Test = (function () {
  const results = [];
  const ok = (name, cond, info) => results.push({ name, pass: !!cond, info: info === undefined ? "" : info });
  const tick = () => new Promise((r) => { const ch = new MessageChannel(); ch.port1.onmessage = () => r(); ch.port2.postMessage(0); });
  const DT = 1 / 60;
  const r1 = (v) => Math.round(v * 10) / 10;
  let g, B;
  const up = (n) => { for (let i = 0; i < (n || 1); i++) g._upd.call(g, DT); };

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
  function toBoss(id, wave) {
    if (G.Cutscene.active) G.Cutscene.stop();
    if (B.boss || B.phase) B.reset(g);
    G.Modal.reset(); g.paused = false; g.state = "GAMEPLAY"; G.UI.showScreen(null);
    g.player.hp = g.player.maxHp;
    g.wave = (wave || 10) - 1; g.startWave();
    g.spawnedCount = g.requiredKills; g.clearZombies();
    B.forceNext = id;
    g.checkWaveClear();
    up(1);
    let n = 0; while (G.Cutscene.active && n < 700) { up(1); n++; }
    return B.boss;
  }
  function quiet(b) { if (b.act && b.act.end) b.act.end(); b.act = null; b.swipeCd = 999; b.abilityCd = 999; }
  const A = () => B.arena;
  const mid = () => ({ x: (A().rect.minX + A().rect.maxX) / 2, z: (A().rect.minZ + A().rect.maxZ) / 2 });
  function place(x, z) { g.yawObject.position.set(x, A().floorY + 1.7, z); g._prevPos = null; }
  const P = () => g.yawObject.position;
  const taken = () => B.stats.taken;
  // the boss mid-arena, the player 6 m off, and move `id` started
  function cast(b, id) {
    quiet(b); B.clearObjs(g); g.clearZombies();
    const m = mid();
    b.pos.set(m.x, A().floorY, m.z - 6); place(m.x, m.z + 6);
    g.player.hp = g.player.maxHp; g.bossRootT = 0; g.bossSedateT = 0; g.bossSlow = 1;
    b.act = G.BossAbil[id](B, g, b); b.act.ability = true; b.act.id = id;
    // (one frame: its marks go up)
    up(1); b.swipeCd = 999;
    return b.act;
  }
  // run the move until it (and whatever it left) is over, or sec; each(i)
  // plays the player's part
  function play(b, sec, each) {
    const n = Math.round(sec / DT);
    for (let i = 0; i < n; i++) {
      if (each) each(i);
      up(1);
      b.swipeCd = 999;
      if (!B.boss || B.phase !== "fight") break;
      if (!b.act) { b.abilityCd = 999; if (!B.objs.length) break; }
    }
  }
  // the player's legs: step towards (x, z) at up to `speed` m/s this frame
  function walk(x, z, speed) {
    const p = P(), dx = x - p.x, dz = z - p.z, d = Math.hypot(dx, dz);
    if (d < 0.02) return;
    const s = Math.min(d, (speed || 5.2) * DT);
    g.tryMove(dx / d * s, dz / d * s);
  }
  // the way out of whatever is marked: the nearest point (of a ring round the
  // player) that no danger covers (the playtest bot's rule, simplified)
  function inDanger(x, z, list) {
    return list.some((d) => {
      const dd = Math.hypot(x - d.x, z - d.z);
      if (d.kind === "circle" || d.kind === "summon" || d.kind === "blade") return dd < d.r + 0.5;
      if (d.kind === "sector") { let a = Math.atan2(x - d.x, z - d.z) - d.yaw; a = Math.atan2(Math.sin(a), Math.cos(a)); return dd < d.r + 0.8 && Math.abs(a) < d.half + 0.25; }
      if (d.kind === "lane") { const px = x - d.x, pz = z - d.z, al = px * d.dx + pz * d.dz, ac = Math.abs(px * d.dz - pz * d.dx); return al > -1 && al < d.len + 1 && ac < d.w + 0.6; }
      if (d.kind === "safe") return dd > d.r - 0.8;
      return false;
    });
  }
  function evade(speed) {
    const list = B.dangers(), p = P();
    if (!inDanger(p.x, p.z, list)) return;
    const r = A().rect;
    // (of the safe spots nearest, the one with the most room round it)
    const room = (x, z) => Math.min(x - r.minX, r.maxX - x, z - r.minZ, r.maxZ - z, ...list.map((d) => Math.hypot(x - d.x, z - d.z)));
    for (let rr = 1; rr <= 16; rr += 1) {
      let best = null, bs = -1;
      for (let k = 0; k < 24; k++) {
        const a = k / 24 * Math.PI * 2, x = p.x + Math.sin(a) * rr, z = p.z + Math.cos(a) * rr;
        if (x < r.minX + 1 || x > r.maxX - 1 || z < r.minZ + 1 || z > r.maxZ - 1) continue;
        if (inDanger(x, z, list)) continue;
        const s = room(x, z);
        if (s > bs) { bs = s; best = { x, z }; }
      }
      if (best) { walk(best.x, best.z, speed); return; }
    }
  }

  // ================================================================
  // every number in one file; three moves each, thirty in all
  // ================================================================
  function config() {
    const C = G.CONFIG.boss, ids = G.BOSS_DEFS.map((d) => d.moves).flat();
    ok("config: thirty moves, three a boss, none twice", ids.length === 30 && new Set(ids).size === 30 && G.BOSS_DEFS.every((d) => d.moves.length === 3 && d.moves[0] === d.ability), ids.join(","));
    ok("config: every move has its numbers in js/config.js", ids.every((m) => C.moves[m]) && !!C.moves.swipe, ids.filter((m) => !C.moves[m]).join(","));
    ok("config: every move is there to cast", ids.every((m) => typeof G.BossAbil[m] === "function"));
    ok("config: phases at 66% and 33%", C.phases[0] === 0.66 && C.phases[1] === 0.33);
    const miss = [];
    G.BOSS_DEFS.forEach((d) => d.moves.slice(1).forEach((m) => ["name", "desc", "counter", "hint"].forEach((k) => { if (!G.STRINGS.en["boss.move." + m + "." + k]) miss.push(m + "." + k); })));
    ok("strings: every new move has a name, what it does, the way out and a hint", miss.length === 0, miss.join(","));
    const THAI = new RegExp("[" + String.fromCharCode(0x0E00) + "-" + String.fromCharCode(0x0E7F) + "]");
    ok("strings: all English", !Object.entries(G.STRINGS.en).some(([k, v]) => /^(boss\.move|boss\.phase|codex\.phase)/.test(k) && THAI.test(v)));
  }

  // ================================================================
  // the phases
  // ================================================================
  function phases() {
    fresh(1);
    const b = toBoss("gravedigger", 10);
    quiet(b);
    const mark2 = document.getElementById("hud-boss-mark2"), mark3 = document.getElementById("hud-boss-mark3");
    up(1);
    ok("bar: marks where phases 2 and 3 begin (66%, 33%)", mark2.style.left === "66%" && mark3.style.left === "33%" && !mark2.classList.contains("passed"), mark2.style.left + " " + mark3.style.left);
    ok("phase 1 at full health: its old move", b.phaseN === 1 && B.nextMove(b) === "slam" && B.nextMove(b) === "slam");
    const s0 = b.root.scale.x, t0 = taken();
    b.hp = b.maxHp * 0.65; up(1);
    ok("66%: phase 2 -- a roar first (it stands, the move under way dropped)", b.phaseN === 2 && b.act && b.act.phaseShift);
    const banner = document.getElementById("hud-purchase-banner") || document.querySelector(".hud-purchase-banner");
    ok("... the banner names the new move", banner && /Phase 2/.test(banner.textContent) && /Tombstone Ward/.test(banner.textContent), banner && banner.textContent);
    const hbox = g.drops.find((d) => d.arena && d.kind === "health");
    ok("... and it drops a health box", !!hbox);
    if (hbox) { g.player.hp = 100; g.collectDrop(hbox); }
    ok("... worth " + G.CONFIG.boss.arenaHealth.heal * 100 + "% of full health", hbox && Math.abs(g.player.hp - (100 + g.player.maxHp * G.CONFIG.boss.arenaHealth.heal)) < 0.01, r1(g.player.hp));
    g.player.hp = g.player.maxHp;
    let n = 0; while (b.act && b.act.phaseShift && n++ < 300) up(1);
    ok("... the body grows (and glows)", b.root.scale.x > s0 + 0.05 && b.scale === G.CONFIG.boss.phaseScale[1], r1(b.root.scale.x * 100) / 100);
    ok("... the roar itself hurts no one", taken() === t0);
    ok("bar: the 66% mark lit, the bar's colour changes", mark2.classList.contains("passed") && document.getElementById("hud-boss-bar").classList.contains("phase2"));
    quiet(b); b.phaseCasts = 0;
    const seq2 = [0, 1, 2, 3, 4, 5].map(() => B.nextMove(b));
    ok("phase 2: the first new move, and the old one every third time", seq2.join(",") === "ward,ward,slam,ward,ward,slam", seq2.join(","));
    const cd2 = B.cooldown(g, b);
    b.hp = b.maxHp * 0.3; up(1);
    n = 0; while (b.act && b.act.phaseShift && n++ < 300) up(1);
    ok("33%: phase 3 (and enraged)", b.phaseN === 3 && b.enraged && mark3.classList.contains("passed") && document.getElementById("hud-boss-bar").classList.contains("phase3"));
    quiet(b); b.phaseCasts = 0; b.comboNext = null;
    const seq3 = [];
    for (let i = 0; i < 6; i++) seq3.push(B.nextMove(b));
    ok("phase 3: the second new move, chained into the others (combos)", seq3.join(",") === "graveyard,graveyard,ward,graveyard,graveyard,slam", seq3.join(","));
    ok("phase 3: moves come sooner", B.cooldown(g, b) < cd2, r1(cd2) + " -> " + r1(B.cooldown(g, b)));
    ok("phase 3: faster, warnings a little shorter", B.speedK(g, b) > B.ws(g, G.CONFIG.boss.byWave.speed) && B.warnK(g, b) < B.ws(g, G.CONFIG.boss.byWave.warn));
    // a combo: the next move follows almost at once
    quiet(b); b.phaseCasts = 1; b.comboNext = null;
    b.abilityCd = 0; up(1);
    const first = b.act && b.act.id;
    let k = 0; while (b.act && k++ < 1200) { g.player.hp = g.player.maxHp; up(1); b.swipeCd = 999; }
    ok("combo: after its move, the next is due in " + G.CONFIG.boss.comboGap + " s", first === "graveyard" && b.comboNext === "ward" && b.abilityCd <= G.CONFIG.boss.comboGap + 0.01, first + " cd " + r1(b.abilityCd));
    B.reset(g);
  }

  // ================================================================
  // difficulty by wave; never a kill from full health
  // ================================================================
  function waves() {
    fresh(1);
    const b = toBoss("coach", 5);
    quiet(b);
    const w5 = { warn: B.warnK(g, b), speed: B.speedK(g, b), cd: B.cooldown(g, b) };
    g.wave = 20;
    const w20 = { warn: B.warnK(g, b), speed: B.speedK(g, b), cd: B.cooldown(g, b) };
    ok("wave 5: longer warnings, slower, rarer moves; wave 20 the fastest", w5.warn > w20.warn && w5.speed < w20.speed && w5.cd > w20.cd, JSON.stringify({ w5, w20 }));
    ok("a move that fills the arena (eggs, a gas cloud) is followed by a longer wait", B.cooldown(g, b, "eggs") > B.cooldown(g, b) * 1.5 && B.cooldown(g, b, "miasma") > B.cooldown(g, b) * 1.5 && B.cooldown(g, b, "ball") === B.cooldown(g, b));
    g.wave = 5;
    const hp0 = g.player.maxHp; g.player.hp = hp0;
    B.hurt(g, 5, { src: "test" });
    ok("no single blow kills from full health (even a huge one)", g.player.hp >= 1 && g.state === "GAMEPLAY", r1(g.player.hp));
    g.player.hp = hp0 * 0.5; B.hurt(g, 0.1, { src: "test" }); const lost5 = hp0 * 0.5 - g.player.hp;
    g.wave = 20; g.player.hp = hp0 * 0.5; B.hurt(g, 0.1, { src: "test" }); const lost20 = hp0 * 0.5 - g.player.hp;
    ok("its moves hit harder at wave 20", lost20 > lost5, r1(lost5) + " < " + r1(lost20));
    B.reset(g);
  }

  // ================================================================
  // the twenty new moves: warned first, and each with a way out
  // ================================================================
  function moves() {
    fresh(1);
    let b, t0;
    // ---------- Mortimer Grave ----------
    b = toBoss("gravedigger", 10);
    cast(b, "ward");
    ok("Tombstone Ward: graves marked before anything rises", B.dangers().filter((d) => d.kind === "summon").length >= 3);
    play(b, 3);
    const keepers = g.zombies.filter((z) => z.alive && z.keeper);
    ok("... grave-keepers climb out; he takes only 15%", keepers.length >= 3 && b.armor === G.CONFIG.boss.moves.ward.armor, keepers.length);
    const hp1 = b.hp; B.damage(g, 100, null); ok("... armoured: 100 damage -> " + G.CONFIG.boss.moves.ward.armor * 100, Math.abs(hp1 - b.hp - G.CONFIG.boss.moves.ward.armor * 100) < 0.01, r1(hp1 - b.hp));
    // a wrong kill: that grave fills again
    const kw = keepers[0];
    g.targetPair = [keepers[1].word, keepers[1].meaning];
    kw.hp = 0; kw.alive = false; g.onZombieDeath(kw);
    play(b, 1.3);
    ok("... a keeper shot by the wrong word: its grave fills again", g.zombies.filter((z) => z.alive && z.keeper).length === keepers.length);
    // the right words, one by one
    let guard = 0;
    while (b.armor < 1 && guard++ < 12) {
      const k = g.zombies.find((z) => z.alive && z.keeper);
      if (!k) { play(b, 1.2); continue; }
      g.targetPair = [k.word, k.meaning];
      k.hp = 0; k.alive = false; g.onZombieDeath(k);
      up(1);
    }
    ok("... every keeper shot by its word: the ward breaks, he is stunned and open", b.armor === 1 && b.vulnT > 0 && b.vuln > 1, "armor " + b.armor + " vulnT " + r1(b.vulnT));
    play(b, 2);
    b = B.boss; quiet(b); g.clearZombies();
    // Graveyard Shift
    cast(b, "graveyard");
    ok("Graveyard Shift: squares marked round the player first", B.dangers().filter((d) => d.kind === "circle").length >= 8);
    t0 = taken();
    play(b, 10, () => { g.player.hp = g.player.maxHp; evade(5.2); });
    ok("... stepping onto unmarked squares each time: untouched", taken() === t0, r1(taken() - t0));
    cast(b, "graveyard"); t0 = taken();
    play(b, 10, () => { g.player.hp = g.player.maxHp; });
    ok("... standing still: hit", taken() > t0);
    // ---------- Iris Glare ----------
    b = toBoss("eye", 10);
    cast(b, "orbs");
    play(b, 2);
    const orbs = B.targets.filter((tg) => tg.kind === "orb");
    ok("Watcher Orbs: eyes float out (things to shoot down)", orbs.length >= 3, orbs.length);
    ok("... slower than a walk", G.CONFIG.boss.moves.orbs.speed[1] < G.CONFIG.player.walkSpeed);
    t0 = taken();
    orbs.forEach((tg) => B.onShot(g, tg.hb, 10, tg.hb.getWorldPosition(new THREE.Vector3())));
    play(b, 3);
    ok("... one hit pops each: all gone, nothing reaches you", B.targets.filter((tg) => tg.kind === "orb").length === 0 && taken() === t0);
    cast(b, "orbs"); t0 = taken();
    play(b, 12, () => { g.player.hp = g.player.maxHp; });
    ok("... left alone, they reach you and burst", taken() > t0);
    // Mirror Gaze
    cast(b, "mirror");
    ok("Mirror Gaze: a hint to hold fire", /hold your fire/i.test(document.getElementById("hud-boss-hint").textContent));
    play(b, G.CONFIG.boss.moves.mirror.wind * B.warnK(g, b) + 0.3);
    ok("... it glows gold and reflects", b.reflect);
    const hpB = b.hp; t0 = taken();
    const res = B.onShot(g, b.rig.hitboxes[0], 50, b.pos.clone().setY(b.pos.y + 3));
    ok("... a round that hits comes back at you (and hurts it not at all)", res.reflected && b.hp === hpB && taken() > t0);
    let n = 0; while ((b.reflect || !b.weakOpen) && b.act && n++ < 900) up(1);
    ok("... then the eye opens: the pupil laid bare", b.weakOpen && b.weakMult === G.CONFIG.boss.moves.mirror.weakMult);
    const weak = b.rig.hitboxes.find((h) => h.userData.bossHit.weak), hpW = b.hp;
    B.onShot(g, weak, 20, weak.getWorldPosition(new THREE.Vector3()));
    ok("... the pupil takes 2.5x", Math.abs(hpW - b.hp - 50) < 0.01, r1(hpW - b.hp));
    quiet(b);
    // ---------- Headmaster Bellow ----------
    b = toBoss("headmaster", 10);
    cast(b, "detention");
    const cage = B.dangers().find((d) => d.kind === "cage");
    ok("Detention: a chalk ring round you with a green gap", cage && cage.r > 5 && cage.gapHalf > 0.3);
    const c0 = { x: cage.x, z: cage.z };
    // straight out the wrong side: held back, stung
    const bad = cage.gapYaw + Math.PI;
    t0 = taken();
    play(b, 2.5, () => { g.player.hp = g.player.maxHp; walk(c0.x + Math.sin(bad) * 12, c0.z + Math.cos(bad) * 12, 5.2); });
    ok("... the line holds you in and stings", Math.hypot(P().x - c0.x, P().z - c0.z) < cage.r + 0.3 && taken() > t0);
    // out through the gap
    cast(b, "detention");
    const cg = B.dangers().find((d) => d.kind === "cage");
    t0 = taken();
    play(b, 9, () => { g.player.hp = g.player.maxHp; walk(cg.x + Math.sin(cg.gapYaw) * 10, cg.z + Math.cos(cg.gapYaw) * 10, 3.2); });
    ok("... out through the gap (walking): untouched", taken() === t0 && Math.hypot(P().x - cg.x, P().z - cg.z) > 6, r1(taken() - t0));
    cast(b, "detention"); t0 = taken();
    play(b, 9, () => { g.player.hp = g.player.maxHp; });
    ok("... still inside when it closes: hit and held in detention", taken() > t0 && g.bossRootT > 0, r1(taken() - t0) + " root " + r1(g.bossRootT));
    // School Assembly
    cast(b, "assembly");
    const safe = B.dangers().find((d) => d.kind === "safe");
    ok("Assembly: one green circle, somewhere near", safe && Math.hypot(safe.x - P().x, safe.z - P().z) >= G.CONFIG.boss.moves.assembly.near - 0.01);
    t0 = taken();
    play(b, 14, () => { g.player.hp = g.player.maxHp; const s = B.dangers().find((d) => d.kind === "safe"); if (s) walk(s.x, s.z, 5.2); });
    ok("... sprinting into each circle in time: untouched", taken() === t0, r1(taken() - t0));
    cast(b, "assembly"); t0 = taken();
    play(b, 14, () => { g.player.hp = g.player.maxHp; });
    ok("... staying out: it burns", taken() > t0);
    // ---------- Matron Mildred ----------
    b = toBoss("matron", 10);
    cast(b, "needles");
    const lanes = B.dangers().filter((d) => d.kind === "lane");
    ok("Sedative Volley: purple lanes fan out first (an odd number: one at you)", lanes.length >= 3 && lanes.length % 2 === 1, lanes.length);
    t0 = taken();
    play(b, 9, () => { g.player.hp = g.player.maxHp; evade(5.2); });
    ok("... between the lanes: untouched", taken() === t0, r1(taken() - t0));
    cast(b, "needles"); t0 = taken(); let sed = false;
    play(b, 9, () => { g.player.hp = g.player.maxHp; if (g.bossSedateT > 0) sed = true; });
    ok("... in a lane: hit, and slowed", taken() > t0 && sed);
    // Brood Sacs
    cast(b, "eggs");
    play(b, 2.6);
    const eggs = B.targets.filter((tg) => tg.kind === "egg");
    ok("Brood Sacs: eggs land round you, pulsing (to shoot)", eggs.length >= 3, eggs.length);
    eggs.forEach((tg) => { for (let i = 0; i < 20 && !tg.down; i++) B.onShot(g, tg.hb, 14, null); });
    play(b, 10);
    ok("... shot in time: nothing hatches", g.zombies.filter((z) => z.alive).length === 0 && B.objs.length === 0);
    cast(b, "eggs");
    play(b, 12);
    ok("... left alone: they hatch into fast zombies", g.zombies.filter((z) => z.alive && z.type === "fast" && z.minion).length >= 3);
    g.clearZombies();
    // ---------- Coach Brutus ----------
    b = toBoss("coach", 10);
    cast(b, "ball");
    ok("Medicine Ball: its lane shown first", B.dangers().some((d) => d.kind === "lane"));
    t0 = taken();
    play(b, 16, () => { g.player.hp = g.player.maxHp; evade(5.2); });
    ok("... stepping out of each lane: untouched", taken() === t0, r1(taken() - t0));
    cast(b, "ball"); t0 = taken();
    play(b, 16, () => { g.player.hp = g.player.maxHp; });
    ok("... standing in it: hit", taken() > t0);
    // Offensive Line
    cast(b, "line");
    const segs = B.dangers().filter((d) => d.kind === "lane");
    ok("Offensive Line: a wall across the arena, gaps marked", segs.length >= 5);
    t0 = taken();
    play(b, 14, () => { g.player.hp = g.player.maxHp; evade(5.2); });
    ok("... in a gap when it passes: untouched", taken() === t0, r1(taken() - t0));
    // (the gap is never where you stand: standing still is a hit)
    cast(b, "line"); t0 = taken();
    play(b, 14, () => { g.player.hp = g.player.maxHp; });
    ok("... standing still: run down", taken() > t0);
    // ---------- Hedge Thornwood ----------
    b = toBoss("thorn", 10);
    cast(b, "bark");
    play(b, 2);
    ok("Barkskin: bark on, he walks faster", b.armor === G.CONFIG.boss.moves.bark.armor && B.speedK(g, b) > B.ws(g, G.CONFIG.boss.byWave.speed));
    const hb = b.hp; B.damage(g, 100, null);
    ok("... the body takes " + G.CONFIG.boss.moves.bark.armor * 100 + "%", Math.abs(hb - b.hp - G.CONFIG.boss.moves.bark.armor * 100) < 0.01, r1(hb - b.hp));
    n = 0; while (!b.weakOpen && n++ < 600) up(1);
    const heart = b.rig.hitboxes.find((h) => h.userData.bossHit.weak), hh = b.hp;
    B.onShot(g, heart, 20, heart.getWorldPosition(new THREE.Vector3()));
    ok("... the heart opens now and then: 2.5x, bark or not", b.weakOpen && Math.abs(hh - b.hp - 50) < 0.01, r1(hh - b.hp));
    play(b, 14);
    ok("... it wears off", b.armor === 1 && !b.weakOpen);
    // Overgrowth
    cast(b, "overgrowth");
    ok("Overgrowth: lines marked out from him first", B.dangers().filter((d) => d.kind === "lane").length >= 3);
    t0 = taken();
    play(b, 11, () => { g.player.hp = g.player.maxHp; evade(5.2); });
    ok("... off the lines: untouched", taken() === t0, r1(taken() - t0));
    cast(b, "overgrowth");
    // (the line aimed at the player: stand on it)
    const ln = B.dangers().find((d) => d.kind === "lane");
    t0 = taken();
    let k2 = 0; while (b.act && k2++ < 400) { g.player.hp = g.player.maxHp; up(1); }
    const burst = taken() - t0;
    // back onto the thorn wall it left
    place(ln.x + ln.dx * 5, ln.z + ln.dz * 5); t0 = taken();
    for (let i = 0; i < 40; i++) { g.player.hp = g.player.maxHp; up(1); }
    ok("... on a line: hit when it bursts, and the thorns sting and slow", burst > 0 && taken() > t0 && g.bossSedateT > 0, r1(burst) + " / " + r1(taken() - t0));
    B.clearObjs(g);
    // ---------- Crackwell ----------
    b = toBoss("storm", 10);
    cast(b, "pylons");
    ok("Tesla Pylons: where they will land, marked", B.dangers().filter((d) => d.kind === "circle").length >= 3);
    play(b, 2.5);
    const pyl = B.targets.filter((tg) => tg.kind === "pylon");
    ok("... pylons stand round you (to shoot)", pyl.length >= 3, pyl.length);
    // stand between two while the arcs flicker, then crackle
    const pa = pyl[0].obj.position, pb = pyl[1].obj.position;
    t0 = taken();
    place((pa.x + pb.x) / 2, (pa.z + pb.z) / 2);
    play(b, 5, () => { g.player.hp = g.player.maxHp; });
    ok("... between two when the arcs crackle: hit", taken() > t0);
    pyl.forEach((tg) => { for (let i = 0; i < 40 && !tg.down; i++) B.onShot(g, tg.hb, 14, null); });
    up(2);
    ok("... shot down: the arcs are gone", B.objs.filter((o) => o.kind === "pylons").length === 0);
    // Arc Barrage
    cast(b, "arcs");
    ok("Arc Barrage: a line to you first", B.dangers().some((d) => d.kind === "lane"));
    t0 = taken();
    let side = 1;
    play(b, 12, () => {
      g.player.hp = g.player.maxHp;
      const d = B.dangers()[0];
      if (d && d.at < 0.45) { const p = P(); walk(p.x + d.dz * side * 3, p.z - d.dx * side * 3, 5.2); } else side = Math.random() < 0.5 ? -1 : 1;
    });
    ok("... stepping off each line once it locks: untouched", taken() === t0, r1(taken() - t0));
    cast(b, "arcs"); t0 = taken();
    play(b, 12, () => { g.player.hp = g.player.maxHp; });
    ok("... standing still: struck", taken() > t0);
    // ---------- Professor Vitriol ----------
    b = toBoss("chemist", 10);
    cast(b, "spray");
    const sec = B.dangers().find((d) => d.kind === "sector");
    ok("Acid Sprayer: the whole sweep shown first", sec && sec.half > G.CONFIG.boss.moves.spray.half);
    // behind him
    place(b.pos.x, b.pos.z - 4); t0 = taken();
    play(b, 6, () => { g.player.hp = g.player.maxHp; });
    ok("... behind him: untouched", taken() === t0);
    cast(b, "spray"); place(b.pos.x, b.pos.z + 7); t0 = taken();
    play(b, 6, () => { g.player.hp = g.player.maxHp; });
    ok("... in its path: burnt", taken() > t0);
    // Miasma
    cast(b, "miasma");
    play(b, 3);
    const can = B.targets.find((tg) => tg.kind === "canister");
    ok("Miasma: a gas cloud with a canister in it (to shoot)", !!can && B.dangers().some((d) => d.kind === "circle"));
    ok("... it drifts slower than a walk", G.CONFIG.boss.moves.miasma.speed[1] < G.CONFIG.player.walkSpeed);
    t0 = taken();
    play(b, 12, () => { g.player.hp = g.player.maxHp; evade(5.2); });
    // (a corner of the arena can cost a brush of it)
    ok("... keeping away from it: a brush at most (< 5% of health)", taken() - t0 < g.player.maxHp * 0.05, r1(taken() - t0));
    cast(b, "miasma"); play(b, 3);
    const can2 = B.targets.find((tg) => tg.kind === "canister");
    for (let i = 0; i < 30 && can2 && !can2.down; i++) B.onShot(g, can2.hb, 14, null);
    up(2);
    ok("... the canister shot: the gas is gone", B.objs.filter((o) => o.kind === "miasma").length === 0);
    // ---------- Warden Vex ----------
    b = toBoss("void", 10);
    cast(b, "blackout");
    play(b, 2);
    ok("Lights Out: the arena goes dark", G.Perf.dimK < 0.5, G.Perf.dimK);
    t0 = taken();
    play(b, 10, () => { g.player.hp = g.player.maxHp; evade(5.2); });
    ok("... he strikes from behind, a wedge first: stepping out of it, untouched", taken() === t0 && (B.stats.moves.blackout || 0) >= 0, r1(taken() - t0));
    ok("... the lights come back", !b.act && (G.Perf.dimK === 1 || G.Perf.dimK == null));
    cast(b, "blackout"); t0 = taken();
    play(b, 11, () => { g.player.hp = g.player.maxHp; });
    ok("... standing still: struck from behind", taken() > t0);
    // Warden's Chains
    cast(b, "chains");
    ok("Warden's Chains: its lane shown first", B.dangers().some((d) => d.kind === "lane"));
    t0 = taken();
    play(b, 6, () => { g.player.hp = g.player.maxHp; evade(5.2); });
    ok("... out of the lane: not caught", !B.targets.some((tg) => tg.kind === "link") && taken() === t0);
    cast(b, "chains");
    const d0 = Math.hypot(P().x - b.pos.x, P().z - b.pos.z);
    let link = null;
    play(b, 3, () => { g.player.hp = g.player.maxHp; link = link || B.targets.find((tg) => tg.kind === "link"); });
    const d1 = Math.hypot(P().x - b.pos.x, P().z - b.pos.z);
    ok("... caught: pulled in, with a glowing link to shoot", !!link && d1 < d0 - 1, r1(d0) + " -> " + r1(d1));
    if (link && !link.down) { for (let i = 0; i < 20 && !link.down; i++) B.onShot(g, link.hb, 14, null); }
    const d2 = Math.hypot(P().x - b.pos.x, P().z - b.pos.z);
    play(b, 1);
    ok("... the link shot: free", link && link.down && Math.hypot(P().x - b.pos.x, P().z - b.pos.z) >= d2 - 0.05);
    quiet(b);
    // ---------- Examiner Quill ----------
    b = toBoss("examiner", 10);
    cast(b, "choice");
    play(b, 2);
    const copies = B.clones.filter((c) => c.word && !c.popped);
    ok("Multiple Choice: four of him, each holding a word", copies.length === 3 && !!b.word, copies.length);
    ok("... the copies look just like him (nothing but the word tells)", copies.every((c) => c.mats.every((m) => !m.transparent)));
    const hint = document.getElementById("hud-boss-hint").textContent;
    const meaning = (g.wordPool.find((p) => p[0] === b.word) || [])[1];
    ok("... the line under his bar gives the meaning (Thai)", meaning && hint.includes(meaning), hint);
    G.UI.updateHud(g.buildHudState());
    ok("... and so does the word-meaning box", document.getElementById("hud-meaning").textContent.includes(meaning), document.getElementById("hud-meaning").textContent);
    t0 = taken();
    B.onShot(g, copies[0].hitboxes[0], 14, null);
    ok("... a wrong one: it bursts on you", copies[0].popped && taken() > t0);
    const hC = b.hp;
    B.onShot(g, b.rig.hitboxes[0], 14, null);
    up(2);
    ok("... the real one (the right word): stunned, open, the copies gone", b.hp < hC && b.vulnT > 0 && B.clones.every((c) => c.popped || !c.word));
    play(b, 2);
    quiet(b);
    // Fail Stamp
    cast(b, "stamp");
    ok("Fail Stamp: a red square where you stand, first", B.dangers().some((d) => d.kind === "circle"));
    t0 = taken();
    play(b, 12, () => { g.player.hp = g.player.maxHp; evade(5.2); });
    ok("... moving out of each square: untouched", taken() === t0, r1(taken() - t0));
    cast(b, "stamp"); t0 = taken();
    play(b, 12, () => { g.player.hp = g.player.maxHp; });
    ok("... standing still: stamped (but never killed from full)", taken() > t0 && g.player.hp > 0);
    B.reset(g);
  }

  // ================================================================
  // every move shows a warning and says what to do
  // ================================================================
  function warnings() {
    fresh(1);
    const bad = [];
    G.BOSS_DEFS.forEach((d) => {
      const b = toBoss(d.id, 5);
      d.moves.slice(1).forEach((m) => {
        cast(b, m);
        up(1);
        const hint = document.getElementById("hud-boss-hint");
        if (hint.classList.contains("hidden") || !hint.textContent.trim()) bad.push(m + ": no hint");
        quiet(b); B.clearObjs(g); g.clearZombies();
      });
    });
    ok("every new move: a line saying what to do the moment it starts", bad.length === 0, bad.join(","));
    // (sounds: every wind-up plays one -- counted by wrapping the sound)
    const sounds = [], real = G.Audio.boss;
    G.Audio.boss = function (name) { sounds.push(name); return real.apply(this, arguments); };
    const quietMoves = [];
    try {
      G.BOSS_DEFS.forEach((d) => {
        const b = toBoss(d.id, 5);
        d.moves.slice(1).forEach((m) => { sounds.length = 0; cast(b, m); if (!sounds.length) quietMoves.push(m); quiet(b); B.clearObjs(g); g.clearZombies(); });
      });
    } finally { G.Audio.boss = real; }
    ok("every new move: a sound as it winds up", quietMoves.length === 0, quietMoves.join(","));
    B.reset(g);
  }

  // ================================================================
  // the Boss Codex: all three moves, and how to survive each
  // ================================================================
  function codex() {
    fresh(1);
    g.quitToMainMenu();
    G.BOSS_DEFS.forEach((d) => { G.save.bosses.seen[d.id] = 1; });
    G.UI.openCodex("screen-mainmenu");
    const card = document.querySelector('#codex-grid .codex-card[data-id="void"]');
    ok("Codex card: its three moves", card && /Event Horizon/.test(card.textContent) && /Lights Out/.test(card.textContent) && /Warden's Chains/.test(card.textContent), card && card.textContent);
    G.UI.openCodexDetail("void");
    const moves = document.querySelectorAll("#codex-d-moves .codex-move");
    const txt = document.getElementById("codex-d-moves").textContent;
    ok("Codex detail: three moves, a phase each", moves.length === 3 && /Phase 1/.test(txt) && /Phase 2/.test(txt) && /Phase 3/.test(txt));
    ok("... each with how to survive it", /pull is slower than your walk/.test(txt) && /whisper/.test(txt) && /glowing link/.test(txt));
    G.UI.closeCodexDetail();
    document.getElementById("btn-codex-back").click();
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
      config(); await tick();
      phases(); await tick();
      waves(); await tick();
      moves(); await tick();
      warnings(); await tick();
      codex(); await tick();
      ok("no missing strings", Object.keys(G._missingKeys || {}).length === 0, Object.keys(G._missingKeys || {}).join(","));
    } catch (e) {
      ok("no exception", false, String(e && e.stack || e));
    } finally {
      G.Input.requestPointerLock = rpl;
      if (B && (B.boss || B.phase)) B.reset(g);
      if (G.Cutscene.active) G.Cutscene.stop();
      G.save = JSON.parse(saved);
      G.persist();
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
