// ===================================================================
// Spelling (vocabulary series, round 2, D): the Spell answer
// -------------------------------------------------------------------
// The player writes the word instead of shooting it.
//   keyboard      a zombie shows its clue (the meaning) over its head; the
//                 player types the word in the bar at the bottom of the
//                 screen and Enter fires at whichever zombie on the field
//                 carries it. Letters all go into the bar, so the arrow
//                 keys walk in this mode (D1).
//   touch, pad    the letters of one zombie's word -- the nearest, the one
//                 the pad shows -- are laid out shuffled with two or three
//                 extra ones; tap (or D-pad + A) them in order, tap a placed
//                 letter to take it back. The word shoots itself once every
//                 letter is in (D3).
//   help          dashes show how many letters from the start; a hint puts
//                 in the next letter and takes a share of the kill's money
//                 and score (and a hinted answer moves no box, js/srs.js)
//   wrong         the letters are marked -- right place green, wrong red, a
//                 letter missing a grey box -- and the right word is shown;
//                 a well-known misspelling gets its own note (D4). Spelling
//                 within two letters of a word on the field is a misspelling
//                 of that word; anything else is simply a miss.
// Every spelling in the word's acceptedSpellings is right, in any case,
// spaces at the ends ignored.
//
// (Round 3, H5) In every Word Language, by its own units (G.SpellUnits):
//   English   letters, typed as before (a key on the Thai layout still types
//             its English letter)
//   French    letters with their accents; on screen the accent buttons
//             (é è ê à â ç î ô ù û) for a keyboard without them. Strict
//             accents (Settings) off: a missing or wrong accent is right,
//             and the word is shown with its accents
//   Chinese   the characters: put together from the word's own and a few
//             others, or typed -- the characters themselves through an IME,
//             or the pinyin without tones (fenxi for 分析)
//   Thai      the tiles are its grapheme clusters (a consonant with the
//             vowels and tone mark above and below it, as one)
// A word in another language than English is typed into a real text field
// (it takes the IME, dead keys, the Thai keyboard), and Enter never answers
// while an IME is still composing.
//
// Also here: Spell to Reload (D2), a setting for the ordinary modes -- a
// reload asks for one of the wave's words first (the whole magazine if it
// is right, half if not), while the player stands still.
// ===================================================================
window.G = window.G || {};

