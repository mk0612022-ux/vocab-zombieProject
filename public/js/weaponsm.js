// ===================================================================
// The Weapon State Machine (overhaul, round 1)
// -------------------------------------------------------------------
// One owner for every change in what the weapon in the hands is doing.
// Input and gameplay only ASK -- requestFire, requestReload, requestSwitch,
// requestInspect, input (aim, sprint), setLowered, setDisabled -- and the
// machine checks its rules, changes state and says so through events
// (G.Bus, "weapon:*"). The animation, the sounds, the effects and the HUD
// only listen; none of them changes a state.
//
// It holds no ammunition. The magazine and the reserve are gameplay's
// (G.Game.player.ammo), read through the host every time and changed only
// by the host's commit: once per reload when the fresh magazine seats
// ("magIn"), or once per shell pushed in. A reload id makes sure of "once".
//
// Pure logic -- no THREE, no DOM, no audio -- so the same file runs in the
// game and under Node, for the unit and fuzz tests (tools/overhaul/wsm-test.js).
//
//   G.WeaponSM.create(host, G.CONFIG.weaponSM) -> a machine
//
// The host (js/game.js, weaponHost) answers:
//   selected()                 the weapon id the player has chosen ("melee": the knife)
//   ammo(id)                   { mag, reserve, magSize } (null for the knife)
//   weight(id), family(id)     "light".."very_heavy" | "melee";  the weapon family
//   cooldownReady()            the time between shots has passed
//   fireInterval(id)           seconds between shots
//   doFire(shotId, charge, inBurst)   gameplay: the round leaves -> true
//   dryFire()                  the empty click
//   startMelee(id), doMelee(id)       the swing begins; the blade arrives -> hit?
//   planReload(id, kind, missing)     { style, dur, events: [{ t, kind }], pump }
//   commitReload(reloadId, id, n)     n: "full" or 1 -> rounds added
//   reloadSpeed()              Quick Hands
//   spellReload(id), spellBusy()      Spell to Reload took it / still open
//   switchDur(from, to)        seconds for the whole lower-and-raise
//   swapModel(id)              the gun in the hands is now this one (the model)
//   stopSprint()               a trigger pull ends a run
//   autoReload()               the setting
//   emit(type, payload), warn(text)
//
// States: Idle Walking Sprinting Aiming Firing Recovering Reloading
//         Inspecting Lowered Switching Disabled Melee
// docs/overhaul/weapon-state-machine.md has the tables.
// ===================================================================
(function (root) {
  "use strict";

  const STATES = ["Idle", "Walking", "Sprinting", "Aiming", "Firing", "Recovering", "Reloading",
    "Inspecting", "Lowered", "Switching", "Disabled", "Melee"];
  // the reload's steps (js/viewmodel.js planReload, the reload sounds) and
  // the markers they are sent as
  const MARKER = { start: "start", cover: "coverOpen", out: "magOut", drop: "magDrop", grab: "magGrab", in: "magIn",
    slap: "magSlap", coverClose: "coverClose", bolt: "boltRelease", shell: "shellIn", pump: "pump", end: "end" };

  function create(host, C) {
    if (!C) throw new Error("WeaponSM: no config");
    const sm = {
      STATES, MARKER,
      state: "Idle", stateT: 0, t: 0,
      held: null,          // the weapon in the hands (its model); null before the first frame
      sw: null,            // switching: { switchId, from, to, t, dur, swapped }
      rl: null,            // reloading: { reloadId, id, kind, plan, t, next, committed, commitAt, ... }
      insp: null,          // inspecting: { inspectId, t, dur }
      mel: null,           // the knife: { meleeId, t, dur, hitT, hit }
      lowered: {},         // reason -> seconds left (Infinity: until taken off)
      disabled: {},        // reason -> true
      raiseT: 0,           // a lowered gun coming back up
      sprintOut: 0,        // out of a run: the first shot waits this long
      recoverT: 0,         // after a shot
      fired: false,        // a shot this frame (the Firing state)
      sprinting: false, moving: false, aimHeld: false, aimActive: false,
      queued: 0,           // a trigger pull waiting this long more for the gun to be able to fire
      ids: 0, eventId: 0,
      log: [], warnings: [],
      commits: {},         // reloadId -> commits made (the tests check it is never more than one)
      shots: 0,
      _dryHeld: false,
    };

    // ---------------- telling the others ----------------
    function emit(type, p) {
      p = p || {};
      p.type = type; p.eid = ++sm.eventId; p.t = sm.t;
      sm.log.push(p);
      if (sm.log.length > 10) sm.log.shift();
      if (host.emit) host.emit(type, p);
      return p;
    }
    function warn(text) {
      sm.warnings.push({ t: sm.t, text });
      if (sm.warnings.length > 20) sm.warnings.shift();
      if (host.warn) host.warn(text);
    }

    // ---------------- what the machine can see ----------------
    const anyDisabled = () => { for (const k in sm.disabled) return true; return false; };
    const isLowered = () => { for (const k in sm.lowered) return true; return false; };
    const wkey = (id) => host.weight(id === undefined ? sm.held : id) || "medium";
    const per = (table, id) => { const v = table[wkey(id)]; return v === undefined ? table.medium : v; };
    sm.anyDisabled = anyDisabled;
    sm.isLowered = isLowered;

    function compute() {
      if (anyDisabled()) return "Disabled";
      if (isLowered() || sm.raiseT > 0) return "Lowered";
      if (sm.sw) return "Switching";
      if (sm.rl) return "Reloading";
      if (sm.mel) return "Melee";
      if (sm.insp) return "Inspecting";
      if (sm.fired) return "Firing";
      if (sm.recoverT > 0) return "Recovering";
      if (sm.sprinting) return "Sprinting";
      if (sm.aimActive) return "Aiming";
      if (sm.moving) return "Walking";
      return "Idle";
    }
    function refresh(reason) {
      const s = compute();
      if (s === sm.state) return;
      const from = sm.state;
      sm.state = s; sm.stateT = 0;
      emit("weapon:state", { from, to: s, reason: reason || "" });
    }

    // the gun can loose a round right now (gates only: ammo and the cooldown are checked when it does)
    sm.canFire = function () {
      return sm.held != null && !anyDisabled() && !isLowered() && sm.raiseT <= 0 && !sm.sw && !sm.rl && !sm.mel
        && sm.sprintOut <= 0 && !sm.sprinting;
    };
    sm.aimAllowed = function () {
      return sm.held != null && sm.held !== "melee" && !anyDisabled() && !isLowered() && !sm.sw && !sm.rl && !sm.mel && !sm.sprinting;
    };

    // ---------------- the chosen weapon and the one in the hands ----------------
    function sync() {
      const sel = host.selected();
      if (sel == null) return;
      if (sm.held === null) {
        // the very first: straight into the hands, no lowering of nothing
        host.swapModel(sel); sm.held = sel;
        return;
      }
      if (anyDisabled()) {
        // nobody sees it: swapped at once, ready when it is shown again
        if (sm.sw) finishSwitch();
        if (sel !== sm.held) { host.swapModel(sel); sm.held = sel; }
        return;
      }
      const S = sm.sw;
      if (!S) { if (sel !== sm.held) beginSwitch(sel); return; }
      if (sel === S.to) return;
      if (!S.swapped) {
        if (sel === S.from) {
          // changed its mind before the old one was out of sight: back up it comes
          S.to = sel; S.swapped = true; S.noModel = true; S.t = S.dur - S.t;
          emit("weapon:switch", { phase: "raise", switchId: S.switchId, fromId: S.from, toId: S.to, back: true });
        } else {
          // only the last one asked for counts
          S.to = sel;
          emit("weapon:switch", { phase: "retarget", switchId: S.switchId, fromId: S.from, toId: S.to });
        }
      } else {
        // the new one was on its way up: down again, for the latest choice
        S.from = sm.held; S.to = sel; S.swapped = false; S.noModel = false; S.t = S.dur - S.t;
        emit("weapon:switch", { phase: "lower", switchId: S.switchId, fromId: S.from, toId: S.to });
      }
    }
    function beginSwitch(to) {
      cancelReload("switch"); endInspect("switch"); cancelMelee("switch");
      sm.queued = 0;
      const dur = Math.max(0.05, host.switchDur(sm.held, to) || 0.45);
      sm.sw = { switchId: ++sm.ids, from: sm.held, to, t: 0, dur, swapped: false, noModel: false };
      emit("weapon:switch", { phase: "lower", switchId: sm.sw.switchId, fromId: sm.held, toId: to, dur });
      refresh("switch");
    }
    function tickSwitch(dt) {
      const S = sm.sw;
      S.t += dt * (host.reloadSpeed() || 1);
      if (!S.swapped && S.t >= S.dur * 0.5) {
        if (!S.noModel) host.swapModel(S.to);
        sm.held = S.to; S.swapped = true;
        emit("weapon:switch", { phase: "swap", switchId: S.switchId, fromId: S.from, toId: S.to });
        emit("weapon:switch", { phase: "raise", switchId: S.switchId, fromId: S.from, toId: S.to });
      }
      if (S.t >= S.dur) {
        sm.sw = null;
        emit("weapon:switch", { phase: "done", switchId: S.switchId, toId: S.to });
      }
    }
    function finishSwitch() {
      const S = sm.sw;
      if (!S) return;
      if (!S.swapped) { if (!S.noModel) host.swapModel(S.to); sm.held = S.to; }
      sm.sw = null;
      emit("weapon:switch", { phase: "done", switchId: S.switchId, toId: S.to, cut: true });
    }
    sm.finishSwitch = function () { finishSwitch(); refresh("finishSwitch"); };
    sm.requestSwitch = function () { sync(); refresh("switch"); return !!sm.sw; };
    sm.switchProgress = function () { return sm.sw ? Math.min(1, sm.sw.t / sm.sw.dur) : null; };

    // ---------------- firing ----------------
    function queue(o) { if (o && o.pressed) sm.queued = C.queueWindow; }
    function startSprintOut() { sm.sprintOut = per(C.sprintOut); }
    // what a trigger pull does before it can fire: an inspection stops, a
    // lowered gun comes up, a run ends. False: it cannot fire at all now.
    function prepare(o) {
      if (sm.held === null) sync();
      if (sm.held === null || anyDisabled()) return false;
      if (sm.insp) endInspect("fire");
      if (isLowered()) {
        // only the passing reasons (Use) give way to the trigger; a window does not
        let flag = false;
        for (const k in sm.lowered) { if (sm.lowered[k] === Infinity) flag = true; else delete sm.lowered[k]; }
        if (flag) return false;
        sm.raiseT = C.raise;
        emit("weapon:lowered", { on: false, reason: "fire" });
      }
      if (sm.sprinting) {
        host.stopSprint();
        sm.sprinting = false;
        startSprintOut();
      }
      if (sm.raiseT > 0 || sm.sprintOut > 0) queue(o);
      return true;
    }
    sm.prepareFire = function () { const r = prepare({ pressed: true }); sm.queued = 0; refresh("prepare"); return r; };

    // o: { pressed (a fresh pull), held (still down), auto (fires while held), charge (0-1) }
    sm.requestFire = function (o) {
      o = o || {};
      if (!o.pressed && !o.held) return false;
      if (!o.pressed && !o.auto) return false;
      if (!prepare(o)) { refresh("fire"); return false; }
      let r = false;
      if (sm.sw || sm.mel) r = false;
      else if (sm.rl) r = fireDuringReload(o);
      else if (sm.raiseT > 0 || sm.sprintOut > 0) r = false;          // queued (prepare)
      else if (sm.held === "melee") r = startMelee();
      else r = fireNow(o);
      refresh("fire");
      return r;
    };
    function fireDuringReload(o) {
      const R = sm.rl;
      if (!o.pressed) return false;                     // a held trigger never interrupts a reload
      if (R.kind === "spell") return false;
      const a = host.ammo(R.id);
      if (!a || a.mag <= 0) return false;
      if (R.kind === "loop") {
        // shell by shell: the shell in the hand goes in, then it stops and fires
        R.stopAfter = true; R.fireAfter = true;
        return false;
      }
      if (R.committed || !C.fireCancelsReload) return false;
      cancelReload("fire");
      if (sm.raiseT > 0 || sm.sprintOut > 0) { queue(o); return false; }
      return fireNow(o);
    }
    function fireNow(o) {
      const id = sm.held;
      const a = host.ammo(id);
      if (!a) return false;
      if (a.mag <= 0) {
        // one click for each pull (or the first moment of a hold), then the reload if it is on
        if (o.pressed || !sm._dryHeld) { sm._dryHeld = true; host.dryFire(); emit("weapon:dryfire", { weaponId: id }); }
        if (host.autoReload() && a.reserve > 0) sm.requestReload({ auto: true });
        else if (a.reserve <= 0 && o.pressed) emit("weapon:noreserve", { weaponId: id });
        return false;
      }
      if (!host.cooldownReady()) { if (o.pressed) queue(o); return false; }
      sm.queued = 0;
      const shotId = ++sm.ids;
      if (!host.doFire(shotId, o.charge, false)) return false;
      sm.shots++;
      sm.fired = true;
      sm.recoverT = (host.fireInterval(id) || 0.1) + C.recoverPad;
      emit("weapon:fire", { shotId, weaponId: id, family: host.family(id), charge: o.charge || 0 });
      // the last round gone: on to the reload (it can be turned off)
      const b = host.ammo(id);
      if (b && b.mag <= 0 && b.reserve > 0 && host.autoReload()) sm.requestReload({ auto: true });
      return true;
    }
    // the second and third rounds of a burst: their own short timer (game.js)
    sm.burstRound = function (charge) {
      if (sm.held === null || sm.held === "melee" || !sm.canFire()) return false;
      const a = host.ammo(sm.held);
      if (!a || a.mag <= 0) return false;
      const shotId = ++sm.ids;
      if (!host.doFire(shotId, charge, true)) return false;
      sm.shots++; sm.fired = true;
      sm.recoverT = Math.max(sm.recoverT, (host.fireInterval(sm.held) || 0.1) + C.recoverPad);
      emit("weapon:fire", { shotId, weaponId: sm.held, family: host.family(sm.held), burst: true, charge: charge || 0 });
      refresh("burst");
      return true;
    };

    // ---------------- the knife ----------------
    function startMelee() {
      if (sm.mel || !host.cooldownReady()) return false;
      const meleeId = ++sm.ids;
      const dur = Math.max(C.melee.hit + 0.05, host.fireInterval("melee") || C.melee.dur);
      sm.mel = { meleeId, t: 0, dur, hitT: C.melee.hit, hit: false };
      host.startMelee(meleeId);
      emit("weapon:melee", { phase: "start", meleeId });
      return true;
    }
    function tickMelee(dt) {
      const M = sm.mel;
      M.t += dt;
      if (!M.hit && M.t >= M.hitT) {
        M.hit = true;
        const h = host.doMelee(M.meleeId);
        emit("weapon:melee", { phase: "hit", meleeId: M.meleeId, hit: !!h });
      }
      if (M.t >= M.dur) { sm.mel = null; emit("weapon:melee", { phase: "end", meleeId: M.meleeId }); }
    }
    function cancelMelee(reason) {
      const M = sm.mel;
      if (!M) return;
      sm.mel = null;
      emit("weapon:melee", { phase: "cancel", meleeId: M.meleeId, reason });
    }

    // ---------------- reloading ----------------
    sm.requestReload = function (o) {
      o = o || {};
      if (sm.held === null) sync();
      if (sm.rl && sm.rl.kind === "spell" && !(host.spellBusy && host.spellBusy())) endReload("spell");
      if (anyDisabled() || sm.sw || sm.mel || sm.rl) return false;
      const id = sm.held;
      if (id == null || id === "melee") return false;
      const a = host.ammo(id);
      if (!a) return false;
      if (a.mag >= a.magSize) return "full";
      if (a.reserve <= 0) { emit("weapon:noreserve", { weaponId: id }); return false; }
      if (isLowered()) {
        for (const k in sm.lowered) if (sm.lowered[k] !== Infinity) delete sm.lowered[k];
        if (isLowered()) return false;
        emit("weapon:lowered", { on: false, reason: "reload" });
      }
      if (sm.insp) endInspect("reload");
      sm.queued = 0;
      const reloadId = ++sm.ids;
      if (host.spellReload && host.spellReload(id)) {
        sm.rl = { reloadId, id, kind: "spell", plan: null, t: 0, next: 0, committed: false, marks: {} };
        emit("weapon:reload", { phase: "start", reloadId, kind: "spell", weaponId: id });
        refresh("reload");
        return true;
      }
      const kind = a.mag > 0 ? "tactical" : "empty";
      const plan = host.planReload(id, kind, Math.min(a.magSize - a.mag, a.reserve));
      const loop = plan.style === "shotgun";
      const seat = loop ? null : plan.events.find((e) => e.kind === "in");
      sm.rl = { reloadId, id, kind: loop ? "loop" : kind, empty: kind === "empty", plan, t: 0, next: 0,
        committed: false, commitAt: seat ? seat.t : null, shellsIn: 0, stopAfter: false, fireAfter: false, endAt: null,
        auto: !!o.auto, marks: {} };
      emit("weapon:reload", { phase: "start", reloadId, kind: sm.rl.kind, weaponId: id, dur: plan.dur });
      mark(sm.rl, "start");
      refresh(o.auto ? "autoReload" : "reload");
      return true;
    };
    // a marker: once per reload (a shell's carries its number)
    function mark(R, kind, extra, silent) {
      const key = kind + (extra && extra.index ? "#" + extra.index : "");
      if (R.marks[key]) { warn("marker sent twice: " + key + " (reload " + R.reloadId + ")"); return; }
      R.marks[key] = true;
      const p = { phase: "marker", marker: MARKER[kind] || kind, kind, reloadId: R.reloadId, weaponId: R.id, reloadKind: R.kind, silent: !!silent };
      if (extra) Object.keys(extra).forEach((k) => { p[k] = extra[k]; });
      emit("weapon:reload", p);
    }
    function commit(R, silent) {
      if (R.committed) return;
      const n = host.commitReload(R.reloadId, R.id, "full");
      R.committed = true;
      sm.commits[R.reloadId] = (sm.commits[R.reloadId] || 0) + 1;
      emit("weapon:reload", { phase: "commit", reloadId: R.reloadId, weaponId: R.id, added: n, silent: !!silent });
    }
    function tickReload(dt) {
      const R = sm.rl;
      if (R.kind === "spell") { if (!(host.spellBusy && host.spellBusy())) endReload("spell"); return; }
      R.t += dt * (host.reloadSpeed() || 1);
      const ev = R.plan.events;
      while (sm.rl === R && R.next < ev.length && ev[R.next].t <= R.t) step(R, ev[R.next++]);
      if (sm.rl !== R) return;
      // the seating that never came: committed by the clock, without its sound
      if (!R.committed && R.commitAt != null && R.t >= R.commitAt + C.commitGrace) {
        warn("magIn never came: committed by the timer (reload " + R.reloadId + ")");
        commit(R, true);
        mark(R, "in", null, true);
      }
      if (R.t >= (R.endAt != null ? R.endAt : R.plan.dur)) endReload("done");
    }
    function step(R, e) {
      if (e.kind === "in") { commit(R, false); mark(R, "in"); return; }
      if (e.kind === "shell") {
        const added = host.commitReload(R.reloadId, R.id, 1);
        R.shellsIn++;
        R.committed = true;
        mark(R, "shell", { index: R.shellsIn, added });
        const a = host.ammo(R.id);
        if (!added || R.stopAfter || !a || a.mag >= a.magSize || a.reserve <= 0) stopLoop(R);
        return;
      }
      mark(R, e.kind);
    }
    // shell by shell, stopped early (the trigger, full, or nothing left):
    // the pump if it started empty, else straight back to the ready
    function stopLoop(R) {
      const ev = R.plan.events;
      R.stopT = R.t;
      const pumpAt = ev.findIndex((e, i) => i >= R.next && e.kind === "pump");
      if (pumpAt >= 0 && R.empty) {
        const tail = R.plan.tail || 0.38;
        const rackStart = R.plan.dur - tail;
        if (R.t < rackStart) R.t = rackStart;
        R.next = pumpAt;
        R.endAt = R.plan.dur;
      } else {
        R.next = ev.length;
        R.endAt = Math.min(R.plan.dur, R.t + C.loopStopTail);
      }
    }
    function endReload(reason) {
      const R = sm.rl;
      if (!R) return;
      if (R.plan && !R.committed && R.kind !== "loop" && R.kind !== "spell") {
        // (the clock ran out with no seating at all: it still goes in, once)
        warn("reload ended without a commit (reload " + R.reloadId + ")");
        commit(R, true);
      }
      if (R.plan) mark(R, "end");
      sm.rl = null;
      sm._dryHeld = false;
      emit("weapon:reload", { phase: "end", reloadId: R.reloadId, weaponId: R.id, reason });
      if (R.fireAfter) { refresh("reloadEnd"); sm.queued = C.queueWindow; }
    }
    function cancelReload(reason) {
      const R = sm.rl;
      if (!R) return;
      sm.rl = null;
      emit("weapon:reload", { phase: "cancel", reloadId: R.reloadId, weaponId: R.id, committed: R.committed, reason });
    }
    sm.cancelReload = function (reason) { cancelReload(reason || "request"); refresh("cancelReload"); };
    sm.endSpell = function () { if (sm.rl && sm.rl.kind === "spell") { endReload("spell"); refresh("spell"); } };
    sm.reloadFrac = function () { const R = sm.rl; return R && R.plan ? Math.min(1, R.t / R.plan.dur) : 0; };

    // ---------------- inspecting ----------------
    sm.requestInspect = function () {
      if (sm.held === null) sync();
      if (sm.held == null || anyDisabled() || isLowered() || sm.raiseT > 0 || sm.sw || sm.rl || sm.mel || sm.insp
        || sm.sprinting || sm.aimActive || sm.recoverT > 0) return false;
      sm.insp = { inspectId: ++sm.ids, t: 0, dur: per(C.inspect) };
      emit("weapon:inspect", { phase: "start", inspectId: sm.insp.inspectId, weaponId: sm.held, dur: sm.insp.dur });
      refresh("inspect");
      return true;
    };
    function endInspect(reason) {
      const I = sm.insp;
      if (!I) return;
      sm.insp = null;
      emit("weapon:inspect", { phase: reason === "done" ? "end" : "cancel", inspectId: I.inspectId, reason });
    }
    sm.inspectProgress = function () { return sm.insp ? Math.min(1, sm.insp.t / sm.insp.dur) : null; };

    // ---------------- lowered, disabled ----------------
    // secs: a passing reason (Use) that ends by itself; none: until taken off
    sm.setLowered = function (reason, on, secs) {
      if (on) {
        // (the hands are busy with a reload or a swap: Use does not lower it)
        if (secs > 0 && (sm.rl || sm.sw || sm.mel)) return false;
        const was = isLowered();
        sm.lowered[reason] = secs > 0 ? secs : Infinity;
        if (sm.insp) endInspect("lowered");
        sm.queued = 0;
        if (!was) emit("weapon:lowered", { on: true, reason });
      } else if (reason in sm.lowered) {
        delete sm.lowered[reason];
        if (!isLowered()) { sm.raiseT = C.raise; emit("weapon:lowered", { on: false, reason }); }
      }
      refresh("lowered");
      return true;
    };
    sm.setDisabled = function (reason, on) {
      if (on) {
        if (sm.disabled[reason]) return;
        const was = anyDisabled();
        sm.disabled[reason] = true;
        if (!was) {
          // everything in progress stops; the gun is put away
          cancelReload("disabled"); endInspect("disabled"); cancelMelee("disabled");
          if (sm.sw) finishSwitch();
          sm.queued = 0; sm.sprintOut = 0; sm.recoverT = 0; sm.raiseT = 0; sm.fired = false;
          sm.lowered = {}; sm.aimActive = false;
          emit("weapon:visible", { on: false, reason });
        }
      } else if (sm.disabled[reason]) {
        delete sm.disabled[reason];
        if (!anyDisabled()) { sync(); sm.raiseT = C.raise * 2; emit("weapon:visible", { on: true, reason }); }
      }
      refresh("disabled:" + reason);
    };

    // ---------------- the frame's input ----------------
    // o: { moving, sprinting, aimHeld, fireHeld }
    sm.input = function (o) {
      const was = sm.sprinting;
      sm.moving = !!o.moving;
      sm.sprinting = !!o.sprinting && !anyDisabled();
      if (sm.sprinting && !was) {
        if (sm.insp) endInspect("sprint");
        if (sm.rl && C.sprintCancelsReload) cancelReload("sprint");
        sm.sprintOut = 0;
      } else if (!sm.sprinting && was) startSprintOut();
      if (o.aimHeld && !sm.aimHeld && sm.insp) endInspect("aim");
      sm.aimHeld = !!o.aimHeld;
      const act = sm.aimHeld && sm.aimAllowed();
      if (act !== sm.aimActive) { sm.aimActive = act; emit("weapon:aim", { on: act }); }
      if (!o.fireHeld) sm._dryHeld = false;
      refresh("input");
    };

    // ---------------- the frame ----------------
    sm.tick = function (dt) {
      dt = Math.max(0, dt || 0);
      sm.t += dt;
      sync();
      sm.fired = false;
      if (sm.recoverT > 0) sm.recoverT = Math.max(0, sm.recoverT - dt);
      if (sm.sprintOut > 0) sm.sprintOut = Math.max(0, sm.sprintOut - dt);
      if (sm.raiseT > 0 && !isLowered()) sm.raiseT = Math.max(0, sm.raiseT - dt);
      let timed = false;
      for (const k in sm.lowered) {
        if (sm.lowered[k] === Infinity) continue;
        sm.lowered[k] -= dt;
        if (sm.lowered[k] <= 0) { delete sm.lowered[k]; timed = true; }
      }
      if (timed && !isLowered()) { sm.raiseT = C.raise; emit("weapon:lowered", { on: false, reason: "timer" }); }
      if (!anyDisabled()) {
        if (sm.sw) tickSwitch(dt);
        if (sm.rl) tickReload(dt);
        if (sm.insp) { sm.insp.t += dt; if (sm.insp.t >= sm.insp.dur) endInspect("done"); }
        if (sm.mel) tickMelee(dt);
      }
      // a pull made while the gun could not fire yet (out of a run, coming up, a reload stopping)
      if (sm.queued > 0) {
        sm.queued = Math.max(0, sm.queued - dt);
        if (sm.canFire() && host.cooldownReady()) {
          sm.queued = 0;
          if (sm.held === "melee") startMelee(); else fireNow({ pressed: true });
        }
      }
      sm.stateT += dt;
      refresh("tick");
      watchdog();
    };

    // ---------------- the watchdog ----------------
    // nothing stays longer in a state than it could: past that it is put
    // right, and a warning goes to the debug overlay
    function limit() {
      const W = C.watchdog;
      switch (sm.state) {
        case "Firing": return W.firing;
        case "Recovering": return (host.fireInterval(sm.held) || 0.1) + C.recoverPad + W.recoverPad;
        case "Reloading": return sm.rl && sm.rl.plan ? sm.rl.plan.dur / Math.max(0.2, host.reloadSpeed() || 1) * W.reloadScale + W.reloadPad : null;
        case "Switching": return sm.sw ? sm.sw.dur * W.switchScale + W.switchPad : null;
        case "Inspecting": return sm.insp ? sm.insp.dur + W.inspectPad : null;
        case "Melee": return sm.mel ? sm.mel.dur + W.meleePad : null;
        default: return null;
      }
    }
    function watchdog() {
      const lim = limit();
      if (lim == null || sm.stateT <= lim) return;
      warn("watchdog: " + sm.state + " for " + sm.stateT.toFixed(2) + " s (limit " + lim.toFixed(2) + ")");
      switch (sm.state) {
        case "Reloading": if (sm.rl.committed) endReload("watchdog"); else cancelReload("watchdog"); break;
        case "Switching": finishSwitch(); break;
        case "Inspecting": endInspect("watchdog"); break;
        case "Melee": cancelMelee("watchdog"); break;
        default: sm.recoverT = 0; sm.fired = false;
      }
      refresh("watchdog");
    }

    // ---------------- checks (the debug overlay, the tests) ----------------
    sm.validate = function () {
      const out = [];
      if (sm.held != null && sm.held !== "melee") {
        const a = host.ammo(sm.held);
        if (a) {
          if (a.mag < 0) out.push("magazine below zero");
          if (a.mag > a.magSize) out.push("magazine over its size");
          if (a.reserve < 0) out.push("reserve below zero");
        }
      }
      Object.keys(sm.commits).forEach((k) => { if (sm.commits[k] > 1) out.push("reload " + k + " committed " + sm.commits[k] + " times"); });
      const lim = limit();
      if (lim != null && sm.stateT > lim + 0.05) out.push("stuck in " + sm.state);
      if (!sm.sw && !anyDisabled() && sm.held != null && host.selected() !== sm.held) out.push("the gun in the hands is not the one chosen");
      return out;
    };
    // a snapshot for the animation and the debug overlay
    sm.view = function () {
      return {
        state: sm.state, stateT: sm.stateT, held: sm.held,
        lowered: isLowered() || sm.raiseT > 0, disabled: anyDisabled(),
        switchP: sm.switchProgress(), inspectP: sm.inspectProgress(),
        meleeP: sm.mel ? Math.min(1, sm.mel.t / sm.mel.dur) : null, meleeHitP: sm.mel ? sm.mel.hitT / sm.mel.dur : null,
        reload: sm.rl && sm.rl.plan ? sm.rl : null, sprintOut: sm.sprintOut, aim: sm.aimActive,
      };
    };
    return sm;
  }

  const api = { STATES, MARKER, create };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) { root.G = root.G || {}; root.G.WeaponSM = api; }
})(typeof window !== "undefined" ? window : null);
