// ===================================================================
// Things chosen by what their labels say (story series, round 7)
// -------------------------------------------------------------------
// The design's 1-4: the nurse's medicine cabinet -- six boxes, their labels in
// English; Kru Min's message says which three to bring (bandage, antiseptic,
// gauze); a wrong one is not taken, and a card says what it is. Reading only:
// no doses, no how-to (the design's note).
//   ["pick", { id, at, size, lift, prompt, icon, title, line, items: [word, ...], want: [word, ...] }]
//       a use point; used: the cabinet's window (G.Modal, the world held) with its boxes --
//       a click or a tap, 1-6, the arrow keys and Enter, the controller's D-pad and A (its
//       window navigation, js/gamepad.js), B / Esc / the interaction key to step back (what
//       was taken is kept). A right one: "picked:<id>:<word>", ticked on the list; all of them:
//       "pick:<id>" (a scene waits { picked: id }), and the window closes. A wrong one:
//       "pickwrong:<id>:<n>", not taken, and the card -- what it is, in the meaning language and
//       in English (the chapter's practice words, js/data/story/ch1words.js) -- and the list again.
//       `line`: the message the list is (a key: its English, subtitled as a line is)
//   G.StoryPick.holds() / reset(game) / info(id) / choose(i) / close()
// ===================================================================
window.G = window.G || {};

