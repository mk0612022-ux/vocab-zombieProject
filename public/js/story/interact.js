// ===================================================================
// A scene's things to use, and a press in time (story series, round 5)
// -------------------------------------------------------------------
// The prologue teaches the interaction button on a seating plan, a pair of
// glasses and a jammed door, and the timing of a press on a friend who has
// stopped being one. Both are a scene's actions (js/story/scenes.js):
//   ["use", { id, at: { x, y, z }, size: [w, h, d], prompt }]   something to use: looked at
//       within reach, the game's own interaction prompt (js/game.js updateInteractRay: E, the
//       hand button, the controller's X) says `prompt`; used, the run's flag "used:<id>" (a
//       scene waits { used: id }) -- and it is gone
//   ["unuse", id]
//   (round 6) a use may wait for something: { need: <condition>, promptNo, deny } -- until the
//       condition holds (a crowbar in the melee slot) it says `promptNo` and, used, sets only
//       "tried:<id>" and shows the hint `deny`; { blocked: true, deny } never opens
//   ["doors", { ids, prompt, blocked: { id: hint } }]   the map's doors opened by hand: a use in
//       each doorway, "used:door:<id>" once open (a scene's rule: a Shambler behind one of them)
//   ["qte", { id, prompt, sec, window, hurt }]   a press in time: a ring closes on its mark
//       over `sec`; pressed while within `window` of it -- the interaction key, Space, the
//       trigger, A, X, a tap anywhere on it -- the flag "qte:<id>". Too early, too late, or
//       not at all: `hurt` health (never below 1) and it starts again
//   G.StoryUse.prompt(ref, key) / use(game, ref)   js/game.js's ray and doInteract
//   G.StoryUse.onKey(e) / update(game, dt) / reset(game) / qteActive
// ===================================================================
window.G = window.G || {};

