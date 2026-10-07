// ============================================================
// Word bank: the index over js/data/bank_*.js (G.BANK_1..3) and
// js/data/confusables.js (G.CONFUSABLES)
// ------------------------------------------------------------
// One entry is one word family: its id (never changes -- saved progress
// is stored under it), headword, Thai meaning, definition, synonyms,
// examples, collocations, family forms, topic, level, AWL sublist, and
// the optional confusables, misspellings, stress and paraphrase. The
// data files are written by tools/words-import.ps1 from word-bank.csv
// and checked by tools/validate-words.ps1.
//
// The rest of the game works in [word, meaning] pairs: G.WORDS_LEVEL_1..3
// are built here from the bank, one pair per entry, each carrying its entry
// id as pair.id. (Round 3, H) The word and the meaning are in the player's
// Word Language and Meaning Language (G.Lang): pair.wl and pair.ml say
// which, and the lists are built again when they change (in the lobby,
// never in a run). G.wordKey(word) is the key the save's wordStats and
// memory boxes use: the entry id for a bank word (whatever spelling or old
// merged word it arrives as) -- with "@zh", "@fr" or "@th" when the word
// is learnt in another language than English, so each language has its own
// boxes and every record from before languages stays English -- and the
// lower-cased word for anything else (the player's own words, practice sets).
// ============================================================
window.G = window.G || {};

