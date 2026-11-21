// ===================================================================
// The practice exam through the glasses: aim at an answer (story series, round 5)
// -------------------------------------------------------------------
// The prologue's three questions come before anyone has a gun: the answers
// float in front of the candidate, the glasses' dot picks one, the trigger --
// a click, the fire button, the controller's trigger, the interaction key --
// says it. The question is in the glasses' word box (G.Story.idleMeaning /
// idleLabel); the card under it says why an answer is right or wrong
// (js/explain.js G.ExplainCard). A word the Master Word Bank has counts in
// its memory box as any answer does (G.Learning.answerWord); the chapter's
// words the bank does not have yet (docs/story/words-draft.csv) are practice.
//   ["quiz", { id, items: [{ word, clue, cloze, gloss, options: [w, w, w], answer, glosses }] }]
//       word     the answer's word (a bank id, or a practice word)
//       clue     a key of the strings: the question (the meaning) -- or gloss { th, zh, fr, en }:
//                the meaning in the player's meaning language, for a word the bank does not have
//       cloze    a key of a sentence with ___ (the question instead of the meaning)
//       glosses  { <option>: { th, zh, fr, en } } each option's meaning, for the card
//       the flag "quiz:<id>" once every one is answered (a scene waits { quiz: id })
//   G.StoryQuiz.start(game, o) / update(game, dt) / line() / label() / reset(game) / active
// ===================================================================
window.G = window.G || {};