(function () {
  const T = (k, v) => G.T(k, v);
  const esc = (s) => G.escapeHtml(String(s));
  const C = () => G.CONFIG.spell;
  const LETTER = /^[a-z]$/i;

  // ---------------- a language's units (round 3, H5) ----------------
  const THAI = /[\u0E00-\u0E7F]/, HAN = /[\u3400-\u9FFF]/, ALPHA = /^[A-Za-z\u00C0-\u024F]$/;
  const segmenter = (() => { try { return window.Intl && Intl.Segmenter ? new Intl.Segmenter("th", { granularity: "grapheme" }) : null; } catch (e) { return null; } })();
  const U = G.SpellUnits = {
    // the language a pair is spelt in (a form a sentence asks for is English)
    lang(pair) { return !pair || pair.exact ? "en" : G.Lang.wl(pair); },
    // Thai: grapheme clusters -- a consonant with what sits above and below it
    graphemes(s) {
      s = String(s);
      if (segmenter) return Array.from(segmenter.segment(s), (x) => x.segment);
      return s.match(/[\s\S][\u0E31\u0E33-\u0E3A\u0E47-\u0E4E]*/g) || [];
    },
    // a word as units: [{ch, fixed}] -- a space, a hyphen, an apostrophe are fixed
    split(word, lang) {
      const s = String(word == null ? "" : word);
      const list = lang === "th" ? this.graphemes(s) : Array.from(s);
      return list.map((ch) => ({ ch, fixed: lang === "th" ? !THAI.test(ch) : lang === "zh" ? !HAN.test(ch) : !ALPHA.test(ch) }));
    },
    // the same text split as typed (Chinese typed as pinyin: its letters)
    pieces(s, lang) { return this.split(s, lang).map((u) => u.ch); },
    // French without its accents (and ü -> u, for pinyin)
    fold(s) { return String(s).normalize("NFD").replace(/[\u0300-\u036F]/g, "").normalize("NFC"); },
    // pinyin as it is typed without tones: letters only ("fēn xī" -> "fenxi"; v for ü)
    toneless(py) { return this.fold(String(py).toLowerCase()).replace(/[^a-z]/g, ""); },
    typedPinyin(s) { return String(s).toLowerCase().replace(/v/g, "u").replace(/[^a-z]/g, ""); },
    // the units a word is spelt with (not spaces, hyphens...), how many, the first few
    letters(word, lang) { return this.split(word, lang || "en").filter((u) => !u.fixed).map((u) => u.ch); },
    count(word, lang) { return this.letters(word, lang).length; },
    first(word, lang, n) { return this.letters(word, lang).slice(0, n || 1).join(""); },
    // a word's length as letters: a Chinese character is worth three
    weight(word, lang) { lang = lang || "en"; const n = this.count(word, lang); return lang === "zh" ? n * 3 : n; },
    isLatin(s) { return /^[a-z\s'\u2019-]+$/i.test(String(s)); },
  };

  // ---------------- words: what counts as right ----------------
  const S = G.Spell = {
    norm(s) { return String(s == null ? "" : s).trim().replace(/\s+/g, " ").replace(/\u2019/g, "'").toLowerCase(); },
    // the character a key press types -- the English letter of the key even
    // when the keyboard is left on the Thai layout (e.key would be Thai)
    // what a zombie's spelling is checked against: its word -- or, asked
    // with a gapped sentence, the form the sentence wants (round 4)
    target(z) { return z.spellPair || z.pair; },
    keyChar(e) {
      const k = e.key;
      if (k && k.length === 1 && !/[a-z '\-]/i.test(k) && /^Key[A-Z]$/.test(e.code || "")) return e.code.slice(3).toLowerCase();
      return k;
    },
    // the spelling the pad asks for (the headword) and every accepted one
    answerOf(pair) { return String(pair[0]); },
    accepted(pair) {
      // (a form a sentence asks for -- "indication" -- is the only right spelling)
      if (pair && pair.exact) return [this.norm(pair[0])];
      // (round 3: the other spellings in the bank are English ones)
      const info = U.lang(pair) === "en" ? G.WordBank.info(pair) : null;
      const list = (info && info.acceptedSpellings && info.acceptedSpellings.length ? info.acceptedSpellings : [pair[0]]).map((w) => this.norm(w));
      if (!list.includes(this.norm(pair[0]))) list.push(this.norm(pair[0]));
      return list;
    },
    // (round 3) the forms a typed answer is compared in: French without
    // accents unless they are strict; Chinese typed in Latin letters as its
    // toneless pinyin
    strict() { return !!(G.save && G.save.settings.strictAccents); },
    compare(text, pair) {
      const lang = U.lang(pair), t = this.norm(text);
      if (lang === "zh" && U.isLatin(t)) {
        const py = U.toneless(G.Lang.pinyin(pair, 0) || "");
        return { t: U.typedPinyin(t), list: py ? [py] : [], pinyin: true };
      }
      if (lang === "zh") return { t: t.replace(/\s+/g, ""), list: this.accepted(pair).map((a) => a.replace(/\s+/g, "")) };
      if (lang === "fr" && !this.strict()) return { t: U.fold(t), list: this.accepted(pair).map((a) => U.fold(a)) };
      return { t, list: this.accepted(pair) };
    },
    isRight(text, pair) {
      const c = this.compare(text, pair);
      return !!c.t && c.list.includes(c.t);
    },
    // right only once the accents are forgiven: the word as it is written ("" otherwise)
    accentFix(text, pair) {
      if (U.lang(pair) !== "fr" || this.strict()) return "";
      const t = this.norm(text);
      return this.isRight(text, pair) && !this.accepted(pair).includes(t) ? this.answerOf(pair) : "";
    },
    distance(text, pair) { const c = this.compare(text, pair); return c.list.length ? Math.min(...c.list.map((a) => G.Distract.distance(c.t, a, 6))) : 99; },
    // how far off still counts as a misspelling of this word, not another
    // (a two-character Chinese word is all of it two away)
    nearMiss(pair) {
      const n = C().nearMiss;
      if (U.lang(pair) !== "zh") return n;
      return Math.max(0, Math.min(n, Math.floor(String(pair[0]).length / 2)));
    },

    // unit by unit against the answer: [{ch, cls: ok | bad | miss}]
    markup(typed, answer, lang) {
      lang = lang || "en";
      let A = U.pieces(this.norm(typed), lang), B = U.pieces(String(answer), lang);
      // (Chinese typed as pinyin is marked against the pinyin)
      if (lang === "zh" && U.isLatin(typed) && answer && HAN.test(answer)) {
        const z = G.WordBank.byText(answer, "zh");
        if (z) B = Array.from(U.toneless(z.pinyin));
        A = Array.from(U.typedPinyin(typed));
      }
      const lowU = (x) => String(x).toLowerCase();
      const same = (x, y) => lowU(x) === lowU(y) || (lang === "fr" && !this.strict() && U.fold(lowU(x)) === U.fold(lowU(y)));
      const n = A.length, m = B.length;
      const d = [];
      for (let i = 0; i <= n; i++) { d[i] = []; for (let j = 0; j <= m; j++) d[i][j] = i === 0 ? j : j === 0 ? i : 0; }
      for (let i = 1; i <= n; i++) for (let j = 1; j <= m; j++) {
        d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (same(A[i - 1], B[j - 1]) ? 0 : 1));
      }
      const out = [];
      let i = n, j = m;
      while (i > 0 || j > 0) {
        if (i > 0 && j > 0 && d[i][j] === d[i - 1][j - 1] + (same(A[i - 1], B[j - 1]) ? 0 : 1)) {
          out.push({ ch: A[i - 1], cls: same(A[i - 1], B[j - 1]) ? "ok" : "bad" }); i--; j--;
        } else if (j > 0 && d[i][j] === d[i][j - 1] + 1) { out.push({ ch: B[j - 1], cls: "miss" }); j--; }
        else { out.push({ ch: A[i - 1], cls: "bad" }); i--; }
      }
      return out.reverse();
    },

    // D4: a note for one of the word's well-known misspellings, about the
    // spelling it goes wrong on (the word itself, or a form of it: "occured"
    // is "occurred" misspelt): "accommodation has double c and double m",
    // "plagiarism has "i" after "g"", "achieve has "ie" after "h", not "ei""
    // (round 3: English words only -- the bank's misspellings are English)
    tipFor(typed, pair) {
      if (U.lang(pair) !== "en") return "";
      const info = G.WordBank.info(pair);
      const t = this.norm(typed);
      if (!info || !(info.commonMisspellings || []).some((w) => this.norm(w) === t)) return "";
      const word = this.nearestForm(t, pair, info);
      const runs = (s) => { const r = []; for (const ch of s.toLowerCase()) { if (r.length && r[r.length - 1].c === ch) r[r.length - 1].n++; else r.push({ c: ch, n: 1 }); } return r; };
      const ra = runs(word), rt = runs(t);
      const parts = [];
      if (ra.length === rt.length && ra.every((r, k) => r.c === rt[k].c)) {
        ra.forEach((r, k) => {
          if (r.n === 2 && rt[k].n === 1) parts.push(T("spell.double", { c: r.c }));
          else if (r.n === 1 && rt[k].n === 2) parts.push(T("spell.single", { c: r.c }));
        });
      }
      // otherwise the first two places it goes wrong: letters missing, extra
      // or different (a run of them side by side is one place)
      if (!parts.length) {
        for (const o of this.edits(t, word.toLowerCase())) {
          if (parts.length >= 2) break;
          const v = { c: o.want, x: o.got, p: o.after };
          const k = !o.got ? "spell.missing" : !o.want ? "spell.extra" : "spell.wrongLetter";
          parts.push(T(o.after ? k : k + "Start", v));
        }
      }
      return parts.length ? T("spell.tipHas", { w: word, list: parts.join(T("spell.and")) }) : T("spell.tipNot", { w: word, x: t });
    },
    // the spelling a misspelling was meant to be: the word, one of its
    // accepted spellings or family, or a regular form (-s, -ed, -ing)
    nearestForm(t, pair, info) {
      const h = this.answerOf(pair).toLowerCase(), last = h.slice(-1);
      // (the likelier first: on a tie the earlier one is kept)
      const forms = [h + last + "ed", h + "ed", h + last + "ing", h + "ing", h + "s"];
      if (last === "e") forms.push(h + "d", h.slice(0, -1) + "ing");
      if (/(s|x|z|ch|sh)$/.test(h)) forms.push(h + "es");
      if (last === "y") forms.push(h.slice(0, -1) + "ies", h.slice(0, -1) + "ied");
      const cands = [h].concat((info.acceptedSpellings || []).map((w) => this.norm(w)), (info.family || []).map((m) => this.norm(m && m.word)), forms)
        // (a made-up form can be the misspelling itself: "criteria" + s)
        .filter((c) => c && c !== t && !(info.commonMisspellings || []).some((w) => this.norm(w) === c));
      let best = h, bestD = Infinity;
      cands.forEach((c) => { const d = G.Distract.distance(t, c, 6); if (d < bestD) { bestD = d; best = c; } });
      return best === h ? this.answerOf(pair) : best;
    },
    // what it takes to turn `typed` into `answer`, in order, a place at a
    // time: [{want, got, after}] -- the right letters, the ones typed there,
    // and the right letter before the place ("" at the start)
    edits(typed, answer) {
      const a = typed, b = answer, n = a.length, m = b.length, d = [];
      for (let i = 0; i <= n; i++) { d[i] = []; for (let j = 0; j <= m; j++) d[i][j] = i === 0 ? j : j === 0 ? i : 0; }
      for (let i = 1; i <= n; i++) for (let j = 1; j <= m; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      const ops = [];                 // (from the end) {j: where in the answer, want, got}
      let i = n, j = m;
      while (i > 0 || j > 0) {
        if (i > 0 && j > 0 && d[i][j] === d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)) {
          if (a[i - 1] !== b[j - 1]) ops.push({ j: j - 1, want: b[j - 1], got: a[i - 1] });
          i--; j--;
        } else if (j > 0 && d[i][j] === d[i][j - 1] + 1) { ops.push({ j: j - 1, want: b[j - 1], got: "" }); j--; }
        else { ops.push({ j, want: "", got: a[i - 1] }); i--; }
      }
      ops.reverse();
      // side by side: one place
      const out = [];
      ops.forEach((o) => {
        const g = out[out.length - 1];
        if (g && o.j <= g.end + 1) { g.want += o.want; g.got += o.got; g.end = Math.max(g.end, o.j); }
        else out.push({ start: o.j, end: o.j, want: o.want, got: o.got });
      });
      return out.map((g) => ({ want: g.want, got: g.got, after: b[g.start - 1] || "" }));
    },
    // (round 3) the keys a pad in a text field leaves to the field: true when
    // the key belongs to it -- the caller then does nothing with it (and does
    // not stop the browser typing it)
    fieldKey(e) {
      const k = e.key || "";
      return e.isComposing || e.keyCode === 229 || k === "Process" || k === "Dead" || k === "Backspace" || k === "Delete" || k.length === 1;
    },
  };

  // decoy tiles: English and French letters, Thai clusters and Chinese characters from other words
  const ABC = { en: "etaoinshrdlcumpbgfywkv", fr: "eaisnrtoluedcmp\u00E9\u00E8\u00E0" };
  const decoyFrom = (lang, avoid) => {
    if (lang === "th" || lang === "zh") {
      const all = G.WordBank.entries();
      for (let k = 0; k < 20; k++) {
        const e = all[Math.floor(G.rng() * all.length)];
        const units = U.split(G.Lang.text(e, lang), lang).filter((u) => !u.fixed).map((u) => u.ch);
        const u = units[Math.floor(G.rng() * units.length)];
        if (u && !avoid.includes(u)) return u;
      }
      return lang === "zh" ? "\u7684" : "\u0E01";
    }
    const abc = ABC[lang] || ABC.en;
    return abc[Math.floor(G.rng() * abc.length)];
  };
  const ACCENTS = ["\u00E9", "\u00E8", "\u00EA", "\u00E0", "\u00E2", "\u00E7", "\u00EE", "\u00F4", "\u00F9", "\u00FB"];

  // ---------------- the pad: one word, typed or put together from tiles ----------------
  // G.SpellPad(root, { mode: "type" | "tiles", onSubmit(text), onHint(), actions: [{id, label, fn}] })
  G.SpellPad = function (root, opts) {
    this.root = root; this.opts = opts || {};
    this.mode = this.opts.mode || "type";
    this.pair = null; this.answer = ""; this.units = []; this.lang = "en"; this.typed = ""; this.tiles = []; this.placed = []; this.cursor = 0; this.feedback = null;
    root.classList.add("spad");
    root.innerHTML = `<div class="spad-clue" lang="th"></div><div class="spad-slots" aria-live="polite"></div>
      <input class="spad-input hidden" type="text" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" aria-label="${esc(T("spell.fieldLabel"))}">
      <div class="spad-tiles"></div><div class="spad-actions"></div><div class="spad-msg" role="status"></div>`;
    this.el = (c) => root.querySelector(".spad-" + c);
    this.input = this.el("input");
    this.el("tiles").addEventListener("click", (e) => {
      const a = e.target.closest("button[data-acc]");
      if (a) { this.insert(a.dataset.acc); return; }
      const b = e.target.closest("button[data-t]"); if (b) this.place(+b.dataset.t);
    });
    this.el("slots").addEventListener("click", (e) => { const b = e.target.closest("[data-s]"); if (b && this.mode === "tiles") this.unplace(+b.dataset.s); });
    this.el("actions").addEventListener("click", (e) => { const b = e.target.closest("button[data-act]"); if (b) this.action(b.dataset.act); });
    // (round 3) the text field: what is typed, an IME's composing kept apart
    // -- Enter never answers while it is still composing
    const inp = this.input;
    inp.addEventListener("compositionstart", () => { this.composing = true; });
    inp.addEventListener("compositionend", () => { this.composing = false; this.fromField(); });
    inp.addEventListener("input", () => this.fromField());
    // (Enter, Tab and the rest are the window's to handle: G.Spell.onKey,
    // G.QuestionView.key, G.SpellReload.key -- they leave the field its keys)
    inp.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === "Tab") e.preventDefault(); });
    // (a touch press answers at once; the click that follows is ignored)
    root.addEventListener("touchstart", (e) => {
      const b = e.target.closest("button[data-t], button[data-acc], [data-s], button[data-act]");
      if (!b) return;
      e.preventDefault();
      G.touchFeedback && G.touchFeedback(b);
      if (b.dataset.acc != null) this.insert(b.dataset.acc);
      else if (b.dataset.t != null) this.place(+b.dataset.t);
      else if (b.dataset.s != null) { if (this.mode === "tiles") this.unplace(+b.dataset.s); }
      else this.action(b.dataset.act);
    }, { passive: false });
  };
  const P = G.SpellPad.prototype;
  P.setMode = function (m) { if (m === this.mode) return; this.mode = m; if (this.pair) this.setWord(this.pair, this.clue, true); };
  // fixed characters (a space, a hyphen, an apostrophe) are not tiles: they sit in their slots already
  P.fixed = function (i) { const u = this.units[i]; return !u || u.fixed; };
  // (round 3) a word in another language than English is typed into the text field
  P.usesField = function () { return this.mode === "type" && !!this.pair && this.lang !== "en"; };
  P.focusField = function () {
    if (!this.usesField() || document.activeElement === this.input) return;
    try { this.input.focus({ preventScroll: true }); } catch (e) { this.input.focus(); }
  };
  P.fromField = function () {
    if (this.feedback) { this.feedback = null; }
    this.typed = String(this.input.value || "").slice(0, 40);
    this.render();
  };
  // a character put in from the screen (an accent button)
  P.insert = function (ch) {
    if (this.feedback) this.clearFeedback();
    if (this.typed.length < 40) this.typed += ch;
    this.input.value = this.typed;
    this.render();
    this.focusField();
  };
  P.setWord = function (pair, clue, keepTyped) {
    const same = this.pair && pair && this.pair[0] === pair[0];
    this.pair = pair; this.clue = clue || "";
    this.answer = pair ? S.answerOf(pair) : "";
    this.lang = U.lang(pair);
    this.units = U.split(this.answer, this.lang);
    // (typing: what is typed stays when the zombie in focus changes -- Enter
    // is checked against every zombie on the field)
    if (!keepTyped) { this.typed = ""; this.input.value = ""; }
    if (!same || !keepTyped) this.hints = 0;
    if (this.mode === "tiles" && pair) {
      const want = this.units.filter((u) => !u.fixed).map((u) => (this.lang === "en" || this.lang === "fr" ? u.ch.toLowerCase() : u.ch));
      const letters = want.slice();
      const [lo, hi] = C().decoyLetters;
      const extra = lo + Math.floor(G.rng() * (hi - lo + 1));
      for (let k = 0; k < extra; k++) letters.push(decoyFrom(this.lang, this.lang === "zh" || this.lang === "th" ? want.concat(letters) : []));
      let sh = G.shuffle(letters);
      for (let t = 0; t < 4 && sh.slice(0, want.length).join("") === want.join(""); t++) sh = G.shuffle(letters);
      this.tiles = sh.map((ch) => ({ ch, used: false }));
      this.placed = [];
      this.cursor = 0;
    }
    this.input.lang = G.Lang.TAG[this.lang] || "en";
    this.render();
  };
  // the text as it stands
  P.text = function () {
    if (this.mode === "type") return this.typed;
    let out = "", k = 0;
    for (let i = 0; i < this.units.length; i++) {
      if (this.fixed(i)) { out += this.units[i].ch; continue; }
      const t = this.placed[k++];
      if (t == null) break;
      out += this.tiles[t].ch;
    }
    return out;
  };
  P.letterCount = function () { return this.units.filter((u) => !u.fixed).length; };
  P.full = function () { return this.mode === "tiles" && this.placed.length >= this.letterCount(); };
  P.type = function (ch) { if (this.feedback) this.clearFeedback(); if (this.typed.length < 40) this.typed += ch; this.input.value = this.typed; this.render(); };
  P.back = function () {
    if (this.feedback) this.clearFeedback();
    if (this.mode === "type") { this.typed = Array.from(this.typed).slice(0, -1).join(""); this.input.value = this.typed; }
    else if (this.placed.length) this.tiles[this.placed.pop()].used = false;
    this.render();
  };
  P.clear = function () { this.typed = ""; this.input.value = ""; this.placed.forEach((t) => { this.tiles[t].used = false; }); this.placed = []; this.render(); };
  P.place = function (t) {
    const tile = this.tiles[t];
    if (!tile || tile.used || this.full()) return;
    if (this.feedback) this.clearFeedback();
    tile.used = true; this.placed.push(t);
    this.cursor = Math.min(t, this.tiles.length - 1);
    G.Audio && G.Audio.tone && G.Audio.ctx && G.Audio.tone({ type: "triangle", freq: 880 + this.placed.length * 30, dur: 0.04, gain: 0.04 });
    this.render();
    if (this.full() && this.opts.onSubmit) this.opts.onSubmit(this.text());
  };
  // a placed letter tapped: it and everything after it go back
  P.unplace = function (slotLetterIndex) {
    while (this.placed.length > slotLetterIndex) this.tiles[this.placed.pop()].used = false;
    this.render();
  };
  // the next right unit, the wrong ones after the right start taken out
  P.hint = function () {
    if (!this.pair) return false;
    if (this.feedback) this.clearFeedback();
    const lowU = (s) => (this.lang === "en" || this.lang === "fr" ? String(s).toLowerCase() : String(s));
    const want = this.units.map((u) => lowU(u.ch));
    if (this.mode === "type") {
      const t = U.pieces(this.typed, this.lang).map(lowU);
      let k = 0; while (k < t.length && k < want.length && t[k] === want[k]) k++;
      if (k >= want.length) return false;
      let next = k + 1;
      while (next < want.length && this.units[next - 1].fixed) next++;
      this.typed = this.units.slice(0, next).map((u) => u.ch).join("");
      this.input.value = this.typed;
    } else {
      const letters = this.units.filter((u) => !u.fixed).map((u) => lowU(u.ch));
      let k = 0; while (k < this.placed.length && this.tiles[this.placed[k]].ch === letters[k]) k++;
      if (k >= letters.length) return false;
      while (this.placed.length > k) this.tiles[this.placed.pop()].used = false;
      const t = this.tiles.findIndex((x) => !x.used && x.ch === letters[k]);
      if (t < 0) return false;
      this.tiles[t].used = true; this.placed.push(t);
    }
    this.hints = (this.hints || 0) + 1;
    this.render();
    if (this.full() && this.opts.onSubmit) this.opts.onSubmit(this.text());
    return true;
  };
  P.action = function (id) {
    if (id === "back") this.back();
    else if (id === "hint") { if (this.opts.onHint) this.opts.onHint(); else this.hint(); }
    else if (id === "enter") { if (this.opts.onSubmit) this.opts.onSubmit(this.text()); }
    else { const a = (typeof this.opts.actions === "function" ? this.opts.actions() : this.opts.actions || []).find((x) => x.id === id); if (a) a.fn(); }
    this.focusField();
  };
  // a wrong answer, marked up; `tip` a note under it
  P.showFeedback = function (typed, answer, tip, extraHtml) {
    this.feedback = { parts: S.markup(typed, answer, this.lang), answer, tip: tip || "", extra: extraHtml || "", until: performance.now() + C().feedbackSeconds * 1000 };
    this.render();
  };
  // (round 3) a right answer with an accent forgiven: the word as it is written, a moment
  P.showAccent = function (word) {
    this.accentNote = { word, until: performance.now() + C().feedbackSeconds * 1000 };
    this.render();
  };
  P.clearFeedback = function () { this.feedback = null; this.typed = ""; this.input.value = ""; this.placed.forEach((t) => { this.tiles[t].used = false; }); this.placed = []; this.render(); };
  P.tick = function () {
    if (this.feedback && performance.now() > this.feedback.until) this.clearFeedback();
    if (this.accentNote && performance.now() > this.accentNote.until) { this.accentNote = null; this.render(); }
  };
  // controller: move over the tiles, place the one lit
  P.moveCursor = function (d) {
    const n = this.tiles.length;
    if (!n) return;
    const cols = this.cols || n;
    if (d === "left") this.cursor = (this.cursor - 1 + n) % n;
    else if (d === "right") this.cursor = (this.cursor + 1) % n;
    else if (d === "up") this.cursor = Math.max(0, this.cursor - cols);
    else if (d === "down") this.cursor = Math.min(n - 1, this.cursor + cols);
    this.render();
  };
  P.render = function () {
    this.root.dataset.mode = this.mode;
    this.root.dataset.lang = this.lang;
    const clue = this.el("clue");
    // (a Chinese meaning: its pinyin over it)
    const py = this.pair && this.clue && this.clue === this.pair[1] && G.Lang.showPinyin() ? G.Lang.pinyin(this.pair, 1) : "";
    if (py) clue.innerHTML = `<ruby>${esc(this.clue)}<rt>${esc(py)}</rt></ruby>`; else clue.textContent = this.clue || "";
    clue.lang = G.Lang.TAG[this.pair ? G.Lang.ml(this.pair) : G.Lang.meaning()] || "th";
    clue.classList.toggle("hidden", !this.clue || !!this.opts.noClue);
    // the field takes the typing of a word in another language than English
    const field = this.usesField();
    this.input.classList.toggle("hidden", !field);
    // the slots: a box per unit, dashes until filled
    const slots = this.el("slots");
    slots.lang = G.Lang.TAG[this.lang] || "en";
    if (this.feedback) {
      slots.innerHTML = this.feedback.parts.map((p) => `<span class="sp-slot ${p.cls}">${p.cls === "miss" ? "" : esc(p.ch)}</span>`).join("");
      slots.classList.add("marked");
    } else {
      slots.classList.remove("marked");
      // (a long word: closer, smaller boxes, so it still fits a phone)
      slots.classList.toggle("long", this.units.length > 11);
      // (by units: Thai clusters, Chinese characters -- or the pinyin letters typed)
      const txtU = U.pieces(this.lang === "en" ? this.text().toLowerCase() : this.text(), this.lang);
      const len = Math.max(this.units.length, this.mode === "type" ? txtU.length : 0);
      let html = "", letterIdx = 0;
      for (let i = 0; i < len; i++) {
        const fixedCh = i < this.units.length && this.fixed(i);
        const ch = this.mode === "type" ? txtU[i] : fixedCh ? this.units[i].ch : txtU[i];
        // (the next box to fill blinks, like a caret)
        const cls = fixedCh ? "fixed" : ch ? "filled" : i === txtU.length ? "empty cur" : "empty";
        const attr = this.mode === "tiles" && !fixedCh ? ` data-s="${letterIdx}" role="button"` : "";
        if (!fixedCh) letterIdx++;
        html += `<span class="sp-slot ${cls}"${attr}>${ch && ch !== " " ? esc(ch) : ch === " " ? "&nbsp;" : ""}</span>`;
      }
      slots.innerHTML = html;
    }
    // the tiles (touch and controller) -- or, typing French, the accent buttons
    const tiles = this.el("tiles");
    const accents = this.mode === "type" && this.lang === "fr" && !this.opts.noAccents;
    tiles.classList.toggle("hidden", this.mode !== "tiles" && !accents);
    tiles.classList.toggle("spad-accents", accents);
    if (this.mode === "tiles") {
      // as many to a row as fit at a finger's width (~42px), in rows of even
      // length -- a long word on a phone takes two or three rows
      const n = this.tiles.length, W = tiles.clientWidth;
      const fit = W > 0 ? Math.max(4, Math.floor((W + 6) / 48)) : 12;
      const rows = Math.ceil(n / Math.max(1, Math.min(n, fit)));
      this.cols = Math.ceil(n / rows);
      this._w = W;
      tiles.style.setProperty("--cols", this.cols);
      tiles.lang = G.Lang.TAG[this.lang] || "en";
      tiles.innerHTML = this.tiles.map((t, i) => `<button class="sp-tile${t.used ? " used" : ""}${i === this.cursor && this.opts.showCursor && this.opts.showCursor() ? " cursor" : ""}" data-t="${i}" ${t.used ? "disabled" : ""}>${esc(t.ch)}</button>`).join("");
    } else if (accents) {
      if (tiles.dataset.acc !== "1") {
        tiles.dataset.acc = "1";
        tiles.style.setProperty("--cols", ACCENTS.length);
        tiles.innerHTML = ACCENTS.map((a) => `<button class="sp-tile sp-acc" type="button" data-acc="${a}" tabindex="-1" aria-label="${esc(T("spell.accent", { c: a }))}">${a}</button>`).join("");
      }
    }
    if (!accents) tiles.dataset.acc = "";
    // the buttons
    const acts = [{ id: "back", label: "⌫", aria: T("spell.back") }, { id: "hint", label: "💡 " + T("spell.hint"), aria: T("spell.hint") }]
      .concat(this.mode === "type" && this.opts.enterButton ? [{ id: "enter", label: T("spell.enter"), aria: T("spell.enter") }] : [])
      .concat((typeof this.opts.actions === "function" ? this.opts.actions() : this.opts.actions) || []);
    const sig = acts.map((a) => a.id + a.label).join("|");
    if (sig !== this._actSig) {
      this._actSig = sig;
      this.el("actions").innerHTML = acts.map((a) => `<button class="sp-act" data-act="${a.id}" aria-label="${esc(a.aria || a.label)}"${a.id === "back" ? " data-pad-back" : ""}>${esc(a.label)}</button>`).join("");
    }
    const msg = this.el("msg");
    const wl = ` lang="${G.Lang.TAG[this.lang] || "en"}"`;
    if (this.feedback) {
      msg.innerHTML = `<span class="sp-right">${esc(T("spell.correctIs"))} <b${wl}>${esc(this.feedback.answer)}</b></span>` + (this.feedback.extra ? `<span class="sp-stress">${this.feedback.extra}</span>` : "") + (this.feedback.tip ? `<span class="sp-tip">${esc(this.feedback.tip)}</span>` : "");
      msg.className = "spad-msg bad";
    } else if (this.accentNote) {
      msg.innerHTML = `<span class="sp-right">${esc(T("spell.accentNote"))} <b${wl}>${esc(this.accentNote.word)}</b></span>`;
      msg.className = "spad-msg";
    } else if (this.note) { msg.textContent = this.note; msg.className = "spad-msg"; }
    else if (field && this.lang === "zh" && !this.typed) { msg.textContent = T("spell.zhHint"); msg.className = "spad-msg sp-help"; }
    else { msg.textContent = ""; msg.className = "spad-msg"; }
  };

  // ---------------- in the game: the Spell answer ----------------
  Object.assign(S, {
    active: false, pad: null, focus: null, game: null,

    // a run starts: typing controls if anything in it is spelt
    start(game) {
      this.game = game; this.focus = null; this._missT = 0;
      this.active = !!(game.learn && game.learn.spells);
      const box = document.getElementById("hud-spell");
      document.body.classList.toggle("spell-run", this.active);
      document.body.classList.toggle("spell-only", this.active && !game.learn.shoots);
      if (!box) return;
      box.classList.toggle("hidden", !this.active);
      if (!this.active) return;
      if (!this.pad) {
        this.pad = new G.SpellPad(document.getElementById("hud-spell-pad"), {
          mode: this.inputMode(),
          onSubmit: (text) => this.submit(text),
          onHint: () => this.hint(),
          showCursor: () => G.Input.padActive,
          actions: () => {
            const z = this.focus, out = [{ id: "next", label: "⟳", aria: T("spell.next"), fn: () => this.cycleFocus(1) }];
            if (z && z.clueKind === "audio") out.push({ id: "say", label: "🔊", aria: T("spell.hearAgain"), fn: () => this.sayFocus(true) });
            if (z && z.clueKind === "definition" && !z._thaiShown && !G.Learn.showsThai(z.pair)) out.push({ id: "thai", label: T("spell.thaiShort"), aria: T("hud.showThai"), fn: () => this.showThai() });
            return out;
          },
        });
      }
      this.pad.setMode(this.inputMode());
      this.pad.setWord(null, "");
      this.pad.note = "";
      this._keysFor = null;
      this.showKeys();
    },
    // how to answer, under the bar, for the input in use (D1, D3)
    device() { return G.Input.padActive ? "pad" : G.Input.mode === "touch" ? "touch" : "keys"; },
    showKeys() {
      const el = document.getElementById("hud-spell-keys"), dev = this.device();
      // (Dictation: and how to hear the word again)
      const audio = !!(this.focus && this.focus.clueKind === "audio");
      if (!el || this._keysFor === dev + audio) return;
      this._keysFor = dev + audio;
      el.textContent = T("spell.keys." + dev) + (audio ? " · " + T("spell.keys.hear." + dev, { key: G.keyLabel(G.save.settings.keybinds.replay) }) : "");
    },
    stop() {
      this.active = false; this.focus = null;
      document.body.classList.remove("spell-run", "spell-only");
      const box = document.getElementById("hud-spell");
      if (box) box.classList.add("hidden");
    },
    inputMode() { return G.Input.mode === "touch" || G.Input.padActive ? "tiles" : "type"; },
    // typing on the keyboard is live (letters go to the bar, arrows walk)
    typing() { return this.active && this.inputMode() === "type" && !!this.game && this.game.state === "GAMEPLAY"; },
    spellZombies() { return this.game ? this.game.zombies.filter((z) => z.alive && z.answer === "spell" && !z.emerge) : []; },

    // the zombie the pad is about: on a keyboard the one in the crosshair,
    // else the nearest; on touch or a pad the same one until it is gone
    pickFocus() {
      const g = this.game, list = this.spellZombies();
      if (!list.length) return null;
      const p = g.yawObject.position;
      const dist = (z) => z.mesh.position.distanceTo(p);
      if (this.inputMode() === "type") {
        const dir = new THREE.Vector3(); g.camera.getWorldDirection(dir);
        let best = null, bestDot = 0.985;
        for (const z of list) {
          const v = z.mesh.position.clone().setY(z.mesh.position.y + 1.4).sub(p).normalize();
          const dt = v.dot(dir);
          if (dt > bestDot) { bestDot = dt; best = z; }
        }
        this._aimed = !!best;
        if (best) return best;
      } else if (this.focus && list.includes(this.focus)) { this._aimed = true; return this.focus; }
      this._aimed = this.inputMode() !== "type";
      return list.slice().sort((a, b) => dist(a) - dist(b))[0];
    },
    cycleFocus(d) {
      const list = this.spellZombies();
      if (!list.length) return;
      const p = this.game.yawObject.position;
      list.sort((a, b) => a.mesh.position.distanceTo(p) - b.mesh.position.distanceTo(p));
      const i = list.indexOf(this.focus);
      this.setFocus(list[(i + d + list.length) % list.length]);
    },
    setFocus(z) {
      if (z === this.focus) return;
      const old = this.focus;
      this.focus = z;
      if (old && old.alive) old.setSpellFocus(false);
      if (z) z.setSpellFocus(true);
      if (this.pad) this.pad.setWord(z ? S.target(z) : null, z ? z.clue : "", this.inputMode() === "type");
    },
    update(game, dt) {
      if (!this.active || !this.pad) return;
      const mode = this.inputMode();
      if (mode !== this.pad.mode) { this.pad.setMode(mode); }
      // (the screen turned or resized: the tiles laid out again)
      if (this.pad.mode === "tiles" && this.pad._w !== this.pad.el("tiles").clientWidth) this.pad.render();
      this.showKeys();
      this.setFocus(this.pickFocus());
      // (round 3, G2) Dictation: a zombie's word is said as it comes into the
      // sights (on touch or a pad: as the bar comes onto it)
      const aimed = this.focus && this._aimed ? this.focus : null;
      if (aimed !== this._aimZ) { this._aimZ = aimed; if (aimed && aimed.clueKind === "audio") this.sayFocus(false); }
      this.pad.tick();
      // (round 3) a word in another language: the keys go to the text field
      if (this.typing() && this.pad.usesField()) this.pad.focusField();
      const none = !this.focus;
      this.pad.note = none ? T("spell.waiting") : "";
      document.getElementById("hud-spell").classList.toggle("idle", none);
      if (this._lastNote !== this.pad.note) { this._lastNote = this.pad.note; this.pad.render(); }
    },
    // keyboard: true when the key was the bar's
    onKey(e) {
      if (!this.typing()) return false;
      // (round 3) a word typed in its text field: the field takes the keys
      // it types (the browser puts them in), Enter answers -- never while an
      // IME is composing -- and Tab hints; arrows still walk
      if (this.pad.usesField()) {
        if (this.pad.composing || e.isComposing || e.keyCode === 229) return true;
        if (e.key === "Enter") { this.submit(this.pad.text()); return true; }
        if (e.key === "Tab") { this.hint(); if (e.preventDefault) e.preventDefault(); return true; }
        if (S.fieldKey(e)) { this.pad.focusField(); return true; }
        return false;
      }
      const k = S.keyChar(e);
      if (e.ctrlKey || e.metaKey || e.altKey) return false;
      if (k === "Enter") { this.submit(this.pad.text()); return true; }
      if (k === "Backspace") { this.pad.back(); if (e.preventDefault) e.preventDefault(); return true; }
      if (k === "Tab") { this.hint(); if (e.preventDefault) e.preventDefault(); return true; }
      if (k && k.length === 1 && /[a-z '\-]/i.test(k)) { if (k === " " && e.preventDefault) e.preventDefault(); this.pad.type(k.toLowerCase()); return true; }
      return false;
    },
    // (round 3, G2) the focus zombie's word, said: as it is aimed at (not
    // twice within a moment), or again on request -- Play Once: once only
    sayFocus(force) {
      const z = this.focus;
      if (!z || z.clueKind !== "audio") return false;
      const now = performance.now();
      if (z._said && G.save.settings.playOnce) { if (force) G.UI.flashAbilityNote && G.UI.flashAbilityNote(T("hud.playedOnce")); return false; }
      if (!force && z._saidAt && now - z._saidAt < G.CONFIG.speech.sameZombieGap * 1000) return false;
      z._said = (z._said || 0) + 1; z._saidAt = now;
      G.Audio.speak(z.word);
      return true;
    },
    // (F) the Thai of the focus zombie's English clue: a helper (no box move)
    showThai() {
      const z = this.focus;
      if (!z || z.clueKind !== "definition" || z._thaiShown || G.Learn.showsThai(z.pair)) return false;
      z._thaiShown = true;
      G.Audio && G.Audio.sfx && G.Audio.sfx("switch");
      if (this.pad) { this.pad.clue = z.clue + " · " + z.meaning; this.pad.render(); }
      return true;
    },
    hint() {
      const z = this.focus;
      if (!z || !this.pad.hint()) return;
      z._hints = (z._hints || 0) + 1;
      G.Audio && G.Audio.sfx && G.Audio.sfx("switch");
    },
    // The word as written: the zombie that carries it is shot; within two
    // letters of one, it is a misspelling of that one; else a miss.
    submit(text) {
      const g = this.game;
      const t = S.norm(text);
      if (!t || !g) return;
      const list = this.spellZombies();
      // on tiles the answer is about the zombie in focus only
      const scope = this.inputMode() === "tiles" && this.focus ? [this.focus] : list;
      const hit = scope.find((z) => S.isRight(t, S.target(z)));
      if (hit) {
        const fix = S.accentFix(t, S.target(hit));
        g.spellKill(hit, { hints: hit._hints || 0 });
        this.pad.clear();
        this.pad.hints = 0;
        // (round 3: right without its accents -- the word as it is written)
        if (fix) this.pad.showAccent(fix);
        return;
      }
      let near = null, best = 99;
      for (const z of scope) {
        const d = S.distance(t, S.target(z));
        if (d > S.nearMiss(S.target(z))) continue;
        if (d < best || (d === best && z === this.focus)) { best = d; near = z; }
      }
      if (near) {
        g.spellMiss(near, t);
        // (round 3, G3) Dictation: its syllables, the stressed one marked, and
        // the word said again
        const heard = near.clueKind === "audio";
        this.pad.showFeedback(t, S.answerOf(S.target(near)), S.tipFor(t, near.pair), heard ? G.Clues.stressHtml(near.pair) : "");
        if (heard) G.Audio.speak(near.word);
      } else {
        G.Audio && G.Audio.sfx && G.Audio.sfx("wrong");
        this.pad.note = T("spell.noMatch", { w: t });
        this.pad.clear();
        this.pad.render();
        this._lastNote = this.pad.note;
        g.spellNoMatch && g.spellNoMatch(t);
      }
    },
    // a controller, while the tiles are up in play: true when it used the input
    padInput(gp, now, edge, dt) {
      if (!this.active || !this.pad || this.pad.mode !== "tiles" || !this.focus) return false;
      const B = G.Pad.B;
      const ax = gp.axes[0] || 0;
      const dirs = [[B.LEFT, "left"], [B.RIGHT, "right"], [B.UP, "up"], [B.DOWN, "down"]];
      for (const [b, d] of dirs) if (edge(b)) this.pad.moveCursor(d);
      if (edge(B.A)) this.pad.place(this.pad.cursor);
      if (edge(B.B)) this.pad.back();
      if (edge(B.X)) this.hint();
      if (edge(B.LB)) this.cycleFocus(-1);
      if (edge(B.RB)) this.cycleFocus(1);
      void ax;
      return true;
    },
  });

  // ---------------- Spell to Reload (D2) ----------------
  G.SpellReload = {
    pad: null, pair: null, busy: false,
    enabled(game) { return !!G.save.settings.spellReload && game && game.learn && !game.learn.spells && game.mode !== "study"; },
    // a word of this wave, due or still being learnt first
    pickWord(game) {
      const words = (game.waveWords && game.waveWords.length ? game.waveWords : game.wordPool || []).filter((p) => p && p[0] && p[1]);
      if (!words.length) return null;
      const sp = G.SRS.split(words);
      const pool = sp.due.length ? sp.due : sp.learning.length ? sp.learning : words;
      const w = G.pick(pool);
      return (game.wordPool || []).find((p) => G.wordKey(p) === G.wordKey(w)) || w;
    },
    // open it; done("full" | "half")
    open(game, done) {
      const pair = this.pickWord(game);
      if (!pair) { done("full"); return; }
      this.pair = pair; this.done = done; this.busy = true; this.game = game;
      const box = document.getElementById("spell-reload");
      const padEl = document.getElementById("spell-reload-pad");
      if (!this.pad) {
        this.pad = new G.SpellPad(padEl, {
          mode: "type", enterButton: true,
          onSubmit: (t) => this.submit(t),
          showCursor: () => G.Input.padActive,
        });
      }
      this.pad.setMode(G.Input.mode === "touch" || G.Input.padActive ? "tiles" : "type");
      this.pad.setWord(pair, pair[1]);
      this.pad.note = "";
      setTimeout(() => this.pad.focusField(), 0);
      document.getElementById("spell-reload-keys").textContent = T("spell.reloadKeys." + S.device());
      box.classList.remove("hidden");
      G.Modal.open("spellreload", { keys: (e) => this.key(e) });
    },
    key(e) {
      if (!this.busy) return true;
      if (this.pad.feedback) { if (e.code === "Enter" || e.code === "Space") this.finish(); return true; }
      // (round 3) a word in another language: its text field takes the keys (an IME's Enter included)
      if (this.pad.usesField()) {
        if (this.pad.composing || e.isComposing || e.keyCode === 229) return true;
        if (e.code === "Enter" || e.code === "NumpadEnter") { this.submit(this.pad.text()); return true; }
        if (e.code === "Tab") { this.pad.hint(); if (e.preventDefault) e.preventDefault(); return true; }
        this.pad.focusField();
        return true;
      }
      if (e.code === "Enter" || e.code === "NumpadEnter") { this.submit(this.pad.text()); return true; }
      if (e.code === "Backspace") { this.pad.back(); return true; }
      if (e.code === "Tab") { this.pad.hint(); if (e.preventDefault) e.preventDefault(); return true; }
      const ch = S.keyChar(e);
      if (ch && ch.length === 1 && /[a-z '\-]/i.test(ch)) { this.pad.type(ch.toLowerCase()); return true; }
      return true;
    },
    submit(text) {
      if (!this.busy || this.pad.feedback || this.pad.accentNote) return;
      const t = S.norm(text);
      if (!t) return;
      const pair = this.pair, right = S.isRight(t, pair), hints = this.pad.hints || 0;
      G.Learning.answerWord(pair, right, { recall: true, assisted: hints > 0, typed: t, source: "reload", skills: ["spelling"] });
      if (right) {
        this.result = "full"; G.Audio.sfx("correct");
        // (round 3: right without its accents -- the word as written, a moment, before the window goes)
        const fix = S.accentFix(t, pair);
        if (fix) { this.pad.showAccent(fix); clearTimeout(this._t); this._t = setTimeout(() => this.finish(), 1200); return; }
        this.finish(); return;
      }
      this.result = "half";
      G.Audio.sfx("wrong");
      if (this.game) { this.game.trackWrongWord(pair[0], pair[1]); G.Quiz.noteMissed(this.game, pair[0]); }
      this.pad.showFeedback(t, S.answerOf(pair), S.tipFor(t, pair));
      clearTimeout(this._t);
      this._t = setTimeout(() => this.finish(), C().feedbackSeconds * 1000);
    },
    finish() {
      if (!this.busy) return;
      clearTimeout(this._t);
      this.busy = false;
      document.getElementById("spell-reload").classList.add("hidden");
      if (this.pad) this.pad.feedback = null;
      const done = this.done; this.done = null;
      G.Modal.close("spellreload");
      if (done) done(this.result || "full");
      this.result = null;
    },
    // leaving the run with it open
    reset() { clearTimeout(this._t); if (this.busy) { this.busy = false; this.done = null; document.getElementById("spell-reload").classList.add("hidden"); G.Modal.close("spellreload"); } },
  };
})();
