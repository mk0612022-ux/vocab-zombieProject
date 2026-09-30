// ============================================================
// Vocabulary registry -- IELTS / Academic Word List, EN -> TH
// ------------------------------------------------------------
// The words come from the word bank (js/wordbank.js over
// js/data/bank_school.js, bank_hospital.js, bank_bunker.js):
//
//   G.WORDS_LEVEL_1   School    ~280 word families (AWL sublists 1-3 + Education, Society, Media)
//   G.WORDS_LEVEL_2   Hospital  ~300 (AWL 4-7 + Health, Science, Environment)
//   G.WORDS_LEVEL_3   Bunker    ~300 (AWL 8-10 + Technology, Law, Crime, Work, Urban)
//
// All 570 AWL families plus IELTS topic words, and no family in more than
// one level. tools/validate-words.ps1 checks the data files in depth;
// G.auditWordSets() below checks what the game actually loaded
// (tools/check-words.html prints it).
// ============================================================
window.G = window.G || {};

// Registry of built-in word sets (extended at runtime by Import Vocabulary).
// The names are internal (never shown). `words` is read live: the level's
// built-in list plus the words the player added to it (G.levelWords,
// js/customvocab.js).
G.WORD_SETS = {
  level1: { name: "Level 1 words (school)", get words() { return G.levelWords ? G.levelWords("level1") : G.WORDS_LEVEL_1; }, builtin: true },
  level2: { name: "Level 2 words (hospital)", get words() { return G.levelWords ? G.levelWords("level2") : G.WORDS_LEVEL_2; }, builtin: true },
  level3: { name: "Level 3 words (bunker)", get words() { return G.levelWords ? G.levelWords("level3") : G.WORDS_LEVEL_3; }, builtin: true },
};

G.getAllBuiltinWords = function () {
  return [].concat(G.WORDS_LEVEL_1, G.WORDS_LEVEL_2, G.WORDS_LEVEL_3);
};

// how many word families a level may hold (the bank aims at 250-300)
G.WORDS_PER_LEVEL = { min: 240, max: 330 };

// ---------------- Word set audit ----------------
// Per-word stats, the "mastered" flag and Practice Mode's weak-word list
// are keyed by entry id, so a word family in two levels would share one
// history across both. This checks what was loaded: every pair well
// formed with an id, no id or form in two entries, and each level's size
// inside G.WORDS_PER_LEVEL. Returns a plain object so it can be run from a
// page, a console, or a test harness.
G.auditWordSets = function () {
  const sets = [
    { key: "level1", file: "bank_school.js", label: "School (easiest)", words: G.WORDS_LEVEL_1 },
    { key: "level2", file: "bank_hospital.js", label: "Hospital (medium)", words: G.WORDS_LEVEL_2 },
    { key: "level3", file: "bank_bunker.js", label: "Bunker (hardest)", words: G.WORDS_LEVEL_3 },
  ];
  const report = { sets: [], crossLevelDuplicates: [], withinSetDuplicates: [], malformed: [], total: 0, ok: false };
  const seen = new Map();   // lower-cased form -> set key where it was first found
  sets.forEach((s) => {
    const list = s.words || [];
    const local = new Set();
    list.forEach((pair, i) => {
      if (!Array.isArray(pair) || typeof pair[0] !== "string" || typeof pair[1] !== "string"
        || !pair[0].trim() || !pair[1].trim() || !pair.id) {
        report.malformed.push({ set: s.key, index: i, value: JSON.stringify(pair) });
        return;
      }
      const e = G.WordBank.byId(pair.id);
      const forms = [pair[0]].concat(e ? (e.acceptedSpellings || []).concat((e.family || []).map((m) => m.word), e.aliases || []) : []);
      new Set(forms.map((f) => String(f).toLowerCase())).forEach((w) => {
        if (local.has(w)) report.withinSetDuplicates.push({ set: s.key, word: w });
        local.add(w);
        if (seen.has(w) && seen.get(w) !== s.key) report.crossLevelDuplicates.push({ word: w, inSets: [seen.get(w), s.key] });
        else if (!seen.has(w)) seen.set(w, s.key);
      });
    });
    report.sets.push({ key: s.key, file: s.file, label: s.label, count: list.length, unique: new Set(list.map((p) => p && p.id)).size });
    report.total += list.length;
  });
  report.uniqueOverall = new Set(G.getAllBuiltinWords().map((p) => p && p.id)).size;
  report.ok = report.crossLevelDuplicates.length === 0
    && report.withinSetDuplicates.length === 0
    && report.malformed.length === 0
    && report.uniqueOverall === report.total
    && report.sets.every((s) => s.count >= G.WORDS_PER_LEVEL.min && s.count <= G.WORDS_PER_LEVEL.max && s.unique === s.count);
  return report;
};
