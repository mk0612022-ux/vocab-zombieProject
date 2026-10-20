// Dev-only (not shipped). The Weapon State Machine on its own (overhaul,
// round 1): every transition in docs/overhaul/weapon-state-machine.md, the
// reload cancel table, then a fuzz test -- 10,000 random presses -- that
// checks what must always hold (nothing stuck, no ammunition from nowhere,
// never a magazine below zero or over its size, never two commits for one
// reload).
//
// It drives js/weaponsm.js through a made-up host (no game, no THREE), so it
// runs the same two ways:
//   in the game page:  load this file, then  const r = G.WsmTest.run();  r.fail -> []
//   under Node:        node tools/overhaul/wsm-test.js
(function (root) {
  "use strict";
  const inNode = typeof window === "undefined" && typeof module !== "undefined";
  let WSM, CFG;
  if (inNode) {
    const path = require("path"), fs = require("fs"), vm = require("vm");
    WSM = require(path.join(__dirname, "..", "..", "public", "js", "weaponsm.js"));
    // the real config, read the way the page reads it
    const ctx = vm.createContext({ console });
    ctx.window = ctx;
    vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "..", "public", "js", "config.js"), "utf8"), ctx);
    CFG = ctx.G.CONFIG.weaponSM;
  } else {
    WSM = root.G.WeaponSM; CFG = root.G.CONFIG.weaponSM;
  }

  // ---------------- a made-up game ----------------
  // four guns of the four reload kinds, and the knife in slot 0
  const DEFS = {
    pistol: { mag: 12, w: "light", gap: 0.25, reload: 1.2, style: "pistol" },
    rifle: { mag: 30, w: "medium", gap: 0.1, reload: 1.8, style: "rifle", auto: true },
    shotgun: { mag: 6, w: "heavy", gap: 0.8, reload: 2.0, style: "shotgun" },
    lmg: { mag: 60, w: "very_heavy", gap: 0.08, reload: 3.0, style: "belt", auto: true },
  };
  const STYLES = {
    pistol: { out: 0.10, drop: 0.18, grab: 0.38, in: 0.58, slap: 0.62, bolt: 0.80 },
    rifle: { out: 0.13, drop: 0.24, grab: 0.44, in: 0.64, slap: 0.70, bolt: 0.84 },
    belt: { cover: 0.16, out: 0.26, drop: 0.34, grab: 0.50, in: 0.66, coverClose: 0.80, bolt: 0.91 },
  };
  function makeHost() {
    const H = {
      guns: ["pistol", "rifle", "shotgun", "lmg"], slot: 1,
      ammo_: {}, cooldown: 0, events: [], warns: [], fullCommits: {}, shotsLog: [],
      dry: 0, swaps: [], meleeHits: 0, sprintStops: 0, auto: true, spell: false, spellOpen: false,
      sm: null, breakPlan: null,
      selected() { return this.slot === 0 ? "melee" : this.guns[this.slot - 1]; },
      ammo(id) { if (id === "melee" || !DEFS[id]) return null; const a = this.ammo_[id]; return { mag: a.mag, reserve: a.reserve, magSize: DEFS[id].mag }; },
      weight(id) { return id === "melee" ? "melee" : (DEFS[id] ? DEFS[id].w : "medium"); },
      family(id) { return id === "melee" ? "knife" : (DEFS[id] ? DEFS[id].style : "rifle"); },
      cooldownReady() { return this.cooldown <= 0; },
      fireInterval(id) { return id === "melee" ? 0.45 : DEFS[id].gap; },
      doFire(shotId, charge, inBurst) {
        const sm = this.sm, id = sm.held, a = this.ammo_[id];
        if (sm.sw || sm.rl || sm.mel) throw new Error("fired while busy: " + sm.state);
        if (a.mag <= 0) throw new Error("fired an empty gun");
        a.mag--; this.cooldown = DEFS[id].gap; this.shotsLog.push(shotId);
        return true;
      },
      dryFire() { this.dry++; },
      startMelee() { this.cooldown = 0.45; },
      doMelee() { this.meleeHits++; return true; },
      planReload(id, kind, missing) {
        const d = DEFS[id];
        if (d.style === "shotgun") {
          const shellT = Math.max(0.2, (d.reload - 0.55) / d.mag), n = Math.max(1, missing), lead = 0.28;
          const pump = kind === "empty", tail = pump ? 0.38 : 0.18;
          const events = [];
          for (let i = 0; i < n; i++) events.push({ t: lead + (i + 0.5) * shellT, kind: "shell" });
          const dur = lead + n * shellT + tail;
          if (pump) events.push({ t: dur - tail + 0.2, kind: "pump" });
          return { style: "shotgun", dur, events, tail, pump };
        }
        const tactical = kind === "tactical";
        const k = Object.assign({}, STYLES[d.style]);
        if (tactical) { delete k.bolt; Object.keys(k).forEach((x) => { k[x] = Math.min(0.93, k[x] / 0.88); }); }
        const dur = d.reload * (tactical ? CFG.tacticalScale : 1);
        let events = Object.keys(k).map((kind2) => ({ t: k[kind2] * dur, kind: kind2 })).sort((p, q) => p.t - q.t);
        if (this.breakPlan) events = this.breakPlan(events);
        return { style: d.style, dur, events, keys: k };
      },
      commitReload(reloadId, id, n) {
        const a = this.ammo_[id], size = DEFS[id].mag;
        if (n === "full") {
          this.fullCommits[reloadId] = (this.fullCommits[reloadId] || 0) + 1;
          const add = Math.min(size - a.mag, a.reserve);
          a.mag += add; a.reserve -= add; return add;
        }
        if (a.mag >= size || a.reserve <= 0) return 0;
        a.mag++; a.reserve--; return 1;
      },
      reloadSpeed() { return 1; },
      spellReload() { if (!this.spell) return false; this.spellOpen = true; return true; },
      spellBusy() { return this.spellOpen; },
      switchDur(from, to) { const v = { light: 0.40, medium: 0.46, heavy: 0.56, very_heavy: 0.66, melee: 0.34 }; return (v[this.weight(from)] + v[this.weight(to)]) / 2; },
      swapModel(id) { this.swaps.push(id); },
      stopSprint() { this.sprintStops++; this.latch = true; },
      autoReload() { return this.auto; },
      emit(type, p) { this.events.push(p); },
      warn(t) { this.warns.push(t); },
    };
    H.guns.forEach((id) => { H.ammo_[id] = { mag: DEFS[id].mag, reserve: DEFS[id].mag * 4 }; });
    return H;
  }
  function fresh() {
    const H = makeHost();
    const sm = WSM.create(H, CFG);
    H.sm = sm;
    sm.tick(0);
    return { H, sm };
  }
  // the frame: the game's own order -- input and the trigger, then the clock
  function frame(H, sm, dt, inp) {
    inp = inp || {};
    H.cooldown = Math.max(0, H.cooldown - dt);
    sm.input({ moving: !!inp.moving, sprinting: !!inp.sprint && !H.latch, aimHeld: !!inp.aim, fireHeld: !!inp.fire });
    if (!inp.sprint) H.latch = false;
    if (inp.fire || inp.press) sm.requestFire({ pressed: !!inp.press, held: !!inp.fire, auto: !!(DEFS[sm.held] && DEFS[sm.held].auto) || sm.held === "melee" });
    sm.tick(dt);
  }
  const run_ = (H, sm, secs, inp) => { for (let t = 0; t < secs - 1e-9; t += 1 / 60) frame(H, sm, 1 / 60, inp); };
  const markers = (H, rid) => H.events.filter((e) => e.type === "weapon:reload" && e.phase === "marker" && (rid == null || e.reloadId === rid)).map((e) => e.marker);

  // ---------------- the tests ----------------
  function run(opts) {
    opts = opts || {};
    const results = [];
    const ok = (name, cond, info) => { results.push({ name, pass: !!cond, info: info === undefined ? "" : String(info) }); };
    const guard = (name, fn) => { try { fn(); } catch (err) { ok(name + " (threw)", false, err && err.stack ? err.stack.split("\n").slice(0, 3).join(" | ") : err); } };

    guard("start", () => {
      const { H, sm } = fresh();
      ok("start: the chosen gun goes straight into the hands", sm.held === "pistol" && H.swaps.join() === "pistol");
      ok("start: Idle", sm.state === "Idle", sm.state);
      ok("there are twelve states", WSM.STATES.length === 12 && ["Idle", "Walking", "Sprinting", "Aiming", "Firing", "Recovering", "Reloading", "Inspecting", "Lowered", "Switching", "Disabled", "Melee"].every((s) => WSM.STATES.includes(s)));
      frame(H, sm, 1 / 60, { moving: true });
      ok("moving: Walking", sm.state === "Walking", sm.state);
      frame(H, sm, 1 / 60, { moving: true, sprint: true });
      ok("running: Sprinting", sm.state === "Sprinting", sm.state);
      frame(H, sm, 1 / 60, { aim: true });
      run_(H, sm, 0.4, { aim: true });
      ok("aim held: Aiming (once out of the run)", sm.state === "Aiming", sm.state);
    });

    guard("fire", () => {
      const { H, sm } = fresh();
      const a = H.ammo_.pistol;
      sm.requestFire({ pressed: true });
      ok("fire from Idle: one round, Firing", a.mag === 11 && sm.state === "Firing", a.mag + " " + sm.state);
      ok("fire: one weapon:fire event with its shot id", H.events.filter((e) => e.type === "weapon:fire").length === 1 && H.events.find((e) => e.type === "weapon:fire").shotId === H.shotsLog[0]);
      frame(H, sm, 1 / 60, {});
      ok("...then Recovering", sm.state === "Recovering", sm.state);
      sm.requestFire({ pressed: true });
      ok("fire during the cooldown: nothing yet", a.mag === 11);
      run_(H, sm, 0.5, {});
      ok("...the pull made then still fires once the gun can (queued)", a.mag === 10, a.mag);
      run_(H, sm, 0.5, {});
      ok("...and back to Idle", sm.state === "Idle", sm.state);
      // held trigger: a semi-automatic fires once, an automatic keeps going
      run_(H, sm, 1, { fire: true });
      ok("semi-automatic: a held trigger is not a new pull", a.mag === 10, a.mag);
      H.slot = 2; run_(H, sm, 1, {});
      const r = H.ammo_.rifle;
      frame(H, sm, 1 / 60, { press: true, fire: true });
      run_(H, sm, 0.5, { fire: true });
      ok("automatic: fires while held, a round each 0.1 s", r.mag <= 30 - 5 && r.mag >= 30 - 7, r.mag);
    });

    guard("sprint", () => {
      const { H, sm } = fresh();
      run_(H, sm, 0.3, { moving: true, sprint: true });
      const before = H.ammo_.pistol.mag;
      frame(H, sm, 1 / 60, { moving: true, sprint: true, press: true, fire: true });
      ok("a pull while running ends the run", H.sprintStops === 1 && !sm.sprinting);
      ok("...no shot at once (the sprint-out)", H.ammo_.pistol.mag === before && sm.sprintOut > 0, sm.sprintOut);
      run_(H, sm, CFG.sprintOut.light + 0.05, { moving: true, sprint: true, fire: true });
      ok("...then the shot, after the light gun's sprint-out (" + CFG.sprintOut.light + " s)", H.ammo_.pistol.mag === before - 1, H.ammo_.pistol.mag);
      ok("aim is not allowed during a run", (() => { const h2 = fresh(); run_(h2.H, h2.sm, 0.2, { moving: true, sprint: true, aim: true }); return !h2.sm.aimActive; })());
    });

    guard("empty", () => {
      const { H, sm } = fresh();
      H.ammo_.pistol.mag = 0;
      frame(H, sm, 1 / 60, { press: true, fire: true });
      ok("empty: one dry click", H.dry === 1);
      ok("empty + Auto Reload: the reload starts, an empty one", sm.rl && sm.rl.kind === "empty", sm.rl && sm.rl.kind);
      run_(H, sm, 3, {});
      ok("...and fills the magazine", H.ammo_.pistol.mag === 12 && H.ammo_.pistol.reserve === 36, H.ammo_.pistol.mag + "/" + H.ammo_.pistol.reserve);
      const rid = H.events.find((e) => e.type === "weapon:reload" && e.phase === "start").reloadId;
      ok("empty reload: start, magOut, magIn, boltRelease, end markers", ["start", "magOut", "magIn", "boltRelease", "end"].every((m) => markers(H, rid).includes(m)), markers(H, rid).join(","));
      const h2 = fresh(); h2.H.auto = false; h2.H.ammo_.pistol.mag = 0;
      frame(h2.H, h2.sm, 1 / 60, { press: true, fire: true });
      run_(h2.H, h2.sm, 0.3, { fire: true });
      ok("Auto Reload off: one click a pull, no reload", h2.H.dry === 1 && !h2.sm.rl);
      frame(h2.H, h2.sm, 1 / 60, {}); frame(h2.H, h2.sm, 1 / 60, { press: true, fire: true });
      ok("...a second pull, a second click", h2.H.dry === 2);
      h2.H.ammo_.pistol.reserve = 0;
      ok("no spare rounds: no reload, and said so", h2.sm.requestReload() === false && h2.H.events.some((e) => e.type === "weapon:noreserve"));
      ok("a full magazine: nothing to reload (\"full\": the button inspects instead)", fresh().sm.requestReload() === "full");
    });

    guard("tactical", () => {
      const { H, sm } = fresh();
      const a = H.ammo_.pistol;
      a.mag = 5;
      ok("reload with rounds left: tactical", sm.requestReload() === true && sm.rl.kind === "tactical");
      const R = sm.rl, rid = R.reloadId;
      const seat = R.plan.events.find((e) => e.kind === "in").t;
      run_(H, sm, seat - 0.05, {});
      ok("before the magazine seats: the ammo is as it was", a.mag === 5 && a.reserve === 48 && !R.committed);
      run_(H, sm, 0.1, {});
      ok("at magIn: the magazine is full (committed once)", a.mag === 12 && a.reserve === 41 && sm.commits[rid] === 1);
      run_(H, sm, 2, {});
      ok("tactical: shorter than an empty one, no slide release", R.plan.dur < DEFS.pistol.reload && !markers(H, rid).includes("boltRelease"), R.plan.dur.toFixed(2) + " " + markers(H, rid).join(","));
      ok("...each marker once", markers(H, rid).length === new Set(markers(H, rid)).size);
      ok("Reloading -> Idle", sm.state === "Idle" && !sm.rl, sm.state);
    });

    guard("cancel table", () => {
      // switch before / after the commit
      let { H, sm } = fresh();
      H.ammo_.pistol.mag = 4; sm.requestReload();
      run_(H, sm, 0.2, {});
      H.slot = 2; sm.requestSwitch();
      ok("switch during a reload, before magIn: cancelled, nothing added", !sm.rl && H.ammo_.pistol.mag === 4 && H.ammo_.pistol.reserve === 48);
      ok("...a cancel event for that reload", H.events.some((e) => e.type === "weapon:reload" && e.phase === "cancel" && !e.committed));
      ({ H, sm } = fresh());
      H.ammo_.pistol.mag = 4; sm.requestReload();
      const seat = sm.rl.commitAt;
      run_(H, sm, seat + 0.05, {});
      H.slot = 0; sm.requestSwitch();
      ok("knife during a reload, after magIn: cancelled, the rounds stay in", !sm.rl && H.ammo_.pistol.mag === 12, H.ammo_.pistol.mag);
      // fire
      ({ H, sm } = fresh());
      H.ammo_.pistol.mag = 4; sm.requestReload(); run_(H, sm, 0.2, {});
      frame(H, sm, 1 / 60, { press: true, fire: true });
      ok("a pull during a reload (rounds left, before magIn): cancelled, and it fires", !sm.rl && H.ammo_.pistol.mag === 3, H.ammo_.pistol.mag);
      ({ H, sm } = fresh());
      H.ammo_.pistol.mag = 4; sm.requestReload(); run_(H, sm, 0.2, {});
      frame(H, sm, 1 / 60, { fire: true });
      ok("a trigger only held (no new pull) never stops a reload", !!sm.rl && H.ammo_.pistol.mag === 4);
      ({ H, sm } = fresh());
      H.ammo_.pistol.mag = 4; sm.requestReload(); run_(H, sm, sm.rl.commitAt + 0.05, {});
      frame(H, sm, 1 / 60, { press: true, fire: true });
      ok("a pull after magIn: the reload finishes", !!sm.rl && H.ammo_.pistol.mag === 12);
      ({ H, sm } = fresh());
      H.ammo_.pistol.mag = 0; sm.requestReload(); run_(H, sm, 0.2, {});
      frame(H, sm, 1 / 60, { press: true, fire: true });
      ok("a pull during an empty reload: nothing (no round to fire)", !!sm.rl && H.dry === 0);
      // sprint, hit, pause
      ({ H, sm } = fresh());
      H.ammo_.pistol.mag = 4; sm.requestReload();
      run_(H, sm, 2, { moving: true, sprint: true });
      ok("running during a reload: it goes on and finishes", !sm.rl && H.ammo_.pistol.mag === 12);
      ({ H, sm } = fresh());
      H.ammo_.pistol.mag = 4; sm.requestReload(); run_(H, sm, 0.3, {});
      const t0 = sm.rl.t;
      // paused: the game calls nothing for a while
      ok("pause / a window: the reload waits where it was", sm.rl.t === t0);
      run_(H, sm, 2, {});
      ok("...and carries on from there to the end", !sm.rl && H.ammo_.pistol.mag === 12);
      // disabled
      ({ H, sm } = fresh());
      H.ammo_.pistol.mag = 4; sm.requestReload(); run_(H, sm, 0.2, {});
      sm.setDisabled("dead", true);
      ok("death / a cutscene: everything reset, Disabled", sm.state === "Disabled" && !sm.rl && H.ammo_.pistol.mag === 4);
      frame(H, sm, 1 / 60, { press: true, fire: true });
      ok("...and nothing fires", H.ammo_.pistol.mag === 4);
      sm.setDisabled("dead", false);
      run_(H, sm, 0.5, {});
      frame(H, sm, 1 / 60, { press: true, fire: true });
      ok("back again: raised, it fires", H.ammo_.pistol.mag === 3 && H.events.some((e) => e.type === "weapon:visible" && e.on));
    });

    guard("shotgun", () => {
      const { H, sm } = fresh();
      H.slot = 3; run_(H, sm, 1, {});
      const a = H.ammo_.shotgun;
      a.mag = 2;
      sm.requestReload();
      ok("shotgun: shell by shell (loop)", sm.rl.kind === "loop");
      const rid = sm.rl.reloadId;
      run_(H, sm, 0.28 + 0.25 * 1.5, {});
      const inSoFar = a.mag;
      ok("...a round goes in with each shell", inSoFar >= 3 && inSoFar < 6, inSoFar);
      frame(H, sm, 1 / 60, { press: true, fire: true });
      run_(H, sm, 1.0, {});
      // (one more shell in, one round out)
      ok("a pull mid-loop: stops after the shell in the hand, then fires", !sm.rl && a.mag === inSoFar && H.shotsLog.length === 1, a.mag + " shots " + H.shotsLog.length);
      ok("...no pump (it was not empty)", !markers(H, rid).includes("pump"));
      a.mag = 0;
      run_(H, sm, 1, {});
      sm.requestReload();
      const rid2 = sm.rl.reloadId;
      run_(H, sm, 0.45, {});
      frame(H, sm, 1 / 60, { press: true, fire: true });
      run_(H, sm, 1.5, {});
      ok("from empty, stopped early: the pump still racks a round in", markers(H, rid2).includes("pump") && !sm.rl, markers(H, rid2).join(","));
      a.mag = 3; run_(H, sm, 1, {});
      sm.requestReload(); run_(H, sm, 4, {});
      ok("left alone: loads to full", a.mag === 6, a.mag);
    });

    guard("switch", () => {
      const { H, sm } = fresh();
      H.slot = 2; sm.requestSwitch();
      ok("switch: Switching, the old gun lowered", sm.state === "Switching" && sm.held === "pistol");
      frame(H, sm, 1 / 60, { press: true, fire: true });
      ok("...nothing fires while switching", H.shotsLog.length === 0);
      run_(H, sm, 0.25, {});
      ok("...the model swapped at the bottom", sm.held === "rifle" && H.swaps[H.swaps.length - 1] === "rifle");
      run_(H, sm, 0.5, {});
      ok("...raised: done", !sm.sw && sm.state === "Idle", sm.state);
      // spam: only the last one counts
      H.slot = 3; sm.requestSwitch(); run_(H, sm, 0.05, {});
      H.slot = 4; sm.requestSwitch(); run_(H, sm, 0.05, {});
      H.slot = 1; sm.requestSwitch(); run_(H, sm, 0.05, {});
      H.slot = 3; sm.requestSwitch();
      run_(H, sm, 1.5, {});
      ok("switch spam: ends on the last one asked for, one model swap", sm.held === "shotgun" && !sm.sw && H.swaps.slice(-1)[0] === "shotgun" && H.swaps.filter((x) => x === "lmg" || x === "pistol").length === 1, H.swaps.join(","));
      // back to the one in the hands before it was gone
      const n0 = H.swaps.length;
      H.slot = 2; sm.requestSwitch(); run_(H, sm, 0.1, {});
      H.slot = 3; sm.requestSwitch(); run_(H, sm, 1, {});
      ok("changed its mind before the swap: the same gun comes back up, no swap", sm.held === "shotgun" && !sm.sw && H.swaps.length === n0, H.swaps.slice(n0).join(","));
      // in the raise: down again
      H.slot = 1; sm.requestSwitch(); run_(H, sm, 0.4, {});
      const sw = sm.sw && sm.sw.swapped;
      H.slot = 2; sm.requestSwitch(); run_(H, sm, 1.2, {});
      ok("a new choice while the last one rises: lowered again, the latest raised", sw && sm.held === "rifle" && !sm.sw, H.swaps.slice(-2).join(","));
      ok("held = chosen once settled", sm.validate().length === 0, sm.validate().join("; "));
    });

    guard("aim inspect lowered", () => {
      let { H, sm } = fresh();
      H.ammo_.pistol.mag = 4; sm.requestReload();
      run_(H, sm, 0.2, { aim: true });
      ok("aim held during a reload: not aiming", !sm.aimActive);
      run_(H, sm, 1.5, { aim: true });
      ok("...aiming the moment the reload ends", sm.aimActive && sm.state === "Aiming", sm.state);
      ({ H, sm } = fresh());
      ok("inspect from Idle", sm.requestInspect() === true && sm.state === "Inspecting");
      frame(H, sm, 1 / 60, { aim: true });
      ok("...aim stops it", !sm.insp);
      frame(H, sm, 1 / 60, {});
      sm.requestInspect(); frame(H, sm, 1 / 60, { moving: true, sprint: true });
      ok("...a run stops it", !sm.insp);
      run_(H, sm, 0.5, {});
      sm.requestInspect(); frame(H, sm, 1 / 60, { press: true, fire: true });
      ok("...a pull stops it and fires", !sm.insp && H.shotsLog.length === 1);
      run_(H, sm, 0.5, {});
      sm.requestInspect(); run_(H, sm, CFG.inspect.light + 0.1, {});
      ok("...or it ends by itself", !sm.insp && sm.state === "Idle", sm.state);
      ({ H, sm } = fresh());
      sm.setLowered("use", true, CFG.lowerUse);
      ok("Use: Lowered", sm.state === "Lowered");
      frame(H, sm, 1 / 60, { press: true, fire: true });
      ok("...a pull raises it first", H.shotsLog.length === 0 && sm.raiseT > 0);
      run_(H, sm, CFG.raise + 0.05, {});
      ok("...then fires", H.shotsLog.length === 1);
      sm.setLowered("modal", true);
      frame(H, sm, 1 / 60, { press: true, fire: true });
      run_(H, sm, 1, {});
      ok("a window open: Lowered, the trigger does nothing", sm.state === "Lowered" && H.shotsLog.length === 1);
      sm.setLowered("modal", false); run_(H, sm, 0.3, {});
      ok("...closed: back up", sm.state === "Idle", sm.state);
    });

    guard("melee", () => {
      const { H, sm } = fresh();
      H.slot = 0; sm.requestSwitch(); run_(H, sm, 1, {});
      frame(H, sm, 1 / 60, { press: true, fire: true });
      ok("knife: Melee, no hit yet", sm.state === "Melee" && H.meleeHits === 0);
      run_(H, sm, CFG.melee.hit + 0.02, {});
      ok("...the blade lands at its hit frame, once", H.meleeHits === 1);
      run_(H, sm, 0.6, {});
      ok("...then ready", sm.state === "Idle" && H.meleeHits === 1, sm.state);
      frame(H, sm, 1 / 60, { press: true, fire: true });
      H.slot = 1; sm.requestSwitch(); run_(H, sm, 1, {});
      ok("switched away before the blade arrives: no hit", H.meleeHits === 1);
    });

    guard("watchdog + fallback", () => {
      let { H, sm } = fresh();
      H.ammo_.pistol.mag = 4; sm.requestReload();
      const R = sm.rl;
      R.plan.events = R.plan.events.filter((e) => e.kind !== "in");     // the seating step lost
      run_(H, sm, R.commitAt + CFG.commitGrace + 0.05, {});
      ok("magIn never comes: committed by the timer (commitAt + " + CFG.commitGrace + " s), once, silently", R.committed && sm.commits[R.reloadId] === 1 && H.ammo_.pistol.mag === 12
        && H.events.some((e) => e.phase === "commit" && e.silent) && H.warns.length >= 1);
      ({ H, sm } = fresh());
      H.ammo_.pistol.mag = 4; sm.requestReload();
      sm.rl.endAt = 1e9;                                                     // a reload that would never end
      run_(H, sm, 5, {});
      ok("watchdog: a reload stuck past its limit is put right", !sm.rl && H.warns.some((w) => /watchdog/.test(w)), H.warns.join(" | "));
      ok("...the rounds that went in stay in", H.ammo_.pistol.mag === 12);
      ({ H, sm } = fresh());
      H.slot = 2; sm.requestSwitch();
      H.reloadSpeed = () => 0;                                               // a switch that would never move
      run_(H, sm, 3, {});
      ok("watchdog: a switch stuck: finished on the gun chosen", !sm.sw && sm.held === "rifle");
    });

    guard("spell", () => {
      const { H, sm } = fresh();
      H.spell = true; H.ammo_.pistol.mag = 2;
      ok("Spell to Reload: the window takes the reload", sm.requestReload() === true && sm.rl.kind === "spell");
      frame(H, sm, 1 / 60, { press: true, fire: true });
      ok("...nothing fires meanwhile", H.shotsLog.length === 0);
      H.spellOpen = false; sm.endSpell();
      ok("...answered: done", !sm.rl);
    });

    // ---------------- fuzz ----------------
    guard("fuzz", () => {
      const N = opts.presses || 10000;
      let seed = opts.seed || 20261020;
      const rnd = () => { seed = (seed + 0x6D2B79F5) | 0; let x = Math.imul(seed ^ (seed >>> 15), 1 | seed); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
      const { H, sm } = fresh();
      const total = () => { const o = {}; H.guns.forEach((id) => { o[id] = H.ammo_[id].mag + H.ammo_[id].reserve; }); return o; };
      let tot = total();
      const inp = { moving: false, sprint: false, aim: false, fire: false };
      const bad = [];
      // (a window and death come and go by themselves after a while, so most
      // of the run is spent with the gun in use)
      let modal = 0, dead = 0, quiet = 0;
      for (let i = 0; i < N && bad.length < 5; i++) {
        // (now and then a stretch with nothing pressed, so reloads and swaps also get to finish)
        const r = quiet > 0 ? (quiet--, 1) : rnd();
        let press = false;
        if (r > 0.97 && r < 1) quiet = 40;
        if (r < 0.10) { press = true; inp.fire = true; }
        else if (r < 0.16) inp.fire = false;
        else if (r < 0.24) sm.requestReload();
        else if (r < 0.28) { H.slot = Math.floor(rnd() * 5); sm.requestSwitch(); }
        else if (r < 0.31) sm.requestInspect();
        else if (r < 0.38) inp.aim = !inp.aim;
        else if (r < 0.44) inp.sprint = !inp.sprint;
        else if (r < 0.50) inp.moving = !inp.moving;
        else if (r < 0.52) sm.setLowered("use", true, CFG.lowerUse);
        else if (r < 0.53 && !modal) { modal = 20; sm.setLowered("modal", true); }
        else if (r < 0.535 && !dead) { dead = 30; sm.setDisabled("dead", true); }
        else if (r < 0.545) H.auto = !H.auto;
        else if (r < 0.56) { const g = H.ammo_[H.guns[Math.floor(rnd() * 4)]]; g.mag = Math.floor(g.mag / 3); }   // (rounds spent elsewhere)
        else if (r < 0.562) H.guns.forEach((id) => { if (H.ammo_[id].reserve < 20) H.ammo_[id].reserve = 0; });   // (and run dry)
        else if (r < 0.59) { const id = H.guns[Math.floor(rnd() * 4)]; H.ammo_[id].reserve += 30; tot[id] += 30; }  // (an ammo box: counted)
        if (modal && --modal === 0) sm.setLowered("modal", false);
        if (dead && --dead === 0) sm.setDisabled("dead", false);
        // a frame -- or none (paused), or a long one (a hitch)
        const k = rnd();
        if (k < 0.04) continue;
        const dt = k < 0.08 ? 0 : k < 0.12 ? 0.25 : rnd() * 0.1;
        frame(H, sm, dt, { moving: inp.moving, sprint: inp.sprint, aim: inp.aim, fire: inp.fire, press });
        // what must always hold
        H.guns.forEach((id) => {
          const a = H.ammo_[id];
          if (a.mag < 0 || a.mag > DEFS[id].mag || a.reserve < 0) bad.push("#" + i + " " + id + " " + a.mag + "/" + a.reserve);
        });
        const now = total();
        H.guns.forEach((id) => { if (now[id] > tot[id]) bad.push("#" + i + " ammo from nowhere: " + id); });
        tot = now;
        if (!WSM.STATES.includes(sm.state)) bad.push("#" + i + " unknown state " + sm.state);
        const v = sm.validate();
        if (v.length) bad.push("#" + i + " " + v.join("; ") + " [" + sm.state + "]");
        if (Object.values(H.fullCommits).some((n) => n > 1)) bad.push("#" + i + " a reload committed twice");
      }
      ok("fuzz: " + N + " random presses, every invariant held (ammo in range, none from nowhere, one commit a reload, nothing stuck)", !bad.length, bad.slice(0, 5).join(" | "));
      // let go of everything: it must settle
      sm.setLowered("modal", false); sm.setDisabled("dead", false);
      H.slot = 1; sm.requestSwitch();
      run_(H, sm, 6, {});
      ok("fuzz: let go of everything, it settles on Idle with the chosen gun", sm.state === "Idle" && !sm.rl && !sm.sw && !sm.insp && !sm.mel && sm.held === "pistol", sm.state + " " + sm.held);
      const cancels = H.events.filter((e) => e.type === "weapon:reload" && e.phase === "cancel").length;
      const ends = H.events.filter((e) => e.type === "weapon:reload" && e.phase === "end").length;
      const swaps = H.events.filter((e) => e.type === "weapon:switch" && e.phase === "done").length;
      ok("fuzz: shots fired, reloads finished and cut short, swaps (the test did something)", H.shotsLog.length > 200 && ends > 25 && cancels > 25 && swaps > 60,
        H.shotsLog.length + " shots, " + ends + " reloads finished (" + Object.keys(sm.commits).length + " magazines), " + cancels + " cancelled, " + swaps + " swaps, " + H.meleeHits + " knife hits, " + H.dry + " dry clicks");
    });

    const fail = results.filter((r) => !r.pass);
    return { pass: results.length - fail.length, total: results.length, fail, results };
  }

  if (inNode && require.main === module) {
    const r = run();
    r.results.forEach((x) => console.log((x.pass ? "  ok   " : "  FAIL ") + x.name + (x.pass || !x.info ? "" : "  -- " + x.info)));
    console.log(r.pass + " / " + r.total + " passed");
    process.exit(r.fail.length ? 1 : 0);
  }
  if (inNode) module.exports = { run };
  else { root.G = root.G || {}; root.G.WsmTest = { run }; }
})(typeof window !== "undefined" ? window : this);
