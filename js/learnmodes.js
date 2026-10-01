// ===================================================================
// Learning modes (vocabulary series, round 2, B): a clue x an answer
// -------------------------------------------------------------------
// Every mode is two parts that combine freely, rather than a mode written
// on its own:
//   clue    what the player is given   thai (the Thai meaning); round 3:
//                                      definition, audio, cloze
//   answer  how they answer            shoot (the zombie carrying the right
//                                      English word) or spell (type it, or
//                                      put its letters in order)
// The ready-made modes are pairs of those; Adaptive picks a pair for each
// word from its box (js/srs.js): new words and boxes 1-2 are shot, from
// box 3 (G.CONFIG.adaptive.spellFromBox) they are spelt. A mode whose clue
// or answer is not built yet is not offered (`available`).
//
//   G.Learn.run(presetId)  the rules for one run: clueFor(pair), answerFor(pair)
//   recall answers         spell (and in round 3 the dictation, paraphrase
//                          and context clues) -- what boxes 4-5 need
// ===================================================================
window.G = window.G || {};

G.Learn = {
  CLUES: {
    thai: { available: true },
    definition: { available: false },      // round 3
    audio: { available: false },           // round 3
    cloze: { available: false },           // round 3
  },
  ANSWERS: {
    shoot: { available: true, recall: false },
    spell: { available: true, recall: true },
  },
  // clues that make any answer a recall task (round 3)
  RECALL_CLUES: ["audio", "definition", "cloze"],
  PRESETS: [
    { id: "classic", clue: "thai", answer: "shoot" },
    { id: "spelling", clue: "thai", answer: "spell" },
    { id: "paraphrase", clue: "definition", answer: "shoot" },
    { id: "listening", clue: "audio", answer: "shoot" },
    { id: "dictation", clue: "audio", answer: "spell" },
    { id: "context", clue: "cloze", answer: "shoot" },
    { id: "adaptive", adaptive: true },
  ],
  preset(id) { return this.PRESETS.find((p) => p.id === id) || this.PRESETS[0]; },
  available(p) {
    if (typeof p === "string") p = this.preset(p);
    if (p.adaptive) return true;
    return !!(this.CLUES[p.clue] && this.CLUES[p.clue].available && this.ANSWERS[p.answer] && this.ANSWERS[p.answer].available);
  },
  availablePresets() { return this.PRESETS.filter((p) => this.available(p)); },
  isRecall(clue, answer) { return !!(this.ANSWERS[answer] && this.ANSWERS[answer].recall) || this.RECALL_CLUES.includes(clue); },

  // Adaptive: the pair for a word, from its box
  adaptiveFor(pair) {
    const b = G.SRS.box(pair);
    return { clue: "thai", answer: b >= G.CONFIG.adaptive.spellFromBox ? "spell" : "shoot" };
  },

  // the rules of one run; `words`, when the run's words are known ahead (a
  // study session), lets Adaptive leave the typing controls off if none of
  // them will be spelt
  run(presetId, words) {
    const p = this.preset(presetId || "classic");
    const L = this;
    return {
      id: p.id,
      adaptive: !!p.adaptive,
      pick(pair) { return p.adaptive ? L.adaptiveFor(pair) : { clue: p.clue, answer: p.answer }; },
      clueFor(pair) { return this.pick(pair).clue; },
      answerFor(pair) { return this.pick(pair).answer; },
      // might this run ask anything by spelling? (the typing controls are set up for it)
      spells: p.adaptive ? (words ? words.some((w) => L.adaptiveFor(w).answer === "spell") : true) : p.answer === "spell",
      // does it ask anything by shooting? (Adaptive always may: a word
      // missed goes back to box 1, and box 1 is shot)
      shoots: p.adaptive || p.answer === "shoot",
    };
  },
  // the text a clue shows for a word (round 2: the Thai meaning)
  clueText(pair, clue) {
    if (!pair) return "";
    return pair[1] || "";
  },
};

// ===================================================================
// The words of a wave (vocabulary series, round 2, C3)
// -------------------------------------------------------------------
// A wave's target words are a mix: every word due for review first (the
// most overdue), then words still being learnt (boxes 1-2), then at most
// four new ones (G.CONFIG.waveWords.maxNew), and known words to fill. The
// old rules hold: at least six different words a wave (more new ones only
// if there is nothing else to make six), and the end-of-wave quiz asks the
// words the wave brought. Zombies take the plan's words in turn; once each
// has come, they come round again.
// ===================================================================
G.WavePlan = {
  size(pool, kills) {
    const W = G.CONFIG.waveWords, min = G.CONFIG.quiz.minWordsPerWave;
    return Math.min(pool.length, Math.max(min, Math.min(W.max, Math.round((kills || 10) * W.share))));
  },
  build(pool, n) {
    const W = G.CONFIG.waveWords, min = Math.min(pool.length, G.CONFIG.quiz.minWordsPerWave);
    n = Math.min(pool.length, Math.max(min, n || min));
    const sp = G.SRS.split(pool);
    const plan = [];
    const take = (list, k) => { for (const p of list) { if (k <= 0 || plan.length >= n) break; if (!plan.includes(p)) { plan.push(p); k--; } } };
    take(sp.due, n);
    take(G.shuffle(sp.learning), Math.ceil(n * W.learningShare));
    take(G.shuffle(sp.fresh), W.maxNew);
    take(G.weightedSample(sp.known, n), n);
    take(G.shuffle(sp.learning), n);
    // a new player: only new words exist, so enough of them to make six
    if (plan.length < min) take(G.shuffle(sp.fresh), min - plan.length);
    return plan;
  },
  // what a plan is made of, for the report and the tests
  describe(plan) {
    const sp = G.SRS.split(plan);
    return { due: sp.due.length, learning: sp.learning.length, fresh: sp.fresh.length, known: sp.known.length, total: plan.length };
  },
};