G.StoryQuiz = (function () {
  const T = (k, v) => G.T(k, v);
  const C = () => (G.CONFIG.story && G.CONFIG.story.quiz) || {};
  let q = null, dot = null, prev = true, keyHit = false;
  const run = () => G.Story && G.Story.run;

  // a meaning in the player's meaning language: from the bank, or the chapter's own gloss
  function glossOf(g) {
    if (!g) return "";
    const ml = G.Lang && G.Lang.meaning ? G.Lang.meaning() : "th";
    return g[ml] || g.en || g.th || "";
  }
  const entryOf = (w) => (G.WordBank ? G.WordBank.byId(w) || null : null);
  function pairOf(w, gloss) {
    const e = entryOf(w);
    if (e) { const p = G.WordBank.pairOf(e); if (p) return p; }
    return [w, glossOf(gloss) || w];
  }
  // what the word box shows for an item: its meaning, or its sentence
  function question(it) {
    // (a sentence with its gap: in English, the exam's language -- translated it would give the answer away)
    if (it.cloze) return G.STRINGS.en[it.cloze] != null ? G.STRINGS.en[it.cloze] : T(it.cloze);
    if (it.clue) return T(it.clue);
    const e = entryOf(it.word);
    if (e) { const p = G.WordBank.pairOf(e); if (p) return p[1]; }
    return glossOf(it.gloss);
  }

  // ---------------- the answers in the air ----------------
  function ensureDot() {
    if (dot) return dot;
    dot = document.createElement("div");
    dot.id = "story-dot"; dot.className = "story-dot hidden";
    document.body.appendChild(dot);
    return dot;
  }
  function clearOpts() {
    if (!q) return;
    q.opts.forEach((o) => { if (o.s.parent) o.s.parent.remove(o.s); if (o.s.material.map) o.s.material.map.dispose(); o.s.material.dispose(); });
    q.opts = [];
  }
  function layOut(game) {
    clearOpts();
    const it = q.items[q.i], cam = game.camera;
    cam.updateMatrixWorld();
    const eye = new THREE.Vector3(), fwd = new THREE.Vector3();
    cam.getWorldPosition(eye); cam.getWorldDirection(fwd);
    fwd.y = 0; if (fwd.lengthSq() < 1e-6) fwd.set(0, 0, -1); fwd.normalize();
    const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
    const D = C().dist || 1.9, gap = C().gap || 0.82, up = C().rise || -0.05;
    it.options.forEach((w, k) => {
      const s = G.makeWordSprite(String(w), { color: "#d8f1ff" });
      s.layers.set(0);                          // (with the world: the glasses' word layer is not on yet)
      s.material.depthTest = false; s.renderOrder = 8;
      s.position.copy(eye).addScaledVector(fwd, D).addScaledVector(right, (k - (it.options.length - 1) / 2) * gap);
      s.position.y = eye.y + up;
      s.scale.set(1.25, 0.31, 1);
      game.scene.add(s);
      q.opts.push({ s, w, k, hot: false });
    });
    q.lock = C().settle || 0.35;
    if (G.Audio && G.Audio.ctx && G.Audio.group) G.Audio.group({ cat: "ui", prio: 1, pos: null, dur: 0.5 }, () => G.Audio.tone({ type: "sine", freq: 660, freqEnd: 990, dur: 0.12, gain: 0.03 }));
  }
  function start(game, o) {
    o = o || {};
    if (!o.items || !o.items.length) return;
    reset(game);
    // (the answers in an order of their own each time -- the data lists the right one first)
    const items = o.items.map((it) => {
      if (it.shuffle === false) return it;
      const idx = G.shuffle(it.options.map((_, i) => i));
      return Object.assign({}, it, { options: idx.map((i) => it.options[i]), answer: idx.indexOf(it.answer) });
    });
    q = { id: String(o.id || "quiz"), items, i: 0, opts: [], lock: 0, wait: 0, hot: -1, right: 0, results: [] };
    ensureDot().classList.remove("hidden");
    document.body.classList.add("story-quiz");                       // (touch: the trigger shown for it, css)
    prev = true; keyHit = false;
    layOut(game);
  }
  // the option the dot is on: the nearest to the view's centre, within `aim` radians
  function aimed(game) {
    const cam = game.camera, eye = new THREE.Vector3(), fwd = new THREE.Vector3(), v = new THREE.Vector3();
    cam.getWorldPosition(eye); cam.getWorldDirection(fwd);
    let best = -1, bd = C().aim || 0.2;
    q.opts.forEach((o, i) => { v.copy(o.s.position).sub(eye).normalize(); const a = Math.acos(Math.max(-1, Math.min(1, v.dot(fwd)))); if (a < bd) { bd = a; best = i; } });
    return best;
  }
  function pressed() {
    const I = G.Input;
    const now = !!((I.mode === "desktop" && I.mouseDown) || I.touchFire || I.padFire);
    const edge = (now && !prev) || keyHit;
    prev = now; keyHit = false;
    return edge;
  }
  function onKey(e) {
    if (!q || q.wait > 0) return false;
    const kb = G.save.settings.keybinds;
    if (e.code === kb.interact || e.code === "Enter" || e.code === "NumpadEnter") { if (!e.repeat) keyHit = true; return true; }
    return false;
  }
  function answer(game, k) {
    const it = q.items[q.i], right = k === it.answer;
    const wanted = pairOf(it.word, it.gloss);
    // (a word of the bank: its memory box, as every answer; the rest are practice)
    const e = entryOf(it.word);
    if (e && G.Learning) {
      const kind = it.cloze ? "cloze" : "thai";
      G.Learning.answerWord(G.WordBank.pairOf(e), right, { recall: false, skills: G.Learning.skillsFor ? G.Learning.skillsFor(kind, "shoot") : undefined });
    }
    if (G.Audio) G.Audio.sfx(right ? "correct" : "wrong");
    // the card: why
    if (G.Explain && G.ExplainCard) {
      try {
        const picked = it.options[k], pg = (it.glosses || {})[picked];
        // (a practice word has no sentences of the bank's to explain a gap with: its meaning)
        const clue = it.cloze && e ? "cloze" : "thai";
        const ex = right ? G.Explain.build({ pair: wanted, right: true, clue, answer: "shoot", form: clue === "cloze" ? it.options[it.answer] : null })
          : G.Explain.answer({ pair: wanted, right: false, clue, answer: "shoot", picked: entryOf(picked) && !pg ? G.WordBank.pairOf(entryOf(picked)) : [picked, glossOf(pg) || "?"] });
        G.ExplainCard.show(ex);
      } catch (err) { /* (a card is a nicety: an answer never fails on it) */ }
    }
    q.opts.forEach((o) => { G.updateWordSprite(o.s, o.w, o.k === it.answer ? "#7dffa8" : o.k === k ? "#ff7a8a" : "#7f8c96"); });
    q.results.push({ word: it.word, picked: it.options[k], right });
    if (right) q.right++;
    q.wait = right ? (C().nextRight || 1.4) : (C().nextWrong || 2.4);
  }
  function update(game, dt) {
    if (!q) return;
    if (q.wait > 0) {
      q.wait -= dt;
      pressed();
      if (q.wait <= 0) {
        q.i++;
        if (q.i >= q.items.length) { finish(game); return; }
        layOut(game);
      }
      return;
    }
    if (q.lock > 0) { q.lock -= dt; pressed(); return; }
    const k = aimed(game);
    if (k !== q.hot) {
      q.opts.forEach((o, i) => { const on = i === k; if (o.hot !== on) { o.hot = on; G.updateWordSprite(o.s, o.w, on ? "#ffe36b" : "#d8f1ff"); o.s.scale.set(on ? 1.42 : 1.25, on ? 0.355 : 0.31, 1); } });
      q.hot = k;
    }
    if (dot) dot.classList.toggle("on", k >= 0);
    if (pressed() && k >= 0) answer(game, k);
  }
  function finish(game) {
    const r = run();
    if (r) { r.flags.add("quiz:" + q.id); r.quizRight = (r.quizRight || 0) + q.right; }
    clearOpts();
    const last = q; q = null;
    if (dot) dot.classList.add("hidden");
    document.body.classList.remove("story-quiz");
    return last;
  }
  // the word box while it runs: the question, and which one it is
  function line() { return q ? question(q.items[Math.min(q.i, q.items.length - 1)]) : null; }
  function label() { return q ? T("story.quiz.n", { i: Math.min(q.i + 1, q.items.length), n: q.items.length }) : null; }
  function reset(game) {
    if (q) clearOpts();
    q = null;
    if (dot) dot.classList.add("hidden");
    document.body.classList.remove("story-quiz");
  }

  return { start, update, onKey, line, label, reset, glossOf, pairOf,
    get active() { return !!q; }, get state() { return q; } };
})();
