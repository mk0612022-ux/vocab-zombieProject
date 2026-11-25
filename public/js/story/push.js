// ===================================================================
// Things pushed into place, the button held (story series, round 7)
// -------------------------------------------------------------------
// The design's 1-3: zombies at the library's doors, "Help me barricade the
// doors!" -- the player holds the interaction button to push a bookshelf
// across each of the two doors, Tonkla comes to push too; between the waves
// that follow, what the banging has knocked back is pushed back in place.
//   scene.push  [{ id, kind, o, from: { x, y, z, yaw }, to: { x, z, yaw }, sec, start, need,
//                 prompt, help, helpAt }]   put there as the scene begins (a StoryCast prop
//               whose box moves with it): at `from`, or `start` of the way (1: in place), or in
//               place once "pushed:<id>" (a checkpoint keeps the flag: a run picked up after
//               the barricade finds the shelves where they were pushed)
//   Held -- the interaction key, the controller's Y, a finger on the hand button -- while it
//   is looked at within reach (the game's own interaction ray) and its `need` holds: it
//   slides along its way, `sec` seconds for all of it; in place, the flag "pushed:<id>" (a
//   scene waits { pushed: id }). `help`: a person of the scene who comes to `helpAt` and
//   pushes too -- G.CONFIG.story.push.helpK times as fast once there
//   ["nudge", { id, by }]   knocked back toward `from` by `by` of the way (the doors banged
//                           on): no longer "pushed", to be pushed again
//   ["push", { id, p }]     put at `p` of the way at once (a scene that starts with it moved)
//   (round 8) something taken by holding the button on it: a use of js/story/interact.js with
//   `holdSec` -- a box of supplies, two seconds each -- the same ring filling; let go, it runs back
//   (twice as fast); full, the use is used. A press alone does nothing.
//   G.StoryPush.enter(game, run, scene) / update(game, dt) / reset() / info(id) / held() / done(id)
// ===================================================================
window.G = window.G || {};