G.StoryPick = (function () {
  const T = (k, v) => G.T(k, v);
  const C = () => (G.CONFIG.story && G.CONFIG.story.pick) || {};
  const esc = (s) => G.escapeHtml(String(s == null ? "" : s));
  const COLORS = ["#3f9d63", "#3d6fb8", "#d9822b", "#3d6fb8", "#d9822b", "#3f9d63"];   // (the cabinet's own boxes: js/story/voxelprops.js medCabinet)
  let el = null, cur = null, defs = {}, state = {}, focus = 0, closeT = 0;
  const run = () => G.Story && G.Story.run;
  const flag = (f) => { const r = run(); if (r) r.flags.add(f); };
  const en = (k) => (G.STRINGS.en[k] != null ? G.STRINGS.en[k] : T(k));

  // a scene's ["pick", { ... }]: the use point that opens it
  function add(game, o) {
    if (!o || !o.id) return;
    defs[o.id] = o;
    state[o.id] = state[o.id] || { taken: [], wrong: [], n: 0, done: false };
    G.StoryUse.add(game, { id: "pick:" + o.id, at: o.at, size: o.size || [1.2, 1.8, 0.6], lift: o.lift != null ? o.lift : 0.95,
      prompt: o.prompt || "story.use.cabinet", sound: "", onUse: () => open(o.id) });
  }
  function practice(w) { const r = run(); return (r && r.ch && r.ch.practice && r.ch.practice[w]) || null; }
  const gloss = (w) => (G.StoryQuiz ? G.StoryQuiz.glossOf(practice(w)) : "") || "";

  function ensure() {
    if (el) return el;
    el = document.createElement("div");
    el.id = "story-pick-box"; el.className = "story-pick hidden";
    el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true");
    document.body.appendChild(el);
    el.addEventListener("click", (e) => {
      const b = e.target.closest(".spk-box");
      if (b && !b.disabled) { choose(+b.dataset.i); return; }
      if (e.target.closest(".spk-close")) close();
    });
    return el;
  }
  function open(id) {
    const o = defs[id], s = state[id];
    if (!o || !s || s.done) return;
    cur = id; focus = 0; clearTimeout(closeT);
    ensure();
    if (!G.Modal.isOpen("story-pick")) G.Modal.open("story-pick", { freeze: true, keys });
    el.classList.remove("hidden");
    render(null);
    if (G.Audio && G.Audio.sfx) G.Audio.sfx("click");
    if (G.Input.mode !== "touch") setTimeout(() => focusBox(firstFree()), 0);
  }
  function firstFree() { const o = defs[cur], s = state[cur]; return Math.max(0, o.items.findIndex((w) => !s.taken.includes(w) && !s.wrong.includes(w))); }
  function render(card) {
    const o = defs[cur], s = state[cur], D = G.StoryDialogue, v = G.Story.vars();
    if (!o || !el) return;
    const want = o.want || [];
    let list = "";
    if (o.line && D) {
      if (D.ensure) D.ensure();
      const text = D.en(o.line, v);
      list = `<div class="spk-line"><span class="spk-who">${esc(T("story.who." + (o.who || "min")))}</span><p class="spk-en">${D.mark(text)}</p>${D.subHtml(o.line, v, text, "spk-sub")}</div>`;
    }
    const ticks = `<ul class="spk-want">${want.map((w) => `<li class="${s.taken.includes(w) ? "on" : ""}"><span class="spk-tick" aria-hidden="true">${s.taken.includes(w) ? "☑" : "☐"}</span> <span lang="en">${esc(w)}</span></li>`).join("")}</ul>`;
    const boxes = o.items.map((w, i) => {
      const taken = s.taken.includes(w), wrong = s.wrong.includes(w);
      return `<button type="button" class="spk-box${taken ? " taken" : ""}${wrong ? " wrong" : ""}" data-i="${i}" ${taken || wrong ? "disabled" : ""} aria-label="${esc(w)}">
        <span class="spk-n kbd-only">${i + 1}</span><span class="spk-pack" style="--c:${COLORS[i % COLORS.length]}"></span><span class="spk-label" lang="en">${esc(w.toUpperCase())}</span>
        <span class="spk-mark" aria-hidden="true">${taken ? "✓" : wrong ? "✗" : ""}</span></button>`;
    }).join("");
    const kb = G.save.settings.keybinds, key = G.Input.padActive ? "B" : G.keyLabel(kb.interact);
    el.innerHTML = `<div class="spk-head"><span class="spk-icon" aria-hidden="true">${esc(o.icon || "💊")}</span><h3>${esc(T(o.title || "story.pick.title"))}</h3></div>
      ${list}${ticks}<div class="spk-grid">${boxes}</div>
      <div class="spk-card${card ? "" : " hidden"}" role="status">${card || ""}</div>
      <div class="spk-foot"><span class="spk-keys">${esc(T(G.Input.padActive ? "story.pick.keysPad" : G.Input.mode === "touch" ? "story.pick.keysTouch" : "story.pick.keys"))}</span>
      <button type="button" class="btn spk-close" data-pad-back>${esc(T("story.pick.close"))}${G.Input.mode === "touch" ? "" : ` <span class="dlg-key">(${esc(key)})</span>`}</button></div>`;
  }
  // what a wrong one is: its meaning, in the meaning language and in English; the list again
  function cardHtml(w) {
    const p = practice(w), g = gloss(w), o = defs[cur];
    return `<span class="xc-x">✗ <b lang="en">${esc(w)}</b>${g ? ` = <span>${esc(g)}</span>` : ""}</span>` +
      (p && p.en ? `<span class="spk-def" lang="en">${esc(p.en)}</span>` : "") +
      `<span class="spk-not">${esc(T("story.pick.notList", { list: (o.want || []).join(", ") }))}</span>`;
  }
  function choose(i) {
    const o = defs[cur], s = state[cur];
    if (!o || !s || s.done) return;
    const w = o.items[i];
    if (w == null || s.taken.includes(w) || s.wrong.includes(w)) return;
    if ((o.want || []).includes(w)) {
      s.taken.push(w);
      flag("picked:" + cur + ":" + w);
      if (G.Audio && G.Audio.sfx) G.Audio.sfx("pickup");
      if ((o.want || []).every((x) => s.taken.includes(x))) {
        s.done = true;
        flag("pick:" + cur);
        render(`<span class="xc-y">✓ ${esc(T("story.pick.done"))}</span>`);
        if (G.StoryUse) G.StoryUse.remove(G.Game, "pick:" + cur);
        // (a moment on "All three", then gone: the window's own clock -- the world is held while it is open)
        const was = cur;
        clearTimeout(closeT);
        closeT = setTimeout(() => { if (cur === was) close(); }, (C().doneSec || 1.1) * 1000);
        return;
      }
      render(`<span class="xc-y">✓ <b lang="en">${esc(w)}</b>${gloss(w) ? ` = ${esc(gloss(w))}` : ""}</span>`);
    } else {
      s.wrong.push(w); s.n++;
      flag("pickwrong:" + cur + ":" + s.n);
      if (G.Audio && G.Audio.sfx) G.Audio.sfx("wrong");
      render(cardHtml(w));
      const b = el.querySelector(`.spk-box[data-i="${i}"]`);
      if (b) { b.classList.add("shake"); }
    }
    if (G.Input.mode !== "touch") focusBox(firstFree());
  }
  function focusBox(i) {
    if (!el) return;
    const bs = Array.from(el.querySelectorAll(".spk-box"));
    if (!bs.length) return;
    focus = Math.max(0, Math.min(bs.length - 1, i));
    const b = bs[focus];
    if (b && !b.disabled && b.focus) b.focus({ preventScroll: true });
  }
  function move(d) {
    const o = defs[cur], s = state[cur];
    if (!o) return;
    const n = o.items.length;
    for (let k = 1; k <= n; k++) {
      const i = (focus + d * k + n * 4) % n, w = o.items[i];
      if (!s.taken.includes(w) && !s.wrong.includes(w)) { focusBox(i); return; }
    }
  }
  function keys(e) {
    if (!cur) return false;
    const kb = G.save.settings.keybinds, c = e.code;
    const m = /^(?:Digit|Numpad)([1-9])$/.exec(c);
    if (m) { choose(+m[1] - 1); return true; }
    if (c === "ArrowRight" || c === kb.right || c === "KeyD") { move(1); return true; }
    if (c === "ArrowLeft" || c === kb.left || c === "KeyA") { move(-1); return true; }
    if (c === "ArrowDown" || c === kb.back || c === "KeyS") { move(3); return true; }
    if (c === "ArrowUp" || c === kb.forward || c === "KeyW") { move(-3); return true; }
    if (c === "Enter" || c === "NumpadEnter" || c === "Space") {
      const a = document.activeElement;
      if (a && a.classList && a.classList.contains("spk-box")) choose(+a.dataset.i);
      else if (a && a.classList && a.classList.contains("spk-close")) close();
      else choose(focus);
      return true;
    }
    if (c === "Escape" || c === kb.interact || c === "KeyQ" || c === "Backspace") { close(); return true; }
    return true;
  }
  function close() {
    if (el) el.classList.add("hidden");
    if (G.Modal.isOpen("story-pick")) G.Modal.close("story-pick");
    cur = null; clearTimeout(closeT);
  }
  function reset() {
    close();
    defs = {}; state = {};
  }
  function info(id) { const s = state[id]; return s ? { open: cur === id, taken: s.taken.slice(), wrong: s.wrong.slice(), n: s.n, done: s.done } : null; }

  return { add, open, choose, close, reset, info, holds: () => !!cur, keys };
})();
