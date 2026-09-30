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
// The rest of the game still works in [English, Thai] pairs:
// G.WORDS_LEVEL_1..3 are built here from the bank, one pair per entry,
// each carrying its entry id as pair.id. G.wordKey(word) is the key the
// save's wordStats uses: the entry id for a bank word (whatever spelling
// or old merged word it arrives as), the lower-cased word for anything
// else (the player's own words, practice sets).
// ============================================================
window.G = window.G || {};

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

  [1, 2, 3].forEach((lv) => LEVELS[lv].forEach((e) => {
    byId.set(e.id, e);
    [e.id, e.headword].concat(e.acceptedSpellings || [], e.aliases || []).forEach((k) => { add(byKey, k, e); add(byForm, k, e); });
    (e.family || []).forEach((m) => add(byForm, m && m.word, e));
    add(byForm, e.awlHeadword, e);
  }));
  const lexicon = new Map();
  (G.CONFUSABLES || []).forEach((c) => add(lexicon, c.headword, c));

  // [headword, thai] pairs, alphabetical, each with .id
  const pairsOf = (lv) => LEVELS[lv].slice()
    .sort((a, b) => a.headword.localeCompare(b.headword, "en"))
    .map((e) => { const p = [e.headword, e.thai]; p.id = e.id; return p; });

  // what "has field X" means for each field the modes may ask for
  const filled = (v) => Array.isArray(v) ? v.some((x) => x && (typeof x !== "string" || x.trim()))
    : v && typeof v === "object" ? Object.keys(v).every((k) => String(v[k] || "").trim())
      : v != null && String(v).trim() !== "";

  return {
    LEVEL_KEYS: { level1: 1, level2: 2, level3: 3 },
    entries(lv) { return lv ? (LEVELS[lv] || []) : [].concat(LEVELS[1], LEVELS[2], LEVELS[3]); },
    count(lv) { return this.entries(lv).length; },
    pairs(lv) { return pairsOf(lv); },
    byId(id) { return byId.get(id) || null; },
    // the bank entry a word is the key or a spelling of ("minimize" -> minimize,
    // "consist" -> consistent), or null
    lookup(word) { return byKey.get(low(word)) || null; },
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
        const e = (w.id && byId.get(w.id)) || byKey.get(low(w[0]));
        if (e) return e;
        const x = w[2] && typeof w[2] === "object" ? w[2] : {};
        return {
          id: low(w[0]), headword: String(w[0]), thai: String(w[1] || ""), custom: true,
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

// the key a word's stats are saved under
G.wordKey = function (w) {
  if (Array.isArray(w)) { if (w.id) return w.id; w = w[0]; }
  const e = G.WordBank.lookup(w);
  return e ? e.id : String(w == null ? "" : w).trim().toLowerCase();
};

G.WORDS_LEVEL_1 = G.WordBank.pairs(1);
G.WORDS_LEVEL_2 = G.WordBank.pairs(2);
G.WORDS_LEVEL_3 = G.WordBank.pairs(3);
