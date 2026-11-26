// ===================================================================
// Someone who comes along and has to come through it (story series, round 9)
// -------------------------------------------------------------------
// The design's 1-6: Kru Min down the back stairs to the PR room, then at the PA
// console through the hold. She walks behind the player at the player's own
// pace, never at an enemy, and takes twice what the player can; zombies come at
// her when she is the nearer of the two. She helps: a fire extinguisher -- a
// burst stuns who is close, three seconds, every twenty -- and a shout when one
// comes up behind the player. Down, she is to be helped up by holding the
// button, three seconds, within half a minute; not helped, it is back to the save.
//   ["escort", { id, carry }]            begins: that person of the scene (js/story/cast.js), full health
//   ["escort", { id, stay: { x, z, face: { x, z } }, pose, put }]   goes there -- by the map's own
//                                        doorways -- and stays (`put`: there at once); { follow: true }: along again
//   ["escort", { heal: true }]           full health again (a save's fresh start)
//   ["escort", { id, on: false }]        over: no zombie is after her, her bar gone
//   ["use"] "revive"                     where she fell, held (js/story/push.js); the flag
//                                        "fell:<id>" stays for the chapter (an achievement of round 11)
//   a condition { escort: "up" | "down" | "stay" }    (js/story/scenes.js): on her feet, down, where she was sent
//   G.StoryEscort.start / update(game, dt) / reset(game) / info()
//   js/game.js updateZombies: target(game) (her, as a target, or null) / hunts(game, z) (is z after her
//   now?) / bite(game, z) (a blow of z's has landed on her)
// G.CONFIG.story.escort has every number.
// ===================================================================
window.G = window.G || {};

