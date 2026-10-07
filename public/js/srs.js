// ===================================================================
// Spaced repetition (vocabulary series, round 2, C): five boxes
// -------------------------------------------------------------------
// Every word the player has met sits in a box, 1 to 5, or is Mastered; a
// word never met is New. A right answer on a word that is due moves it up
// one box and books its next review (G.CONFIG.srs.intervals: 1, 3, 7, 14,
// 30 days); passing the box-5 review makes it Mastered (back every 60
// days). A wrong answer sends it to box 1. Right answers before the word is
// due change nothing -- the spacing is the point.
//
//   recall        boxes 4, 5 and Mastered need an answer the player had to
//                 produce (spelling it; round 3 adds dictation, paraphrase
//                 and context). A recognition answer (shooting the right
//                 zombie, a multiple-choice question) goes no higher than
//                 box 3 (G.CONFIG.srs.recognitionMaxBox).
//   assisted      an answer given with help (a hint, a perk or ability that
//                 shows letters or marks the answer) moves nothing.
//   days          the device's own calendar: a day number (local midnight),
//                 G.Clock.today(). Tests move it with G.Clock.offsetDays.
//
// Also kept here: the pairs the player confuses (E2) -- (target Y, the X
// taken for it) with a count, let go after `distractors.clearAfter` right
// answers in a row with X in view -- and the Daily Review streak (C4).
//
// Saved as G.save.learn = { v, srs: {key: {b, due, last, n, lapses}},
// conf: {Y: {X: {n, ok, off}}}, daily: {streak, best, last, nextDue, days} }
// under the word keys of G.wordKey. G.Learning.normalize makes any stored
// value valid, and fills it from the old statistics the first time (C5).
// ===================================================================
window.G = window.G || {};

G.Clock = {
  offsetDays: 0,                     // simulated days ahead (tests only; never saved)
  now() { return Date.now() + this.offsetDays * 864e5; },
  // local calendar day as a number: the same all day, +1 at local midnight
  today() { const d = new Date(this.now()); return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 864e5); },
};