// ---------------- languages (round 3, H) ----------------
// The four languages, each shown in its own language. The UI language
// (G.lang, js/strings.js) is any of them; the Word Language and the Meaning
// Language any of them but never the same one.
G.LANGS = ["th", "en", "zh", "fr"];
G.Lang = {
  NAMES: { th: "\u0E44\u0E17\u0E22", en: "English", zh: "\u4E2D\u6587", fr: "Fran\u00E7ais" },
  // the HTML lang attribute (fonts follow it: css :lang(zh)) and the voice's language
  TAG: { en: "en", th: "th", zh: "zh-Hans", fr: "fr" },
  SPEECH: { en: "en-GB", th: "th-TH", zh: "zh-CN", fr: "fr-FR" },
  DEFAULT: { word: "en", meaning: "th" },
  ok(l) { return G.LANGS.indexOf(l) >= 0; },
  // (before the save is read -- the Loading screen -- what js/strings.js read of it)
  set() { return (G.save && G.save.settings) || G.earlySettings || {}; },
  word() { const l = this.set().wordLang; return this.ok(l) ? l : this.DEFAULT.word; },
  meaning() {
    const l = this.set().meaningLang, w = this.word();
    if (this.ok(l) && l !== w) return l;
    return w === this.DEFAULT.meaning ? this.DEFAULT.word : this.DEFAULT.meaning;
  },
  // the language of a pair's word / meaning (a pair from before languages: English, Thai)
  wl(p) { return (p && p.wl) || (Array.isArray(p) ? "en" : this.word()); },
  ml(p) { return (p && p.ml) || (Array.isArray(p) ? "th" : this.meaning()); },
  enWord(p) { return (p ? this.wl(p) : this.word()) === "en"; },
  // an entry's text in a language
  text(e, l) {
    if (!e) return "";
    if (l === "th") return String(e.thai || "");
    if (l === "zh") return String(e.zh || "");
    if (l === "fr") return String(e.fr || "");
    return String(e.headword || "");
  },
  // its part of speech in that language (the Thai is the English one unless it says otherwise)
  pos(e, l) {
    if (!e) return "";
    if (l === "zh") return e.zhPos || e.partOfSpeech || "";
    if (l === "fr") return e.frPos || e.partOfSpeech || "";
    if (l === "th") return e.thPos || e.partOfSpeech || "";
    return e.partOfSpeech || "";
  },
  // the pinyin of a pair's Chinese side -- `side` 0 the word, 1 the meaning ("" when not Chinese)
  pinyin(p, side) {
    if (!p) return "";
    const l = side ? this.ml(p) : this.wl(p);
    if (l !== "zh") return "";
    if (side ? p.pyM : p.pyW) return side ? p.pyM : p.pyW;
    const e = p.id && G.WordBank.byId(p.id);
    return e ? String(e.pinyin || "") : "";
  },
  showPinyin() { return this.set().pinyin !== false; },
  // a pair's side as HTML: escaped, with its pinyin above it when Chinese
  // (Settings > Language > Pinyin)
  html(p, side) {
    const esc = G.escapeHtml || ((s) => String(s).replace(/[&<>"']/g, (c) => "&#" + c.charCodeAt(0) + ";"));
    const text = p ? String(p[side ? 1 : 0] || "") : "";
    const py = this.showPinyin() ? this.pinyin(p, side) : "";
    return py ? `<ruby>${esc(text)}<rt>${esc(py)}</rt></ruby>` : esc(text);
  },
  // ' lang="zh-Hans"' for a pair's side, or for a language code
  attr(p, side) { const l = typeof p === "string" ? p : side ? this.ml(p) : this.wl(p); return ` lang="${this.TAG[l] || "en"}"`; },
  // the two languages of the lists the game was last built for
  built: null,
  // a word to hear a voice by (Settings' test)
  SAMPLE: { en: "vocabulary", fr: "vocabulaire", zh: "\u8BCD\u6C47", th: "\u0E04\u0E33\u0E28\u0E31\u0E1E\u0E17\u0E4C" },
  sample() { return this.SAMPLE[this.word()] || this.SAMPLE.en; },
  // a language's name in a sentence of the UI language ("Chinese" in English, "chinois" in French)
  label(l) { return G.T ? G.T("lang." + l) : this.NAMES[l]; },
};

// the twelve topics, as they are written in the data; shown through
// G.topicLabel (strings "topic.*")
G.WORD_TOPICS = ["General Academic", "Education", "Society & Culture", "Media & Communication", "Health", "Science & Research",
  "Environment", "Technology", "Government & Law", "Crime & Security", "Work & Economy", "Urban Life & Transport"];
G.topicLabel = function (t) { return G.T ? G.T("topic." + String(t).toLowerCase().replace(/[^a-z]+/g, "_")) : t; };

G.WordBank = (function () {
  const LEVELS = { 1: G.BANK_1 || [], 2: G.BANK_2 || [], 3: G.BANK_3 || [] };
  const byId = new Map();          // id -> entry
  const byKey = new Map();         // id, headword, accepted spellings, aliases -> entry (the words stats may be stored under)
  const byForm = new Map();        // every form of a family, key words included -> entry
  const low = (s) => String(s == null ? "" : s).trim().toLowerCase();
  const add = (map, k, e) => { k = low(k); if (k && !map.has(k)) map.set(k, e); };

  // (round 3) the word in each other language -> entry
  const byText = { th: new Map(), zh: new Map(), fr: new Map() };
  [1, 2, 3].forEach((lv) => LEVELS[lv].forEach((e) => {
    byId.set(e.id, e);
    [e.id, e.headword].concat(e.acceptedSpellings || [], e.aliases || []).forEach((k) => { add(byKey, k, e); add(byForm, k, e); });
    (e.family || []).forEach((m) => add(byForm, m && m.word, e));
    add(byForm, e.awlHeadword, e);
    add(byText.th, e.thai, e); add(byText.zh, e.zh, e); add(byText.fr, e.fr, e);
  }));
  const lexicon = new Map();
  (G.CONFUSABLES || []).forEach((c) => add(lexicon, c.headword, c));

  // an entry as a pair in two languages: [word, meaning] with .id, .wl, .ml
  // (and the pinyin of a Chinese side, .pyW / .pyM)
  const pairOf = (e, wl, ml) => {
    wl = wl || G.Lang.word(); ml = ml || G.Lang.meaning();
    const p = [G.Lang.text(e, wl), G.Lang.text(e, ml)];
    p.id = e.id; p.wl = wl; p.ml = ml;
    if (wl === "zh") p.pyW = String(e.pinyin || "");
    if (ml === "zh") p.pyM = String(e.pinyin || "");
    return p;
  };
  // a level's pairs, in the order of the Word Language's alphabet
  const pairsOf = (lv, wl, ml) => {
    wl = wl || G.Lang.word(); ml = ml || G.Lang.meaning();
    const coll = new Intl.Collator(G.Lang.TAG[wl] || "en");
    return LEVELS[lv].map((e) => pairOf(e, wl, ml)).sort((a, b) => coll.compare(a[0], b[0]));
  };

  // what "has field X" means for each field the modes may ask for
  const filled = (v) => Array.isArray(v) ? v.some((x) => x && (typeof x !== "string" || x.trim()))
    : v && typeof v === "object" ? Object.keys(v).every((k) => String(v[k] || "").trim())
      : v != null && String(v).trim() !== "";

  return {
    LEVEL_KEYS: { level1: 1, level2: 2, level3: 3 },
    entries(lv) { return lv ? (LEVELS[lv] || []) : [].concat(LEVELS[1], LEVELS[2], LEVELS[3]); },
    count(lv) { return this.entries(lv).length; },
    pairs(lv, wl, ml) { return pairsOf(lv, wl, ml); },
    pairOf(e, wl, ml) { return e ? pairOf(e, wl, ml) : null; },
    byId(id) { return byId.get(id) || null; },
    // the bank entry a word is the key or a spelling of ("minimize" -> minimize,
    // "consist" -> consistent), or null
    lookup(word) { return byKey.get(low(word)) || null; },
    // (round 3) the entry whose word in `lang` this is: "analyse" in French,
    // "分析" in Chinese (English: any key or spelling, as lookup)
    byText(text, lang) {
      if (!lang || lang === "en") return byKey.get(low(text)) || null;
      return (byText[lang] && byText[lang].get(low(text))) || null;
    },
    // the entry a typed or picked word belongs to, in the Word Language (English: any form of a family)
    textOwner(text, lang) {
      lang = lang || G.Lang.word();
      return lang === "en" ? byForm.get(low(text)) || null : this.byText(text, lang);
    },
    // (round 3) the level lists, built again for the languages chosen (from
    // the lobby; G.Lang.apply). The player's own words follow (js/customvocab.js).
    rebuild() {
      const wl = G.Lang.word(), ml = G.Lang.meaning();
      G.WORDS_LEVEL_1 = pairsOf(1, wl, ml);
      G.WORDS_LEVEL_2 = pairsOf(2, wl, ml);
      G.WORDS_LEVEL_3 = pairsOf(3, wl, ml);
      G.Lang.built = wl + ">" + ml;
      if (G.Clues && G.Clues._cache) G.Clues._cache.clear();
      if (G.Distract && G.Distract._near) G.Distract._near.clear();
    },
    // the entry that owns this word as any form of its family ("analysis" -> analyse)
    ownerOf(word) { return byForm.get(low(word)) || null; },
    // ...or as a form with a regular ending: "analyses", "analysed",
    // "analysing", "studies", "committed". (Not "-er": "ranger" is not a
    // form of range, nor "pester" of pest.)
    familyOf(word) {
      const w = low(word);
      const hit = byForm.get(w);
      if (hit) return hit;
      const tries = [];
      const cut = (n) => w.slice(0, w.length - n);
      const undouble = (s) => /([bdgklmnprt])\1$/.test(s) ? s.slice(0, -1) : null;
      if (w.endsWith("'s")) tries.push(cut(2));
      if (w.endsWith("ies")) tries.push(cut(3) + "y");
      if (w.endsWith("ied")) tries.push(cut(3) + "y");
      if (w.endsWith("es")) tries.push(cut(2));
      if (w.endsWith("s")) tries.push(cut(1));
      if (w.endsWith("ed")) tries.push(cut(2), cut(1), undouble(cut(2)));
      if (w.endsWith("ing")) tries.push(cut(3), cut(3) + "e", undouble(cut(3)));
      for (const t of tries) { if (t && t.length > 1 && byForm.has(t)) return byForm.get(t); }
      return null;
    },
    confusable(word) { return lexicon.get(low(word)) || null; },

    // An entry-shaped view of any word the game shows: a bank entry as it
    // is; a player's own word ([en, th] or [en, th, {definition, synonyms,
    // example, collocations, topic}]) with the fields it has.
    info(w) {
      if (!w) return null;
      if (Array.isArray(w)) {
        const e = (w.id && byId.get(w.id)) || (G.Lang.wl(w) === "en" ? byKey.get(low(w[0])) : null);
        if (e) return e;
        const x = w[2] && typeof w[2] === "object" ? w[2] : {};
        return {
          id: low(w[0]), headword: String(w[0]), thai: String(w[1] || ""), custom: true,
          // (new series, round 2, G) the part of speech the player gave it; a
          // word of several words is a phrase
          partOfSpeech: G.POS.valid(x.pos) ? x.pos : /\s/.test(String(w[0]).trim()) ? "phrase" : "",
          definition: x.definition || "", synonyms: x.synonyms || [], examples: x.example ? [x.example] : [],
          collocations: x.collocations || [], topic: x.topic || "", family: [], acceptedSpellings: [String(w[0])],
        };
      }
      if (typeof w === "object") return w;
      return byId.get(w) || byKey.get(low(w)) || null;
    },
    // does the word have what a mode needs? has(pair, "definition"),
    // has(pair, "definition", "examples") -- all of them must be filled
    has(w) {
      const e = this.info(w);
      if (!e) return false;
      for (let i = 1; i < arguments.length; i++) if (!filled(e[arguments[i]])) return false;
      return true;
    },
    // the words of a list that a mode can use; the rest are skipped
    usable(list) {
      const fields = Array.prototype.slice.call(arguments, 1);
      return (list || []).filter((w) => this.has.apply(this, [w].concat(fields)));
    },
  };
})();

// the key a word's stats are saved under: "analyse" (English), "analyse@zh"
// (the same entry learnt in Chinese), "my word" / "mot@fr" (the player's
// own). A word given as text is in the Word Language; a key already made
// (it has an "@") is kept as it is.
G.wordKey = function (w) {
  let lang;
  if (Array.isArray(w)) {
    lang = G.Lang.wl(w);
    if (w.id) return lang === "en" ? w.id : w.id + "@" + lang;
    w = w[0];
  } else lang = G.Lang.word();
  const s = String(w == null ? "" : w).trim();
  if (s.indexOf("@") > 0) return s.toLowerCase();
  const e = G.WordBank.byText(s, lang);
  const base = e ? e.id : s.toLowerCase();
  return lang === "en" ? base : base + "@" + lang;
};
// the English key of a word as text -- how keys were made before languages
// (G.migrateWordStats reads old saves with it)
G.wordKey.en = function (w) {
  const s = String(w == null ? "" : w).trim();
  if (s.indexOf("@") > 0) return s.toLowerCase();
  const e = G.WordBank.lookup(s);
  return e ? e.id : s.toLowerCase();
};
// the entry id and language of a key: "analyse@zh" -> { id: "analyse", lang: "zh" }
G.wordKey.parse = function (k) {
  const m = /^(.*)@(th|zh|fr)$/.exec(String(k || ""));
  return m ? { id: m[1], lang: m[2] } : { id: String(k || ""), lang: "en" };
};

// (round 3) the Word and Meaning Language changed (from the lobby): the
// level lists built again, the screens that show words drawn again
G.Lang.apply = function () {
  const was = G.Lang.built;
  G.WordBank.rebuild();
  if (was === G.Lang.built) return false;
  if (G.CustomVocab && G.CustomVocab.invalidate) G.CustomVocab.invalidate();
  document.documentElement.classList.toggle("wl-zh", G.Lang.word() === "zh");
  try { window.dispatchEvent(new CustomEvent("vz-langs", { detail: { word: G.Lang.word(), meaning: G.Lang.meaning() } })); } catch (e) { /* old browser */ }
  return true;
};

// ---------------- parts of speech (new series, round 2, G) ----------------
// Every bank entry has its part of speech: one, or two ("n/v") when the
// meaning it is given is used as both -- research (N./V.). The short forms are
// the same in every language. Shown after the word wherever a word of the
// bank is: the zombies' labels, the vocabulary card, the Vocabulary Log, the
// choices of a question, the Progress page -- never in a question about the
// word's form (a gap filled from its family: the tag would be the answer).
G.POS = {
  ORDER: ["n", "v", "adj", "adv", "prep", "conj", "pron", "det", "phrase"],
  ABBR: { n: "N.", v: "V.", adj: "Adj.", adv: "Adv.", prep: "Prep.", conj: "Conj.", pron: "Pron.", det: "Det.", phrase: "Phr." },
  // "n/v" -> ["n", "v"]; a well-formed code is one or two of ORDER, in its order
  parts(code) { return String(code || "").split("/").filter((c) => Object.prototype.hasOwnProperty.call(this.ABBR, c)); },
  valid(code) {
    if (typeof code !== "string" || !code) return false;
    const p = code.split("/");
    return p.length <= 2 && this.parts(code).length === p.length && (p.length < 2 || this.ORDER.indexOf(p[0]) < this.ORDER.indexOf(p[1]));
  },
  // a word's code ("" when it has none): a pair, an entry, a word or an id --
  // (round 3) as a word of its language: a pair's Word Language, else the
  // player's (analyse is N. in French, V. in English)
  of(w, lang) {
    const i = G.WordBank.info(w);
    if (!i) return "";
    const c = i.custom ? i.partOfSpeech : G.Lang.pos(i, lang || G.Lang.wl(w));
    return this.valid(c) ? c : "";
  },
  // (round 3, H4) a French noun's gender: "m", "f", "m/f" or ""
  gender(w, lang) {
    if ((lang || G.Lang.wl(w)) !== "fr") return "";
    const i = G.WordBank.info(w);
    return i && !i.custom && /^(m|f|m\/f)$/.test(i.frGender || "") ? i.frGender : "";
  },
  GENDER: { m: "m.", f: "f.", "m/f": "m./f." },
  // "N./V." -- with a gender, the noun's: "N. f.", "N. m./Adj."
  abbr(code, gender) { return this.parts(code).map((c) => this.ABBR[c] + (c === "n" && gender ? " " + this.GENDER[gender] : "")).join("/"); },
  name(code) { return this.parts(code).map((c) => (G.T ? G.T("pos." + c) : c)).join(" / "); },  // "noun / verb"
  // what follows a word, for a label: "N. f." ("" when none)
  short(w) { const code = this.of(w); return code ? this.abbr(code, this.gender(w)) : ""; },
  // "(N./V.)" after a word, smaller and fainter (css .pos-tag); "" when none
  tag(w) {
    const code = this.valid(w) ? w : this.of(w);
    if (!code) return "";
    const g = this.valid(w) ? "" : this.gender(w);
    const n = G.escapeHtml ? G.escapeHtml(this.name(code) + (g ? " (" + G.T("pos.g." + g.replace("/", "")) + ")" : "")) : this.name(code);
    return ` <span class="pos-tag" title="${n}" aria-label="${n}">(${this.abbr(code, g)})</span>`;
  },
  // plain text: "research (N./V.)", "analyse (N. f.)"
  text(word, w) {
    const code = this.valid(w) ? w : this.of(w);
    return code ? word + " (" + this.abbr(code, this.valid(w) ? "" : this.gender(w)) + ")" : String(word);
  },
  // two words that share a part of speech (the wrong choices of a question)
  overlap(a, b) { const x = this.parts(a); return this.parts(b).some((c) => x.includes(c)); },
};

// (English > Thai until the save is read: G.Game.init calls G.Lang.apply)
G.WordBank.rebuild();
