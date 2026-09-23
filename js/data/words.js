// ============================================================
// Vocabulary registry — IELTS / Academic Word List style, EN -> TH
// ------------------------------------------------------------
// The word lists themselves live one file per level, so a set can be
// edited or replaced without touching the others:
//
//   words_school.js    -> G.WORDS_LEVEL_1   (100, easiest)
//   words_hospital.js  -> G.WORDS_LEVEL_2   (100, medium)
//   words_bunker.js    -> G.WORDS_LEVEL_3   (100, hardest)
//
// 300 words in total and no word appears in more than one level.
// G.auditWordSets() below is what proves that; tools/check-words.html
// runs it and prints the report.
// ============================================================
window.G = window.G || {};

// Registry of built-in word sets (extended at runtime by Import Vocabulary)
G.WORD_SETS = {
  level1: { name: "ชุดคำศัพท์ด่าน 1 (โรงเรียน)", words: G.WORDS_LEVEL_1, builtin: true },
  level2: { name: "ชุดคำศัพท์ด่าน 2 (โรงพยาบาล)", words: G.WORDS_LEVEL_2, builtin: true },
  level3: { name: "ชุดคำศัพท์ด่าน 3 (บังเกอร์)", words: G.WORDS_LEVEL_3, builtin: true },
};

G.getAllBuiltinWords = function () {
  return [].concat(G.WORDS_LEVEL_1, G.WORDS_LEVEL_2, G.WORDS_LEVEL_3);
};

// ---------------- Word set audit ----------------
// A duplicate across two levels is not a cosmetic problem: per-word stats,
// the "mastered" flag and Practice Mode's weak-word list are all keyed by the
// word itself, so the same word in two sets silently merges their histories.
// This checks for that, for duplicates inside a single set, for malformed
// entries, and for missing or empty translations. Returns a plain object so
// it can be run from a page, a console, or a test harness.
G.auditWordSets = function () {
  const sets = [
    { key: "level1", file: "words_school.js", label: "โรงเรียน (ง่ายสุด)", words: G.WORDS_LEVEL_1 },
    { key: "level2", file: "words_hospital.js", label: "โรงพยาบาล (กลาง)", words: G.WORDS_LEVEL_2 },
    { key: "level3", file: "words_bunker.js", label: "บังเกอร์ (ยากสุด)", words: G.WORDS_LEVEL_3 },
  ];
  const report = { sets: [], crossLevelDuplicates: [], withinSetDuplicates: [], malformed: [], total: 0, ok: false };
  const seen = new Map(); // lowercased word -> set key it was first found in

  sets.forEach((s) => {
    const list = s.words || [];
    const local = new Set();
    list.forEach((pair, i) => {
      if (!Array.isArray(pair) || pair.length !== 2 || typeof pair[0] !== "string" || typeof pair[1] !== "string"
        || !pair[0].trim() || !pair[1].trim()) {
        report.malformed.push({ set: s.key, index: i, value: JSON.stringify(pair) });
        return;
      }
      const w = pair[0].trim().toLowerCase();
      if (local.has(w)) report.withinSetDuplicates.push({ set: s.key, word: pair[0] });
      local.add(w);
      if (seen.has(w) && seen.get(w) !== s.key) {
        report.crossLevelDuplicates.push({ word: pair[0], inSets: [seen.get(w), s.key] });
      } else if (!seen.has(w)) seen.set(w, s.key);
    });
    report.sets.push({ key: s.key, file: s.file, label: s.label, count: list.length, unique: local.size });
    report.total += list.length;
  });

  report.uniqueOverall = seen.size;
  report.ok = report.crossLevelDuplicates.length === 0
    && report.withinSetDuplicates.length === 0
    && report.malformed.length === 0
    && report.sets.every((s) => s.count === 100);
  return report;
};