G.Learning = {
  MASTERED: 6,
  // a valid G.save.learn from whatever was stored; `stats` (wordStats) seeds
  // the boxes of a save that had none yet
  normalize(raw, stats) {
    const today = G.Clock.today();
    const obj = (o) => (o && typeof o === "object" && !Array.isArray(o) ? o : null);
    const int = (v, lo, hi, d) => { v = Math.floor(Number(v)); return Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d; };
    const r = obj(raw);
    // (round 4: skills -- right / wrong by kind of task, for the Progress
    // page; activity -- words answered a day; spellRun -- right spellings in
    // a row, for Spelling Bee)
    const out = { v: 1, srs: {}, conf: {}, daily: { streak: 0, best: 0, last: null, nextDue: null, days: {} }, skills: {}, activity: {}, spellRun: 0 };
    this.SKILLS.forEach((k) => { out.skills[k] = { r: 0, w: 0 }; });
    if (!r) {
      // C5: a player from before: every word the old statistics knew starts
      // in a box by its accuracy, due today
      const F = G.CONFIG.srs.fromStats;
      Object.keys(obj(stats) || {}).forEach((k) => {
        const s = stats[k];
        if (!obj(s)) return;
        const c = Math.max(0, Number(s.correct) || 0), w = Math.max(0, Number(s.wrong) || 0);
        if (c + w < 1) return;
        const acc = c / (c + w);
        out.srs[k] = { b: acc >= F.high ? 3 : acc >= F.mid ? 2 : 1, due: today, last: null, n: 0, lapses: 0, from: "stats" };
      });
      return out;
    }
    Object.keys(obj(r.srs) || {}).forEach((k) => {
      const s = obj(r.srs[k]);
      if (!s || !k) return;
      // (a box below 1 is no box: the word is New)
      const raw = Math.floor(Number(s.b));
      if (!Number.isFinite(raw) || raw < 1) return;
      const b = Math.min(this.MASTERED, raw);
      out.srs[k] = { b, due: int(s.due, 0, 1e7, today), last: s.last == null ? null : int(s.last, 0, 1e7, null), n: int(s.n, 0, 1e7, 0), lapses: int(s.lapses, 0, 1e7, 0) };
      if (s.from === "stats") out.srs[k].from = "stats";
    });
    Object.keys(obj(r.conf) || {}).forEach((y) => {
      const row = obj(r.conf[y]);
      if (!row) return;
      Object.keys(row).forEach((x) => {
        const c = obj(row[x]);
        if (!c || !x || x === y) return;
        (out.conf[y] = out.conf[y] || {})[x] = { n: int(c.n, 0, 1e7, 0), ok: int(c.ok, 0, 1e7, 0), off: !!c.off };
      });
    });
    const d = obj(r.daily);
    if (d) {
      out.daily.streak = int(d.streak, 0, 1e7, 0);
      out.daily.best = Math.max(out.daily.streak, int(d.best, 0, 1e7, 0));
      out.daily.last = d.last == null ? null : int(d.last, 0, 1e7, null);
      out.daily.nextDue = d.nextDue == null ? null : int(d.nextDue, 0, 1e7, null);
      const days = obj(d.days) || {};
      Object.keys(days).forEach((k) => { const n = int(days[k], 0, 1e5, 0); if (/^\d+$/.test(k) && n > 0) out.daily.days[k] = n; });
    }
    const sk = obj(r.skills) || {};
    this.SKILLS.forEach((k) => { const s = obj(sk[k]) || {}; out.skills[k] = { r: int(s.r, 0, 1e8, 0), w: int(s.w, 0, 1e8, 0) }; });
    const act = obj(r.activity) || {};
    Object.keys(act).forEach((k) => { const n = int(act[k], 0, 1e6, 0); if (/^\d+$/.test(k) && n > 0) out.activity[k] = n; });
    out.spellRun = int(r.spellRun, 0, 1e7, 0);
    return out;
  },
  // (round 4, I) the kinds of task the Progress page shows accuracy for
  SKILLS: ["recognition", "spelling", "listening", "paraphrase", "context"],
  // the skills an answer trains: its clue and how it was given
  skillsFor(clue, answer) {
    const out = [];
    if (answer === "spell") out.push("spelling");
    if (clue === "audio") out.push("listening");
    else if (clue === "definition") out.push("paraphrase");
    else if (clue === "cloze") out.push("context");
    return out.length ? out : ["recognition"];
  },
};

// One answer on a word, everywhere it is asked: the old statistics
// (G.recordWordResult), its box, and the confused pairs -- a wrong answer
// that was another word (`typed`, `picked`: X) is noted against it; a right
// one with its look-alikes in view (`inView`) counts towards letting them go.
//   opts: { recall, assisted, typed, picked, inView }
G.Learning.answerWord = function (pair, right, opts) {
  opts = opts || {};
  if (!pair) return null;
  G.recordWordResult(pair, right, { srs: false });
  const r = G.SRS.answer(pair, right, opts);
  G.Learning.track(right, opts);
  if (r && r.to >= G.Learning.MASTERED && r.from < G.Learning.MASTERED) G.Learning.checkMastery();
  const x = !right ? (opts.picked || (G.SRS.typedWord(opts.typed, pair) ? opts.typed : null)) : null;
  if (x && G.wordKey(x) !== G.wordKey(pair)) G.SRS.noteConfusion(pair, x);
  G.SRS.noteAnswer(pair, right, opts.inView);
  return r;
};

// (round 4) the day's activity, the skills, the run of right spellings
//   opts.skills: ["spelling", "listening", ...] (else recognition)
G.Learning.track = function (right, opts) {
  const L = G.save.learn;
  if (!L) return;
  const day = G.Clock.today();
  L.activity[day] = (L.activity[day] || 0) + 1;
  Object.keys(L.activity).forEach((k) => { if (+k < day - 60) delete L.activity[k]; });
  const skills = opts.skills && opts.skills.length ? opts.skills : ["recognition"];
  skills.forEach((k) => { const s = L.skills[k] || (L.skills[k] = { r: 0, w: 0 }); if (right) s.r++; else s.w++; });
  // Spelling Bee: fifty right in a row (a hinted one neither counts nor breaks it)
  if (skills.includes("spelling") && !opts.assisted) {
    L.spellRun = right ? (L.spellRun || 0) + 1 : 0;
    if (L.spellRun >= G.CONFIG.achievements.spellingBee) G.unlockAchievement("spelling_bee");
  }
};
// (J3) the learning achievements that come with a word Mastered
G.Learning.checkMastery = function () {
  const S = G.save.learn.srs;
  const mastered = Object.keys(S).filter((k) => S[k].b >= G.Learning.MASTERED);
  if (mastered.length >= 1) G.unlockAchievement("first_mastered");
  if (mastered.length >= G.CONFIG.achievements.mastered) G.unlockAchievement("mastered_100");
  const sub1 = G.WordBank.entries().filter((e) => e.source === "AWL" && e.awlSublist === 1);
  if (sub1.length && sub1.every((e) => S[e.id] && S[e.id].b >= G.Learning.MASTERED)) G.unlockAchievement("awl_sublist1");
};

