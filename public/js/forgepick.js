// ===================================================================
// The Word Forge's words (expansion, round 6)
// -------------------------------------------------------------------
// Which words a try at the Word Forge asks, and as what kind of question.
// Pure: everything it reads comes in `ctx` -- js/forge.js passes the game's
// learning record, the tests (tools/round35-test.js) their own.
//
//   G.ForgePick.pick(ctx, n)   -> { words, from, short, seen }
//     the order (the prompt, 6.3), each word in the first group it fits:
//       1  confused  the words the player still confuses (js/srs.js conf) or
//                    got wrong lately (this run, or within recentDays)
//       2  due       due for review, in boxes 1-3 (the most overdue first)
//       3  level     this level's words, the harder first: the AWL sublist
//                    (1 the most common ... 10 the rarest), a topic word by the
//                    player's own mistakes (the user's choice: no CEFR here)
//       4  met       any other word the player has met (the least known
//                    first), only when the three above are not enough
//     Never a word never met (no memory box). One try never asks a word twice;
//     a word an earlier try of the run asked comes only when nothing else will
//     do. short: how many words are missing for a try (0: enough).
//   G.ForgePick.types(words, rule, ctx)  -> [kind]
//     rule.recall of them written (typed, or heard and typed -- the first such
//     kind the word can be asked as, in turn), every word in box 4 or up a
//     recall kind (js/srs.js: those boxes are only reached by recall), the
//     rest one of the eight by the word's box (js/questions.js), varied.
//
// ctx for pick: { pool: [pair], key(p), state(p) -> {b, due, ...} | null,
//   today, confused(p) -> n, wrongLately(p) -> n, level, levelOf(p),
//   difficulty(p) -> 0-1, used: Set of keys, rng() }
// ctx for types: { can(kind, pair), box(pair), pickType(pair, prev), recall: [kinds], written: [kinds] }
// ===================================================================
window.G = window.G || {};

G.ForgePick = (function () {
  const GROUPS = ["confused", "due", "level", "met"];

  function pick(ctx, n) {
    const rng = ctx.rng || Math.random, used = ctx.used || new Set();
    const groups = { confused: [], due: [], level: [], met: [] };
    let seen = 0;
    const keys = new Set();
    (ctx.pool || []).forEach((p) => {
      const k = ctx.key(p), s = ctx.state(p);
      if (!k || !s || keys.has(k)) return;              // never met (no box), or the same word twice in the pool
      keys.add(k); seen++;
      const r = rng();                                   // (ties broken at random)
      const c = ctx.confused(p) || 0, w = ctx.wrongLately(p) || 0;
      if (c > 0 || w > 0) groups.confused.push({ p, k, order: [-(c * 2 + w), r] });
      else if (s.due <= ctx.today && s.b <= 3) groups.due.push({ p, k, order: [s.due, s.b, r] });
      else if (ctx.level != null && ctx.levelOf(p) === ctx.level) groups.level.push({ p, k, order: [-(ctx.difficulty(p) || 0), r] });
      else groups.met.push({ p, k, order: [s.b, r] });
    });
    const by = (a, b) => { for (let i = 0; i < a.order.length; i++) if (a.order[i] !== b.order[i]) return a.order[i] - b.order[i]; return 0; };
    const order = [];
    GROUPS.forEach((g) => { groups[g].sort(by).forEach((x) => order.push(Object.assign(x, { group: g }))); });
    // (a word an earlier try asked: last, whatever its group)
    const list = order.filter((x) => !used.has(x.k)).concat(order.filter((x) => used.has(x.k)));
    const out = list.slice(0, n);
    return { words: out.map((x) => x.p), from: out.map((x) => x.group), reused: out.filter((x) => used.has(x.k)).length, short: Math.max(0, n - out.length), seen };
  }

  function types(words, rule, ctx) {
    const out = new Array(words.length).fill(null), need = Math.min(rule.recall || 0, words.length);
    // the written ones: a word in box 4 or up first (it needs recall anyway), then in order
    const idx = words.map((p, i) => i).sort((a, b) => (ctx.box(words[b]) >= 4 ? 1 : 0) - (ctx.box(words[a]) >= 4 ? 1 : 0));
    let made = 0, turn = 0;
    for (const i of idx) {
      if (made >= need) break;
      const W = ctx.written;
      for (let t = 0; t < W.length; t++) {
        const kind = W[(turn + t) % W.length];
        if (ctx.can(kind, words[i])) { out[i] = kind; made++; turn = (turn + t + 1) % W.length; break; }
      }
    }
    let prev = null;
    words.forEach((p, i) => {
      if (out[i]) { prev = out[i]; return; }
      let kind = ctx.pickType(p, prev);
      // (box 4 and up: a recall kind -- one the word has, else written)
      if (ctx.box(p) >= 4 && !ctx.recall.includes(kind)) kind = ctx.recall.find((k) => k !== prev && ctx.can(k, p)) || ctx.recall.find((k) => ctx.can(k, p)) || "spell";
      out[i] = kind; prev = kind;
    });
    return out;
  }

  return { GROUPS, pick, types };
})();