G.StoryPush = (function () {
  const T = (k, v) => G.T(k, v);
  const C = () => (G.CONFIG.story && G.CONFIG.story.push) || {};
  let items = {}, ring = null, scrapeT = 0, pushing = null, takes = {}, taking = null, takeT = 0;
  const run = () => G.Story && G.Story.run;
  const lerp = (a, b, u) => a + (b - a) * u;
  const wrap = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };

  // where it stands at `p` of its way
  function at(it, p) {
    const f = it.def.from, t = it.def.to, yf = f.yaw || 0, yt = t.yaw != null ? t.yaw : yf;
    return { x: lerp(f.x, t.x, p), z: lerp(f.z, t.z, p), yaw: yf + wrap(yt - yf) * p };
  }
  function place(it) {
    const q = at(it, it.p), g = it.g;
    g.position.x = q.x; g.position.z = q.z; g.rotation.y = q.yaw;
    g.updateMatrixWorld(true);
    if (it.col) it.col.setFromObject(g);             // (a dynamic box: js/world.js ColGrid lists it always)
    const P = G.StoryUse && G.StoryUse.point("push:" + it.def.id);
    if (P) { P.mesh.position.set(q.x, it.y + 1.0, q.z); P.mesh.rotation.y = q.yaw; P.mesh.updateMatrix(); P.mesh.updateMatrixWorld(true); }
  }
  // the player's own box (js/game.js tryStep) against the thing at `p`: it never moves into them
  function intoPlayer(game, it, p) {
    const q = at(it, p), g = it.g, pos = game.yawObject.position;
    const old = { x: g.position.x, z: g.position.z, yaw: g.rotation.y };
    g.position.x = q.x; g.position.z = q.z; g.rotation.y = q.yaw; g.updateMatrixWorld(true);
    const b = new THREE.Box3().setFromObject(g);
    g.position.x = old.x; g.position.z = old.z; g.rotation.y = old.yaw; g.updateMatrixWorld(true);
    const feet = pos.y - 1.7, r = 0.35;
    const me = new THREE.Box3(new THREE.Vector3(pos.x - r, feet + 0.1, pos.z - r), new THREE.Vector3(pos.x + r, feet + 2.6, pos.z + r));
    return b.intersectsBox(me) && !(it.col && it.col.intersectsBox(me));
  }
  function sfx(name, it, o) {
    if (!G.Audio || !G.Audio.sfx) return;
    G.Audio.sfx(name, Object.assign({ pos: new THREE.Vector3(it.g.position.x, it.y + 1, it.g.position.z) }, o || {}));
  }

  // ---------------- a scene's ----------------
  function enter(game, r, scene) {
    reset();
    if (!scene || !scene.push || !G.StoryCast || !game.world) return;
    scene.push.forEach((d) => {
      if (!d || !d.id || !d.from || !d.to) return;
      const f = d.from, y = Number.isFinite(f.y) ? f.y : 0;
      const g = G.StoryCast.prop(game, { id: d.id, kind: d.kind || "bookshelf", at: { x: f.x, y, z: f.z }, yaw: f.yaw || 0, o: d.o, dynamic: true });
      if (!g) return;
      const rec = G.StoryCast.propOf(d.id);
      const it = { def: d, g, col: rec && rec.col, y, p: r && r.flags.has("pushed:" + d.id) ? 1 : Math.max(0, Math.min(1, d.start || 0)), anim: null, helped: false };
      items[d.id] = it;
      // (a use point that follows it -- the interaction ray's, held rather than pressed)
      const w = (d.o && d.o.w) || 1;
      G.StoryUse.add(game, { id: "push:" + d.id, at: { x: f.x, y, z: f.z }, size: [w + 0.25, 2.0, 0.85], lift: 1.0, hold: true, push: d.id,
        prompt: d.prompt || "story.use.push", need: d.need || null, sound: "" });
      place(it);
      if (it.p >= 1 && r) r.flags.add("pushed:" + d.id);
    });
  }
  // the button held -- the key, the controller's Y, a finger on the hand button
  function held() {
    const I = G.Input;
    if (!I) return false;
    if (I.padActive && I.padUse) return true;
    if (I.touchInteractHeld) return true;
    return !!(I.isDown && I.isDown("interact"));
  }
  function done(id) { const it = items[id]; return !!(it && it.p >= 1); }
  // its helper comes over (once a push of it has begun), and pushes from beside it
  function callHelp(game, r, it) {
    const d = it.def, h = d.help && G.StoryCast.get(d.help);
    it.helped = true;
    if (!h || !d.helpAt) return;
    const q = at(it, 1);
    G.StoryCast.act(game, r, { id: d.help, walk: [{ x: d.helpAt.x, z: d.helpAt.z }], speed: C().helpSpeed || 2.6, then: { pose: "push", face: { x: q.x, z: q.z } } });
  }
  function letGo(game, r, it) {
    const d = it.def;
    if (d.help && it.helped && G.StoryCast.get(d.help)) G.StoryCast.act(game, r, { id: d.help, pose: "stand" });
  }
  function arrive(game, r, it) {
    it.p = 1;
    place(it);
    r.flags.add("pushed:" + it.def.id);
    sfx("body_thud", it);
    letGo(game, r, it);
  }
  function nudge(game, o) {
    const it = items[o && o.id], r = run();
    if (!it || !r) return;
    const to = Math.max(0, it.p - (o.by != null ? o.by : 0.4));
    if (to >= it.p) return;
    it.anim = { from: it.p, to, t: 0, sec: C().nudgeSec || 0.35 };
    r.flags.delete("pushed:" + it.def.id);
    sfx("body_thud", it);
    if (G.StoryScreen) G.StoryScreen.thud(new THREE.Vector3(it.g.position.x, it.y + 1, it.g.position.z));
    const pp = game.yawObject.position;
    if (Math.hypot(pp.x - it.g.position.x, pp.z - it.g.position.z) < 7 && G.StoryScreen) G.StoryScreen.shake(game, { sec: 0.18, amp: 0.025 });
  }
  function set(game, o) {
    const it = items[o && o.id], r = run();
    if (!it) return;
    it.p = Math.max(0, Math.min(1, +o.p || 0)); it.anim = null;
    place(it);
    if (r) { if (it.p >= 1) r.flags.add("pushed:" + it.def.id); else r.flags.delete("pushed:" + it.def.id); }
  }

  // ---------------- each frame ----------------
  function update(game, dt) {
    const r = run();
    pushing = null;
    if (!r || !game.world) { showRing(null); return; }
    // knocked back: eased there
    Object.keys(items).forEach((id) => {
      const it = items[id], a = it.anim;
      if (!a) return;
      a.t += dt;
      const u = Math.min(1, a.t / a.sec), e = 1 - (1 - u) * (1 - u);
      it.p = lerp(a.from, a.to, e);
      place(it);
      if (u >= 1) it.anim = null;
    });
    const found = game._lookedAtInteractable, ref = found && found.kind === "story" ? found.ref : null;
    const it = ref && ref.push ? items[ref.push] : null;
    const free = game.state === "GAMEPLAY" && !game.paused && !(G.Modal && G.Modal.isOpen());
    if (it && it.p < 1 && !it.anim && free && G.StoryUse.can(ref) && held()) {
      if (it.def.help && !it.helped) callHelp(game, r, it);
      const helping = it.def.help && it.helped && G.StoryCast.arrived(it.def.help);
      const k = helping ? (C().helpK || 1.6) : 1;
      let np = Math.min(1, it.p + (dt / (it.def.sec || C().sec || 2.6)) * k);
      if (np > 0.999) np = 1;                       // (the last hair of the way: there)
      if (!intoPlayer(game, it, np)) {
        it.p = np; place(it);
        pushing = it;
        scrapeT -= dt;
        if (scrapeT <= 0) { scrapeT = C().scrapeEvery || 0.42; sfx("desk_scrape", it); }
        if (it.p >= 1) arrive(game, r, it);
      }
    } else scrapeT = 0;
    take(game, dt, ref, free);
    showRing(taking ? { p: taking.holdP } : it && it.p < 1 && free && G.StoryUse.can(ref) && (pushing || held()) ? it : null);
  }
  // (round 8) a thing taken by holding the button on it (a use with `holdSec`): it fills while it is
  // looked at and held, runs back twice as fast when it is not, and is used when it is full
  function take(game, dt, ref, free) {
    taking = null;
    const on = ref && ref.holdSec > 0 && !ref.used && free && G.StoryUse.can(ref) && held() ? ref : null;
    Object.keys(takes).forEach((id) => {
      const q = takes[id];
      if (q === on) return;
      q.holdP = Math.max(0, (q.holdP || 0) - (dt / q.holdSec) * 2);
      if (q.holdP <= 0 || q.used) delete takes[id];
    });
    if (!on) { takeT = 0; return; }
    takes[on.id] = on;
    on.holdP = Math.min(1, (on.holdP || 0) + dt / on.holdSec);
    if (on.holdP > 0.999) on.holdP = 1;
    taking = on;
    takeT -= dt;
    if (takeT <= 0) { takeT = C().takeEvery || 0.5; if (G.Audio && G.Audio.sfx) G.Audio.sfx(on.takeSound || "paper"); }
    if (on.holdP < 1) return;
    on.full = true;                                  // (js/story/interact.js use: only now)
    delete takes[on.id];
    taking = null;
    G.StoryUse.use(game, on);
  }
  // how far along: a ring under the crosshair while it is pushed
  function showRing(it) {
    if (!it) { if (ring && !ring.classList.contains("hidden")) ring.classList.add("hidden"); return; }
    if (!ring) {
      ring = document.createElement("div");
      ring.id = "story-push"; ring.className = "story-push hidden";
      ring.innerHTML = `<svg viewBox="0 0 40 40" aria-hidden="true"><circle class="spu-bg" cx="20" cy="20" r="16"/><circle class="spu-fg" cx="20" cy="20" r="16"/></svg>`;
      document.body.appendChild(ring);
    }
    ring.classList.remove("hidden");
    ring.style.setProperty("--pp", (it.p || 0).toFixed(3));
  }
  function reset() {
    items = {}; pushing = null; scrapeT = 0; takes = {}; taking = null; takeT = 0;
    if (ring) ring.classList.add("hidden");
  }
  function info(id) { const it = items[id]; return it ? { p: it.p, x: +it.g.position.x.toFixed(2), z: +it.g.position.z.toFixed(2), helped: it.helped, moving: !!it.anim } : null; }

  return { enter, update, reset, nudge, set, held, done, info, ids: () => Object.keys(items), get pushing() { return pushing ? pushing.def.id : null; },
    get taking() { return taking ? { id: taking.id, p: taking.holdP } : null; } };
})();