G.SRS = {
  C() { return G.CONFIG.srs; },
  data() { return G.save.learn; },
  key(w) { return G.wordKey(w); },
  // (round 3) is what was typed another word of the bank -- in the word's
  // language -- or (English) a known look-alike? Then it is a confusion
  typedWord(typed, pair) {
    if (!typed) return false;
    const lang = G.Lang.wl(pair);
    return !!(G.WordBank.textOwner(typed, lang) || (lang === "en" && G.WordBank.confusable(typed)));
  },
  state(w) { return this.data().srs[this.key(w)] || null; },
  // 0 = New, 1-5 = the box, 6 = Mastered
  box(w) { const s = this.state(w); return s ? s.b : 0; },
  isNew(w) { return !this.state(w); },
  isDue(w, today) { const s = this.state(w); return !!s && s.due <= (today == null ? G.Clock.today() : today); },
  isLearning(w) { const b = this.box(w); return b === 1 || b === 2; },
  interval(b) { return b >= G.Learning.MASTERED ? this.C().masteredEvery : this.C().intervals[Math.max(1, b) - 1]; },

  // An answer. result: "right" | "wrong"; opts.recall (the player produced
  // the word), opts.assisted (with help: nothing moves). Returns what
  // happened: { from, to, due, change: "up" | "down" | "same" | "none" }.
  answer(w, right, opts) {
    opts = opts || {};
    const key = this.key(w);
    if (!key) return null;
    const S = this.data().srs, today = G.Clock.today();
    const s = S[key];
    const from = s ? s.b : 0;
    if (opts.assisted) return { key, from, to: from, due: s ? s.due : null, change: "none" };
    if (!right) {
      const n = S[key] = { b: 1, due: today + this.interval(1), last: today, n: (s ? s.n : 0) + 1, lapses: (s ? s.lapses : 0) + (s ? 1 : 0) };
      return { key, from, to: 1, due: n.due, change: from > 1 ? "down" : from === 0 ? "new" : "same" };
    }
    if (!s) {
      S[key] = { b: 1, due: today + this.interval(1), last: today, n: 1, lapses: 0 };
      return { key, from: 0, to: 1, due: S[key].due, change: "new" };
    }
    s.n++;
    if (s.due > today) { s.last = today; return { key, from, to: from, due: s.due, change: "none" }; }   // not due: practice only
    let to = Math.min(G.Learning.MASTERED, from + 1);
    // box 4, 5 and Mastered only through recall
    if (!opts.recall && to > this.C().recognitionMaxBox) to = Math.max(from, Math.min(to, this.C().recognitionMaxBox));
    s.b = to; s.last = today; s.due = today + this.interval(to);
    delete s.from;
    return { key, from, to, due: s.due, change: to > from ? "up" : "same" };
  },

  // ---- the words of a pool, sorted into the three kinds of C3 ----
  split(pool, today) {
    today = today == null ? G.Clock.today() : today;
    const due = [], learning = [], fresh = [], known = [];
    (pool || []).forEach((p) => {
      const s = this.state(p);
      if (!s) fresh.push(p);
      else if (s.due <= today) due.push(p);
      else if (s.b <= 2) learning.push(p);
      else known.push(p);
    });
    // the most overdue first, then the lowest box
    due.sort((a, b) => (this.state(a).due - this.state(b).due) || (this.state(a).b - this.state(b).b));
    return { due, learning, fresh, known };
  },
  // every word due today across the game (built-in and the player's own),
  // most overdue first
  dueToday(today) {
    return this.split(this.pool(), today).due;
  },
  // every word there is to review, once each: the built-in ones and the
  // player's own (a word whose box outlived it -- a deleted word of the
  // player's -- is not counted)
  pool() {
    const seen = new Set(), out = [];
    // (round 3: the player's own words in the languages chosen)
    const own = G.CustomVocab && G.CustomVocab.allCurrent ? G.CustomVocab.allCurrent() : [].concat(...Object.values(G.save.customWords || {}));
    G.getAllBuiltinWords().concat(own).forEach((p) => {
      const k = this.key(p);
      if (k && !seen.has(k)) { seen.add(k); out.push(p); }
    });
    return out;
  },
  dueOn(day) {
    return this.pool().filter((p) => { const s = this.state(p); return s && s.due <= day; }).length;
  },
  // counts for the lobby and the Progress page: due today, due tomorrow
  // (not counting today's), and due over the coming week (days 1-7)
  forecast() {
    const t = G.Clock.today();
    let today = 0, tomorrow = 0, week = 0;
    this.pool().forEach((p) => { const s = this.state(p); if (!s) return; if (s.due <= t) today++; else { if (s.due === t + 1) tomorrow++; if (s.due <= t + 7) week++; } });
    return { today, tomorrow, week };
  },

  // ---- confused pairs (E2) ----
  noteConfusion(y, x) {
    const Y = this.key(y), X = this.key(x);
    if (!Y || !X || Y === X) return;
    const C = this.data().conf;
    const row = C[Y] = C[Y] || {};
    const c = row[X] = row[X] || { n: 0, ok: 0, off: false };
    c.n++; c.ok = 0; c.off = false;
  },
  // Y answered: right with these words in view -> the pairs they belong to
  // count a right answer in a row; wrong -> the rows start again
  noteAnswer(y, right, inView) {
    const row = this.data().conf[this.key(y)];
    if (!row) return;
    const seen = new Set((inView || []).map((w) => this.key(w)));
    Object.keys(row).forEach((x) => {
      const c = row[x];
      if (c.off) return;
      if (!right) { c.ok = 0; return; }
      if (seen.has(x) && ++c.ok >= G.CONFIG.distractors.clearAfter) c.off = true;
    });
  },
  // the words Y is still confused with, most often first
  confusedWith(y) {
    const row = this.data().conf[this.key(y)];
    if (!row) return [];
    return Object.keys(row).filter((x) => !row[x].off).sort((a, b) => row[b].n - row[a].n);
  },
  confusionCount(y, x) { const row = this.data().conf[this.key(y)]; const c = row && row[this.key(x)]; return c ? c.n : 0; },

  // ---- the Daily Review streak (C4) ----
  // The streak as it stands today: a day missed only breaks it if something
  // was due that day (nextDue: the first day with a word due, as the last
  // session left things)
  streakNow(today) {
    const d = this.data().daily;
    today = today == null ? G.Clock.today() : today;
    if (d.last == null) return 0;
    if (d.last >= today - 1) return d.streak;
    // a word due on a day since then (as the last session left things, or
    // from what was learnt after it) that was not reviewed that day
    let first = d.nextDue == null ? Infinity : d.nextDue;
    const S = this.data().srs;
    Object.keys(S).forEach((k) => { if (S[k].due < first) first = S[k].due; });
    return first <= today - 1 ? 0 : d.streak;
  },
  // a Daily Review session finished
  completeDaily(reviewed, today) {
    const d = this.data().daily;
    today = today == null ? G.Clock.today() : today;
    d.days[today] = (d.days[today] || 0) + reviewed;
    if (d.last !== today) {
      d.streak = this.streakNow(today) + 1;
      d.last = today;
    }
    d.best = Math.max(d.best, d.streak);
    if (d.streak >= G.CONFIG.achievements.reviewStreak) G.unlockAchievement("review_streak7");
    const S = this.data().srs, dues = Object.keys(S).map((k) => S[k].due);
    d.nextDue = dues.length ? Math.min(...dues) : null;
    // keep sixty days of history
    Object.keys(d.days).forEach((k) => { if (+k < today - 60) delete d.days[k]; });
    return d.streak;
  },
};
