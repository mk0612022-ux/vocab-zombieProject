// ===================================================================
// Eight kinds of question (vocabulary series, round 3, H5)
// -------------------------------------------------------------------
// The end-of-wave quiz, the question after a boss, the vocabulary locks on
// doors, crates and hatches, and the third floor's Vocabulary Lock all ask
// their words through here:
//   1 th2en       the Thai meaning -> the English word
//   2 en2th       the English word -> its Thai meaning
//   3 def2word    an English definition -> the word
//   4 cloze       a sentence with a gap -> the right form of the family
//   5 colloc      "___ research" -> the word that goes with it
//   6 paraphrase  a sentence with words underlined -> the word that can
//                 replace them (the bank's paraphrase field)
//   7 listen      the word spoken -> its Thai meaning
//   8 spell       the Thai meaning -> the word, typed or put together
// A word in box 1-2 is asked mostly 1, 2 and 7; from box 3, more of 3-6
// and 8 (G.CONFIG.quiz.weights). A word without the data for a kind (a
// player's own word with no examples) is asked another. 3-6 and 8 are
// recall answers (boxes 4-5 need those, js/srs.js).
//
//   G.Questions.pickType(pair, prev)      a kind for this word
//   G.Questions.build(pair, type, pool)   the question
//   G.QuestionView.fill(els, q, handlers) draws it (choices or the spelling pad)
// (new series, round 2, G) An English word shown as a choice -- or as the word
// asked about -- carries its part of speech, research (N./V.), and the wrong
// choices are of the same part of speech; a question about the word's forms
// (Cloze, or a phrase that uses another form) shows none (q.noPos).
// ===================================================================
window.G = window.G || {};

