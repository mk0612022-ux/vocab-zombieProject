// ===================================================================
// The campaign's Learning Style (vocabulary series, round 4, J2)
// -------------------------------------------------------------------
// Before a level starts -- a new run or Continue -- a window asks how its
// words are asked:
//   Adaptive (the default)  each target's clue and answer by its box
//                           (js/learnmodes.js); the panel at the top says
//                           which clue it is
//   Classic                 the Thai meaning, shot (the game before the series)
//   your own                a clue x an answer
// and whether reloading asks for a word first (Spell to Reload, also in
// Settings). In the campaign every zombie carries its English word, so an
// Audio clue there is "hear the word, shoot the zombie that carries it";
// Listening with Thai labels is the Learning Modes' own. The choice is kept
// (G.save.settings.campaignStyle, .spellReload) and comes up picked next time.
// The first time a style asks a new way on this input, its short intro
// follows (G.Study.introFor). A G.Modal window: mouse, touch, keys (arrows /
// Tab, Enter, Esc) and a controller (D-pad, A, B).
// ===================================================================
window.G = window.G || {};

(function () {
  const T = (k, v) => G.T(k, v);
  const esc = (s) => G.escapeHtml(String(s));
  const $ = (id) => document.getElementById(id);

  G.CampStyle = {
    // the window's choice: adaptive | classic | custom, with its pairing
    p: null,
    styleId() { const p = this.p; return p.style === "custom" ? G.Learn.customId(p.clue, p.answer) : p.style; },

    // levelId: the level about to start; go(): start it; back(): the lobby again
    open(levelId, go, back) {
      const cur = G.save.settings.campaignStyle || "adaptive", pr = G.Learn.preset(cur);
      this.p = { style: pr.custom ? "custom" : cur, clue: pr.custom ? pr.clue : "definition", answer: pr.custom ? pr.answer : "shoot", reload: !!G.save.settings.spellReload };
      this.levelId = levelId; this.go = go; this.back = back;
      $("camp-style-title").textContent = T("camp.title", { level: G.getLevel(levelId).name });
      this.render();
      $("camp-style").classList.remove("hidden");
      $("btn-camp-go").onclick = () => this.confirm();
      $("btn-camp-back").onclick = () => this.cancel();
      G.Modal.open("campstyle", { keys: (e) => {
        if (e.code === "Escape") { this.cancel(); return true; }
        if (e.code === "Enter" || e.code === "NumpadEnter") {
          // (the browser would press the focused button too)
          if (e.preventDefault) e.preventDefault();
          const f = document.activeElement && document.activeElement.closest && document.activeElement.closest("#camp-style-box button");
          if (f && f.id !== "btn-camp-go") { f.click(); return true; }
          this.confirm(); return true;
        }
        if (e.code === "Space") { if (e.preventDefault) e.preventDefault(); const f = document.activeElement && document.activeElement.closest && document.activeElement.closest("#camp-style-box button"); if (f) f.click(); return true; }
        if (/^Arrow/.test(e.code) || e.code === "Tab") { this.moveFocus(e.code === "ArrowLeft" || e.code === "ArrowUp" || (e.code === "Tab" && e.shiftKey) ? -1 : 1); if (e.preventDefault) e.preventDefault(); return true; }
        return true;
      } });
      setTimeout(() => { if (G.Input.mode !== "touch") $("btn-camp-go").focus({ preventScroll: true }); }, 0);
    },
    render() {
      const p = this.p;
      const opt = (attr, val, on, name, sub, small) => `<button class="learn-opt${small ? " small" : ""}${on ? " on" : ""}" type="button" data-${attr}="${esc(val)}" aria-pressed="${on}"><b>${esc(name)}</b>${sub ? `<span>${esc(sub)}</span>` : ""}</button>`;
      $("camp-style-opts").innerHTML = ["adaptive", "classic", "custom"].map((s) => opt("style", s, p.style === s, T("camp.style." + s), T("camp.styleDesc." + s))).join("");
      const custom = $("camp-style-custom");
      custom.classList.toggle("hidden", p.style !== "custom");
      custom.innerHTML = `<div class="learn-h">${esc(T("learn.clueHead"))}</div><div class="learn-row">${Object.keys(G.Learn.CLUES).map((c) => opt("clue", c, p.clue === c, T("learn.clue." + c), "", true)).join("")}</div>
        <div class="learn-h">${esc(T("learn.answerHead"))}</div><div class="learn-row">${Object.keys(G.Learn.ANSWERS).map((a) => opt("answer", a, p.answer === a, T("learn.answer." + a), "", true)).join("")}</div>
        <p class="camp-note">${esc(T(p.clue === "audio" && p.answer === "shoot" ? "camp.audioNote" : "camp.customNote", { mode: G.Learn.label(this.styleId()) }))}</p>`;
      $("camp-style-reload").innerHTML = opt("reload", "1", p.reload, T("camp.reload"), T("camp.reloadDesc"));
      const box = $("camp-style-box");
      const on = (sel, fn) => box.querySelectorAll(sel).forEach((b) => { b.onclick = () => { fn(b); this.render(); this.refocus(b); }; });
      on("[data-style]", (b) => { p.style = b.dataset.style; });
      on("[data-clue]", (b) => { p.clue = b.dataset.clue; });
      on("[data-answer]", (b) => { p.answer = b.dataset.answer; });
      on("[data-reload]", () => { p.reload = !p.reload; });
    },
    refocus(b) {
      const k = Object.keys(b.dataset)[0];
      const el = $("camp-style-box").querySelector(`[data-${k}="${CSS.escape(b.dataset[k])}"]`);
      if (!el || G.Input.mode === "touch") return;
      el.focus({ preventScroll: true });
      if (G.Pad.focused) G.Pad.setFocus(el);
    },
    moveFocus(d) {
      const list = Array.from($("camp-style-box").querySelectorAll("button")).filter((b) => b.getClientRects().length);
      if (!list.length) return;
      const i = list.indexOf(document.activeElement);
      list[(i + d + list.length) % list.length].focus({ preventScroll: true });
    },
    close() { $("camp-style").classList.add("hidden"); G.Modal.close("campstyle"); },
    cancel() { this.close(); if (this.back) this.back(); },
    // kept for next time; then the intro of a way of asking not met yet, then the level
    confirm() {
      const id = this.styleId();
      G.save.settings.campaignStyle = id;
      G.save.settings.spellReload = !!this.p.reload;
      G.persist();
      this.close();
      const words = G.levelWords ? G.levelWords(G.getLevel(this.levelId).wordsKey) : null;
      G.Study.introFor(id, G.Learn.run(id, words), this.go, true);
    },
  };
})();
