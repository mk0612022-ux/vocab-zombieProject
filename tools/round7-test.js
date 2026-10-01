// Dev-only (not shipped). New list, round 3: the twenty abilities (H), the
// school's third floor (I) and the checkpoint (J). The save is put back
// afterwards.
//   const r = await G.Round7Test.run();   r.fail -> []
window.G = window.G || {};
G.Round7Test = (function () {
  const results = [];
  const ok = (name, cond, info) => results.push({ name, pass: !!cond, info: info === undefined ? "" : info });
  const tick = () => new Promise((r) => { const ch = new MessageChannel(); ch.port1.onmessage = () => r(); ch.port2.postMessage(0); });
  const key = (code, o) => G.onKeyDown(Object.assign({ code, key: code, repeat: false, preventDefault() {}, stopPropagation() {} }, o || {}));
  const DT = 1 / 60;
  const r1 = (v) => Math.round(v * 10) / 10;
  let g, B, A, W;
  const up = (n) => { for (let i = 0; i < (n || 1); i++) g._upd.call(g, DT); };
  const sim = (sec) => up(Math.round(sec / DT));

  function fresh(level) {
    g = G.Game; B = G.Bosses; A = G.Abilities;
    G.save.tutorialDone = true;
    G.save.settings.graphicsQuality = "medium";
    G.save.settings.gameSpeed = 1;
    G.save.checkpoints = {};
    g.startLevel(level || 1);
    g._upd = g._upd || g.update;
    g.update = function () {};
    g.clearZombies();
    G.Input.mode = "desktop"; G.Input.padActive = false;
    W = g.world;
    return g;
  }
  // an open field: the football pitch, nothing else about, no new spawns
  function field() {
    g.clearZombies();
    const p = W.pitch, cx = (p.minX + p.maxX) / 2, cz = (p.minZ + p.maxZ) / 2;
    g.yawObject.position.set(cx, 1.7, cz); g.yawObject.rotation.y = 0; g.pitchObject.rotation.x = 0;
    g.velocityY = 0; g._prevPos = null;
    g.spawnedCount = g.requiredKills;
    g._cwc = g._cwc || g.checkWaveClear; g.checkWaveClear = function () {};
    g.player.hp = g.player.maxHp;
    A.clearWorld(); A.trail = [];
    g.yawObject.updateMatrixWorld(true);
    return { x: cx, z: cz };
  }
  const unfield = () => { if (g._cwc) { g.checkWaveClear = g._cwc; g._cwc = null; } };
  function spawn(dx, dz, type) {
    const P = g.yawObject.position;
    const z = g.spawnZombieAt(type || "normal", new THREE.Vector3(P.x + dx, 0, P.z + dz));
    z.emerge = null; z.attackCooldown = 0;
    return z;
  }
  function face(x, z) {
    const P = g.yawObject.position;
    g.yawObject.rotation.y = Math.atan2(-(x - P.x), -(z - P.z)); g.pitchObject.rotation.x = 0;
    g.yawObject.updateMatrixWorld(true);
  }
  // give the player ability `id` in slot 0, ready
  function hold(id) { A.slots = [{ id, cd: 0 }]; }
  function use(id) { hold(id); return A.use(g, 0); }
  // a boss wave's zombies down: straight to boss `id` (null: its own pick), past its cutscene
  function toBoss(id, wave) {
    if (G.Cutscene.active) G.Cutscene.stop();
    if (B.boss || B.phase) B.reset(g);
    unfield();
    G.Modal.reset(); g.paused = false; g.state = "GAMEPLAY"; G.UI.showScreen(null);
    g.player.hp = g.player.maxHp;
    g.wave = (wave || 5) - 1; g.startWave();
    g.spawnedCount = g.requiredKills; g.clearZombies();
    B.forceNext = id;
    g.checkWaveClear();
    up(1);
    let n = 0; while (G.Cutscene.active && n < 700) { up(1); n++; }
    return B.boss;
  }
  function quiet(b) { if (b.act && b.act.end) b.act.end(); b.act = null; b.swipeCd = 999; b.abilityCd = 999; }
  // after the boss: its death, its word (answered right or not), the honeycomb (pick `pick`), the shop
  function finishBoss(right, pick) {
    B.damage(g, 1e9, null);
    let n = 0; while (G.Cutscene.active && n < 500) { up(1); n++; }
    const c = g.challenge;
    if (!c) return false;
    g.answerChallengeAs(right);
    if (G.Modal.isOpen("abilities")) {
      G.UI.hivePick(pick || 0); G.UI.hiveFinishReveal();
      G.UI.hiveClose(null, A.slots.length >= A.MAX && G.UI._hive && G.UI._hive.stage === "replace");
    }
    quiz(true);
    return true;
  }
  // (new series, round 1) the wave's six-question quiz, answered right (or wrong)
  function quiz(pass) {
    const Q = G.Quiz;
    if (!Q.active) return false;
    let n = 0;
    while (Q.stage !== "result" && n++ < 40) { if (Q.stage === "question") { const q = Q.qs[Q.i]; Q.answerAs(pass !== false); } Q.update(5); }
    Q.close();
    return true;
  }

  // ================================================================
  // H: the abilities
  // ================================================================
  function data() {
    const ids = G.ABILITIES.map((a) => a.id);
    ok("H2 twenty abilities, all different", ids.length === 20 && new Set(ids).size === 20, ids.join(","));
    ok("H2 every one has a cooldown", G.ABILITIES.every((a) => a.cd > 0));
    ok("H2 required: Dash, and the helper that freezes the aimed zombie for 4.5 s", !!G.ABILITY_BY_ID.dash && G.ABILITY_BY_ID.freeze.dur === 4.5);
    const cats = new Set(G.ABILITIES.map((a) => a.cat));
    ok("H2 the other eighteen: movement, defense, control, word help, support", ["move", "defend", "control", "words", "support"].every((c) => cats.has(c)), Array.from(cats).join(","));
    const miss = [];
    ids.forEach((id) => ["name", "desc"].forEach((k) => { if (!G.STRINGS.en["ability." + id + "." + k]) miss.push(id + "." + k); }));
    ok("H every ability: a name and what it does", miss.length === 0, miss.join(","));
    ok("H every ability has an icon", G.ABILITIES.every((a) => a.icon && a.icon.length));
    const THAI = new RegExp("[" + String.fromCharCode(0x0E00) + "-" + String.fromCharCode(0x0E7F) + "]");
    ok("rules: no Thai in the new UI text", !Object.entries(G.STRINGS.en).some(([k, v]) => /^(ability|hive|f3|cp|dialog)\./.test(k) && THAI.test(v)));
  }

  // none of them hurts or kills a zombie
  function noDamage() {
    fresh(1); field();
    const zs = [];
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; zs.push(spawn(Math.cos(a) * 4, Math.sin(a) * 4)); }
    zs.push(spawn(0, -9)); zs.push(spawn(0, -14));
    const hp0 = zs.map((z) => z.hp);
    g.spawnDrop("money", g.yawObject.position.clone().add(new THREE.Vector3(6, 0, 0)));
    const used = [], refused = [];
    G.ABILITIES.forEach((d) => {
      g.player.hp = g.player.maxHp - 50;
      face(zs[8].mesh.position.x, zs[8].mesh.position.z);
      if (use(d.id)) used.push(d.id); else refused.push(d.id);
      sim(0.6);
      zs.forEach((z) => { z.attackCooldown = 99; });
    });
    ok("H2 every ability could be used here", used.length >= 19, "refused: " + refused.join(","));
    ok("H2 no ability hurts a zombie", zs.every((z, i) => z.hp === hp0[i]), zs.map((z) => z.hp).join(","));
    ok("H2 no ability kills a zombie", zs.every((z) => z.alive) && g.zombies.length === zs.length && g.totalZombiesKilled === 0);
    unfield();
  }

  function cooldowns() {
    fresh(1); field();
    spawn(0, -8);
    const d = G.ABILITY_BY_ID.shockwave;
    hold("shockwave");
    const a = A.use(g, 0), cd = A.slots[0].cd, again = A.use(g, 0);
    ok("H1 an ability used starts its cooldown", a && cd === d.cd, cd);
    ok("H1 ...and cannot be used again until it is over", !again);
    sim(d.cd - 0.5);
    ok("H1 still cooling half a second before", A.slots[0].cd > 0 && !A.use(g, 0));
    sim(0.6);
    ok("H1 ready again after its cooldown", A.slots[0].cd === 0 && A.use(g, 0));
    hold("freeze"); g.clearZombies();
    ok("H1 nothing to use it on: refused, no cooldown", !A.use(g, 0) && A.slots[0].cd === 0);
    unfield();
  }

  function effects() {
    fresh(1); let c = field();
    const P = g.yawObject.position;
    // Dash
    face(c.x, c.z - 10);
    use("dash"); const z0 = P.z; sim(0.3);
    ok("H2 Dash: a short, fast burst forward (about 6 m in 0.2 s)", z0 - P.z > 5 && z0 - P.z < 7.5, r1(z0 - P.z));
    c = field(); const zb = spawn(0, -0.8); use("dash"); face(c.x, c.z - 10);
    const hpB = g.player.hp; up(1);
    ok("H2 Dash: nothing lands while it lasts", g.player.hp === hpB && A.damageTakenMult() === 0);
    // Frost Sprite
    c = field(); const zf = spawn(0, -10); face(zf.mesh.position.x, zf.mesh.position.z);
    use("freeze"); sim(0.45);
    ok("H2 Frost Sprite: the zombie in your sights frozen for 4.5 s", zf.frozenT > 3.9 && zf.frozenT <= 4.5, r1(zf.frozenT));
    const fp = zf.mesh.position.clone(); sim(3.5);
    ok("H2 Frost Sprite: it does not move while frozen", zf.mesh.position.distanceTo(fp) < 0.01);
    ok("H2 Frost Sprite: still alive, with its word (it still has to be shot on it)", zf.alive && zf.hp === zf.maxHp && !!zf.word);
    sim(1.5);
    ok("H2 Frost Sprite: then it walks again", zf.mesh.position.distanceTo(fp) > 0.2 && !(zf.frozenT > 0));
    // Shockwave
    c = field(); const zs = spawn(0, -3), zs2 = spawn(2.5, 0), zfar = spawn(0, -12);
    const d1 = zs.mesh.position.distanceTo(P), d2 = zfar.mesh.position.distanceTo(P);
    use("shockwave");
    ok("H2 Shockwave: pushes those within 6 m away and dazes them", zs.mesh.position.distanceTo(P) > d1 + 2 && zs.stunT > 0 && zs2.stunT > 0, r1(zs.mesh.position.distanceTo(P) - d1));
    ok("H2 Shockwave: not those further away", !(zfar.stunT > 0) && Math.abs(zfar.mesh.position.distanceTo(P) - d2) < 0.01);
    // Time Warp and Glue (how far a zombie gets in a second)
    const walk = (setup) => { c = field(); const z = spawn(0, -10); z.attackCooldown = 99; if (setup) setup(z); const p0 = z.mesh.position.clone(); sim(1); return z.mesh.position.distanceTo(p0); };
    const free = walk();
    const warped = walk(() => use("timewarp"));
    ok("H2 Time Warp: zombies near you at a third of their speed", warped < free * 0.45 && warped > free * 0.2, r1(warped) + " vs " + r1(free));
    const glued = walk((z) => { A.slots = [{ id: "glue", cd: 0 }]; face(z.mesh.position.x, z.mesh.position.z); g.pitchObject.rotation.x = -0.25; g.yawObject.updateMatrixWorld(true); A.use(g, 0); A.fx.glueAt.set(z.mesh.position.x, A.fx.glueAt.y, z.mesh.position.z); });
    ok("H2 Glue Trap: a fifth of their speed on the glue", glued < free * 0.3, r1(glued) + " vs " + r1(free));
    // Smoke Bomb and Decoy: they do not bite
    c = field(); const zk = spawn(0, -0.9); use("smoke"); let hp = g.player.hp; sim(2);
    ok("H2 Smoke Bomb: zombies in it lose you and do not bite", g.player.hp === hp && zk.lostT > 0);
    c = field(); face(c.x, c.z - 10); const zd = spawn(3, -1); use("decoy");
    const dp = A.fx.decoyAt.clone(); hp = g.player.hp; sim(3);
    ok("H2 Decoy: nearby zombies go for it instead of you", zd.mesh.position.distanceTo(dp) < 1.6 && g.player.hp === hp, r1(zd.mesh.position.distanceTo(dp)));
    // Flashbang: in front yes, behind no
    c = field(); face(c.x, c.z - 10); const zin = spawn(0, -6), zout = spawn(0, 6); use("flashbang");
    ok("H2 Flashbang: dazes the zombies in front of you, not behind", zin.stunT > 2 && !(zout.stunT > 0));
    // Gravity Well
    c = field(); face(c.x, c.z - 10); g.pitchObject.rotation.x = -0.35; g.yawObject.updateMatrixWorld(true);
    use("well"); const wa = A.fx.wellAt.clone();
    const zw1 = spawn(wa.x - c.x + 5, wa.z - c.z), zw2 = spawn(wa.x - c.x - 4, wa.z - c.z + 3);
    const wd0 = zw1.mesh.position.distanceTo(wa) + zw2.mesh.position.distanceTo(wa); sim(2);
    ok("H2 Gravity Well: pulls the zombies near it together", zw1.mesh.position.distanceTo(wa) + zw2.mesh.position.distanceTo(wa) < wd0 - 4, r1(wd0));
    // Barrier
    c = field(); use("barrier"); const zb2 = spawn(0, -0.9); hp = g.player.hp; up(2);
    ok("H2 Barrier: a bite does a quarter of its damage", Math.abs((hp - g.player.hp) - zb2.damage * 0.25) < 0.01, r1(hp - g.player.hp));
    // Patch Up
    c = field(); g.player.hp = 100; use("patch"); sim(3.2);
    ok("H2 Patch Up: heals 35% over 3 s", Math.abs(g.player.hp - (100 + g.player.maxHp * 0.35)) < 3, r1(g.player.hp));
    g.player.hp = g.player.maxHp;
    ok("H2 Patch Up: not at full health", !use("patch"));
    // Overdrive
    c = field(); g.stamina = 10; use("overdrive");
    ok("H2 Overdrive: stamina full, 25% faster", g.stamina === g.maxStamina && A.moveMult() === 1.25 && A.freeStamina());
    // Pole Vault
    c = field(); face(c.x, c.z - 10); const zv = spawn(0, -1.2); use("vault"); hp = g.player.hp;
    let high = 0; for (let i = 0; i < 90; i++) { up(1); high = Math.max(high, P.y - 1.7); }
    ok("H2 Pole Vault: up over their heads and forward", high > 1.6 && c.z - P.z > 5, r1(high) + "m up, " + r1(c.z - P.z) + "m on");
    // Rewind
    c = field(); face(c.x, c.z - 30);
    for (let i = 0; i < 300; i++) { g.yawObject.position.z -= 0.05; up(1); }
    const at = P.z; use("rewind");
    ok("H2 Rewind: back where you stood 4 s ago", P.z - at > 10 && P.z - at < 13, r1(P.z - at));
    // Word help (the player cannot die here: they will reach and bite)
    c = field(); g.player.hp = 1e9;
    [spawn(0, -12), spawn(3, -12), spawn(-3, -12), spawn(6, -12), spawn(-6, -12)];
    g.targetPair = null; g.ensureTargetHasMatch();
    const target = g.zombies.find((z) => z.word === g.targetPair[0]);
    use("radar"); up(1);
    ok("H2 Word Radar: the zombie with the word shows through walls", target.sprite.material.depthTest === false && A.radarTarget === target);
    use("whisper"); const hud = g.buildHudState().currentMeaning;
    ok("H2 Whisper: the first three letters and the length", hud.includes(g.targetPair[0].slice(0, 3).toUpperCase()) && hud.includes(String(g.targetPair[0].replace(/[^A-Za-z]/g, "").length)), hud);
    use("fifty");
    const out = g.zombies.filter((z) => z.ruledOut);
    ok("H2 Fifty-Fifty: half the wrong words crossed out, never the right one", out.length === 2 && !target.ruledOut, out.length);
    // (the label's key: t / x / n, then -- vocabulary series round 2 -- what it says)
    ok("H2 Fifty-Fifty: drawn grey with a cross", out.every((z) => z._label[0] === "x"));
    sim(10.1);
    ok("H2 Fifty-Fifty: back to normal after 10 s", !g.zombies.some((z) => z.ruledOut) && g.zombies.every((z) => z._label[0] !== "x"));
    // (the others, crowding round by now, off the field: the lens looks past nobody)
    g.zombies.filter((z) => z !== target).forEach((z) => { g.scene.remove(z.mesh); z.alive = false; });
    g.zombies = [target]; target.mesh.position.set(P.x, 0, P.z - 8);
    face(target.mesh.position.x, target.mesh.position.z); use("lens"); up(2);
    ok("H2 Translator Lens: the aimed zombie shows its meaning", A._lensZ === target && A._lensSprite.parent === target.mesh);
    // Support
    c = field(); const pl = g.player, id = pl.gunSlots[0]; pl.ammo[id].mag = 0; const r0 = pl.ammo[id].reserve;
    use("resupply");
    ok("H2 Resupply: magazines full, one spare each", pl.ammo[id].mag === G.WEAPON_DEFS[id].magSize && pl.ammo[id].reserve === r0 + G.WEAPON_DEFS[id].magSize);
    g.spawnDrop("health", P.clone().add(new THREE.Vector3(12, -1.7, 0)));
    const drop = g.drops[g.drops.length - 1], dd0 = Math.hypot(drop.mesh.position.x - P.x, drop.mesh.position.z - P.z);
    use("magnet"); sim(0.2);
    ok("H2 Magnet: pickups fly to you", drop.magnet && (!g.drops.includes(drop) || Math.hypot(drop.mesh.position.x - P.x, drop.mesh.position.z - P.z) < dd0 - 2), r1(dd0));
    unfield();
  }

  // bosses shrug control off
  function bossResist() {
    fresh(1);
    const b = toBoss("gravedigger", 5); quiet(b);
    const P = g.yawObject.position;
    g.yawObject.position.set(b.pos.x, 1.7 + B.arena.floorY, b.pos.z + 9); g._prevPos = null;
    face(b.pos.x, b.pos.z);
    const hp0 = b.hp;
    A.slots = [{ id: "freeze", cd: 0 }]; A.use(g, 0); sim(0.4);
    ok("H2 bosses: frozen far shorter (0.8 s, not 4.5)", b.frozenT > 0 && b.frozenT <= 0.8, r1(b.frozenT));
    sim(1);
    ok("H2 bosses: thawed within a second", !(b.frozenT > 0));
    g.yawObject.position.set(b.pos.x, P.y, b.pos.z + b.rig.R + 3);
    A.slots = [{ id: "shockwave", cd: 0 }]; A.use(g, 0);
    ok("H2 bosses: a shockwave only staggers (0.4 s)", b.frozenT > 0 && b.frozenT <= 0.4);
    sim(0.5);
    A.slots = [{ id: "flashbang", cd: 0 }]; face(b.pos.x, b.pos.z); A.use(g, 0);
    A.slots = [{ id: "smoke", cd: 0 }]; A.use(g, 0);
    ok("H2 bosses: no daze from a flashbang, no lost in smoke", !(b.frozenT > 0) && !(b.stunT > 0) && !(b.lostT > 0));
    A.slots = [{ id: "timewarp", cd: 0 }]; A.use(g, 0);
    ok("H2 bosses: Time Warp barely slows them (0.8, not 0.33)", Math.abs(A.bossSpeed(b) - 0.8) < 1e-6, A.bossSpeed(b));
    ok("H2 bosses: no ability hurts them", b.hp === hp0);
    // a boss's blow during a Dash
    A.slots = [{ id: "dash", cd: 0 }]; A.use(g, 0);
    const hpP = g.player.hp; B.hurt(g, 0.2, {});
    ok("H2 Dash: a boss's blow misses too", g.player.hp === hpP);
    // (bug found by the playtest bot) every gun dry in the sealed arena
    const pl = g.player;
    pl.gunSlots = ["pistol", "smg"]; pl.ammo.smg = { mag: 0, reserve: 0 }; pl.weaponLevels.smg = { dmg: 1, rate: 1, mag: 1 }; pl.ammo.pistol = { mag: 0, reserve: 3 };
    b.supplyT = 0; g.drops.filter((d) => d.arena).forEach((d) => g.collectDrop(d));
    quiet(b); up(2);
    const box = g.drops.find((d) => d.arena), ar = B.arena.rect;
    ok("C arena ammo: a supply box turns up in the arena", !!box && box.mesh.position.x > ar.minX && box.mesh.position.x < ar.maxX && box.mesh.position.z > ar.minZ && box.mesh.position.z < ar.maxZ);
    up(60);
    ok("C arena ammo: ...then the next 20-30 s later", g.drops.filter((d) => d.arena).length === 1 && b.supplyT >= 18 && b.supplyT <= 30, r1(b.supplyT));
    g.switchSlot(0); g.collectDrop(box);
    const mags = G.CONFIG.boss.arenaAmmo.magsPerGun;
    ok("bug fix: ...it fills every gun, even with the knife out", pl.ammo.smg.reserve === G.WEAPON_DEFS.smg.magSize * mags && pl.ammo.pistol.reserve === 3 + G.WEAPON_DEFS.pistol.magSize * mags);
    g.spawnDrop("ammo", P.clone()); const r0 = pl.ammo.pistol.reserve; g.collectDrop(g.drops[g.drops.length - 1]);
    ok("bug fix: an ammo pickup with the knife out is no longer lost", pl.ammo.pistol.reserve === r0 + G.WEAPON_DEFS.pistol.magSize * 2);
    B.reset(g);
  }

  // H3: the honeycomb and the shuffle bag
  async function hive() {
    fresh(1); field();
    A.resetRun();
    const shown = [];
    for (let i = 0; i < 4; i++) shown.push(...A.draw());
    ok("H3 four bosses show all twenty, each once", shown.length === 20 && new Set(shown).size === 20);
    A.resetRun();
    // the window itself
    let nextCalled = 0;
    A.offer(g, () => { nextCalled++; });
    const hexes = Array.from(document.querySelectorAll("#hive .hex"));
    ok("H3 five large hexagons, all hidden", hexes.length === 5 && hexes.every((h) => !h.classList.contains("revealed")));
    ok("H3 a G.Modal window that pauses the game", G.Modal.isOpen("abilities") && G.Modal.pausesAll() && G.UI._currentScreen === "screen-abilities");
    // (layout boxes, not the screen ones: the hexagons grow in with a transform)
    const hr = hexes.map((h) => ({ left: h.offsetLeft, top: h.offsetTop, width: h.offsetWidth, height: h.offsetHeight }));
    ok("H3 laid out as a honeycomb (3 over 2, the lower row offset)", hr[0].width >= 60 && Math.abs(hr[0].top - hr[2].top) < 1 && hr[3].top > hr[0].top + hr[0].height * 0.6 && hr[3].left > hr[0].left + hr[0].width * 0.3 && hr[3].top < hr[0].top + hr[0].height, hr.map((r) => r.left + "," + r.top + " " + r.width + "x" + r.height).join(" | "));
    ok("H3 a controller works in it", G.Pad.scope() === document.getElementById("screen-abilities"));
    const offered = G.UI._hive.ids.slice();
    key("Digit3");
    ok("H3 picked: that one turns over first, with its effect", hexes[2].classList.contains("revealed") && hexes[2].classList.contains("picked") && hexes.filter((h) => h.classList.contains("revealed")).length === 1);
    ok("H3 ...and what it does is shown", document.getElementById("hive-detail").textContent.includes(A.name(offered[2])));
    G.UI.hiveFinishReveal();
    ok("H3 then the other four are shown", hexes.every((h) => h.classList.contains("revealed")) && hexes.filter((h) => h.classList.contains("other")).length === 4);
    key("Enter");
    ok("H3 Continue closes it and the game goes on", !G.Modal.isOpen("abilities") && nextCalled === 1);
    ok("H4 the ability is held", A.slots.length === 1 && A.slots[0].id === offered[2]);
    // what was offered never comes again this run
    const later = [];
    for (let i = 0; i < 3; i++) { A.offer(g, () => {}); later.push(...G.UI._hive.ids); G.UI.hivePick(i); G.UI.hiveFinishReveal(); G.UI.hiveClose(); }
    ok("H3 offered once (picked or not): never again in the run", later.every((id) => !offered.includes(id)) && new Set(later.concat(offered)).size === 20);
    ok("H4 four abilities at most, one a boss", A.slots.length === 4);
    // a fifth (Endless): swap one, or keep
    A.offer(g, () => {});
    G.UI.hivePick(0); G.UI.hiveFinishReveal();
    const newId = G.UI._hive.ids[0], old1 = A.slots[1].id;
    ok("H4 with four held, the new one replaces one of them (or is left)", G.UI._hive.stage === "replace" && document.querySelectorAll("#hive-replace .hive-slot").length === 4);
    key("Digit2");
    ok("H4 ...swapped into the slot chosen", A.slots.length === 4 && A.slots[1].id === newId && !A.has(old1));
    // H4: the run's end
    fresh(1);
    ok("H4 a new run starts with none, and a full bag", A.slots.length === 0 && A.bag.length === 20);
    // the hexagons with a mouse, on a phone-sized screen too
    G.UI.el("hive").style.setProperty("--hw", "70px");
    A.offer(g, () => {}); document.querySelectorAll("#hive .hex")[4].click();
    ok("H3 a click (or a tap) picks too", document.querySelectorAll("#hive .hex")[4].classList.contains("picked"));
    G.UI.hiveFinishReveal(); document.getElementById("btn-hive-continue").click();
    G.UI.el("hive").style.removeProperty("--hw");
    ok("H3 ...and Continue with a click", !G.Modal.isOpen("abilities"));
    await tick();
  }

  // H4: keys, controller, touch, the HUD
  function controls() {
    fresh(1); field();
    const kb = G.defaultKeybinds();
    ok("H4 keys Q F C X by default", kb.ability1 === "KeyQ" && kb.ability2 === "KeyF" && kb.ability3 === "KeyC" && kb.ability4 === "KeyX");
    const codes = Object.values(kb);
    ok("H4 no key used twice", new Set(codes).size === codes.length);
    G.UI.renderSettings();
    ok("H4 on the Key Bindings page", [1, 2, 3, 4].every((i) => document.querySelector(`.keybind-btn[data-action="ability${i}"]`)));
    const old = G.normalizeSave({ unlockedLevels: [1], settings: { keybinds: { forward: "KeyW", reload: "KeyQ" } } });
    ok("H4 an old save that uses Q for something else keeps it (ability 1 unbound)", old.settings.keybinds.reload === "KeyQ" && old.settings.keybinds.ability1 === "" && old.settings.keybinds.ability2 === "KeyF");
    G.UI.showScreen(null);
    A.slots = ["shockwave", "flashbang", "barrier", "radar"].map((id) => ({ id, cd: 0 }));
    spawn(0, -6);
    key("KeyQ");
    ok("H4 Q uses the first", A.slots[0].cd > 0 && A.slots[1].cd === 0);
    key("KeyC");
    ok("H4 C the third", A.slots[2].cd > 0);
    key("KeyF", { repeat: true });
    ok("H4 a held key does not fire it again and again", A.slots[1].cd === 0);
    // the HUD bar
    A.update(g, 0);
    const habs = document.querySelectorAll("#hud-abilities .hab");
    ok("H4 HUD: an icon per ability, with its key", habs.length === 4 && ["Q", "F", "C", "X"].every((k, i) => habs[i].querySelector(".hab-key").textContent === k));
    ok("H4 HUD: the cooldown ring and seconds while cooling", habs[0].classList.contains("cooling") && parseFloat(habs[0].style.getPropertyValue("--p")) > 0.5 && /^\d+$/.test(habs[0].querySelector(".hab-cd").textContent));
    ok("H4 HUD: glows while its effect lasts", habs[2].classList.contains("live"));
    // a controller: the D-pad
    const fakePad = { axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) };
    const pg = G.Input.pollGamepad; G.Input.pollGamepad = () => fakePad;
    A.slots.forEach((s) => { s.cd = 0; });
    G.Pad.prev = []; G.Pad.poll(DT);
    fakePad.buttons[15].pressed = true; G.Pad.poll(DT);
    ok("H4 controller: D-pad right uses the second", A.slots[1].cd > 0 && A.slots[0].cd === 0);
    fakePad.buttons[15].pressed = false; fakePad.buttons[12].pressed = true; G.Pad.poll(DT);
    ok("H4 controller: D-pad up the first", A.slots[0].cd > 0);
    A.update(g, 0);
    ok("H4 HUD: with a controller the keys read as the D-pad", document.querySelector("#hud-abilities .hab .hab-key").textContent === "↑");
    fakePad.buttons[12].pressed = false; G.Pad.poll(DT);
    G.Input.pollGamepad = pg; G.Input.padActive = false; G.Pad.release();
    // touch
    A.slots.forEach((s) => { s.cd = 0; });
    G.Input.mode = "touch"; G.UI.applyControlMode(); A.update(g, 0);
    const tbtns = document.querySelectorAll("#touch-abilities .touch-ab");
    ok("H4 touch: a button per ability", tbtns.length === 4 && getComputedStyle(document.getElementById("touch-abilities")).display !== "none");
    ok("H4 touch: the HUD bar makes way for them", getComputedStyle(document.getElementById("hud-abilities")).display === "none");
    tbtns[3].dispatchEvent(new Event("touchstart", { bubbles: true, cancelable: true }));
    ok("H4 touch: a tap uses it", A.slots[3].cd > 0);
    ok("H4 touch: in the layout editor's list", G.TouchCfg.IDS.includes("abilities") && G.T("touchcfg.abilities") === "Ability buttons");
    G.TouchCfg.setScale("abilities", 1.4);
    ok("H4 touch: resizable", document.getElementById("touch-abilities").style.getPropertyValue("--s") === "1.4");
    G.TouchCfg.resetOne("abilities");
    G.Input.mode = "desktop"; G.UI.applyControlMode();
    unfield();
  }

  // ================================================================
  // I: the third floor
  // ================================================================
  async function floor3() {
    fresh(1); field();
    const F = G.Floor3, tf = W.thirdFloor, sf = W.secondFloor;
    const rows = F.steps(g);
    ok("I six steps in the checklist", rows.length === 6 && rows.every((r) => r.label && !/\{/.test(r.label)), rows.map((r) => r.label).join(" | "));
    ok("I nothing done at the start", F.doneCount(g) === 0 && !F.s.spawned);
    // 1-4
    g.correctCount = sf.killsNeeded; g.checkSecondFloorUnlock();
    g.correctKills = 49; g.notesReadRun = new Set(["x1", "x2", "x3"]);
    G.Bosses.run.downs = [{ id: "gravedigger", wave: 5, secs: 90 }];
    F.check(g);
    ok("I no keycard at 49 right-word kills", !F.s.spawned && F.doneCount(g) === 3);
    g.correctKills = 50; F.check(g);
    ok("I 1-4 done: the Floor 3 Keycard appears", F.s.spawned && F.mesh && F.mesh.visible);
    const room = W.roomInfo[F.s.room];
    ok("I ...in one of the 2nd floor's rooms", room && room.spec.floor === 2 && Math.abs(F.s.spot.y - (W.storeyY ? W.storeyY[1] : 4.2)) < 0.5 && G.getRegionAt(W, F.s.spot.x, F.s.spot.z, F.s.spot.y) === F.s.room, F.s.room + " y=" + r1(F.s.spot.y));
    ok("I ...glowing, with a beam of light", F.halo && F.beam && F.beam.material.blending === THREE.AdditiveBlending);
    let marks = 0; F.mapMarks(g, () => { marks++; }, () => ({ x: 0, y: 0 }), () => true, 5);
    ok("I ...and marked on the minimap", marks === 1);
    // the lock before the card
    const gateRef = W.interactables.find((i) => i.kind === "gate3");
    F.interact(g, gateRef);
    ok("I the grille will not open without the keycard", !g.challenge && !tf.unlocked && /Keycard/.test(g.thirdFloorStatus()));
    // pick it up
    g.yawObject.position.set(F.s.spot.x, F.s.spot.y + 1.7, F.s.spot.z); g._prevPos = null;
    F.update(g, DT);
    ok("I walk over the keycard to take it", F.s.taken && !F.mesh.visible && F.doneCount(g) === 5);
    ok("I the grille now offers its Vocabulary Lock", /Vocabulary Lock/.test(g.thirdFloorStatus()));
    F._hudSig = null; F.hud(g);
    ok("I the HUD shows it compactly", /^3F 5\/6/.test(document.getElementById("hud-floor3").textContent) && !document.getElementById("hud-floor3").classList.contains("hidden"), document.getElementById("hud-floor3").textContent);
    // the lock: three hard words, 15 s each; one wrong and it jams for 30 s
    F.interact(g, gateRef);
    // (vocabulary series, round 3: some kinds of question get a few seconds more)
    ok("I the lock: a word question, 15 seconds (and its kind's extra)", !!g.challenge && g.challenge.timeLimit === G.Questions.seconds(g.challenge.q ? g.challenge.q.type : "th2en", 15) && /word 1 of 3/.test(document.getElementById("hud-challenge-label").textContent), g.challenge && g.challenge.timeLimit + " " + (g.challenge.q && g.challenge.q.type));
    const first = g.challenge.pair[0];
    const avg = g.wordPool.reduce((a, p) => a + p[0].length, 0) / g.wordPool.length, st = G.wordStat(first);
    ok("I ...a hard word (a long one, or one missed before)", first.length > avg || (st && st.wrong > 0), first);
    g.answerChallengeAs(true);
    const tries0 = F.s.tries; F.interact(g, gateRef);
    ok("I a press between two words does not restart the lock", F.s.tries === tries0 && F.s.round && F.s.round.i === 1);
    await tick();
    ok("I right: the second word at once", !!g.challenge && /word 2 of 3/.test(document.getElementById("hud-challenge-label").textContent) && G.Modal.isOpen("challenge"));
    const c2 = g.challenge; g.answerChallengeAs(false); await tick();
    ok("I wrong: the lock jams for 30 s", !g.challenge && F.s.lockLeft === 30 && !tf.unlocked);
    F.interact(g, gateRef);
    ok("I ...and cannot be tried while jammed", !g.challenge);
    for (let i = 0; i < 29 * 10; i++) F.update(g, 0.1);
    F.interact(g, gateRef);
    ok("I ...still jammed a second before", !g.challenge && F.s.lockLeft > 0);
    for (let i = 0; i < 15; i++) F.update(g, 0.1);
    ok("I ...until the 30 s have passed", F.s.lockLeft === 0);
    F.interact(g, gateRef);
    const second = g.challenge.pair[0];
    ok("I ...then three new words", second !== first && second !== c2.pair[0]);
    for (let i = 0; i < 3; i++) { g.answerChallengeAs(true); await tick(); }
    ok("I all three right: the grille lifts", tf.unlocked && !W.colliders.includes(tf.barrierCollider) && !g.challenge);
    ok("I ...with its effect (sparks and a ring of light)", G.BossFX.decals.some((d) => d.on && d.o.shock));
    // the checklist
    g.pause();
    const pbox = document.getElementById("pause-floor3");
    ok("I the pause menu shows the checklist", !pbox.classList.contains("hidden") && /3rd floor/.test(pbox.textContent));
    g.resume();
    F.hud(g);
    ok("I once open, the HUD chip goes", document.getElementById("hud-floor3").classList.contains("hidden"));
    // when it comes: the school's waves, a steady 80% of the right words
    let kills = 0, reach = 0;
    for (let w = 1; w <= 20 && !reach; w++) { kills += G.waveSpec(G.getLevel(1), w, "campaign").kills * 0.8; if (w >= 5 && kills >= F.CORRECT_KILLS) reach = w; }
    ok("I tuning: 50 right-word kills by around wave 6-7 (3F around waves 7-10)", reach >= 5 && reach <= 8, "wave " + reach);
    unfield();
  }

  // ================================================================
  // J: the checkpoint
  // ================================================================
  async function checkpoint() {
    fresh(1);
    const C = G.Checkpoint, F = G.Floor3;
    ok("J no checkpoint before wave 10", !C.has(1));
    // a run to wave 10 with a bit of everything
    toBoss("gravedigger", 5); finishBoss(true, 1);
    g.leaveShop();
    ok("J (the wave 5 boss gave an ability)", A.slots.length === 1);
    const pl = g.player;
    pl.gunSlots = ["pistol", "shotgun", "smg"];
    pl.ammo.shotgun = { mag: 3, reserve: 21 }; pl.ammo.smg = { mag: 17, reserve: 90 }; pl.ammo.pistol = { mag: 5, reserve: 30 };
    pl.weaponLevels.shotgun = { dmg: 1.15, rate: 1, mag: 1.2 }; pl.weaponLevels.smg = { dmg: 1, rate: 1.1, mag: 1 };
    pl.currentSlot = 2;
    ["extra_slot", "perk_armor", "perk_armor", "perk_speed"].forEach((id) => G.Perks.apply(id, g));
    g.correctCount = 70; g.wrongCount = 9; g.correctKills = 58; g.totalZombiesKilled = 80;
    g.checkSecondFloorUnlock();
    G.Notes.placed.slice(0, 3).forEach((n) => G.Notes.keep(g, n));
    F.check(g);
    if (F.s.spawned) F.take(g);
    const S = G.Objectives.state;
    Array.from(W.roomNames).slice(0, 6).forEach((n) => S.visited.add(n));
    const k0 = W.keys[0]; k0.taken = true; k0.mesh.visible = false; S.keysFound = 1;
    g.wrongWordsThisRun = { abandon: { meaning: "x", count: 2 } };
    // wave 10's boss, right, an ability, the shop, then Ready
    toBoss("eye", 10); finishBoss(true, 2);
    ok("J the shop after wave 10's boss", g.state === "SHOP");
    G.Shop.recordPurchase("heal");
    pl.money = 4321; pl.hp = 333; pl.score = 98765;
    g.leaveShop();
    ok("J1 the checkpoint is kept as the shop closes, before wave 11", C.has(1) && g.wave === 11 && C.get(1).wave === 11);
    const toast = document.getElementById("hud-checkpoint");
    ok("J1 \"Checkpoint Saved - Wave 11\", with its icon", !toast.classList.contains("hidden") && toast.textContent.includes("Checkpoint Saved - Wave 11") && !!toast.querySelector(".cp-ico"));
    ok("J4 kept in localStorage with the save", JSON.parse(localStorage.getItem("vocabZombie_save_v1")).checkpoints.level1.wave === 11);
    // what it should give back
    const want = {
      wave: 11, score: 98765, money: 4321, hp: 333, guns: pl.gunSlots.join(","), ammo: JSON.stringify(pl.ammo), levels: JSON.stringify(pl.weaponLevels),
      slots: G.Loadout.maxSlots(g), perks: JSON.stringify(pl.perks), armor: pl.armorPct, speed: pl.moveSpeedMult,
      abilities: A.slots.map((s) => s.id).join(","), bag: A.bag.join(","), offered: A.offered.slice(),
      second: W.secondFloor.unlocked, keycard: F.s.taken, room: F.s.room,
      visited: S.visited.size, keys: S.keysFound, bossesDown: S.bossesDown,
      correct: g.correctCount, wrong: g.wrongCount, correctKills: g.correctKills, kills: g.totalZombiesKilled,
      notes: Array.from(g.notesReadRun).sort().join(","), met: B.run.met.join(","), downs: B.run.downs.length,
      perkBag: G.PerkBag.bag.join(","), prices: JSON.stringify(G.Shop.prices), wrongWords: JSON.stringify(g.wrongWordsThisRun),
    };
    // on to wave 12, a lot changed, then death
    g.wave = 11; g.startWave();
    pl.money = 10; pl.score += 5000; pl.gunSlots = ["pistol"]; G.Perks.apply("thorns", g); A.slots[0].cd = 9;
    g.correctKills += 30; W.thirdFloor && F.open(g, true); B.run.met.push("coach");
    pl.hp = 0; g.checkPlayerDeath();
    ok("J3 died at wave 12: Game Over", g.state === "GAME_OVER" && g.wave === 12);
    const contBtn = document.getElementById("btn-gameover-continue"), retryBtn = document.getElementById("btn-gameover-retry");
    ok("J3 Game Over: \"Continue from Wave 11\" and \"Restart from Wave 1\"", !contBtn.classList.contains("hidden") && contBtn.textContent === "Continue from Wave 11" && retryBtn.textContent === "Restart from Wave 1");
    // Continue: every J2 item as it was kept
    const check = (tag) => {
      W = g.world;                                     // (Continue builds the level afresh)
      const got = {
        wave: g.wave, score: pl2().score, money: pl2().money, hp: pl2().hp, guns: pl2().gunSlots.join(","), ammo: JSON.stringify(pl2().ammo), levels: JSON.stringify(pl2().weaponLevels),
        slots: G.Loadout.maxSlots(g), perks: JSON.stringify(pl2().perks), armor: pl2().armorPct, speed: pl2().moveSpeedMult,
        abilities: A.slots.map((s) => s.id).join(","), bag: A.bag.join(","),
        second: W.secondFloor.unlocked, keycard: F.s.taken, room: F.s.room,
        visited: G.Objectives.state.visited.size, keys: G.Objectives.state.keysFound, bossesDown: G.Objectives.state.bossesDown,
        correct: g.correctCount, wrong: g.wrongCount, correctKills: g.correctKills, kills: g.totalZombiesKilled,
        notes: Array.from(g.notesReadRun).sort().join(","), met: B.run.met.join(","), downs: B.run.downs.length,
        perkBag: G.PerkBag.bag.join(","), prices: JSON.stringify(G.Shop.prices), wrongWords: JSON.stringify(g.wrongWordsThisRun),
      };
      const bad = Object.keys(got).filter((k) => String(got[k]) !== String(want[k]));
      ok("J2 " + tag + ": every kept item is back (" + Object.keys(got).length + " checked)", bad.length === 0, bad.map((k) => k + ": " + got[k] + " != " + want[k]).join("; "));
      ok("J2 " + tag + ": the abilities are ready (cooldowns cleared)", A.slots.every((s) => s.cd === 0));
      ok("J2 " + tag + ": the keycard is still taken, the grille still shut", F.s.taken && !W.thirdFloor.unlocked && !F.mesh.visible);
      ok("J2 " + tag + ": the three notes read are not lying about again", G.Notes.placed.every((n) => !g.notesReadRun.has(n.note.id)) && G.Notes.placed.length === G.Notes.PER_RUN - 3);
      ok("J2 " + tag + ": the key found stays found", W.keys[0].taken && !W.keys[0].mesh.visible);
    };
    const pl2 = () => g.player;
    contBtn.click();
    ok("J3 Continue: back in the game at wave 11", g.state === "GAMEPLAY" && g.wave === 11);
    check("after Continue");
    const nextOffer = A.draw();
    ok("J2 abilities offered before are never offered after loading", nextOffer.every((id) => !want.offered.includes(id)) && nextOffer.length === 5, nextOffer.join(","));
    A.bag = nextOffer.concat(A.bag);                   // (put them back)
    A.offered = A.offered.slice(0, -5);
    // again: as often as wanted, always from the same state
    g.wave = 12; pl2().money = 1; pl2().hp = 0; g.checkPlayerDeath();
    ok("J3 dying again: Continue is still offered", g.state === "GAME_OVER" && !contBtn.classList.contains("hidden"));
    contBtn.click();
    check("after a second Continue");
    ok("J4 the checkpoint counts how often it was used", C.get(1).continues === 2 && g._continues === 2);
    // waves 15 and 20 bring bosses the run has not met
    const met0 = B.run.met.slice();
    const b15 = toBoss(null, 15).def.id; finishBoss(false); g.leaveShop();
    const b20 = toBoss(null, 20).def.id;
    ok("J2 bosses at waves 15 and 20 differ from 5 and 10 (and each other)", !met0.includes(b15) && !met0.includes(b20) && b15 !== b20, met0.join(",") + " -> " + b15 + ", " + b20);
    B.reset(g);
    // the pause menu
    g.state = "GAMEPLAY"; g.paused = false; G.Modal.reset();
    g.pause();
    ok("J3 pause: \"Progress will resume from Wave 11\"", /Progress will resume from Wave 11/.test(document.getElementById("pause-checkpoint").textContent));
    g.resume();
    // the leaderboard marks a run that used Continue
    G.save.leaderboards.level1 = [];
    pl2().hp = 0; g.checkPlayerDeath();
    G.UI.renderLeaderboard("level1");
    ok("J4 leaderboard: an entry from a continued run shows an icon", G.save.leaderboards.level1.some((e) => e.meta === "continued") && !!document.querySelector("#leaderboard-content .lb-cont"));
    // the lobby after quitting
    g.quitToMainMenu();
    G.Lobby.tab = "campaign"; G.Lobby.sel.campaign = 0; G.Lobby.renderTab(true);
    const card = document.querySelector('.lcard[data-id="school"]');
    ok("J3 lobby: the level card shows \"Continue - Wave 11\"", card && /Continue - Wave 11/.test(card.textContent));
    ok("J3 lobby: and a Continue button", /Continue - Wave 11/.test((document.getElementById("lobby-cp-btn") || {}).textContent || ""));
    G.Lobby.instant = true;
    G.Lobby.launch();
    ok("J3 lobby: choosing the level asks: Continue, New Run or Cancel", G.Dialog.isOpen() && document.querySelectorAll("#dialog-btns button").length === 3 && G.Modal.isOpen("dialog"));
    ok("J3 the question window works with a controller", G.Pad.scope() === document.getElementById("dialog-box"));
    document.querySelectorAll("#dialog-btns button")[1].click();
    ok("J3 New Run: first asks to confirm that the checkpoint will be deleted", G.Dialog.isOpen() && /deletes your checkpoint at Wave 11/.test(document.getElementById("dialog-text").textContent));
    key("Escape");
    ok("J3 Cancel keeps the checkpoint", !G.Dialog.isOpen() && C.has(1) && G.Game.state === "MENU");
    // reopen the browser: the save read back from localStorage
    G.persist();
    const reread = G.normalizeSave(JSON.parse(localStorage.getItem("vocabZombie_save_v1")));
    ok("J4 closing and reopening the browser keeps it", reread.checkpoints.level1 && reread.checkpoints.level1.wave === 11 && reread.checkpoints.level1.continues === 2);
    // Export / Import
    const exported = JSON.parse(JSON.stringify({ format: G.SAVE_FORMAT, save: G.save })).save;
    ok("J4 in Export / Import Save", G.normalizeSave(exported).checkpoints.level1.score === want.score);
    const broken = G.normalizeSave({ unlockedLevels: [1], checkpoints: { level1: { levelId: 2, wave: 11 }, level2: "x", level9: {} } });
    ok("J4 a broken checkpoint in a file is dropped, not loaded", JSON.stringify(broken.checkpoints) === "{}");
    // one per level
    fresh(2); g.wave = 10; g.mode = "campaign"; C.save(g);
    G.save.checkpoints.level1 = reread.checkpoints.level1;
    ok("J3 one checkpoint per level (school, hospital, bunker)", C.has(1) && C.has(2) && !C.has(3) && C.get(2).levelId === 2);
    // Restart from Wave 1 from Game Over: asks, then deletes
    g.continueFromCheckpoint(1);
    g.player.hp = 0; g.checkPlayerDeath();
    retryBtn.click();
    ok("J3 Restart from Wave 1 asks first", G.Dialog.isOpen() && g.state === "GAME_OVER");
    document.querySelector("#dialog-btns .btn-danger").click();
    ok("J3 ...then deletes the checkpoint and starts at wave 1", !C.has(1) && g.wave === 1 && g.state === "GAMEPLAY");
    // before wave 10: only Retry
    g.player.hp = 0; g.checkPlayerDeath();
    ok("J3 dying before the checkpoint: only Retry", contBtn.classList.contains("hidden") && retryBtn.textContent === "Retry");
    g.state = "GAMEPLAY"; g.pause();
    ok("J3 pause before it: says when one will be kept", /after the Wave 10 boss/.test(document.getElementById("pause-checkpoint").textContent));
    g.resume();
    // a win deletes it (round6-test checks the real win; here the call)
    C.save(Object.assign(Object.create(g), { wave: 10 }));
    ok("(a checkpoint made for the next check)", C.has(1));
    G.Objectives.state.latched = true;
    g.onVictory();
    ok("J3 Victory deletes that level's checkpoint", !C.has(1) && C.has(2));
    unfield();
  }

  async function run() {
    results.length = 0;
    // (the page has to have started: a save to put back, a scene to build)
    for (let i = 0; i < 200 && !(G.save && G.Game.renderer); i++) await new Promise((r) => setTimeout(r, 50));
    if (!G.save) return { total: 1, pass: 0, fail: [{ name: "the game had not started", pass: false, info: "" }], results: [] };
    const saved = JSON.stringify(G.save);
    G._missingKeys = {};
    // (the test page may be granted the mouse lock, and a lock it loses
    // unasked pauses the game -- not what is under test here)
    const rpl = G.Input.requestPointerLock;
    G.Input.requestPointerLock = function () {};
    try {
      data(); await tick();
      noDamage(); await tick();
      cooldowns(); await tick();
      effects(); await tick();
      bossResist(); await tick();
      await hive(); await tick();
      controls(); await tick();
      await floor3(); await tick();
      await checkpoint();
      ok("no missing strings", Object.keys(G._missingKeys || {}).length === 0, Object.keys(G._missingKeys || {}).join(","));
    } catch (e) {
      ok("no exception", false, String(e && e.stack || e));
    } finally {
      G.Input.requestPointerLock = rpl;
      if (G.Dialog.isOpen()) G.Dialog.close();
      unfield();
      G.save = JSON.parse(saved);
      G.persist();
      G.Input.keys = {};
      G.Modal.reset();
      G.Lobby.instant = false;
      if (G.Game._upd) G.Game.update = G.Game._upd;
      G.Game.quitToMainMenu();
    }
    const fail = results.filter((r) => !r.pass);
    return { total: results.length, pass: results.length - fail.length, fail, results };
  }
  return { run };
})();
