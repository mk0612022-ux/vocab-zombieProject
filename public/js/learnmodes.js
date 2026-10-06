// ===================================================================
// Learning modes (vocabulary series, round 2, B): a clue x an answer
// -------------------------------------------------------------------
// Every mode is two parts that combine freely, rather than a mode written
// on its own:
//   clue    what the player is given   thai (the Thai meaning), definition
//                                      (English, "≈ similar meaning"), audio
//                                      (the word spoken), cloze (a sentence
//                                      with it taken out) -- js/clues.js
//   answer  how they answer            shoot (the zombie carrying the right
//                                      English word) or spell (type it, or
//                                      put its letters in order)
// The ready-made modes are pairs of those; Adaptive picks a pair for each
// word from its box (js/srs.js, G.CONFIG.adaptive.byBox): new words and box
// 1 Thai and shot, then English clues, then spelling and dictation. A mode
// whose clue or answer is not built is not offered (`available`).
//
//   G.Learn.run(presetId)  the rules for one run: clueFor(pair), answerFor(pair)
//   recall answers         spell, dictation, paraphrase (definition) and
//                          context (cloze) -- what boxes 4-5 need
// ===================================================================
window.G = window.G || {};

G.Learn = {
  // (round 3: the English clues -- js/clues.js; a word without the data for
  // a clue gets the Thai one instead)
  CLUES: {
    thai: { available: true },
    definition: { available: true },       // F: its English definition, "≈ similar meaning"
    audio: { available: true },            // G: the word spoken
    cloze: { available: true },            // H1: a sentence with it taken out
  },
  ANSWERS: {
    shoot: { available: true, recall: false },
    spell: { available: true, recall: true },
  },
  // clues that make even a shot a recall task (C1: Paraphrase and Context
  // count for boxes 4-5; Listening -- hearing it and shooting its meaning --
  // does not, Dictation does through its spelling)
  RECALL_CLUES: ["definition", "cloze"],
  PRESETS: [
    { id: "classic", clue: "thai", answer: "shoot" },
    { id: "spelling", clue: "thai", answer: "spell" },
    { id: "paraphrase", clue: "definition", answer: "shoot" },
    { id: "listening", clue: "audio", answer: "shoot" },
    { id: "dictation", clue: "audio", answer: "spell" },
    { id: "context", clue: "cloze", answer: "shoot" },
    { id: "adaptive", adaptive: true },
  ],
  // (round 4: "custom:clue+answer" -- a pairing of the player's own, J1, J2)
  preset(id) {
    const m = /^custom:([a-z]+)\+([a-z]+)$/.exec(id || "");
    if (m && this.CLUES[m[1]] && this.ANSWERS[m[2]]) return { id, custom: true, clue: m[1], answer: m[2] };
    return this.PRESETS.find((p) => p.id === id) || this.PRESETS[0];
  },
  customId(clue, answer) { return "custom:" + clue + "+" + answer; },
  // the campaign's Learning Styles (J2): Adaptive, Classic, or a pairing of the player's own
  CAMPAIGN_STYLES: ["adaptive", "classic"],
  campaignStyleOk(id) { return this.CAMPAIGN_STYLES.includes(id) || (typeof id === "string" && !!this.preset(id).custom); },
  // the name a mode goes by: a preset's, or "Definition + Spell"
  label(id) {
    const p = this.preset(id);
    return p.custom ? G.T("learn.customName", { clue: G.T("learn.clue." + p.clue), answer: G.T("learn.answer." + p.answer) }) : G.T("learn.preset." + p.id);
  },
  // the leaderboard a mode's sessions go on
  boardOf(id) { const p = this.preset(id); return "mode_" + (p.custom ? "custom" : p.id); },
  available(p) {
    if (typeof p === "string") p = this.preset(p);
    if (p.adaptive) return true;
    return !!(this.CLUES[p.clue] && this.CLUES[p.clue].available && this.ANSWERS[p.answer] && this.ANSWERS[p.answer].available);
  },
  availablePresets() { return this.PRESETS.filter((p) => this.available(p)); },
  isRecall(clue, answer) { return !!(this.ANSWERS[answer] && this.ANSWERS[answer].recall) || this.RECALL_CLUES.includes(clue); },

  // can this word be asked with this clue? (a player's own word may have no
  // definition or example sentence)
  usable(pair, clue) { return G.Clues.has(pair, clue); },

  // Adaptive: the clue and answer for a word, from its box
  // (G.CONFIG.adaptive.byBox) -- one of those its data allows, the same all
  // day for that word, so a word is not asked one way and then another
  adaptiveFor(pair) {
    const b = Math.min(6, Math.max(0, G.SRS.box(pair)));
    const opts = (G.CONFIG.adaptive.byBox[b] || ["thai+shoot"]).map((s) => { const [clue, answer] = s.split("+"); return { clue, answer }; })
      .filter((o) => this.usable(pair, o.clue));
    if (!opts.length) return { clue: "thai", answer: "shoot" };
    const k = String(G.wordKey(pair)) + ":" + G.Clock.today();
    let h = 0;
    for (let i = 0; i < k.length; i++) h = (h * 31 + k.charCodeAt(i)) >>> 0;
    return opts[h % opts.length];
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
      pick(pair) {
        if (p.adaptive) return L.adaptiveFor(pair);
        // (a word without the data for this clue: the Thai one)
        return { clue: L.usable(pair, p.clue) ? p.clue : "thai", answer: p.answer };
      },
      clueFor(pair) { return this.pick(pair).clue; },
      answerFor(pair) { return this.pick(pair).answer; },
      // might this run ask anything by spelling? (the typing controls are set up for it)
      spells: p.adaptive ? (words ? words.some((w) => L.adaptiveFor(w).answer === "spell") : true) : p.answer === "spell",
      // does it ask anything by shooting? (Adaptive always may: a word
      // missed goes back to box 1, and box 1 is shot)
      shoots: p.adaptive || p.answer === "shoot",
      // the clue a preset is built on (for filtering a level's words)
      clue: p.adaptive ? null : p.clue,
    };
  },

  // What a zombie shows over its head for a clue and an answer (round 3):
  //   shoot: the English word -- the form a Cloze sentence wants -- or, for
  //   Listening, its Thai meaning (G1); spell: the Thai meaning, a one-word
  //   synonym (F), or nothing at all for Dictation (G2)
  //   (round 4, J2) in the campaign every shot zombie carries its English
  //   word: Audio + Shoot there is "shoot the word you hear"; a gap to spell
  //   shows the gap ("___"), its sentence on the panel
  labelFor(pair, clue, answer, form, campaign) {
    if (answer === "spell") {
      if (clue === "audio") return "";
      if (clue === "definition") return G.Clues.synonym(pair) || "≈";
      if (clue === "cloze") return "___";
      return pair[1] || "";
    }
    if (clue === "audio" && !campaign) return pair[1] || "";
    return form || pair[0];
  },
  // (round 2's name for the Thai clue)
  clueText(pair) { return pair ? pair[1] || "" : ""; },
  // Definition clues show the Thai as well while a word is new to the
  // player (box 1-2) -- or always, or never (Settings)
  showsThai(pair) {
    const s = G.save.settings.clueThai || "auto";
    if (s === "always") return true;
    if (s === "never") return false;
    return G.SRS.box(pair) <= G.CONFIG.clues.thaiUpToBox;
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