(function () {
  const T = (k, v) => G.T(k, v);
  const esc = (s) => G.escapeHtml(String(s));
  const low = (s) => String(s || "").trim().toLowerCase();

  const Q = G.Questions = {
    TYPES: ["th2en", "en2th", "def2word", "cloze", "colloc", "paraphrase", "listen", "spell"],
    // (round 4: three more, written answers to the English clues -- Practice
    // and a mode of the player's own pairing ask them: G.Questions.fromClue)
    EXTRA: ["defspell", "dictation", "clozespell"],
    RECALL: ["def2word", "cloze", "colloc", "paraphrase", "spell", "defspell", "dictation", "clozespell"],
    SPELLED: ["spell", "defspell", "dictation", "clozespell"],
    // the skills each kind trains (the Progress page's accuracy by skill)
    SKILLS: { th2en: ["recognition"], en2th: ["recognition"], def2word: ["paraphrase"], paraphrase: ["paraphrase"], cloze: ["context"], colloc: ["context"],
      listen: ["listening"], spell: ["spelling"], defspell: ["spelling", "paraphrase"], dictation: ["spelling", "listening"], clozespell: ["spelling", "context"] },
    // a clue x an answer (the modes' terms) as a kind of question
    fromClue(clue, answer) {
      const shoot = { thai: "th2en", definition: "def2word", audio: "listen", cloze: "cloze" };
      const spell = { thai: "spell", definition: "defspell", audio: "dictation", cloze: "clozespell" };
      return (answer === "spell" ? spell : shoot)[clue] || "th2en";
    },

    can(type, pair) {
      if (!pair || !pair[0]) return false;
      if (type === "th2en" || type === "en2th" || type === "spell") return !!pair[1];
      if (type === "listen") return !!pair[1] && ("speechSynthesis" in window);
      if (type === "dictation") return "speechSynthesis" in window;
      if (type === "def2word" || type === "defspell") return G.Clues.has(pair, "definition");
      if (type === "cloze" || type === "clozespell") return G.Clues.has(pair, "cloze");
      if (type === "colloc") return G.Clues.has(pair, "colloc");
      if (type === "paraphrase") return G.Clues.has(pair, "paraphrase");
      return false;
    },
    // (tests: a fixed order of kinds, from the start of each question set)
    force: null, _fi: 0,
    forceTypes(list) { this.force = list && list.length ? list.slice() : null; this._fi = 0; },
    // a kind for this word, by its box; not the one just asked if another will do
    pickType(pair, prev) {
      if (this.force) { const t = this.force[this._fi++ % this.force.length]; if (this.can(t, pair)) return t; }
      const W = G.CONFIG.quiz.weights[G.SRS.box(pair) >= 3 ? "high" : "low"];
      let opts = this.TYPES.filter((t) => this.can(t, pair) && W[t] > 0);
      if (opts.length > 1 && prev) opts = opts.filter((t) => t !== prev);
      if (!opts.length) return "th2en";
      let total = 0;
      opts.forEach((t) => { total += W[t]; });
      let r = G.rng() * total;
      for (const t of opts) { r -= W[t]; if (r <= 0) return t; }
      return opts[opts.length - 1];
    },
    seconds(type, base) { return base + ((G.CONFIG.quiz.extraSeconds || {})[type] || 0); },

    // ---- the wrong choices ----
    // English words of the same part of speech, look-alikes first for a word
    // being learnt (E1); `bad(entry)` leaves out ones that would also be right
    // (new series, round 2, G: exactly its part of speech -- "n/v" with
    // "n/v" -- and only if there are too few of those, one that shares a part
    // of it, then any)
    samePos(pair, pool, n, bad) {
      const pos = G.POS.of(pair);
      const seen = new Set([G.wordKey(pair)]), out = [];
      let rule = "same";
      const ok = (p) => {
        if (!p || seen.has(G.wordKey(p)) || low(p[1]) === low(pair[1])) return false;
        const e = G.Clues.info(p), pp = G.POS.of(p);
        if (pos && rule === "same" && pp !== pos) return false;
        if (pos && rule === "share" && !G.POS.overlap(pos, pp)) return false;
        if (bad && bad(p, e)) return false;
        return true;
      };
      const take = (list) => { for (const p of list) { if (out.length >= n) break; if (ok(p)) { out.push(p); seen.add(G.wordKey(p)); } } };
      for (const r of pos ? ["same", "share", "any"] : ["any"]) {
        rule = r;
        take(G.Distract.forChoices(pair, pool, 12));
        take(G.shuffle((pool || []).slice()));
        if (out.length < n) take(G.shuffle(G.getAllBuiltinWords().slice()));
        if (out.length >= n) break;
      }
      return out.slice(0, n);
    },
    // (new series, round 2, G) wrong English words for a question whose
    // choices show their parts of speech: the usual ones (look-alikes first
    // for a word being learnt), those of its own part of speech first -- a
    // tag must not be what picks the answer out
    posChoices(pair, pool, n) {
      const pos = G.POS.of(pair);
      const base = G.Distract.forChoices(pair, pool, 12);
      if (!pos) return base.slice(0, n);
      const out = [], words = new Set([G.wordKey(pair)]), thais = new Set([low(pair[1])]);
      const add = (p) => {
        if (out.length >= n || !p || words.has(G.wordKey(p)) || thais.has(low(p[1]))) return;
        out.push(p); words.add(G.wordKey(p)); thais.add(low(p[1]));
      };
      base.filter((p) => G.POS.of(p) === pos).forEach(add);
      // (few words are two parts of speech, a level has only a handful: those
      // of every level, so the same three do not come back every time)
      if (out.length < n && G.POS.parts(pos).length > 1) G.shuffle(G.getAllBuiltinWords().filter((p) => G.POS.of(p) === pos)).forEach(add);
      if (out.length < n) this.samePos(pair, pool, n).forEach(add);
      if (out.length < n) base.forEach(add);
      return out;
    },

    // ---- the question ----
    build(pair, type, pool) {
      pool = pool && pool.length >= 4 ? pool : G.getAllBuiltinWords();
      if (!this.can(type, pair)) type = this.SPELLED.includes(type) ? "spell" : "th2en";
      const q = { type, kind: type, pair, recall: this.RECALL.includes(type), answerText: pair[0], spell: this.SPELLED.includes(type), skills: this.SKILLS[type] || ["recognition"] };
      // (new series, round 2, G) an English choice carries its part of speech
      const words = (list) => list.map((p) => ({ text: p[0], lang: "en", pair: p, pos: G.POS.of(p) }));
      const thais = (list) => list.map((p) => ({ text: p[1], lang: "th", pair: p }));
      const shuffleIn = (right, wrong) => {
        const all = G.shuffle([right].concat(wrong));
        q.choices = all; q.answer = all.indexOf(right);
      };
      const own = { text: pair[0], lang: "en", pair, pos: G.POS.of(pair) };
      if (type === "th2en") {
        q.ask = T("q.th2en"); q.prompt = { html: esc(pair[1]), lang: "th", big: true };
        shuffleIn(own, words(this.posChoices(pair, pool, 3)));
      } else if (type === "en2th") {
        q.ask = T("q.en2th"); q.prompt = { html: esc(pair[0]) + G.POS.tag(pair), lang: "en", big: true };
        shuffleIn({ text: pair[1], lang: "th", pair }, thais(G.Distract.forChoices(pair, pool, 3)));
      } else if (type === "def2word") {
        q.ask = T("q.def2word"); q.prompt = { html: "≈ " + esc(G.Clues.definition(pair)), lang: "en" };
        shuffleIn(own, words(this.posChoices(pair, pool, 3)));
      } else if (type === "cloze") {
        // (a question of the family's forms: no part of speech on any choice --
        // the tag would say which form fits the gap)
        q.noPos = true;
        const c = G.Clues.cloze(pair, G.rng() < 0.5 ? 0 : 1) || G.Clues.cloze(pair);
        const start = !c.before.trim();
        const shape = (w) => (start ? w.charAt(0).toUpperCase() + w.slice(1) : w.toLowerCase());
        q.answerText = c.answer;
        q.ask = T("q.cloze");
        q.prompt = { html: esc(c.before) + '<span class="q-gap">_____</span>' + esc(c.after), lang: "en" };
        // H1: the other forms of the family first; then other words
        const fam = G.Clues.familyDecoys(pair, c.answer).map((f) => ({ text: shape(f.word), lang: "en", pair, form: f.word })).slice(0, 3);
        const fill = words(G.Distract.forChoices(pair, pool, 3 - fam.length)).map((x) => Object.assign(x, { text: shape(x.text) }));
        shuffleIn({ text: shape(c.answer), lang: "en", pair, form: c.answer }, fam.concat(fill));
      } else if (type === "colloc") {
        const c = G.Clues.collocation(pair);
        q.answerText = c.answer;
        q.ask = T("q.colloc");
        q.prompt = { html: esc(c.text).replace("___", '<span class="q-gap">_____</span>'), lang: "en", big: true };
        // never one that also goes with these words somewhere in the bank
        const partner = G.Clues.tokens(c.partner).map(low).filter((w) => !G.Clues.STOP.has(w));
        const alsoFits = (p, e) => ((e && e.collocations) || []).some((col) => { const ts = G.Clues.tokens(col).map(low); return partner.length && partner.every((w) => ts.includes(w)); });
        shuffleIn({ text: c.answer.toLowerCase(), lang: "en", pair, pos: G.POS.of(pair) }, words(this.samePos(pair, pool, 3, alsoFits)));
        // (the words go in as they are in the bank; when the phrase uses
        // another form of the word -- "economic growth" for economy -- the
        // headword's part of speech would be wrong for it: none shown)
        if (low(c.answer) !== low(pair[0])) q.noPos = true;
      } else if (type === "paraphrase") {
        const P = G.Clues.info(pair).paraphrase;
        const i = P.sentence.toLowerCase().indexOf(P.phrase.toLowerCase());
        q.answerText = P.word;
        q.ask = T("q.paraphrase");
        q.prompt = { html: i < 0 ? esc(P.sentence) : esc(P.sentence.slice(0, i)) + "<u>" + esc(P.sentence.substr(i, P.phrase.length)) + "</u>" + esc(P.sentence.slice(i + P.phrase.length)), lang: "en" };
        const syn = new Set(((G.Clues.info(pair).synonyms) || []).map(low));
        shuffleIn({ text: P.word, lang: "en", pair, pos: G.POS.of(pair) }, words(this.samePos(pair, pool, 3, (p) => syn.has(low(p[0])))));
        if (low(P.word) !== low(pair[0])) q.noPos = true;
      } else if (type === "listen") {
        q.ask = T("q.listen"); q.prompt = { html: "", lang: "en", listen: true }; q.speak = pair[0];
        shuffleIn({ text: pair[1], lang: "th", pair }, thais(G.Distract.forChoices(pair, pool, 3)));
      } else if (type === "spell") {
        q.ask = T("q.spell"); q.prompt = { html: esc(pair[1]), lang: "th", big: true };
      } else if (type === "defspell") {
        q.ask = T("q.defspell"); q.prompt = { html: "≈ " + esc(G.Clues.definition(pair)), lang: "en" };
      } else if (type === "dictation") {
        q.ask = T("q.dictation"); q.prompt = { html: "", lang: "en", listen: true }; q.speak = pair[0];
      } else if (type === "clozespell") {
        // the form the sentence uses is the word to write
        const c = G.Clues.cloze(pair, G.rng() < 0.5 ? 0 : 1) || G.Clues.cloze(pair);
        q.answerText = c.answer.toLowerCase();
        q.spellPair = Object.assign([q.answerText, pair[1]], { exact: true });
        q.ask = T("q.clozespell");
        q.prompt = { html: esc(c.before) + '<span class="q-gap">_____</span>' + esc(c.after), lang: "en" };
      }
      return q;
    },
    // what a written answer is checked against (the form, for a gap)
    spellTarget(q) { return q.spellPair || q.pair; },
    // is this choice / this spelling the right answer?
    isRight(q, k) {
      if (q.spell) return G.Spell.isRight(k, this.spellTarget(q));
      return k === q.answer;
    },
    // the right answer, as the reveal shows it
    rightText(q) { return q.spell ? this.spellTarget(q)[0] : q.choices[q.answer].text; },
    // the wrong word picked, as a word of the bank (E2), if it was one
    picked(q, k) {
      if (q.spell || k == null || k < 0) return null;
      const c = q.choices[k];
      return c && c.pair && c.pair !== q.pair && G.wordKey(c.pair) !== G.wordKey(q.pair) ? c.pair : null;
    },
    inView(q) { return q.spell ? [] : q.choices.filter((c) => c.pair && G.wordKey(c.pair) !== G.wordKey(q.pair)).map((c) => c.pair); },
  };

  // ---------------- drawing one ----------------
  // els: { ask, prompt, choices } (elements); h: { pick(i), spell(text), hint(), speak(), numbered, choiceClass }
  G.QuestionView = {
    fill(els, q, h) {
      h = h || {};
      if (els.ask) els.ask.textContent = q.ask;
      const p = els.prompt;
      p.lang = q.prompt.lang;
      p.classList.toggle("q-big", !!q.prompt.big);
      p.classList.toggle("q-listen", !!q.prompt.listen);
      p.innerHTML = q.prompt.listen
        ? `<button class="q-say" type="button" aria-label="${esc(T("q.hearAgain"))}"><span aria-hidden="true">🔊</span> <span>${esc(T("q.hearAgain"))}</span> <span class="kbd-only q-key">(${esc(G.keyLabel(G.save.settings.keybinds.replay))})</span></button>`
        : q.prompt.html;
      const say = p.querySelector(".q-say");
      if (say) say.onclick = () => h.speak && h.speak();
      const box = els.choices;
      box.classList.toggle("q-spelling", !!q.spell);
      let pad = null;
      if (q.spell) {
        box.innerHTML = '<div class="q-pad"></div>';
        pad = new G.SpellPad(box.querySelector(".q-pad"), {
          mode: G.Input.mode === "touch" || G.Input.padActive ? "tiles" : "type",
          enterButton: true, noClue: true,
          onSubmit: (t) => h.spell && h.spell(t),
          onHint: () => { if (pad.hint()) h.hint && h.hint(); },
          showCursor: () => G.Input.padActive,
        });
        pad.setWord(Q.spellTarget(q), "");
      } else {
        const cls = h.choiceClass || "quiz-choice";
        // (new series, round 2, G) an English word with its part of speech --
        // not in a question of the word's forms (q.noPos)
        const tag = (c) => (c.lang === "en" && c.pos && !q.noPos ? G.POS.tag(c.pos) : "");
        box.innerHTML = q.choices.map((c, k) => `<button class="${cls}${c.lang === "th" ? " th" : ""}" data-k="${k}" lang="${c.lang}" type="button"><b>${k + 1}</b><span>${esc(c.text)}${tag(c)}</span></button>`).join("");
        box.querySelectorAll("[data-k]").forEach((b) => { b.onclick = () => h.pick && h.pick(parseInt(b.dataset.k, 10)); });
      }
      return { pad };
    },
    // the key for a question: digits pick, a spelling question takes letters
    key(e, q, pad, h) {
      if (e.code === G.save.settings.keybinds.replay && q.prompt.listen) { h.speak && h.speak(); return true; }
      if (q.spell && pad) {
        const ch = G.Spell.keyChar(e);
        if (e.code === "Enter" || e.code === "NumpadEnter") { h.spell && h.spell(pad.text()); return true; }
        if (e.code === "Backspace") { pad.back(); return true; }
        if (e.code === "Tab") { if (e.preventDefault) e.preventDefault(); if (pad.hint()) h.hint && h.hint(); return true; }
        if (ch && ch.length === 1 && /[a-z '\-]/i.test(ch)) { pad.type(ch.toLowerCase()); return true; }
        return false;
      }
      const n = /^(?:Digit|Numpad)([1-4])$/.exec(e.code);
      if (n && +n[1] <= q.choices.length) { h.pick && h.pick(+n[1] - 1); return true; }
      return false;
    },
  };
})();
