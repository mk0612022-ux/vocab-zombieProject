// ===================================================================
// LexiLens (story series, round 2): the exam glasses' HUD
// -------------------------------------------------------------------
// The story's reason for a HUD: the invigilator hands every candidate AR
// glasses, "so that nobody uses LEXA". Before the player puts them on there
// is no HUD at all; then it boots a part at a time (the design: the question
// box, then health and stamina, then the ammo and the zombies' words), in
// the exam system's blue -- red and jittering when the LEXA signal spikes.
//
//   G.LexiLens.parts("none" | "all" | ["word", "vitals", "ammo", "labels"])
//       which parts are on; each one that comes on boots (a flicker):
//       word    the question box (the objective, the word to shoot)
//       vitals  health and stamina
//       ammo    the slots, the gun and its magazine, the crosshair
//       labels  the words over the zombies (js/visuals.js: labelsOff)
//       With all four on, the rest of the HUD (score, mission line...) is back.
//   G.LexiLens.show(list)        some more on
//   G.LexiLens.theme(on)         the glasses' look
//   G.LexiLens.glitch(seconds)   a signal spike
//   G.LexiLens.sys(key, vars, { dur, glitch })   a line from the exam system: English (it
//       is the exam's), its subtitle at the dialogue's level (js/story/dialogue.js)
//   G.LexiLens.onCorrect()       a right shot: "CORRECT. Neural pattern disrupted." (js/game.js)
// A scene says how it starts (js/data/story/ch*.js: hud, lens); every scene after the
// prologue has the whole HUD and the glasses on, so a checkpoint keeps nothing of this.
// ===================================================================
window.G = window.G || {};

G.LexiLens = (function () {
  const PARTS = ["word", "vitals", "ammo", "labels"];
  const C = () => G.CONFIG.story.lens;
  const esc = (s) => G.escapeHtml(String(s == null ? "" : s));
  let shown = new Set(PARTS), on = false, glitchT = 0, el = null, q = [], cur = null, curT = 0, bootT = null;
  const B = () => document.body;
  const beep = (list) => { const A = G.Audio; if (!A || !A.ctx || !A.group) return; A.group({ cat: "ui", prio: 1, pos: null, dur: 0.8 }, () => list.forEach((o) => A.tone(o))); };

  function apply() {
    const b = B();
    b.dataset.lens = Array.from(shown).join(" ");
    b.classList.toggle("lens-partial", shown.size < PARTS.length);
    if (G.Visuals) G.Visuals.labelsOff = !shown.has("labels");
  }
  function parts(list, opts) {
    const want = list === "all" ? PARTS : list === "none" ? [] : [].concat(list || []).filter((p) => PARTS.includes(p));
    const added = want.filter((p) => !shown.has(p));
    shown = new Set(want);
    apply();
    if (added.length && !(opts && opts.quiet)) boot(added);
    return Array.from(shown);
  }
  function show(list) { return parts(Array.from(new Set(Array.from(shown).concat([].concat(list || []))))); }
  function boot(list) {
    const b = B();
    list.forEach((p) => { b.classList.remove("lens-boot-" + p); void b.offsetWidth; b.classList.add("lens-boot-" + p); });
    clearTimeout(bootT);
    bootT = setTimeout(() => PARTS.forEach((p) => b.classList.remove("lens-boot-" + p)), C().bootSec * 1000 + 60);
    beep([{ type: "sine", freq: 520, freqEnd: 1240, dur: 0.16, gain: 0.04 }, { type: "sine", freq: 1240, dur: 0.05, gain: 0.03, at: 0.17 }]);
  }
  function theme(v) { on = !!v; B().classList.toggle("lexilens", on); }
  function glitch(sec) {
    glitchT = Math.max(glitchT, sec || 1.5);
    B().classList.add("lens-glitch");
    beep([{ type: "square", freq: 180, freqEnd: 90, dur: 0.22, gain: 0.03, filter: { type: "bandpass", freq: 900, q: 2 } },
      { type: "sawtooth", freq: 1400, freqEnd: 300, dur: 0.12, gain: 0.02, at: 0.08 }]);
  }

  // ---------------- the system's lines ----------------
  function ensure() {
    if (el) return el;
    el = document.createElement("div");
    el.id = "lens-sys"; el.className = "lens-sys hidden"; el.setAttribute("role", "status"); el.setAttribute("aria-live", "polite");
    document.body.appendChild(el);
    return el;
  }
  // (a red one -- a signal spike -- cuts in at once; the others wait their turn)
  function sys(key, vars, opts) {
    const it = { key, vars, dur: (opts && opts.dur) || C().sysSec, red: !!(opts && opts.glitch) };
    if (it.red || (opts && opts.now)) { q.unshift(it); nextSys(); return; }
    q.push(it);
    if (!cur) nextSys();
  }
  function nextSys() {
    cur = q.shift() || null; curT = 0;
    ensure();
    if (!cur) { el.classList.add("hidden"); return; }
    const D = G.StoryDialogue, text = D.en(cur.key, cur.vars);
    el.classList.toggle("red", cur.red);
    el.innerHTML = `<div class="ls-line">${esc(text)}</div>${D.subHtml(cur.key, cur.vars, text, "ls-sub")}`;
    el.classList.remove("hidden");
    place();
    el.classList.remove("in"); void el.offsetWidth; el.classList.add("in");
    if (cur.red) glitch(Math.min(cur.dur, 2));
    else beep([{ type: "sine", freq: 1320, dur: 0.05, gain: 0.025 }, { type: "sine", freq: 1760, dur: 0.06, gain: 0.02, at: 0.07 }]);
  }
  // (story round 8) under whatever the top of the HUD has just now -- the word box, an answer's card, the
  // combo, a mini-boss's bar over them; with no word box, where the style sheet has it
  function place() {
    if (!el || el.classList.contains("hidden")) return;
    const top = shown.has("word") ? document.querySelector("#hud .hud-top") : null, b = top ? top.getBoundingClientRect().bottom : 0;
    const want = b > 20 ? Math.round(b + 8) + "px" : "";
    if (el.style.top !== want) el.style.top = want;
  }
  // a right shot through the glasses: the line straight away (a quick one, ahead of the queue)
  function onCorrect() {
    if (!on || !shown.has("word")) return;
    q.unshift({ key: "story.lens.correct", vars: null, dur: C().correctSec, red: false });
    nextSys();
  }
  let placeT = 0;
  function update(dt) {
    if (cur && (placeT -= dt) <= 0) { placeT = 0.1; place(); }
    if (glitchT > 0) { glitchT -= dt; if (glitchT <= 0) { glitchT = 0; B().classList.remove("lens-glitch"); } }
    // (story round 5: held -- Space, A, a finger -- the system's lines go by faster too, as the
    // lines and the scene's waits do: the queue keeps up with the scene)
    if (cur) { curT += dt * (G.StoryDialogue && G.StoryDialogue.fast ? G.StoryDialogue.fast() : 1); if (curT >= cur.dur) nextSys(); }
  }
  function reset() {
    shown = new Set(PARTS); apply();
    theme(false);
    glitchT = 0; B().classList.remove("lens-glitch");
    clearTimeout(bootT); PARTS.forEach((p) => B().classList.remove("lens-boot-" + p));
    q = []; cur = null;
    if (el) el.classList.add("hidden");
  }

  return { PARTS, parts, show, theme, glitch, sys, onCorrect, update, reset,
    get on() { return on; }, get shown() { return Array.from(shown); }, get line() { return cur; } };
})();
