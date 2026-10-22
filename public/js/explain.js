// ===================================================================
// Answer explanations (overhaul, round 7)
// -------------------------------------------------------------------
// After every answer -- right or wrong, wherever a word is asked -- what the
// words were and why. G.Explain.build(o) works it out from the word bank;
// G.ExplainView draws it in a question's own window (Continue, More), and
// G.ExplainCard as a short card under the word box while shooting.
//
//   wrong   ✗ the word picked (or typed): part of speech and meaning
//           ✓ the right word: part of speech and meaning
//           why, a line or two, by its cause (below)
//           an example sentence of the right word, with its translation
//           a tip (a common IELTS mistake), when the word has one
//   right   ✓ the word, part of speech and meaning; an example (or a
//           collocation); its family
//
// The causes: meaning (another meaning altogether), confusable (words that
// look or sound alike: the bank's confusables, the lexicon, a mix-up of the
// player's own, or a letter or two apart), form (another word of the same
// family: the gap wants another part of speech), pos (another part of
// speech), colloc (a phrase the word does not go with), context (does not
// fit the sentence, the definition, the underlined words), spelling (the
// letters that differ are marked), word (another real word typed), timeout.
//
// The language is the Meaning Language's: its file js/data/explain_<l>.js,
// fetched when first needed (while it loads, the menus' language, then the
// English here). Examples are in the Word Language with a translation into
// the Meaning Language: the bank's sentences are English; the files hold
// them in Thai, Chinese and French. Everything is written in advance --
// nothing is asked of a server or an AI while playing. Hand-written notes
// for confusable pairs (confusableNotes), misspellings (spelling) and some
// words (explain); the rest from the templates (tools/validate-words.ps1
// counts which). Reading an explanation moves no box: only the answer does.
// A wrong answer's cause is kept on the word (G.save.learn.why) for the
// vocabulary card and the Progress page.
// ===================================================================
window.G = window.G || {};

