// Dev-only (not shipped). The overhaul, round 3: the sound -- js/audio.js
// (the mixer, the voices, steps, impacts, occlusion, the crowd), js/gunaudio.js
// (shots drawn ahead, the events), js/acoustics.js (the rooms), js/captions.js,
// js/data/soundbank.js, js/settings.js, js/core.js, js/debug.js (the stress test).
//   A  the mixer: Master -> compressor -> limiter -> ceiling; the buses and
//      their faders; ducking (music -6 dB, ambience -4 dB, in 0.1 s, back in
//      0.8 s); paused, the game's buses silent and the UI's not
//   B  the voices: each kind's limit, the level's total, the least important
//      (then the farthest) gives way, a warning never waits, tags, stopAll
//   C  the guns: drawn ahead (2-6 variants by level), never the same twice
//      running, +-3% pitch, +-1 dB; one sound a shot (weapon:fire); each
//      family within 1.5 dB of its median; low ammo once; no reserve: the
//      refusal and the HUD line; a reload's sounds on its markers only, a
//      cancel stops them
//   D  steps by the floor's surface, the landing, the nearest zombies' steps,
//      the crowd's bed, impacts by surface
//   E  the rooms: the space by region, the crossfade, the reverb by level
//   F  occlusion (a wall: -6 dB and a low-pass) and HRTF (High+, the nearest few)
//   G  the settings (Master, Weapons, UI, test sounds, captions; an old save),
//      the captions with their arrows, the sound bank
//   H  the stress test: 30 zombies, the trigger held, explosions -- no
//      clipping, every limit kept; nothing left playing after death or a
//      level change
// Load it into the game (past the Start screen, in the lobby), then:
//   const r = await G.Round23Test.run();   r.fail -> [] when everything passes
window.G = window.G || {};
G.Round23Test = (function () {
  const results = [];
  const ok = (name, cond, info) => { results.push({ name, pass: !!cond, info: info === undefined ? "" : info }); };
  const S = () => G.save.settings;
  const AC = () => G.CONFIG.audio;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  // ms on the audio clock (a hidden page's timers and its audio do not keep step)
  const aw = async (ms) => {
    const ctx = G.Audio.ctx;
    if (!ctx || ctx.state !== "running") return wait(ms);
    const t = ctx.currentTime + ms / 1000, t0 = Date.now();
    while (ctx.currentTime < t && Date.now() - t0 < ms + 8000) await wait(Math.min(40, ms));
  };
  const near = (a, b, tol) => Math.abs(a - b) <= tol;
  const dB = (g) => 20 * Math.log10(Math.max(1e-6, g));
  let realUpd = null;

  function start(q, level) {
    const g = G.Game;
    realUpd = realUpd || [g._update0, g._update, g._upd, g._r20, g._r2, g.update].find((f) => typeof f === "function" && f.toString().length > 500);
    G.save.tutorialDone = true;
    if (q) S().graphicsQuality = q;
    g.update = realUpd;
    g.startLevel(level || 1);
    g.applyGraphicsQuality();
    g.update = function () {};
    g.requiredKills = 1e9;
    g.clearZombies();
    g.player.hp = g.player.maxHp = 1e6;
    G.Modal.reset();
    g.paused = false; g.state = "GAMEPLAY";
    G.Input.clearHeldInputs();
    step(g, 3);
    return g;
  }
  const step = (g, n, dt) => { for (let i = 0; i < (n || 1); i++) realUpd.call(g, dt || 1 / 60); };
  const give = (g, id) => {
    const d = G.WEAPON_DEFS[id];
    if (!g.player.ammo[id]) { g.player.ammo[id] = { mag: d.magSize, reserve: 999 }; g.player.weaponLevels[id] = { dmg: 1, rate: 1, mag: 1 }; }
    g.player.gunSlots = [id]; g.player.currentSlot = 1; g.wsm.requestSwitch(); step(g, 70);
  };
  const region = (g, re) => g.world.regions.find((r) => re.test(r.name));
  // (a region upstairs carries its floor's height: y)
  const goTo = (g, r) => { const x = (r.minX + r.maxX) / 2, z = (r.minZ + r.maxZ) / 2; g.yawObject.position.set(x, 1.7 + G.getFloorHeightAt(g.world, x, z, (r.y || 0) + 0.1), z); g.velocityY = 0; g.yawObject.updateMatrixWorld(true); };
  // a spy on obj[name]: the calls' arguments, put back by .off()
  const spy = (obj, name) => {
    const real = obj[name], calls = [];
    obj[name] = function (...a) { calls.push(a); return real.apply(this, a); };
    calls.off = () => { obj[name] = real; };
    return calls;
  };
  const gameVoices = () => { const c = G.Audio.counts(); return G.Audio.GAME_CATS.reduce((n, k) => n + (c[k] || 0), 0); };
  const until = async (fn, ms) => { const t0 = Date.now(); while (!fn()) { if (Date.now() - t0 > (ms || 15000)) return false; await wait(60); } return true; };

  // ---------------- A ----------------
  async function mixer() {
    const A = G.Audio, ctx = A.ctx;
    ok("A the context runs", ctx && ctx.state === "running", ctx && ctx.state);
    ok("A the buses: music, weapons, sfx, ambient, ui (+ the room's)", ["music", "weapons", "sfx", "ambient", "ui", "reverb"].every((k) => A.bus[k] && A.mod[k]));
    const C = AC();
    ok("A compressor and limiter as set (limiter at -1.5 dB, ratio 20)", C.limiter.threshold === -1.5 && C.limiter.ratio === 20 && C.compressor.ratio === 6);
    ok("A the ceiling: -1 dBFS", C.ceilingDb === -1);
    // (a quiet sound through every bus and the room while they are read: the
    // browser does not run a chain with nothing coming in, and its gains then read stale)
    const feed = (secs) => ["music", "weapons", "sfx", "ambient", "ui"].forEach((b) => A.noise({ dur: secs, gain: 0.0004, bus: b, cat: b === "weapons" ? "weapons" : b, prio: true, rev: 0.5 }));
    // the faders
    feed(1.2);
    const was = { m: S().masterVolume, w: S().weaponsVolume };
    S().masterVolume = 0.5; S().weaponsVolume = 0.4; A.applyVolumes();
    await aw(400);
    ok("A Master and Weapons faders", near(A.master.gain.value, 0.5, 0.02) && near(A.bus.weapons.gain.value, 0.4 * C.busGain.weapons, 0.02), A.master.gain.value.toFixed(3) + " / " + A.bus.weapons.gain.value.toFixed(3));
    S().masterVolume = was.m; S().weaponsVolume = was.w; A.applyVolumes();
    // ducking
    A.duck("boss", true);
    await aw(350);
    const mDuck = dB(A.mod.music.gain.value), aDuck = dB(A.mod.ambient.gain.value);
    ok("A a duck: music -6 dB, ambience -4 dB (in ~0.1 s)", near(mDuck, C.duck.music, 0.6) && near(aDuck, C.duck.ambient, 0.6), mDuck.toFixed(1) + " / " + aDuck.toFixed(1));
    A.duck("boss", false);
    await aw(250);
    const mid = dB(A.mod.music.gain.value);
    await aw(1100);
    ok("A ...released over ~0.8 s", mid < -0.5 && near(A.mod.music.gain.value, 1, 0.05), mid.toFixed(1) + " -> " + dB(A.mod.music.gain.value).toFixed(1));
    A.duck("x", true, 0.3);
    await aw(700);
    A.duckTick();
    ok("A a timed duck ends by itself", !A._duck.x);
    // paused
    feed(1.4);
    A.setPaused(true);
    await aw(300);
    ok("A paused: weapons, sfx, ambience, the room silent; UI at full; music -6 dB", ["weapons", "sfx", "ambient", "reverb"].every((k) => A.mod[k].gain.value < 0.02) && A.mod.ui.gain.value > 0.98 && near(dB(A.mod.music.gain.value), C.pauseMusic, 0.6));
    A.sfx("correct");
    ok("A ...a UI sound still plays", (A.counts().ui || 0) >= 1);
    A.setPaused(false);
    await aw(300);
    ok("A unpaused: all back", ["weapons", "sfx", "ambient", "reverb", "ui"].every((k) => A.mod[k].gain.value > 0.95));
  }

  async function gameState(g) {
    const A = G.Audio;
    g.pause(); step(g, 1);
    ok("A the game's pause pauses the sound", A.paused === true);
    g.resume(); g.paused = false; step(g, 1);
    ok("A ...and resuming lifts it", A.paused === false);
    G.Quiz.active = true; step(g, 1);
    const q = !!A._duck.question;
    G.Quiz.active = false; step(g, 1);
    ok("A a question ducks; its end lets go", q && !A._duck.question);
  }

  // ---------------- B ----------------
  async function voices(g) {
    const A = G.Audio, C = AC();
    A.stopAll(); A.stopAll(["ui", "ambient"]);
    const p = g.yawObject.position;
    const at = (d) => new THREE.Vector3(p.x + d, p.y, p.z);
    for (let i = 0; i < 20; i++) A.impact("concrete", at(2 + i));
    ok("B a kind's limit (impacts: 8)", A.counts().impact === C.limits.impact, A.counts().impact);
    // the farthest gives way to a nearer one of the same importance
    const far = Math.max.apply(null, A.live.filter((v) => v.cat === "impact").map((v) => v.pos.x - p.x));
    A.impact("concrete", at(1));
    const far2 = Math.max.apply(null, A.live.filter((v) => v.cat === "impact").map((v) => v.pos.x - p.x));
    ok("B ...a nearer one takes the farthest's place", far2 < far && A.counts().impact === C.limits.impact, far.toFixed(0) + " -> " + far2.toFixed(0));
    // a less important one waits
    const V = A.group({ cat: "impact", prio: 4, pos: at(0.5), dur: 0.3 }, () => {});
    ok("B ...a less important one does not get in", V === null);
    // a warning never waits, and still keeps the limit
    A.stopAll(["ui"]);
    for (let i = 0; i < 6; i++) A.sfx("pickup");
    A.sfx("correct");
    const ui = A.live.filter((v) => v.cat === "ui");
    ok("B a warning (an answer) always plays, inside the UI limit (4)", ui.length === C.limits.ui && ui.some((v) => v.prio === 0), ui.length);
    // the level's total
    const q0 = S().graphicsQuality;
    S().graphicsQuality = "low";
    A.stopAll(); A.stopAll(["ui"]);
    for (let i = 0; i < 12; i++) { A.impact("wood", at(3 + i)); A.footstep("tile", false, { pos: at(2 + i) }); A.zombie("growl", "normal", at(4 + i)); A.sfx("body_thud", { pos: at(5 + i) }); }
    ok("B the level's total (Low: 20)", A.counts().total <= C.total.low, A.counts().total);
    S().graphicsQuality = q0;
    // tags and stopAll
    A.stopAll();
    G.GunAudio.reload("out", G.WEAPON_DEFS.pistol, "reload:t1");
    G.GunAudio.reload("in", G.WEAPON_DEFS.pistol, "reload:t1");
    const n1 = A.live.filter((v) => v.tag === "reload:t1").length;
    A.stopTag("reload:t1");
    ok("B a tag: its sounds stop together", n1 === 2 && !A.live.some((v) => v.tag === "reload:t1"), n1);
    for (let i = 0; i < 5; i++) { A.impact("metal", at(2 + i)); A.zombie("growl", "fast", at(3 + i)); }
    A.stopAll();
    ok("B stopAll: nothing of the game's left", gameVoices() === 0);
  }

  // ---------------- C ----------------
  async function guns(g) {
    const A = G.Audio, GA = G.GunAudio, C = AC();
    give(g, "pistol");
    GA.prepare(["pistol"]);
    const ready = await until(() => GA.cache.has("pistol"), 20000);
    const R = GA.cache.get("pistol");
    ok("C a gun drawn ahead: High 6 variants", ready && R.buffers.length === C.gunVariants.high, R && R.buffers.length);
    ok("C ...each a short buffer (trimmed)", R && R.buffers.every((b) => b.duration > 0.03 && b.duration < 1.9), R && R.buffers.map((b) => b.duration.toFixed(2)).join());
    // picks: never twice running, pitch and level in range
    const calls = spy(A, "buffer"), picks = [];
    const realRandom = Math.random;
    for (let i = 0; i < 40; i++) { GA.shot(G.WEAPON_DEFS.pistol, {}); picks.push(R.prev); }
    calls.off();
    const twice = picks.some((v, i) => i && v === picks[i - 1]);
    const rates = calls.map((c) => c[1].rate), gains = calls.map((c) => c[1].gain);
    const s = GA.profile(G.WEAPON_DEFS.pistol).gain * 0.85 * R.norm;
    ok("C never the same variant twice running", !twice && new Set(picks).size >= 4, picks.slice(0, 12).join(""));
    ok("C pitch within +-3%", rates.every((r) => near(r, 1, C.gunPitch + 1e-6)), Math.min.apply(null, rates).toFixed(3) + ".." + Math.max.apply(null, rates).toFixed(3));
    ok("C level within +-1 dB", gains.every((x) => Math.abs(dB(x / s)) <= C.gunGainDb + 1e-3));
    Math.random = realRandom;
    // one sound a shot, from weapon:fire
    A.stopAll();
    const shots = spy(GA, "shot");
    const before = GA.stats.played + GA.stats.live;
    g.player.ammo.pistol.mag = 10; g.player.fireCooldown = 0; G.onFirePress(); step(g, 1);
    shots.off();
    ok("C one sound for one shot (the weapon:fire event, not shoot())", shots.length === 1 && GA.stats.played + GA.stats.live - before === 1, shots.length);
    const twiceSame = spy(GA, "shot"); const pl = GA.stats.played;
    GA.shot(G.WEAPON_DEFS.pistol, { shotId: 999001 }); GA.shot(G.WEAPON_DEFS.pistol, { shotId: 999001 });
    twiceSame.off();
    ok("C a shot id is heard once", GA.stats.played - pl === 1);
    // low ammo: once, crossing a quarter of the magazine
    const sfx = spy(A, "sfx");
    g.player.ammo.pistol.mag = 12; g.player.ammo.pistol.reserve = 99;
    for (let i = 0; i < 12; i++) { g.player.fireCooldown = 0; g.wsm.requestFire({ pressed: true }); step(g, 2); }
    const low = sfx.filter((c) => c[0] === "lowammo").length;
    ok("C low ammo: one tick, once", low === 1, low);
    // nothing to load: the refusal and the HUD line
    step(g, 200);
    g.wsm.cancelReload("test"); step(g, 2);
    g.player.ammo.pistol.mag = 0; g.player.ammo.pistol.reserve = 0;
    sfx.length = 0;
    g.player.fireCooldown = 0; G.onFirePress(); step(g, 1);
    const note = document.getElementById("hud-note");
    ok("C no reserve: the dry click, the refusal, \"" + G.T("hud.noReserve") + "\" on the HUD", sfx.some((c) => c[0] === "empty") && sfx.some((c) => c[0] === "deny") && !note.classList.contains("hidden") && note.textContent === G.T("hud.noReserve"));
    sfx.off();
    // a reload's sounds: one on each marker, tagged; a cancel stops them
    g.player.ammo.pistol.mag = 3; g.player.ammo.pistol.reserve = 99;
    const marks = [], rel = spy(GA, "reload");
    const on = (e) => { if (e.phase === "marker" && !e.silent) marks.push(e.kind); };
    G.Bus.on("weapon:reload", on, "r23");
    g.reload();
    for (let i = 0; i < 400 && g.wsm.rl; i++) step(g, 1);
    // (the dropped magazine hitting the floor -- "land", js/viewmodel.js -- is the prop's own, not the reload's)
    const rl = rel.filter((c) => c[0] !== "land");
    ok("C a reload: a sound on each marker, nothing else", marks.length >= 3 && rl.length === marks.length && rl.every((c) => /^reload:\d+$/.test(c[2])), marks.join(",") + " / " + rl.length);
    rel.length = 0; marks.length = 0;
    g.player.ammo.pistol.mag = 2;
    g.reload(); step(g, 30);
    const id = g.wsm.rl && g.wsm.rl.reloadId;
    const tagged = A.live.filter((v) => v.tag === "reload:" + id).length;
    g.cancelReload(); step(g, 1);
    ok("C a cancelled reload: its sounds stop at once", tagged >= 1 && !A.live.some((v) => v.tag === "reload:" + id && !v.dead), tagged);
    rel.off(); G.Bus.off("weapon:reload", on);
    // the families: every gun within 1.5 dB of its family's median
    for (const gid of ["smg", "rifle"].map((f) => Object.values(G.WEAPON_DEFS).filter((d) => G.ViewModel.family(d) === f).slice(0, 3)).flat().map((d) => d.id)) GA.prepare([gid]);
    await until(() => !GA.busy && !GA.queue.length, 60000);
    const off = [];
    GA.cache.forEach((r, gid) => { const f = GA.family[G.ViewModel.family(G.WEAPON_DEFS[gid])]; if (Math.abs(r.rms + r.corr - f) > C.familySpreadDb + 0.01) off.push(gid); });
    ok("C each gun within 1.5 dB of its family's loudness", GA.cache.size >= 5 && !off.length, GA.cache.size + " guns; off: " + off.join(","));
  }

  // ---------------- D ----------------
  function steps(g) {
    const A = G.Audio;
    const yard = region(g, /^YARD$/), corr = region(g, /^C1S$/);
    const lib = g.world.regions.find((r) => (g.world.roomTypeOf || {})[r.name] === "library");
    const surf = (r) => { goTo(g, r); const p = g.yawObject.position; return G.Surface.floor(g.world, p.x, p.z, p.y - 1.7); };
    const s1 = surf(yard), s2 = surf(corr), s3 = lib ? surf(lib) : "wood";
    ok("D the floor's surface: grass out in the yard, tile in a corridor, wood in the library", s1 === "grass" && s2 === "tile" && s3 === "wood", [s1, s2, s3].join());
    // the player's step: what is underfoot
    goTo(g, yard);
    const fs = spy(A, "footstep"), takeSteps = G.PlayerBody.takeSteps;
    G.PlayerBody.takeSteps = () => [1];
    const p = g.yawObject.position;
    g._lastStepPos = { x: p.x - 0.2, z: p.z }; g.velocityY = 0;
    g.updateAudio(0.05);
    G.PlayerBody.takeSteps = takeSteps;
    ok("D a step on the grass sounds like grass", fs.length >= 1 && fs[0][0] === "grass", fs.length && fs[0][0]);
    fs.length = 0;
    // the landing
    const base = 1.7 + G.getFloorHeightAt(g.world, p.x, p.z, 0);
    p.y = base + 0.01; g.velocityY = -4.2;
    g.updatePlayerMovement(1 / 30);
    ok("D a landing: a heavier step", fs.some((c) => c[2] && c[2].land), fs.length);
    fs.length = 0;
    // the zombies' steps: the nearest three only
    g.clearZombies();
    const zs = [];
    for (let i = 0; i < 6; i++) { const z = g.spawnZombieAt("normal", new THREE.Vector3(p.x + 2 + i * 1.5, p.y - 1.7, p.z + 0.5)); if (z) zs.push(z); }
    for (let t = 0; t < 30; t++) {
      zs.forEach((z) => { z._stepAt = { x: z.mesh.position.x - 0.06, z: z.mesh.position.z }; });
      g.updateAudio(1 / 30);
    }
    const who = new Set(fs.filter((c) => c[2] && c[2].pos).map((c) => Math.round(c[2].pos.x - p.x)));
    ok("D zombies' steps: only the nearest three", who.size >= 1 && who.size <= AC().zombieSteps && Math.max.apply(null, [...who]) <= 2 + 2 * 1.5 + 1, [...who].join());
    fs.off();
    // the crowd's bed
    for (let i = 0; i < 12; i++) g.spawnZombieAt("normal", new THREE.Vector3(p.x - 3 - (i % 4), p.y - 1.7, p.z + (i % 3) * 2));
    A.hordeTick(0.1, g);
    return aw(900).then(() => {
      const H = A._level && A._level.horde;
      ok("D the crowd: a bed that rises with the zombies close by", H && H.out.gain.value > 0.15, H && H.out.gain.value.toFixed(3));
      g.clearZombies();
      A.hordeTick(0.1, g);
      // impacts
      const imp = spy(A, "impact");
      G.FX.impact({ point: new THREE.Vector3(p.x + 3, p.y, p.z), normal: new THREE.Vector3(-1, 0, 0), surface: "metal" });
      imp.off();
      ok("D a round landing on metal sounds like metal", imp.length === 1 && imp[0][0] === "metal");
    });
  }

  // ---------------- E ----------------
  async function rooms(g) {
    const Ac = G.Acoustics, A = G.Audio, C = AC();
    const zoneOf = (re) => { const r = region(g, re); goTo(g, r); return Ac.zoneAt(g); };
    const T = g.world.roomTypeOf || {};
    const cls = g.world.regions.find((r) => T[r.name] === "classroom"), lib = g.world.regions.find((r) => T[r.name] === "library");
    const got = [zoneOf(/^YARD$/), zoneOf(/^C1S$/), zoneOf(/^ENTRY$/), (goTo(g, cls), Ac.zoneAt(g)), (goTo(g, lib), Ac.zoneAt(g))];
    ok("E the space: yard outdoor, corridor, entry hall, classroom a small room, library large", got.join() === "outdoor,corridor,hall,room,hall", got.join());
    const th = g.level.theme;
    g.level.theme = "bunker";
    const b = zoneOf(/^C1S$/);
    g.level.theme = th;
    ok("E ...the bunker's corridors are underground", b === "underground", b);
    // the crossfade
    S().graphicsQuality = "high"; Ac.update(0.3, g);
    // (timed on the audio clock: a hidden page's timers and its audio do not keep step)
    const ctx = G.Audio.ctx, after = async (sec) => { const t = ctx.currentTime + sec; await until(() => ctx.currentTime >= t, 8000); };
    Ac.force = null; Ac.setZone("room", true);
    await after(0.1);
    // (something in the room to hear: a node with nothing coming in is not run, and its gains then read stale)
    A.noise({ dur: 1.6, gain: 0.02, rev: 1, bus: "sfx", prio: true });
    Ac.setZone("warehouse");
    const to = Ac.slots[Ac.active], from = Ac.slots[1 - Ac.active];
    await after(0.2);
    const midTo = to.gain.gain.value, midFrom = from.gain.gain.value;
    await after(0.7);
    ok("E a new space: the idle convolver takes it, a crossfade of ~0.6 s", midTo > 0.005 && midTo < C.zones.warehouse.wet * 0.8 && midFrom > 0.005 && near(to.gain.gain.value, C.zones.warehouse.wet, 0.01) && from.gain.gain.value < 0.005,
      midTo.toFixed(3) + "/" + midFrom.toFixed(3) + " -> " + to.gain.gain.value.toFixed(3));
    const ir = Ac.ir("warehouse"); let e = 0; const d = ir.getChannelData(0); for (let i = 0; i < d.length; i++) e += d[i] * d[i];
    ok("E the impulse responses: unit energy, as long as their RT60", near(e, 1, 0.01) && ir.duration > C.zones.warehouse.rt60, e.toFixed(3) + ", " + ir.duration.toFixed(2) + " s");
    // by graphics level
    const modes = {};
    for (const q of ["vlow", "low", "medium", "high", "vhigh"]) {
      S().graphicsQuality = q; Ac.update(0.3, g);
      modes[q] = Ac.mode + (Ac.slots ? "/conv" : "") + (Ac.delay ? "/delay" : "") + (Ac.far ? "/far" : "");
    }
    ok("E by level: Very Low none, Low a delay, Medium short, High full, Ultra + the far echo", modes.vlow === "off" && modes.low === "delay/delay" && modes.medium === "short/conv" && modes.high === "full/conv" && modes.vhigh === "full+/conv/far", JSON.stringify(modes));
    S().graphicsQuality = "medium"; Ac.update(0.3, g);
    const short = Ac.ir("warehouse");
    ok("E ...Medium's impulses cut short", short.duration <= C.shortMax + 0.01, short.duration.toFixed(2));
    S().graphicsQuality = "high"; Ac.update(0.3, g);
  }

  // ---------------- F ----------------
  async function occlusion(g) {
    const A = G.Audio, C = AC();
    const corr = region(g, /^C1S$/), room = g.world.regions.find((r) => (g.world.roomTypeOf || {})[r.name] === "classroom");
    goTo(g, corr); step(g, 2);
    const behind = new THREE.Vector3((room.minX + room.maxX) / 2, 1.4, (room.minZ + room.maxZ) / 2);
    const open = g.yawObject.position.clone().add(new THREE.Vector3(0, -0.3, 2.5));
    A.stopAll();
    const V1 = A.group({ cat: "zombie", prio: 2, pos: behind, dur: 1.5 }, () => A._zombie("growl", "normal", behind));
    const V2 = A.group({ cat: "zombie", prio: 2, pos: open, dur: 1.5 }, () => A._zombie("growl", "normal", open));
    await aw(450);
    ok("F a wall in the way: muffled (-6 dB, low-pass 900 Hz)", V1.occ.occluded && near(dB(V1.occ.gain.gain.value), C.occluded.gainDb, 0.5) && near(V1.occ.lp.frequency.value, C.occluded.lowpass, 30));
    ok("F ...in the open: clear", !V2.occ.occluded && V2.occ.lp.frequency.value > 15000);
    ok("F HRTF on High for one close by", V2.occ.hrtf === true && V1.occ.hrtf === false);
    // the change is eased in
    g.yawObject.position.set(behind.x + 1, 1.7, behind.z + 1); A.updateListener(g.camera);
    A._occT = 0; A.occlusionTick(0.01);
    await aw(60);
    const midLp = V1.occ.lp.frequency.value;
    await aw(400);
    ok("F walking in: it clears over ~0.2 s, not at once", !V1.occ.occluded && midLp < 19000 && V1.occ.lp.frequency.value > 15000, midLp.toFixed(0) + " -> " + V1.occ.lp.frequency.value.toFixed(0));
    // HRTF: at most the level's few, and none below High
    A.stopAll();
    const p = g.yawObject.position;
    const vs = []; for (let i = 0; i < 8; i++) vs.push(A.group({ cat: "sfx", prio: 2, pos: new THREE.Vector3(p.x + 1 + i * 0.3, p.y, p.z), dur: 1 }, () => A.noise({ dur: 0.5, gain: 0.01 })));
    ok("F HRTF for the nearest few only (High: 4)", vs.filter((v) => v && v.occ.hrtf).length === C.hrtf.high);
    S().graphicsQuality = "medium";
    A.stopAll();
    const vm = A.group({ cat: "sfx", prio: 2, pos: new THREE.Vector3(p.x + 1, p.y, p.z), dur: 1 }, () => A.noise({ dur: 0.5, gain: 0.01 }));
    ok("F Medium: no HRTF", vm && !vm.occ.hrtf);
    S().graphicsQuality = "low";
    ok("F Low: no occlusion rays", A.occludedAt(behind) === false);
    S().graphicsQuality = "high";
    ok("F the rays a second / sounds by level: Medium 4/4, High 8/8, Ultra 10/12", JSON.stringify([C.occlusion.medium, C.occlusion.high, C.occlusion.vhigh]) === "[[4,4],[8,8],[10,12]]");
  }

  // ---------------- G ----------------
  async function settingsAndCaptions(g) {
    const d = G.defaultSave().settings;
    ok("G new faders: Master 100%, Weapons 80%, UI 80%; captions off", d.masterVolume === 1 && d.weaponsVolume === 0.8 && d.uiVolume === 0.8 && d.captions === false);
    const old = G.normalizeSave({ unlockedLevels: [1], settings: { sfxVolume: 0.35, musicVolume: 3 } }).settings;
    ok("G an old save: the guns and menus start at its Sound Effects level, Master at full; out of range brought back", old.weaponsVolume === 0.35 && old.uiVolume === 0.35 && old.masterVolume === 1 && old.musicVolume === 1 && old.captions === false, JSON.stringify([old.weaponsVolume, old.uiVolume, old.masterVolume, old.musicVolume]));
    const cat = G.SettingsUI.cat;
    G.SettingsUI.cat = "audio";
    G.UI.showScreen("screen-settings"); G.SettingsUI.render();
    const ids = ["masterVolume", "musicVolume", "weaponsVolume", "sfxVolume", "ambientVolume", "uiVolume", "speechVolume"];
    const sliders = ids.filter((k) => { const e = document.getElementById("set-" + k); return e && e.type === "range" && e.closest("#set-sec-audio"); });
    const tests = ids.filter((k) => document.getElementById("btn-vtest-" + k));
    ok("G Sound: seven faders, each with a test sound", sliders.length === 7 && tests.length === 7, sliders.length + "/" + tests.length);
    const cs = document.getElementById("set-captions");
    ok("G ...and a Captions switch", cs && cs.getAttribute("role") === "switch");
    // a test sound plays on its own bus, paused too
    G.Audio.setPaused(true);
    G.Audio.stopAll();
    document.getElementById("btn-vtest-weaponsVolume").click();
    await aw(120);
    ok("G a fader's test sound: on its bus, heard from the pause menu", (G.Audio.counts().weapons || 0) >= 1 && G.Audio.mod.weapons.gain.value > 0.9);
    G.Audio.setPaused(false);
    G.SettingsUI.cat = cat; G.UI.showScreen(null);
    // captions
    const Cp = G.Captions;
    Cp.clear(); S().captions = false;
    const p = g.yawObject.position, yaw = g.yawObject.rotation.y;
    G.Audio.updateListener(g.camera);
    const left = p.clone().add(new THREE.Vector3(-Math.cos(yaw), 0, Math.sin(yaw)).multiplyScalar(5));
    Cp.heard("zombie:growl", left);
    ok("G captions off: nothing written", !document.querySelectorAll("#hud-captions .hud-cap").length);
    S().captions = true;
    Cp.heard("zombie:growl", left);
    Cp.heard("zombie:growl", left);
    const lines = document.querySelectorAll("#hud-captions .hud-cap");
    ok("G captions on: \"[" + G.T("cap.growl") + "] ←\" for a growl to the left, once", lines.length === 1 && lines[0].textContent.indexOf(G.T("cap.growl")) >= 0 && /←/.test(lines[0].textContent), lines.length && lines[0].textContent);
    ["explosion", "door", "boss:roar", "sfx:glass_break"].forEach((k) => Cp.heard(k, left));
    ok("G ...three lines at most", document.querySelectorAll("#hud-captions .hud-cap").length === AC().captions.max);
    ok("G ...every caption in the four languages (tools/check-strings.ps1)", Object.values(Cp.KEYS).every((n) => G.T("cap." + n) !== "cap." + n));
    Cp.clear(); S().captions = false;
    // the sound bank
    const B = G.SOUND_BANK, bad = [];
    Object.keys(B).forEach((id) => { try { B[id].play(p.clone().add(new THREE.Vector3(3, 0, 0))); } catch (e) { bad.push(id + ": " + e.message); } });
    ok("G the sound bank: every event plays (" + Object.keys(B).length + "), files and credits ready for recorded sounds", Object.keys(B).length >= 50 && !bad.length && Array.isArray(G.SOUND_CREDITS) && Object.values(B).every((e) => Array.isArray(e.files)), bad.slice(0, 3).join("; "));
    G.Audio.stopAll(); G.Audio.stopAll(["ui"]);
  }

  // ---------------- H ----------------
  async function stress(g) {
    if (!G.Debug) {
      await new Promise((res) => { const s = document.createElement("script"); s.src = "js/debug.js?v=" + Date.now(); s.onload = res; s.onerror = res; document.head.appendChild(s); });
      await until(() => G.Debug && G.Debug.el, 5000);
    }
    const A = G.Audio, C = AC();
    give(g, "smg");
    g.player.ammo.smg.reserve = 999;
    const hub = region(g, /^ENTRY$/); goTo(g, hub); step(g, 3);
    const S0 = G.Debug.stress(true);
    ok("H the stress test: 30 zombies", S0 && S0.zombies === 30, S0 && S0.zombies);
    const t0 = performance.now();
    while (performance.now() - t0 < 8000) { step(g, 2, 1 / 60); G.Debug.stressTick(); await aw(16); }
    const R = G.Debug.stress(false);
    ok("H ...the trigger held, explosions: many shots and blasts", R.blasts >= 5 && G.GunAudio.stats.played > 20, R.blasts + " blasts");
    ok("H ...no clipping: the peak under -0.5 dBFS (ceiling -1)", R.clipped === 0 && R.peak < -0.5, R.peak.toFixed(2) + " dBFS");
    ok("H ...every kind within its limit, all within High's 32", !R.over.length && R.maxTotal <= C.total.high, R.maxTotal + " max; " + R.over.slice(0, 3).join(", "));
    // death: nothing left ringing
    for (let i = 0; i < 5; i++) { g.player.fireCooldown = 0; G.onFirePress(); step(g, 1); }
    g.onGameOver();
    await aw(300);
    const H = A._level && A._level.horde;
    ok("H death: no game sound left, the crowd silent", gameVoices() === 0 && (!H || H.out.gain.value < 0.01), gameVoices());
    // a level change
    const g2 = start("high");
    for (let i = 0; i < 5; i++) { A.impact("concrete", g2.yawObject.position.clone().add(new THREE.Vector3(2 + i, 0, 0))); A.zombie("growl", "normal", g2.yawObject.position.clone().add(new THREE.Vector3(0, 0, 3))); }
    A.duck("boss", true);
    g2.quitToMainMenu();
    ok("H leaving a level: no game sound left, no duck held", gameVoices() === 0 && !Object.keys(A._duck).length && !A.paused);
  }

  async function run() {
    results.length = 0;
    const errs = [];
    const oe = console.error;
    console.error = (...a) => { errs.push(a.map(String).join(" ").slice(0, 300)); oe.apply(console, a); };
    const onErr = (e) => errs.push(String(e.message));
    window.addEventListener("error", onErr);
    const backup = JSON.stringify(G.save);
    const realLock = G.Input.requestPointerLock, realSpawn = G.Spawner.update;
    G.Input.requestPointerLock = function () {};
    G.Spawner.update = function () {};
    try {
      G.Audio.unlock();
      if (G.Audio.ctx && G.Audio.ctx.state !== "running") { try { await G.Audio.ctx.resume(); } catch (e) { /* no gesture */ } }
      await aw(200);
      const g = start("high");
      await mixer();
      await gameState(g);
      await voices(g);
      await guns(g);
      await steps(g);
      await rooms(g);
      await occlusion(g);
      await settingsAndCaptions(g);
      await stress(g);
    } catch (e) {
      ok("ran to the end", false, String(e && e.stack || e).slice(0, 400));
    } finally {
      console.error = oe;
      window.removeEventListener("error", onErr);
      G.Input.requestPointerLock = realLock;
      G.Spawner.update = realSpawn;
      G.Input.clearHeldInputs();
      G.Modal.reset();
      G.Acoustics.force = null;
      if (G.Debug && G.Debug._stress) G.Debug.stress(false);
      if (realUpd) G.Game.update = realUpd;
      if (G.Game.state !== "MENU") G.Game.quitToMainMenu();
      G.save = G.normalizeSave(JSON.parse(backup)); G.persist();
      G.UI.goToMainMenu();
    }
    ok("no uncaught errors", !errs.length, errs.slice(0, 2).join(" | "));
    return { total: results.length, fail: results.filter((r) => !r.pass), pass: results.filter((r) => r.pass).map((r) => r.name + (r.info !== "" ? " [" + r.info + "]" : "")) };
  }
  return { run };
})();