G.StoryEscort = (function () {
  const T = (k, v) => G.T(k, v);
  const C = () => (G.CONFIG.story && G.CONFIG.story.escort) || {};
  const run = () => G.Story && G.Story.run;
  let e = null, chip = null, chipKey = "";
  const npc = () => (e && G.StoryCast ? G.StoryCast.get(e.id) : null);
  const wrap = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
  // (a line of hers: the chapter's own, js/strings.js -- "story.ch1.d.minBehind1")
  const line = (k) => "story." + ((run() && run().ch && run().ch.id) || "ch1") + ".d." + e.id + k;
  function shout(key, opts) {
    const r = run();
    if (!r || !G.StoryDialogue) return;
    if (G.StoryDialogue.busy()) { if (G.StoryWhisper && !(opts && opts.quiet)) G.StoryWhisper.show(T("story.who." + e.id) + ": " + G.StoryDialogue.en(key, G.Story.vars())); return; }
    const n = npc();
    if (n) n.talkT = Math.max(n.talkT, 1.4);
    G.StoryDialogue.say([{ who: e.id, line: key, vars: G.Story.vars() }]);
  }

  // ---------------- a scene's ----------------
  function start(game, r, o) {
    o = o || {};
    if (o.on === false) { stop(game); return; }
    const id = o.id || (e && e.id);
    const n = G.StoryCast && id ? G.StoryCast.get(id) : null;
    if (!n) return;
    if (!e || e.id !== id) {
      const max = Math.max(1, Math.round((game.player ? game.player.maxHp : 100) * (o.hpK || C().hpK || 2)));
      e = { id, hp: max, max, down: false, downT: 0, safeT: 0, cd: 0, sprayT: 0, warnT: C().warnFirst != null ? C().warnFirst : 2, hurtT: 0, hitT: 0, lookT: 0, t: 0, falls: 0, bites: 0, sprays: 0, stunned: 0, warned: 0,
        stay: null, pose: "", arrived: false, tgt: { pos: new THREE.Vector3(), feet: 0, region: null, flight: null } };
      n.followMax = C().followMax || 5.6;
      G.StoryCast.act(game, r, { id, carry: o.carry === undefined ? { kind: "extinguisher", at: [0.2, 0.7, 0.24], scale: 1 } : o.carry, follow: !o.stay, pose: "ext" });
      n.path = null;
    }
    if (o.heal) { e.hp = e.max; if (e.down) getUp(game, 1); }
    if (o.follow) { e.stay = null; e.pose = ""; e.arrived = false; if (!e.down) G.StoryCast.act(game, r, { id, follow: true, pose: "ext" }); }
    if (o.stay) {
      e.stay = { x: o.stay.x, z: o.stay.z, y: Number.isFinite(o.stay.y) ? o.stay.y : n.pos.y, face: o.stay.face || null };
      e.pose = o.pose || "ext"; e.arrived = false;
      if (o.put) {
        G.StoryCast.act(game, r, { id, to: { x: e.stay.x, y: e.stay.y, z: e.stay.z }, follow: false });
        n.path = null; e.arrived = true;
        settle(game, n, true);
      } else if (!e.down) goTo(game, n);
    }
    target(game);
    show(true);
  }
  function stop(game) {
    if (!e) return;
    const n = npc();
    if (n) { n.followMax = 0; G.StoryCast.act(game, run(), { id: e.id, label: null }); }
    if (G.StoryUse) G.StoryUse.remove(game, "revive");
    if (game && game.zombies) game.zombies.forEach((z) => { z._prey = false; z._preyAt = null; });
    e = null;
    show(false);
  }
  // the way from where she is to a place, through the map's doorways (its waypoints: js/world.js)
  function way(game, n, to) {
    const W = game.world, a = G.getRegionAt(W, n.pos.x, n.pos.z, n.pos.y), b = G.getRegionAt(W, to.x, to.z, to.y);
    const pts = [];
    if (a !== b) G.findPath(W, a, b).forEach((id) => { const q = W.waypointNodes[id]; if (q && id !== b) pts.push({ x: q.x, z: q.z }); });
    pts.push({ x: to.x, z: to.z });
    return pts;
  }
  function goTo(game, n) {
    n.faceP = null;
    G.StoryCast.act(game, run(), { id: e.id, pose: "ext", walk: way(game, n, e.stay), speed: C().walkSpeed || 2.6 });
  }
  // there: turned to what she is at
  function settle(game, n, snap) {
    const f = e.stay && e.stay.face;
    n.pose = e.pose || "ext";
    if (!f) return;
    n.faceP = { x: f.x, z: f.z };
    if (snap) { n.yaw = Math.atan2(f.x - n.pos.x, f.z - n.pos.z); n.wantYaw = null; }
  }

  // ---------------- who is after her ----------------
  // her, as a zombie's target: where, on which storey, in which part of the map (js/game.js)
  function target(game) {
    const n = npc();
    if (!e || e.down || !n || n.hidden) return null;
    const q = e.tgt;
    q.pos.set(n.pos.x, n.pos.y + 1.7, n.pos.z);
    q.feet = n.pos.y;
    q.region = G.getRegionAt(game.world, n.pos.x, n.pos.z, n.pos.y);
    return q;
  }
  // zombie z after her rather than the player: she is the nearer by a margin (a storey counts for
  // six metres); thought over again every so often, and not for a hair's breadth
  function hunts(game, z) {
    const n = npc();
    if (!e || e.down || !n) return false;
    if (z.type === "boss" || z.storyBoss) return false;
    const every = C().thinkEvery || 0.4;
    if (z._preyAt != null && e.t - z._preyAt < every) return !!z._prey;
    z._preyAt = e.t - Math.random() * 0.1;
    const p = game.yawObject.position, q = z.mesh.position, far = (x, y, zz) => Math.hypot(x - q.x, zz - q.z) + Math.abs(y - q.y) * 1.5;
    const dP = far(p.x, p.y - 1.7, p.z), dM = far(n.pos.x, n.pos.y, n.pos.z), m = C().margin != null ? C().margin : 1.2;
    z._prey = z._prey ? dM < dP + m : dM + m < dP;
    return !!z._prey;
  }
  // a blow of zombie z's has landed on her
  function bite(game, z) {
    const n = npc();
    if (!e || e.down || !n || e.safeT > 0) return;
    e.hp = Math.max(0, e.hp - Math.max(0, z.damage || 0) * (C().biteK != null ? C().biteK : 1));
    e.bites++; e.hurtT = 0.45; e.calmT = 0;
    if (G.Audio && G.Audio.sfx) G.Audio.sfx("body_thud", { pos: new THREE.Vector3(n.pos.x, n.pos.y + 1.2, n.pos.z) });
    if (e.hp <= 0) { fall(game); return; }
    if (e.hitT <= 0) { e.hitT = C().hitGap || 7; shout(line("Hit"), { quiet: true }); }
    chipKey = "";
  }

  // ---------------- down, and up again ----------------
  function fall(game) {
    const n = npc(), r = run();
    if (!n || !r || e.down) return;
    e.down = true; e.downT = C().downSec || 30; e.falls++; e.hp = 0; e.sprayT = 0;
    n.path = null; n.then = null;
    G.StoryCast.act(game, r, { id: e.id, follow: false, pose: "floor", label: { word: T("story.escort.help"), color: "#ff8a8a", flicker: true } });
    n.faceP = null;
    r.flags.add("fell:" + e.id);
    if (G.StoryUse) G.StoryUse.add(game, { id: "revive", at: { x: n.pos.x, y: n.pos.y, z: n.pos.z }, size: [1.5, 1.3, 1.5], lift: 0.55, prompt: "story.use.revive", holdSec: C().reviveSec || 3, sound: "", takeSound: "click" });
    if (G.StoryScreen) G.StoryScreen.setHint({ key: "story.hint.revive", bind: "interact", sec: 9 });
    if (G.Audio && G.Audio.sfx) G.Audio.sfx("deny");
    game.zombies.forEach((z) => { z._prey = false; });
    G.StoryDialogue.say([{ who: e.id, line: line("Down"), vars: G.Story.vars() }]);
    chipKey = "";
    if (G.Bus) G.Bus.emit("story:down", { id: e.id });
  }
  function getUp(game, share) {
    const n = npc(), r = run();
    if (!e || !n) return;
    e.down = false; e.hp = Math.max(1, Math.round(e.max * (share != null ? share : C().reviveHp || 0.5))); e.safeT = C().safeSec || 2.5;
    if (G.StoryUse) G.StoryUse.remove(game, "revive");
    if (r) r.flags.delete("used:revive");
    G.StoryCast.act(game, r, { id: e.id, pose: "ext", label: null });
    if (e.stay) { if (e.arrived) settle(game, n); else goTo(game, n); }
    else G.StoryCast.act(game, r, { id: e.id, follow: true });
    chipKey = "";
  }

  // ---------------- the extinguisher, the shout ----------------
  // a zombie she would use it on: close to her, or close to the player while they are together
  function closest(game, n) {
    const p = game.yawObject.position, at = C().sprayAt || 2.8, by = C().sprayBy || 2, together = Math.hypot(p.x - n.pos.x, p.z - n.pos.z) < (C().together || 4.5) && Math.abs(p.y - 1.7 - n.pos.y) < 1.5;
    let best = null, bd = Infinity;
    game.zombies.forEach((z) => {
      if (!z.alive || z.emerge || z.type === "boss" || z.storyBoss || z.stunT > 0) return;
      const q = z.mesh.position;
      if (Math.abs(q.y - n.pos.y) > 1.5) return;
      const d = Math.hypot(q.x - n.pos.x, q.z - n.pos.z), dp = Math.hypot(q.x - p.x, q.z - p.z);
      if (!(d < at || (together && dp < by && d < (C().sprayRange || 4.4)))) return;
      if (d < bd) { bd = d; best = z; }
    });
    return best;
  }
  function spray(game, n, z) {
    const q = z.mesh.position, dx = q.x - n.pos.x, dz = q.z - n.pos.z, d = Math.hypot(dx, dz) || 1, ux = dx / d, uz = dz / d;
    const R = C().sprayRange || 4.4, cos = Math.cos(((C().sprayCone || 50) * Math.PI) / 180), sec = C().stunSec || 3;
    e.cd = C().sprayCd || 20; e.sprayT = C().spraySec || 1; e.sprays++;
    n.wantYaw = Math.atan2(dx, dz); n.yaw += wrap(n.wantYaw - n.yaw) * 0.6;
    game.zombies.forEach((o) => {
      if (!o.alive || o.emerge || o.type === "boss" || o.storyBoss) return;
      const ox = o.mesh.position.x - n.pos.x, oz = o.mesh.position.z - n.pos.z, od = Math.hypot(ox, oz);
      if (Math.abs(o.mesh.position.y - n.pos.y) > 1.5 || od > R) return;
      if (od > 0.9 && (ox * ux + oz * uz) / od < cos) return;
      o.stunT = Math.max(o.stunT || 0, sec); o._atk = null; e.stunned++;
      if (o._rear > 0 && G.ZombieAI) G.ZombieAI.cancelScream(o);
      if (game.pushZombie) game.pushZombie(o, ox || 0.01, oz, C().sprayPush != null ? C().sprayPush : 0.5);
    });
    // the powder: white, out along the burst
    if (G.ZombieFX && G.ZombieFX.puff) for (let i = 1; i <= 4; i++) G.ZombieFX.puff(new THREE.Vector3(n.pos.x + ux * i * R * 0.24, n.pos.y + 1.0, n.pos.z + uz * i * R * 0.24), 3, 0.5 + i * 0.22, [0.86, 0.88, 0.9]);
    const a = G.Audio && G.Audio.ctx && G.Audio.group ? G.Audio : null, pos = new THREE.Vector3(n.pos.x, n.pos.y + 1.1, n.pos.z);
    if (a) a.group({ cat: "sfx", prio: 2, pos, dur: 1.1 }, () => {
      a.noise({ dur: 0.95, freq: 4200, freqEnd: 2600, q: 0.5, gain: 0.16, pos });
      a.noise({ dur: 0.2, freq: 1200, freqEnd: 700, q: 0.8, gain: 0.1, pos });
    });
    if (G.Captions && G.Captions.on && G.Captions.on()) G.Captions.show("extinguisher", "");
    if (G.Bus) G.Bus.emit("story:spray", { id: e.id });
    n.pose = "spray";
    chipKey = "";
  }
  // what she carries: in her hands, or -- at the desk -- on the floor beside her; not while she is down
  function holding(n) {
    const h = n.held;
    if (!h) return;
    const floor = n.pose === "console", v = !e.down, key = (floor ? "f" : "h") + (v ? 1 : 0);
    if (h.userData.escortAt === key) return;
    h.userData.escortAt = key;
    h.visible = v;
    const k = 1 / (n.model.scale.x || 1), at = floor ? [-0.55, 0, 0.1] : n.heldAt || [0.2, 0.7, 0.24];
    h.position.set(at[0] * k, at[1] * k, at[2] * k);
  }
  // one coming up behind the player, where they can be seen but are not being looked at
  function behind(game) {
    const p = game.yawObject.position, yaw = game.yawObject.rotation.y, fx = -Math.sin(yaw), fz = -Math.cos(yaw), r0 = C().warnNear || 1.4, r1 = C().warnFar || 9, cut = C().warnDot != null ? C().warnDot : -0.3;
    for (const z of game.zombies) {
      if (!z.alive || z.emerge || z.type === "boss" || z.storyBoss || z.stunT > 0) continue;
      const q = z.mesh.position, dx = q.x - p.x, dz = q.z - p.z, d = Math.hypot(dx, dz);
      if (d < r0 || d > r1 || Math.abs(q.y - (p.y - 1.7)) > 1.5) continue;
      if ((dx * fx + dz * fz) / d > cut) continue;
      if (!G.Story.sees(game, p, q)) continue;
      return z;
    }
    return null;
  }

  // ---------------- each frame ----------------
  function update(game, dt) {
    if (!e) return;
    const n = npc(), r = run();
    if (!n || !r) { e = null; show(false); return; }
    if (game.state !== "GAMEPLAY" || game.paused || (G.Modal && G.Modal.freezesWorld && G.Modal.freezesWorld())) return;
    e.t += dt;
    if (e.cd > 0) e.cd = Math.max(0, e.cd - dt);
    if (e.hitT > 0) e.hitT -= dt;
    if (e.hurtT > 0) { e.hurtT -= dt; if (e.hurtT <= 0) chipKey = ""; }
    if (e.safeT > 0) e.safeT -= dt;
    // (left alone for a while she gets her breath back, as the player does)
    e.calmT = (e.calmT || 0) + dt;
    if (!e.down && e.hp < e.max && e.calmT >= (C().regenDelay != null ? C().regenDelay : 6)) e.hp = Math.min(e.max, e.hp + e.max * (C().regen || 0) * dt);
    if (e.down) {
      holding(n);
      // (her HELP! is for finding her: not over the screen of who stands by her)
      if (n.label) n.label.visible = Math.hypot(n.pos.x - game.yawObject.position.x, n.pos.z - game.yawObject.position.z) > (C().helpHide || 3);
      if (r.flags.has("used:revive")) { getUp(game); shout(line("Up")); }
      else {
        // (being helped: the half minute stands still -- a help begun in time is in time)
        const q = G.StoryPush && G.StoryPush.taking;
        e.helping = !!(q && q.id === "revive");
        if (!e.helping) e.downT -= dt;
        if (e.downT <= 0) { e.downT = 0; chipUpdate(game, n); G.Story.died(game, { icon: "🚑", title: "story.fail." + e.id + ".title", text: "story.fail." + e.id + ".text" }); return; }
      }
      chipUpdate(game, n);
      return;
    }
    // where she was sent: there
    if (e.stay && !e.arrived && !n.path) { e.arrived = true; settle(game, n); }
    // the burst: turned to it, her arms out, then back to what she was doing
    if (e.sprayT > 0) {
      e.sprayT -= dt;
      n.pose = "spray";
      if (e.sprayT <= 0) { if (e.stay && e.arrived) settle(game, n); else { n.pose = "ext"; n.faceP = null; } }
    } else if (e.cd <= 0) {
      const z = closest(game, n);
      if (z) { n.faceP = { x: z.mesh.position.x, z: z.mesh.position.z }; spray(game, n, z); }
    }
    holding(n);
    e.warnT -= dt;
    if (e.warnT <= 0) {
      e.warnT = 0.4;
      const z = behind(game);
      if (z) { e.warnT = C().warnGap || 6; e.warned++; shout(line("Behind" + (1 + (e.warned - 1) % 3))); }
    }
    chipUpdate(game, n);
  }

  // ---------------- her bar on the screen ----------------
  function show(on) {
    document.body.classList.toggle("story-escort-on", !!on);
    if (!on) { if (chip) chip.classList.add("hidden"); chipKey = ""; return; }
    if (!chip) {
      chip = document.createElement("div");
      chip.id = "story-escort"; chip.className = "story-escort hidden";
      chip.innerHTML = `<div class="se-top"><span class="se-name" id="se-name"></span><span class="se-ext" id="se-ext" aria-hidden="true">🧯</span></div><div class="se-bar"><i id="se-fill"></i></div><div class="se-note hidden" id="se-note"></div>`;
      document.body.appendChild(chip);
    }
    chip.classList.remove("hidden");
    chipKey = "";
  }
  function chipUpdate(game, n) {
    if (!chip) return;
    const k = e.max > 0 ? e.hp / e.max : 0, cd = C().sprayCd || 20;
    let note = "";
    if (e.down) {
      const p = game.yawObject.position, yaw = game.yawObject.rotation.y, dx = n.pos.x - p.x, dz = n.pos.z - p.z;
      const f = dx * -Math.sin(yaw) + dz * -Math.cos(yaw), s = dx * Math.cos(yaw) + dz * -Math.sin(yaw);
      const way = Math.abs(f) >= Math.abs(s) ? (f >= 0 ? "ahead" : "behind") : s >= 0 ? "right" : "left";
      note = T("story.escort.down", { n: Math.ceil(e.downT), way: T("story.escort." + way) });
    }
    const key = [Math.round(k * 100), Math.ceil((e.cd / cd) * 20), e.down ? 1 : 0, e.hurtT > 0 ? 1 : 0, note].join("|");
    if (key === chipKey) return;
    chipKey = key;
    chip.querySelector("#se-name").textContent = T("story.who." + e.id);
    chip.querySelector("#se-fill").style.width = (k * 100).toFixed(1) + "%";
    chip.classList.toggle("low", k < 0.35 && !e.down);
    chip.classList.toggle("down", e.down);
    chip.classList.toggle("hit", e.hurtT > 0);
    const x = chip.querySelector("#se-ext");
    x.style.setProperty("--cd", (1 - e.cd / cd).toFixed(2));
    x.classList.toggle("ready", e.cd <= 0);
    const nt = chip.querySelector("#se-note");
    nt.textContent = note;
    nt.classList.toggle("hidden", !note);
    chip.setAttribute("aria-label", T("story.who." + e.id) + " " + Math.round(k * 100) + "%");
  }
  function reset() {
    if (e && G.Game && G.Game.zombies) G.Game.zombies.forEach((z) => { z._prey = false; z._preyAt = null; });
    e = null;
    show(false);
  }
  // a scene's { escort: ... }
  function is(what) {
    if (!e) return false;
    if (what === "down") return e.down;
    if (what === "up") return !e.down;
    if (what === "stay") return !!(e.stay && e.arrived && !e.down);
    return false;
  }
  function info() { return e ? { id: e.id, hp: e.hp, max: e.max, down: e.down, downT: e.downT, cd: e.cd, spraying: e.sprayT > 0, stay: e.stay, arrived: e.arrived, falls: e.falls, bites: e.bites, sprays: e.sprays, stunned: e.stunned, warned: e.warned, safeT: e.safeT, helping: !!e.helping } : null; }

  return { start, update, reset, stop, target, hunts, bite, is, info, fall, get active() { return !!e; }, get state() { return e; } };
})();
