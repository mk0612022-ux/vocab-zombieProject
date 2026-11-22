// ===================================================================
// A letter lock on a door (story series, round 6: scene 1-2)
// -------------------------------------------------------------------
// The library's back door: nine wheels of letters and a word to set on them
// -- TEMPORARY, from Kru Min's clue ("something that lasts only for a short
// time"). The design's own: the word-locked door's Spelling, turned instead
// of typed.
//   ["wheel", { id, door, answer, word, clue, at, yaw, use: { at, size } }]   a scene's action
//       (js/story/scenes.js): a lock beside the map's door `door` (shut until it opens), `answer`
//       its letters, `word` the bank's word it is (the first try is that word's spelling, right
//       or wrong, as a question is one answer), `clue` the line it shows (Kru Min's, subtitled)
// At the lock -- its use point, "E: Turn the letter wheels" -- the world goes on (nothing pauses:
// the design's Sprinters come while it is up), but the feet, the look and the gun are the lock's:
//   keyboard  A / D or ← / → (or the mouse moved sideways) a wheel · W / S or ↑ / ↓ or the mouse
//             wheel turns it · Enter or Space: try · E, Q, Backspace or Esc: step back
//   touch     swipe a wheel up or down, or its arrows · Open · Step back
//   pad       D-pad ← → a wheel, ↑ ↓ turn it (held: on and on) · A try · B step back
// A try: right -- "lock:<id>", the door swings open; wrong -- each wrong letter marked red (the
// explanation system's own marks: G.Explain / G.Spell.markup on the card under the word box),
// "lockwrong:<id>:<n>" (a scene's rule: Nam shouting the clue through the door after two).
// A zombie coming (within `lock.breakDist`), a hit taken, a window opened: the player steps back
// by themselves -- the letters stay as they were set. "lockopen:<id>": the first time it is up.
//   G.StoryLock.holds() / onKey(e) / padInput(...) / update(game, dt) / reset(game) / info(id)
// ===================================================================
window.G = window.G || {};

