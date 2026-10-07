// ===================================================================
// The English clues of a word (vocabulary series, round 3: F, G, H)
// -------------------------------------------------------------------
// What the new clues and question kinds read from a word's bank entry:
//   definition   its English definition (F), and one short synonym for a
//                zombie's label
//   cloze        one of its example sentences with the word -- the form the
//                sentence really uses ("indicates", "indication") -- taken
//                out (H1); the other forms of its family are the look-alikes
//   collocation  a collocation with the word taken out ("___ research")
//   paraphrase   a sentence, the phrase to replace and the word (H5)
//   stress       "IN-di-cate" as syllables with the stressed one marked (G3)
// A word without the data (a player's own word with no examples, say) has
// no such clue: `has(pair, kind)` says so, and the modes and questions use
// another (round 1, A8).
// ===================================================================
window.G = window.G || {};

G.Clues = {
  _cache: new Map(),
  low: (s) => String(s == null ? "" : s).toLowerCase(),
  info(pair) { return pair ? G.WordBank.info(pair) : null; },
  tokens(s) { return String(s).match(/[A-Za-z]+(?:[-'][A-Za-z]+)*/g) || []; },
  // is `token` a form of this word (any family member, any regular ending)?
  isForm(token, pair) {
    const own = G.WordBank.familyOf(token);
    if (own) return own.id === (pair.id || (G.WordBank.ownerOf(pair[0]) || {}).id);
    return this.low(token) === this.low(pair[0]);
  },
  // the forms of a word's family, the headword first: [{word, pos}]
  family(pair) {
    const info = this.info(pair);
    const out = [{ word: pair[0], pos: (info && info.partOfSpeech) || "" }];
    ((info && info.family) || []).forEach((m) => { if (m && m.word && !out.some((o) => this.low(o.word) === this.low(m.word))) out.push({ word: m.word, pos: m.pos || "" }); });
    return out;
  },

  has(pair, kind) {
    if (!pair) return false;
    const info = this.info(pair);
    if (kind === "thai") return !!pair[1];
    if (kind === "spell") return true;
    // (round 3, H4) a word is heard in its language's voice: none on the device, no audio clue
    if (kind === "audio") return !G.Audio || !G.Audio.canSpeak || G.Audio.canSpeak(G.Lang.wl(pair));
    // (round 3, H5) the rest are English: definitions, sentences, collocations
    if (!G.Lang.enWord(pair)) return false;
    if (!info) return false;
    if (kind === "definition") return !!(info.definition && String(info.definition).trim());
    if (kind === "cloze") return !!this.cloze(pair);
    if (kind === "colloc") return !!this.collocation(pair);
    if (kind === "paraphrase") return !!(info.paraphrase && info.paraphrase.sentence && info.paraphrase.phrase && info.paraphrase.word);
    if (kind === "synonym") return !!this.synonym(pair);
    return false;
  },

  definition(pair) { const i = this.info(pair); return i && i.definition ? String(i.definition) : ""; },
  // one short synonym -- one word, not a form of the word itself
  synonym(pair) {
    const i = this.info(pair);
    const max = G.CONFIG.clues.synonymMaxLength;
    return ((i && i.synonyms) || []).find((s) => s && !/\s/.test(s.trim()) && s.length <= max && !this.isForm(s, pair)) ||
      ((i && i.synonyms) || []).find((s) => s && s.length <= max + 6 && !this.isForm(s, pair)) || "";
  },

  // A sentence with the word taken out. `which`: 0 or 1 (an example), or
  // left out for the first that works. -> { text, blank, answer, before, after }
  //   text    "The figures ___ a sharp rise in unemployment."
  //   answer  "indicate" (the form in the sentence, as written there)
  cloze(pair, which) {
    const key = G.wordKey(pair) + "|" + (which == null ? "" : which);
    if (this._cache.has(key)) return this._cache.get(key);
    const info = this.info(pair);
    let out = null;
    const list = (info && info.examples) || (info && info.example ? [info.example] : []);
    const order = which == null ? list.map((_, i) => i) : [which];
    for (const i of order) {
      const s = list[i];
      if (!s) continue;
      const m = this.findForm(s, pair);
      if (!m) continue;
      out = { text: s.slice(0, m.index) + "___" + s.slice(m.index + m.form.length), answer: m.form, before: s.slice(0, m.index), after: s.slice(m.index + m.form.length), sentence: s, which: i };
      break;
    }
    this._cache.set(key, out);
    return out;
  },
  // where in `s` a form of the word is: { form, index }
  findForm(s, pair) {
    const re = /[A-Za-z]+(?:[-'][A-Za-z]+)*/g;
    let m;
    // a two-word headword ("per cent") is looked for as it is
    if (/\s/.test(pair[0])) {
      const i = this.low(s).indexOf(this.low(pair[0]));
      if (i >= 0) return { form: s.substr(i, pair[0].length), index: i };
    }
    while ((m = re.exec(s))) if (this.isForm(m[0], pair)) return { form: m[0], index: m.index };
    return null;
  },
  // the other forms of the family, for a Cloze question or a Context field:
  // never the form the sentence wants
  familyDecoys(pair, answer) {
    const a = this.low(answer);
    return this.family(pair).filter((f) => this.low(f.word) !== a && !/\s/.test(f.word));
  },

  // a collocation with the word taken out -> { text: "___ research", answer, partner }
  // (one with a real word beside the gap -- "___ research", not "___ that",
  // which half the verbs in the bank would fit -- the one with most such words)
  STOP: new Set(["a", "an", "the", "of", "to", "in", "on", "for", "that", "with", "by", "at", "as", "from", "and", "or", "be", "is", "it", "its", "this", "into", "about", "up", "out", "than"]),
  collocation(pair, which) {
    const info = this.info(pair);
    const list = ((info && info.collocations) || []).map((c, i) => ({ c, i })).filter((x) => which == null || x.i === which);
    let best = null, bestN = 0;
    for (const { c } of list) {
      const m = this.findForm(c, pair);
      if (!m) continue;
      const text = c.slice(0, m.index) + "___" + c.slice(m.index + m.form.length);
      const partner = text.replace("___", "").trim();
      const n = this.tokens(partner).filter((w) => !this.STOP.has(w.toLowerCase())).length;
      if (n > bestN) { bestN = n; best = { text, answer: m.form, collocation: c, partner }; }
    }
    return best;
  },

  // "IN-di-cate" -> [{s: "in", stressed: true}, {s: "di"}, {s: "cate"}]
  syllables(pair) {
    if (!pair || !G.Lang.enWord(pair)) return null;          // (round 3: English syllables only)
    const i = this.info(pair);
    const st = i && i.stress ? String(i.stress) : "";
    if (!st) return null;
    return st.split("-").filter(Boolean).map((s) => ({ s: s.toLowerCase(), stressed: s === s.toUpperCase() && /[A-Z]/.test(s) }));
  },
  // the same as HTML: in·DI·cate with the stressed syllable in bold
  stressHtml(pair) {
    const sy = this.syllables(pair);
    if (!sy) return "";
    return sy.map((x) => x.stressed ? `<b class="stress">${G.escapeHtml(x.s.toUpperCase())}</b>` : G.escapeHtml(x.s)).join('<span class="syl">·</span>');
  },
  stressText(pair) { const sy = this.syllables(pair); return sy ? sy.map((x) => (x.stressed ? x.s.toUpperCase() : x.s)).join("·") : ""; },

  // a sentence or phrase with every form of the word marked (vocabulary card)
  markHtml(text, pair) {
    const esc = G.escapeHtml;
    let out = "", last = 0, m;
    const re = /[A-Za-z]+(?:[-'][A-Za-z]+)*/g;
    while ((m = re.exec(text))) {
      if (!this.isForm(m[0], pair)) continue;
      out += esc(text.slice(last, m.index)) + `<mark>${esc(m[0])}</mark>`;
      last = m.index + m[0].length;
    }
    return out + esc(text.slice(last));
  },
};
