// ===================================================================
// The PA: a scrambled announcement put right, read out, and held (story series, round 9)
// -------------------------------------------------------------------
// The design's 1-6. The school's "Smart PA -- powered by NeuroLex" has an
// assistant that writes; it broke, and the words in the draft with it. The
// player puts three of them right, each from a pair that are easily mixed up
// (the game's Context mode: a gap in a sentence), then Kru Min reads it out;
// it repeats on a loop, and the loop draws them in.
//   ["pa", { id, at, size, lift, prompt, title, who, line, text, gaps: [{ options: [a, b], right, line, cap }] }]
//       a use point; used: the desk's window (G.Modal, the world held): the draft (`text`: a key, its gaps
//       {1} {2} {3}), one gap at a time, two words to choose from -- 1 and 2, the arrow keys and Enter, a
//       click or a tap, the controller. Right: it goes in. Wrong: a card -- what that word means -- and a line of
//       Kru Min's (the gap's `line`), and the choice again at once. All in: the flag "pa:<id>".
//       A word the Master Word Bank has counts as any other answer (its first choice only:
//       G.Learning.answerWord, the cloze kind); the others are the chapter's practice words
//       (js/data/story/ch1words.js), counted nowhere.
//   ["announce", { who, lines: [key, ...], sec }]   the announcement over the PA once: its two notes, the caption
//       (js/story/whisper.js), the device's voice
//   ["hold", { id, sec, every, key, who, lines }]   a place held: a countdown, the announcement every `every`
//       seconds -- the flags "hold:<id>:<n>" at each (a scene's rules send who comes) -- and "hold:<id>" at
//       the end. It stands still while the one who is looked after is down (js/story/escort.js): nobody is at
//       the desk. ["hold", null] ends it.
//   conditions { pa: id } · { held: id } · { heldN: [id, n] }                (js/story/scenes.js)
//   G.StoryPA.holds() / reset(game) / update(game, dt) / info(id) / choose(i) / close()
// ===================================================================
window.G = window.G || {};