G.StoryLock = (function () {
  const T = (k, v) => G.T(k, v);
  const C = () => (G.CONFIG.story && G.CONFIG.story.lock) || {};
  const esc = (s) => G.escapeHtml(String(s == null ? "" : s));
  const ABC = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let locks = {}, cur = null, el = null, hp0 = 0, mouseX = 0, touch = null, pad = { t: 0, dir: 0 }, wheelBound = false, closeT = 0;
  const run = () => G.Story && G.Story.run;
  const flag = (f) => { const r = run(); if (r) r.flags.add(f); };

  // ---------------- on the map ----------------
  // the box beside the door: a dark plate, its nine letters on a little screen (they turn as the
  // wheels do -- the same letters the window shows)
  function build(game, L) {
    const g = new THREE.Group();
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.26, 0.08), new THREE.MeshLambertMaterial({ color: 0x2c3036 }));
    g.add(box);
    const cv = document.createElement("canvas");
    cv.width = 256; cv.height = 48;
    const tex = new THREE.CanvasTexture(cv);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.08), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
    face.position.set(0, 0.02, 0.041);
    g.add(face);
    const led = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.02), new THREE.MeshBasicMaterial({ color: 0xff3a2a, toneMapped: false }));
    led.position.set(0.17, -0.08, 0.045);
    g.add(led);
    const at = L.at || {};
    g.position.set(at.x || 0, (Number.isFinite(at.y) ? at.y : 0) + (at.lift != null ? at.lift : 1.25), at.z || 0);
    g.rotation.y = L.yaw || 0;
    game.scene.add(g);
    L.prop = { g, cv, tex, led };
    paint(L);
  }
  function paint(L) {
    if (!L.prop) return;
    const c = L.prop.cv.getContext("2d"), n = L.answer.length, w = 256 / n;
    c.fillStyle = "#101418"; c.fillRect(0, 0, 256, 48);
    c.font = "bold 30px monospace"; c.textAlign = "center"; c.textBaseline = "middle";
    for (let i = 0; i < n; i++) {
      c.fillStyle = L.solved ? "#5dff8a" : "#e8f0ff";
      c.fillText(ABC[L.letters[i]], w * (i + 0.5), 25);
    }
    L.prop.tex.needsUpdate = true;
    L.prop.led.material.color.setHex(L.solved ? 0x3aff6a : 0xff3a2a);
  }
  function add(game, o) {
    if (!o || !o.id || !o.answer || !game.scene) return;
    remove(game, o.id);
    const answer = String(o.answer).toUpperCase().replace(/[^A-Z]/g, "");
    const L = { id: String(o.id), door: o.door || null, answer, word: o.word || null, clue: o.clue || null, at: o.at, yaw: o.yaw || 0,
      letters: answer.split("").map(() => 0), sel: 0, wrong: 0, solved: false, counted: false, marks: null, prop: null };
    locks[L.id] = L;
    build(game, L);
    const u = o.use || {};
    if (G.StoryUse) G.StoryUse.add(game, { id: "lock:" + L.id, at: u.at || o.at, size: u.size || [0.9, 1.4, 1.2], lift: u.lift, prompt: "story.use.lock", sound: "", onUse: () => open(L.id) });
  }
  function remove(game, id) {
    const L = locks[id];
    if (!L) return;
    if (cur === L) close();
    if (L.prop) { if (L.prop.g.parent) L.prop.g.parent.remove(L.prop.g); L.prop.g.traverse((m) => { if (m.isMesh) { m.geometry.dispose(); if (m.material.map) m.material.map.dispose(); m.material.dispose(); } }); }
    if (G.StoryUse && game) G.StoryUse.remove(game, "lock:" + id);
    delete locks[id];
  }

  // ---------------- the window ----------------
  function ensure() {
    if (el) return el;
    el = document.createElement("div");
    el.id = "story-lock"; el.className = "story-lock hidden";
    el.setAttribute("role", "group");
    document.body.appendChild(el);
    // (touch, and a mouse when not locked: the arrows, the buttons, a wheel tapped or swiped)
    el.addEventListener("click", (e) => {
      if (!cur) return;
      const b = e.target.closest("[data-act]");
      if (!b) return;
      const i = Number(b.dataset.i);
      if (b.dataset.act === "up") { select(i); turn(1); }
      else if (b.dataset.act === "down") { select(i); turn(-1); }
      else if (b.dataset.act === "wheel") select(i);
      else if (b.dataset.act === "try") tryWord();
      else if (b.dataset.act === "back") close();
    });
    el.addEventListener("touchstart", (e) => {
      const w = e.target.closest(".sl-wheel");
      if (!cur || !w || e.target.closest("[data-act='up'], [data-act='down']")) return;
      touch = { i: Number(w.dataset.i), y: e.touches[0].clientY, moved: 0 };
      select(touch.i);
    }, { passive: true });
    el.addEventListener("touchmove", (e) => {
      if (!cur || !touch) return;
      const step = C().swipePx || 26, dy = e.touches[0].clientY - touch.y;
      if (Math.abs(dy) >= step) { turn(dy < 0 ? 1 : -1); touch.y = e.touches[0].clientY; touch.moved++; }
      if (e.cancelable) e.preventDefault();
    }, { passive: false });
    el.addEventListener("touchend", () => { touch = null; }, { passive: true });
    return el;
  }
  const keysKey = () => { const I = G.Input; return I.padActive ? "story.lock.keysPad" : I.mode === "touch" ? "story.lock.keysTouch" : "story.lock.keys"; };
  // the whole window, as it opens
  function render() {
    if (!cur || !el) return;
    const L = cur, D = G.StoryDialogue, v = G.Story ? G.Story.vars() : {};
    const keys = keysKey();
    const text = L.clue && D ? D.en(L.clue, v) : "";
    const wheels = L.letters.map((k, i) => {
      const m = L.marks ? (L.marks[i] ? " ok" : " bad") : "";
      return `<div class="sl-wheel${i === L.sel ? " sel" : ""}${m}" data-act="wheel" data-i="${i}">`
        + `<button class="sl-arrow" data-act="up" data-i="${i}" aria-label="${esc(T("story.lock.up"))}">▲</button>`
        + `<span class="sl-prev">${ABC[(k + 25) % 26]}</span><span class="sl-cur">${ABC[k]}</span><span class="sl-next">${ABC[(k + 1) % 26]}</span>`
        + `<button class="sl-arrow" data-act="down" data-i="${i}" aria-label="${esc(T("story.lock.down"))}">▼</button></div>`;
    }).join("");
    el.innerHTML = `<div class="sl-head">${esc(T("story.lock.title"))}</div>`
      + (text ? `<div class="sl-clue"><p class="sl-en">${esc(text)}</p>${D.subHtml(L.clue, v, text, "sl-sub")}</div>` : "")
      + `<div class="sl-wheels">${wheels}</div>`
      + `<div class="sl-msg${L.msgCls ? " " + L.msgCls : ""}">${esc(L.msg ? T(L.msg) : "")}</div>`
      + `<div class="sl-btns"><button class="btn" data-act="back">${esc(T("story.lock.back"))}</button><button class="btn btn-primary" data-act="try">${esc(T("story.lock.try"))}</button></div>`
      + `<div class="sl-keys">${esc(T(keys))}</div>`;
  }
  // a wheel turned or chosen, a try: the same elements, their letters and marks changed -- the
  // window is never rebuilt under a finger (a swipe's touchmove goes to the element it began on:
  // rebuilt, that one is gone and the swipe with it)
  function refresh() {
    if (!cur || !el) return;
    const L = cur, ws = el.querySelectorAll(".sl-wheel");
    if (ws.length !== L.letters.length) { render(); return; }
    ws.forEach((w, i) => {
      const k = L.letters[i], m = L.marks ? (L.marks[i] ? "ok" : "bad") : "";
      w.classList.toggle("sel", i === L.sel); w.classList.toggle("ok", m === "ok"); w.classList.toggle("bad", m === "bad");
      w.querySelector(".sl-prev").textContent = ABC[(k + 25) % 26];
      w.querySelector(".sl-cur").textContent = ABC[k];
      w.querySelector(".sl-next").textContent = ABC[(k + 1) % 26];
    });
    const msg = el.querySelector(".sl-msg");
    if (msg) { msg.className = "sl-msg" + (L.msgCls ? " " + L.msgCls : ""); msg.textContent = L.msg ? T(L.msg) : ""; }
    const keys = el.querySelector(".sl-keys");
    if (keys) keys.textContent = T(keysKey());
  }
  function open(id) {
    const L = locks[id], game = G.Game;
    if (!L || L.solved || !game) return;
    ensure();
    cur = L; L.msg = null; L.msgCls = "";
    hp0 = game.player ? game.player.hp : 0;
    mouseX = 0; touch = null; pad = { t: 0, dir: 0 };
    flag("lockopen:" + L.id);
    if (!wheelBound) { wheelBound = true; document.addEventListener("wheel", onWheel, { passive: false }); document.addEventListener("mousemove", onMouse); }
    document.body.classList.add("story-lock-open");
    el.classList.remove("hidden");
    render();
    if (G.Audio && G.Audio.sfx) G.Audio.sfx("tick");
  }
  // stepped back (the letters as they are); `why`: "fight" -- a zombie, a hit -- says so
  function close(why) {
    if (!cur) return;
    cur = null; touch = null;
    document.body.classList.remove("story-lock-open");
    if (el) el.classList.add("hidden");
    if (why === "fight" && G.StoryScreen) G.StoryScreen.setHint("story.hint.lockFight");
  }
  function select(i) {
    if (!cur) return;
    const n = cur.answer.length;
    cur.sel = ((i % n) + n) % n;
    refresh();
  }
  function turn(d) {
    if (!cur) return;
    const i = cur.sel;
    cur.letters[i] = (cur.letters[i] + d + 26) % 26;
    cur.marks = null; cur.msg = null; cur.msgCls = "";
    paint(cur); refresh();
    if (G.Audio && G.Audio.sfx) G.Audio.sfx("tick");
  }
  // the word as set: the first try is the bank word's spelling (its box, its card); every try
  // marks the letters
  function tryWord() {
    if (!cur) return;
    const L = cur, typed = L.letters.map((k) => ABC[k]).join(""), right = typed === L.answer;
    const e = L.word && G.WordBank ? G.WordBank.byId(L.word) : null, pair = e ? G.WordBank.pairOf(e) : null;
    if (pair && !L.counted) {
      L.counted = true;
      G.Learning.answerWord(pair, right, { recall: true, typed: right ? null : typed.toLowerCase(), skills: G.Learning.skillsFor("definition", "spell") });
    }
    if (pair && G.Explain && G.ExplainCard) {
      const ex = G.Explain.build({ pair, right, clue: "definition", answer: "spell", typed: right ? null : typed.toLowerCase() });
      if (ex) G.ExplainCard.show(ex);
    }
    if (right) {
      L.solved = true; L.marks = L.letters.map(() => true); L.msg = "story.lock.right"; L.msgCls = "ok";
      flag("lock:" + L.id);
      paint(L); refresh();
      const M = G.Game.world && G.Game.world.storyMap;
      if (L.door && M && M.door) M.door(L.door, true);
      if (G.Audio && G.Audio.sfx) G.Audio.sfx("unlock");
      if (G.StoryScreen) G.StoryScreen.sound("door");
      if (G.StoryUse) G.StoryUse.remove(G.Game, "lock:" + L.id);
      closeT = C().solvedSec || 0.9;
      return;
    }
    L.wrong++;
    flag("lockwrong:" + L.id + ":" + L.wrong);
    L.marks = L.letters.map((k, i) => ABC[k] === L.answer[i]);
    L.msg = "story.lock.wrong"; L.msgCls = "bad";
    refresh();
    if (G.Audio && G.Audio.sfx) G.Audio.sfx("deny");
  }

  // ---------------- input ----------------
  function onKey(e) {
    if (!cur) return false;
    const c = e.code;
    if (c === "KeyA" || c === "ArrowLeft") { select(cur.sel - 1); return true; }
    if (c === "KeyD" || c === "ArrowRight") { select(cur.sel + 1); return true; }
    if (c === "KeyW" || c === "ArrowUp") { turn(1); return true; }
    if (c === "KeyS" || c === "ArrowDown") { turn(-1); return true; }
    if (c === "Enter" || c === "NumpadEnter" || c === "Space") { if (!e.repeat) tryWord(); return true; }
    const kb = G.save.settings.keybinds;
    if (c === kb.interact || c === "KeyQ" || c === "Backspace") { if (!e.repeat) close(); return true; }
    if (c === "Escape" || c === kb.pause) { close(); return false; }   // (the game's own pause goes on)
    return true;                                    // (nothing else while at the lock: no reload, no slot)
  }
  function onWheel(e) {
    if (!cur) return;
    if (e.cancelable) e.preventDefault();
    if (Math.abs(e.deltaY) < 1) return;
    turn(e.deltaY < 0 ? 1 : -1);
  }
  function onMouse(e) {
    if (!cur || !G.Input.pointerLocked) return;
    mouseX += e.movementX || 0;
    const step = C().mousePx || 90;
    if (Math.abs(mouseX) >= step) { select(cur.sel + (mouseX > 0 ? 1 : -1)); mouseX = 0; }
  }
  function padInput(gp, now, edge, dt) {
    if (!cur) return false;
    const B = G.Pad ? G.Pad.B : { A: 0, B: 1, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 };
    if (edge(B.LEFT)) select(cur.sel - 1);
    if (edge(B.RIGHT)) select(cur.sel + 1);
    // up and down: once, then on and on while held
    const dir = now[B.UP] ? 1 : now[B.DOWN] ? -1 : 0;
    if (dir && dir !== pad.dir) { turn(dir); pad.t = C().padDelay || 0.38; }
    else if (dir) { pad.t -= dt; if (pad.t <= 0) { turn(dir); pad.t = C().padRepeat || 0.12; } }
    pad.dir = dir;
    if (edge(B.A)) tryWord();
    if (edge(B.B)) close();
    return true;
  }
  // each frame of a chapter: a zombie near, a hit taken, a window over the world -- stepped back;
  // the right word: the door's swing seen, then away
  function update(game, dt) {
    if (closeT > 0) { closeT -= dt; if (closeT <= 0) close(); }
    if (!cur || !game || !game.player) return;
    const p = game.yawObject.position, r = C().breakDist || 4.5;
    const near = game.zombies.some((z) => z.alive && z.mesh && Math.hypot(z.mesh.position.x - p.x, z.mesh.position.z - p.z) < r && Math.abs(z.mesh.position.y - (p.y - 1.7)) < 2);
    if (!cur.solved && (near || game.player.hp < hp0)) { close("fight"); return; }
    if (G.Modal.isOpen() || game.state !== "GAMEPLAY") { close(); return; }
    // (walked off? -- a cut, a fall)
    const at = cur.at || {};
    if (Math.hypot((at.x || 0) - p.x, (at.z || 0) - p.z) > (C().leaveDist || 3.5)) close();
  }
  function reset(game) {
    Object.keys(locks).forEach((id) => remove(game, id));
    locks = {}; cur = null; closeT = 0;
    document.body.classList.remove("story-lock-open");
    if (el) el.classList.add("hidden");
  }
  function info(id) {
    const L = locks[id];
    return L ? { letters: L.letters.map((k) => ABC[k]).join(""), sel: L.sel, wrong: L.wrong, solved: L.solved, counted: L.counted, marks: L.marks ? L.marks.slice() : null } : null;
  }

  return { add, remove, open, close, onKey, padInput, update, reset, info, holds: () => !!cur, get open() { return cur ? cur.id : null; }, ids: () => Object.keys(locks) };
})();
