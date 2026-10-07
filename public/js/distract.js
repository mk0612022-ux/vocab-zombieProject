// ===================================================================
// Distractors that can really be confused (vocabulary series, round 2, E)
// -------------------------------------------------------------------
// For a target word in box 2 or higher (G.CONFIG.distractors.fromBox), one
// or two of the wrong answers -- the other zombies on the field, the wrong
// choices of a question -- are look-alikes, taken in this order:
//   1. words the player has confused with it before (js/srs.js, E2)
//   2. its confusables (the bank, or the confusables lexicon: those are
//      only ever wrong answers)
//   3. bank words spelt within two letters of it
//   4. words of the same topic
// and the rest are drawn as usual. A new word or one in box 1 gets only
// clearly different words -- none of the above -- so it is not learnt mixed
// up from the start. Never a word with the same Thai meaning.
//
//   G.Distract.forChoices(pair, pool, n)   n wrong answers for a question
//   G.Distract.forField(pair, game)        a look-alike to put on the field
//   G.Distract.isSimilar(a, b)             look-alikes (either way round)
// ===================================================================
window.G = window.G || {};

G.Distract = {
  _near: new Map(),

  // letters apart (insert, delete, change), giving up past `max`
  distance(a, b, max) {
    a = String(a).toLowerCase(); b = String(b).toLowerCase();
    if (max == null) max = 99;
    if (Math.abs(a.length - b.length) > max) return max + 1;
    let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
    for (let i = 1; i <= a.length; i++) {
      const cur = [i];
      let best = i;
      for (let j = 1; j <= b.length; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        if (cur[j] < best) best = cur[j];
      }
      if (best > max) return max + 1;
      prev = cur;
    }
    return prev[b.length];
  },

  // a word (bank key -- "analyse@zh" too --, bank form, lexicon word or the
  // player's own) as a pair [word, meaning] in the languages chosen, with
  // .id, and .lexicon for a confusables-lexicon word (English > Thai only:
  // those words have nothing else)
  resolve(w) {
    if (!w) return null;
    if (Array.isArray(w)) return w;
    const k = G.wordKey.parse(w);
    if (k.lang !== "en" && k.lang !== G.Lang.word()) return null;
    const e = G.WordBank.byId(k.id) || G.WordBank.textOwner(k.id);
    if (e) return G.WordBank.pairOf(e);
    const c = G.Lang.word() === "en" && G.Lang.meaning() === "th" ? G.WordBank.confusable(w) : null;
    if (c) { const p = [c.headword, c.thai]; p.id = c.headword.toLowerCase(); p.lexicon = true; return p; }
    const key = String(k.id).toLowerCase();
    const lists = G.CustomVocab && G.CustomVocab.allCurrent ? [G.CustomVocab.allCurrent()] : Object.values(G.save.customWords || {});
    for (const list of lists) {
      const hit = list.find((p) => p[0].toLowerCase() === key);
      if (hit) return hit;
    }
    return null;
  },

  // bank words spelt within `nearSpelling` letters of this one (round 3: in
  // the Word Language; Chinese within one character -- two would be any word)
  nearSpellings(word) {
    const w = String(word).toLowerCase(), wl = G.Lang.word();
    if (this._near.has(w)) return this._near.get(w);
    const max = wl === "zh" ? 1 : G.CONFIG.distractors.nearSpelling, out = [];
    G.WordBank.entries().forEach((e) => {
      const h = G.Lang.text(e, wl).toLowerCase();
      if (!h || h === w) return;
      const d = this.distance(w, h, max);
      if (d <= max) out.push({ id: e.id, d });
    });
    out.sort((a, b) => a.d - b.d);
    const ids = out.map((o) => o.id);
    this._near.set(w, ids);
    return ids;
  },

  // the look-alikes of a word, best first, as pairs; `withTopic` adds the
  // same-topic words at the end
  similar(pair, withTopic) {
    if (!pair) return [];
    const info = G.WordBank.info(pair);
    const key = G.wordKey(pair);
    const out = [], seen = new Set([key]);
    const add = (w, source) => {
      const p = this.resolve(w);
      if (!p) return;
      const k = G.wordKey(p);
      if (seen.has(k)) return;
      seen.add(k);
      const q = p.slice(); q.id = p.id; q.lexicon = p.lexicon; q.source = source;
      out.push(q);
    };
    G.SRS.confusedWith(pair).forEach((x) => add(x, "confusion"));
    // (the bank's confusables are English look-alikes)
    if (G.Lang.enWord(pair)) ((info && info.confusables) || []).forEach((x) => add(x, "confusable"));
    this.nearSpellings(pair[0]).forEach((x) => add(x, "spelling"));
    if (withTopic && info && info.topic) {
      G.shuffle(G.WordBank.entries(info.level || undefined).filter((e) => e.topic === info.topic)).slice(0, 12).forEach((e) => add(e.id, "topic"));
    }
    return out;
  },
  isSimilar(a, b) {
    const kb = G.wordKey(b), ka = G.wordKey(a);
    return this.similar(a).some((p) => G.wordKey(p) === kb) || this.similar(b).some((p) => G.wordKey(p) === ka);
  },
  lookAlikesWanted(pair) { return G.SRS.box(pair) >= G.CONFIG.distractors.fromBox; },

  // n wrong answers for a question on `pair`, drawn from `pool` (the level's
  // words): look-alikes first for a word the player is getting to know,
  // clearly different words for a new one. Never the same Thai meaning.
  forChoices(pair, pool, n) {
    n = n == null ? 3 : n;
    const same = (a, b) => String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
    const picked = [];
    const ok = (p) => p && !same(p[0], pair[0]) && !same(p[1], pair[1]) && !picked.some((q) => same(q[0], p[0]) || same(q[1], p[1]));
    const sim = this.similar(pair, true);
    if (this.lookAlikesWanted(pair)) {
      for (const p of sim) {
        if (picked.length >= Math.min(n, G.CONFIG.distractors.choices)) break;
        if (ok(p)) picked.push(p);
      }
    }
    const simKeys = new Set(sim.filter((p) => p.source !== "topic").map((p) => G.wordKey(p)));
    const avoid = !this.lookAlikesWanted(pair);
    for (const p of G.shuffle((pool || G.getAllBuiltinWords()).slice())) {
      if (picked.length >= n) break;
      if (avoid && simKeys.has(G.wordKey(p))) continue;
      if (ok(p)) picked.push(p);
    }
    return picked;
  },

  // A look-alike to bring onto the field while `pair` is the target (box 2+),
  // or null. From the run's own words if it can be, else from the whole bank
  // or the lexicon (`decoy`: such a zombie is never a target itself).
  forField(pair, game) {
    if (!pair || !this.lookAlikesWanted(pair)) return null;
    const alive = game.zombies.filter((z) => z.alive);
    const words = new Set(alive.map((z) => z.word.toLowerCase()));
    const meanings = new Set(alive.map((z) => (z.meaning || "").trim()));
    const pool = game.wordPool || [];
    const inPool = (p) => pool.find((q) => G.wordKey(q) === G.wordKey(p));
    for (const p of this.similar(pair, false)) {
      if (words.has(p[0].toLowerCase()) || meanings.has((p[1] || "").trim()) || (p[1] || "").trim() === (pair[1] || "").trim()) continue;
      const own = inPool(p);
      if (own) return { pair: own, decoy: false, source: p.source };
      return { pair: p, decoy: true, source: p.source };
    }
    return null;
  },
};