G.StoryPA = (function () {
  const T = (k, v) => G.T(k, v);
  const C = () => (G.CONFIG.story && G.CONFIG.story.pa) || {};
  const esc = (s) => G.escapeHtml(String(s == null ? "" : s));
  const run = () => G.Story && G.Story.run;
  const flag = (f) => { const r = run(); if (r) r.flags.add(f); };
  const cap = (w) => w.charAt(0).toUpperCase() + w.slice(1);
  let el = null, cur = null, defs = {}, state = {}, focus = 0, closeT = 0, held = null;

  // ---------------- the draft ----------------
  function add(game, o) {
    if (!o || !o.id) return;
    defs[o.id] = o;
    state[o.id] = state[o.id] || { gap: 0, wrong: [], tries: [], done: false };
    G.StoryUse.add(game, { id: "pa:" + o.id, at: o.at, size: o.size || [1.7, 1.3, 0.9], lift: o.lift != null ? o.lift : 0.8,
      prompt: o.prompt || "story.use.pa", sound: "", onUse: () => open(o.id) });
  }
  const practice = (w) => { const r = run(); return (r && r.ch && r.ch.practice && r.ch.practice[w]) || null; };
  const entry = (w) => (G.WordBank ? G.WordBank.byId(w) || (G.WordBank.familyOf ? G.WordBank.familyOf(w) : null) : null);
  // what a word means, in the player's meaning language: the bank's, or the chapter's own draft
  function gloss(w) {
    const e = entry(w), p = e ? G.WordBank.pairOf(e) : null;
    if (p && p[1]) return p[1];
    return (G.StoryQuiz ? G.StoryQuiz.glossOf(practice(w)) : "") || "";
  }
  function ensure() {
    if (el) return el;
    el = document.createElement("div");
    el.id = "story-pa-box"; el.className = "story-pa hidden";
    el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); el.setAttribute("aria-labelledby", "spa-title");
    document.body.appendChild(el);
    el.addEventListener("click", (e) => {
      const b = e.target.closest(".spa-opt");
      if (b && !b.disabled) { choose(+b.dataset.i); return; }
      const w = e.target.closest(".sd-word");
      if (w) { const en = G.WordBank && G.WordBank.byId(w.dataset.id); if (en && G.VocabCard) G.VocabCard.peek(G.WordBank.pairOf(en), w.dataset.form, { freeze: true }); return; }
      if (e.target.closest(".spa-close")) close();
    });
    return el;
  }
  function open(id) {
    const o = defs[id], s = state[id];
    if (!o || !s || s.done) return;
    cur = id; focus = 0; clearTimeout(closeT);
    ensure();
    if (G.StoryDialogue) G.StoryDialogue.clear();           // (her line is in the window: not said again after it)
    if (!G.Modal.isOpen("story-pa")) G.Modal.open("story-pa", { freeze: true, keys });
    el.classList.remove("hidden");
    render(null);
    if (G.Audio && G.Audio.sfx) G.Audio.sfx("click");
    if (G.Input.mode !== "touch") setTimeout(() => focusOpt(firstFree()), 0);
  }
  // the draft as it stands: the gaps filled so far, the one being chosen lit, the rest still garbled
  function draftHtml(o, s) {
    const text = (G.STRINGS.en[o.text] != null ? G.STRINGS.en[o.text] : o.text), D = G.StoryDialogue;
    return text.split(/(\{\d\})/).map((part) => {
      const m = /^\{(\d)\}$/.exec(part);
      if (!m) return D ? D.mark(part) : esc(part);
      const i = +m[1] - 1, g = o.gaps[i];
      if (!g) return "";
      const w = (x) => (g.cap ? cap(x) : x);
      if (i < s.gap || s.done) return `<b class="spa-in" lang="en">${esc(w(g.right))}</b>`;
      if (i === s.gap) return `<span class="spa-gap on" aria-label="${esc(T("story.pa.gap", { n: i + 1 }))}">${i + 1} ▢▢▢▢</span>`;
      return `<span class="spa-gap">${i + 1} ░▒░▒</span>`;
    }).join("");
  }
  function render(card) {
    const o = defs[cur], s = state[cur], D = G.StoryDialogue, v = G.Story.vars();
    if (!o || !el) return;
    let line = "";
    if (o.line && D) {
      if (D.ensure) D.ensure();
      const text = D.en(o.line, v);
      line = `<div class="spk-line"><span class="spk-who">${esc(T("story.who." + (o.who || "min")))}</span><p class="spk-en">${D.mark(text)}</p>${D.subHtml(o.line, v, text, "spk-sub")}</div>`;
    }
    const g = o.gaps[s.gap];
    const opts = !g || s.done ? "" : `<div class="spa-opts" role="group" aria-label="${esc(T("story.pa.gap", { n: s.gap + 1 }))}">` + g.options.map((w, i) => {
      const wrong = s.wrong.includes(s.gap + ":" + w);
      return `<button type="button" class="spa-opt${wrong ? " wrong" : ""}" data-i="${i}" ${wrong ? "disabled" : ""}><span class="spk-n kbd-only">${i + 1}</span><span lang="en">${esc(g.cap ? cap(w) : w)}</span><span class="spk-mark" aria-hidden="true">${wrong ? "✗" : ""}</span></button>`;
    }).join("") + `</div>`;
    const kb = G.save.settings.keybinds, key = G.Input.padActive ? "B" : G.keyLabel(kb.interact);
    el.classList.toggle("has-card", !!card);               // (a short screen: her line makes room for the card)
    el.innerHTML = `<div class="spa-head"><span class="spa-brand">SMART PA</span><span class="spa-by">${esc(T("story.pa.by"))}</span><span class="spa-state${s.done ? " ok" : ""}">${esc(T(s.done ? "story.pa.ready" : "story.pa.error"))}</span></div>
      <h3 id="spa-title" class="spa-title">${esc(T(o.title || "story.pa.title"))}</h3>
      ${line}<p class="spa-draft" lang="en">${draftHtml(o, s)}</p>${opts}
      <div class="spk-card spa-card${card ? "" : " hidden"}" role="status">${card || ""}</div>
      <div class="spk-foot"><span class="spk-keys">${esc(T(G.Input.padActive ? "story.pa.keysPad" : G.Input.mode === "touch" ? "story.pa.keysTouch" : "story.pa.keys"))}</span>
      <button type="button" class="btn spa-close" data-pad-back>${esc(T("story.pa.close"))}${G.Input.mode === "touch" ? "" : ` <span class="dlg-key">(${esc(key)})</span>`}</button></div>`;
  }
  // a wrong one: what it means, and Kru Min's word on the two
  function wrongHtml(g, w) {
    const D = G.StoryDialogue, v = G.Story.vars(), gl = gloss(w), o = defs[cur];
    let line = "";
    if (g.line && D) { const text = D.en(g.line, v); line = `<span class="spa-teach"><b class="spk-who">${esc(T("story.who." + (o.who || "min")))}</b> ${D.mark(text)}${D.subHtml(g.line, v, text, "spk-sub")}</span>`; }
    return `<span class="xc-x">✗ <b lang="en">${esc(w)}</b>${gl ? ` = <span>${esc(gl)}</span>` : ""}</span>${line}`;
  }
  // an answer for a word the bank has: a cloze, recognised -- as any other (the first choice of a gap only)
  function count(g, i, right) {
    const s = state[cur];
    if (s.tries[i]) return;
    s.tries[i] = true;
    const e = entry(g.right);
    if (!e || !G.Learning || !G.Learning.answerWord) return;
    G.Learning.answerWord(G.WordBank.pairOf(e), right, { recall: G.Learn.isRecall("cloze", "shoot"), skills: G.Learning.skillsFor("cloze", "shoot") });
  }
  function choose(i) {
    const o = defs[cur], s = state[cur];
    if (!o || !s || s.done) return;
    const g = o.gaps[s.gap];
    if (!g) return;
    const w = g.options[i];
    if (w == null || s.wrong.includes(s.gap + ":" + w)) return;
    const right = w === g.right;
    count(g, s.gap, right);
    if (!right) {
      s.wrong.push(s.gap + ":" + w);
      flag("pawrong:" + cur + ":" + s.wrong.length);
      if (G.Audio && G.Audio.sfx) G.Audio.sfx("wrong");
      render(wrongHtml(g, w));
      const b = el.querySelector(`.spa-opt[data-i="${i}"]`);
      if (b) b.classList.add("shake");
      if (G.Input.mode !== "touch") focusOpt(firstFree());
      return;
    }
    const gl = gloss(w);
    s.gap++;
    if (G.Audio && G.Audio.sfx) G.Audio.sfx("correct");
    if (s.gap >= o.gaps.length) {
      s.done = true;
      flag("pa:" + cur);
      render(`<span class="xc-y">✓ ${esc(T("story.pa.done"))}</span>`);
      if (G.StoryUse) G.StoryUse.remove(G.Game, "pa:" + cur);
      // (a moment on the whole of it, then gone: the window's own clock -- the world is held while it is open)
      const was = cur;
      clearTimeout(closeT);
      closeT = setTimeout(() => { if (cur === was) close(); }, (C().doneSec || 1.8) * 1000);
      return;
    }
    render(`<span class="xc-y">✓ <b lang="en">${esc(w)}</b>${gl ? ` = ${esc(gl)}` : ""}</span>`);
    if (G.Input.mode !== "touch") focusOpt(firstFree());
  }
  function firstFree() { const o = defs[cur], s = state[cur], g = o && o.gaps[s.gap]; return g ? Math.max(0, g.options.findIndex((w) => !s.wrong.includes(s.gap + ":" + w))) : 0; }
  function focusOpt(i) {
    if (!el) return;
    const bs = Array.from(el.querySelectorAll(".spa-opt"));
    if (!bs.length) return;
    focus = Math.max(0, Math.min(bs.length - 1, i));
    const b = bs[focus];
    if (b && !b.disabled && b.focus) b.focus({ preventScroll: true });
  }
  function move(d) {
    const o = defs[cur], s = state[cur], g = o && o.gaps[s.gap];
    if (!g) return;
    const n = g.options.length;
    for (let k = 1; k <= n; k++) {
      const i = (focus + d * k + n * 4) % n;
      if (!s.wrong.includes(s.gap + ":" + g.options[i])) { focusOpt(i); return; }
    }
  }
  function keys(e) {
    if (!cur) return false;
    const kb = G.save.settings.keybinds, c = e.code;
    if (e.repeat && !/^Arrow/.test(c)) return true;         // (a key held: one answer, not the next gap's too)
    const m = /^(?:Digit|Numpad)([1-9])$/.exec(c);
    if (m) { choose(+m[1] - 1); return true; }
    if (c === "ArrowRight" || c === "ArrowDown" || c === kb.right || c === kb.back || c === "KeyD" || c === "KeyS") { move(1); return true; }
    if (c === "ArrowLeft" || c === "ArrowUp" || c === kb.left || c === kb.forward || c === "KeyA" || c === "KeyW") { move(-1); return true; }
    if (c === "Enter" || c === "NumpadEnter" || c === "Space") {
      const a = document.activeElement;
      if (a && a.classList && a.classList.contains("spa-opt")) choose(+a.dataset.i);
      else if (a && a.classList && a.classList.contains("spa-close")) close();
      else choose(focus);
      return true;
    }
    if (c === "Escape" || c === kb.interact || c === "KeyQ" || c === "Backspace") { close(); return true; }
    return true;
  }
  function close() {
    if (el) el.classList.add("hidden");
    if (G.Modal.isOpen("story-pa")) G.Modal.close("story-pa");
    cur = null; clearTimeout(closeT);
  }

  // ---------------- read out, on its loop ----------------
  // the whole announcement once: the PA's two notes, then the voice and the caption (the zombies' whispers
  // wait for it: js/story/whisper.js)
  function announce(o) {
    o = o || {};
    const D = G.StoryDialogue, v = G.Story.vars(), text = [].concat(o.lines || []).map((k) => (D ? D.en(k, v) : k)).join(" ");
    if (!text) return;
    if (G.StoryScreen) G.StoryScreen.sound("chime");
    if (G.StoryWhisper) G.StoryWhisper.show("📢 " + text, o.sec || C().captionSec || 6, "pa");
    voice = { text, t: 0 };                        // (read aloud a moment after its two notes: update, below)
    announced++;
    if (G.Bus) G.Bus.emit("story:announce", { n: announced });
  }
  let announced = 0, voice = null;
  // the voice: not over a line being said or a word the player asked to hear -- as soon as they are done, or not at all
  function tickVoice(dt) {
    if (!voice) return;
    voice.t += dt;
    if (voice.t > (C().voiceLate || 5)) { voice = null; return; }
    // (a word asked for in the last few seconds and still being said: some browsers say "speaking" for good)
    const word = window.speechSynthesis && speechSynthesis.speaking && performance.now() - ((G.Audio && G.Audio._spokenAt) || -1e9) < 3500;
    if (voice.t < (C().voiceAfter || 0.8) || (G.StoryDialogue && G.StoryDialogue.busy()) || word) return;
    if (G.Audio && G.Audio.speak) G.Audio.speak(voice.text, { text: true, lang: "en" });
    voice = null;
  }
  // ---------------- a place held ----------------
  function hold(game, o) {
    if (!o) { held = null; if (G.StoryScreen) G.StoryScreen.setTimer(null); return; }
    held = { id: String(o.id || "hold"), sec: o.sec || 100, every: o.every || 20, t: 0, n: 0, o, over: false };
    if (G.StoryScreen) G.StoryScreen.setTimer({ key: o.key || "story.timer.hold", sec: held.sec, corner: true });
  }
  function update(game, dt) {
    if (game.state !== "GAMEPLAY" || game.paused || (G.Modal && G.Modal.freezesWorld && G.Modal.freezesWorld())) return;
    tickVoice(dt);
    if (!held || held.over) return;
    const down = !!(G.StoryEscort && G.StoryEscort.is("down"));
    if (down !== !!held.paused) { held.paused = down; if (G.StoryScreen && G.StoryScreen.timerHold) G.StoryScreen.timerHold(down); }
    if (down) return;
    held.t += dt;
    while (held.n < Math.floor((held.sec - 0.01) / held.every) && held.t >= (held.n + 1) * held.every) {
      held.n++;
      flag("hold:" + held.id + ":" + held.n);
      announce({ lines: held.o.lines });
    }
    if (held.t >= held.sec) {
      held.over = true;
      flag("hold:" + held.id);
      if (G.StoryScreen) G.StoryScreen.setTimer(null);
    }
  }
  function reset() {
    close();
    defs = {}; state = {}; held = null; announced = 0; voice = null;
  }
  function info(id) {
    const s = state[id];
    return s ? { open: cur === id, gap: s.gap, wrong: s.wrong.slice(), done: s.done } : null;
  }

  return { add, open, choose, close, keys, announce, hold, update, reset, info, holds: () => !!cur, gloss,
    get held() { return held ? { id: held.id, t: held.t, n: held.n, sec: held.sec, every: held.every, over: held.over, paused: !!held.paused } : null; }, get announced() { return announced; } };
})();