(function () {
  const esc = (s) => G.escapeHtml(String(s == null ? "" : s));
  const low = (s) => String(s == null ? "" : s).trim().toLowerCase();
  const set = () => (G.save && G.save.settings) || {};
  const T = (k, v) => G.T(k, v);

  // English: the templates every other language falls back on
  const EN = {
    t: {
      why: {
        meaning: "{x} means “{xm}”; the clue was “{ym}”, which is {y}.",
        meaningRev: "“{xm}” is the meaning of {x}; {y} means “{ym}”.",
        heard: "The word said was {y} (“{ym}”), not {x} (“{xm}”).",
        confuse: "{x} and {y} are easy to mix up: {x} = “{xm}”, {y} = “{ym}”.",
        sound: "{x} and {y} sound alike: {x} = “{xm}”, {y} = “{ym}”.",
        form: "{x} is {xa} of the same family; the gap needs {ya}: {y}.",
        form2: "{x} is another form of the same word; this sentence needs {y}.",
        pos: "{x} is {xa} meaning “{xm}”; the answer is {ya}: {y} = “{ym}”.",
        colloc: "We say “{c}”; {x} does not go with “{p}”.",
        context: "{x} (“{xm}”) does not fit this sentence; {y} (“{ym}”) does.",
        defn: "The definition describes {y} (“{ym}”), not {x} (“{xm}”).",
        para: "The underlined words mean {y} (“{ym}”); {x} means “{xm}”.",
        spell: "Check the spelling of {y}: the marked letters are where it went wrong.",
        spellN: "Check the spelling of {y}: {n} letters are wrong (marked).",
        word: "{x} is another word (“{xm}”); the answer is {y}.",
        answer: "The answer is {y} (“{ym}”).",
        timeout: "Time ran out. The answer is {y} (“{ym}”).",
        again: "You have mixed these two up {n} times.",
        // (the answer is another form of its family -- "infinite" of finite: the
        // headword's meaning is not the form's, so it goes with the headword)
        contextF: "{x} (“{xm}”) does not fit this sentence; {y}, a form of {h}, does.",
        paraF: "The underlined words mean {y}, a form of {h}; {x} means “{xm}”.",
        posF: "{x} is {xa} meaning “{xm}”; the answer is {ya}: {y}, a form of {h}.",
        answerF: "The answer is {y}, a form of {h} (“{hm}”).",
        timeoutF: "Time ran out. The answer is {y}, a form of {h} (“{hm}”).",
      },
      example: "Example", tip: "Tip", goes: "Goes with", family: "Word family", note: "Note",
      pos: { n: "noun", v: "verb", adj: "adjective", adv: "adverb", prep: "preposition", conj: "conjunction", pron: "pronoun", det: "determiner", phrase: "phrase" },
      posA: { n: "a noun", v: "a verb", adj: "an adjective", adv: "an adverb", prep: "a preposition", conj: "a conjunction", pron: "a pronoun", det: "a determiner", phrase: "a phrase" },
      or: " / ",
    },
    ex: {}, explain: {}, spelling: {}, confusableNotes: {},
  };

  // the kind of question a clue on the field is, shot or spelt (js/learnmodes.js clues)
  const SHOT = { thai: "th2en", definition: "def2word", audio: "listen", cloze: "cloze" };
  const SPELT = { thai: "spell", definition: "defspell", audio: "dictation", cloze: "clozespell" };

  const X = G.Explain = {
    FILES: { th: "js/data/explain_th.js", zh: "js/data/explain_zh.js", fr: "js/data/explain_fr.js" },
    CAUSES: ["meaning", "confusable", "form", "pos", "colloc", "context", "spelling", "word", "timeout"],
    _loading: {},
    EN,
    data(l) { return l === "en" ? EN : (G.EXPLAIN && G.EXPLAIN[l]) || null; },
    ready(l) { return !!this.data(l); },
    // a language's file, fetched once; cb(ok)
    load(l, cb) {
      if (this.ready(l) || !this.FILES[l]) { if (cb) cb(this.ready(l)); return; }
      if (this._loading[l]) { if (cb) this._loading[l].push(cb); return; }
      const waiting = this._loading[l] = cb ? [cb] : [];
      const s = document.createElement("script");
      s.src = this.FILES[l];
      const done = (ok) => { delete this._loading[l]; waiting.forEach((f) => f(ok)); };
      s.onload = () => done(this.ready(l));
      s.onerror = () => done(false);
      // (after the game's own scripts: config.js stays the first of them)
      document.body.appendChild(s);
    },
    // what a run may need: the Meaning Language's (the explanations), the
    // Word Language's (its examples), the menus' (the fallback)
    preload(cb) {
      const want = [G.Lang.meaning(), G.Lang.word(), G.lang].filter((l, i, a) => l && a.indexOf(l) === i);
      let n = want.length;
      want.forEach((l) => this.load(l, () => { if (--n === 0 && cb) cb(); }));
    },
    // the language an explanation is written in: the Meaning Language's; while
    // its file loads, the menus'; else English
    lang(pair) {
      const ml = G.Lang.ml(pair);
      if (this.ready(ml)) return ml;
      this.load(ml);
      return this.ready(G.lang) ? G.lang : "en";
    },
    // a template in language l ("why.form"), English when l lacks it, {vars} filled
    t(l, path, vars) {
      const get = (d) => path.split(".").reduce((o, k) => (o && o[k] != null ? o[k] : null), d && d.t);
      let s = get(this.data(l));
      if (s == null) s = get(EN);
      if (s == null) return "";
      return typeof s === "string" && vars ? s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? vars[k] : m)) : s;
    },
    // a part of speech in words: "noun", "a noun" (`art`); "noun / verb"
    posName(l, code, art) {
      const parts = G.POS.parts(code);
      if (!parts.length) return "";
      const names = this.t(l, art ? "posA" : "pos") || {};
      const plain = this.t(l, "pos") || {};
      return parts.map((c, i) => (i === 0 ? names[c] : plain[c]) || c).join(this.t(l, "or"));
    },

    // ---------------- the words ----------------
    // a form's part of speech: the headword's, a family member's, or a
    // regular form's ("analysed" of the verb analyse) -- "" when unknown
    formPos(form, pair) {
      const i = G.WordBank.info(pair), f = low(form);
      if (!i || !f) return "";
      const head = low(i.headword || pair[0]);
      if (f === head || (i.acceptedSpellings || []).some((w) => low(w) === f)) return G.POS.of(pair);
      const fam = (i.family || []).filter((m) => m && m.word);
      const own = fam.find((m) => low(m.word) === f);
      if (own) return G.POS.valid(own.pos) ? own.pos : "";
      const tries = [], cut = (n) => f.slice(0, f.length - n);
      if (/ies$/.test(f)) tries.push([cut(3) + "y", "s"]);
      if (/es$/.test(f)) tries.push([cut(2), "s"]);
      if (/s$/.test(f)) tries.push([cut(1), "s"]);
      if (/ied$/.test(f)) tries.push([cut(3) + "y", "v"]);
      if (/ed$/.test(f)) tries.push([cut(2), "v"], [cut(1), "v"], [cut(3), "v"]);
      if (/ing$/.test(f)) tries.push([cut(3), "v"], [cut(3) + "e", "v"], [cut(4), "v"]);
      const posOf = (w) => (w === head ? G.POS.of(pair) : ((fam.find((m) => low(m.word) === w) || {}).pos || ""));
      for (const [w, end] of tries) {
        const p = posOf(w);
        if (!p) continue;
        if (end === "v") return G.POS.parts(p).includes("v") ? "v" : p;
        return p;
      }
      return "";
    },
    // a word as an explanation shows it (a pair, or `form`: another form of its family)
    side(pair, form) {
      if (!pair) return null;
      const other = !!form && low(form) !== low(pair[0]);
      const pos = other ? this.formPos(form, pair) : G.POS.of(pair);
      const g = other ? "" : G.POS.gender(pair);
      const i = G.WordBank.info(pair);
      return {
        pair, form: other, word: other ? String(form) : String(pair[0]),
        html: other ? esc(form) : G.Lang.html(pair, 0), attr: other ? ' lang="en"' : G.Lang.attr(pair, 0),
        head: other ? String((i && i.headword) || pair[0]) : "",
        pos, abbr: pos ? G.POS.abbr(pos, g) : "",
        meaning: String(pair[1] || ""), mhtml: G.Lang.html(pair, 1), mattr: G.Lang.attr(pair, 1),
      };
    },
    // are these two words easy to take for each other? (the bank's
    // confusables either way, the lexicon, a decoy brought for it, or a
    // letter or two apart -- a character, in Chinese)
    confusable(a, b, source) {
      if (!a || !b) return false;
      if (source === "confusable" || source === "spelling" || source === "confusion" || b.lexicon) return true;
      const ia = G.WordBank.info(a), ib = G.WordBank.info(b);
      const ha = low(ia && ia.headword || a[0]), hb = low(ib && ib.headword || b[0]);
      if (G.Lang.enWord(a)) {
        if (((ia && ia.confusables) || []).some((w) => low(w) === hb)) return true;
        if (((ib && ib.confusables) || []).some((w) => low(w) === ha)) return true;
      }
      const wa = low(a[0]), wb = low(b[0]);
      if (G.Lang.wl(a) === "zh") return wa.length > 1 && wb.length > 1 && G.Distract.distance(wa, wb, 1) <= 1;
      const max = Math.min(wa.length, wb.length) >= 7 ? 2 : 1;
      return G.Distract.distance(wa, wb, max) <= max;
    },
    // a hand-written note on a pair, in language l ("" when there is none)
    pairNote(l, a, b) {
      const d = this.data(l);
      if (!d || !d.confusableNotes || !a || !b) return "";
      const k = [low(a), low(b)].sort().join("|");
      return d.confusableNotes[k] || "";
    },
    // the letters that differ, marked on both: { typed, answer } as HTML
    diff(typed, answer, lang) {
      lang = lang || "en";
      const mark = (parts) => parts.map((p) => p.cls === "ok" ? esc(p.ch) : p.cls === "miss" ? "" : `<mark>${esc(p.ch)}</mark>`).join("");
      // (the answer's side: the answer as if typed, against what was typed)
      const a = G.Spell.markup(answer, typed, lang), t = G.Spell.markup(typed, answer, lang);
      const n = Math.max(t.filter((p) => p.cls !== "ok").length, a.filter((p) => p.cls !== "ok").length);
      return { typed: mark(t), answer: mark(a), n };
    },

    // ---------------- an answer, explained ----------------
    // o: { pair (the word asked), form (the form wanted, "indicates"), type
    //      (a kind of question, or from `clue` + `answer` on the field),
    //      right, timeout, picked (the pair picked or shot), pickedForm (a
    //      form of the same family picked), source (a decoy's: family,
    //      confusable...), typed (a written answer), spellPair, colloc, cloze }
    build(o) {
      o = o || {};
      const pair = o.pair;
      if (!pair) return null;
      const type = o.type || (o.clue ? (o.answer === "spell" ? SPELT : SHOT)[o.clue] : "") || (o.typed != null ? "spell" : "th2en");
      const l = this.lang(pair);
      const ex = { right: !!o.right, lang: l, type, wl: G.Lang.wl(pair), ml: G.Lang.ml(pair), y: this.side(pair, o.form), x: null, cause: o.right ? "right" : "meaning", why: "", note: false, typed: "", diff: null, again: "" };
      // (a word heard: its syllables, the stressed one in capitals -- G3)
      if (type === "listen" || type === "dictation") ex.stress = G.Clues.stressText(pair);
      if (!ex.right) this.classify(ex, o);
      this.extras(ex, o);
      return ex;
    },
    // an answer given: explained, and a wrong one's cause kept on the word
    answer(o) {
      const ex = this.build(o);
      if (ex && !ex.right) this.remember(ex);
      return ex;
    },
    classify(ex, o) {
      const l = ex.lang, y = ex.y, pair = o.pair, type = ex.type;
      // (a form of a family has the headword's meaning, not its own: "achieve = <meaning>")
      const mean = (s) => (s.form ? s.head + " = " + s.meaning : s.meaning || "");
      const vars = () => {
        const x = ex.x || {};
        return { x: x.word || ex.typed || "", xm: mean(x), y: y.word, ym: mean(y), h: y.head || y.word, hm: y.meaning, xa: this.posName(l, x.pos, true), ya: this.posName(l, y.pos, true), xp: this.posName(l, x.pos), yp: this.posName(l, y.pos) };
      };
      // (a form of a family as the answer: the template that names its headword, when there is one)
      const why = (k, more) => { if (y.form && this.t(l, "why." + k + "F")) k += "F"; ex.why = this.t(l, "why." + k, Object.assign(vars(), more || {})); };
      const heard = type === "listen" || type === "dictation" || o.clue === "audio";
      if (o.timeout) { ex.cause = "timeout"; why("timeout"); return; }
      // ---- a written answer ----
      if (o.typed != null && String(o.typed).trim()) {
        const t = ex.typed = G.Spell.norm(o.typed);
        const target = o.spellPair || pair;
        ex.diff = this.diff(t, G.Spell.answerOf(target), ex.wl);
        const info = G.WordBank.info(pair);
        const known = info && (info.commonMisspellings || []).some((w) => G.Spell.norm(w) === t);
        const owner = known ? null : G.WordBank.textOwner(t, ex.wl);
        if (owner && info && owner.id === info.id) {
          // another form of the same word ("indication" for "indicates")
          ex.cause = "form"; ex.x = this.side(pair, t);
          const xp = ex.x.pos, yp = y.pos;
          why(xp && yp && !G.POS.overlap(xp, yp) ? "form" : "form2");
          return;
        }
        const other = owner ? G.WordBank.pairOf(owner) : (ex.wl === "en" ? G.Distract.resolve(t) : null);
        if (other && G.wordKey(other) !== G.wordKey(pair)) {
          ex.x = this.side(other);
          if (this.confusable(pair, other)) {
            ex.cause = "confusable";
            const note = this.pairNote(l, y.form ? y.head : y.word, other[0]);
            if (note) { ex.why = note; ex.note = true; } else why(heard ? "sound" : "confuse");
          } else { ex.cause = "word"; why("word"); }
          this.againLine(ex, pair, other);
          return;
        }
        ex.cause = "spelling";
        const d = this.data(l), note = known && info && d && d.spelling ? d.spelling[info.id] || "" : "";
        if (note) { ex.why = note; ex.note = true; }
        else why(ex.diff.n > 2 ? "spellN" : "spell", { n: ex.diff.n });
        // (D4's own tip, in the menus' language, under it when there is no note)
        if (!note) ex.spellTip = G.Spell.tipFor(t, pair);
        return;
      }
      // ---- a word picked (a choice, a zombie shot) ----
      if (o.pickedForm || o.source === "family") {
        const f = o.pickedForm || (o.picked && o.picked[0]);
        ex.cause = "form"; ex.x = this.side(pair, f);
        why(ex.x.pos && y.pos && !G.POS.overlap(ex.x.pos, y.pos) ? "form" : "form2");
        return;
      }
      const p = o.picked;
      if (!p) { why("answer"); return; }
      ex.x = this.side(p);
      if (this.confusable(pair, p, o.source)) {
        ex.cause = "confusable";
        const note = this.pairNote(l, y.form ? y.head : y.word, p[0]);
        if (note) { ex.why = note; ex.note = true; } else why(heard ? "sound" : "confuse");
      } else if (type === "colloc" && o.colloc) {
        ex.cause = "colloc";
        why("colloc", { c: o.colloc.collocation || o.colloc.text.replace("___", o.colloc.answer), p: o.colloc.partner });
      } else if (heard) { ex.cause = "meaning"; why("heard"); }
      else if (type === "en2th") { ex.cause = "meaning"; why("meaningRev"); }
      else if (type === "cloze" || type === "clozespell") { ex.cause = "context"; why("context"); }
      else if (type === "def2word" || type === "defspell") { ex.cause = "context"; why("defn"); }
      else if (type === "paraphrase") { ex.cause = "context"; why("para"); }
      else if (ex.x.pos && y.pos && !G.POS.overlap(ex.x.pos, y.pos)) { ex.cause = "pos"; why("pos"); }
      else { ex.cause = "meaning"; why("meaning"); }
      this.againLine(ex, pair, p);
    },
    // (the player's own mix-ups, js/srs.js E2) "You have mixed these two up 3 times."
    againLine(ex, pair, other) {
      const n = G.SRS && G.SRS.confusionCount ? G.SRS.confusionCount(pair, other) : 0;
      if (n >= 2) ex.again = this.t(ex.lang, "why.again", { n });
    },
    // the example (in the Word Language, with its translation), the
    // collocations, the family, a tip
    extras(ex, o) {
      const pair = o.pair, info = G.WordBank.info(pair), l = ex.lang;
      const wl = ex.wl, ml = ex.ml, en = wl === "en";
      const list = (info && info.examples) || [];
      // the sentence of a question about it (a gap filled), else one with the
      // form asked, else the first
      let i = o.cloze && Number.isInteger(o.cloze.which) ? o.cloze.which : 0;
      if (!(o.cloze && Number.isInteger(o.cloze.which)) && ex.y.form) {
        const k = list.findIndex((s) => G.Clues.tokens(s).some((t) => low(t) === low(ex.y.word)));
        if (k >= 0) i = k;
      }
      if (list[i]) {
        const id = info.id;
        const tr = (lang) => {
          if (lang === "en") return list[i];
          const d = this.data(lang);
          return d && d.ex && d.ex[id] ? d.ex[id][i] || "" : "";
        };
        const text = en ? list[i] : tr(wl);
        const trans = ml === "en" ? (en ? "" : list[i]) : tr(ml);
        if (text) ex.example = { text, html: en ? G.Clues.markHtml(text, pair) : esc(text), lang: wl, tr: trans, trLang: ml, i };
      }
      ex.colls = en && info ? (info.collocations || []).slice(0, 3) : [];
      ex.family = en && info && !info.custom ? G.Clues.family(pair).filter((f) => low(f.word) !== low(ex.y.word)).slice(0, 4) : [];
      const d = this.data(l);
      ex.tip = info && !info.custom && d && d.explain ? d.explain[info.id] || "" : "";
    },

    // ---------------- drawing it ----------------
    // ✓ word (N.) = meaning -- a form of a family: ✓ achieved (V.) ← achieve = meaning
    line(s, mark, cls, wordHtml) {
      if (!s) return "";
      const pos = s.abbr ? ` <span class="pos-tag">(${esc(s.abbr)})</span>` : "";
      const from = s.form ? ` <span class="xp-from" lang="en">← ${esc(s.head)}</span>` : "";
      return `<div class="xp-l ${cls}"><span class="xp-m" aria-hidden="true">${mark}</span><b class="xp-w"${s.attr}>${wordHtml || s.html}</b>${pos}${from}${s.meaning ? ` <span class="xp-eq">=</span> <span class="xp-mean"${s.mattr}>${s.mhtml}</span>` : ""}${say(s.word, false, s.form ? "en" : ex_wl(s))}</div>`;
    },
    // is there more than the short version shows?
    hasMore(ex) { return !!(ex.example || ex.tip || ex.again || ex.colls.length || ex.family.length || ex.spellTip); },
    html(ex, full) {
      if (!ex) return "";
      const L = G.Lang.TAG[ex.lang] || "en";
      const out = [];
      if (ex.right) out.push(this.line(ex.y, "✓", "xp-y"));
      else {
        if (ex.typed) {
          const xm = ex.x ? ` <span class="xp-eq">=</span> <span class="xp-mean"${ex.x.mattr}>${ex.x.mhtml}</span>` : "";
          out.push(`<div class="xp-l xp-x"><span class="xp-m" aria-hidden="true">✗</span><b class="xp-w xp-typed"${G.Lang.attr(ex.wl)}>${ex.diff ? ex.diff.typed : esc(ex.typed)}</b>${xm}</div>`);
        } else if (ex.x) out.push(this.line(ex.x, "✗", "xp-x"));
        out.push(this.line(ex.y, "✓", "xp-y", ex.diff && ex.cause === "spelling" ? ex.diff.answer : ""));
        if (ex.why) out.push(`<div class="xp-why${ex.note ? " xp-note" : ""}" lang="${L}">${esc(ex.why)}</div>`);
      }
      const e = ex.example;
      const exHtml = e ? `<div class="xp-ex"><span class="xp-k" lang="${L}">${esc(this.t(ex.lang, "example"))}</span><span${G.Lang.attr(e.lang)}>${e.html}</span>${say(e.text, true, e.lang)}${full && e.tr ? `<div class="xp-tr"${G.Lang.attr(e.trLang)}>${esc(e.tr)}</div>` : ""}</div>` : "";
      const colls = ex.colls.length ? `<div class="xp-col"><span class="xp-k" lang="${L}">${esc(this.t(ex.lang, "goes"))}</span><span lang="en">${ex.colls.map((c) => G.Clues.markHtml(c, ex.y.pair)).join(" · ")}</span></div>` : "";
      const fam = ex.family.length ? `<div class="xp-fam"><span class="xp-k" lang="${L}">${esc(this.t(ex.lang, "family"))}</span><span lang="en">${ex.family.map((f) => esc(f.word) + (f.pos ? ` <span class="pos-tag">(${esc(G.POS.abbr(f.pos))})</span>` : "")).join(", ")}</span></div>` : "";
      if (ex.right) {
        // short: one example (or a collocation); full: its translation, the rest
        if (!full) { out.push(exHtml || colls); }
        else out.push(exHtml, colls, fam);
      } else if (full) {
        if (ex.again) out.push(`<div class="xp-again" lang="${L}">${esc(ex.again)}</div>`);
        if (ex.spellTip) out.push(`<div class="xp-tip">${esc(ex.spellTip)}</div>`);
        out.push(exHtml);
        if (ex.tip) out.push(`<div class="xp-tip" lang="${L}"><span class="xp-k">${esc(this.t(ex.lang, "tip"))}</span>${esc(ex.tip)}</div>`);
        out.push(colls, fam);
      }
      return `<div class="xp-body${full ? " full" : ""}" data-cause="${ex.cause}">${out.filter(Boolean).join("")}</div>`;
    },
    // the card while shooting: "✗ provide = <its meaning> · ✓ consist of = <its meaning>",
    // "✓ consist of (V.) = <its meaning>"; `xs` the words shot by mistake (merged)
    cardHtml(ex, xs) {
      const w = (s, pos) => `<b${s.attr}>${s.html}</b>${pos && s.abbr ? ` <span class="pos-tag">(${esc(s.abbr)})</span>` : ""}${s.meaning ? ` = <span${s.mattr}>${s.mhtml}</span>` : ""}`;
      if (ex.right) return `<span class="xc-y">✓ ${w(ex.y, true)}</span>`;
      xs = xs || (ex.x ? [ex.x] : []);
      const shown = xs.slice(-2).map((s) => w(s, false)).join(" · ");
      const more = xs.length > 2 ? ` <small>+${xs.length - 2}</small>` : "";
      const typed = !xs.length && ex.typed ? `<b${G.Lang.attr(ex.wl)}>${ex.diff ? ex.diff.typed : esc(ex.typed)}</b>` : "";
      const stress = ex.stress ? ` <small class="xc-stress" lang="en">${esc(ex.stress)}</small>` : "";
      return (shown || typed ? `<span class="xc-x">✗ ${shown || typed}${more}</span> <span class="xc-sep">·</span> ` : "") + `<span class="xc-y">✓ ${w(ex.y, false)}${stress}</span>`;
    },
    // as plain text, for the tests and the report: "✗ … / ✓ … / why / example"
    text(ex, full) {
      if (!ex) return "";
      const s = (x) => x ? `${x.word}${x.abbr ? " (" + x.abbr + ")" : ""}${x.form ? " ← " + x.head : ""}${x.meaning ? " = " + x.meaning : ""}` : "";
      const out = [];
      if (!ex.right && (ex.typed || ex.x)) out.push("✗ " + (ex.typed ? ex.typed + (ex.x ? " = " + ex.x.meaning : "") : s(ex.x)));
      out.push("✓ " + s(ex.y));
      if (ex.why) out.push(ex.why);
      if (full !== false) {
        if (ex.again) out.push(ex.again);
        if (ex.example) out.push(this.t(ex.lang, "example") + ": " + ex.example.text + (ex.example.tr ? " — " + ex.example.tr : ""));
        if (ex.tip) out.push(this.t(ex.lang, "tip") + ": " + ex.tip);
      }
      return out.join("\n");
    },

    // ---------------- the history: why a word was missed ----------------
    // G.save.learn.why = { key: [{ d: day, c: cause, x: the word or text taken, t: kind }] }, the last few
    remember(ex) {
      const L = G.save && G.save.learn;
      if (!L || !ex || ex.right) return;
      const key = G.wordKey(ex.y.pair);
      if (!key) return;
      const W = L.why = L.why || {};
      const list = W[key] = W[key] || [];
      const x = ex.typed || (ex.x ? (ex.x.form ? ex.x.word : G.wordKey(ex.x.pair)) : "");
      list.push({ d: G.Clock.today(), c: ex.cause, x: String(x).slice(0, 40), t: String(ex.type || "").slice(0, 12) });
      while (list.length > G.CONFIG.explain.history) list.shift();
    },
    history(pair) { const L = G.save && G.save.learn; return (L && L.why && L.why[G.wordKey(pair)]) || []; },
    // one entry in the menus' language: "✗ effect · look-alike"
    historyText(h) {
      const p = h.x && G.Distract.resolve(h.x);
      const w = p ? p[0] : h.x;
      return (w ? "✗ " + w + " · " : "") + T("explain.cause." + h.c);
    },

    // ---------------- from a question (js/questions.js) ----------------
    // the explanation of question q answered with k (a choice, the text
    // typed, -1 out of time); `record`: keep a wrong one's cause
    forQuestion(q, k, right, record) {
      const o = { pair: q.pair, form: q.answerText, type: q.type, right, colloc: q.colloc, cloze: q.cloze, spellPair: q.spellPair };
      if (k === -1) o.timeout = true;
      else if (q.spell) o.typed = typeof k === "string" ? k : "";
      else if (!right && q.choices[k]) {
        const c = q.choices[k];
        if (c.form && c.pair && G.wordKey(c.pair) === G.wordKey(q.pair)) o.pickedForm = c.form;
        else o.picked = c.pair;
      }
      return record ? this.answer(o) : this.build(o);
    },
    // a zombie shot (or spelt): z the zombie, tp the target asked, tc its clue
    forShot(z, right, tp, tc) {
      if (right) {
        const pair = z.pair, form = z.spellPair ? z.spellPair[0] : (tc && tc.kind === "cloze" && tp ? tp[0] : null);
        return this.build({ pair, form, right: true, clue: z.clueKind || (tc && tc.kind) || "thai", answer: z._spelled ? "spell" : "shoot" });
      }
      if (!tp || !tc) return null;
      const o = { pair: tc.pair || tp, form: tc.kind === "cloze" ? tp[0] : null, right: false, clue: tc.kind, answer: "shoot", source: z.decoy && z.decoy.source };
      if (z.decoy && z.decoy.source === "family") o.pickedForm = z.decoy.form || z.word;
      else o.picked = z.pair || [z.word, z.meaning];
      return this.answer(o);
    },

    // ---------------- the spot check (the report) ----------------
    // n explanations across the kinds of question and the causes, as text
    sample(n, seed) {
      const words = G.getAllBuiltinWords();
      const out = [];
      const pick = (i) => words[(i * 7919 + (seed || 0)) % words.length];
      const kinds = G.Questions.TYPES.concat(G.Questions.EXTRA);
      for (let i = 0; out.length < n && i < n * 6; i++) {
        const pair = pick(i), type = kinds[i % kinds.length];
        if (!G.Questions.can(type, pair)) continue;
        const q = G.Questions.build(pair, type, words);
        const right = i % 5 === 4;
        let k = right ? q.answer : (q.answer + 1) % 4;
        if (q.spell) {
          const info = G.WordBank.info(pair);
          k = right ? G.Questions.rightText(q) : ((info.commonMisspellings || [])[0] || G.Questions.rightText(q).replace(/[aeiou](?=[^aeiou]*$)/, (v) => (v === "e" ? "a" : "e")));
        }
        out.push({ type, right, text: this.text(this.forQuestion(q, k, right, false)) });
      }
      return out;
    },
  };

  // the word language of a side ("en" for a form of an English family)
  function ex_wl(s) { return s.pair ? G.Lang.wl(s.pair) : "en"; }
  // a sound button (js/vocabcard.js binds them): the word, or a sentence in its language
  function say(text, sentence, lang) {
    if (!text) return "";
    return `<button class="vc-say xp-say" type="button" data-say="${esc(text)}"${sentence ? " data-text" : ""}${lang ? ` data-lang="${esc(lang)}"` : ""} aria-label="${esc(T(sentence ? "card.hearSentence" : "card.hear"))}">🔊</button>`;
  }

  // ---------------- in a question's window ----------------
  // show(el, ex, o) -> a view: { ex, full, toggle(), done() }
  //   o: { onContinue, label (the button's text), auto (seconds before it
  //        goes on by itself -- a right answer, Settings > Auto-continue) }
  // Enter / Space / a tap / a controller's A on Continue; M (or the button)
  // for More. The question's own keys (1-4) do nothing while it is up.
  G.ExplainView = {
    show(el, ex, o) {
      o = o || {};
      const v = { el, ex, o, full: set().explainDetail === "full", left: o.auto || 0, held: false, closed: false };
      v.toggle = () => { v.full = !v.full; v.held = true; this.render(v, true); };
      v.done = () => { if (v.closed) return; v.closed = true; if (o.onContinue) o.onContinue(); };
      this.render(v);
      return v;
    },
    render(v, keepFocus) {
      const ex = v.ex, more = G.Explain.hasMore(ex);
      const auto = v.left > 0 && !v.held ? `<div class="xp-auto"><i style="animation-duration:${v.left}s"></i></div>` : "";
      v.el.innerHTML = `<div class="xp ${ex.right ? "xp-ok" : "xp-bad"}">${G.Explain.html(ex, v.full)}
        <div class="xp-btns">${more ? `<button class="btn xp-more" type="button" aria-expanded="${v.full}">${esc(T(v.full ? "explain.less" : "explain.more"))} <span class="kbd-only dlg-key">(M)</span></button>` : ""}<button class="btn btn-primary qf-next" type="button" data-pad-back>${esc(v.o.label || T("challenge.continue"))} <span class="kbd-only dlg-key">(Enter)</span></button></div>${auto}</div>`;
      G.VocabCard.bind(v.el);
      const m = v.el.querySelector(".xp-more");
      if (m) m.onclick = () => v.toggle();
      v.el.querySelector(".qf-next").onclick = () => v.done();
      const focus = () => {
        const b = v.el.querySelector(keepFocus && m ? ".xp-more" : ".qf-next");
        if (!b || v.closed || G.Input.mode === "touch") return;
        b.focus({ preventScroll: true });
        if (G.Pad && G.Pad.focused && G.Pad.setFocus) G.Pad.setFocus(b);
      };
      setTimeout(focus, 0);
    },
    // a key while it is up: true when used ("continue" or "more")
    key(v, e) {
      if (!v || v.closed) return false;
      if (e.code === "Enter" || e.code === "Space" || e.code === "NumpadEnter") { if (e.preventDefault) e.preventDefault(); v.done(); return true; }
      if (e.code === "KeyM" && G.Explain.hasMore(v.ex)) { v.toggle(); return true; }
      return false;
    },
    // the clock of Auto-continue (the owner's own clock: a paused game's windows run on)
    tick(v, dt) {
      if (!v || v.closed || v.held || !(v.left > 0)) return;
      v.left -= dt;
      if (v.left <= 0) v.done();
    },
    // Settings > Auto-continue after a right answer: seconds, 0 = off
    autoSeconds() { const n = Number(set().autoContinue); return Number.isFinite(n) && n > 0 ? n : 0; },
  };

  // ---------------- while shooting ----------------
  // a short card under the word box (never over the combo or the boss's
  // bar): a wrong word 3.5 s, a right one 2 s. Wrong shots in quick
  // succession on the same target make one card.
  G.ExplainCard = {
    cur: null,
    on() { return set().explainCards !== false; },
    show(ex) {
      if (!ex || !this.on()) return;
      const el = document.getElementById("hud-xcard");
      if (!el) return;
      const now = performance.now(), C = G.CONFIG.explain;
      let c = this.cur;
      if (!ex.right && c && !c.ex.right && c.until > now && G.wordKey(c.ex.y.pair) === G.wordKey(ex.y.pair)) {
        if (ex.x && !c.xs.some((s) => low(s.word) === low(ex.x.word))) c.xs.push(ex.x);
        c.n++;
      } else c = this.cur = { ex, xs: ex.x ? [ex.x] : [], n: 1 };
      c.until = now + (ex.right ? C.cardRight : C.cardWrong) * 1000;
      el.innerHTML = G.Explain.cardHtml(c.ex, c.xs);
      el.className = "hud-xcard " + (ex.right ? "ok" : "bad");
      void el.offsetWidth; el.classList.add("show");
      clearTimeout(this._t);
      this._t = setTimeout(() => this.hide(), c.until - now);
    },
    hide() { clearTimeout(this._t); this.cur = null; const el = document.getElementById("hud-xcard"); if (el) { el.className = "hud-xcard hidden"; el.innerHTML = ""; } },
  };

  // the files for the languages chosen, once the save is read and when they change
  ["vz-uilang", "vz-langs"].forEach((ev) => window.addEventListener(ev, () => { if (G.save) X.preload(); }));
})();