G.StoryUse = (function () {
  const T = (k, v) => G.T(k, v);
  const C = () => (G.CONFIG.story && G.CONFIG.story.use) || {};
  const esc = (s) => G.escapeHtml(String(s == null ? "" : s));
  let points = {}, q = null, el = null, prev = false, keyHit = false, tapHit = false;
  const run = () => G.Story && G.Story.run;

  // ---------------- things to use ----------------
  function add(game, o) {
    if (!o || !o.id || !game.scene || !game.world) return;
    remove(game, o.id);
    const s = o.size || [0.8, 1.2, 0.8], at = o.at || {};
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(s[0], s[1], s[2]), new THREE.MeshBasicMaterial());
    mesh.position.set(at.x || 0, (Number.isFinite(at.y) ? at.y : 0) + (o.lift != null ? o.lift : s[1] / 2), at.z || 0);
    mesh.visible = false;                          // (the ray still finds it: three.js casts at what is hidden too)
    mesh.name = "story-use:" + o.id;
    game.scene.add(mesh);
    // (where it is, once: the frame's matrix pass skips what is hidden, and it never moves)
    mesh.matrixAutoUpdate = false;
    mesh.updateMatrix();
    mesh.updateMatrixWorld(true);
    const ref = { id: o.id, prompt: o.prompt || "story.use.generic", used: false, keep: !!o.keep, sound: o.sound || "click",
      need: o.need || null, promptNo: o.promptNo || null, deny: o.deny || null, blocked: !!o.blocked, door: o.door || null, onUse: typeof o.onUse === "function" ? o.onUse : null };
    const it = { mesh, kind: "story", ref };
    (game.world.interactables = game.world.interactables || []).push(it);
    points[o.id] = it;
  }
  // (round 6) the map's doors the player opens by hand: a use point in each doorway ("used:door:<id>"
  // once it is open). `blocked`: { id: hint } -- one that will not open, tried ("tried:door:<id>")
  function doors(game, o) {
    const M = game.world && game.world.storyMap;
    if (!M || !M.doorInfo) return;
    [].concat(o.ids || []).forEach((id) => {
      const d = M.doorInfo(id);
      if (!d || d.open) return;
      const deny = o.blocked && o.blocked[id];
      add(game, { id: "door:" + id, door: id, at: { x: d.x, y: d.y, z: d.z }, size: d.axis === "x" ? [d.w, 2.1, 0.7] : [0.7, 2.1, d.w],
        prompt: deny ? (o.promptBlocked || "story.use.openDoor") : (o.prompt || "story.use.openDoor"), sound: deny ? "rattle" : "", blocked: !!deny, deny: deny || null });
    });
  }
  function remove(game, id) {
    const it = points[id];
    if (!it) return;
    if (game && game.world && game.world.interactables) game.world.interactables = game.world.interactables.filter((x) => x !== it);
    if (it.mesh.parent) it.mesh.parent.remove(it.mesh);
    it.mesh.geometry.dispose(); it.mesh.material.dispose();
    delete points[id];
  }
  // (round 6) `need`: a condition (js/story/scenes.js) -- until it holds the point says `promptNo`
  // and, used, only "tried:<id>" and its `deny` hint (a jammed door before the crowbar); `blocked`:
  // never (a door barricaded from the other side)
  function can(ref) {
    if (ref.blocked) return false;
    const r = run();
    return !ref.need || !r || !G.StoryScenes || G.StoryScenes.met(G.Game, r, ref.need);
  }
  function prompt(ref, key) { return ref && !ref.used ? T(can(ref) ? ref.prompt : ref.promptNo || ref.prompt, { key }) : ""; }
  function use(game, ref) {
    const r = run();
    if (!ref || ref.used || !r) return;
    if (!can(ref)) {
      r.flags.add("tried:" + ref.id);
      if (ref.deny && G.StoryScreen) G.StoryScreen.setHint(ref.deny);
      if (G.Audio && G.Audio.sfx) G.Audio.sfx(ref.sound === "rattle" ? "rattle" : "deny");
      return;
    }
    // (round 6) a use of its own (the letter lock's: js/story/wheellock.js) -- the point stays
    if (ref.onUse) { r.flags.add("used:" + ref.id); ref.onUse(game, ref); return; }
    if (!ref.keep) ref.used = true;
    r.flags.add("used:" + ref.id);
    if (ref.door) {
      // a door of the map's, opened by hand
      const M = game.world && game.world.storyMap;
      if (M && M.door) M.door(ref.door, true);
      if (G.StoryScreen) G.StoryScreen.sound("door");
    } else if (G.Audio && G.Audio.sfx && ref.sound) G.Audio.sfx(ref.sound);
    if (!ref.keep) remove(game, ref.id);
  }

  // ---------------- a press in time ----------------
  function ensure() {
    if (el) return el;
    el = document.createElement("div");
    el.id = "story-qte"; el.className = "story-qte hidden";
    el.setAttribute("role", "button");
    el.innerHTML = `<div class="sq-ring"><i class="sq-mark"></i><i class="sq-close" id="sq-close"></i></div><div class="sq-text" id="sq-text"></div>`;
    document.body.appendChild(el);
    // (a tap or a click on it: the press -- the touch screen's way, and a mouse's when not locked)
    const hit = (e) => { if (q) { tapHit = true; if (e.cancelable) e.preventDefault(); } };
    el.addEventListener("touchstart", hit, { passive: false });
    el.addEventListener("mousedown", hit);
    return el;
  }
  function qte(game, o) {
    o = o || {};
    ensure();
    q = { id: String(o.id || "qte"), prompt: o.prompt || "story.qte.push", sec: o.sec || C().qteSec || 1.6, win: o.window || C().qteWindow || 0.2,
      hurt: o.hurt != null ? o.hurt : (C().qteHurt || 12), t: 0, misses: 0, pause: 0, done: false };
    prev = true;                                  // (a button already held does not count)
    keyHit = false; tapHit = false;
    render();
    el.classList.remove("hidden", "ok", "bad");
  }
  function render() {
    if (!el || !q) return;
    const I = G.Input, kb = G.save.settings.keybinds;
    const key = I.padActive ? "A" : I.mode === "touch" ? "" : G.keyLabel(kb.interact);
    el.querySelector("#sq-text").textContent = key ? T(q.prompt, { key }) : T(q.prompt + "Touch");
  }
  // the ring's size: 2.2 times the mark at the start, the mark at `sec`, then smaller
  const scaleAt = (u) => 2.2 - 1.2 * u;
  function pressed() {
    const I = G.Input;
    const now = !!((I.mode === "desktop" && I.mouseDown) || I.touchFire || I.padFire || I.padJump || (I.padInteract) || I.touchInteract);
    const edge = (now && !prev) || keyHit || tapHit;
    prev = now; keyHit = false; tapHit = false;
    return edge;
  }
  function onKey(e) {
    if (!q || q.done) return false;
    const kb = G.save.settings.keybinds;
    if (e.code === kb.interact || e.code === "Space" || e.code === "Enter" || e.code === "NumpadEnter") { if (!e.repeat) keyHit = true; return true; }
    return false;
  }
  function update(game, dt) {
    if (!q || q.done) return;
    const r = run();
    if (q.pause > 0) { q.pause -= dt; pressed(); if (q.pause <= 0) { q.t = 0; el.classList.remove("bad"); render(); } return; }
    q.t += dt;
    const u = q.t / q.sec, s = scaleAt(u);
    el.style.setProperty("--qs", s.toFixed(3));
    el.classList.toggle("near", Math.abs(s - 1) <= q.win);
    const hit = pressed();
    if (hit && Math.abs(s - 1) <= q.win) {
      q.done = true;
      el.classList.add("ok");
      if (r) r.flags.add("qte:" + q.id);
      if (G.Audio && G.Audio.sfx) G.Audio.sfx("correct");
      setTimeout(() => { if (el && (!q || q.done)) el.classList.add("hidden"); }, 450);
      return;
    }
    if (hit || s < 1 - q.win * 1.6) {
      // missed: a hit taken (never the last of the health), and once more
      q.misses++;
      q.pause = C().qteRetry || 0.9;
      el.classList.add("bad");
      const pl = game.player;
      if (pl && q.hurt > 0) { pl.hp = Math.max(1, pl.hp - q.hurt); if (G.UI.flashDamage) G.UI.flashDamage(); }
      if (G.Audio && G.Audio.sfx) G.Audio.sfx("wrong");
    }
  }
  function reset(game) {
    Object.keys(points).forEach((id) => remove(game, id));
    points = {};
    q = null;
    if (el) el.classList.add("hidden");
  }

  return { add, remove, doors, can, prompt, use, qte, onKey, update, reset,
    get qteActive() { return !!(q && !q.done); }, get qte0() { return q; }, has: (id) => !!points[id], ids: () => Object.keys(points) };
})();
