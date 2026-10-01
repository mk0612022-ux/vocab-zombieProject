// ===================================================================
// Practice Mode (vocabulary series, round 4, J1)
// -------------------------------------------------------------------
// No zombies and no clock: questions one at a time, asked any of the ways
// the learning modes ask -- a ready-made mode, Adaptive, or a clue x an
// answer of the player's own -- on the words the filters leave:
//   words from   every level, one level, the player's own words, or a set
//                they imported
//   topic        any, or one of the twelve
//   box          any, or some of New, 1-5, Mastered
//   often wrong  only words missed at least G.CONFIG.practice.wrongMin
//                times (and a share of their answers), the most missed first
// A session is up to G.CONFIG.practice.words of them, the ones due first.
// Each answer counts like any other (G.Learning.answerWord): a right answer
// on a word not yet due moves no box, as everywhere. A wrong one shows the
// word's mini card until Continue. The Progress page's "Practise these"
// starts a session on its list at once (G.Practice.startList).
// Mouse, touch, keys (1-4, typing, Enter, Esc) and a controller (D-pad, A).
// ===================================================================
window.G = window.G || {};

(function () {
  const T = (k, v) => G.T(k, v);
  const esc = (s) => G.escapeHtml(String(s));
  const $ = (id) => document.getElementById(id);
  const C = () => G.CONFIG.practice;

  G.Practice = {
    // the filters, kept while the game is open
    f: { mode: "adaptive", clue: "definition", answer: "spell", src: "all", topic: "", boxes: [], wrong: false },
    BOXES: ["0", "1", "2", "3", "4", "5", "6"],

    // ---------------- the words ----------------
    sources() {
      const out = [{ id: "all", name: T("practice.srcAll") }];
      G.LEVELS.forEach((l) => out.push({ id: l.wordsKey, name: T("common.levelNamed", { n: l.id, name: l.name }) }));
      const own = Object.values(G.save.customWords || {}).reduce((n, l) => n + l.length, 0);
      if (own) out.push({ id: "own", name: T("practice.srcOwn") });
      Object.keys(G.save.importedSets || {}).forEach((id) => out.push({ id: "set:" + id, name: G.save.importedSets[id].name }));
      return out;
    },
    sourceWords(src) {
      if (src === "own") return [].concat(...Object.values(G.save.customWords || {}));
      if (/^set:/.test(src)) { const s = G.save.importedSets[src.slice(4)]; return s ? s.words.filter((p) => p[0] && p[1]) : []; }
      if (G.WORD_SETS[src]) return G.WORD_SETS[src].words;
      return G.SRS.pool();
    },
    // how often a word has been missed: [wrong, share of answers wrong]
    misses(p) { const s = G.wordStat(p); if (!s) return [0, 0]; const n = s.correct + s.wrong; return [s.wrong, n ? s.wrong / n : 0]; },
    oftenWrong(p) { const m = this.misses(p); return m[0] >= C().wrongMin && m[1] >= C().wrongShare; },
    // the most missed first (then the lowest share right)
    byMisses(list) { return list.slice().sort((a, b) => { const x = this.misses(a), y = this.misses(b); return (y[0] - x[0]) || (y[1] - x[1]); }); },
    // every word the filters leave, once each
    matching(f) {
      f = f || this.f;
      const seen = new Set();
      return this.sourceWords(f.src).filter((p) => {
        const k = G.wordKey(p);
        if (!k || seen.has(k)) return false;
        seen.add(k);
        if (f.topic) { const e = G.WordBank.info(p); if (!e || e.topic !== f.topic) return false; }
        if (f.boxes.length && !f.boxes.includes(String(Math.min(6, G.SRS.box(p))))) return false;
        if (f.wrong && !this.oftenWrong(p)) return false;
        return true;
      });
    },
    // a session's words: the most missed first (often wrong), else those due,
    // then being learnt, then new, then known
    pickWords(list, f) {
      const n = C().words;
      if (f.wrong) return this.byMisses(list).slice(0, n);
      const sp = G.SRS.split(list);
      return sp.due.concat(G.shuffle(sp.learning), G.shuffle(sp.fresh), G.weightedSample(sp.known, sp.known.length)).slice(0, n);
    },
    modeId(f) { f = f || this.f; return f.mode === "custom" ? G.Learn.customId(f.clue, f.answer) : f.mode; },
    // a mode's name here: no zombies, so a shot answer is a choice
    label(id) {
      const p = G.Learn.preset(id);
      return p.custom ? T("learn.customName", { clue: T("learn.clue." + p.clue), answer: T("practice.answer." + p.answer) }) : T("learn.preset." + p.id);
    },

    // ---------------- the setup screen ----------------
    open(returnTo) {
      this.returnTo = returnTo || "screen-mainmenu";
      this.render();
      G.UI.showScreen("screen-practice-setup");
      G.Game.state = "PRACTICE_SETUP";
    },
    render() {
      const f = this.f, wrap = $("practice-setup-content");
      if (!this.sources().some((s) => s.id === f.src)) f.src = "all";
      const opt = (attr, val, on, name, sub, small) => `<button class="learn-opt${small ? " small" : ""}${on ? " on" : ""}" type="button" data-${attr}="${esc(val)}" aria-pressed="${on}"><b>${esc(name)}</b>${sub ? `<span>${esc(sub)}</span>` : ""}</button>`;
      const list = this.matching();
      const boxName = (b) => b === "0" ? T("learn.boxNew") : b === "6" ? T("learn.boxMastered") : T("practice.boxN", { n: b });
      wrap.innerHTML = `
        <p class="pr-sub">${esc(T("practice.sub"))}</p>
        <div class="learn-h">${esc(T("learn.modeHead"))}</div>
        <div class="learn-modes">${G.Learn.availablePresets().map((p) => opt("mode", p.id, f.mode === p.id, T("learn.preset." + p.id), T("practice.presetDesc." + p.id))).join("")}${opt("mode", "custom", f.mode === "custom", T("learn.preset.custom"), T("learn.presetDesc.custom"))}</div>
        <div class="learn-custom${f.mode === "custom" ? "" : " hidden"}">
          <div class="learn-h">${esc(T("learn.clueHead"))}</div><div class="learn-row">${Object.keys(G.Learn.CLUES).map((c) => opt("clue", c, f.clue === c, T("learn.clue." + c), "", true)).join("")}</div>
          <div class="learn-h">${esc(T("learn.answerHead"))}</div><div class="learn-row">${Object.keys(G.Learn.ANSWERS).map((a) => opt("answer", a, f.answer === a, T("practice.answer." + a), "", true)).join("")}</div>
        </div>
        <div class="learn-h">${esc(T("learn.levelHead"))}</div>
        <div class="learn-row">${this.sources().map((s) => opt("src", s.id, f.src === s.id, s.name, "", true)).join("")}</div>
        <div class="pr-filters">
          <label class="pr-field"><span class="learn-h">${esc(T("practice.topicHead"))}</span>
            <select id="practice-topic"><option value="">${esc(T("practice.topicAll"))}</option>${G.WORD_TOPICS.map((t) => `<option value="${esc(t)}"${f.topic === t ? " selected" : ""}>${esc(G.topicLabel(t))}</option>`).join("")}</select></label>
          <div class="pr-field"><span class="learn-h">${esc(T("practice.boxHead"))}</span>
            <div class="learn-row pr-boxes">${opt("box", "any", !f.boxes.length, T("practice.boxAny"), "", true)}${this.BOXES.map((b) => opt("box", b, f.boxes.includes(b), boxName(b), "", true)).join("")}</div></div>
        </div>
        <div class="learn-row">${opt("wrong", "1", f.wrong, T("practice.weak"), T("practice.weakDesc", { n: C().wrongMin }))}</div>
        <div class="pr-count${list.length ? "" : " none"}" id="practice-count">${esc(list.length ? T("practice.count", { n: list.length, k: Math.min(list.length, C().words) }) : T("practice.countNone"))}</div>
        <div class="row-center"><button class="btn btn-primary" id="btn-practice-start" type="button"${list.length ? "" : " disabled"}>${esc(T("practice.start"))} <span class="kbd-only dlg-key">(Enter)</span></button></div>`;
      const on = (sel, fn) => wrap.querySelectorAll(sel).forEach((b) => { b.onclick = () => { fn(b); this.render(); this.refocus(sel, b); }; });
      on("[data-mode]", (b) => { f.mode = b.dataset.mode; });
      on("[data-clue]", (b) => { f.clue = b.dataset.clue; });
      on("[data-answer]", (b) => { f.answer = b.dataset.answer; });
      on("[data-src]", (b) => { f.src = b.dataset.src; });
      on("[data-box]", (b) => {
        const v = b.dataset.box;
        if (v === "any") f.boxes = [];
        else f.boxes = f.boxes.includes(v) ? f.boxes.filter((x) => x !== v) : f.boxes.concat(v);
      });
      on("[data-wrong]", () => { f.wrong = !f.wrong; });
      $("practice-topic").onchange = (e) => { f.topic = e.target.value; this.render(); this.refocus("#practice-topic"); };
      $("btn-practice-start").onclick = () => this.start();
    },
    // the same button keeps the keys' / controller's focus after a redraw
    refocus(sel, b) {
      const v = b && Object.keys(b.dataset)[0];
      const el = b ? $("practice-setup-content").querySelector(`[data-${v}="${CSS.escape(b.dataset[v])}"]`) : $("practice-setup-content").querySelector(sel);
      if (!el || G.Input.mode === "touch") return;
      el.focus({ preventScroll: true });
      if (G.Pad.focused) G.Pad.setFocus(el);
    },

    // ---------------- a session ----------------
    start() {
      const list = this.matching();
      if (!list.length) return;
      this.run(this.pickWords(list, this.f), this.modeId(), list, "setup");
    },
    // "Practise these" (the Progress page): this list, at once, the way the
    // filters last said (Adaptive at first)
    startList(pairs, returnTo) {
      const list = (pairs || []).filter((p) => p && p[0]);
      if (!list.length) return;
      this.returnTo = returnTo || "screen-mainmenu";
      this.run(list.slice(0, C().words), this.modeId(), list, returnTo || "setup");
    },
    run(words, mode, pool, from) {
      const rules = G.Learn.run(mode, words);
      const big = pool.length >= 4 ? pool : G.getAllBuiltinWords();
      let prev = null;
      G.Questions._fi = 0;
      this.qs = words.map((p) => {
        const pick = rules.pick(p);
        let type = G.Questions.fromClue(pick.clue, pick.answer);
        // (forced kinds, for the tests)
        if (G.Questions.force) type = G.Questions.pickType(p, prev);
        prev = type;
        return G.Questions.build(p, type, big);
      });
      this.mode = mode; this.from = from; this.words = words; this.pool = pool;
      this.i = -1; this.right = 0; this.missed = [];
      this.active = true; this.stage = "question";
      $("practice-kicker").textContent = T("practice.kicker", { mode: this.label(mode) });
      G.UI.showScreen("screen-practice-play");
      G.Game.state = "PRACTICE_PLAY";
      G.Modal.open("practice", { keys: (e) => this.key(e) });
      this.next();
    },
    next() {
      clearTimeout(this._t);
      if (!this.active) return;
      this.i++;
      if (this.i >= this.qs.length) { this.finish(); return; }
      this.stage = "question";
      const q = this.qs[this.i];
      $("practice-progress").textContent = T("quiz.progress", { i: this.i + 1, n: this.qs.length });
      $("practice-q").dataset.type = q.type;
      this.view = G.QuestionView.fill({ ask: $("practice-ask"), prompt: $("practice-prompt"), choices: $("practice-choices") }, q, this.handlers());
      $("practice-feedback").innerHTML = "";
      $("practice-feedback").className = "quiz-feedback";
      $("practice-hint").textContent = T(q.spell ? "quiz.hintSpell" : "quiz.hint");
      this.counters();
      if (q.speak) this.say();
      if (G.Input.mode !== "touch" && !q.spell) setTimeout(() => { const b = $("practice-choices").querySelector(".quiz-choice"); if (b && this.active && this.stage === "question") b.focus({ preventScroll: true }); }, 0);
    },
    handlers() {
      return {
        pick: (k) => this.answer(k),
        spell: (text) => this.answer(text),
        hint: () => { const q = this.qs[this.i]; q.hints = (q.hints || 0) + 1; },
        speak: () => this.say(true),
      };
    },
    say(again) {
      const q = this.qs[this.i];
      if (!q || !q.speak) return;
      if (again && q.played && G.save.settings.playOnce) return;
      q.played = (q.played || 0) + 1;
      G.Audio.speak(q.speak);
    },
    counters() {
      $("practice-right").textContent = T("practice.right", { x: this.right });
      $("practice-wrong").textContent = T("practice.missed", { x: this.missed.length });
    },
    // (tests) the question answered right or wrong, whatever its kind
    answerAs(right) {
      const q = this.qs && this.qs[this.i];
      if (!q || this.stage !== "question") return;
      if (q.spell) this.answer(right ? G.Questions.spellTarget(q)[0] : "qqqqq");
      else this.answer(right ? q.answer : (q.answer + 1) % q.choices.length);
    },
    answer(k) {
      if (!this.active || this.stage !== "question") return;
      const q = this.qs[this.i];
      if (q.spell && typeof k === "string" && !G.Spell.norm(k)) return;
      const right = G.Questions.isRight(q, k);
      this.stage = "feedback";
      if (right) this.right++; else this.missed.push(q.pair);
      G.Learning.answerWord(q.pair, right, { recall: q.recall, assisted: (q.hints || 0) > 0, picked: right ? null : G.Questions.picked(q, k), typed: q.spell && !right && typeof k === "string" ? G.Spell.norm(k) : null, inView: G.Questions.inView(q), skills: q.skills });
      G.persist();
      if (q.spell) {
        if (!right && this.view.pad) this.view.pad.showFeedback(typeof k === "string" ? k : "", G.Questions.rightText(q), typeof k === "string" ? G.Spell.tipFor(k, q.pair) : "");
      } else {
        $("practice-choices").querySelectorAll(".quiz-choice").forEach((b, i) => { b.disabled = true; b.classList.toggle("is-right", i === q.answer); b.classList.toggle("is-wrong", i === k && !right); });
      }
      const fb = $("practice-feedback");
      if (right) {
        fb.textContent = T("quiz.right"); fb.className = "quiz-feedback ok";
        this._t = setTimeout(() => this.next(), G.CONFIG.quiz.feedback * 1000);
      } else {
        fb.innerHTML = `<div class="qf-line">${esc(T("quiz.wrong", { a: G.Questions.rightText(q) }))}</div>` + G.VocabCard.miniHtml(q.pair, { form: q.answerText }) +
          `<button class="btn btn-primary qf-next" type="button">${esc(T("quiz.next"))} <span class="kbd-only dlg-key">(Enter)</span></button>`;
        fb.className = "quiz-feedback bad";
        G.VocabCard.bind(fb);
        fb.querySelector(".qf-next").onclick = () => this.next();
        if (G.Input.mode !== "touch") setTimeout(() => { const b = fb.querySelector(".qf-next"); if (b && this.stage === "feedback") b.focus({ preventScroll: true }); }, 0);
      }
      G.Audio.sfx(right ? "correct" : "wrong");
      if ((G.save.settings.speechMode || "after") !== "off" || q.speak) G.Audio.speak(q.answerText || q.pair[0]);
      this.counters();
    },
    // the end (or End Practice): how it went, the words missed, again or done
    finish() {
      clearTimeout(this._t);
      if (!this.active) return;
      this.active = false; this.stage = "result";
      G.Modal.close("practice");
      G.persist();
      const n = this.right + this.missed.length;
      const missed = this.missed.map((p) => p[0]);
      G.Dialog.open({
        icon: "🎯", title: T("practice.doneTitle"),
        text: T("practice.done", { c: this.right, n }) + (missed.length ? " · " + T("practice.doneMissed", { w: missed.slice(0, 8).join(", ") }) : ""),
        buttons: [
          { label: T(this.missed.length ? "practice.again" : "practice.againAll"), primary: true, action: () => this.run(this.missed.length ? this.missed.slice() : this.words, this.mode, this.pool, this.from) },
          { label: T("practice.doneBtn"), cancel: true, action: () => this.leave() },
        ],
      });
    },
    // back where the session was started from
    leave() {
      if (this.from === "screen-progress" && G.Progress) { G.Progress.open(); return; }
      this.open(this.returnTo);
    },
    quit() {
      if (!this.active) { this.leave(); return; }
      // (nothing answered yet: straight out)
      if (this.right + this.missed.length === 0) { this.active = false; clearTimeout(this._t); G.Modal.close("practice"); this.leave(); return; }
      this.finish();
    },
    key(e) {
      if (e.code === "Escape") { this.quit(); return true; }
      if (this.stage === "question") { G.QuestionView.key(e, this.qs[this.i], this.view && this.view.pad, this.handlers()); return true; }
      if (this.stage === "feedback") { if (e.code === "Enter" || e.code === "Space" || e.code === "NumpadEnter") { if (e.preventDefault) e.preventDefault(); this.next(); } return true; }
      return true;
    },
  };

  window.addEventListener("DOMContentLoaded", () => {
    const q = $("btn-practice-quit");
    if (q) q.onclick = () => G.Practice.quit();
    const b = $("btn-practice-back");
    if (b) b.onclick = () => { if (G.Practice.returnTo === "screen-progress" && G.Progress) G.Progress.open(); else G.UI.goToMainMenu(); };
    // Enter on the setup screen starts (when the focus is not on a choice)
    window.addEventListener("keydown", (e) => {
      if (G.UI._currentScreen !== "screen-practice-setup" || G.Modal.isOpen()) return;
      if (e.code === "Escape") { e.preventDefault(); e.stopImmediatePropagation(); $("btn-practice-back").click(); }
      else if (e.code === "Enter" && !(document.activeElement && document.activeElement.closest && document.activeElement.closest("button, select"))) {
        const s = $("btn-practice-start");
        if (s && !s.disabled) { e.preventDefault(); e.stopImmediatePropagation(); s.click(); }
      }
    });
  });
})();
